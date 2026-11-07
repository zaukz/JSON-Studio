import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

export function StatusBar({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <footer className="statusbar">
      <div className="status-group">{left}</div>
      {right ? <div className="status-group">{right}</div> : null}
    </footer>
  )
}

export function StatusItem({
  children,
  onClick,
  title,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  className?: string
}) {
  if (onClick) {
    return (
      <button type="button" className={cn('status-item', className)} onClick={onClick} title={title}>
        {children}
      </button>
    )
  }
  return (
    <span className={cn('status-item', className)} title={title}>
      {children}
    </span>
  )
}

export function StatusSeparator({ className }: { className?: string }) {
  return <span className={cn('status-sep', className)} aria-hidden="true" />
}
