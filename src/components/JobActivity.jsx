import { useQuery } from '@tanstack/react-query'
import { ClockCounterClockwise, WarningCircle } from '@phosphor-icons/react'
import { api } from '../services/api'
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
  'Cover letter edited with AI': 'edited the cover letter with AI',
  'Cover letter AI change undone': 'undid an AI change to the cover letter',
}

const Dot = ({ active }) => <span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ring-2 ring-[var(--surface)] ${active ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`} />

// Who did what on a CRM job, newest first, ending with the job's Upwork posting time.
export default function JobActivity({ job }) {
  const now = useNow()
  const { data: entries = [], isLoading, isError, refetch } = useQuery({ queryKey: ['job-activity', job.id], queryFn: () => api.getJobActivity(job.id), enabled: Boolean(job.id) })
  const posted = timeAgo(job.postedAt, now) || job.posted

  return <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <p className="flex items-center gap-2 text-sm font-semibold"><ClockCounterClockwise size={16} />Activity</p>
    {isError && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">Could not load activity.</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Retry</button></p>}
    <ol className="mt-4 space-y-3 border-l border-[var(--line)] pl-4">
      {isLoading && <li className="relative text-xs leading-5 text-[var(--muted)]"><Dot />Loading activity…</li>}
      {entries.map((entry, index) => <li key={entry.id} className="relative text-xs leading-5">
        <Dot active={index === 0} />
        <span className="font-semibold">{entry.userName}</span> {ACTIONS[entry.description] || entry.description}
        {entry.timeAgo && <span className="block text-[11px] text-[var(--muted)]" title={entry.date}>{entry.timeAgo}</span>}
      </li>)}
      <li className="relative text-xs leading-5">
        <Dot active={!isLoading && !entries.length} />
        Job posted on Upwork
        <span className="block text-[11px] text-[var(--muted)]" title={job.posted}>{posted}</span>
      </li>
    </ol>
  </div>
}
