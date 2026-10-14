import { useEffect, useState } from 'react'

const UNITS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

export function timeAgo(value, now = Date.now()) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return ''
  const seconds = Math.max(0, Math.round((now - time) / 1000))
  if (seconds < 60) return 'Just now'
  const [unit, size] = UNITS.find(([, length]) => seconds >= length)
  const count = Math.floor(seconds / size)
  return `${count} ${unit}${count === 1 ? '' : 's'} ago`
}

// Re-renders the caller on an interval so relative times stay current.
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
