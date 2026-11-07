import diff from 'microdiff'
import type { Node } from 'jsonc-parser'
import { findNodeAtPath, type JsonPath, type JsonValue } from './json'

export type DiffKind = 'added' | 'removed' | 'changed'

export type JsonDelta = {
  id: string
  kind: DiffKind
  path: JsonPath
  oldValue?: JsonValue
  newValue?: JsonValue
}

type RawDifference = {
  type: 'CREATE' | 'REMOVE' | 'CHANGE'
  path: Array<string | number>
  value?: unknown
  oldValue?: unknown
}

function comparePaths(a: JsonPath, b: JsonPath): number {
  const shared = Math.min(a.length, b.length)
  for (let index = 0; index < shared; index += 1) {
    const left = a[index]
    const right = b[index]
    if (typeof left === 'number' && typeof right === 'number') {
      if (left !== right) return left - right
    } else {
      const leftText = String(left)
      const rightText = String(right)
      if (leftText !== rightText) return leftText < rightText ? -1 : 1
    }
  }
  return a.length - b.length
}

/**
 * Structural comparison: parsing first means indentation, whitespace and
 * formatting differences are ignored entirely.
 */
export function diffJson(left: JsonValue, right: JsonValue): JsonDelta[] {
  const leftIsObject = left !== null && typeof left === 'object'
  const rightIsObject = right !== null && typeof right === 'object'

  // microdiff expects container values; handle primitive roots explicitly.
  if (!leftIsObject || !rightIsObject) {
    if (Object.is(left, right)) return []
    return [
      {
        id: 'changed:[]',
        kind: 'changed',
        path: [],
        oldValue: left,
        newValue: right,
      },
    ]
  }

  const raw = diff(
    left as unknown as Record<string, unknown>,
    right as unknown as Record<string, unknown>,
  ) as RawDifference[]

  const deltas = raw.map((entry): JsonDelta => {
    const kind: DiffKind =
      entry.type === 'CREATE' ? 'added' : entry.type === 'REMOVE' ? 'removed' : 'changed'
    const path = entry.path.map((segment) => (typeof segment === 'number' ? segment : String(segment)))
    return {
      id: `${kind}:${JSON.stringify(path)}`,
      kind,
      path,
      oldValue:
        entry.type === 'REMOVE' || entry.type === 'CHANGE' ? (entry.oldValue as JsonValue) : undefined,
      newValue:
        entry.type === 'CREATE' || entry.type === 'CHANGE' ? (entry.value as JsonValue) : undefined,
    }
  })

  deltas.sort((a, b) => comparePaths(a.path, b.path))
  return deltas
}

export type DiffCounts = { added: number; removed: number; changed: number; total: number }

export function countDeltas(deltas: JsonDelta[]): DiffCounts {
  const counts: DiffCounts = { added: 0, removed: 0, changed: 0, total: deltas.length }
  for (const delta of deltas) counts[delta.kind] += 1
  return counts
}

export type DeltaLocation = {
  left?: { from: number; to: number }
  right?: { from: number; to: number }
}

export function locateDelta(
  delta: JsonDelta,
  leftRoot: Node | undefined,
  rightRoot: Node | undefined,
): DeltaLocation {
  const location: DeltaLocation = {}

  if (delta.kind !== 'added') {
    const node = findNodeAtPath(leftRoot, delta.path)
    if (node) location.left = { from: node.offset, to: node.offset + node.length }
  }

  if (delta.kind !== 'removed') {
    const node = findNodeAtPath(rightRoot, delta.path)
    if (node) location.right = { from: node.offset, to: node.offset + node.length }
  }

  return location
}
