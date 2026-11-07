import { useCallback, useEffect, useRef, useState } from 'react'
import { FileJson } from 'lucide-react'
import { ShortcutsDialog } from './components/Dialogs'
import { ToastProvider, useToast } from './components/Toasts'
import { TopNav } from './components/TopNav'
import { ConvertPage } from './pages/ConvertPage'
import { ComparePage } from './pages/ComparePage'
import { StudioPage } from './pages/StudioPage'
import { computeStats, parseJson } from './lib/json'
import { loadPrefs, savePrefs, type Prefs } from './lib/prefs'
import {
  ROUTE_HASH,
  routeFromHash,
  type IncomingDocument,
  type Route,
} from './lib/routes'
import {
  formatBytes,
  formatCount,
  isJsonFile,
  readTextFile,
  utf8Size,
} from './lib/utils'

export function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}

function AppShell() {
  const toast = useToast()
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs())
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash))
  const [visited, setVisited] = useState<Set<Route>>(
    () => new Set<Route>([routeFromHash(window.location.hash)]),
  )
  const [helpOpen, setHelpOpen] = useState(false)
  const [incoming, setIncoming] = useState<IncomingDocument | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const incomingToken = useRef(0)

  const patchPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => ({ ...current, ...patch }))
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', prefs.theme === 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', prefs.theme === 'light' ? '#f3f5f8' : '#080a0d')
  }, [prefs.theme])

  useEffect(() => {
    const timer = window.setTimeout(() => savePrefs(prefs), 220)
    return () => window.clearTimeout(timer)
  }, [prefs])

  useEffect(() => {
    const handleHashChange = () => {
      const next = routeFromHash(window.location.hash)
      setRoute(next)
      setVisited((current) => (current.has(next) ? current : new Set(current).add(next)))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigate = useCallback((next: Route) => {
    const hash = ROUTE_HASH[next]
    if (window.location.hash === hash) {
      setRoute(next)
      return
    }
    window.location.hash = hash
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          !!target.closest('.cm-editor'))
      const mod = event.metaKey || event.ctrlKey

      if (mod && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        setPrefs((current) => ({
          ...current,
          theme: current.theme === 'dark' ? 'light' : 'dark',
        }))
        return
      }

      if (!mod && !event.altKey && event.key === '?' && !typing) {
        event.preventDefault()
        setHelpOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const hasFiles = (event: DragEvent) =>
      Array.from(event.dataTransfer?.types ?? []).includes('Files')

    const resetDrag = () => {
      dragDepth.current = 0
      setDragging(false)
    }

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      dragDepth.current += 1
      setDragging(true)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    }

    const handleDrop = async (event: DragEvent) => {
      if (!event.dataTransfer?.files?.length) return
      event.preventDefault()
      resetDrag()
      const file = event.dataTransfer.files[0]
      if (!isJsonFile(file)) {
        toast({
          tone: 'error',
          title: 'Unsupported file type',
          description: 'Drop a .json document to open it in the editor.',
        })
        return
      }

      const result = await readTextFile(file)
      if (!result.ok) {
        toast({ tone: 'error', title: 'Could not open file', description: result.error })
        return
      }

      incomingToken.current += 1
      setIncoming({ text: result.text, name: result.name, token: incomingToken.current })
      navigate('studio')

      const parsed = parseJson(result.text)
      const stats = computeStats(result.text, parsed.valid ? parsed.value : undefined)
      toast(
        parsed.valid
          ? {
              tone: 'success',
              title: `Opened ${result.name}`,
              description: `${formatBytes(utf8Size(result.text))} \u00b7 ${formatCount(stats.properties)} properties.`,
            }
          : {
              tone: 'info',
              title: `Opened ${result.name}`,
              description: 'The file was loaded, but it contains a syntax error.',
            },
      )
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('blur', resetDrag)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('blur', resetDrag)
    }
  }, [navigate, toast])

  return (
    <div className="app-shell">
      <TopNav
        route={route}
        onNavigate={navigate}
        theme={prefs.theme}
        onToggleTheme={() => patchPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
        onShowShortcuts={() => setHelpOpen(true)}
      />

      <main className="app-main">
        {visited.has('studio') ? (
          <div
            className={route === 'studio' ? 'page-slot' : 'page-slot is-hidden'}
            aria-hidden={route !== 'studio'}
          >
            <StudioPage
              active={route === 'studio'}
              prefs={prefs}
              onPrefsChange={patchPrefs}
              incoming={incoming}
            />
          </div>
        ) : null}

        {visited.has('compare') ? (
          <div
            className={route === 'compare' ? 'page-slot' : 'page-slot is-hidden'}
            aria-hidden={route !== 'compare'}
          >
            <ComparePage active={route === 'compare'} />
          </div>
        ) : null}

        {visited.has('convert') ? (
          <div
            className={route === 'convert' ? 'page-slot' : 'page-slot is-hidden'}
            aria-hidden={route !== 'convert'}
          >
            <ConvertPage indent={prefs.indent} />
          </div>
        ) : null}
      </main>

      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />

      {dragging ? (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-frame">
            <div className="drop-icon">
              <FileJson size={20} />
            </div>
            <div className="drop-title">Drop to open</div>
            <div className="drop-text">JSON stays in this browser. Nothing is uploaded.</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
