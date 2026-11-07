import { useEffect, useRef } from 'react'
import { redoDepth, undoDepth } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { createEditorExtensions, type EditorLanguage } from '../lib/codemirror'

export type CursorInfo = {
  line: number
  column: number
  selectionLength: number
  canUndo: boolean
  canRedo: boolean
}

export type CodeEditorProps = {
  initialDoc: string
  language?: EditorLanguage
  readOnly?: boolean
  lint?: boolean
  placeholderText?: string
  ariaLabel?: string
  /** When provided, external changes replace the document without remounting. */
  syncValue?: string
  onTextChange?: (text: string) => void
  onCursorChange?: (info: CursorInfo) => void
  onReady?: (view: EditorView) => void
  className?: string
  changeDelay?: number
}

export function CodeEditor({
  initialDoc,
  language = 'json',
  readOnly = false,
  lint = false,
  placeholderText,
  ariaLabel,
  syncValue,
  onTextChange,
  onCursorChange,
  onReady,
  className,
  changeDelay = 160,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const timerRef = useRef<number | null>(null)
  const callbacksRef = useRef({ onTextChange, onCursorChange, onReady, changeDelay })
  callbacksRef.current = { onTextChange, onCursorChange, onReady, changeDelay }
  const initialRef = useRef({ initialDoc, language, readOnly, lint, placeholderText, ariaLabel })

  useEffect(() => {
    const initial = initialRef.current
    const host = hostRef.current
    if (!host) return

    const emitCursor = (view: EditorView) => {
      const state = view.state
      const head = state.selection.main.head
      const line = state.doc.lineAt(head)
      const selectionLength = state.selection.ranges.reduce(
        (total, range) => total + (range.to - range.from),
        0,
      )
      callbacksRef.current.onCursorChange?.({
        line: line.number,
        column: head - line.from + 1,
        selectionLength,
        canUndo: undoDepth(state) > 0,
        canRedo: redoDepth(state) > 0,
      })
    }

    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initial.initialDoc,
        extensions: [
          ...createEditorExtensions({
            language: initial.language,
            readOnly: initial.readOnly,
            lint: initial.lint,
            placeholderText: initial.placeholderText,
            ariaLabel: initial.ariaLabel,
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              if (timerRef.current !== null) window.clearTimeout(timerRef.current)
              timerRef.current = window.setTimeout(() => {
                timerRef.current = null
                const currentView = viewRef.current
                if (currentView) {
                  callbacksRef.current.onTextChange?.(currentView.state.doc.toString())
                }
              }, callbacksRef.current.changeDelay)
            }
            if (update.docChanged || update.selectionSet) emitCursor(update.view)
          }),
        ],
      }),
    })

    viewRef.current = view
    emitCursor(view)
    callbacksRef.current.onReady?.(view)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    if (syncValue === undefined) return
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() === syncValue) return

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: syncValue },
      selection: { anchor: Math.min(view.state.selection.main.anchor, syncValue.length) },
    })
  }, [syncValue])

  return <div ref={hostRef} className={className ?? 'editor-host'} />
}
