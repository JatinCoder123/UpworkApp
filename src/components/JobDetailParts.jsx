import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowClockwise, Briefcase, ChartBar, Check, Clock, Copy, CurrencyDollar, FileText, FloppyDisk, Hourglass, IdentificationCard, MagicWand, PencilSimple, SealCheck, Sparkle, Star, Target, User, UserFocus, Users, WarningCircle, X } from '@phosphor-icons/react'
import ExpandableText from './ExpandableText'
import { api } from '../services/api'

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

export function Panel({ icon: Icon, title, subtitle, action, children }) {
  return <section data-detail className={card}>
    <header className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--lime)]/30 text-[var(--accent-strong)]"><Icon size={17} weight="duotone" /></span>
        <div><h2 className="text-base font-semibold tracking-[-.015em]">{title}</h2>{subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}</div>
      </div>
      {action}
    </header>
    <div className="mt-5">{children}</div>
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

export function AboutClient({ stats, now }) {
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
      {stats.rating != null
        ? <div className="flex items-center gap-3" aria-label={`Rating is ${stats.rating.toFixed(1)} out of 5`}><span className="text-3xl font-semibold leading-none tracking-[-.04em]">{stats.rating.toFixed(1)}</span><div><Stars rating={stats.rating} /><p className="mt-1 text-[11px] text-[var(--muted)]">{stats.reviews != null ? `${stats.rating.toFixed(2)} of ${count(stats.reviews, 'review')}` : 'Client rating'}</p></div></div>
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

const AI_SUGGESTIONS = [
  'Make it shorter and punchier',
  'Use a more confident tone',
  'Open with the client’s main problem',
  'Highlight relevant past projects',
  'End with a clear call to action',
  'Add one smart question for the client',
]

export function CoverLetter({ job, onLetter }) {
  const [copied, copy] = useCopied()
  const [draft, setDraft] = useState(null)
  const [instruction, setInstruction] = useState('')
  const [suggestion, setSuggestion] = useState(null)
  const editing = draft != null
  const current = editing ? draft : job.coverLetter || ''
  const fetchLetter = useMutation({ mutationFn: () => api.getCoverLetter(job), onSuccess: onLetter })
  const save = useMutation({ mutationFn: (letter) => api.saveCoverLetter(job, letter), onSuccess: (letter) => { onLetter(letter); setDraft(null) } })
  const aiEdit = useMutation({ mutationFn: (prompt) => api.editCoverLetter(job, current, prompt), onSuccess: (letter, prompt) => setSuggestion({ letter, prompt }) })
  const runAi = (prompt) => { const value = prompt.trim(); if (value && current.trim() && !aiEdit.isPending) aiEdit.mutate(value) }
  const accept = () => { setDraft(suggestion.letter); setSuggestion(null); setInstruction('') }
  const pill = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-[var(--line)] transition-colors disabled:pointer-events-none disabled:opacity-45'

  const action = <div className="flex flex-wrap justify-end gap-2">
    {current && <button type="button" onClick={() => copy('letter', current)} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}>{copied === 'letter' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'letter' ? 'Copied' : 'Copy'}</button>}
    {job.coverLetter && !editing && <button type="button" onClick={() => setDraft(job.coverLetter)} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}><PencilSimple size={13} />Edit</button>}
  </div>

  return <Panel icon={FileText} title="Cover letter" subtitle={editing ? 'Editing · changes are not saved yet' : job.coverLetter ? 'Tailored for this job' : 'Not written yet'} action={action}>
    {editing
      ? <div className="space-y-3">
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={12} aria-label="Cover letter" className="w-full resize-y rounded-2xl bg-[var(--paper)] p-5 text-sm leading-7 outline-none ring-1 ring-[var(--line)] focus:ring-[var(--lime-dark)]" />
        {save.isError && <p role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{save.error?.message}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => { setDraft(null); setSuggestion(null); save.reset() }} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}>Cancel</button>
          <button type="button" disabled={!draft.trim() || save.isPending || draft === job.coverLetter} onClick={() => save.mutate(draft.trim())} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-50">{save.isPending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <FloppyDisk size={14} />}{save.isPending ? 'Saving…' : 'Save letter'}</button>
        </div>
      </div>
      : job.coverLetter
        ? <div className="rounded-2xl bg-[var(--paper)] p-5"><ExpandableText collapsedHeight="9rem" fade="var(--paper)"><p className="whitespace-pre-wrap break-words text-sm leading-7">{job.coverLetter}</p></ExpandableText></div>
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

    {current.trim() && <div className="mt-4 rounded-2xl bg-[var(--lime)]/[.12] p-4 ring-1 ring-[var(--lime-dark)]/25">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)]"><Sparkle size={14} weight="fill" />Edit with AI</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{AI_SUGGESTIONS.map((item) => <button key={item} type="button" disabled={aiEdit.isPending} onClick={() => { setInstruction(item); runAi(item) }} className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] hover:ring-[var(--lime-dark)] disabled:opacity-50">{item}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); runAi(instruction) }} className="mt-3 flex items-center gap-2 rounded-full bg-[var(--surface)] py-1 pl-4 pr-1 ring-1 ring-[var(--line)] focus-within:ring-[var(--lime-dark)]">
        <MagicWand size={14} className="shrink-0 text-[var(--muted)]" />
        <input value={instruction} disabled={aiEdit.isPending} onChange={(event) => setInstruction(event.target.value)} placeholder="Tell AI what to change, e.g. mention our Shopify work" aria-label="AI edit instruction" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
        <button type="submit" disabled={!instruction.trim() || aiEdit.isPending} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 text-[11px] font-semibold text-white disabled:opacity-45">{aiEdit.isPending ? <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Sparkle size={12} weight="fill" />}{aiEdit.isPending ? 'Rewriting…' : 'Edit with AI'}</button>
      </form>
      {aiEdit.isError && <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{aiEdit.error?.message}</p>}
      {suggestion && <div className="mt-4 rounded-2xl bg-[var(--surface)] p-4 ring-1 ring-[var(--line)]">
        <p className="text-[11px] font-semibold text-[var(--muted)]">AI suggestion · “{suggestion.prompt}”</p>
        <ExpandableText className="mt-2" collapsedHeight="9rem"><p className="whitespace-pre-wrap break-words text-sm leading-7">{suggestion.letter}</p></ExpandableText>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => setSuggestion(null)} className={`${pill} text-[var(--muted)] hover:text-[var(--ink)]`}><X size={13} />Discard</button>
          <button type="button" onClick={accept} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--lime)] px-4 text-xs font-bold text-[#26320b] ring-1 ring-[var(--lime-dark)]/40"><Check size={13} weight="bold" />Use suggestion</button>
        </div>
      </div>}
    </div>}
  </Panel>
}

