import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from '@phosphor-icons/react'
import { Avatar, ErrorNote, Panel, SectionTitle, skeleton } from './adminParts'
import { FeedbackStatus, Stars } from '../../components/FeedbackWidget'
import { useAuth } from '../../contexts/AuthContext'
import { useFeedback, useSetFeedbackStatus } from '../../lib/feedback'

const selectClass = 'h-9 cursor-pointer rounded-full bg-[var(--paper)] px-3 text-xs font-semibold text-[var(--ink)] outline-none ring-1 ring-[var(--line)] focus-visible:ring-2 focus-visible:ring-[var(--lime-dark)]'

/** Every user's feedback from the CRM (outr_feedback), to track improvements: filter it and set its status (the user sees it). */
export default function FeedbackTab() {
  const { user } = useAuth()
  const { entries: all, types, statuses, typeLabel, statusLabel, isLoading, error, refetch } = useFeedback({ user })
  const setFeedbackStatus = useSetFeedbackStatus()
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [section, setSection] = useState('')
  const sections = useMemo(() => [...new Set(all.map((entry) => entry.section))].sort(), [all])
  const shown = all.filter((entry) => (!status || entry.status === status) && (!type || entry.type === type) && (!section || entry.section === section))
  const counts = Object.fromEntries(statuses.map(([id]) => [id, all.filter((entry) => entry.status === id).length]))

  return <div className="space-y-4">
    <Panel>
      <SectionTitle aside={<span className="text-xs text-[var(--muted)]">{all.length} total · {statuses.map(([id, label]) => `${counts[id] || 0} ${label.toLowerCase()}`).join(' · ')}</span>}>User feedback</SectionTitle>
      <div className="mt-4 flex flex-wrap gap-2">
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}><option value="">All statuses</option>{statuses.map(([id, label]) => <option key={id} value={id}>{label} ({counts[id] || 0})</option>)}</select>
        <select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)} className={selectClass}><option value="">All types</option>{types.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select aria-label="Section" value={section} onChange={(event) => setSection(event.target.value)} className={selectClass}><option value="">All sections</option>{sections.map((name) => <option key={name} value={name}>{name}</option>)}</select>
      </div>
    </Panel>

    {error && <ErrorNote error={error} onRetry={refetch} />}
    {setFeedbackStatus.error && <ErrorNote error={setFeedbackStatus.error} onDismiss={() => setFeedbackStatus.reset()} />}
    {isLoading && <Panel><span className={`${skeleton} h-16`} /></Panel>}
    {!isLoading && !error && !shown.length && <Panel><p className="py-6 text-center text-sm text-[var(--muted)]">{all.length ? 'No feedback matches these filters.' : 'No feedback yet.'}</p></Panel>}
    {shown.map((entry) => <Panel key={entry.id}>
      <div className="flex flex-wrap items-start gap-3">
        <Avatar name={entry.userName || 'User'} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[var(--ink)]">{entry.userName || 'Unknown user'}</span>
            <FeedbackStatus status={entry.status} label={statusLabel(entry.status)} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)]">{entry.section}</span>·<span>{typeLabel(entry.type)}</span>
            {entry.rating > 0 && <Stars value={entry.rating} size={11} />}
            <span title={entry.createdAt}>· {entry.createdAgo || entry.createdAt}</span>
            {entry.pageUrl && <Link to={entry.pageUrl} className="inline-flex items-center gap-0.5 font-semibold text-[var(--accent-strong)] hover:underline">{entry.pageUrl}<ArrowUpRight size={11} /></Link>}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ink)]">{entry.message}</p>
        </div>
        <select aria-label="Status" value={entry.status} onChange={(event) => setFeedbackStatus.mutate({ id: entry.id, status: event.target.value })} className={selectClass}>
          {statuses.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
    </Panel>)}
  </div>
}
