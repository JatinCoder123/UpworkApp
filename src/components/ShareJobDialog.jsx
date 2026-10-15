import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowSquareOut, Check, CheckCircle, Copy, EnvelopeSimple, MagnifyingGlass, MicrosoftTeamsLogo, UsersThree, WarningCircle } from '@phosphor-icons/react'
import { DialogHeader, Modal } from './ui'
import { useCopied } from './JobDetailParts'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { jobShareLink } from '../lib/jobSignals'

const defaultMessage = (job) => [
  `Job worth a look: ${job.title}`,
  [job.type, job.budget, job.level !== 'Not specified' && job.level].filter(Boolean).join(' · '),
  job.clientStats?.country && `Client: ${job.clientStats.country}${job.clientStats.paymentVerified ? ' (payment verified)' : ''}`,
  job.match > 0 && `AI match: ${job.match}%`,
  jobShareLink(job),
].filter(Boolean).join('\n')

const teamsShareUrl = (href, text) => `https://teams.microsoft.com/share?href=${encodeURIComponent(href)}&msgText=${encodeURIComponent(text)}&preview=true`
const teamsChatUrl = (emails, topic, text) => `https://teams.microsoft.com/l/chat/0/0?users=${emails.map(encodeURIComponent).join(',')}${emails.length > 1 ? `&topicName=${encodeURIComponent(topic.slice(0, 120))}` : ''}&message=${encodeURIComponent(text)}`

/** mode: 'teams' shares the job in any Teams chat, 'notify' messages chosen teammates directly. */
export default function ShareJobDialog({ job, mode: initialMode = 'teams', onClose }) {
  const { user } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [message, setMessage] = useState(() => defaultMessage(job))
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [copied, copy] = useCopied()
  const { data: members = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ['team-members'], queryFn: api.getTeamMembers, enabled: mode === 'notify', staleTime: 10 * 60_000 })
  const self = String(user?.email || '').toLowerCase()
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return members.filter((member) => member.email.toLowerCase() !== self && (!term || `${member.name} ${member.email} ${member.title}`.toLowerCase().includes(term)))
  }, [members, query, self])
  const toggle = (email) => setSelected((current) => (current.includes(email) ? current.filter((item) => item !== email) : [...current, email]))
  const tab = (value) => `flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${mode === value ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer')

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow="Share job" title={mode === 'teams' ? 'Share in Teams chat' : 'Notify your team'} onClose={onClose} />
    <div className="mt-6 flex gap-1 rounded-full bg-[var(--paper)] p-1">
      <button type="button" aria-pressed={mode === 'teams'} onClick={() => setMode('teams')} className={tab('teams')}><MicrosoftTeamsLogo size={15} weight="fill" />Share in Teams</button>
      <button type="button" aria-pressed={mode === 'notify'} onClick={() => setMode('notify')} className={tab('notify')}><UsersThree size={15} weight="bold" />Notify team</button>
    </div>

    <div className="mt-5 rounded-2xl bg-[var(--paper)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">{job.status === 'Live' ? 'Live Upwork job' : job.company}</p><p className="mt-1 text-sm font-semibold">{job.title}</p></div>

    <div className="mt-5 flex items-center justify-between"><label htmlFor="share-message" className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Message</label><button type="button" onClick={() => copy('message', message)} className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">{copied === 'message' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'message' ? 'Copied' : 'Copy'}</button></div>
    <textarea id="share-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="mt-2 w-full resize-y rounded-2xl bg-[var(--paper)] p-4 text-sm leading-6 outline-none ring-1 ring-black/5 focus:ring-[var(--lime-dark)]" />

    {mode === 'teams'
      ? <>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Opens Microsoft Teams, where you pick the chat or channel to post this job in.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)]">Cancel</button>
          <button type="button" disabled={!message.trim()} onClick={() => open(teamsShareUrl(jobShareLink(job), message.trim()))} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4b53bc] px-5 py-3 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"><MicrosoftTeamsLogo size={16} weight="fill" />Share in Teams<ArrowSquareOut size={14} /></button>
        </div>
      </>
      : <>
        <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Teammates{selected.length > 0 && <span className="ml-2 rounded-full bg-[var(--lime)] px-1.5 py-0.5 text-[#26320b]">{selected.length}</span>}</p>{selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear</button>}</div>
        <label className="mt-2 flex items-center gap-2 rounded-full bg-[var(--paper)] px-4 py-2.5 ring-1 ring-black/5 focus-within:ring-[var(--lime-dark)]"><MagnifyingGlass size={14} className="text-[var(--muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" aria-label="Search teammates" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl ring-1 ring-[var(--line)] [scrollbar-width:thin]">
          {isLoading ? <div className="space-y-2 p-3">{[0, 1, 2].map((item) => <span key={item} className="skeleton-bone block h-10 rounded-xl" />)}</div>
            : isError ? <p role="alert" className="flex items-start gap-2 p-4 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">{error?.message || 'Could not load teammates.'}</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Retry</button></p>
              : visible.length ? visible.map((member) => {
                const active = selected.includes(member.email)
                return <button key={member.id} type="button" aria-pressed={active} onClick={() => toggle(member.email)} className={`flex w-full items-center gap-3 border-b border-[var(--line)]/60 px-3 py-2.5 text-left last:border-0 transition-colors ${active ? 'bg-[var(--lime)]/25' : 'hover:bg-[var(--paper)]'}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[10px] font-bold text-white">{member.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{member.name}</span><span className="block truncate text-[11px] text-[var(--muted)]">{[member.title, member.email].filter(Boolean).join(' · ')}</span></span>
                  {active && <CheckCircle size={17} weight="fill" className="shrink-0 text-[var(--accent-strong)]" />}
                </button>
              }) : <p className="p-4 text-center text-xs text-[var(--muted)]">{query ? 'No teammate matches that search.' : 'No teammates found.'}</p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Opens a Teams chat with the selected teammates and this message ready to send.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)]">Cancel</button>
          <button type="button" disabled={!selected.length || !message.trim()} onClick={() => { window.location.href = `mailto:${selected.join(',')}?subject=${encodeURIComponent(`Job: ${job.title}`)}&body=${encodeURIComponent(message.trim())}` }} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)] disabled:opacity-50"><EnvelopeSimple size={15} />Email instead</button>
          <button type="button" disabled={!selected.length || !message.trim()} onClick={() => open(teamsChatUrl(selected, job.title, message.trim()))} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4b53bc] px-5 py-3 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"><MicrosoftTeamsLogo size={16} weight="fill" />Notify in Teams<ArrowSquareOut size={14} /></button>
        </div>
      </>}
  </Modal>
}
