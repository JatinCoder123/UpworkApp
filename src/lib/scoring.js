import { loadPreferences, preferenceDefaults } from './preferences'

export const defaultPreferences = preferenceDefaults

const numberFrom = (value) => {
  const text = String(value).toLowerCase()
  const amount = Number(text.replace(/[^0-9.]/g, '')) || 0
  return text.includes('k') ? amount * 1000 : amount
}

function budgetScore(job, preferences) {
  const values = job.budget.match(/[\d,.]+\s*k?/gi)?.map((value) => numberFrom(value.replace(',', ''))) || [0]
  const highest = Math.max(...values)
  const target = job.type === 'Hourly' ? preferences.minimumHourlyRate : preferences.minimumFixedBudget
  const ratio = highest / target
  if (ratio >= 1.5) return { points: 22, max: 22, label: 'Budget', detail: 'Comfortably above your target', tone: 'positive' }
  if (ratio >= 1) return { points: 18, max: 22, label: 'Budget', detail: 'Meets your target', tone: 'positive' }
  if (ratio >= .7) return { points: 10, max: 22, label: 'Budget', detail: 'Slightly below your target', tone: 'neutral' }
  return { points: 3, max: 22, label: 'Budget', detail: 'Below your minimum threshold', tone: 'warning' }
}

export function scoreJob(job, preferences = loadPreferences()) {
  const skillMatches = job.tags.filter((tag) => preferences.skills.includes(tag))
  const skillRatio = skillMatches.length / Math.max(job.tags.length, 1)
  const skillPoints = Math.round(skillRatio * 35)
  const parsedRating = Number(job.clientStats?.rating)
  const rating = Number.isFinite(parsedRating) ? parsedRating : 0
  const clientPoints = rating >= 4.95 ? 20 : rating >= 4.8 ? 16 : rating >= 4.5 ? 10 : 4
  const spent = numberFrom(job.clientStats?.spent)
  const historyPoints = spent >= 100000 ? 12 : spent >= 50000 ? 10 : spent >= 10000 ? 7 : 3
  const levelPoints = preferences.preferredLevels.includes(job.level) ? 8 : 3
  const ageHours = Math.max(0, (Date.now() - new Date(job.postedAt).getTime()) / 36e5)
  const freshnessPoints = ageHours <= 6 ? 8 : ageHours <= 24 ? 6 : ageHours <= 168 ? 3 : 1
  const budget = budgetScore(job, preferences)
  const searchable = `${job.title} ${job.description}`.toLowerCase()
  const blockedMatches = preferences.blockedKeywords.filter((keyword) => searchable.includes(keyword.toLowerCase()))
  const riskPenalty = blockedMatches.length ? 15 : 0
  const score = Math.max(0, Math.min(100, skillPoints + clientPoints + historyPoints + levelPoints + freshnessPoints + budget.points - riskPenalty))
  const factors = [
    { label: 'Skill alignment', points: skillPoints, max: 35, detail: skillMatches.length ? `${skillMatches.join(', ')} match your profile` : 'No direct profile skill matches', tone: skillRatio >= .6 ? 'positive' : skillRatio ? 'neutral' : 'warning' },
    budget,
    { label: 'Client quality', points: clientPoints, max: 20, detail: `${rating.toFixed(2)} rating from a proven client`, tone: rating >= 4.8 ? 'positive' : 'neutral' },
    { label: 'Hiring history', points: historyPoints, max: 12, detail: `${job.clientStats?.spent} spent · ${job.clientStats?.hires}`, tone: spent >= 50000 ? 'positive' : 'neutral' },
    { label: 'Experience level', points: levelPoints, max: 8, detail: preferences.preferredLevels.includes(job.level) ? `${job.level} matches your preferred level` : `${job.level} is outside your preferred levels`, tone: levelPoints === 8 ? 'positive' : 'neutral' },
    { label: 'Freshness', points: freshnessPoints, max: 8, detail: ageHours <= 24 ? 'Posted recently — early applications have an advantage' : 'The opportunity has been open for a while', tone: ageHours <= 24 ? 'positive' : 'neutral' },
  ]
  const positives = factors.filter((factor) => factor.tone === 'positive').map((factor) => factor.detail)
  const concerns = [...factors.filter((factor) => factor.tone === 'warning').map((factor) => factor.detail), ...(blockedMatches.length ? [`Blocked phrase detected: ${blockedMatches.join(', ')}`] : [])]
  const verdict = score >= 85 ? 'Excellent fit' : score >= 70 ? 'Strong fit' : score >= 55 ? 'Worth reviewing' : 'Low priority'
  return { score, verdict, factors, positives, concerns, skillMatches }
}
