import { Braces } from 'lucide-react'
import type { JsonParseResult, JsonStats, JsonType } from '../lib/json'
import { formatBytes, formatCount, cn } from '../lib/utils'
import { Button, Chip, EmptyState } from './ui'

const DISTRIBUTION: Array<{ type: JsonType; label: string }> = [
  { type: 'object', label: 'Objects' },
  { type: 'array', label: 'Arrays' },
  { type: 'string', label: 'Strings' },
  { type: 'number', label: 'Numbers' },
  { type: 'boolean', label: 'Booleans' },
  { type: 'null', label: 'Nulls' },
]

function InfoRow({
  label,
  value,
  title,
  muted = false,
}: {
  label: string
  value: string
  title?: string
  muted?: boolean
}) {
  return (
    <div className="info-row" title={title}>
      <dt>{label}</dt>
      <dd className={cn(muted && 'is-muted')}>{value}</dd>
    </div>
  )
}

export function InfoPanel({
  parse,
  stats,
  onLoadExample,
}: {
  parse: JsonParseResult
  stats: JsonStats
  onLoadExample: () => void
}) {
  if (parse.empty) {
    return (
      <div className="info-panel">
        <EmptyState
          icon={<Braces size={18} />}
          title="No document loaded"
          text="Document statistics appear here as soon as there is valid JSON in the editor."
          actions={
            <Button variant="accent" size="sm" onClick={onLoadExample}>
              Load example
            </Button>
          }
        />
      </div>
    )
  }

  const issue = parse.issue
  const structural = (value: number) => (parse.valid ? formatCount(value) : '\u2014')
  const total = stats.values
  const statusText = parse.valid
    ? 'Live statistics'
    : issue
      ? `Line ${issue.line}, column ${issue.column}`
      : 'Not valid JSON'

  return (
    <div className="info-panel">
      <div className="info-status">
        <Chip tone={parse.valid ? 'ok' : 'error'}>{parse.valid ? 'Valid JSON' : 'Invalid JSON'}</Chip>
        <span className="info-status-text">{statusText}</span>
      </div>

      {issue ? <p className="info-note" style={{ paddingBottom: 10 }}>{issue.message}</p> : null}

      <section className="info-section">
        <h3 className="info-section-title">Document</h3>
        <dl className="info-rows">
          <InfoRow
            label="Size"
            value={formatBytes(stats.bytes)}
            title={`${formatCount(stats.characters)} characters`}
          />
          <InfoRow label="Characters" value={formatCount(stats.characters)} />
          <InfoRow label="Lines" value={formatCount(stats.lines)} />
          <InfoRow
            label="Root"
            value={stats.rootType ?? '\u2014'}
            muted={!parse.valid}
          />
        </dl>
      </section>

      <section className="info-section">
        <h3 className="info-section-title">Structure</h3>
        <dl className="info-rows">
          <InfoRow label="Properties" value={structural(stats.properties)} />
          <InfoRow label="Objects" value={structural(stats.objects)} />
          <InfoRow label="Arrays" value={structural(stats.arrays)} />
          <InfoRow label="Array items" value={structural(stats.items)} />
          <InfoRow label="Values" value={structural(stats.values)} />
          <InfoRow label="Max depth" value={parse.valid ? formatCount(stats.maxDepth) : '\u2014'} />
        </dl>
      </section>

      {parse.valid && total > 0 ? (
        <section className="info-section">
          <h3 className="info-section-title">Value distribution</h3>
          <div className="dist-bar" aria-hidden="true">
            {DISTRIBUTION.map(({ type }) => {
              const count = stats.typeCounts[type]
              if (count === 0) return null
              return (
                <span
                  key={type}
                  className={cn('dist-seg', `dist-${type}`)}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              )
            })}
          </div>
          <div className="dist-legend">
            {DISTRIBUTION.map(({ type, label }) => (
              <div className="dist-legend-item" key={type}>
                <span className={cn('dist-dot', `dist-${type}`)} aria-hidden="true" />
                <span>{label}</span>
                <span className="dist-count">{formatCount(stats.typeCounts[type])}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="info-section">
        <p className="info-note">
          Statistics are calculated locally and update as you type. Nothing is uploaded.
        </p>
      </section>
    </div>
  )
}
