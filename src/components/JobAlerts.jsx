import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Briefcase, Broadcast, HourglassMedium, Sparkle, X } from '@phosphor-icons/react'
import { api } from '../services/api'
import { timeAgo, useNow } from '../lib/time'

/*
 * Alerts the Jobs page shows as soon as it opens (bottom right, so they never cover the toolbar), so nothing slips by:
 * - the feeder, always one of three: new jobs ready to review in the last 4 hours, jobs that came in but are still
 *   being scored, or no job at all (the feeder may have stopped), with when it last added one;
 * - no job applied in the last 24 hours (paused for now, see APPLIED_ALERT).
 * Checked again every 5 minutes while the page is open; each alert can be dismissed for this visit. The new-jobs
 * alert can be clicked to show those jobs in the list.
 */

// The "no job applied in the last 24 hours" alert is paused while its rule is decided; true shows it again (its
// data is not even fetched while paused).
const APPLIED_ALERT = false

const TONES = {
  warn: { tile: 'bg-[var(--warn-bg)] text-[var(--warn)] ring-[#e0a526]/35', bar: 'bg-[#e0a526]' },
  new: { tile: 'bg-(--lime)/45 text-[#3f5a12] ring-[var(--lime-dark)]/40 dark:text-[var(--lime)]', bar: 'bg-[var(--lime-dark)]' },
  info: { tile: 'bg-[#e0f2fe] text-[#0369a1] ring-[#bae6fd] dark:bg-[#7dd3fc]/15 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/30', bar: 'bg-[#38bdf8]' },
}
const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`
const exactTime = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

// The alerts for the latest check: the feeder's (always one) and, when nothing was applied, the applications one.
function alertsFor(data, allJobs, now) {
  const since = (iso) => `${timeAgo(iso, now)} (${exactTime(iso)})`
  const alerts = []
  if (!data.added) alerts.push({ id: 'feeder-quiet', tone: 'warn', icon: Broadcast, title: 'No new jobs in the last 4 hours', text: data.lastAddedAt ? `The feeder last added a job ${since(data.lastAddedAt)}. It may have stopped.` : 'The feeder has not added any job yet.' })
  else if (data.ready) alerts.push({ id: `new-jobs-${allJobs}`, tone: 'new', icon: Sparkle, title: `${plural(data.ready, 'new job')} in the last 4 hours`, text: allJobs ? 'Added by the feeder and scored, ready to review.' : 'Added to your jobs by the feeder and scored, ready to review.', since: data.since })
  else alerts.push({ id: `scoring-${allJobs}`, tone: 'info', icon: HourglassMedium, title: `${plural(data.added, 'job')} came in the last 4 hours`, text: allJobs ? 'They are still being scored and show up here once ready.' : 'None is in your jobs yet: they are still being scored or went to other team members.' })
  if (APPLIED_ALERT && !data.applied) alerts.push({ id: `no-applications-${allJobs}`, tone: 'warn', icon: Briefcase, title: 'No job applied in the last 24 hours', text: allJobs
    ? (data.lastAppliedAt ? `The team's last application was ${since(data.lastAppliedAt)}.` : 'Nobody has applied to a job yet.')
    : (data.lastAppliedAt ? `Your last application was ${since(data.lastAppliedAt)}.` : 'You have not applied to any job yet.') })
  return alerts
}

// `onShowNew(since)`: clicking the "new jobs" alert shows the jobs added since `since` in the list.
export default function JobAlerts({ userEmail, allJobs, onShowNew }) {
  const now = useNow()
  const [dismissed, setDismissed] = useState([])
  const { data } = useQuery({
    queryKey: ['job-alerts', userEmail, allJobs],
    queryFn: () => api.getJobAlerts({ userEmail, allJobs, applications: APPLIED_ALERT }),
    enabled: Boolean(userEmail),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  })
  if (!data) return null
  const alerts = alertsFor(data, allJobs, now).filter((alert) => !dismissed.includes(alert.id))
  if (!alerts.length) return null
  const dismiss = (id) => setDismissed((current) => [...current, id])

  // Bottom right, above the Feedback button on a phone (where they span the width).
  return <div aria-label="Job alerts" className="pointer-events-none fixed bottom-20 right-4 z-20 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2.5 sm:bottom-6 sm:right-6">
    {alerts.map((alert, index) => {
      const tone = TONES[alert.tone]
      const Icon = alert.icon
      const show = alert.since && onShowNew ? () => { onShowNew(alert.since); dismiss(alert.id) } : null
      const body = <>
        <p className="text-[13px] font-semibold leading-5">{alert.title}</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{alert.text}</p>
        {show && <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--lime)] px-3 py-1.5 text-[11px] font-bold text-[#26320b] transition-transform group-hover/alert:-translate-y-0.5">Show these jobs<ArrowRight size={11} weight="bold" /></span>}
      </>
      return <div key={alert.id} role={alert.tone === 'warn' ? 'alert' : 'status'} style={{ animationDelay: `${index * 140}ms` }} className="job-alert pointer-events-auto rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
        <div className="relative flex items-start gap-3 overflow-hidden rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-3.5 pl-4">
          <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />
          <span className={`relative grid size-9 shrink-0 place-items-center rounded-xl ring-1 ${tone.tile}`}>
            <Icon size={17} weight="bold" />
            {alert.tone === 'warn' && <span aria-hidden="true" className="absolute -right-1 -top-1 flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#e0a526] opacity-70" /><span className="relative inline-flex size-2.5 rounded-full bg-[#e0a526] ring-2 ring-[var(--surface)]" /></span>}
          </span>
          {show
            ? <button type="button" onClick={show} title="Show these jobs in the list" className="group/alert min-w-0 flex-1 text-left">{body}</button>
            : <div className="min-w-0 flex-1">{body}</div>}
          <button type="button" onClick={() => dismiss(alert.id)} aria-label="Dismiss alert" className="grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"><X size={12} weight="bold" /></button>
        </div>
      </div>
    })}
  </div>
}
