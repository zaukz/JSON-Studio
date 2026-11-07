import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { EditorView } from '@codemirror/view'
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eraser,
  FolderOpen,
  GitCompare,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { CodeEditor } from '../components/CodeEditor'
import { ConfirmDialog } from '../components/Dialogs'
import { StatusBar, StatusItem, StatusSeparator } from '../components/StatusBar'
import { useToast } from '../components/Toasts'
import { Button, Chip, EmptyState, IconButton } from '../components/ui'
import { clearHighlight, revealRange } from '../lib/codemirror'
import { countDeltas, diffJson, locateDelta, type JsonDelta } from '../lib/diff'
import {
  formatPath,
  parseJson,
  previewValue,
  type JsonIssue,
  type JsonParseResult,
} from '../lib/json'
import { SAMPLE_COMPARE_LEFT, SAMPLE_COMPARE_RIGHT } from '../lib/samples'
import {
  cn,
  formatBytes,
  formatCount,
  isJsonFile,
  readTextFile,
  shortcutLabel,
  utf8Size,
} from '../lib/utils'

type Side = 'left' | 'right'

const NEXT_SHORTCUT = shortcutLabel(['F7'])
const PREVIOUS_SHORTCUT = shortcutLabel(['Shift', 'F7'])

function ComparePane({
  side,
  title,
  fileName,
  text,
  parse,
  onTextChange,
  onReady,
  onOpen,
  onClear,
  onJumpToIssue,
}: {
  side: Side
  title: string
  fileName: string
  text: string
  parse: JsonParseResult
  onTextChange: (text: string) => void
  onReady: (view: EditorView) => void
  onOpen: () => void
  onClear: () => void
  onJumpToIssue: (issue: JsonIssue) => void
}) {
  const issue = parse.valid ? null : parse.issue
  return (
    <section className="panel compare-pane">
      <div className="panel-head">
        <span className={cn('pane-dot', side === 'left' ? 'is-left' : 'is-right')} aria-hidden="true" />
        <span className="pane-title">{title}</span>
        <span className="pane-file" title={fileName}>
          {fileName}
        </span>
        {parse.empty ? (
          <Chip tone="neutral">Empty</Chip>
        ) : parse.valid ? (
          <Chip tone="ok" icon={<Check size={9} />}>
            Valid
          </Chip>
        ) : (
          <Chip tone="error">Invalid</Chip>
        )}
        <span className="head-spacer" />
        <IconButton
          label={`Open JSON for ${title.toLowerCase()}`}
          icon={<FolderOpen size={13} />}
          onClick={onOpen}
          placement="left"
          className="icon-btn-small"
        />
        <IconButton
          label={`Clear ${title.toLowerCase()}`}
          icon={<Eraser size={13} />}
          onClick={onClear}
          placement="left"
          className="icon-btn-small"
        />
      </div>

      {issue ? (
        <button type="button" className="editor-error" onClick={() => onJumpToIssue(issue)}>
          <AlertTriangle size={11} />
          <span>
            Ln {issue.line}, Col {issue.column}: {issue.message}
          </span>
        </button>
      ) : null}

      <CodeEditor
        initialDoc={text}
        language="json"
        lint
        syncValue={text}
        ariaLabel={`${title} JSON document`}
        placeholderText="Paste JSON here"
        onTextChange={onTextChange}
        onReady={onReady}
      />
    </section>
  )
}

function diffSign(kind: JsonDelta['kind']): string {
  if (kind === 'added') return '+'
  if (kind === 'removed') return '\u2212'
  return '~'
}

function diffValue(value: JsonDelta['oldValue']): ReactNode {
  return <span className={cn(value === undefined ? 'diff-old' : 'diff-new')}>{previewValue(value)}</span>
}

