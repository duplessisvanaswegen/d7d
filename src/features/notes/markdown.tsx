import type { ReactNode } from 'react'
import styles from './markdown.module.css'

// Minimal, dependency-free note formatting: **bold**, *italic* / _italic_,
// and `- ` / `* ` unordered lists. No headings, no HTML — rendered as React
// elements (never dangerouslySetInnerHTML), so it's XSS-safe.

const INLINE = /(\*\*([^*]+?)\*\*|\*([^*\s][^*]*?)\*|_([^_\s][^_]*?)_)/g

function renderInline(text: string, k: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[2] !== undefined) nodes.push(<strong key={`${k}b${i++}`}>{m[2]}</strong>)
    else nodes.push(<em key={`${k}i${i++}`}>{m[3] ?? m[4]}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function renderNoteBody(body: string): ReactNode {
  const lines = body.split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: string[] = []
  let key = 0

  const flushPara = () => {
    if (!para.length) return
    const p = para
    const content = p.flatMap((ln, i) =>
      i === 0 ? renderInline(ln, `p${key}l${i}`) : [<br key={`br${key}l${i}`} />, ...renderInline(ln, `p${key}l${i}`)],
    )
    blocks.push(
      <p key={`p${key++}`} className={styles.p}>
        {content}
      </p>,
    )
    para = []
  }
  const flushList = () => {
    if (!list.length) return
    const l = list
    blocks.push(
      <ul key={`u${key++}`} className={styles.ul}>
        {l.map((li, i) => (
          <li key={i}>{renderInline(li, `u${key}l${i}`)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  for (const line of lines) {
    const li = line.match(/^\s*[-*]\s+(.*)$/)
    if (li) {
      flushPara()
      list.push(li[1])
    } else if (line.trim() === '') {
      flushPara()
      flushList()
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return blocks
}
