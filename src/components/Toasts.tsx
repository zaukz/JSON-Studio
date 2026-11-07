import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastInput = {
  title: string
  description?: string
  tone?: ToastTone
}

type ToastItem = {
  id: number
  title: string
  description?: string
  tone: ToastTone
  duration: number
}

type PushToast = (toast: ToastInput) => void

const ToastContext = createContext<PushToast | null>(null)

export function useToast(): PushToast {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used within a ToastProvider')
  return push
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
    const timer = timers.current.get(id)
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback<PushToast>((input) => {
    const id = nextId.current + 1
    nextId.current = id
    const tone = input.tone ?? 'success'
    const item: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      tone,
      duration: tone === 'error' ? 5200 : 3200,
    }

    setItems((current) => {
      const next = [...current, item]
      if (next.length <= 4) return next
      const removed = next.splice(0, next.length - 4)
      for (const stale of removed) {
        const timer = timers.current.get(stale.id)
        if (timer !== undefined) {
          window.clearTimeout(timer)
          timers.current.delete(stale.id)
        }
      }
      return next
    })

    const timer = window.setTimeout(() => {
      setItems((current) => current.filter((entry) => entry.id !== id))
      timers.current.delete(id)
    }, item.duration)

    timers.current.set(id, timer)
  }, [])

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toast-viewport" role="region" aria-label="Notifications">
          <div aria-live="polite" aria-atomic="false" style={{ display: 'contents' }}>
            {items.map((item) => (
              <ToastCard key={item.id} item={item} onDismiss={dismiss} />
            ))}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertTriangle : Info

  return (
    <div className={`toast toast-${item.tone}`} role={item.tone === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="toast-content">
        <div className="toast-title">{item.title}</div>
        {item.description ? <div className="toast-description">{item.description}</div> : null}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(item.id)}
      >
        <X size={11} />
      </button>
      <span className="toast-bar" style={{ animationDuration: `${item.duration}ms` }} aria-hidden="true" />
    </div>
  )
}
