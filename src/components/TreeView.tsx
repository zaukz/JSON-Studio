import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Braces,
  ChevronRight,
  Copy,
  FoldVertical,
  Link2,
  Search,
  UnfoldVertical,
  X,
} from 'lucide-react'
import { formatPath, type JsonIssue, type JsonObject, type JsonParseResult, type JsonPath, type JsonValue } from '../lib/json'
import { cn, copyText } from '../lib/utils'
import { useToast } from './Toasts'
import { Button, EmptyState, IconButton } from './ui'

type TreeViewProps = {
  parse: JsonParseResult
  onLoadExample: () => void
  onJumpToError: (issue: JsonIssue) => void
  variant?: 'panel' | 'full'
}

type SearchState = {
  active: boolean
  matches: Set<string>
  keep: Set<string>
  count: number
  truncated: boolean
}

const EMPTY_SEARCH: SearchState = {
  active: false,
  matches: new Set(),
  keep: new Set(),
  count: 0,
  truncated: false,
}

function analyzeSearch(value: JsonValue, rawQuery: string): SearchState {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return EMPTY_SEARCH

  const matches = new Set<string>()
  const keep = new Set<string>()
  const maxMatches = 500
  const maxNodes = 200_000
  let count = 0
  let visited = 0
  let truncated = false

  const walk = (node: JsonValue, path: JsonPath, label: string | null): boolean => {
    visited += 1
    if (visited > maxNodes) {
      truncated = true
      return false
    }

    const key = JSON.stringify(path)
    const labelMatch = label !== null && label.toLowerCase().includes(query)
    let valueMatch = false
    if (node === null || typeof node !== 'object') {
      const display = typeof node === 'string' ? node : node === null ? 'null' : String(node)
      valueMatch = display.toLowerCase().includes(query)
    }

    const isMatch = labelMatch || valueMatch
    if (isMatch) {
      if (count < maxMatches) {
        matches.add(key)
        count += 1
      } else {
        truncated = true
      }
    }

    let childMatched = false
    if (Array.isArray(node)) {
      for (let index = 0; index < node.length; index += 1) {
        if (walk(node[index], [...path, index], String(index))) childMatched = true
      }
    } else if (node !== null && typeof node === 'object') {
      for (const [childKey, child] of Object.entries(node as JsonObject)) {
        if (walk(child, [...path, childKey], childKey)) childMatched = true
      }
    }

    if (isMatch || childMatched) keep.add(key)
    return isMatch || childMatched
  }

  walk(value, [], null)
  return { active: true, matches, keep, count, truncated }
}

function collectContainerPaths(value: JsonValue): JsonPath[] {
  const paths: JsonPath[] = []

  const walk = (node: JsonValue, path: JsonPath) => {
    if (node === null || typeof node !== 'object') return
    paths.push(path)
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, [...path, index]))
    } else {
      for (const [key, child] of Object.entries(node as JsonObject)) {
        walk(child, [...path, key])
      }
    }
  }

  walk(value, [])
  return paths
}

