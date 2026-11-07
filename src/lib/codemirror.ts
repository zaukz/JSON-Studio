import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { lintGutter, linter, type Diagnostic } from '@codemirror/lint'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { EditorState, StateEffect, StateField, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
  type DecorationSet,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { parseJson } from './json'

export type EditorLanguage = 'json' | 'yaml' | 'text'

function languageExtension(language: EditorLanguage): Extension {
  if (language === 'json') return json()
  if (language === 'yaml') return yaml()
  return []
}

const highlightStyle = HighlightStyle.define([
  { tag: [tags.propertyName, tags.definition(tags.propertyName)], color: 'var(--syn-key)' },
  { tag: [tags.string, tags.special(tags.string), tags.attributeValue], color: 'var(--syn-string)' },
  { tag: tags.number, color: 'var(--syn-number)' },
  { tag: [tags.bool, tags.atom, tags.unit], color: 'var(--syn-bool)' },
  { tag: [tags.null, tags.keyword, tags.modifier], color: 'var(--syn-null)' },
  { tag: [tags.punctuation, tags.bracket, tags.separator, tags.operator], color: 'var(--syn-punct)' },
  { tag: tags.invalid, color: 'var(--syn-invalid)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--color-fg-subtle)', fontStyle: 'italic' },
])

const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--cm-bg)',
    color: 'var(--cm-fg)',
    fontSize: '13px',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '21px',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '10px 0 32px',
    caretColor: 'var(--cm-cursor)',
  },
  '.cm-line': { padding: '0 18px 0 10px' },
  '.cm-gutters': {
    backgroundColor: 'var(--cm-bg)',
    border: 'none',
    borderRight: '1px solid var(--color-line)',
    color: 'var(--cm-gutter)',
  },
  '.cm-gutterElement': {
    padding: '0 8px 0 4px',
    fontSize: '11px',
    lineHeight: '21px',
  },
  '.cm-lineNumbers .cm-gutterElement': { minWidth: '34px', textAlign: 'right' },
  '.cm-activeLine': { backgroundColor: 'var(--cm-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--cm-gutter-active)' },
  '.cm-foldGutter .cm-gutterElement': { color: 'var(--cm-gutter)' },
  '.cm-foldGutter .cm-gutterElement:hover': { color: 'var(--color-fg-muted)' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--color-surface-3)',
    border: '1px solid var(--color-line-strong)',
    borderRadius: '3px',
    color: 'var(--color-fg-muted)',
    margin: '0 2px',
    padding: '0 4px',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--cm-cursor)',
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--cm-selection) !important',
  },
  '.cm-selectionMatch': { backgroundColor: 'var(--cm-selection-match)' },
  '.cm-searchMatch': { backgroundColor: 'var(--cm-match)', borderRadius: '2px' },
  '.cm-searchMatch-selected': { backgroundColor: 'var(--cm-match-active)' },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--color-accent-soft)',
    borderRadius: '2px',
    outline: '1px solid var(--color-accent-line)',
  },
  '.cm-nonmatchingBracket': {
    backgroundColor: 'var(--color-danger-soft)',
    outline: '1px solid var(--color-danger)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--cm-panel)',
    borderColor: 'var(--color-line)',
    color: 'var(--color-fg)',
    fontFamily: 'var(--font-sans)',
  },
  '.cm-panels-top': { borderBottom: '1px solid var(--color-line)' },
  '.cm-panels-bottom': { borderTop: '1px solid var(--color-line)' },
  '.cm-textfield': {
    border: '1px solid var(--color-line-strong)',
    borderRadius: '5px',
    backgroundColor: 'var(--color-surface-3)',
    color: 'var(--color-fg)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
  },
  '.cm-button': {
    border: '1px solid var(--color-line-strong)',
    borderRadius: '5px',
    backgroundColor: 'var(--color-surface-3)',
    color: 'var(--color-fg-muted)',
    fontFamily: 'var(--font-sans)',
    fontSize: '11px',
  },
  '.cm-tooltip': {
    border: '1px solid var(--color-line-strong)',
    borderRadius: '6px',
    backgroundColor: 'var(--color-surface-2)',
    color: 'var(--color-fg)',
    boxShadow: 'var(--shadow-popover)',
    fontFamily: 'var(--font-sans)',
    fontSize: '11.5px',
  },
  '.cm-diagnostic-error': { borderLeft: '2px solid var(--color-danger)' },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--color-danger)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--color-surface-3)',
    color: 'var(--color-fg)',
  },
})

const jsonLintSource = (view: EditorView): Diagnostic[] => {
  const text = view.state.doc.toString()
  if (text.length > 2_500_000) return []

  const parsed = parseJson(text)
  if (parsed.empty || parsed.valid) return []

  const docLength = view.state.doc.length
  return parsed.issues.slice(0, 40).map((issue) => {
    const from = Math.min(Math.max(issue.offset, 0), docLength)
    const to = Math.min(Math.max(from, issue.offset + Math.max(issue.length, 1)), docLength)
    return {
      from,
      to,
      severity: 'error' as const,
      message: `${issue.message} (line ${issue.line}, column ${issue.column})`,
    }
  })
}

const jsonLinter = linter(jsonLintSource, { delay: 320 })

const setHighlightEffect = StateEffect.define<{ from: number; to: number } | null>()

const highlightMark = Decoration.mark({ class: 'cm-highlight' })

const highlightField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes)
    for (const effect of transaction.effects) {
      if (effect.is(setHighlightEffect)) {
        const value = effect.value
        next =
          value && value.to > value.from
            ? Decoration.set([highlightMark.range(value.from, value.to)])
            : Decoration.none
      }
    }
    return next
  },
  provide: (field) => EditorView.decorations.from(field),
})

export function clearHighlight(view: EditorView): void {
  view.dispatch({ effects: setHighlightEffect.of(null) })
}

/** Marks a range and optionally scrolls it into view, used by Compare. */
export function revealRange(view: EditorView, from: number, to: number, shouldScroll = true): void {
  const max = view.state.doc.length
  const start = Math.min(Math.max(from, 0), max)
  const end = Math.min(Math.max(to, start), max)
  const markEffect = setHighlightEffect.of(end > start ? { from: start, to: end } : null)
  if (shouldScroll) {
    view.dispatch({
      effects: [markEffect, EditorView.scrollIntoView(start, { y: 'center' })],
    })
  } else {
    view.dispatch({ effects: markEffect })
  }
}

export function createEditorExtensions(options: {
  language: EditorLanguage
  readOnly: boolean
  lint: boolean
  placeholderText?: string
  ariaLabel?: string
}): Extension[] {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    rectangularSelection(),
    crosshairCursor(),
    search({ top: true }),
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
      indentWithTab,
    ]),
    languageExtension(options.language),
    syntaxHighlighting(highlightStyle),
    baseTheme,
    highlightField,
    EditorView.contentAttributes.of({
      spellcheck: 'false',
      autocapitalize: 'off',
      autocomplete: 'off',
      'aria-label': options.ariaLabel ?? 'JSON editor',
    }),
  ]

  if (options.readOnly) {
    extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false))
  }
  if (options.lint) {
    extensions.push(jsonLinter, lintGutter())
  }
  if (options.placeholderText) {
    extensions.push(placeholder(options.placeholderText))
  }

  return extensions
}
