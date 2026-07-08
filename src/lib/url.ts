export function normalizeUrl(input: string): string {
  const t = input.trim()
  if (!t) return t
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

export function getDomain(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** DuckDuckGo favicon service — rendered via <img>, cached offline by the SW (tech-spec §6.1). */
export function faviconUrl(url: string): string | null {
  const d = getDomain(url)
  return d ? `https://icons.duckduckgo.com/ip3/${d}.ico` : null
}

export function titleFromUrl(url: string): string {
  const d = getDomain(url)
  if (!d) return url.trim()
  const core = d.split('.').slice(0, -1).join('.') || d
  return core.charAt(0).toUpperCase() + core.slice(1)
}

/** Deterministic letter-tile colours (light pastel + saturated letter), stable across renders. */
const TILE_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#EFEFFB', '#7C7CF0'],
  ['#E4F1FB', '#2D7FF9'],
  ['#E6F6EC', '#22A565'],
  ['#FCE9EC', '#E5484D'],
  ['#FEF3C7', '#B4790B'],
  ['#F1E9FB', '#8B5CF6'],
]

export function tileColor(seed: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const [bg, fg] = TILE_PALETTE[h % TILE_PALETTE.length]
  return { bg, fg }
}

export function firstLetter(s: string): string {
  return (s.trim()[0] ?? '?').toUpperCase()
}
