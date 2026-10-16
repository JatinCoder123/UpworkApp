// Live Upwork jobs never reach the CRM, so the last scan is kept in the browser
// to let /live-jobs/:id open a job and to survive a page refresh.
import { asArray, asObject, asText } from './safe'

const RESULT_KEY = 'outrightfeedportal-live-jobs'
const SETTINGS_KEY = 'outrightfeedportal-live-settings'

export const LIVE_WINDOWS = [
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 180, label: '3 hours' },
  { minutes: 360, label: '6 hours' },
  { minutes: 1440, label: '24 hours' },
]

const read = (storage, key) => {
  try { return JSON.parse(storage.getItem(key) || 'null') } catch { return null }
}
const write = (storage, key, value) => {
  try { storage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}

export const scanSteps = (skills, windowLabel) => [
  'Connecting to the Upwork marketplace',
  `Scanning ${skills.length > 2 ? `${skills.length} skills` : skills.join(' & ')} jobs`,
  `Keeping posts from the last ${windowLabel}`,
  'Reading client history and applicants',
  'Sorting the freshest jobs first',
]
export const windowLabel = (minutes) => LIVE_WINDOWS.find((item) => item.minutes === minutes)?.label || `${minutes} min`

// Ids in the new scan that the previous scan did not have.
export const newSince = (previous, next) => {
  if (!previous) return []
  const seen = new Set(asArray(previous.jobs).map((job) => job?.id))
  return asArray(next?.jobs).filter((job) => !seen.has(job.id)).map((job) => job.id)
}

// A saved scan can come from an older version of the app; give every job the fields the UI reads.
const normalizeLiveJob = (job) => ({
  ...job,
  title: asText(job.title) || 'Untitled job',
  description: asText(job.description),
  tags: asArray(job.tags),
  skills: asArray(job.skills),
  highlightedSkills: asArray(job.highlightedSkills),
  matchedSkills: asArray(job.matchedSkills),
  preferredLocations: asArray(job.preferredLocations),
  clientStats: asObject(job.clientStats),
  applicants: Number(job.applicants) || 0,
})

export function loadLiveResult() {
  const saved = read(sessionStorage, RESULT_KEY)
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null
  return {
    ...saved,
    jobs: asArray(saved.jobs).filter((job) => job && typeof job === 'object' && job.id != null).map(normalizeLiveJob),
    skillsSearched: asObject(saved.skillsSearched),
    errors: asArray(saved.errors),
    skills: asArray(saved.skills),
  }
}
export const saveLiveResult = (result) => write(sessionStorage, RESULT_KEY, result)
export const findLiveJob = (id) => loadLiveResult()?.jobs?.find((job) => job.id === id) || null

export function loadLiveSettings() {
  const saved = read(localStorage, SETTINGS_KEY) || {}
  return {
    skills: asArray(saved.skills).filter((skill) => typeof skill === 'string' && skill.trim()),
    minutes: LIVE_WINDOWS.some((item) => item.minutes === saved.minutes) ? saved.minutes : 60,
    includeRenewed: saved.includeRenewed ?? true,
  }
}
export const saveLiveSettings = (settings) => write(localStorage, SETTINGS_KEY, settings)

// Applicants on Upwork are a rough signal of how crowded a job already is.
export function competition(applicants) {
  if (applicants < 5) return { label: 'Wide open', tone: 'var(--lime-dark)', level: 1 }
  if (applicants < 15) return { label: 'Low competition', tone: 'var(--lime-dark)', level: 2 }
  if (applicants < 35) return { label: 'Getting busy', tone: '#d9a53a', level: 3 }
  return { label: 'Crowded', tone: 'var(--danger)', level: 4 }
}

export const minutesSince = (value, now = Date.now()) => Math.max(0, Math.floor((now - new Date(value).getTime()) / 60_000))

// Early bird: posted in the last 20 minutes with fewer than 10 applicants.
export const isEarlyBird = (job, now) => minutesSince(job.postedAt, now) <= 20 && job.applicants < 10
