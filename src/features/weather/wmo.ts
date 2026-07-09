import type { TempUnit } from '@/state/settings'

/** WMO weather-code → emoji + label (Open-Meteo current.weather_code). */
export function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: '☀️', label: 'Clear' }
  if (code <= 2) return { icon: '🌤️', label: 'Partly cloudy' }
  if (code === 3) return { icon: '☁️', label: 'Overcast' }
  if (code <= 48) return { icon: '🌫️', label: 'Fog' }
  if (code <= 57) return { icon: '🌦️', label: 'Drizzle' }
  if (code <= 67) return { icon: '🌧️', label: 'Rain' }
  if (code <= 77) return { icon: '🌨️', label: 'Snow' }
  if (code <= 82) return { icon: '🌧️', label: 'Showers' }
  if (code <= 86) return { icon: '🌨️', label: 'Snow showers' }
  return { icon: '⛈️', label: 'Thunderstorm' }
}

export function formatTemp(tempC: number, unit: TempUnit): string {
  const t = unit === 'f' ? (tempC * 9) / 5 + 32 : tempC
  return `${Math.round(t)}°`
}
