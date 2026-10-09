export const EMPTY_DATE_RANGE = Object.freeze({ preset: 'all', from: '', to: '' })

export const DATE_RANGE_PRESETS = [
  { id: 'all', label: 'Any time', note: 'Show every record' },
  { id: 'today', label: 'Today', note: 'Since midnight' },
  { id: 'yesterday', label: 'Yesterday', note: 'Previous calendar day' },
  { id: '24hours', label: 'Last 24 hours', note: 'Rolling 24-hour window' },
  { id: '7days', label: 'Last 7 days', note: 'Rolling seven-day window' },
  { id: '30days', label: 'Last 30 days', note: 'Rolling thirty-day window' },
  { id: 'lastMonth', label: 'Last month', note: 'Previous calendar month' },
  { id: 'custom', label: 'Custom range', note: 'Exact date and time' },
]

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function resolveDateRange(filter, now = new Date()) {
  const preset = filter?.preset || 'all'
  if (preset === 'all') return { start: null, end: null }
  if (preset === 'custom') {
    return {
      start: filter.from ? new Date(filter.from) : null,
      end: filter.to ? new Date(filter.to) : null,
    }
  }

  const today = startOfDay(now)
  if (preset === 'today') return { start: today, end: now }
  if (preset === 'yesterday') {
    return {
      start: new Date(today.getTime() - 24 * 60 * 60 * 1000),
      end: new Date(today.getTime() - 1),
    }
  }
  if (preset === 'lastMonth') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      end: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, -1),
    }
  }

  const days = preset === '24hours' ? 1 : preset === '7days' ? 7 : 30
  return { start: new Date(now.getTime() - days * 24 * 60 * 60 * 1000), end: now }
}

export function isWithinDateRange(value, filter) {
  if (!value || !filter || filter.preset === 'all') return true
  const timestamp = new Date(value).getTime()
  const { start, end } = resolveDateRange(filter)
  if (Number.isNaN(timestamp) || !start || !end) return false
  return timestamp >= start.getTime() && timestamp <= end.getTime()
}

export function formatDateRange(filter) {
  const preset = DATE_RANGE_PRESETS.find((item) => item.id === filter?.preset)
  if (!filter || filter.preset !== 'custom') return preset?.label || 'Any time'
  if (!filter.from || !filter.to) return 'Custom range'
  const formatter = new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  return `${formatter.format(new Date(filter.from))} – ${formatter.format(new Date(filter.to))}`
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatGatewayDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function toGatewayDateFilter(filter, dateField = 'date_entered') {
  if (!filter || filter.preset === 'all') return null
  const now = new Date()
  let { start, end } = resolveDateRange(filter, now)
  if (filter.preset === 'today') {
    start = startOfDay(now)
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  } else if (filter.preset === '7days' || filter.preset === '30days') {
    const dayCount = filter.preset === '7days' ? 7 : 30
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayCount + 1)
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  } else if (filter.preset === 'custom' && start && end) {
    start.setSeconds(0, 0)
    end.setSeconds(59, 999)
  }
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  return {
    date_field: dateField,
    date_from: formatGatewayDate(start),
    date_to: formatGatewayDate(end),
  }
}
