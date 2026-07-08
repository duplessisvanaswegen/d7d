import { useState } from 'react'
import { faviconUrl, getDomain, tileColor, firstLetter } from '@/lib/url'
import styles from './Favicon.module.css'

interface Props {
  url: string
  title: string
  size?: number
}

export function Favicon({ url, title, size = 22 }: Props) {
  const [failed, setFailed] = useState(false)
  const src = faviconUrl(url)
  const dim = { width: size, height: size }

  if (!src || failed) {
    const { bg, fg } = tileColor(getDomain(url) || title)
    return (
      <span
        className={styles.tile}
        style={{ ...dim, background: bg, color: fg, fontSize: size * 0.5 }}
        aria-hidden
      >
        {firstLetter(title || getDomain(url))}
      </span>
    )
  }

  return (
    <img
      className={styles.img}
      style={dim}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
