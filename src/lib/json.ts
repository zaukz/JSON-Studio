import {
  applyEdits,
  format as formatJsonc,
  getNodeValue,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
} from 'jsonc-parser'
import { utf8Size } from './utils'

export type JsonPrimitive = string | number | boolean | null
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject
export type JsonPath = Array<string | number>
export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export type JsonIssue = {
  message: string
  offset: number
  length: number
  line: number
  column: number
}

export type JsonParseResult = {
  valid: boolean
  empty: boolean
  value?: JsonValue
  root?: Node
  issues: JsonIssue[]
  issue: JsonIssue | null
}

export type JsonStats = {
  bytes: number
  characters: number
  lines: number
  rootType: JsonType | null
  objects: number
  arrays: number
  properties: number
  items: number
  scalars: number
  values: number
  maxDepth: number
  typeCounts: Record<JsonType, number>
}

export type JsonTextResult =
  | { ok: true; text: string }
  | { ok: false; empty: boolean; issue: JsonIssue | null }

const PARSE_OPTIONS = { disallowComments: true, allowTrailingComma: false } as const

const ERROR_TEXT: Record<string, string> = {
  InvalidSymbol: 'Unexpected character. JSON only allows objects, arrays, strings, numbers, true, false and null.',
  InvalidNumberFormat: 'This number is not in a valid JSON format.',
  PropertyNameExpected: 'Expected a property name in double quotes.',
  ValueExpected: 'Expected a JSON value.',
  ColonExpected: "Expected ':' after a property name.",
  CommaExpected: "Expected ',' or a closing bracket.",
  CloseBraceExpected: "Expected '}' to close this object.",
  CloseBracketExpected: "Expected ']' to close this array.",
  EndOfFileExpected: 'Unexpected content after the end of the document.',
  InvalidCommentToken: 'Comments are not allowed in JSON.',
  UnexpectedEndOfComment: 'This comment is never closed.',
  UnexpectedEndOfString: 'Unterminated string \u2014 a closing quote is missing.',
  UnexpectedEndOfNumber: 'This number ends unexpectedly.',
  InvalidUnicode: 'Invalid unicode escape sequence (expected four hex digits).',
  InvalidEscapeCharacter: 'Invalid escape sequence in a string.',
  InvalidCharacter: 'Unexpected character in the document.',
}

let parseCache: { text: string; result: JsonParseResult } | null = null

export function typeOfValue(value: JsonValue): JsonType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  const type = typeof value
  if (type === 'object') return 'object'
  if (type === 'boolean') return 'boolean'
  if (type === 'number') return 'number'
  return 'string'
}

function positionAt(text: string, offset: number): { line: number; column: number } {
  const limit = Math.min(Math.max(offset, 0), text.length)
  let line = 1
  let lineStart = 0
  for (let index = 0; index < limit; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1
      lineStart = index + 1
    }
  }
  return { line, column: limit - lineStart + 1 }
}

function parseJsonUncached(text: string): JsonParseResult {
  if (text.trim().length === 0) {
    return { valid: false, empty: true, issues: [], issue: null }
  }

  const errors: ParseError[] = []
  const root = parseTree(text, errors, PARSE_OPTIONS)
  const issues: JsonIssue[] = []
  const seenOffsets = new Set<number>()

  for (const error of errors) {
    if (seenOffsets.has(error.offset)) continue
    seenOffsets.add(error.offset)
    const code = printParseErrorCode(error.error)
    const position = positionAt(text, error.offset)
    issues.push({
      message: ERROR_TEXT[code] ?? `This JSON is not valid (${code}).`,
      offset: error.offset,
      length: error.length,
      line: position.line,
      column: position.column,
    })
  }

  if (issues.length > 0 || !root) {
    return { valid: false, empty: false, issues, issue: issues[0] ?? null }
  }

  return {
    valid: true,
    empty: false,
    value: getNodeValue(root) as JsonValue,
    root,
    issues,
    issue: null,
  }
}

/**
 * Parses strict JSON and reports friendly, positioned errors. A single-entry
 * cache keeps repeated parses (editor linter, stats, tree) from redoing work.
 */
export function parseJson(text: string): JsonParseResult {
  if (parseCache && parseCache.text === text) return parseCache.result
  const result = parseJsonUncached(text)
  parseCache = { text, result }
  return result
}

