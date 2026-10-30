import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowClockwise, Briefcase, Check, Clock, Copy, CurrencyDollar, Eye, FilePdf, FileText, FloppyDisk, Hourglass, Lightbulb, PencilSimple, Quotes, SealCheck, Sparkle, Star, Target, User, Users, WarningCircle } from '@phosphor-icons/react'
import DownloadButton from './DownloadButton'
import ExpandableText from './ExpandableText'
import { GenerateProgress, StageChip } from './GenerateOutput'
import { api } from '../services/api'
import { initDocSocket, subscribeDocStatus } from '../services/docSocket'
import { STAGES, isRunning, stageOf } from '../lib/generation'
import { asObject, asText } from '../lib/safe'
import { timeAgo, useNow } from '../lib/time'
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
    {accent && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lime-tint)]/25 to-transparent" />}
    <header className="relative flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--lime-tint)]/30 text-[var(--accent-strong)]"><Icon size={17} weight="duotone" /></span>
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
    return <span key={index} className="relative inline-block size-4"><Star size={16} weight="fill" className="absolute inset-0 text-black/[.12] dark:text-white/15" /><span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star size={16} weight="fill" className="text-star" /></span></span>
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
        // A client new to Upwork has no rating yet, so the rating's place says so plainly.
        : stats.isNew
          ? <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--warn-bg)] text-[var(--warn)]"><Sparkle size={18} weight="fill" /></span><p className="text-base font-semibold leading-tight">New client</p></div>
          : <p className="text-sm text-[var(--muted)]">No reviews yet</p>}
      <div className="flex flex-wrap gap-2">
        <Verified ok={stats.paymentVerified}>{stats.paymentVerified ? 'Payment verified' : 'Payment not verified'}</Verified>
        {stats.phoneVerified != null && <Verified ok={stats.phoneVerified}>{stats.phoneVerified ? 'Phone verified' : 'Phone not verified'}</Verified>}
        {stats.isNew && rating != null && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--warn)]"><Sparkle size={13} weight="fill" />New client</span>}
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
// Quick picks for a PDF regenerate suggestion.
const PDF_SUGGESTION_PICKS = [
  'Keep it to one page',
  'Use a more formal tone',
  'Highlight relevant past projects',
  'Add a clear project timeline',
  'Add a cost breakdown',
  'End with a clear call to action',
]
// A "completed" event can come just before the CRM is saved; then the job is read once more this much later.
const RECHECK_MS = 3000
// What a doc-status event's type ("type" in the socket payload) says for each output kept on the job.
const OUTPUT_TYPES = { coverLetterGeneration: 'cover', pdfGeneration: 'pdf' }
const pill = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--line)] transition-colors disabled:pointer-events-none disabled:opacity-45'

// Activity entries a cover letter change records; JobActivity shows them as "<user> generated the cover letter" etc.
export const COVER_LETTER_ACTIVITY = {
  generated: 'Cover letter generated',
  written: 'Cover letter written',
  edited: 'Cover letter edited',
  regenerated: 'Cover letter regenerated',
}
// Activity entries the job's PDF records, the same way.
const PDF_ACTIVITY = {
  generated: 'PDF generated',
  regenerated: 'PDF regenerated',
}

/**
 * While a job's output (its cover letter or PDF: `field` on the job) is being made, the backend's WebSocket moves it on
 * (the doc-status events AppScript follows); the page does not ask the CRM on a timer. An event for this job and output
 * sets its status in place, with no CRM read, and an event that repeats the status changes nothing. The CRM is read only
 * when it is completed (for the new letter, or the PDF's links when the event did not bring them) and when the socket
 * comes back after a drop, for an event missed meanwhile.
 */
