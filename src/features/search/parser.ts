// Query grammar (tech-spec §5): @category, #tag, quoted multi-word names,
// backslash-escaped literals, free text. The trailing incomplete operator
// token is surfaced as `active` (for autocomplete) and NOT applied as a filter.

export type OpKind = '@' | '#'
export interface ActiveToken {
  kind: OpKind
  value: string
}
export interface ParsedQuery {
  categories: string[] // lowercased, completed @tokens
  tags: string[] // lowercased, completed #tokens
  text: string // lowercased free text
  active: ActiveToken | null // trailing incomplete operator (autocomplete only)
}

interface Token {
  kind: OpKind | 'text'
  value: string
}

const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n'

function tokenize(input: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < input.length) {
    while (i < input.length && isSpace(input[i])) i++
    if (i >= input.length) break

    let kind: Token['kind'] = 'text'
    if (input[i] === '@' || input[i] === '#') {
      kind = input[i] as OpKind
      i++
    } else if (input[i] === '\\' && (input[i + 1] === '@' || input[i + 1] === '#')) {
      i++ // drop the backslash; the operator char becomes literal text
    }

    let value = ''
    if (input[i] === '"') {
      i++
      while (i < input.length && input[i] !== '"') value += input[i++]
      if (input[i] === '"') i++
    } else {
      while (i < input.length && !isSpace(input[i])) value += input[i++]
    }
    out.push({ kind, value })
  }
  return out
}

export function parseQuery(input: string): ParsedQuery {
  const tokens = tokenize(input)
  const endsWithSpace = input.length > 0 && isSpace(input[input.length - 1])

  const categories: string[] = []
  const tags: string[] = []
  const words: string[] = []
  let active: ActiveToken | null = null

  tokens.forEach((t, idx) => {
    const isLast = idx === tokens.length - 1
    if ((t.kind === '@' || t.kind === '#') && isLast && !endsWithSpace) {
      active = { kind: t.kind, value: t.value }
      return
    }
    if (t.kind === '@' && t.value) categories.push(t.value.toLowerCase())
    else if (t.kind === '#' && t.value) tags.push(t.value.toLowerCase())
    else if (t.kind === 'text' && t.value) words.push(t.value)
  })

  return { categories, tags, text: words.join(' ').toLowerCase(), active }
}

/** Replace the trailing (active) token with a completed operator+name, quoting if needed. */
export function applySuggestion(query: string, kind: OpKind, name: string): string {
  const prefix = query.replace(/\S*$/, '')
  const val = /\s/.test(name) ? `"${name}"` : name
  return `${prefix}${kind}${val} `
}

export const isBlank = (q: string) => q.trim() === ''
