import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../lib/utils'

export type ButtonVariant = 'ghost' | 'accent' | 'primary' | 'danger' | 'quiet'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  icon?: ReactNode
  shortcut?: string
  tooltip?: string
}

export function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  shortcut,
  tooltip,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const tip = tooltip ? (shortcut ? `${tooltip}  ${shortcut}` : tooltip) : undefined
  return (
    <button
      type={type}
      {...rest}
      data-variant={variant}
      data-tip={tip}
      className={cn('btn', size === 'sm' && 'btn-sm', tip && 'tip', className)}
    >
      {icon ? (
        <span className="btn-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children !== undefined && children !== null ? <span className="btn-label">{children}</span> : null}
    </button>
  )
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string
  icon: ReactNode
  shortcut?: string
  placement?: 'down' | 'left' | 'up'
}

export function IconButton({
  label,
  icon,
  shortcut,
  placement = 'down',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      aria-label={label}
      className={cn(
        'btn icon-btn tip',
        placement === 'left' && 'tip-left',
        placement === 'up' && 'tip-up',
        className,
      )}
      data-tip={shortcut ? `${label}  ${shortcut}` : label}
    >
      {icon}
    </button>
  )
}

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
  tooltip?: string
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: Array<SegmentedOption<T>>
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div className={cn('seg', className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn('seg-item', option.tooltip && 'tip')}
          aria-pressed={option.value === value}
          data-tip={option.tooltip}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

export type DropdownOption<T extends string> = {
  value: T
  label: string
  description?: string
}

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  icon,
}: {
  value: T
  options: Array<DropdownOption<T>>
  onChange: (value: T) => void
  label: ReactNode
  ariaLabel: string
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    const frame = window.requestAnimationFrame(() => {
      const active =
        menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
        menuRef.current?.querySelector<HTMLElement>('[role="menuitemradio"]')
      active?.focus()
    })

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.cancelAnimationFrame(frame)
    }
  }, [open])

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [],
    )
    if (items.length === 0) return

    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(currentIndex + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(currentIndex - 1 + items.length) % items.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items[items.length - 1]?.focus()
    } else if (event.key === 'Tab') {
      close()
    }
  }

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {icon ? (
          <span className="btn-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
        <ChevronDown size={12} className="dropdown-caret" aria-hidden="true" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          className="menu menu-end"
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={handleMenuKeyDown}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              data-active={option.value === value}
              className="menu-item"
              onClick={() => {
                onChange(option.value)
                setOpen(false)
                triggerRef.current?.focus()
              }}
            >
              <span className="menu-item-label">
                <span>{option.label}</span>
                {option.description ? <span className="menu-item-desc">{option.description}</span> : null}
              </span>
              {option.value === value ? <Check size={13} className="menu-check" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export type ChipTone = 'ok' | 'error' | 'neutral' | 'accent' | 'added' | 'removed' | 'changed'

export function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: ChipTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('chip', `chip-${tone}`, className)}>
      {icon ? (
        <span aria-hidden="true" style={{ display: 'inline-flex' }}>
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  actions,
  className,
}: {
  icon?: ReactNode
  title: string
  text?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('empty-state', className)}>
      {icon ? (
        <div className="empty-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="empty-title">{title}</div>
      {text ? <div className="empty-text">{text}</div> : null}
      {actions ? <div className="empty-actions">{actions}</div> : null}
    </div>
  )
}
