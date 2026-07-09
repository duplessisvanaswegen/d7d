// Open-Meteo — keyless geocoding + current weather (tech-spec §6.2).

export interface GeoResult {
  name: string
  latitude: number
  longitude: number
  timezone: string
  country?: string
  admin1?: string
}

export async function geocode(name: string): Promise<GeoResult[]> {
  const q = name.trim()
  if (!q) return []
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`,
    )
    if (!r.ok) return []
    const d = await r.json()
    return (d.results ?? []) as GeoResult[]
  } catch {
    return []
  }
}

export interface CurrentWeather {
  tempC: number
  code: number
}

export async function forecast(lat: number, lon: number): Promise<CurrentWeather | null> {
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`,
    )
    if (!r.ok) return null
    const d = await r.json()
    const c = d.current
    return c ? { tempC: c.temperature_2m, code: c.weather_code } : null
  } catch {
    return null
  }
}
