const encoder = new TextEncoder()

export const MAX_FILE_BYTES = 10 * 1024 * 1024

export const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)

export const MOD_LABEL = IS_MAC ? '\u2318' : 'Ctrl'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function utf8Size(text: string): number {
  return encoder.encode(text).length
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits).replace(/\.0+$/, '')} ${units[unit]}`
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function ensureJsonFilename(name: string): string {
  const base = name.trim().split(/[\\/]/).pop() || 'json-studio.json'
  const safe = base.replace(/[\\/:*?"<>|]/g, '-')
  return safe.toLowerCase().endsWith('.json') ? safe : `${safe}.json`
}

export function shortcutLabel(keys: string[]): string {
  const macMap: Record<string, string> = {
    Mod: '\u2318',
    Shift: '\u21e7',
    Alt: '\u2325',
    Enter: '\u21a9',
    Backspace: '\u232b',
    Escape: 'Esc',
  }
  if (IS_MAC) return keys.map((key) => macMap[key] ?? key).join('')
  return keys.map((key) => (key === 'Mod' ? 'Ctrl' : key)).join('+')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy approach.
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}

export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function isJsonFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.json') || file.type === 'application/json'
}

export type FileReadResult = { ok: true; text: string; name: string } | { ok: false; error: string }

export async function readTextFile(file: File): Promise<FileReadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `That file is ${formatBytes(file.size)}. JSON Studio can open documents up to 10 MB.`,
    }
  }
  try {
    const text = await file.text()
    return { ok: true, text: stripBom(text), name: file.name }
  } catch {
    return { ok: false, error: 'The file could not be read. It may have moved or been changed.' }
  }
}
