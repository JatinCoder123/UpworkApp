import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowClockwise, Briefcase, Check, Clock, Copy, CurrencyDollar, FilePdf, FileText, FloppyDisk, Hourglass, Lightbulb, PencilSimple, Quotes, SealCheck, Sparkle, Star, Target, User, Users, WarningCircle } from '@phosphor-icons/react'
import ExpandableText from './ExpandableText'
import { GenerateProgress } from './GenerateOutput'
import { api } from '../services/api'
import { initDocSocket, subscribeDocStatus } from '../services/docSocket'
import { downloadCoverLetterPdf } from '../lib/coverLetterPdf'
import { isRunning, stageOf } from '../lib/generation'
import { asObject, asText } from '../lib/safe'
import { useAuth } from '../contexts/AuthContext'

// Building blocks shared by the CRM job detail and the live Upwork job detail.
export const card = 'rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 sm:p-7'

export function LinkifiedDescription({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part
    const url = part.replace(/[),.;]+$/, '')
    const suffix = part.slice(url.length)
    return <span key={`${url}-${index}`}><a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent-strong)] underline decoration-current/30 underline-offset-4">{url}</a>{suffix}</span>
  })
}

// `accent` adds the same lime wash the job header uses, for sections that should stand out.
export function Panel({ icon: Icon, title, subtitle, action, accent = false, children }) {
  return <section data-detail className={`${card} relative overflow-hidden`}>
    {accent && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lime)]/25 to-transparent" />}
    <header className="relative flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--lime)]/30 text-[var(--accent-strong)]"><Icon size={17} weight="duotone" /></span>
        <div><h2 className="text-base font-semibold tracking-[-.015em]">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}</div>
      </div>
      {action}
    </header>
    <div className="relative mt-5">{children}</div>
  </section>
}