export function ComparePage({ active }: { active: boolean }) {
  const toast = useToast()
  const [leftText, setLeftText] = useState(SAMPLE_COMPARE_LEFT)
  const [rightText, setRightText] = useState(SAMPLE_COMPARE_RIGHT)
  const [leftName, setLeftName] = useState('original.json')
  const [rightName, setRightName] = useState('modified.json')
  const [activeIndex, setActiveIndex] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const leftViewRef = useRef<EditorView | null>(null)
  const rightViewRef = useRef<EditorView | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const pendingSide = useRef<Side>('left')
  const previousActive = useRef(-1)

  const leftParsed = useMemo(() => parseJson(leftText), [leftText])
  const rightParsed = useMemo(() => parseJson(rightText), [rightText])

  const comparison = useMemo(() => {
    if (leftParsed.empty || rightParsed.empty) {
      return { status: 'empty' as const, deltas: [] as JsonDelta[] }
    }
    if (!leftParsed.valid || !rightParsed.valid) {
      return { status: 'invalid' as const, deltas: [] as JsonDelta[] }
    }
    return {
      status: 'ready' as const,
      deltas: diffJson(leftParsed.value as NonNullable<typeof leftParsed.value>, rightParsed.value as NonNullable<typeof rightParsed.value>),
    }
  }, [leftParsed, rightParsed])

  const counts = useMemo(() => countDeltas(comparison.deltas), [comparison.deltas])
  const signature = useMemo(() => comparison.deltas.map((delta) => delta.id).join('|'), [comparison.deltas])

  useEffect(() => {
    setActiveIndex(comparison.deltas.length > 0 ? 0 : -1)
  }, [signature, comparison.deltas.length])

  useEffect(() => {
    const delta = activeIndex >= 0 ? comparison.deltas[activeIndex] : undefined
    const leftView = leftViewRef.current
    const rightView = rightViewRef.current

    if (!delta) {
      if (leftView) clearHighlight(leftView)
      if (rightView) clearHighlight(rightView)
      previousActive.current = -1
      return
    }

    const location = locateDelta(delta, leftParsed.root, rightParsed.root)
    const shouldScroll = previousActive.current !== -1 && previousActive.current !== activeIndex

    if (leftView) {
      if (location.left) revealRange(leftView, location.left.from, location.left.to, shouldScroll)
      else clearHighlight(leftView)
    }
    if (rightView) {
      if (location.right) revealRange(rightView, location.right.from, location.right.to, shouldScroll)
      else clearHighlight(rightView)
    }

    previousActive.current = activeIndex
  }, [activeIndex, signature, leftParsed.root, rightParsed.root, comparison.deltas])

  const applySide = (side: Side, text: string, name: string) => {
    if (side === 'left') {
      setLeftText(text)
      setLeftName(name)
    } else {
      setRightText(text)
      setRightName(name)
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!isJsonFile(file)) {
      toast({ tone: 'error', title: 'Unsupported file type', description: 'Choose a .json document.' })
      return
    }
    const side = pendingSide.current
    const result = await readTextFile(file)
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not open file', description: result.error })
      return
    }
    applySide(side, result.text, result.name)
    toast({
      tone: 'success',
      title: `${side === 'left' ? 'Original' : 'Modified'} updated`,
      description: `${result.name} \u00b7 ${formatBytes(utf8Size(result.text))}.`,
    })
  }

  const jumpToIssue = (side: Side, issue: JsonIssue) => {
    const view = side === 'left' ? leftViewRef.current : rightViewRef.current
    if (!view) return
    const position = Math.min(issue.offset, view.state.doc.length)
    view.dispatch({
      selection: { anchor: position },
      effects: EditorView.scrollIntoView(position, { y: 'center' }),
    })
    view.focus()
  }

  const swapSides = () => {
    const currentLeft = leftViewRef.current?.state.doc.toString() ?? leftText
    const currentRight = rightViewRef.current?.state.doc.toString() ?? rightText
    setLeftText(currentRight)
    setRightText(currentLeft)
    setLeftName(rightName)
    setRightName(leftName)
    toast({ tone: 'info', title: 'Sides swapped', description: 'The comparison direction was reversed.' })
  }

  const loadExample = () => {
    setLeftText(SAMPLE_COMPARE_LEFT)
    setRightText(SAMPLE_COMPARE_RIGHT)
    setLeftName('original.json')
    setRightName('modified.json')
    toast({ tone: 'info', title: 'Example loaded', description: 'A versioned service config with a few structural changes.' })
  }

  const clearAll = () => {
    setLeftText('')
    setRightText('')
    setLeftName('original.json')
    setRightName('modified.json')
    setConfirmClear(false)
    toast({ tone: 'info', title: 'Both panels cleared' })
  }

  const goToPrevious = () => {
    if (counts.total === 0) return
    setActiveIndex((current) => (current <= 0 ? counts.total - 1 : current - 1))
  }

  const goToNext = () => {
    if (counts.total === 0) return
    setActiveIndex((current) => (current + 1) % counts.total)
  }

  useEffect(() => {
    if (!active) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F7') return
      event.preventDefault()
      if (counts.total === 0) return
      setActiveIndex((current) => {
        if (event.shiftKey) return current <= 0 ? counts.total - 1 : current - 1
        return current < 0 ? 0 : (current + 1) % counts.total
      })
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, counts.total])

  const openPicker = (side: Side) => {
    pendingSide.current = side
    fileInputRef.current?.click()
  }

  const anyEmpty = leftParsed.empty || rightParsed.empty
  const anyInvalid = (!leftParsed.valid && !leftParsed.empty) || (!rightParsed.valid && !rightParsed.empty)
  const statusDot = anyEmpty ? 'is-empty' : anyInvalid ? 'is-error' : counts.total > 0 ? 'is-error' : 'is-ok'
  const statusText = anyEmpty
    ? 'Waiting for two documents'
    : anyInvalid
      ? 'Fix the highlighted syntax error'
      : counts.total > 0
        ? `${formatCount(counts.total)} structural ${counts.total === 1 ? 'difference' : 'differences'}`
        : 'No structural differences'

  return (
    <div className="page compare-page">
      <div className="page-head compare-head">
        <div className="page-heading">
          <h1>Compare JSON</h1>
          <p>Compare parsed structures, not text. Indentation, whitespace and key order are ignored.</p>
        </div>
        <div className="page-actions">
          <Button icon={<ArrowRightLeft size={14} />} onClick={swapSides} tooltip="Swap the two documents">
            Swap sides
          </Button>
          <Button icon={<RotateCcw size={14} />} onClick={loadExample}>
            Example
          </Button>
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmClear(true)}>
            Clear
          </Button>
        </div>
      </div>

      <div className="compare-grid">
        <ComparePane
          side="left"
          title="Original"
          fileName={leftName}
          text={leftText}
          parse={leftParsed}
          onTextChange={setLeftText}
          onReady={(view) => {
            leftViewRef.current = view
          }}
          onOpen={() => openPicker('left')}
          onClear={() => applySide('left', '', 'original.json')}
          onJumpToIssue={(issue) => jumpToIssue('left', issue)}
        />
        <ComparePane
          side="right"
          title="Modified"
          fileName={rightName}
          text={rightText}
          parse={rightParsed}
          onTextChange={setRightText}
          onReady={(view) => {
            rightViewRef.current = view
          }}
          onOpen={() => openPicker('right')}
          onClear={() => applySide('right', '', 'modified.json')}
          onJumpToIssue={(issue) => jumpToIssue('right', issue)}
        />
      </div>

      <section className="panel diff-panel">
        <div className="panel-head diff-head">
          <span className="panel-title">Changes</span>
          {comparison.status === 'ready' ? (
            <div className="diff-counts" aria-label="Difference counts">
              <Chip tone="added">+{counts.added}</Chip>
              <Chip tone="removed">{'\u2212'}{counts.removed}</Chip>
              <Chip tone="changed">~{counts.changed}</Chip>
            </div>
          ) : null}
          <span className="head-spacer" />
          <span className="panel-meta">
            {counts.total > 0 ? `${Math.max(activeIndex, 0) + 1} / ${counts.total}` : '\u2014'}
          </span>
          <div className="diff-nav">
            <IconButton
              label="Previous change"
              shortcut={PREVIOUS_SHORTCUT}
              icon={<ChevronUp size={14} />}
              onClick={goToPrevious}
              disabled={counts.total === 0}
              placement="left"
              className="icon-btn-small"
            />
            <IconButton
              label="Next change"
              shortcut={NEXT_SHORTCUT}
              icon={<ChevronDown size={14} />}
              onClick={goToNext}
              disabled={counts.total === 0}
              placement="left"
              className="icon-btn-small"
            />
          </div>
        </div>

        <div className="diff-body">
          {comparison.status === 'empty' ? (
            <EmptyState
              icon={<GitCompare size={18} />}
              title="Two documents to compare"
              text="Paste JSON into both panels. Formatting differences never count \u2014 only structure and values."
              actions={
                <Button variant="accent" size="sm" onClick={loadExample}>
                  Load example
                </Button>
              }
            />
          ) : comparison.status === 'invalid' ? (
            <EmptyState
              icon={<AlertTriangle size={18} />}
              title="Comparison paused"
              text="Fix the syntax error highlighted in the editor above. Comparison resumes automatically."
            />
          ) : counts.total === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={18} />}
              title="No structural differences"
              text="The documents contain the same data, even if their formatting differs."
            />
          ) : (
            comparison.deltas.map((delta, index) => (
              <button
                key={delta.id}
                type="button"
                className="diff-row"
                data-active={activeIndex === index}
                aria-current={activeIndex === index ? 'true' : undefined}
                aria-label={`${delta.kind} at ${formatPath(delta.path)}`}
                onClick={() => setActiveIndex(index)}
              >
                <span className={cn('diff-sign', `is-${delta.kind}`)}>{diffSign(delta.kind)}</span>
                <span className="diff-path" title={formatPath(delta.path)}>
                  {formatPath(delta.path)}
                </span>
                <span className="diff-values">
                  {delta.kind === 'changed' ? (
                    <>
                      {diffValue(delta.oldValue)}
                      <ArrowRight size={10} className="diff-arrow" aria-hidden="true" />
                      {diffValue(delta.newValue)}
                    </>
                  ) : delta.kind === 'added' ? (
                    <span className="diff-new">{previewValue(delta.newValue)}</span>
                  ) : (
                    <span className="diff-old">{previewValue(delta.oldValue)}</span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      <StatusBar
        left={
          <>
            <span className={cn('status-dot', statusDot)} />
            <StatusItem>{statusText}</StatusItem>
            <StatusSeparator className="hidden sm:block" />
            <StatusItem className="hidden sm:inline-flex">Formatting ignored</StatusItem>
          </>
        }
        right={
          <>
            <StatusItem className="hidden sm:inline-flex">2 documents</StatusItem>
            <StatusSeparator className="hidden sm:block" />
            <StatusItem>
              {counts.total > 0 ? `Change ${Math.max(activeIndex, 0) + 1} of ${counts.total}` : 'No changes'}
            </StatusItem>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear both documents?"
        description="Both comparison panels will be emptied. This cannot be undone from the toolbar."
        confirmLabel="Clear both"
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearAll}
      />
    </div>
  )
}
