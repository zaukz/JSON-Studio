import { ArrowLeftRight, Braces, GitCompare, Keyboard, Moon, ShieldCheck, Sun } from 'lucide-react'
import type { Route } from '../lib/routes'
import { shortcutLabel } from '../lib/utils'
import type { Theme } from '../lib/prefs'
import { IconButton } from './ui'

const NAV_ITEMS: Array<{ id: Route; label: string; icon: typeof Braces }> = [
  { id: 'studio', label: 'Editor', icon: Braces },
  { id: 'compare', label: 'Compare', icon: GitCompare },
  { id: 'convert', label: 'Convert', icon: ArrowLeftRight },
]

function StudioMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M8.6 4.5H7.3c-1.6 0-2.3 1-2.3 2.6v2.4c0 1.2-.6 1.9-1.7 2 1.1.1 1.7.8 1.7 2v2.4c0 1.6.7 2.6 2.3 2.6h1.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <path
          d="M15.4 4.5h1.3c1.6 0 2.3 1 2.3 2.6v2.4c0 1.2.6 1.9 1.7 2-1.1.1-1.7.8-1.7 2v2.4c0 1.6-.7 2.6-2.3 2.6h-1.3"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12.4" r="1.3" fill="currentColor" />
      </svg>
    </span>
  )
}

export function TopNav({
  route,
  onNavigate,
  theme,
  onToggleTheme,
  onShowShortcuts,
}: {
  route: Route
  onNavigate: (route: Route) => void
  theme: Theme
  onToggleTheme: () => void
  onShowShortcuts: () => void
}) {
  return (
    <header className="topnav">
      <button type="button" className="brand" onClick={() => onNavigate('studio')} aria-label="JSON Studio home">
        <StudioMark />
        <span className="brand-name">JSON Studio</span>
      </button>

      <nav className="nav-tabs" aria-label="Workspaces">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              className="nav-tab"
              aria-current={route === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={13} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="topnav-actions">
        <span
          className="local-pill tip hidden md:inline-flex"
          data-tip="All processing stays in this browser. Documents are never uploaded."
        >
          <ShieldCheck size={11} aria-hidden="true" />
          <span>Local only</span>
        </span>
        <IconButton
          label="Keyboard shortcuts"
          shortcut="?"
          icon={<Keyboard size={15} />}
          onClick={onShowShortcuts}
        />
        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          shortcut={shortcutLabel(['Mod', 'Shift', 'L'])}
          icon={theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          onClick={onToggleTheme}
        />
      </div>
    </header>
  )
}
