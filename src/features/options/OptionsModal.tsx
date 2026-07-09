import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { X, Palette, Bookmark, StickyNote, Database, CloudSun, RefreshCw, Upload, Download, FileCode, Info, Pencil, Trash2, Check, Cloud, Copy } from 'lucide-react'
import { db } from '@/db/db'
import { renameCategory, deleteCategory, renameTag, deleteTag } from '@/db/repo'
import { Modal } from '@/ui/Modal'
import { useInstall } from '@/app/install'
import { useUI } from '@/state/ui'
import { useSettings, type TempUnit, type ClockFormat } from '@/state/settings'
import { geocode, type GeoResult } from '@/features/weather/api'
import { useWeather } from '@/features/weather/store'
import type { ItemType } from '@/types/models'
import {
  loadAppearance,
  applyAppearance,
  type Appearance,
  type ThemePref,
  type Accent,
  type Density,
} from '@/app/theme'
import {
  downloadExport,
  parseImport,
  computeDiff,
  applyAmend,
  applyReplace,
  clearAllData,
  lastExportedAt,
  type Diff,
} from '@/features/importexport/io'
import type { ExportFile } from '@/features/importexport/schema'
import { useSync, type SyncMode, type SyncStatus } from '@/sync/config'
import { connect, disconnect, type ConnectResult } from '@/sync/connect'
import { syncNow } from '@/sync/reconcile'
import { setupSql } from '@/sync/schemaSql'
import styles from './OptionsModal.module.css'

type Tab = 'appearance' | 'bookmarks' | 'notes' | 'weather' | 'sync' | 'data'
const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { id: 'notes', label: 'Notes / Tasks / Events', icon: StickyNote },
  { id: 'weather', label: 'Weather & Clocks', icon: CloudSun },
  { id: 'sync', label: 'Sync', icon: Cloud },
  { id: 'data', label: 'Data & Backup', icon: Database },
]

