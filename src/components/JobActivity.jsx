import { useQuery } from '@tanstack/react-query'
import { ClockCounterClockwise, WarningCircle } from '@phosphor-icons/react'
import { api, rejectReasonOf } from '../services/api'
import { timeAgo, useNow } from '../lib/time'

const ACTIONS = {
  Seen: 'viewed this job',
  Applied: 'marked it as applied',
  Rejected: 'marked it as not a fit',
  'Undo Applied': 'undid applied',
  'Undo Rejected': 'undid not a fit',
  // Cover letter changes (see COVER_LETTER_ACTIVITY in JobDetailParts).
  'Cover letter generated': 'generated the cover letter',
  'Cover letter written': 'wrote the cover letter',
  'Cover letter edited': 'edited the cover letter',
  'Cover letter regenerated': 'regenerated the cover letter',
  // Older entries, from the Edit with AI box the cover letter had before Regenerate.
  'Cover letter edited with AI': 'edited the cover letter with AI',
  'Cover letter AI change undone': 'undid an AI change to the cover letter',
}

// "Rejected: Budget too low" reads as "marked it as not a fit — Budget too low".
const describe = (description) => {
  const reason = rejectReasonOf(description)
  return reason ? `${ACTIONS.Rejected} — ${reason}` : ACTIONS[description] || description
}

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }

// The CRM keeps the Upwork posting time as "Thu, 22 Oct 2026 10:29 IST", "Fri, 16 Oct 2026 20:38 UTC",
// "2026-10-21 12:23 UTC" or "2026-10-22 04:29:36 UTC"; this reads all of them (IST when no zone is given).
function upworkTime(text) {
  const value = String(text || '')
  const zone = /\b(UTC|GMT)\b/i.test(value) ? 'Z' : '+05:30'
  const pad = (part) => String(part || '0').padStart(2, '0')
  const written = value.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s+(\d{1,2}):(\d{2})/)
  const numeric = value.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/)
  let iso = ''
  if (written && MONTHS[written[2].toLowerCase()]) iso = `${written[3]}-${MONTHS[written[2].toLowerCase()]}-${pad(written[1])}T${pad(written[4])}:${written[5]}:00${zone}`
  else if (numeric) iso = `${numeric[1]}-${numeric[2]}-${numeric[3]}T${pad(numeric[4])}:${numeric[5]}:${pad(numeric[6])}${zone}`
  const time = iso ? new Date(iso).getTime() : NaN
  return Number.isFinite(time) ? time : null
}

// Same look as the CRM's own dates ("22 October 2026 10:27 AM"), in India time like the rest of the CRM.
function crmDate(time) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    .formatToParts(new Date(time)).map((part) => [part.type, part.value]))
  return `${parts.day} ${parts.month} ${parts.year} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`
}

const Dot = ({ active }) => <span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ring-2 ring-[var(--surface)] ${active ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`} />

// Who did what on a CRM job, newest first, then when it was added to the feed, ending with the job's Upwork posting time.
export default function JobActivity({ job }) {
  const now = useNow()
  const { data: entries = [], isLoading, isError, refetch } = useQuery({ queryKey: ['job-activity', job.id], queryFn: () => api.getJobActivity(job.id), enabled: Boolean(job.id) })
  const postedTime = upworkTime(job.posted)
  const posted = timeAgo(postedTime ?? job.postedAt, now) || job.posted
  const added = timeAgo(job.addedAt, now) || job.added

  return <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <p className="flex items-center gap-2 text-sm font-semibold"><ClockCounterClockwise size={16} />Activity</p>
    {isError && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">Could not load activity.</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Retry</button></p>}
    <ol className="mt-4 space-y-3 border-l border-[var(--line)] pl-4">
      {isLoading && <li className="relative text-xs leading-5 text-[var(--muted)]"><Dot />Loading activity…</li>}
      {entries.map((entry, index) => <li key={entry.id} className="relative text-xs leading-5">
        <Dot active={index === 0} />
        <span className="font-semibold">{entry.userName}</span> {describe(entry.description)}
        {entry.timeAgo && <span className="block text-[11px] text-[var(--muted)]" title={entry.date}>{entry.timeAgo}</span>}
      </li>)}
      {added && <li className="relative text-xs leading-5">
        <Dot active={!isLoading && !entries.length} />
        Job added to the feed
        <span className="block text-[11px] text-[var(--muted)]" title={job.added}>{job.added ? `${job.added} · ${added}` : added}</span>
      </li>}
      <li className="relative text-xs leading-5">
        <Dot active={!isLoading && !entries.length && !added} />
        Job posted on Upwork
        <span className="block text-[11px] text-[var(--muted)]" title={job.posted}>{postedTime != null ? `${crmDate(postedTime)} · ${posted}` : posted}</span>
      </li>
    </ol>
  </div>
}
