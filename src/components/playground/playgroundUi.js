import { Article, ChatCircleText, Code, FileText, Image, VideoCamera } from '@phosphor-icons/react'

/*
 * What each API Playground test type is (name, what you get, button text, placeholder, icon) and the class names its
 * form, result and history share.
 */

// [name, what you get, button text, placeholder, icon]
export const ACTION_INFO = {
  custom: ['Question', 'A text answer, right away', 'Ask Claude', 'e.g. Give me 5 names for an invoice reminder add-on', ChatCircleText],
  doc: ['Document', 'A Word document', 'Create document', 'e.g. A one-page brief for an invoice reminder add-on: the problem, who it is for, price $19', FileText],
  blog: ['Blog post', 'An article on a topic', 'Write blog post', 'e.g. Why small businesses should automate invoice reminders. Audience: owners of small companies', Article],
  appscript: ['App Script', 'Google Apps Script code', 'Write the script', 'e.g. Post every new Google Form response to a Slack channel', Code],
  video: ['Video script', 'A short video script', 'Write video script', 'e.g. A 60-second video on how our CRM sends WhatsApp follow-ups', VideoCamera],
  image: ['Image', 'An image from a description', 'Create image', 'e.g. Feature image for "5 ways AI saves sales teams time", colours #03414C and #FD4821', Image],
}
export const actionName = (action) => ACTION_INFO[action]?.[0] || action

export const fieldLabel = 'block text-xs font-semibold text-[var(--ink)]'
export const helpText = 'mt-0.5 block text-[11px] leading-4 text-[var(--muted)]'
export const inputClass = 'mt-1.5 w-full rounded-xl bg-[var(--paper)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--lime-dark)] disabled:opacity-60'
export const smallButton = 'inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)] disabled:opacity-50'
export const card = 'rounded-[1.75rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70'
