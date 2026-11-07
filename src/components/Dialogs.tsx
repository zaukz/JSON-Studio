import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { SHORTCUT_GROUPS } from '../lib/shortcuts'
import { IS_MAC, cn } from '../lib/utils'
import { Button, IconButton, Kbd } from './ui'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, description, children, footer, wide = false }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const frame = window.requestAnimationFrame(() => {
      const autoFocus =
        dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? dialogRef.current
      autoFocus?.focus()
    })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      window.cancelAnimationFrame(frame)
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className={cn('dialog', wide && 'dialog-wide')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dialog-head">
          <div>
            <h2 className="dialog-title" id={titleId}>
              {title}
            </h2>
            {description ? <p className="dialog-desc">{description}</p> : null}
          </div>
          <IconButton label="Close dialog" icon={<X size={14} />} onClick={onClose} />
        </div>
        {children ? <div className="dialog-body">{children}</div> : null}
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  tone = 'danger',
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  tone?: 'danger' | 'primary'
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button data-autofocus onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

function displayKey(key: string): string {
  if (!IS_MAC) return key === 'Mod' ? 'Ctrl' : key
  const map: Record<string, string> = { Mod: '\u2318', Shift: '\u21e7', Alt: '\u2325', Enter: '\u21a9' }
  return map[key] ?? key
}

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Keep the common actions one keystroke away. Shortcuts adapt to your platform."
      wide
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {SHORTCUT_GROUPS.map((group) => (
        <div className="shortcut-group" key={group.title}>
          <h3 className="shortcut-group-title">{group.title}</h3>
          {group.items.map((item) => (
            <div className="shortcut-row" key={item.label}>
              <span>{item.label}</span>
              <span className="shortcut-keys">
                {item.keys.map((key, index) => (
                  <Kbd key={`${key}-${index}`}>{displayKey(key)}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      ))}
      <p className="dialog-note" style={{ marginTop: 12 }}>
        Editor shortcuts work while the editor is focused. Press Escape to close panels and dialogs.
      </p>
    </Modal>
  )
}
