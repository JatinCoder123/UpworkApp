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

export function loadJobStatus() {
  const status = localStorage.getItem(JOB_STATUS_KEY)
  return ['New', 'Most recent', 'Applied', 'Rejected'].includes(status) ? status : 'New'
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
