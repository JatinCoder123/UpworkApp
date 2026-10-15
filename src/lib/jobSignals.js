import { useSyncExternalStore } from 'react'

const SKILL_HUES = [88, 142, 172, 198, 222, 256, 288, 322, 12, 34, 52]

// Stable colour per skill name, used with the .skill-chip class.
export function skillHue(skill) {
  const text = String(skill || '').toLowerCase()
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return SKILL_HUES[hash % SKILL_HUES.length]
}

export const skillStyle = (skill) => ({ '--skill-h': skillHue(skill) })

/* Likes and favourites are personal, so they live in this browser per signed-in user. */

const listeners = new Set()
const cache = new Map()
const reactionKey = (email) => `outright-job-reactions:${String(email || 'guest').toLowerCase()}`

function readReactions(email) {
  const key = reactionKey(email)
  if (!cache.has(key)) {
    let stored = {}
    try { stored = JSON.parse(localStorage.getItem(key) || '{}') } catch { stored = {} }
    // applied/dismissed only track live Upwork jobs, which have no CRM status to update.
    cache.set(key, { liked: stored.liked || [], favorites: stored.favorites || [], applied: stored.applied || [], dismissed: stored.dismissed || [] })
  }
  return cache.get(key)
}

function writeReactions(email, next) {
  const key = reactionKey(email)
  cache.set(key, next)
  try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Storage can be unavailable; keep the in-memory copy. */ }
  listeners.forEach((listener) => listener())
}

const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener) }

export function useJobReactions(email) {
  const reactions = useSyncExternalStore(subscribe, () => readReactions(email))
  const toggle = (field, id) => {
    const current = readReactions(email)
    const list = current[field].includes(id) ? current[field].filter((item) => item !== id) : [id, ...current[field]]
    writeReactions(email, { ...current, [field]: list })
  }
  return {
    liked: reactions.liked,
    favorites: reactions.favorites,
    isLiked: (id) => reactions.liked.includes(id),
    isFavorite: (id) => reactions.favorites.includes(id),
    toggleLike: (id) => toggle('liked', id),
    toggleFavorite: (id) => toggle('favorites', id),
    isApplied: (id) => reactions.applied.includes(id),
    isDismissed: (id) => reactions.dismissed.includes(id),
    toggleApplied: (id) => toggle('applied', id),
    toggleDismissed: (id) => toggle('dismissed', id),
  }
}

/* Recent searches, newest first, per signed-in user. */

const searchKey = (email) => `outright-job-searches:${String(email || 'guest').toLowerCase()}`

export function loadRecentSearches(email) {
  try {
    const stored = JSON.parse(localStorage.getItem(searchKey(email)) || '[]')
    return Array.isArray(stored) ? stored.slice(0, 10) : []
  } catch { return [] }
}

export function rememberSearch(email, term) {
  const value = String(term || '').trim()
  if (value.length < 2) return loadRecentSearches(email)
  const next = [value, ...loadRecentSearches(email).filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 10)
  try { localStorage.setItem(searchKey(email), JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

export function forgetSearch(email, term) {
  const next = loadRecentSearches(email).filter((item) => item !== term)
  try { localStorage.setItem(searchKey(email), JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

// CRM jobs open inside the portal; live jobs only exist in this browser, so they share the Upwork link.
export const jobShareLink = (job) => (job.status === 'Live' ? job.url || window.location.href : `${window.location.origin}/jobs/${job.id}`)

// Plain clicks open the preview drawer; modified clicks keep normal link behaviour (new tab, etc.).
export const previewClick = (onOpen) => (event) => {
  if (!onOpen || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  onOpen()
}

/* Extra list filters and "next similar", applied to jobs already loaded in the browser. */

export const isUsaClient = (job) => /^(united states|usa|us|u\.s\.a?\.?)$|united states/i.test(String(job.clientStats?.country || '').trim())

export function matchesExtraFilters(job, { jobType = 'any', usaOnly = false } = {}) {
  if (jobType === 'hourly' && job.type !== 'Hourly') return false
  if (jobType === 'fixed' && job.type === 'Hourly') return false
  return !usaOnly || isUsaClient(job)
}

export const countExtraFilters = ({ jobType = 'any', usaOnly = false } = {}) => (jobType !== 'any' ? 1 : 0) + (usaOnly ? 1 : 0)

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'need', 'needed', 'looking', 'expert', 'developer', 'build', 'help', 'from', 'into', 'your', 'our'])
const terms = (job) => new Set([
  ...(job.skills || []).map((skill) => `s:${skill.toLowerCase()}`),
  ...(job.tags || []).map((tag) => `t:${tag.toLowerCase()}`),
  ...String(job.title || '').toLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)).map((word) => `w:${word}`),
])

// Weighted overlap: shared skills count most, then category tags, then title words.
export function similarity(a, b) {
  const left = terms(a), right = terms(b)
  let score = 0
  right.forEach((term) => { if (left.has(term)) score += term.startsWith('s:') ? 3 : term.startsWith('t:') ? 2 : 1 })
  return score
}

export function nextSimilarJob(current, jobs, skipIds = []) {
  const skip = new Set([current.id, ...skipIds])
  return jobs
    .filter((job) => !skip.has(job.id))
    .map((job, index) => ({ job, index, score: similarity(current, job) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.job || null
}