function createTypeCounts(): Record<JsonType, number> {
  return { object: 0, array: 0, string: 0, number: 0, boolean: 0, null: 0 }
}

function visitValue(value: JsonValue, depth: number, stats: JsonStats): void {
  const type = typeOfValue(value)
  stats.typeCounts[type] += 1
  stats.values += 1
  stats.maxDepth = Math.max(stats.maxDepth, depth)

  if (type === 'object') {
    stats.objects += 1
    for (const child of Object.values(value as JsonObject)) {
      stats.properties += 1
      visitValue(child, depth + 1, stats)
    }
    return
  }

  if (type === 'array') {
    stats.arrays += 1
    for (const child of value as JsonValue[]) {
      stats.items += 1
      visitValue(child, depth + 1, stats)
    }
    return
  }

  stats.scalars += 1
}

export function computeStats(text: string, value: JsonValue | undefined): JsonStats {
  const stats: JsonStats = {
    bytes: utf8Size(text),
    characters: text.length,
    lines: text.length === 0 ? 0 : text.split('\n').length,
    rootType: value === undefined ? null : typeOfValue(value),
    objects: 0,
    arrays: 0,
    properties: 0,
    items: 0,
    scalars: 0,
    values: 0,
    maxDepth: 0,
    typeCounts: createTypeCounts(),
  }

  if (value !== undefined) visitValue(value, 1, stats)
  return stats
}

function minifyText(text: string): string {
  let output = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (inString) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      output += char
      continue
    }
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t') continue
    output += char
  }

  return output
}

/**
 * Pretty-prints through jsonc-parser's formatter so duplicate keys and
 * large number literals survive the operation unchanged.
 */
export function prettyPrint(text: string, indent: 2 | 4): JsonTextResult {
  const parsed = parseJson(text)
  if (parsed.empty) return { ok: false, empty: true, issue: null }
  if (!parsed.valid) return { ok: false, empty: false, issue: parsed.issues[0] ?? null }

  try {
    const edits = formatJsonc(text, undefined, { insertSpaces: true, tabSize: indent, eol: '\n' })
    return { ok: true, text: applyEdits(text, edits) }
  } catch {
    return { ok: true, text: JSON.stringify(parsed.value as JsonValue, null, indent) }
  }
}

/** Removes insignificant whitespace without touching the original tokens. */
export function minifyJson(text: string): JsonTextResult {
  const parsed = parseJson(text)
  if (parsed.empty) return { ok: false, empty: true, issue: null }
  if (!parsed.valid) return { ok: false, empty: false, issue: parsed.issues[0] ?? null }
  return { ok: true, text: minifyText(text) }
}

const SAFE_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function formatPath(path: JsonPath): string {
  if (path.length === 0) return '$'
  let output = '$'
  for (const segment of path) {
    if (typeof segment === 'number') {
      output += `[${segment}]`
    } else if (SAFE_KEY.test(segment)) {
      output += `.${segment}`
    } else {
      output += `[${JSON.stringify(segment)}]`
    }
  }
  return output
}

/** Finds the AST node for a path, returning the value node of a property. */
export function findNodeAtPath(root: Node | undefined, path: JsonPath): Node | undefined {
  let node = root

  for (const segment of path) {
    if (!node || !node.children) return undefined

    if (node.type === 'array') {
      const index = typeof segment === 'number' ? segment : Number(segment)
      if (!Number.isInteger(index) || index < 0) return undefined
      node = node.children[index]
    } else if (node.type === 'object') {
      const key = String(segment)
      const property = node.children.find(
        (child) => child.type === 'property' && child.children?.[0]?.value === key,
      )
      node = property?.children?.[1]
    } else {
      return undefined
    }

    if (!node) return undefined
  }

  return node
}

export function previewValue(value: JsonValue | undefined): string {
  if (value === undefined) return 'undefined'
  let text: string
  try {
    text = JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (text === undefined) text = String(value)
  return text.length > 120 ? `${text.slice(0, 117)}\u2026` : text
}

export function issueSummary(issue: JsonIssue): string {
  return `Line ${issue.line}, column ${issue.column}: ${issue.message}`
}
