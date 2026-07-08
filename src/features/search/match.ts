import type { ParsedQuery } from './parser'

export interface MatchContext {
  categoryName?: string // undefined for reserved Uncategorised
  tagNames: string[]
  text: string // concatenated searchable text (title/url/body + names)
}

export interface NameSets {
  categories: Set<string> // lowercased existing category names for this type
  tags: Set<string>
}

/**
 * Operators AND together; multiple categories OR (an item has one),
 * multiple tags AND (must have all). Free text is a substring match.
 * The active (trailing) token filters only when it exactly matches an
 * existing name — otherwise it's autocomplete-in-progress (tech-spec §5).
 */
export function itemMatches(parsed: ParsedQuery, ctx: MatchContext, names: NameSets): boolean {
  const cats = [...parsed.categories]
  const tags = [...parsed.tags]

  if (parsed.active && parsed.active.value) {
    const v = parsed.active.value.toLowerCase()
    if (parsed.active.kind === '@' && names.categories.has(v)) cats.push(v)
    if (parsed.active.kind === '#' && names.tags.has(v)) tags.push(v)
  }

  if (cats.length) {
    const cn = ctx.categoryName?.toLowerCase()
    if (!cn || !cats.includes(cn)) return false
  }
  if (tags.length) {
    const tn = ctx.tagNames.map((t) => t.toLowerCase())
    if (!tags.every((t) => tn.includes(t))) return false
  }
  if (parsed.text && !ctx.text.toLowerCase().includes(parsed.text)) return false
  return true
}
