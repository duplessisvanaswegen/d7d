// Applies theme/accent/density to <html>. Mirrored in localStorage for instant,
// flash-free application on load (canonical copy lives in Dexie settings, synced later).

export type ThemePref = 'light' | 'dark' | 'system'
export type Accent = 'indigo' | 'blue' | 'green' | 'red' | 'amber' | 'purple'
export type Density = 'comfortable' | 'compact'

export interface Appearance {
  theme: ThemePref
  accent: Accent
  density: Density
}

const LS_KEY = 'd7d.appearance'
const DEFAULTS: Appearance = { theme: 'dark', accent: 'indigo', density: 'comfortable' }

const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const resolveTheme = (t: ThemePref) => (t === 'system' ? (media().matches ? 'dark' : 'light') : t)

export function loadAppearance(): Appearance {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

export function applyAppearance(a: Appearance): void {
  const root = document.documentElement
  root.setAttribute('data-theme', resolveTheme(a.theme))
  a.accent === 'indigo' ? root.removeAttribute('data-accent') : root.setAttribute('data-accent', a.accent)
  a.density === 'comfortable'
    ? root.removeAttribute('data-density')
    : root.setAttribute('data-density', a.density)
  localStorage.setItem(LS_KEY, JSON.stringify(a))
}

export function initTheme(): void {
  applyAppearance(loadAppearance())
  media().addEventListener('change', () => {
    const cur = loadAppearance()
    if (cur.theme === 'system') applyAppearance(cur)
  })
}