function useJobGenerationWatch(jobId, field, running) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!running) return undefined
    const key = ['job', jobId]
    let stopped = false
    let dropped = false
    const timers = new Set()
    const current = () => asObject(queryClient.getQueryData(key)?.[field])
    const patch = (changes) => queryClient.setQueryData(key, (data) => (data ? { ...data, [field]: { ...asObject(data[field]), ...changes } } : data))
    // One read of the job; when an event said `status` but the CRM does not show it yet, one more a moment later.
    const read = async (status) => {
      await queryClient.invalidateQueries({ queryKey: key })
      if (stopped || !status || current().status === status) return
      const timer = window.setTimeout(() => { timers.delete(timer); queryClient.invalidateQueries({ queryKey: key }) }, RECHECK_MS)
      timers.add(timer)
    }
    // Names this job, and is not about its other output (an event without a known type counts for both).
    const ours = (event) => {
      const values = [event.contentId, event.noteId, ...Object.values(asObject(event.raw))].map((value) => String(value ?? ''))
      const type = String(event.raw?.type || event.raw?.doc_type || '').toLowerCase()
      const known = Object.values(OUTPUT_TYPES).filter((name) => type.includes(name))
      return values.includes(jobId) && (!known.length || known.includes(OUTPUT_TYPES[field]))
    }
    const unsubscribe = subscribeDocStatus((event) => {
      if (!ours(event) || !STAGES.includes(event.status) || event.status === current().status) return
      if (event.status !== 'completed') { patch({ status: event.status }); return }
      if (field === 'pdfGeneration' && event.viewUrl && event.documentUrl) { patch({ status: 'completed', viewUrl: event.viewUrl, downloadUrl: event.documentUrl }); return }
      read('completed')
    })
    const socket = initDocSocket()
    const drop = () => { dropped = true }
    const catchUp = () => { if (dropped) { dropped = false; read() } }
    socket.on('disconnect', drop)
    socket.on('connect', catchUp)
    return () => {
      stopped = true
      unsubscribe()
      socket.off('disconnect', drop)
      socket.off('connect', catchUp)
      timers.forEach(window.clearTimeout)
    }
  }, [running, jobId, field, queryClient])
}

// The box Regenerate opens: what should change (typed, or quick picks added one per line), then `onSubmit`.
function SuggestionBox({ question, placeholder, picks, submitLabel, value, onChange, onCancel, onSubmit }) {
  return <form onSubmit={onSubmit} className="mt-4 rounded-2xl bg-[var(--lime-tint)]/[.12] p-4 ring-1 ring-[var(--lime-dark)]/25">
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)]"><Sparkle size={14} weight="fill" />{question}</span>
      <textarea autoFocus rows={3} maxLength={2000} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full resize-y rounded-xl bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-[var(--lime-dark)]" />
    </label>
    <div className="mt-2 flex flex-wrap gap-1.5">{picks.map((item) => <button key={item} type="button" onClick={() => onChange(value.trim() ? `${value.trim()}\n${item}` : item)} className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]">{item}</button>)}</div>
    <div className="mt-3 flex items-center justify-end gap-2">
      <button type="button" onClick={onCancel} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}>Cancel</button>
      <button type="submit" disabled={!value.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-45"><ArrowClockwise size={13} weight="bold" />{submitLabel}</button>
    </div>
  </form>
}

