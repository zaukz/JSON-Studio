export type ShortcutDefinition = {
  label: string
  keys: string[]
}

export type ShortcutGroup = {
  title: string
  items: ShortcutDefinition[]
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Document',
    items: [
      { label: 'Format document', keys: ['Mod', 'Shift', 'F'] },
      { label: 'Minify document', keys: ['Mod', 'Shift', 'M'] },
      { label: 'Download JSON', keys: ['Mod', 'S'] },
      { label: 'Open a file', keys: ['Mod', 'O'] },
      { label: 'Undo', keys: ['Mod', 'Z'] },
      { label: 'Redo', keys: ['Mod', 'Shift', 'Z'] },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { label: 'Toggle editor and tree', keys: ['Mod', 'Shift', 'E'] },
      { label: 'Toggle side panel', keys: ['Mod', 'B'] },
      { label: 'Toggle theme', keys: ['Mod', 'Shift', 'L'] },
      { label: 'Keyboard shortcuts', keys: ['?'] },
    ],
  },
  {
    title: 'Editor',
    items: [
      { label: 'Find and replace', keys: ['Mod', 'F'] },
      { label: 'Find next', keys: ['F3'] },
      { label: 'Fold or unfold code', keys: ['Mod', 'Shift', '['] },
      { label: 'Indent line', keys: ['Tab'] },
    ],
  },
  {
    title: 'Compare',
    items: [
      { label: 'Next change', keys: ['F7'] },
      { label: 'Previous change', keys: ['Shift', 'F7'] },
    ],
  },
]