const median = (values) => (values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : null)

// Practical profile tweaks for this job, derived from its skills, category and budget.
export function ProfileSuggestions({ job }) {
  const skills = (job.skills?.length ? job.skills : job.tags || []).filter((skill) => skill && skill !== 'General')
  const top = skills.slice(0, 2)
  const category = job.tags?.find((tag) => tag && tag !== 'General') || ''
  const amounts = String(job.budget || '').match(/\d[\d,.]*/g)?.map((value) => Number(value.replace(/,/g, ''))).filter((value) => Number.isFinite(value) && value > 0) || []
  const hourly = job.type === 'Hourly'
  const rate = hourly ? median(amounts) : null
  const items = [
    top.length > 0 && [IdentificationCard, 'Headline to lead with', `${top.join(' & ')} specialist${category ? ` for ${category}` : ''}`],
    category && [Briefcase, 'Specialized profile', `Apply with your ${category} profile so the portfolio matches this job`],
    skills.length > 0 && [Target, 'Skills to pin first', skills.slice(0, 6).join(', ')],
    rate && [CurrencyDollar, 'Rate to show', `Around $${Math.round(rate)}/hr keeps you inside the ${job.budget} range`],
    !hourly && amounts.length > 0 && [CurrencyDollar, 'Bid guidance', `Quote close to ${job.budget} and split it into milestones`],
    job.level && job.level !== 'Not specified' && [ChartBar, 'Experience signal', job.level === 'Expert' ? 'Feature 2–3 detailed case studies with measurable results' : /entry/i.test(job.level) ? 'Keep it simple; quick turnaround and price matter most' : 'Show one closely related project with a clear outcome'],
  ].filter(Boolean)
  if (!items.length) return null
  return <Panel icon={UserFocus} title="Profile suggestions" subtitle="Based on this job’s skills, category and budget">
    <ul className="grid gap-3 sm:grid-cols-2">{items.map(([icon, label, value]) => <li key={label} className="min-w-0"><FactTile icon={icon} label={label} value={value} wrap /></li>)}</ul>
  </Panel>
}
