import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  AlertTriangle,
  ArrowRightLeft,
  Copy,
  Download,
  Eraser,
  FolderOpen,
  Info,
  RotateCcw,
} from 'lucide-react'
import { CodeEditor } from '../components/CodeEditor'
import { StatusBar, StatusItem, StatusSeparator } from '../components/StatusBar'
import { useToast } from '../components/Toasts'
import { Button, Chip, EmptyState, IconButton } from '../components/ui'
import type { Indent } from '../lib/prefs'
import {
  CONVERSION_MODES,
  convert,
  getConversionMeta,
  validateConversionInput,
  type ConversionMode,
} from '../lib/convert'
import { SAMPLE_CONVERT_INPUTS } from '../lib/samples'
import {
  copyText,
  downloadText,
  formatBytes,
  isJsonFile,
  readTextFile,
  utf8Size,
} from '../lib/utils'

export function ConvertPage({ indent }: { indent: Indent }) {
  const toast = useToast()
  const [mode, setMode] = useState<ConversionMode>('json-to-yaml')
  const [drafts, setDrafts] = useState<Record<ConversionMode, string>>(() => ({
    ...SAMPLE_CONVERT_INPUTS,
  }))
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const meta = getConversionMeta(mode)
  const input = drafts[mode]
  const result = useMemo(() => convert(mode, input, indent), [mode, input, indent])
  const validation = useMemo(() => validateConversionInput(mode, input), [mode, input])

  const updateInput = (value: string) => {
    setDrafts((current) => ({ ...current, [mode]: value }))
  }

  const canSwap = mode !== 'json-to-csv' && result.ok && result.output.trim().length > 0

  const handleSwap = () => {
    if (!canSwap || !result.ok) return
    const target: ConversionMode = mode === 'json-to-yaml' ? 'yaml-to-json' : 'json-to-yaml'
    setDrafts((current) => ({ ...current, [target]: result.output }))
    setMode(target)
    toast({
      tone: 'info',
      title: 'Output moved to input',
      description: 'The conversion direction was reversed.',
    })
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const element = event.currentTarget
    const file = element.files?.[0]
    element.value = ''
    if (!file) return
    if (meta.inputLanguage === 'json' && !isJsonFile(file)) {
      toast({ tone: 'error', title: 'Unsupported file type', description: 'Choose a .json document.' })
      return
    }
    const result = await readTextFile(file)
    if (!result.ok) {
      toast({ tone: 'error', title: 'Could not open file', description: result.error })
      return
    }
    updateInput(result.text)
    const fileValidation = validateConversionInput(mode, result.text)
    toast(
      fileValidation.valid
        ? {
            tone: 'success',
            title: `Loaded ${result.name}`,
            description: `${formatBytes(utf8Size(result.text))} \u00b7 converting now.`,
          }
        : {
            tone: 'info',
            title: `Loaded ${result.name}`,
            description: 'The file was loaded, but it has a syntax error.',
          },
    )
  }

  const handleCopyOutput = async () => {
    if (!result.ok) return
    if (result.output.length === 0) {
      toast({ tone: 'info', title: 'Nothing to copy', description: 'The conversion produced no output.' })
      return
    }
    const copied = await copyText(result.output)
    toast(
      copied
        ? { tone: 'success', title: `${meta.outputLabel} copied`, description: formatBytes(utf8Size(result.output)) }
        : {
            tone: 'error',
            title: 'Clipboard unavailable',
            description: 'Your browser blocked clipboard access for this page.',
          },
    )
  }

  const handleDownloadOutput = () => {
    if (!result.ok) return
    const filename = `json-studio.${meta.extension}`
    downloadText(result.output.endsWith('\n') ? result.output : `${result.output}\n`, filename, meta.mime)
    toast({ tone: 'success', title: 'Download started', description: filename })
  }

  const loadSample = () => {
    updateInput(SAMPLE_CONVERT_INPUTS[mode])
    toast({ tone: 'info', title: 'Example loaded', description: `A sample ${meta.inputLabel} document.` })
  }

  const clearInput = () => {
    if (input.trim().length === 0) {
      toast({ tone: 'info', title: 'Input is already empty' })
      return
    }
    updateInput('')
    toast({ tone: 'info', title: 'Input cleared' })
  }

  return (
    <div className="page convert-page">
      <div className="page-head">
        <div className="page-heading">
          <h1>Convert</h1>
          <p>Translate between JSON and YAML, or flatten records into CSV. Conversion happens as you type.</p>
        </div>
        <div className="page-actions">
          <div className="mode-tabs" role="group" aria-label="Conversion direction">
            {CONVERSION_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="mode-tab"
                aria-pressed={mode === item.id}
                onClick={() => setMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button
            icon={<ArrowRightLeft size={14} />}
            onClick={handleSwap}
            disabled={!canSwap}
            tooltip="Use the output as the new input"
          >
            Swap
          </Button>
        </div>
      </div>

      <div className="convert-grid">
        <section className="panel convert-panel">
          <div className="panel-head">
            <span className="panel-title">
              Input<span className="head-dim">{meta.inputLabel}</span>
            </span>
            {validation.empty ? (
              <Chip tone="neutral">Empty</Chip>
            ) : validation.valid ? (
              <Chip tone="ok">Valid</Chip>
            ) : (
              <Chip tone="error">Syntax error</Chip>
            )}
            <span className="head-spacer" />
            <span className="panel-meta hidden sm:inline">{formatBytes(utf8Size(input))}</span>
            <IconButton
              label="Open input file"
              icon={<FolderOpen size={13} />}
              onClick={() => fileInputRef.current?.click()}
              placement="left"
              className="icon-btn-small"
            />
            <IconButton
              label="Load example"
              icon={<RotateCcw size={13} />}
              onClick={loadSample}
              placement="left"
              className="icon-btn-small"
            />
            <IconButton
              label="Clear input"
              icon={<Eraser size={13} />}
              onClick={clearInput}
              placement="left"
              className="icon-btn-small"
            />
          </div>

          <div className="editor-fill">
            <CodeEditor
              key={mode}
              initialDoc={input}
              syncValue={input}
              language={meta.inputLanguage}
              lint={meta.inputLanguage === 'json'}
              ariaLabel={`${meta.inputLabel} input`}
              placeholderText={`Paste ${meta.inputLabel} here`}
              onTextChange={updateInput}
            />
          </div>

          <div className="panel-foot">
            <span>{meta.inputLabel} input</span>
            <span>{validation.line ? `Error at line ${validation.line}, column ${validation.column}` : 'Converts automatically'}</span>
          </div>
        </section>

        <section className="panel convert-panel">
          <div className="panel-head">
            <span className="panel-title">
              Output<span className="head-dim">{meta.outputLabel}</span>
            </span>
            {result.ok ? <Chip tone="accent">Ready</Chip> : null}
            <span className="head-spacer" />
            {result.ok ? (
              <span className="panel-meta hidden sm:inline">{formatBytes(utf8Size(result.output))}</span>
            ) : null}
            <IconButton
              label="Copy output"
              icon={<Copy size={13} />}
              onClick={handleCopyOutput}
              disabled={!result.ok || result.output.length === 0}
              placement="left"
              className="icon-btn-small"
            />
            <IconButton
              label="Download output"
              icon={<Download size={13} />}
              onClick={handleDownloadOutput}
              disabled={!result.ok || result.output.length === 0}
              placement="left"
              className="icon-btn-small"
            />
          </div>

          <div className="editor-fill">
            {validation.empty ? (
              <EmptyState
                icon={<ArrowRightLeft size={18} />}
                title="Output appears here"
                text={`Paste or open ${meta.inputLabel} to see the ${meta.outputLabel} result. Nothing is uploaded.`}
              />
            ) : !result.ok ? (
              <div className="convert-error">
                <div className="convert-error-icon" aria-hidden="true">
                  <AlertTriangle size={16} />
                </div>
                <div className="convert-error-title">Conversion paused</div>
                <p className="convert-error-text">{result.message}</p>
                {result.hint ? <p className="convert-error-text">{result.hint}</p> : null}
                {result.line ? (
                  <span className="convert-error-loc">
                    Line {result.line}
                    {result.column ? `, column ${result.column}` : ''}
                  </span>
                ) : null}
              </div>
            ) : result.output.length === 0 ? (
              <EmptyState
                icon={<Info size={18} />}
                title="Nothing to write"
                text={result.notes[0] ?? 'The conversion produced an empty result.'}
              />
            ) : (
              <CodeEditor
                key={`output-${mode}`}
                initialDoc={result.output}
                syncValue={result.output}
                language={meta.outputLanguage}
                readOnly
                ariaLabel={`${meta.outputLabel} output`}
              />
            )}
          </div>

          {result.ok && result.notes.length > 0 ? (
            <div className="convert-notes">
              {result.notes.map((note) => (
                <div className="convert-note" key={note}>
                  <Info size={11} aria-hidden="true" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <StatusBar
        left={
          <>
            <StatusItem>{meta.label}</StatusItem>
            <StatusSeparator />
            <StatusItem>
              {validation.empty
                ? 'Awaiting input'
                : validation.valid
                  ? 'Input valid'
                  : 'Input has a syntax error'}
            </StatusItem>
            <StatusSeparator className="hidden sm:block" />
            <StatusItem className="hidden sm:inline-flex">{formatBytes(utf8Size(input))} input</StatusItem>
          </>
        }
        right={
          <>
            <StatusItem className="hidden sm:inline-flex">
              {result.ok ? `${formatBytes(utf8Size(result.output))} output` : 'No output'}
            </StatusItem>
            <StatusSeparator className="hidden sm:block" />
            <StatusItem className="hidden md:inline-flex">Local conversion</StatusItem>
          </>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={meta.inputLanguage === 'yaml' ? '.yaml,.yml,text/yaml' : '.json,application/json'}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