/**
 * The job's cover letter. Without one: fetch it or write your own. With one: read it, copy it, edit it,
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
  // While the generator writes the new letter, the WebSocket says when the job changes.
  useJobGenerationWatch(job.id, 'coverLetterGeneration', running)
  const startRegenerate = (event) => {
    event.preventDefault()
    const text = request.trim()
    if (!text) return
    setRequest(null)
    // If it cannot be saved, the box opens again with what was written.
    regenerate.mutate(text, { onError: () => setRequest(text) })
  }
  // Edit and Regenerate: once there is a letter, while nothing else is changing it.
  const changeable = Boolean(job.coverLetter) && !editing && !running && !save.isPending && request === null

  const action = <div className="flex flex-wrap justify-end gap-2">
    {current && <button type="button" onClick={() => copy('letter', current)} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}>{copied === 'letter' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'letter' ? 'Copied' : 'Copy'}</button>}
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
    {request !== null && <SuggestionBox question="What should change in the cover letter?" placeholder="e.g. Make it shorter and mention our Shopify work" picks={SUGGESTION_PICKS} submitLabel="Regenerate cover letter" value={request} onChange={setRequest} onCancel={() => setRequest(null)} onSubmit={startRegenerate} />}
    {running && <div className="mt-4 rounded-2xl bg-[var(--paper)] p-4">
      <GenerateProgress stage={stage} name="cover letter" />
      {generation.suggestion && <p className="mt-2 flex gap-1.5 text-xs leading-5 text-[var(--muted)]"><Quotes size={12} weight="fill" className="mt-0.5 shrink-0" /><span className="min-w-0 whitespace-pre-wrap break-words">{generation.suggestion}</span></p>}
    </div>}
    {stage === 'failed' && request === null && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />The cover letter could not be regenerated this time. Regenerate it again, maybe with another suggestion.</p>}
    {regenerate.isError && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{regenerate.error?.message || 'It could not be started. Please try again.'}</p>}
  </Panel>
}

// The PDF's file tile; red-tinted like a PDF, pulsing while it is made, in the failed colours when it could not be.
function PdfTile({ busy = false, failed = false }) {
  return <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ring-1 ring-[var(--line)]/70 ${failed ? 'bg-danger-bg text-danger' : 'bg-tone-rose-bg text-tone-rose'}`}>
    <FilePdf size={24} weight="duotone" className={busy ? 'animate-pulse' : ''} />
  </span>
}

const pdfFileName = (title) => `${String(title || 'job').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'job'}.pdf`

/**
 * The job's PDF (CRM jobs). Generate PDF ticks generate_pdf with "queued" on the job; the CRM generator makes it and the
 * steps show here as the WebSocket reports them; once completed it can be viewed or downloaded. Regenerate first asks
 * what should change (a suggestion, typed or picked) and the generator makes a new one; the last PDF stays, faded,
 * until the new one is ready.
 */
