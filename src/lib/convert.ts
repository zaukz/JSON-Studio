import { parse as parseYaml, stringify as stringifyYaml, type YAMLParseError } from 'yaml'
import { formatPath, parseJson, type JsonPath, type JsonValue } from './json'

export type ConversionMode = 'json-to-yaml' | 'yaml-to-json' | 'json-to-csv'
export type ConversionLanguage = 'json' | 'yaml' | 'text'

export type ConversionMeta = {
  id: ConversionMode
  label: string
  inputLabel: string
  outputLabel: string
  inputLanguage: ConversionLanguage
  outputLanguage: ConversionLanguage
  extension: string
  mime: string
  inputExtLabel: string
}

export const CONVERSION_MODES: ConversionMeta[] = [
  {
    id: 'json-to-yaml',
    label: 'JSON to YAML',
    inputLabel: 'JSON',
    outputLabel: 'YAML',
    inputLanguage: 'json',
    outputLanguage: 'yaml',
    extension: 'yaml',
    mime: 'text/yaml;charset=utf-8',
    inputExtLabel: '.json',
  },
  {
    id: 'yaml-to-json',
    label: 'YAML to JSON',
    inputLabel: 'YAML',
    outputLabel: 'JSON',
    inputLanguage: 'yaml',
    outputLanguage: 'json',
    extension: 'json',
    mime: 'application/json;charset=utf-8',
    inputExtLabel: '.yaml, .yml',
  },
  {
    id: 'json-to-csv',
    label: 'JSON to CSV',
    inputLabel: 'JSON',
    outputLabel: 'CSV',
    inputLanguage: 'json',
    outputLanguage: 'text',
    extension: 'csv',
    mime: 'text/csv;charset=utf-8',
    inputExtLabel: '.json',
  },
]

export function getConversionMeta(mode: ConversionMode): ConversionMeta {
  return CONVERSION_MODES.find((meta) => meta.id === mode) ?? CONVERSION_MODES[0]
}

export type ConversionSuccess = { ok: true; output: string; notes: string[] }
export type ConversionFailure = {
  ok: false
  message: string
  hint?: string
  line?: number
  column?: number
}
export type ConversionResult = ConversionSuccess | ConversionFailure

export type InputValidation = {
  empty: boolean
  valid: boolean
  message?: string
  line?: number
  column?: number
}

const YAML_OPTIONS = {
  prettyErrors: true,
  strict: true,
  uniqueKeys: true,
  maxAliasCount: 100,
}

function fail(message: string, hint?: string, line?: number, column?: number): ConversionFailure {
  return { ok: false, message, hint, line, column }
}

function readYamlError(error: unknown): { message: string; line?: number; column?: number } {
  const yamlError = error as YAMLParseError | undefined
  const rawMessage =
    typeof yamlError?.message === 'string' ? yamlError.message : 'This YAML could not be parsed.'
  const firstLine = rawMessage
    .split('\n')[0]
    .replace(/\s+at line \d+, column \d+:?\s*$/i, '')
    .trim()
  const position = yamlError?.linePos?.[0]
  return {
    message: firstLine || 'This YAML could not be parsed.',
    line: position?.line,
    column: position?.col,
  }
}

function isPlainObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeUnsupported(value: unknown, path: JsonPath, seen: WeakSet<object>): string | null {
  if (value === null) return null
  const type = typeof value
  if (type === 'string' || type === 'boolean') return null
  if (type === 'number') {
    return Number.isFinite(value as number)
      ? null
      : `The number at ${formatPath(path)} is not finite, so JSON cannot represent it.`
  }
  if (type === 'bigint') return `The integer at ${formatPath(path)} is too large for JSON.`
  if (type === 'undefined' || type === 'function' || type === 'symbol') {
    return `The value at ${formatPath(path)} cannot be represented in JSON.`
  }

  const object = value as object
  if (seen.has(object)) {
    return `The value at ${formatPath(path)} refers back to itself, which JSON cannot represent.`
  }
  seen.add(object)

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const problem = describeUnsupported(value[index], [...path, index], seen)
      if (problem) return problem
    }
    seen.delete(object)
    return null
  }

  if (
    value instanceof Date ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  ) {
    return `The value at ${formatPath(path)} is not a plain JSON value, so it cannot be represented faithfully.`
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const problem = describeUnsupported(child, [...path, key], seen)
    if (problem) return problem
  }
  seen.delete(object)
  return null
}

export function validateConversionInput(mode: ConversionMode, input: string): InputValidation {
  if (input.trim().length === 0) return { empty: true, valid: false }

  if (getConversionMeta(mode).inputLanguage === 'yaml') {
    try {
      const value = parseYaml(input, YAML_OPTIONS)
      if (value === undefined) return { empty: true, valid: false }
      return { empty: false, valid: true }
    } catch (error) {
      const info = readYamlError(error)
      return { empty: false, valid: false, message: info.message, line: info.line, column: info.column }
    }
  }

  const parsed = parseJson(input)
  if (parsed.empty) return { empty: true, valid: false }
  if (parsed.valid) return { empty: false, valid: true }
  const issue = parsed.issues[0]
  return {
    empty: false,
    valid: false,
    message: issue?.message ?? 'The JSON is not valid.',
    line: issue?.line,
    column: issue?.column,
  }
}

