// The texts of a prompt record (outr_machine_learning), as shown and edited: field and title. The generators read the
// three parts; older prompts keep their task in description, shown only when it has text.
export const PROMPT_PARTS = [['role_prompt', 'System prompt'], ['overwrite_prompt', 'Prompt'], ['output_format', 'Output prompt']]
export const DESCRIPTION_PART = ['description', 'Description']

const DAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

// A scheduler's cron in words: "0 8 * * *" -> "Every day at 08:00", "0 9 * * 1-5" -> "Weekdays at 09:00",
// "0 9 * * 1" -> "Mondays at 09:00"; other patterns as they are.
export function describeSchedule(cron) {
  const parts = String(cron || '').trim().split(/\s+/)
  if (!cron || !parts[0]) return 'Not scheduled'
  if (parts.length !== 5 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1]) || parts[2] !== '*' || parts[3] !== '*') return `Cron ${cron}`
  const time = `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`
  if (parts[4] === '*') return `Every day at ${time}`
  if (parts[4] === '1-5') return `Weekdays at ${time}`
  if (/^[0-6]$/.test(parts[4])) return `${DAYS[parts[4]]} at ${time}`
  return `Cron ${cron}`
}
