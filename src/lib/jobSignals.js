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
    cache.set(key, { liked: stored.liked || [], favorites: stored.favorites || [] })
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