export function FactTile({ icon: Icon, label, value, note, wrap = false }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-[var(--paper)] p-3.5">
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]/70"><Icon size={16} weight="bold" /></span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-[var(--muted)]">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${wrap ? 'leading-5' : 'truncate'}`} title={wrap ? undefined : value}>{value || '—'}</p>
      {note && <p className="truncate text-[11px] text-[var(--muted)]" title={note}>{note}</p>}
    </div>
  </div>
}

function Stars({ rating }) {
  return <span className="flex items-center gap-0.5" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => {
    const fill = Math.max(0, Math.min(1, rating - index))
    return <span key={index} className="relative inline-block size-4"><Star size={16} weight="fill" className="absolute inset-0 text-black/[.12] dark:text-white/15" /><span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star size={16} weight="fill" className="text-[#e6a817]" /></span></span>
  })}</span>
}

function localTime(timezone, now) {
  if (!timezone) return ''
  try { return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(now) } catch { return '' }
}

function Verified({ ok, children }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ok ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}><SealCheck size={13} weight="fill" />{children}</span>
}

export function AboutClient({ stats: clientStats, now }) {
  const stats = asObject(clientStats), rating = stats.rating == null ? null : Number(stats.rating)
  const count = (value, word) => `${value.toLocaleString()} ${word}${value === 1 ? '' : 's'}`
  const place = [stats.city, localTime(stats.timezone, now)].filter(Boolean).join(' · ')
  const items = [
    stats.jobsPosted != null && [Briefcase, 'Jobs posted', count(stats.jobsPosted, 'job'), [stats.hireRate && `${stats.hireRate} hire rate`, stats.openJobs != null && `${stats.openJobs} open`].filter(Boolean).join(', ')],
    stats.totalSpent && [CurrencyDollar, 'Total spent', stats.totalSpent, ''],
    stats.hires != null && [Users, 'Hires', count(stats.hires, 'hire'), stats.activeHires != null ? `${stats.activeHires} active` : ''],
    stats.avgHourlyRate && [Clock, 'Avg hourly rate paid', `${stats.avgHourlyRate} /hr`, ''],
    stats.totalHours && [Hourglass, 'Hours billed', stats.totalHours, ''],
    stats.proposals != null && [Target, 'Proposals', count(stats.proposals, 'proposal'), 'On this job so far'],
  ].filter(Boolean)

  return <Panel icon={User} title="About the client" subtitle={[stats.companyName, stats.country, place].filter(Boolean).join(' · ') || 'Location not shared'}>
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[var(--paper)] p-4">
      {rating != null
        ? <div className="flex items-center gap-3" aria-label={`Rating is ${rating.toFixed(1)} out of 5`}><span className="text-3xl font-semibold leading-none tracking-[-.04em]">{rating.toFixed(1)}</span><div><Stars rating={rating} /><p className="mt-1 text-[11px] text-[var(--muted)]">{stats.reviews != null ? `${rating.toFixed(2)} of ${count(stats.reviews, 'review')}` : 'Client rating'}</p></div></div>
        : <p className="text-sm text-[var(--muted)]">No reviews yet</p>}
      <div className="flex flex-wrap gap-2">
        <Verified ok={stats.paymentVerified}>{stats.paymentVerified ? 'Payment verified' : 'Payment not verified'}</Verified>
        {stats.phoneVerified != null && <Verified ok={stats.phoneVerified}>{stats.phoneVerified ? 'Phone verified' : 'Phone not verified'}</Verified>}
      </div>
    </div>
    {items.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(([icon, label, value, note]) => <FactTile key={label} icon={icon} label={label} value={value} note={note} />)}</div>}
  </Panel>
}

export function useCopied() {
  const [copied, setCopied] = useState('')
  const copy = async (key, text) => {
    await navigator.clipboard?.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1600)
  }
  return [copied, copy]
}

// Quick picks for a regenerate suggestion: one click adds it to the box.
const SUGGESTION_PICKS = [
  'Make it shorter and punchier',
  'Use a more confident tone',
  'Open with the client’s main problem',
  'Highlight relevant past projects',
  'End with a clear call to action',
  'Add one smart question for the client',
]
// A status event can come just before the CRM is saved; then the job is read once more this much later.
const RECHECK_MS = 3000

// Activity entries a cover letter change records; JobActivity shows them as "<user> generated the cover letter" etc.
export const COVER_LETTER_ACTIVITY = {
  generated: 'Cover letter generated',
  written: 'Cover letter written',
  edited: 'Cover letter edited',
  regenerated: 'Cover letter regenerated',
}

/**
 * The job's cover letter. Without one: fetch it or write your own. With one: read it, copy it, download it, edit it,
 * or Regenerate it with a suggestion (CRM jobs): the suggestion, generate_cover_letter and "queued" are saved on the
 * job, the CRM generator writes the new letter, and the steps show here until it is ready (or failed).
 */
export function CoverLetter({ job, onLetter }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [copied, copy] = useCopied()
  const [draft, setDraft] = useState(null)
  // The regenerate suggestion being written; null while its box is closed.
  const [request, setRequest] = useState(null)
  const editing = draft != null
  const current = editing ? draft : asText(job.coverLetter)
  // Only CRM jobs can regenerate (a live job has no record): where it stands, as an AppScript output.
  const generation = job.coverLetterGeneration
  const stage = stageOf(generation)
  const running = isRunning(stage)
  // Every change made here (fetched, typed) is saved to the CRM job and logged in its activity.
  // The letter sits in the editor while it saves, so a failed save keeps it there with the error and Save to retry.
  const save = useMutation({
    mutationFn: ({ letter, activity }) => api.saveCoverLetter(job, letter, { userEmail: user?.email, activity }),
    onSuccess: (letter) => { onLetter(letter); setDraft(null); queryClient.invalidateQueries({ queryKey: ['job-activity', job.id] }) },
  })
  const commit = (letter, activity) => { const value = asText(letter).trim(); if (!value) return; setDraft(value); save.mutate({ letter: value, activity }) }
  const fetchLetter = useMutation({ mutationFn: () => api.getCoverLetter(job), onSuccess: (letter) => commit(letter, COVER_LETTER_ACTIVITY.generated) })
  // Regenerate: shown as queued straight away, put back if it cannot be saved.
  const regenerate = useMutation({
    mutationFn: (suggestion) => api.regenerateCoverLetter(job, suggestion, { userEmail: user?.email, activity: COVER_LETTER_ACTIVITY.regenerated }),
    onMutate: async (suggestion) => {
      // A read already on its way would bring back the old status.
      await queryClient.cancelQueries({ queryKey: ['job', job.id] })
      queryClient.setQueryData(['job', job.id], (data) => (data ? { ...data, coverLetterGeneration: { requested: true, status: 'queued', suggestion } } : data))
      return { before: generation }
    },
    onError: (_, __, context) => queryClient.setQueryData(['job', job.id], (data) => (data ? { ...data, coverLetterGeneration: context?.before } : data)),
    // The new entry in the job's activity. The letter is not read again here: the WebSocket says when it changes.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-activity', job.id] }),
  })
  // While the generator writes the new letter, the page does not ask the CRM on a timer: it listens to the backend's
  // WebSocket (the doc-status events AppScript follows). An event that names this job reads the job once; so does the
  // socket reconnecting, for an event missed while it was down.
  useEffect(() => {
    if (!running) return undefined
    let stopped = false
    const timers = new Set()
    const read = async (event) => {
      await queryClient.invalidateQueries({ queryKey: ['job', job.id] })
      if (stopped) return
      // The event can come just before the CRM is saved: if the job does not show that status yet, one more read later.
      const status = queryClient.getQueryData(['job', job.id])?.coverLetterGeneration?.status
      if (event?.status && status !== event.status) {
        const timer = window.setTimeout(() => { timers.delete(timer); read() }, RECHECK_MS)
        timers.add(timer)
      }
    }
    const names = (event) => [event.contentId, event.noteId, ...Object.values(asObject(event.raw))].map((value) => String(value ?? '')).includes(job.id)
    const unsubscribe = subscribeDocStatus((event) => { if (names(event)) read(event) })
    const socket = initDocSocket()
    const catchUp = () => read()
    socket.on('connect', catchUp)
    return () => {
      stopped = true
      unsubscribe()
      socket.off('connect', catchUp)
      timers.forEach(window.clearTimeout)
    }
  }, [running, job.id, queryClient])
  const startRegenerate = (event) => {
    event.preventDefault()
    const text = request.trim()
    if (!text) return
    setRequest(null)
    // If it cannot be saved, the box opens again with what was written.
    regenerate.mutate(text, { onError: () => setRequest(text) })
  }
  const pdf = useMutation({ mutationFn: () => downloadCoverLetterPdf(current, job.title) })
  const pill = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--line)] transition-colors disabled:pointer-events-none disabled:opacity-45'
  // Edit and Regenerate: once there is a letter, while nothing else is changing it.
  const changeable = Boolean(job.coverLetter) && !editing && !running && !save.isPending && request === null

  const action = <div className="flex flex-wrap justify-end gap-2">
    {current && <button type="button" onClick={() => copy('letter', current)} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}>{copied === 'letter' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'letter' ? 'Copied' : 'Copy'}</button>}
    {current.trim() && <button type="button" disabled={pdf.isPending} onClick={() => pdf.mutate()} title={pdf.isError ? pdf.error?.message : 'Download as PDF'} className={`${pill} ${pdf.isError ? 'text-[var(--bad)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{pdf.isPending ? <span className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : <FilePdf size={13} />}{pdf.isPending ? 'Generating…' : pdf.isError ? 'Retry PDF' : 'PDF'}</button>}
    {changeable && <button type="button" onClick={() => setDraft(asText(job.coverLetter))} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}><PencilSimple size={13} />Edit</button>}
    {changeable && generation && <button type="button" onClick={() => { regenerate.reset(); setRequest('') }} title="Regenerate the cover letter with your suggestion" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"><ArrowClockwise size={13} weight="bold" />Regenerate</button>}
  </div>
  const subtitle = save.isPending ? 'Saving to CRM…'
    : editing ? 'Editing · changes are not saved yet'
      : running ? 'Regenerating with your suggestion…'
        : !job.coverLetter ? 'Not written yet'
          : stage === 'completed' ? 'Regenerated with your suggestion · saved in CRM' : 'Tailored for this job · saved in CRM'

  return <Panel icon={FileText} title="Cover letter" subtitle={subtitle} action={action}>
    {editing
      ? <div className="space-y-3">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={12} aria-label="Cover letter" className="w-full resize-y rounded-2xl bg-[var(--paper)] p-5 text-sm leading-7 outline-none ring-1 ring-[var(--line)] focus:ring-[var(--lime-dark)]" />
        {save.isError && <p role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{save.error?.message}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => { setDraft(null); save.reset() }} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}>Cancel</button>
          <button type="button" disabled={!draft.trim() || save.isPending || draft === job.coverLetter} onClick={() => commit(draft, job.coverLetter ? COVER_LETTER_ACTIVITY.edited : COVER_LETTER_ACTIVITY.written)} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-50">{save.isPending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <FloppyDisk size={14} />}{save.isPending ? 'Saving…' : 'Save letter'}</button>
        </div>
      </div>
      : job.coverLetter
        ? <div aria-busy={running} className={`rounded-2xl bg-[var(--paper)] p-5 transition-opacity duration-300 ${running ? 'opacity-60' : ''}`}><ExpandableText collapsedHeight="9rem" fade="var(--paper)"><p className="whitespace-pre-wrap break-words text-sm leading-7">{job.coverLetter}</p></ExpandableText></div>
        : <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-[var(--line)] p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{fetchLetter.isPending ? 'Writing a cover letter…' : 'Get a tailored cover letter'}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{fetchLetter.isPending ? 'This usually takes a few seconds.' : 'Generated from the job description and your skills.'}</p>
            {fetchLetter.isError && <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{fetchLetter.error?.message}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" disabled={fetchLetter.isPending} onClick={() => setDraft('')} className={`${pill} h-10 text-[var(--muted)] hover:text-[var(--ink)]`}><PencilSimple size={14} />Write my own</button>
            <button type="button" disabled={fetchLetter.isPending} onClick={() => fetchLetter.mutate()} className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-60">
              {fetchLetter.isPending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ArrowClockwise size={14} />}
              {fetchLetter.isPending ? 'Fetching…' : fetchLetter.isError ? 'Try again' : 'Fetch cover letter'}
            </button>
          </div>
        </div>}

    {/* Regenerate: what should change (typed, or quick picks added), then the generator writes a new letter. */}
    {request !== null && <form onSubmit={startRegenerate} className="mt-4 rounded-2xl bg-[var(--lime)]/[.12] p-4 ring-1 ring-[var(--lime-dark)]/25">
      <label className="block">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)]"><Sparkle size={14} weight="fill" />What should change in the cover letter?</span>
        <textarea autoFocus rows={3} maxLength={2000} value={request} onChange={(event) => setRequest(event.target.value)} placeholder="e.g. Make it shorter and mention our Shopify work" className="mt-2 w-full resize-y rounded-xl bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-[var(--lime-dark)]" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">{SUGGESTION_PICKS.map((item) => <button key={item} type="button" onClick={() => setRequest((text) => (text.trim() ? `${text.trim()}\n${item}` : item))} className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]">{item}</button>)}</div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={() => setRequest(null)} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}>Cancel</button>
        <button type="submit" disabled={!request.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-45"><ArrowClockwise size={13} weight="bold" />Regenerate cover letter</button>
      </div>
    </form>}
    {running && <div className="mt-4 rounded-2xl bg-[var(--paper)] p-4">
      <GenerateProgress stage={stage} name="cover letter" />
      {generation.suggestion && <p className="mt-2 flex gap-1.5 text-xs leading-5 text-[var(--muted)]"><Quotes size={12} weight="fill" className="mt-0.5 shrink-0" /><span className="min-w-0 whitespace-pre-wrap break-words">{generation.suggestion}</span></p>}
    </div>}
    {stage === 'failed' && request === null && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />The cover letter could not be regenerated this time. Regenerate it again, maybe with another suggestion.</p>}
    {regenerate.isError && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{regenerate.error?.message || 'It could not be started. Please try again.'}</p>}
  </Panel>
}

