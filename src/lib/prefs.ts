import { clamp } from './utils'

export type Theme = 'dark' | 'light'
export type Indent = 2 | 4
export type ViewMode = 'editor' | 'tree'
export type PanelTab = 'tree' | 'info'

export type Prefs = {
  theme: Theme
  indent: Indent
  view: ViewMode
  panelOpen: boolean
  panelTab: PanelTab
  panelWidth: number
}

export const PREF_KEY = 'jsonstudio.prefs.v1'

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  indent: 2,
  view: 'editor',
  panelOpen: true,
  panelTab: 'tree',
  panelWidth: 360,
}

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<Prefs>
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      indent: parsed.indent === 4 ? 4 : 2,
      view: parsed.view === 'tree' ? 'tree' : 'editor',
      panelOpen: typeof parsed.panelOpen === 'boolean' ? parsed.panelOpen : DEFAULT_PREFS.panelOpen,
      panelTab: parsed.panelTab === 'info' ? 'info' : 'tree',
      panelWidth:
        typeof parsed.panelWidth === 'number' && Number.isFinite(parsed.panelWidth)
          ? clamp(parsed.panelWidth, 280, 680)
          : DEFAULT_PREFS.panelWidth,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs))
  } catch {
    // Storage can be unavailable in private browsing; preferences are optional.
  }
}
