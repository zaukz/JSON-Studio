import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { EditorView } from '@codemirror/view'
import { redo, undo } from '@codemirror/commands'
import {
  Braces,
  Copy,
  Download,
  FileJson,
  FolderOpen,
  Minimize2,
  PanelRight,
  Redo2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  X,
  IndentIncrease,
} from 'lucide-react'
import { CodeEditor, type CursorInfo } from '../components/CodeEditor'
import { ConfirmDialog } from '../components/Dialogs'
import { InfoPanel } from '../components/InfoPanel'
import { StatusBar, StatusItem, StatusSeparator } from '../components/StatusBar'
import { TreeView } from '../components/TreeView'
import { useToast } from '../components/Toasts'
import { Button, Dropdown, IconButton, Segmented } from '../components/ui'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  computeStats,
  issueSummary,
  minifyJson,
  parseJson,
  prettyPrint,
  type JsonIssue,
} from '../lib/json'
import type { Prefs } from '../lib/prefs'
import type { IncomingDocument } from '../lib/routes'
import { SAMPLE_DOCUMENT } from '../lib/samples'
import {
  clamp,
  cn,
  copyText,
  downloadText,
  ensureJsonFilename,
  formatBytes,
  formatCount,
  isJsonFile,
  readTextFile,
  shortcutLabel,
  utf8Size,
} from '../lib/utils'

type ViewPreset = 'editor' | 'split' | 'tree'

const FORMAT_SHORTCUT = shortcutLabel(['Mod', 'Shift', 'F'])
const MINIFY_SHORTCUT = shortcutLabel(['Mod', 'Shift', 'M'])
const DOWNLOAD_SHORTCUT = shortcutLabel(['Mod', 'S'])
const OPEN_SHORTCUT = shortcutLabel(['Mod', 'O'])
const UNDO_SHORTCUT = shortcutLabel(['Mod', 'Z'])
const REDO_SHORTCUT = shortcutLabel(['Mod', 'Shift', 'Z'])

const EMPTY_CURSOR: CursorInfo = {
  line: 1,
  column: 1,
  selectionLength: 0,
  canUndo: false,
  canRedo: false,
}

type StudioActions = {
  format: () => void
  minify: () => void
  download: () => void
  open: () => void
  undo: () => void
  redo: () => void
  toggleView: () => void
  togglePanel: () => void
}

