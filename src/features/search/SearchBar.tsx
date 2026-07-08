import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, X, History, Folder, Hash, Lightbulb } from 'lucide-react'
import { db } from '@/db/db'
import { useUI } from '@/state/ui'
import { parseQuery, applySuggestion, isBlank } from './parser'
import { loadHistory, addHistory, removeHistory } from './history'
import type { Bookmark, Note, Category, Tag, ItemType } from '@/types/models'
import styles from './SearchBar.module.css'

interface Suggestion {
  id: string
  name: string
  type: ItemType
  count: number
}

export function SearchBar() {
  const query = useUI((s) => s.query)
  const setQuery = useUI((s) => s.setQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  const categories = useLiveQuery(() => db.categories.toArray(), [], [] as Category[])
  const tags = useLiveQuery(() => db.tags.toArray(), [], [] as Tag[])
  const bookmarks = useLiveQuery(() => db.bookmarks.toArray(), [], [] as Bookmark[])
  const notes = useLiveQuery(() => db.notes.toArray(), [], [] as Note[])

  const parsed = parseQuery(query)

  const [catCount, tagCount] = useMemo(() => {
    const cc = new Map<string, number>()
    const tc = new Map<string, number>()
    for (const b of bookmarks) {
      cc.set(b.categoryId, (cc.get(b.categoryId) ?? 0) + 1)
      b.tagIds.forEach((id) => tc.set(id, (tc.get(id) ?? 0) + 1))
    }
    for (const n of notes) {
      cc.set(n.categoryId, (cc.get(n.categoryId) ?? 0) + 1)
      n.tagIds.forEach((id) => tc.set(id, (tc.get(id) ?? 0) + 1))
    }
    return [cc, tc]
  }, [bookmarks, notes])

  const suggestions: Suggestion[] = useMemo(() => {
    if (!parsed.active) return []
    const v = parsed.active.value.toLowerCase()
    const rank = (name: string) => (name.toLowerCase().startsWith(v) ? 0 : 1)
    if (parsed.active.kind === '@') {
      return categories
        .filter((c) => !c.reserved && c.name.toLowerCase().includes(v))
        .map((c) => ({ id: c.id, name: c.name, type: c.type, count: catCount.get(c.id) ?? 0 }))
        .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
        .slice(0, 8)
    }
    return tags
      .filter((t) => t.name.toLowerCase().includes(v))
      .map((t) => ({ id: t.id, name: t.name, type: t.type, count: tagCount.get(t.id) ?? 0 }))
      .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
      .slice(0, 8)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categories, tags, catCount, tagCount])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  // Global focus shortcuts: Cmd/Ctrl+S (intercepted) and "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        inputRef.current?.focus()
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function focusOpen() {
    setHistory(loadHistory())
    setOpen(true)
  }
  function pickHistory(q: string) {
    setQuery(q)
    addHistory(q)
    setOpen(false)
    inputRef.current?.focus()
  }
  function pickSuggestion(s: Suggestion) {
    if (!parsed.active) return
    setQuery(applySuggestion(query, parsed.active.kind, s.name))
    inputRef.current?.focus()
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (parsed.active && suggestions.length) pickSuggestion(suggestions[0])
      else {
        addHistory(query)
        setOpen(false)
        inputRef.current?.blur()
      }
    } else if (e.key === 'Escape') {
      if (query) setQuery('')
      else {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
  }

  const showHistory = open && isBlank(query)
  const showSuggest = open && !!parsed.active && suggestions.length > 0

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.bar}>
        <Search size={18} className={styles.icon} />
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={focusOpen}
          onKeyDown={onKeyDown}
          placeholder="Search bookmarks &amp; notes, or  @category  #tag"
          aria-label="Search"
        />
        {query ? (
          <button className={styles.clear} onClick={() => setQuery('')} aria-label="Clear search">
            <X size={15} />
          </button>
        ) : (
          <kbd className={styles.kbd}>⌘S</kbd>
        )}
      </div>

      {(showHistory || showSuggest) && (
        <div className={styles.dropdown}>
          {showSuggest && (
            <>
              <div className={styles.sectionLabel}>{parsed.active?.kind === '@' ? 'CATEGORIES' : 'TAGS'}</div>
              {suggestions.map((s) => (
                <button key={`${s.type}-${s.id}`} className={styles.row} onClick={() => pickSuggestion(s)}>
                  {parsed.active?.kind === '@' ? (
                    <Folder size={15} className={styles.rowIconAccent} />
                  ) : (
                    <Hash size={15} className={styles.rowIconAccent} />
                  )}
                  <span className={styles.rowName}>{s.name}</span>
                  <span className={styles.badge}>{s.type === 'bookmark' ? 'Bookmarks' : 'Notes'}</span>
                  <span className={styles.count}>{s.count}</span>
                </button>
              ))}
            </>
          )}

          {showHistory && (
            <>
              {history.length > 0 && <div className={styles.sectionLabel}>RECENT</div>}
              {history.map((h) => (
                <div key={h} className={styles.row} onClick={() => pickHistory(h)} role="button" tabIndex={0}>
                  <History size={15} className={styles.rowIcon} />
                  <span className={styles.rowQuery}>{h}</span>
                  <button
                    className={styles.remove}
                    onClick={(e) => {
                      e.stopPropagation()
                      setHistory(removeHistory(h))
                    }}
                    aria-label={`Remove ${h}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className={styles.hint}>
                <Lightbulb size={14} className={styles.rowIcon} />
                <span>
                  Filter with <b>@category</b> or <b>#tag</b>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
