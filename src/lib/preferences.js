export const preferenceDefaults = {
  skills: ['React', 'TypeScript', 'GSAP', 'Product design', 'Figma', 'Design systems', 'QA'],
  minimumFixedBudget: 3000,
  minimumHourlyRate: 50,
  preferredLevels: ['Expert', 'Intermediate'],
  blockedKeywords: ['unpaid test', 'commission only'],
  timezone: 'Asia/Kolkata',
}

export function loadPreferences() {
  try { return { ...preferenceDefaults, ...JSON.parse(localStorage.getItem('pitchflow-preferences') || '{}') } } catch { return preferenceDefaults }
}

export function savePreferences(preferences) {
  localStorage.setItem('pitchflow-preferences', JSON.stringify(preferences))
}

export function loadSavedViews() {
  try { return JSON.parse(localStorage.getItem('pitchflow-saved-views') || '[]') } catch { return [] }
}

export function saveViews(views) {
  localStorage.setItem('pitchflow-saved-views', JSON.stringify(views))
}

const JOB_STATUS_KEY = 'pitchflow-job-status'
const JOB_SCOPE_KEY = 'pitchflow-job-scope'

export function loadJobScope() {
  const scope = localStorage.getItem(JOB_SCOPE_KEY)
  if (['My Jobs', 'All Jobs'].includes(scope)) return scope
  return localStorage.getItem(JOB_STATUS_KEY) === 'All Jobs' ? 'All Jobs' : 'My Jobs'
}

export function saveJobScope(scope) {
  localStorage.setItem(JOB_SCOPE_KEY, scope)
}

export function loadJobStatus() {
  const status = localStorage.getItem(JOB_STATUS_KEY)
  if (['My Jobs', 'All Jobs', 'Most recent'].includes(status)) return 'All'
  return ['All', 'New', 'Applied', 'Rejected'].includes(status) ? status : 'All'
}

export function saveJobStatus(status) {
  localStorage.setItem(JOB_STATUS_KEY, status)
}

const JOB_LAYOUT_KEY = 'pitchflow-job-layout'

export function loadJobLayout() {
  const layout = localStorage.getItem(JOB_LAYOUT_KEY)
  return ['grid', 'list', 'compact'].includes(layout) ? layout : 'grid'
}

export function saveJobLayout(layout) {
  localStorage.setItem(JOB_LAYOUT_KEY, layout)
}

const TECH_NEWS_LAYOUT_KEY = 'pitchflow-tech-news-layout'

export function loadTechNewsLayout() {
  const layout = localStorage.getItem(TECH_NEWS_LAYOUT_KEY)
  return ['grid', 'list', 'compact'].includes(layout) ? layout : 'grid'
}

export function saveTechNewsLayout(layout) {
  localStorage.setItem(TECH_NEWS_LAYOUT_KEY, layout)
}

const DATE_FILTER_KEYS = {
  jobs: 'pitchflow-jobs-date-filter',
  techNews: 'pitchflow-tech-news-date-filter',
}

const DATE_PRESETS = new Set(['all', 'today', 'yesterday', '24hours', '7days', '30days', 'lastMonth', 'custom'])

export function loadDateFilter(moduleName) {
  const fallback = { preset: 'all', from: '', to: '' }
  const key = DATE_FILTER_KEYS[moduleName]
  if (!key) return fallback
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null')
    if (!saved || !DATE_PRESETS.has(saved.preset)) return fallback
    if (saved.preset === 'custom' && (!saved.from || !saved.to)) return fallback
    return { preset: saved.preset, from: saved.from || '', to: saved.to || '' }
  } catch {
    return fallback
  }
}

export function saveDateFilter(moduleName, value) {
  const key = DATE_FILTER_KEYS[moduleName]
  if (key) localStorage.setItem(key, JSON.stringify(value))
}

const TECH_NEWS_FILTERS_KEY = 'pitchflow-tech-news-filters'

export const techNewsFilterDefaults = {
  categories: [],
  sourceTypes: [],
  tiers: [],
  search: '',
}

export function loadTechNewsFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(TECH_NEWS_FILTERS_KEY) || 'null')
    if (!saved || typeof saved !== 'object') return techNewsFilterDefaults
    return {
      categories: Array.isArray(saved.categories) ? saved.categories : [],
      sourceTypes: Array.isArray(saved.sourceTypes) ? saved.sourceTypes : [],
      tiers: Array.isArray(saved.tiers) ? saved.tiers : [],
      search: typeof saved.search === 'string' ? saved.search : '',
    }
  } catch {
    return techNewsFilterDefaults
  }
}

export function saveTechNewsFilters(filters) {
  try {
    localStorage.setItem(TECH_NEWS_FILTERS_KEY, JSON.stringify(filters))
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

const CUSTOM_JOB_SKILLS_KEY = 'pitchflow-custom-job-skills'

export function loadCustomJobSkills() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_JOB_SKILLS_KEY) || '[]')
    return Array.isArray(saved) ? saved.map((s) => String(s).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function saveCustomJobSkills(skills) {
  try {
    const clean = [...new Set((Array.isArray(skills) ? skills : []).map((s) => String(s).trim()).filter(Boolean))]
    localStorage.setItem(CUSTOM_JOB_SKILLS_KEY, JSON.stringify(clean))
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}

const CUSTOM_TECH_NEWS_CATEGORIES_KEY = 'pitchflow-custom-tech-news-categories'

export function loadCustomTechNewsCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_TECH_NEWS_CATEGORIES_KEY) || '[]')
    return Array.isArray(saved) ? saved.map((c) => String(c).trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function saveCustomTechNewsCategories(categories) {
  try {
    const clean = [...new Set((Array.isArray(categories) ? categories : []).map((c) => String(c).trim()).filter(Boolean))]
    localStorage.setItem(CUSTOM_TECH_NEWS_CATEGORIES_KEY, JSON.stringify(clean))
  } catch {
    // Ignore storage quota or privacy mode errors
  }
}