export function StudioPage({
  active,
  prefs,
  onPrefsChange,
  incoming,
}: {
  active: boolean
  prefs: Prefs
  onPrefsChange: (patch: Partial<Prefs>) => void
  incoming: IncomingDocument | null
}) {
  const toast = useToast()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [fileName, setFileName] = useState('example.json')
  const [docText, setDocText] = useState(SAMPLE_DOCUMENT)
  const [cursor, setCursor] = useState<CursorInfo>(EMPTY_CURSOR)
  const [confirmClear, setConfirmClear] = useState(false)
  const [resizing, setResizing] = useState(false)
  const viewRef = useRef<EditorView | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const parsed = useMemo(() => parseJson(docText), [docText])
  const stats = useMemo(
    () => computeStats(docText, parsed.valid ? parsed.value : undefined),
    [docText, parsed],
  )

  const getText = () => viewRef.current?.state.doc.toString() ?? docText

  const applyText = useCallback((text: string, name?: string, focus = true) => {
    if (name !== undefined) setFileName(name)
    setDocText(text)
    const view = viewRef.current
    if (!view) return
    const anchor = Math.min(view.state.selection.main.anchor, text.length)
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor },
      scrollIntoView: true,
    })
    if (focus) view.focus()
  }, [])

  useEffect(() => {
    if (!incoming) return
    applyText(incoming.text, incoming.name, false)
  }, [incoming, applyText])

  useEffect(() => {
    if (!active) return
    viewRef.current?.requestMeasure()
  }, [active])

  const jumpToIssue = (issue: JsonIssue | null) => {
    if (!issue) return
    const view = viewRef.current
    if (!view) return
    const position = Math.min(issue.offset, view.state.doc.length)
    view.dispatch({
      selection: { anchor: position },
      effects: EditorView.scrollIntoView(position, { y: 'center' }),
    })
    view.focus()
  }

  const handleFormat = () => {
    const text = getText()
    const result = prettyPrint(text, prefs.indent)
    if (!result.ok) {
      if (result.empty) {
        toast({ tone: 'info', title: 'Nothing to format', description: 'The editor is empty.' })
      } else {
        toast({
          tone: 'error',
          title: 'Cannot format invalid JSON',
          description: result.issue ? issueSummary(result.issue) : 'Fix the syntax errors first.',
        })
      }
      return
    }
    if (result.text === text) {
      toast({ tone: 'info', title: 'Already formatted', description: `Indentation is already ${prefs.indent} spaces.` })
      return
    }
    applyText(result.text)
    toast({ tone: 'success', title: 'Document formatted', description: `${prefs.indent}-space indentation applied.` })
  }

  const handleMinify = () => {
    const text = getText()
    const result = minifyJson(text)
    if (!result.ok) {
      if (result.empty) {
        toast({ tone: 'info', title: 'Nothing to minify', description: 'The editor is empty.' })
      } else {
        toast({
          tone: 'error',
          title: 'Cannot minify invalid JSON',
          description: result.issue ? issueSummary(result.issue) : 'Fix the syntax errors first.',
        })
      }
      return
    }
    if (result.text === text) {
      toast({ tone: 'info', title: 'Already minified', description: 'There is no unnecessary whitespace to remove.' })
      return
    }
    applyText(result.text)
    toast({
      tone: 'success',
      title: 'Document minified',
      description: `${formatBytes(utf8Size(result.text))} \u00b7 whitespace removed.`,
    })
  }

  const handleValidate = () => {
    const text = getText()
    const current = parseJson(text)
    if (current.empty) {
      toast({ tone: 'info', title: 'Nothing to validate', description: 'The editor is empty.' })
      return
    }
    if (current.valid) {
      const currentStats = computeStats(text, current.value)
      toast({
        tone: 'success',
        title: 'Valid JSON',
        description: `${formatCount(currentStats.properties)} properties \u00b7 ${formatCount(currentStats.values)} values \u00b7 max depth ${currentStats.maxDepth}.`,
      })
      return
    }
    const issue = current.issues[0]
    toast({
      tone: 'error',
      title: 'Invalid JSON',
      description: issue ? issueSummary(issue) : 'The document could not be parsed.',
    })
    jumpToIssue(issue)
  }

  const handleCopy = async () => {
    const text = getText()
    if (text.trim().length === 0) {
      toast({ tone: 'info', title: 'Nothing to copy', description: 'The editor is empty.' })
      return
    }
    const copied = await copyText(text)
    toast(
      copied
        ? {
            tone: 'success',
            title: 'JSON copied',
            description: `${formatBytes(utf8Size(text))} \u00b7 ${formatCount(text.length)} characters.`,
          }
        : {
            tone: 'error',
            title: 'Clipboard unavailable',
            description: 'Your browser blocked clipboard access for this page.',
          },
    )
  }

  const handleDownload = () => {
    const text = getText()
    if (text.trim().length === 0) {
      toast({ tone: 'info', title: 'Nothing to download', description: 'The editor is empty.' })
      return
    }
    const filename = ensureJsonFilename(fileName)
    downloadText(text.endsWith('\n') ? text : `${text}\n`, filename, 'application/json;charset=utf-8')
    toast({ tone: 'success', title: 'Download started', description: filename })
  }

  const handleOpenFile = () => fileInputRef.current?.click()

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!isJsonFile(file)) {
      toast({
        tone: 'error',
        title: 'Unsupported file type',
        description: 'Open a .json document. Drag and drop accepts .json files too.',
      })
      return
    }
    const result = await readTextFile(file)
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not open file', description: result.error })
      return
    }
    applyText(result.text, result.name)
    const fileParsed = parseJson(result.text)
    if (fileParsed.valid) {
      const fileStats = computeStats(result.text, fileParsed.value)
      toast({
        tone: 'success',
        title: `Opened ${result.name}`,
        description: `${formatBytes(utf8Size(result.text))} \u00b7 ${formatCount(fileStats.properties)} properties.`,
      })
    } else {
      toast({
        tone: 'info',
        title: `Opened ${result.name}`,
        description: 'Loaded, but the document contains a syntax error.',
      })
    }
  }

  const requestClear = () => {
    if (getText().trim().length === 0) {
      toast({ tone: 'info', title: 'Editor is already empty' })
      return
    }
    setConfirmClear(true)
  }

  const clearDocument = () => {
    setConfirmClear(false)
    applyText('', 'untitled.json', false)
    toast({
      tone: 'info',
      title: 'Editor cleared',
      description: `Undo with ${UNDO_SHORTCUT} if you change your mind.`,
    })
  }

  const loadSample = () => {
    applyText(SAMPLE_DOCUMENT, 'example.json', false)
    toast({
      tone: 'info',
      title: 'Example document loaded',
      description: 'A realistic configuration you can edit or replace.',
    })
  }

  const handleUndo = () => {
    const view = viewRef.current
    if (!view) return
    undo(view)
    view.focus()
  }

  const handleRedo = () => {
    const view = viewRef.current
    if (!view) return
    redo(view)
    view.focus()
  }

  const preset: ViewPreset = prefs.view === 'tree' ? 'tree' : prefs.panelOpen ? 'split' : 'editor'

  const setPreset = (value: ViewPreset) => {
    if (value === 'editor') onPrefsChange({ view: 'editor', panelOpen: false })
    else if (value === 'split') onPrefsChange({ view: 'editor', panelOpen: true })
    else onPrefsChange({ view: 'tree', panelOpen: false, panelTab: 'info' })
  }

  const togglePanel = () => {
    if (prefs.panelOpen) {
      onPrefsChange({ panelOpen: false })
    } else {
      onPrefsChange({
        panelOpen: true,
        panelTab: prefs.view === 'tree' ? 'info' : prefs.panelTab,
      })
    }
  }

  const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDesktop) return
    event.preventDefault()
    const startX = event.clientX
    const startWidth = prefs.panelWidth
    setResizing(true)

    const handleMove = (moveEvent: PointerEvent) => {
      const width = clamp(
        startWidth - (moveEvent.clientX - startX),
        280,
        Math.min(680, window.innerWidth * 0.55),
      )
      onPrefsChange({ panelWidth: width })
    }

    const finish = () => {
      setResizing(false)
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  const actionsRef = useRef<StudioActions | null>(null)
  actionsRef.current = {
    format: handleFormat,
    minify: handleMinify,
    download: handleDownload,
    open: handleOpenFile,
    undo: handleUndo,
    redo: handleRedo,
    toggleView: () => setPreset(prefs.view === 'tree' ? 'editor' : 'tree'),
    togglePanel,
  }

  useEffect(() => {
    if (!active) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      const actions = actionsRef.current
      if (!actions) return

      if (event.shiftKey && key === 'f') {
        event.preventDefault()
        actions.format()
      } else if (event.shiftKey && key === 'm') {
        event.preventDefault()
        actions.minify()
      } else if (!event.shiftKey && key === 's') {
        event.preventDefault()
        actions.download()
      } else if (!event.shiftKey && key === 'o') {
        event.preventDefault()
        actions.open()
      } else if (event.shiftKey && key === 'e') {
        event.preventDefault()
        actions.toggleView()
      } else if (!event.shiftKey && key === 'b') {
        event.preventDefault()
        actions.togglePanel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active])

  const activePanelTab = prefs.view === 'tree' ? 'info' : prefs.panelTab
  const dotClass = parsed.empty ? 'is-empty' : parsed.valid ? 'is-ok' : 'is-error'

  return (
    <div className="page">
      <div className="toolbar" role="toolbar" aria-label="Document actions">
        <div className="toolbar-group">
          <Button
            variant="accent"
            icon={<Sparkles size={14} />}
            tooltip="Format document"
            shortcut={FORMAT_SHORTCUT}
            onClick={handleFormat}
            className="toolbar-btn"
          >
            Format
          </Button>
          <Button
            icon={<Minimize2 size={14} />}
            tooltip="Minify document"
            shortcut={MINIFY_SHORTCUT}
            onClick={handleMinify}
            className="toolbar-btn"
          >
            Minify
          </Button>
          <Button
            icon={<ShieldCheck size={14} />}
            tooltip="Validate JSON"
            onClick={handleValidate}
            className="toolbar-btn"
          >
            Validate
          </Button>
        </div>

        <span className="toolbar-sep" aria-hidden="true" />

        <div className="toolbar-group">
          <Button icon={<Copy size={14} />} tooltip="Copy the full document" onClick={handleCopy} className="toolbar-btn">
            Copy
          </Button>
          <Button
            icon={<Download size={14} />}
            tooltip="Download as .json"
            shortcut={DOWNLOAD_SHORTCUT}
            onClick={handleDownload}
            className="toolbar-btn"
          >
            Download
          </Button>
          <Button
            icon={<FolderOpen size={14} />}
            tooltip="Open a local .json file"
            shortcut={OPEN_SHORTCUT}
            onClick={handleOpenFile}
            className="toolbar-btn"
          >
            Open
          </Button>
        </div>

        <span className="toolbar-sep" aria-hidden="true" />

        <div className="toolbar-group">
          <IconButton
            label="Undo"
            shortcut={UNDO_SHORTCUT}
            icon={<Undo2 size={14} />}
            onClick={handleUndo}
            disabled={!cursor.canUndo}
          />
          <IconButton
            label="Redo"
            shortcut={REDO_SHORTCUT}
            icon={<Redo2 size={14} />}
            onClick={handleRedo}
            disabled={!cursor.canRedo}
          />
          <IconButton label="Clear editor" icon={<Trash2 size={14} />} onClick={requestClear} />
        </div>

        <span className="toolbar-spacer" />

        <div className="toolbar-group">
          <Dropdown
            value={prefs.indent === 4 ? '4' : '2'}
            ariaLabel="Indentation for formatting"
            icon={<IndentIncrease size={14} />}
            label={`${prefs.indent} spaces`}
            options={[
              { value: '2', label: '2 spaces', description: 'Compact' },
              { value: '4', label: '4 spaces', description: 'Roomier' },
            ]}
            onChange={(value) => onPrefsChange({ indent: value === '4' ? 4 : 2 })}
          />
        </div>

        <Segmented<ViewPreset>
          label="Workspace layout"
          value={preset}
          onChange={setPreset}
          options={[
            { value: 'editor', label: 'Code' },
            { value: 'split', label: 'Split' },
            { value: 'tree', label: 'Tree' },
          ]}
        />

        <IconButton
          label={prefs.panelOpen ? 'Hide side panel' : 'Show side panel'}
          shortcut={shortcutLabel(['Mod', 'B'])}
          icon={<PanelRight size={14} />}
          onClick={togglePanel}
          aria-pressed={prefs.panelOpen}
          className={cn(prefs.panelOpen && 'is-active')}
        />
      </div>

      <div className="studio-body">
        <section className={cn('panel editor-panel', prefs.view === 'tree' && 'hidden')}>
          <CodeEditor
            initialDoc={docText}
            language="json"
            lint
            ariaLabel="JSON document editor"
            syncValue={docText}
            onTextChange={setDocText}
            onCursorChange={setCursor}
            onReady={(view) => {
              viewRef.current = view
            }}
          />
          {docText.length === 0 ? (
            <div className="editor-empty">
              <div className="editor-empty-card">
                <div className="empty-icon" aria-hidden="true">
                  <Braces size={18} />
                </div>
                <div className="editor-empty-title">Nothing loaded</div>
                <p className="editor-empty-text">
                  Paste JSON, drop a .json file anywhere in the app, or start from a realistic example document.
                </p>
                <div className="empty-actions">
                  <Button variant="accent" size="sm" icon={<FileJson size={13} />} onClick={loadSample}>
                    Load example
                  </Button>
                  <Button size="sm" icon={<FolderOpen size={13} />} onClick={handleOpenFile}>
                    Open file
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {prefs.view === 'tree' ? (
          <section className="panel tree-main">
            <div className="panel-head">
              <span className="panel-title">Tree</span>
              <span className="panel-meta">
                {formatCount(stats.objects + stats.arrays)} containers \u00b7 {formatCount(stats.values)} values
              </span>
              <span className="head-spacer" />
            </div>
            <TreeView
              parse={parsed}
              onLoadExample={loadSample}
              onJumpToError={jumpToIssue}
              variant="full"
            />
          </section>
        ) : null}

        {prefs.panelOpen ? (
          <>
            <div
              className="resizer"
              data-dragging={resizing}
              onPointerDown={handleResizeStart}
              aria-hidden="true"
            />
            <aside
              className="panel side-panel"
              style={isDesktop ? { width: prefs.panelWidth } : undefined}
            >
              <div className="panel-head side-head">
                <div className="seg side-tabs" role="group" aria-label="Side panel content">
                  {prefs.view !== 'tree' ? (
                    <button
                      type="button"
                      className="seg-item"
                      aria-pressed={activePanelTab === 'tree'}
                      onClick={() => onPrefsChange({ panelTab: 'tree' })}
                    >
                      Tree
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="seg-item"
                    aria-pressed={activePanelTab === 'info'}
                    onClick={() => onPrefsChange({ panelTab: 'info' })}
                  >
                    Info
                  </button>
                </div>
                <span className="head-spacer" />
                <IconButton
                  label="Close side panel"
                  icon={<X size={13} />}
                  onClick={() => onPrefsChange({ panelOpen: false })}
                  placement="left"
                  className="icon-btn-small"
                />
              </div>
              <div className="side-body">
                {activePanelTab === 'tree' ? (
                  <TreeView
                    parse={parsed}
                    onLoadExample={loadSample}
                    onJumpToError={jumpToIssue}
                  />
                ) : (
                  <InfoPanel parse={parsed} stats={stats} onLoadExample={loadSample} />
                )}
              </div>
            </aside>
          </>
        ) : null}
      </div>

      <StatusBar
        left={
          <>
            <StatusItem
              onClick={parsed.issue ? () => jumpToIssue(parsed.issue) : undefined}
              title={parsed.issue ? 'Jump to the first syntax error' : undefined}
            >
              <span className={cn('status-dot', dotClass)} />
              {parsed.empty ? 'No document' : parsed.valid ? 'Valid JSON' : 'Invalid JSON'}
            </StatusItem>
            {!parsed.valid && !parsed.empty && parsed.issue ? (
              <>
                <StatusSeparator />
                <StatusItem
                  onClick={() => jumpToIssue(parsed.issue)}
                  className="status-error hidden max-w-[42ch] truncate md:inline-flex"
                  title={`${issueSummary(parsed.issue)} \u2014 click to jump`}
                >
                  Ln {parsed.issue.line}, Col {parsed.issue.column}: {parsed.issue.message}
                </StatusItem>
              </>
            ) : null}
            <StatusSeparator className="hidden sm:block" />
            <StatusItem className="hidden sm:inline-flex" title={fileName}>
              <FileJson size={11} />
              <span className="truncate-min" style={{ maxWidth: 160 }}>
                {fileName}
              </span>
            </StatusItem>
            <StatusSeparator className="hidden sm:block" />
            <StatusItem title={`${formatCount(stats.characters)} characters`}>{formatBytes(stats.bytes)}</StatusItem>
            <StatusSeparator className="hidden md:block" />
            <StatusItem className="hidden md:inline-flex">
              {formatCount(stats.properties)} properties
            </StatusItem>
          </>
        }
        right={
          <>
            <StatusItem className="hidden sm:inline-flex">{formatCount(stats.values)} values</StatusItem>
            <StatusSeparator className="hidden sm:block" />
            <StatusItem className="hidden md:inline-flex">Spaces: {prefs.indent}</StatusItem>
            <StatusSeparator className="hidden md:block" />
            <StatusItem className="hidden sm:inline-flex">UTF-8</StatusItem>
            <StatusSeparator />
            <StatusItem>
              {cursor.selectionLength > 0
                ? `Ln ${cursor.line}, Col ${cursor.column} \u00b7 ${cursor.selectionLength} selected`
                : `Ln ${cursor.line}, Col ${cursor.column}`}
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
        title="Clear the document?"
        description={`This removes the current JSON from the editor. You can undo it with ${UNDO_SHORTCUT}.`}
        confirmLabel="Clear editor"
        onCancel={() => setConfirmClear(false)}
        onConfirm={clearDocument}
      />
    </div>
  )
}
