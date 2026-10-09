export const SCORE_TIER_THRESHOLDS = {
  BLOCKBUSTER: {
    min: 90,
    label: 'BLOCKBUSTER',
    tierKey: 'blockbuster',
    badgeClass: 'bg-rose-500/15 text-rose-600 ring-rose-500/30',
    squareClass: 'bg-rose-500',
  },
  HOT: {
    min: 70,
    max: 89,
    label: 'HOT',
    tierKey: 'hot',
    badgeClass: 'bg-amber-500/15 text-amber-700 ring-amber-500/30',
    squareClass: 'bg-amber-500',
  },
  NORMAL: {
    max: 69,
    label: 'NORMAL',
    tierKey: 'normal',
    badgeClass: 'bg-purple-500/15 text-purple-700 ring-purple-500/30',
    squareClass: 'bg-purple-500',
  },
}

export const SOURCE_TYPES = {
  FIRST_PARTY: 'FirstParty',
  THIRD_PARTY: 'ThirdParty',
  YOU_BLOGGING: 'YouBlogging',
}

export const HURRY_UP_TAG = 'HurryUp'
export const HURRY_UP_THRESHOLD_HOURS = 12

export function classifyScoreTier(rawScore) {
  const numericScore = typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : 0
  if (numericScore >= SCORE_TIER_THRESHOLDS.BLOCKBUSTER.min) {
    return {
      tierKey: SCORE_TIER_THRESHOLDS.BLOCKBUSTER.tierKey,
      label: SCORE_TIER_THRESHOLDS.BLOCKBUSTER.label,
      score: numericScore,
      badgeClass: SCORE_TIER_THRESHOLDS.BLOCKBUSTER.badgeClass,
      squareClass: SCORE_TIER_THRESHOLDS.BLOCKBUSTER.squareClass,
    }
  }
  if (numericScore >= SCORE_TIER_THRESHOLDS.HOT.min) {
    return {
      tierKey: SCORE_TIER_THRESHOLDS.HOT.tierKey,
      label: SCORE_TIER_THRESHOLDS.HOT.label,
      score: numericScore,
      badgeClass: SCORE_TIER_THRESHOLDS.HOT.badgeClass,
      squareClass: SCORE_TIER_THRESHOLDS.HOT.squareClass,
    }
  }
  return {
    tierKey: SCORE_TIER_THRESHOLDS.NORMAL.tierKey,
    label: SCORE_TIER_THRESHOLDS.NORMAL.label,
    score: numericScore,
    badgeClass: SCORE_TIER_THRESHOLDS.NORMAL.badgeClass,
    squareClass: SCORE_TIER_THRESHOLDS.NORMAL.squareClass,
  }
}

export function classifySourceType(story) {
  if (!story) return SOURCE_TYPES.THIRD_PARTY
  const declaredType = String(story.sourceType || '').trim().replace(/^#/, '').toLowerCase()
  if (declaredType === 'firstparty' || declaredType === 'first_party') {
    return SOURCE_TYPES.FIRST_PARTY
  }
  if (declaredType === 'youblogging' || declaredType === 'you_blogging') {
    return SOURCE_TYPES.YOU_BLOGGING
  }
  if (declaredType === 'thirdparty' || declaredType === 'third_party') {
    return SOURCE_TYPES.THIRD_PARTY
  }

  if (story.isOfficial || story.firstParty) {
    return SOURCE_TYPES.FIRST_PARTY
  }
  if (story.isOwnBlog || story.youBlogging) {
    return SOURCE_TYPES.YOU_BLOGGING
  }

  return SOURCE_TYPES.THIRD_PARTY
}

export function isHurryUp(story, thresholdHours = HURRY_UP_THRESHOLD_HOURS) {
  if (!story) return false
  if (story.isHurryUp === true) return true
  if (story.isHurryUp === false) return false

  if (!story.postedAt) return false
  const time = new Date(story.postedAt).getTime()
  if (Number.isNaN(time)) return false

  const ageHours = (Date.now() - time) / 36e5
  return ageHours >= 0 && ageHours <= thresholdHours
}

export function formatDigestISTTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''

  const optionsDate = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }
  const datePart = new Intl.DateTimeFormat('en-GB', optionsDate).format(d)

  const optionsTime = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }
  const timePart = new Intl.DateTimeFormat('en-GB', optionsTime).format(d).toLowerCase()

  return `${datePart} · ${timePart} IST`
}

export function prepareDailyTechDigest(stories = []) {
  if (!Array.isArray(stories)) return []

  const cloned = [...stories].sort((a, b) => {
    const scoreA = typeof a?.score === 'number' ? a.score : 0
    const scoreB = typeof b?.score === 'number' ? b.score : 0
    return scoreB - scoreA
  })

  return cloned.map((story, index) => {
    const rank = `#${index + 1}`
    const tier = classifyScoreTier(story?.score)
    const sourceType = classifySourceType(story)
    const hurryUp = isHurryUp(story)

    return {
      ...story,
      rank,
      tier,
      sourceType,
      hurryUp,
    }
  })
}