export function OptionsModal() {
  const open = useUI((s) => s.optionsOpen)
  const close = useUI((s) => s.closeOptions)
  const [tab, setTab] = useState<Tab>('appearance')

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  return createPortal(
    <div className={styles.backdrop} onMouseDown={close}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-label="Options" onMouseDown={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <h2 className={styles.title}>Options</h2>
          <button className={styles.close} onClick={close} aria-label="Close">
            <X size={17} />
          </button>
        </header>
        <div className={styles.body}>
          <nav className={styles.nav}>
            {TABS.map((t) => (
              <button
                key={t.id}
                className={t.id === tab ? `${styles.navItem} ${styles.navActive}` : styles.navItem}
                onClick={() => setTab(t.id)}
              >
                <t.icon size={16} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.content}>
            {tab === 'appearance' && <AppearanceTab />}
            {tab === 'bookmarks' && <BookmarksTab />}
            {tab === 'notes' && <NotesTab />}
            {tab === 'weather' && <WeatherTab />}
            {tab === 'sync' && <SyncTab />}
            {tab === 'data' && <DataTab onDone={close} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── shared bits ─────────────────────────────────────────────
function Row({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>
        <span className={styles.rowTitle}>{title}</span>
        {sub && <span className={styles.rowSub}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className={styles.seg}>
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? `${styles.segOpt} ${styles.segActive}` : styles.segOpt}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className={on ? `${styles.toggle} ${styles.toggleOn}` : styles.toggle} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className={styles.knob} />
    </button>
  )
}

// ── Appearance ──────────────────────────────────────────────
const ACCENTS: { key: Accent; color: string }[] = [
  { key: 'indigo', color: '#5B5BD6' },
  { key: 'blue', color: '#2D7FF9' },
  { key: 'green', color: '#22A565' },
  { key: 'red', color: '#E5484D' },
  { key: 'amber', color: '#B4790B' },
  { key: 'purple', color: '#8B5CF6' },
]

function AppearanceTab() {
  const [ap, setAp] = useState<Appearance>(() => loadAppearance())
  const update = (patch: Partial<Appearance>) => {
    const next = { ...ap, ...patch }
    setAp(next)
    applyAppearance(next)
  }
  return (
    <div className={styles.tab}>
      <h3 className={styles.tabTitle}>Appearance</h3>
      <Row title="Theme">
        <Segmented<ThemePref>
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
          value={ap.theme}
          onChange={(theme) => update({ theme })}
        />
      </Row>
      <Row title="Accent colour">
        <div className={styles.swatches}>
          {ACCENTS.map((a) => (
            <button
              key={a.key}
              className={a.key === ap.accent ? `${styles.swatch} ${styles.swatchActive}` : styles.swatch}
              style={{ background: a.color }}
              onClick={() => update({ accent: a.key })}
              aria-label={a.key}
            />
          ))}
        </div>
      </Row>
      <Row title="Density" sub="Applies to both panels">
        <Segmented<Density>
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
          value={ap.density}
          onChange={(density) => update({ density })}
        />
      </Row>
    </div>
  )
}

// ── Bookmarks ───────────────────────────────────────────────
function BookmarksTab() {
  const { faviconFetch, openLinks, setFaviconFetch, setOpenLinks } = useSettings()
  return (
    <div className={styles.tab}>
      <h3 className={styles.tabTitle}>Bookmarks</h3>
      <Row title="Favicons" sub="Fetched via DuckDuckGo, cached offline by the app">
        <Toggle on={faviconFetch} onChange={setFaviconFetch} />
      </Row>
      <Row title="Open links">
        <Segmented
          options={[
            { value: 'new', label: 'New tab' },
            { value: 'same', label: 'Same tab' },
          ]}
          value={openLinks}
          onChange={setOpenLinks}
        />
      </Row>
      <div className={styles.divider} />
      <Manage type="bookmark" />
    </div>
  )
}

function NotesTab() {
  return (
    <div className={styles.tab}>
      <h3 className={styles.tabTitle}>Notes / Tasks / Events</h3>
      <Manage type="note" />
    </div>
  )
}

// ── Category / tag management ────────────────────────────────
function Manage({ type }: { type: ItemType }) {
  const cats = useLiveQuery(
    async () => (await db.categories.where('type').equals(type).toArray()).filter((c) => !c.reserved),
    [type],
    [],
  )
  const tags = useLiveQuery(() => db.tags.where('type').equals(type).toArray(), [type], [])
  const items = useLiveQuery(
    async (): Promise<{ categoryId: string; tagIds: string[] }[]> =>
      type === 'bookmark' ? db.bookmarks.toArray() : db.notes.toArray(),
    [type],
    [] as { categoryId: string; tagIds: string[] }[],
  )

  const [confirmCat, setConfirmCat] = useState<{ id: string; name: string } | null>(null)

  const catCount = new Map<string, number>()
  const tagCount = new Map<string, number>()
  for (const i of items) {
    catCount.set(i.categoryId, (catCount.get(i.categoryId) ?? 0) + 1)
    i.tagIds.forEach((id) => tagCount.set(id, (tagCount.get(id) ?? 0) + 1))
  }

  return (
    <>
      <ManageList
        heading="Categories"
        rows={cats.map((c) => ({ id: c.id, name: c.name, count: catCount.get(c.id) ?? 0 }))}
        empty="No categories yet."
        onRename={(id, name) => void renameCategory(id, name)}
        onDelete={(id, name) => setConfirmCat({ id, name })}
      />
      {confirmCat && (
        <Modal
          open
          onClose={() => setConfirmCat(null)}
          title="Delete category"
          width={420}
          footer={
            <>
              <button className={styles.ghost} onClick={() => setConfirmCat(null)}>
                Cancel
              </button>
              <button
                className={styles.danger}
                onClick={() => {
                  void deleteCategory(confirmCat.id, true)
                  setConfirmCat(null)
                }}
              >
                Delete items too
              </button>
              <button
                className={styles.primary}
                onClick={() => {
                  void deleteCategory(confirmCat.id, false)
                  setConfirmCat(null)
                }}
              >
                Reassign to Uncategorised
              </button>
            </>
          }
        >
          <p className={styles.confirmText}>
            “{confirmCat.name}” — move its items to <b>Uncategorised</b>, or delete them along with the category?
          </p>
        </Modal>
      )}
      <ManageList
        heading="Tags"
        prefix="#"
        rows={tags.map((t) => ({ id: t.id, name: t.name, count: tagCount.get(t.id) ?? 0 }))}
        empty="No tags yet."
        onRename={(id, name) => void renameTag(id, name)}
        onDelete={(id, name) => {
          if (window.confirm(`Delete tag “#${name}”? It will be removed from all items.`)) void deleteTag(type, id)
        }}
      />
    </>
  )
}

interface ManageRow {
  id: string
  name: string
  count: number
}
function ManageList({
  heading,
  rows,
  empty,
  prefix = '',
  onRename,
  onDelete,
}: {
  heading: string
  rows: ManageRow[]
  empty: string
  prefix?: string
  onRename: (id: string, name: string) => void
  onDelete: (id: string, name: string) => void
}) {
  return (
    <div className={styles.manageBlock}>
      <span className={styles.manageHeading}>{heading}</span>
      {rows.length === 0 ? (
        <span className={styles.rowSub}>{empty}</span>
      ) : (
        <div className={styles.manageList}>
          {rows.map((r) => (
            <ManageRowItem key={r.id} row={r} prefix={prefix} onRename={onRename} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
function ManageRowItem({
  row,
  prefix,
  onRename,
  onDelete,
}: {
  row: ManageRow
  prefix: string
  onRename: (id: string, name: string) => void
  onDelete: (id: string, name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(row.name)
  const save = () => {
    if (value.trim() && value.trim() !== row.name) onRename(row.id, value.trim())
    setEditing(false)
  }
  return (
    <div className={styles.manageRow}>
      {editing ? (
        <input
          autoFocus
          className={styles.manageInput}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            else if (e.key === 'Escape') {
              setValue(row.name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <span className={styles.manageName}>
          {prefix}
          {row.name}
        </span>
      )}
      <span className={styles.manageCount}>{row.count}</span>
      {editing ? (
        <button className={styles.manageBtn} onClick={save} aria-label="Save">
          <Check size={14} />
        </button>
      ) : (
        <button className={styles.manageBtn} onClick={() => setEditing(true)} aria-label={`Rename ${row.name}`}>
          <Pencil size={14} />
        </button>
      )}
      <button className={`${styles.manageBtn} ${styles.manageDanger}`} onClick={() => onDelete(row.id, row.name)} aria-label={`Delete ${row.name}`}>
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ── Weather & Clocks ────────────────────────────────────────
function WeatherTab() {
  const { locations, weatherUnits, clockFormat, refreshMins, addLocation, removeLocation, setWeatherUnits, setClockFormat, setRefreshMins } =
    useSettings()
  const refresh = useWeather((s) => s.refresh)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GeoResult[] | null>(null)
  const [searching, setSearching] = useState(false)

  async function search() {
    if (!q.trim()) return
    setSearching(true)
    setResults(await geocode(q))
    setSearching(false)
  }
  function add(r: GeoResult) {
    addLocation({ label: r.name, lat: r.latitude, lon: r.longitude, timezone: r.timezone })
    setQ('')
    setResults(null)
  }

  return (
    <div className={styles.tab}>
      <div className={styles.tabHead}>
        <h3 className={styles.tabTitle}>Weather &amp; Clocks</h3>
        <button className={styles.ghost} onClick={() => void refresh(locations)}>
          <RefreshCw size={14} /> Refresh now
        </button>
      </div>

      {locations.length > 0 && (
        <div className={styles.locList}>
          {locations.map((l) => (
            <div key={l.id} className={styles.locRow}>
              <div className={styles.rowLabel}>
                <span className={styles.rowTitle}>{l.label}</span>
                <span className={styles.rowSub}>{l.timezone}</span>
              </div>
              <button className={styles.locRemove} onClick={() => removeLocation(l.id)} aria-label={`Remove ${l.label}`}>
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.addLoc}>
        <input
          className={styles.addInput}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void search()
            }
          }}
          placeholder="Add a city…"
        />
        <button className={styles.ghost} onClick={() => void search()} disabled={searching}>
          Search
        </button>
      </div>

      {results &&
        (results.length ? (
          <div className={styles.locList}>
            {results.map((r, i) => (
              <button key={i} className={styles.resultRow} onClick={() => add(r)}>
                <span className={styles.rowTitle}>{r.name}</span>
                <span className={styles.rowSub}>{[r.admin1, r.country].filter(Boolean).join(', ')}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className={styles.rowSub}>No matches.</span>
        ))}

      <div className={styles.divider} />

      <Row title="Temperature">
        <Segmented<TempUnit>
          options={[
            { value: 'c', label: '°C' },
            { value: 'f', label: '°F' },
          ]}
          value={weatherUnits}
          onChange={setWeatherUnits}
        />
      </Row>
      <Row title="Clock format">
        <Segmented<ClockFormat>
          options={[
            { value: '24', label: '24-hour' },
            { value: '12', label: '12-hour' },
          ]}
          value={clockFormat}
          onChange={setClockFormat}
        />
      </Row>
      <Row title="Auto-refresh">
        <Segmented
          options={[
            { value: '15', label: '15 min' },
            { value: '30', label: '30 min' },
            { value: '60', label: '60 min' },
          ]}
          value={String(refreshMins)}
          onChange={(v) => setRefreshMins(Number(v))}
        />
      </Row>
    </div>
  )
}

// ── Sync ────────────────────────────────────────────────────
const STATUS_LABEL: Record<SyncStatus, string> = {
  off: 'Off',
  idle: 'Up to date',
  syncing: 'Syncing…',
  offline: 'Offline — will retry',
  error: 'Error',
  'signed-out': 'Signed out — re-enter your password',
}
const STATUS_DOT: Record<SyncStatus, string> = {
  off: styles.dotOff,
  idle: styles.dotIdle,
  syncing: styles.dotSync,
  offline: styles.dotOff,
  error: styles.dotErr,
  'signed-out': styles.dotErr,
}

function agoShort(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86_400)} d ago`
}

function SyncTab() {
  const config = useSync((s) => s.config)
  const status = useSync((s) => s.status)
  const lastSyncAt = useSync((s) => s.lastSyncAt)
  const lastError = useSync((s) => s.lastError)

  if (config.enabled) {
    return <SyncConnected status={status} lastSyncAt={lastSyncAt} lastError={lastError} />
  }
  return <SyncSetup />
}

function SyncConnected({ status, lastSyncAt, lastError }: { status: SyncStatus; lastSyncAt: number | null; lastError: string | null }) {
  const config = useSync((s) => s.config)
  const lastSummary = useSync((s) => s.lastSummary)
  const [busy, setBusy] = useState(false)

  async function onDisconnect() {
    if (!window.confirm('Disconnect sync from this device? Your local data stays; only the connection is removed.')) return
    setBusy(true)
    await disconnect()
    setBusy(false)
  }

  return (
    <div className={styles.tab}>
      <h3 className={styles.tabTitle}>Sync</h3>
      <div className={styles.statusRow}>
        <span className={`${styles.dot} ${STATUS_DOT[status]}`} />
        <span className={styles.rowTitle}>{STATUS_LABEL[status]}</span>
        <span className={styles.rowSub}>· last synced {agoShort(lastSyncAt)}</span>
      </div>
      {lastSummary && (
        <span className={styles.rowSub}>
          Last sync: pulled {lastSummary.pulled} · pushed {lastSummary.pushed}
        </span>
      )}
      {lastError && (
        <div className={styles.errorNote}>
          <FileCode size={15} /> {lastError}
        </div>
      )}
      <Row title="Supabase project" sub={config.url}>
        <span className={styles.rowSub}>{config.mode === 'auth' ? 'Auth' : 'Simple'}</span>
      </Row>
      {config.mode === 'auth' && <Row title="Account" sub={config.email}>{null}</Row>}
      <Row title="Sync now" sub="Push local changes and pull remote ones immediately.">
        <button className={styles.primary} onClick={() => void syncNow()} disabled={status === 'syncing'}>
          <RefreshCw size={14} /> {status === 'syncing' ? 'Syncing…' : 'Sync now'}
        </button>
      </Row>
      <div className={styles.note}>
        <Info size={15} />
        <span>Sync runs in the background. Bookmarks, notes, categories and tags stay in step across your devices — settings and weather remain per-device. Export/import is still your offline backup.</span>
      </div>
      <div className={styles.divider} />
      <Row title="Disconnect" sub="Stops sync and clears creds from this device. Local data is untouched.">
        <button className={styles.danger} onClick={() => void onDisconnect()} disabled={busy}>
          Disconnect
        </button>
      </Row>
    </div>
  )
}

function SyncSetup() {
  const [url, setUrl] = useState('')
  const [anonKey, setAnonKey] = useState('')
  const [mode, setMode] = useState<SyncMode>('auth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ConnectResult | null>(null)
  const [showSql, setShowSql] = useState(false)
  const [copied, setCopied] = useState(false)

  const sql = setupSql(mode)

  async function onConnect() {
    setBusy(true)
    setResult(null)
    const res = await connect({ url, anonKey, mode, email, password })
    setResult(res)
    if (!res.ok && res.needsSetup) setShowSql(true)
    setBusy(false)
    // First connect: run the initial additive reconcile now; its "pulled N · pushed M"
    // summary appears in the connected view this component switches to.
    if (res.ok) void syncNow()
  }

  async function copySql() {
    await navigator.clipboard?.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={styles.tab}>
      <h3 className={styles.tabTitle}>Sync</h3>
      <p className={styles.pitch}>
        Optional cross-device sync you own. It needs a <b>free Supabase project</b> (you bring the URL + anon key); d7d
        stores nothing. Local stays the source of truth — turn this off and nothing changes.
      </p>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Supabase URL</span>
        <input className={styles.addInput} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" spellCheck={false} />
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Anon (public) key</span>
        <input className={styles.addInput} value={anonKey} onChange={(e) => setAnonKey(e.target.value)} placeholder="eyJhbGci…" spellCheck={false} />
      </div>

      <Row title="Security" sub={mode === 'auth' ? 'Email + password sign-in; every row scoped to you (recommended).' : 'Anyone with your URL + key can read/write. Only for non-sensitive data.'}>
        <Segmented<SyncMode>
          options={[
            { value: 'auth', label: 'Auth' },
            { value: 'simple', label: 'Simple (less secure)' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </Row>

      {mode === 'auth' && (
        <>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <input className={styles.addInput} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" spellCheck={false} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Password</span>
            <input className={styles.addInput} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set on first connect" autoComplete="current-password" />
          </div>
        </>
      )}

      {result && !result.ok && (
        <div className={styles.errorNote}>
          <FileCode size={15} /> {result.error}
        </div>
      )}

      <div className={styles.actions}>
        <button className={styles.ghost} onClick={() => setShowSql((v) => !v)}>
          <FileCode size={14} /> {showSql ? 'Hide setup SQL' : 'Show setup SQL'}
        </button>
        <button className={styles.primary} onClick={() => void onConnect()} disabled={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
      </div>

      {showSql && (
        <div className={styles.field}>
          <div className={styles.sqlHead}>
            <span className={styles.fieldLabel}>Run this once in your Supabase SQL editor</span>
            <button className={styles.ghost} onClick={() => void copySql()}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className={styles.sql}>{sql}</pre>
          <span className={styles.rowSub}>
            You may re-run this after a d7d update if the tab asks for it. It is safe to run more than once.
          </span>
        </div>
      )}
    </div>
  )
}

// ── Data & Backup ───────────────────────────────────────────
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
function agoLabel(ts: number | null): string {
  if (!ts) return 'Never exported'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  return days <= 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`
}

function DataTab({ onDone }: { onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const install = useInstall()
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  const [pending, setPending] = useState<{ data: ExportFile; diff: Diff } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lastExport = lastExportedAt()

  useEffect(() => {
    void navigator.storage?.estimate().then((e) => setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }))
  }, [])

  async function onFile(file: File) {
    setError(null)
    const res = parseImport(await file.text())
    if (!res.ok) {
      setError(res.error)
      return
    }
    setPending({ data: res.data, diff: await computeDiff(res.data) })
  }

  async function doAmend() {
    if (!pending) return
    setBusy(true)
    await applyAmend(pending.data)
    onDone()
  }
  async function doReplace() {
    if (!pending) return
    if (!window.confirm('Replace all current data with this file? This cannot be undone.')) return
    setBusy(true)
    await applyReplace(pending.data)
    onDone()
  }
  async function onClear() {
    if (!window.confirm('Permanently delete all bookmarks, notes, categories and tags? Export first — this cannot be undone.')) return
    await clearAllData()
    onDone()
  }

  if (pending) {
    const { diff } = pending
    return (
      <div className={styles.tab}>
        <h3 className={styles.tabTitle}>Import preview</h3>
        <div className={styles.stats}>
          <Stat n={diff.added} label="new" color="#22A565" />
          <Stat n={diff.changed} label="changed" color="#B4790B" />
          <Stat n={diff.localKept} label="local kept" color="var(--text-secondary)" />
        </div>
        {diff.rows.length > 0 && (
          <div className={styles.diffList}>
            {diff.rows.map((r, i) => (
              <div key={i} className={styles.diffRow}>
                <span className={r.sym === '+' ? `${styles.badge} ${styles.badgeAdd}` : `${styles.badge} ${styles.badgeChg}`}>{r.sym}</span>
                <span className={styles.diffName}>{r.label}</span>
                <span className={styles.diffDetail}>{r.detail}</span>
              </div>
            ))}
          </div>
        )}
        <div className={styles.note}>
          <Info size={15} />
          <span>Amend keeps your local-only items and updates the rest (newest edit wins). Replace wipes everything first.</span>
        </div>
        <div className={styles.actions}>
          <button className={styles.ghost} onClick={() => setPending(null)} disabled={busy}>
            Cancel
          </button>
          <button className={styles.danger} onClick={() => void doReplace()} disabled={busy}>
            Replace all
          </button>
          <button className={styles.primary} onClick={() => void doAmend()} disabled={busy}>
            Amend
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tab}>
      <h3 className={styles.tabTitle}>Data &amp; Backup</h3>

      {install.available && (
        <Row title="Install app" sub="Add d7d to your home screen or dock for offline use">
          <button className={styles.primary} onClick={() => void install.prompt()}>
            Install
          </button>
        </Row>
      )}

      <div className={styles.storage}>
        <div className={styles.storageHead}>
          <span className={styles.rowTitle}>Storage used</span>
          <span className={styles.rowSub}>{storage ? `${fmtBytes(storage.usage)} of ~${fmtBytes(storage.quota)}` : '…'}</span>
        </div>
        <div className={styles.bar}>
          <div className={styles.barFill} style={{ width: storage && storage.quota ? `${Math.max(2, (storage.usage / storage.quota) * 100)}%` : '2%' }} />
        </div>
        <span className={styles.rowSub}>Everything lives in this browser. Export regularly — it’s your only backup.</span>
      </div>

      <Row title="Last exported" sub={agoLabel(lastExport)}>
        <div className={styles.backupBtns}>
          <button className={styles.ghost} onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import
          </button>
          <button className={styles.primary} onClick={() => void downloadExport()}>
            <Download size={14} /> Export
          </button>
        </div>
      </Row>

      {error && (
        <div className={styles.errorNote}>
          <FileCode size={15} /> {error}
        </div>
      )}

      <div className={styles.divider} />

      <Row title="Clear all data" sub="Permanently deletes everything in this browser">
        <button className={styles.danger} onClick={() => void onClear()}>
          Clear all
        </button>
      </Row>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statN} style={{ color }}>
        {n}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