// Bullet lines ("- ", "• ", "* ") read as numbered steps on FactTile-style rows; any other text keeps its line breaks.
function TipPoints({ text }) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.every((line) => /^[-•*]\s+/.test(line))) return <p className="whitespace-pre-wrap break-words rounded-2xl bg-[var(--paper)] p-4 text-sm leading-7">{text}</p>
  return <ol className="grid gap-2">{lines.map((line, index) => <li key={line} className="flex items-start gap-3 rounded-2xl bg-[var(--paper)] p-3.5 text-sm leading-6">
    <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-[var(--surface)] font-mono text-[10px] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--line)]/70">{String(index + 1).padStart(2, '0')}</span>
    <span className="min-w-0 pt-0.5">{line.replace(/^[-•*]\s+/, '')}</span>
  </li>)}</ol>
}

// Proposal tips for a CRM job (stored as its pitch), with a button that asks the strategy endpoint for fresh ones.
export function Tips({ job, onTips }) {
  const generate = useMutation({ mutationFn: () => api.getStrategy(job), onSuccess: onTips })
  const tips = asText(job.pitch)
  const action = <button type="button" disabled={generate.isPending} onClick={() => generate.mutate()} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-60">
    {generate.isPending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Sparkle size={14} weight="fill" />}
    {generate.isPending ? 'Generating…' : 'Next tips'}
  </button>

  return <Panel icon={Lightbulb} title="Tips" subtitle={generate.isPending ? 'Building fresh tips from the job, client and budget…' : 'Points to lead with in the proposal'} action={action} accent>
    {generate.isError && <p role="alert" className="mb-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{generate.error?.message}</p>}
    <div aria-busy={generate.isPending} className={`transition-opacity duration-300 ${generate.isPending ? 'opacity-50' : ''}`}>
      {tips
        ? <ExpandableText collapsedHeight="14rem"><TipPoints text={tips} /></ExpandableText>
        : <div className="rounded-2xl border border-dashed border-[var(--line)] p-5">
          <p className="text-sm font-semibold">No tips yet</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">Use Next tips to generate them from the job description and budget.</p>
        </div>}
    </div>
  </Panel>
}