export function JobPdf({ job }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const now = useNow()
  // The regenerate suggestion being written; null while its box is closed.
  const [request, setRequest] = useState(null)
  const pdf = asObject(job.pdfGeneration)
  const stage = stageOf(pdf)
  const running = isRunning(stage)
  const hasFile = Boolean(pdf.viewUrl || pdf.downloadUrl)
  // Shown as queued straight away, put back if it cannot be saved.
  const generate = useMutation({
    mutationFn: ({ suggestion, activity }) => api.generateJobPdf(job, suggestion, { userEmail: user?.email, activity }),
    onMutate: async ({ suggestion }) => {
      // A read already on its way would bring back the old status.
      await queryClient.cancelQueries({ queryKey: ['job', job.id] })
      queryClient.setQueryData(['job', job.id], (data) => (data ? { ...data, pdfGeneration: { ...asObject(data.pdfGeneration), requested: true, status: 'queued', suggestion } } : data))
      return { before: job.pdfGeneration }
    },
    onError: (_, __, context) => queryClient.setQueryData(['job', job.id], (data) => (data ? { ...data, pdfGeneration: context?.before } : data)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job-activity', job.id] }),
  })
  useJobGenerationWatch(job.id, 'pdfGeneration', running)
  // The first PDF (or another try after a failed one) starts straight away, without a suggestion box.
  const start = () => generate.mutate({ suggestion: stage === 'failed' ? pdf.suggestion || '' : '', activity: hasFile ? PDF_ACTIVITY.regenerated : PDF_ACTIVITY.generated })
  const startRegenerate = (event) => {
    event.preventDefault()
    const text = request.trim()
    if (!text) return
    setRequest(null)
    // If it cannot be saved, the box opens again with what was written.
    generate.mutate({ suggestion: text, activity: PDF_ACTIVITY.regenerated }, { onError: () => setRequest(text) })
  }
  const canRegenerate = (hasFile || stage === 'failed') && !running && !generate.isPending && request === null

  const action = canRegenerate && <button type="button" onClick={() => { generate.reset(); setRequest('') }} title="Regenerate the PDF with your suggestion" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"><ArrowClockwise size={13} weight="bold" />Regenerate</button>
  const subtitle = running ? (stage === 'queued' ? 'Queued · waiting for the generator…' : pdf.suggestion ? 'Regenerating with your suggestion…' : 'Generating…')
    : stage === 'failed' ? 'Could not be generated this time'
      : hasFile ? (pdf.suggestion ? 'Regenerated with your suggestion · saved in CRM' : 'Ready to view or download · saved in CRM')
        : 'Not generated yet'
  const button = 'inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-transform hover:-translate-y-0.5'

  return <Panel icon={FilePdf} title="PDF" subtitle={subtitle} action={action}>
    {hasFile
      // The file: View opens it in a new tab, Download saves it. While a new one is made it stays, faded.
      ? <div aria-busy={running} className={`flex flex-col gap-4 rounded-2xl bg-[var(--paper)] p-4 transition-opacity duration-300 sm:flex-row sm:items-center ${running ? 'opacity-60' : ''}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <PdfTile />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" title={job.title}>{job.title}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">{running ? 'Previous version · replaced when the new one is ready' : <><StageChip stage="completed" />{stage === 'completed' && timeAgo(pdf.statusAt, now) ? `Generated ${timeAgo(pdf.statusAt, now).toLowerCase()}` : 'PDF'} · saved in CRM</>}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold">
          {pdf.viewUrl && <a href={pdf.viewUrl} target="_blank" rel="noopener noreferrer" className={`${button} bg-[var(--lime)] text-[var(--on-lime)]`}><Eye size={15} weight="bold" />View PDF</a>}
          {pdf.downloadUrl && <DownloadButton url={pdf.downloadUrl} filename={pdfFileName(job.title)} iconSize={15} className={`${button} bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)] disabled:opacity-70`} />}
        </div>
      </div>
      : !running && <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-[var(--line)] p-5 sm:flex-row sm:items-center">
        <PdfTile failed={stage === 'failed'} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{stage === 'failed' ? 'The PDF could not be generated' : stage === 'completed' ? 'The PDF has no links yet' : 'Generate a PDF for this job'}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{stage === 'failed' ? 'Try again, or use Regenerate to tell the generator what to change.' : stage === 'completed' ? 'It is marked ready, but its view and download links are not in the CRM. Generate it again.' : 'Made from the job details. View or download it here once it is ready.'}</p>
        </div>
        <button type="button" disabled={generate.isPending} onClick={start} className={`${button} shrink-0 bg-[var(--ink)] text-white disabled:opacity-60`}>
          {stage === 'idle' ? <FilePdf size={15} weight="bold" /> : <ArrowClockwise size={14} weight="bold" />}
          {stage === 'idle' ? 'Generate PDF' : 'Try again'}
        </button>
      </div>}

    {request !== null && <SuggestionBox question="What should change in the PDF?" placeholder="e.g. Keep it to one page and add a project timeline" picks={PDF_SUGGESTION_PICKS} submitLabel="Regenerate PDF" value={request} onChange={setRequest} onCancel={() => setRequest(null)} onSubmit={startRegenerate} />}
    {running && <div className={`rounded-2xl bg-[var(--paper)] p-4 ${hasFile ? 'mt-4' : ''}`}>
      {!hasFile && <div className="flex items-center gap-3.5">
        <PdfTile busy />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{stage === 'queued' ? 'Your PDF is in the queue' : 'Your PDF is being generated'}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">It is made in the CRM, so you can leave this page meanwhile.</p>
        </div>
      </div>}
      <GenerateProgress stage={stage} name="PDF" />
      {pdf.suggestion && <p className="mt-2 flex gap-1.5 text-xs leading-5 text-[var(--muted)]"><Quotes size={12} weight="fill" className="mt-0.5 shrink-0" /><span className="min-w-0 whitespace-pre-wrap break-words">{pdf.suggestion}</span></p>}
    </div>}
    {stage === 'failed' && hasFile && request === null && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />The new PDF could not be generated this time. Regenerate it again, maybe with another suggestion.</p>}
    {generate.isError && <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{generate.error?.message || 'It could not be started. Please try again.'}</p>}
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