function highlightText(text: string, query: string): ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  const parts: ReactNode[] = []
  let cursor = 0
  let match = lower.indexOf(needle, cursor)
  let key = 0

  while (match !== -1) {
    if (match > cursor) parts.push(text.slice(cursor, match))
    parts.push(
      <mark className="tree-mark" key={key}>
        {text.slice(match, match + needle.length)}
      </mark>,
    )
    key += 1
    cursor = match + needle.length
    match = lower.indexOf(needle, cursor)
  }

  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function TreeView({ parse, onLoadExample, onJumpToError, variant = 'panel' }: TreeViewProps) {
  const toast = useToast()
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['[]']))
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const value = parse.valid ? parse.value : undefined
  const search = useMemo(
    () => (value === undefined ? EMPTY_SEARCH : analyzeSearch(value, deferredQuery)),
    [value, deferredQuery],
  )
  const containerPaths = useMemo(() => (value === undefined ? [] : collectContainerPaths(value)), [value])

  const togglePath = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleExpandAll = () => {
    if (value === undefined) return
    if (containerPaths.length > 2500) {
      setExpanded(new Set(containerPaths.filter((path) => path.length <= 2).map((path) => JSON.stringify(path))))
      toast({
        tone: 'info',
        title: 'Expanded the first few levels',
        description: 'This document is large, so deeper branches stay collapsed to keep the tree responsive.',
      })
      return
    }
    setExpanded(new Set(containerPaths.map((path) => JSON.stringify(path))))
  }

  const handleCollapseAll = () => {
    setExpanded(new Set(['[]']))
  }

  const handleCopyValue = async (node: JsonValue, path: JsonPath) => {
    const text = typeof node === 'string' ? node : JSON.stringify(node, null, 2)
    const copied = await copyText(text ?? 'null')
    toast(
      copied
        ? { tone: 'success', title: 'Value copied', description: formatPath(path) }
        : {
            tone: 'error',
            title: 'Clipboard unavailable',
            description: 'Your browser blocked clipboard access for this page.',
          },
    )
  }

  const handleCopyPath = async (path: JsonPath) => {
    const copied = await copyText(formatPath(path))
    toast(
      copied
        ? { tone: 'success', title: 'Path copied', description: formatPath(path) }
        : {
            tone: 'error',
            title: 'Clipboard unavailable',
            description: 'Your browser blocked clipboard access for this page.',
          },
    )
  }

  const renderPrimitive = (node: JsonValue) => {
    if (node === null) return <span className="tree-null">null</span>
    if (typeof node === 'string') {
      return (
        <span className="tree-string tree-value" title={node}>
          <span className="tree-quote">"</span>
          {search.active ? highlightText(node, deferredQuery.trim()) : node}
          <span className="tree-quote">"</span>
        </span>
      )
    }
    if (typeof node === 'boolean') {
      return <span className="tree-boolean">{String(node)}</span>
    }
    if (typeof node === 'number') {
      return <span className="tree-number">{String(node)}</span>
    }
    return <span>{String(node)}</span>
  }

  const renderNode = (
    segment: string | number | null,
    node: JsonValue,
    path: JsonPath,
    depth: number,
  ): ReactNode => {
    const pathKey = JSON.stringify(path)
    const isRoot = depth === 0
    const isArray = Array.isArray(node)
    const isContainer = node !== null && typeof node === 'object'
    const entries: Array<[string | number, JsonValue]> = isArray
      ? node.map((child, index) => [index, child] as [number, JsonValue])
      : isContainer
        ? Object.entries(node as JsonObject)
        : []
    const count = entries.length
    const isOpen =
      isContainer && count > 0 && (expanded.has(pathKey) || (search.active && search.keep.has(pathKey)))
    const visibleEntries = search.active
      ? entries.filter(([childKey]) => search.keep.has(JSON.stringify([...path, childKey])))
      : entries

    return (
      <div key={pathKey}>
        <div
          className="tree-row"
          role="treeitem"
          aria-level={depth + 1}
          aria-expanded={isContainer && count > 0 ? isOpen : undefined}
          onClick={isContainer && count > 0 ? () => togglePath(pathKey) : undefined}
        >
          {isContainer && count > 0 ? (
            <button
              type="button"
              className={cn('tree-caret', isOpen && 'is-open')}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
              onClick={(event) => {
                event.stopPropagation()
                togglePath(pathKey)
              }}
            >
              <ChevronRight size={11} />
            </button>
          ) : (
            <span className="tree-spacer" />
          )}

          {isRoot ? (
            <span className="tree-root-key">$</span>
          ) : typeof segment === 'number' ? (
            <span className="tree-index">{segment}</span>
          ) : (
            <span className="tree-key">
              <span className="tree-quote">"</span>
              {search.active ? highlightText(String(segment), deferredQuery.trim()) : String(segment)}
              <span className="tree-quote">"</span>
            </span>
          )}
          <span className="tree-punct">:</span>

          {isContainer ? (
            <>
              <span className="tree-punct">{isArray ? '[' : '{'}</span>
              <span className="tree-count">
                {count} {isArray ? (count === 1 ? 'item' : 'items') : count === 1 ? 'key' : 'keys'}
              </span>
              {!isOpen ? <span className="tree-punct">{isArray ? ']' : '}'}</span> : null}
            </>
          ) : (
            renderPrimitive(node)
          )}

          <span className="tree-actions">
            <button
              type="button"
              className="tree-action tip tip-left"
              data-tip="Copy value"
              aria-label={`Copy value at ${formatPath(path)}`}
              onClick={(event) => {
                event.stopPropagation()
                void handleCopyValue(node, path)
              }}
            >
              <Copy size={11} />
            </button>
            <button
              type="button"
              className="tree-action tip tip-left"
              data-tip="Copy path"
              aria-label={`Copy path ${formatPath(path)}`}
              onClick={(event) => {
                event.stopPropagation()
                void handleCopyPath(path)
              }}
            >
              <Link2 size={11} />
            </button>
          </span>
        </div>

        {isOpen && visibleEntries.length > 0 ? (
          <div className="tree-children" role="group">
            {visibleEntries.map(([childKey, child]) =>
              renderNode(childKey, child, [...path, childKey], depth + 1),
            )}
          </div>
        ) : null}
      </div>
    )
  }

  const invalid = !parse.valid && !parse.empty

  return (
    <div className="tree-view">
      <div className="tree-toolbar">
        <div className="tree-search">
          <Search size={11} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search keys and values"
            aria-label="Search the JSON tree"
            spellCheck={false}
            disabled={value === undefined}
          />
          {query ? (
            <button type="button" aria-label="Clear tree search" onClick={() => setQuery('')}>
              <X size={10} />
            </button>
          ) : null}
        </div>
        {search.active ? (
          <span className="tree-match">
            {search.count}
            {search.truncated ? '+' : ''}
          </span>
        ) : null}
        <IconButton
          label="Expand all"
          icon={<UnfoldVertical size={13} />}
          onClick={handleExpandAll}
          disabled={containerPaths.length === 0}
          className="icon-btn-small"
        />
        <IconButton
          label="Collapse all"
          icon={<FoldVertical size={13} />}
          onClick={handleCollapseAll}
          disabled={value === undefined}
          className="icon-btn-small"
        />
      </div>

      {search.active ? (
        <div className="tree-search-status">
          <span>
            {search.count === 0 ? 'No matches' : `${search.count}${search.truncated ? '+' : ''} matches`}
            {search.truncated ? ' \u00b7 results limited' : ''}
          </span>
          <button type="button" onClick={() => setQuery('')}>
            Clear
          </button>
        </div>
      ) : null}

      <div className={cn('tree-scroll', variant === 'full' && 'tree-full')}>
        {parse.empty ? (
          <EmptyState
            icon={<Braces size={18} />}
            title="Nothing to inspect"
            text="Paste JSON into the editor or start with the example document."
            actions={
              <Button variant="accent" size="sm" onClick={onLoadExample}>
                Load example
              </Button>
            }
          />
        ) : invalid ? (
          <EmptyState
            icon={<AlertTriangle size={18} />}
            title="This document isn't valid JSON"
            text={
              <>
                {parse.issue?.message ?? 'Fix the syntax error to explore the tree.'}
                {parse.issue ? (
                  <>
                    {' '}
                    (line {parse.issue.line}, column {parse.issue.column})
                  </>
                ) : null}
              </>
            }
            actions={
              parse.issue ? (
                <Button size="sm" onClick={() => onJumpToError(parse.issue!)}>
                  Go to error
                </Button>
              ) : null
            }
          />
        ) : search.active && search.count === 0 ? (
          <EmptyState
            icon={<Search size={18} />}
            title="No matches"
            text={`Nothing in this document matches \u201c${deferredQuery.trim()}\u201d.`}
            actions={
              <Button size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          />
        ) : value !== undefined ? (
          <div className="tree-root" role="tree" aria-label="JSON tree">
            {renderNode(null, value, [], 0)}
          </div>
        ) : null}
      </div>
    </div>
  )
}