function jsonToYaml(input: string): ConversionResult {
  const parsed = parseJson(input)
  if (parsed.empty) {
    return fail('There is nothing to convert yet.', 'Paste or load a JSON document in the input panel.')
  }
  if (!parsed.valid) {
    const issue = parsed.issues[0]
    return fail(
      issue?.message ?? 'The JSON is not valid.',
      'Fix the syntax error in the input panel, then conversion resumes automatically.',
      issue?.line,
      issue?.column,
    )
  }

  try {
    const output = stringifyYaml(parsed.value as JsonValue, {
      indent: 2,
      lineWidth: 0,
      aliasDuplicateObjects: false,
      sortMapEntries: false,
    }).trimEnd()
    return { ok: true, output, notes: [] }
  } catch {
    return fail('This document could not be written as YAML.', 'Check for values that YAML cannot express.')
  }
}

function yamlToJson(input: string, indent: 2 | 4): ConversionResult {
  if (input.trim().length === 0) {
    return fail('There is nothing to convert yet.', 'Paste or load a YAML document in the input panel.')
  }

  try {
    const value = parseYaml(input, YAML_OPTIONS) as unknown
    if (value === undefined) return fail('This YAML document is empty.')

    const unsupported = describeUnsupported(value, [], new WeakSet())
    if (unsupported) return fail(unsupported, 'JSON supports only strings, numbers, booleans, null, arrays and objects.')

    const output = JSON.stringify(value, null, indent)
    if (output === undefined) return fail('This YAML value cannot be represented as JSON.')

    const notes: string[] = []
    if (/^\s*#/m.test(input)) notes.push('YAML comments have no JSON equivalent and were dropped.')
    if (/(^|[\s:,[-])[&*][A-Za-z0-9_-]+/.test(input)) {
      notes.push('Anchors and aliases were resolved into their concrete values.')
    }
    return { ok: true, output, notes }
  } catch (error) {
    const info = readYamlError(error)
    return fail(info.message, 'Fix the YAML syntax in the input panel.', info.line, info.column)
  }
}

function escapeCsvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function jsonToCsv(input: string): ConversionResult {
  const parsed = parseJson(input)
  if (parsed.empty) {
    return fail('There is nothing to convert yet.', 'Paste or load a JSON document in the input panel.')
  }
  if (!parsed.valid) {
    const issue = parsed.issues[0]
    return fail(
      issue?.message ?? 'The JSON is not valid.',
      'Fix the syntax error in the input panel, then conversion resumes automatically.',
      issue?.line,
      issue?.column,
    )
  }

  const value = parsed.value as JsonValue
  if (!Array.isArray(value)) {
    return fail(
      'CSV export needs a top-level array of objects.',
      'CSV is a flat table format, so wrap the records in [ \u2026 ] before converting. A single object cannot be turned into rows without knowing what each row represents.',
    )
  }

  if (value.length === 0) {
    return { ok: true, output: '', notes: ['The array is empty, so there are no rows to export.'] }
  }

  const invalidIndex = value.findIndex((item) => !isPlainObject(item))
  if (invalidIndex !== -1) {
    const item = value[invalidIndex]
    const itemType = Array.isArray(item) ? 'an array' : item === null ? 'null' : typeof item
    return fail(
      `Item ${invalidIndex} is ${itemType}, not an object.`,
      'Every item in the top-level array must be an object so it can become a CSV row.',
    )
  }

  const rows = value as Array<Record<string, JsonValue>>
  const columns: string[] = []
  const seenColumns = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seenColumns.has(key)) {
        seenColumns.add(key)
        columns.push(key)
      }
    }
  }

  if (columns.length === 0) {
    return { ok: true, output: '', notes: ['The objects have no properties, so there are no columns.'] }
  }

  let nestedCount = 0
  let nullCount = 0
  let missingCount = 0

  const lines = [columns.map(escapeCsvCell).join(',')]
  for (const row of rows) {
    const cells = columns.map((column) => {
      if (!Object.prototype.hasOwnProperty.call(row, column)) {
        missingCount += 1
        return ''
      }
      const cellValue = row[column]
      if (cellValue === null) {
        nullCount += 1
        return ''
      }
      if (typeof cellValue === 'object') {
        nestedCount += 1
        return escapeCsvCell(JSON.stringify(cellValue))
      }
      if (typeof cellValue === 'number') {
        return Number.isFinite(cellValue) ? String(cellValue) : ''
      }
      if (typeof cellValue === 'boolean') return cellValue ? 'true' : 'false'
      return escapeCsvCell(cellValue)
    })
    lines.push(cells.join(','))
  }

  const rowLabel = rows.length === 1 ? 'row' : 'rows'
  const columnLabel = columns.length === 1 ? 'column' : 'columns'
  const notes = [`${rows.length} ${rowLabel} \u00d7 ${columns.length} ${columnLabel}.`]

  if (nestedCount > 0) {
    notes.push('Nested objects and arrays are written as compact JSON inside their cells \u2014 CSV has no hierarchy.')
  }
  if (nullCount > 0) {
    notes.push('null values are written as empty cells.')
  }
  if (missingCount > 0) {
    notes.push('Columns are the union of every key; missing values are left empty.')
  }

  return { ok: true, output: lines.join('\r\n'), notes }
}

export function convert(mode: ConversionMode, input: string, indent: 2 | 4): ConversionResult {
  switch (mode) {
    case 'json-to-yaml':
      return jsonToYaml(input)
    case 'yaml-to-json':
      return yamlToJson(input, indent)
    case 'json-to-csv':
      return jsonToCsv(input)
  }
}
