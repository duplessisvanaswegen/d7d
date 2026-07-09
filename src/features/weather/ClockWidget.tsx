import { useEffect, useState } from 'react'
import { useSettings } from '@/state/settings'
import { useWeather } from './store'
import { wmo, formatTemp } from './wmo'
import styles from './ClockWidget.module.css'

function useMinuteTick() {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), 30_000)
    return () => clearInterval(id)
  }, [])
}

export function ClockWidget() {
  const locations = useSettings((s) => s.locations)
  const clockFormat = useSettings((s) => s.clockFormat)
  const units = useSettings((s) => s.weatherUnits)
  const refreshMins = useSettings((s) => s.refreshMins)
  const data = useWeather((s) => s.data)
  const refresh = useWeather((s) => s.refresh)
  useMinuteTick()

  useEffect(() => {
    if (!locations.length) return
    void refresh(locations)
    const id = setInterval(() => void refresh(locations), Math.max(5, refreshMins) * 60_000)
    return () => clearInterval(id)
  }, [locations, refreshMins, refresh])

  const hour12 = clockFormat === '12'
  const now = new Date()

  if (!locations.length) {
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12 })
    return (
      <div className={styles.chips}>
        <div className={styles.chip}>
          <div className={styles.col}>
            <span className={styles.city}>Local</span>
            <span className={styles.time}>{time}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.chips}>
      {locations.map((l) => {
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12, timeZone: l.timezone })
        const w = data[l.id]
        const stale = w ? Date.now() - w.at > 2 * 3_600_000 : false
        return (
          <div key={l.id} className={styles.chip}>
            <div className={styles.col}>
              <span className={styles.city}>{l.label}</span>
              <span className={styles.time}>{time}</span>
            </div>
            {w && (
              <div className={stale ? `${styles.wx} ${styles.stale}` : styles.wx} title={stale ? 'Last known' : wmo(w.code).label}>
                <span className={styles.icon}>{wmo(w.code).icon}</span>
                <span className={styles.temp}>{formatTemp(w.tempC, units)}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
