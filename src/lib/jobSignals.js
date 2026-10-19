import { useCallback, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { asArray, asObject, asText } from './safe'

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

// Saved job copies can predate fields the list reads; fill them so a liked or favorite job always renders.
const normalizeSavedJob = (job) => ({
  ...job,
  title: asText(job.title) || 'Untitled job',
  status: asText(job.status) || 'Seen',
  budget: asText(job.budget) || 'Budget not specified',
  description: asText(job.description),
  tags: asArray(job.tags),
  skills: asArray(job.skills),
  activity: asArray(job.activity),
  clientStats: asObject(job.clientStats),
})

function readReactions(email) {
  const key = reactionKey(email)
  if (!cache.has(key)) {
    let stored = {}
    try { stored = asObject(JSON.parse(localStorage.getItem(key) || '{}')) } catch { stored = {} }
    const records = Object.entries(asObject(stored.jobRecords))
      .filter(([, job]) => job && typeof job === 'object')
      .map(([id, job]) => [id, normalizeSavedJob(job)])
    // applied/dismissed only track live Upwork jobs, which have no CRM status to update.
    cache.set(key, {
      liked: asArray(stored.liked),
      favorites: asArray(stored.favorites),
      applied: asArray(stored.applied),
      dismissed: asArray(stored.dismissed),
      jobRecords: Object.fromEntries(records),
    })
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
  const toggle = (field, id, job = null) => {
    const current = readReactions(email)
    const exists = current[field].includes(id)
    const list = exists ? current[field].filter((item) => item !== id) : [id, ...current[field]]
    const jobRecords = { ...(current.jobRecords || {}) }

    if (!exists && job) {
      jobRecords[id] = normalizeSavedJob({
        id: job.id,
        jobId: job.jobId || job.id,
        title: job.title || 'Untitled job',
        company: job.company || 'Upwork client',
        client: job.client,
        location: job.location,
        posted: job.posted,
        postedAt: job.postedAt,
        budget: job.budget,
        type: job.type,
        level: job.level,
        duration: job.duration,
        workload: job.workload,
        status: job.status,
        match: job.match,
        fitLabel: job.fitLabel,
        tags: job.tags || [],
        skills: job.skills || [],
        url: job.url,
        applyUrl: job.applyUrl,
        description: job.description,
        summary: job.summary,
        clientStats: job.clientStats,
        applicants: job.applicants,
        raw: job.raw,
      })
    } else if (exists) {
      const otherField = field === 'favorites' ? 'liked' : 'favorites'
      if (!current[otherField]?.includes(id) && !current.applied?.includes(id) && !current.dismissed?.includes(id)) {
        delete jobRecords[id]
      }
    }

    writeReactions(email, { ...current, [field]: list, jobRecords })
  }

  return {
    liked: reactions.liked,
    favorites: reactions.favorites,
    jobRecords: reactions.jobRecords || {},
    isLiked: (id) => reactions.liked.includes(id),
    isFavorite: (id) => reactions.favorites.includes(id),
    toggleLike: (id, job) => toggle('liked', id, job),
    toggleFavorite: (id, job) => toggle('favorites', id, job),
    isApplied: (id) => reactions.applied.includes(id),
    isDismissed: (id) => reactions.dismissed.includes(id),
    toggleApplied: (id) => toggle('applied', id),
    toggleDismissed: (id) => toggle('dismissed', id),
  }
}

/* Recent searches, newest first, per signed-in user. */

const searchKey = (email, module = 'job') => `outright-${module}-searches:${String(email || 'guest').toLowerCase()}`

export function loadRecentSearches(email, module = 'job') {
  try {
    const stored = JSON.parse(localStorage.getItem(searchKey(email, module)) || '[]')
    return Array.isArray(stored) ? stored.slice(0, 10) : []
  } catch { return [] }
}

export function rememberSearch(email, term, module = 'job') {
  const value = String(term || '').trim()
  if (value.length < 2) return loadRecentSearches(email, module)
  const next = [value, ...loadRecentSearches(email, module).filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 10)
  try { localStorage.setItem(searchKey(email, module), JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

/* People a job was shared with in Teams, newest first, per signed-in user, as { email, name }. */

const recipientKey = (email) => `outright-share-recipients:${String(email || 'guest').toLowerCase()}`
const MAX_RECENT_RECIPIENTS = 8

export function loadRecentRecipients(email) {
  try {
    const stored = JSON.parse(localStorage.getItem(recipientKey(email)) || '[]')
    return asArray(stored)
      .filter((person) => /@/.test(asText(person?.email)))
      .map((person) => ({ email: asText(person.email), name: asText(person.name) || asText(person.email) }))
      .slice(0, MAX_RECENT_RECIPIENTS)
  } catch { return [] }
}

// Puts `people` first, drops older copies of them, and keeps the newest few.
export function rememberRecipients(email, people) {
  const added = asArray(people).filter((person) => /@/.test(asText(person?.email)))
  const keys = new Set(added.map((person) => person.email.toLowerCase()))
  const next = [...added, ...loadRecentRecipients(email).filter((person) => !keys.has(person.email.toLowerCase()))].slice(0, MAX_RECENT_RECIPIENTS)
  try { localStorage.setItem(recipientKey(email), JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

export function forgetRecipient(email, address) {
  const next = loadRecentRecipients(email).filter((person) => person.email.toLowerCase() !== asText(address).toLowerCase())
  try { localStorage.setItem(recipientKey(email), JSON.stringify(next)) } catch { /* ignore */ }
  return next
}

export function forgetSearch(email, term, module = 'job') {
  const next = loadRecentSearches(email, module).filter((item) => item !== term)
  try { localStorage.setItem(searchKey(email, module), JSON.stringify(next)) } catch { /* ignore */ }
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

// The open preview lives in the URL (?job=<id>) so a refresh or a shared link reopens it, without leaving the list.
// Opening from the list pushes a history entry, so Back closes the drawer; switching jobs inside it replaces.
export function usePreviewParam() {
  const [params, setParams] = useSearchParams()
  const previewId = params.get('job')
  const update = useCallback((id, replace) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (id) next.set('job', id)
    else next.delete('job')
    return next
  }, { replace }), [setParams])
  const openPreview = useCallback((id) => update(id, Boolean(previewId)), [update, previewId])
  const closePreview = useCallback(() => update(null, true), [update])
  return { previewId, openPreview, closePreview }
}

/* Extra list filters and "next similar", applied to jobs already loaded in the browser. */

// Static client locations for the location filter; `match` runs against the client country the CRM or Upwork reports.
export const CLIENT_LOCATIONS = [
  { id: 'any', label: 'Any location' },
  { id: 'us', label: 'United States', match: /^(usa|us|u\.s\.a?\.?)$|united states/i },
  { id: 'gb', label: 'United Kingdom', match: /^(united kingdom|uk|u\.k\.|great britain|england|scotland|wales|northern ireland)$/i },
  { id: 'ca', label: 'Canada', match: /^canada$/i },
  { id: 'au', label: 'Australia', match: /^australia$/i },
  { id: 'in', label: 'India', match: /^india$/i },
  { id: 'de', label: 'Germany', match: /^(germany|deutschland)$/i },
]

export const clientLocation = (id) => CLIENT_LOCATIONS.find((item) => item.id === id) || CLIENT_LOCATIONS[0]

export function matchesExtraFilters(job, { jobType = 'any', location = 'any' } = {}) {
  if (jobType === 'hourly' && job.type !== 'Hourly') return false
  if (jobType === 'fixed' && job.type === 'Hourly') return false
  const { match } = clientLocation(location)
  return !match || match.test(String(job.clientStats?.country || '').trim())
}

export const countExtraFilters = ({ jobType = 'any', location = 'any' } = {}) => (jobType !== 'any' ? 1 : 0) + (location !== 'any' ? 1 : 0)

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'need', 'needed', 'looking', 'expert', 'developer', 'build', 'help', 'from', 'into', 'your', 'our'])
const terms = (job) => new Set([
  ...asArray(job?.skills).map((skill) => `s:${asText(skill).toLowerCase()}`),
  ...asArray(job?.tags).map((tag) => `t:${asText(tag).toLowerCase()}`),
  ...asText(job?.title).toLowerCase().split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)).map((word) => `w:${word}`),
])

// Weighted overlap: shared skills count most, then category tags, then title words.
export function similarity(a, b) {
  const left = terms(a), right = terms(b)
  let score = 0
  right.forEach((term) => { if (left.has(term)) score += term.startsWith('s:') ? 3 : term.startsWith('t:') ? 2 : 1 })
  return score
}

export function nextSimilarJob(current, jobs, skipIds = []) {
  const skip = new Set([current?.id, ...asArray(skipIds)])
  return asArray(jobs)
    .filter((job) => job && !skip.has(job.id))
    .map((job, index) => ({ job, index, score: similarity(current, job) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.job || null
}
