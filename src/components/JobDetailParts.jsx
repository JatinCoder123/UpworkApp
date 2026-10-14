import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowClockwise, Briefcase, Check, Clock, Copy, CurrencyDollar, FileText, Hourglass, SealCheck, Star, Target, User, Users, WarningCircle } from '@phosphor-icons/react'
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

export function FactTile({ icon: Icon, label, value, note }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-2xl bg-[var(--paper)] p-3.5">
    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]/70"><Icon size={16} weight="bold" /></span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold" title={value}>{value || '—'}</p>
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

export function CoverLetter({ job, onLetter }) {
  const [copied, copy] = useCopied()
  const fetchLetter = useMutation({ mutationFn: () => api.getCoverLetter(job), onSuccess: onLetter })
  const action = job.coverLetter && <button type="button" onClick={() => copy('letter', job.coverLetter)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)]">{copied === 'letter' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'letter' ? 'Copied' : 'Copy'}</button>

  return <Panel icon={FileText} title="Cover letter" subtitle={job.coverLetter ? 'Tailored for this job' : 'Not written yet'} action={action}>
    {job.coverLetter
      ? <div className="rounded-2xl bg-[var(--paper)] p-5"><ExpandableText collapsedHeight="9rem" fade="var(--paper)"><p className="whitespace-pre-wrap break-words text-sm leading-7">{job.coverLetter}</p></ExpandableText></div>
      : <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-[var(--line)] p-5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{fetchLetter.isPending ? 'Writing a cover letter…' : 'Get a tailored cover letter'}</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{fetchLetter.isPending ? 'This usually takes a few seconds.' : 'Generated from the job description and your skills.'}</p>
          {fetchLetter.isError && <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{fetchLetter.error?.message}</p>}
        </div>
        <button type="button" disabled={fetchLetter.isPending} onClick={() => fetchLetter.mutate()} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white transition-opacity disabled:opacity-60">
          {fetchLetter.isPending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ArrowClockwise size={14} />}
          {fetchLetter.isPending ? 'Fetching…' : fetchLetter.isError ? 'Try again' : 'Fetch cover letter'}
        </button>
      </div>}
  </Panel>
}
