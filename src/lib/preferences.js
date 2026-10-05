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
