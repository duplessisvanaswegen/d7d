const KEY = 'd7d.searchHistory'
const MAX = 10

export function loadHistory(): string[] {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(a) ? (a as string[]) : []
  } catch {
    return []
  }
}

export function addHistory(q: string): string[] {
  const query = q.trim()
  if (!query) return loadHistory()
  const rest = loadHistory().filter((x) => x.toLowerCase() !== query.toLowerCase())
  const next = [query, ...rest].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function removeHistory(q: string): string[] {
  const next = loadHistory().filter((x) => x !== q)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}

export function clearHistory(): void {
  localStorage.removeItem(KEY)
}
