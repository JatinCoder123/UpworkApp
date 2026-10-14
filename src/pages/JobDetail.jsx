import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowClockwise, ArrowLeft, ArrowSquareOut, ArrowUpRight, Briefcase, CalendarBlank, Check, Clock, Copy, CreditCard, FileText, Hourglass, MapPin, Phone, SealCheck, Sparkle, Star, Target, Users, WarningCircle } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NotFound from './NotFound'
import { ActionDialog } from '../components/dialogs'
import { primaryButton, StatusPill } from '../components/ui'
import { api } from '../services/api'
import ScoreBreakdown from '../components/ScoreBreakdown'
import JobDetailSkeleton from '../components/JobDetailSkeleton'
import { scoreJob } from '../lib/scoring'
import { timeAgo, useNow } from '../lib/time'

const eyebrow = 'text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]'

function Metric({ label, value, note, last }) { return <div className={`py-4 sm:px-6 ${!last ? 'border-b border-black/[.07] sm:border-b-0 sm:border-r dark:border-white/[.08]' : ''} first:pl-0`}><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{label}</p><p className="mt-2 text-lg font-semibold leading-tight tracking-[-.03em] sm:text-xl">{value}</p>{note && <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-[var(--muted)]">{note}</p>}</div> }

function LinkifiedDescription({ text }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s]+)/g)
  return parts.map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part
    const url = part.replace(/[),.;]+$/, '')
    const suffix = part.slice(url.length)
    return <span key={`${url}-${index}`}><a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#668c16] underline decoration-[#668c16]/35 underline-offset-4 transition-colors hover:text-[var(--lime-dark)]">{url}</a>{suffix}</span>
  })
}

function HeroChip({ icon: Icon, children }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]/80"><Icon size={13} weight="bold" className="text-[var(--accent-strong)]" />{children}</span>
}

function Stars({ rating }) {
  return <span className="flex items-center gap-0.5" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => {
    const fill = Math.max(0, Math.min(1, rating - index))
    return <span key={index} className="relative inline-block size-3.5"><Star size={14} weight="fill" className="absolute inset-0 text-black/[.12] dark:text-white/15" /><span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star size={14} weight="fill" className="text-[#e6a817]" /></span></span>
  })}</span>
}

function localTime(timezone, now) {
  if (!timezone) return ''
  try { return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(now) } catch { return '' }
}

function ClientRow({ icon: Icon, title, detail, tone = 'default' }) {
  const toneClass = tone === 'ok' ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : tone === 'bad' ? 'bg-[var(--bad-bg)] text-[var(--bad)]' : 'bg-[var(--paper)] text-[var(--ink)]'
  return <div className="flex items-start gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-xl ${toneClass}`}><Icon size={15} weight="bold" /></span><div className="min-w-0 pt-0.5"><p className="text-[13px] font-semibold leading-5">{title}</p>{detail && <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">{detail}</p>}</div></div>
}

function AboutClient({ stats }) {
  const now = useNow()
  const time = localTime(stats.timezone, now)
  const place = [stats.city, time].filter(Boolean).join(' · ')
  const count = (value, word) => `${value.toLocaleString()} ${word}${value === 1 ? '' : 's'}`
  const jobsLine = [stats.hireRate && `${stats.hireRate} hire rate`, stats.openJobs != null && count(stats.openJobs, 'open job')].filter(Boolean).join(', ')
  const hiresLine = [stats.hires != null && count(stats.hires, 'hire'), stats.activeHires != null && `${stats.activeHires} active`].filter(Boolean).join(', ')
  const rows = [
    <ClientRow key="payment" icon={CreditCard} tone={stats.paymentVerified ? 'ok' : 'bad'} title={stats.paymentVerified ? 'Payment method verified' : 'Payment method not verified'} />,
    stats.phoneVerified != null && <ClientRow key="phone" icon={Phone} tone={stats.phoneVerified ? 'ok' : 'bad'} title={stats.phoneVerified ? 'Phone number verified' : 'Phone number not verified'} />,
    stats.country && <ClientRow key="place" icon={MapPin} title={stats.country} detail={place} />,
    stats.jobsPosted != null && <ClientRow key="jobs" icon={Briefcase} title={count(stats.jobsPosted, 'job') + ' posted'} detail={jobsLine} />,
    stats.totalSpent && <ClientRow key="spent" icon={CreditCard} title={`${stats.totalSpent} total spent`} detail={hiresLine} />,
    !stats.totalSpent && hiresLine && <ClientRow key="hires" icon={Users} title={hiresLine} />,
    stats.avgHourlyRate && <ClientRow key="rate" icon={Clock} title={`${stats.avgHourlyRate} /hr avg hourly rate paid`} />,
    stats.totalHours && <ClientRow key="hours" icon={Hourglass} title={`${stats.totalHours} hours`} />,
    stats.proposals != null && <ClientRow key="proposals" icon={Target} title={count(stats.proposals, 'proposal')} detail="Sent on this job so far" />,
  ].filter(Boolean)

  return <div className="rounded-[1.7rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
    <div className="rounded-[calc(1.7rem-.375rem)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">About the client</p><SealCheck size={16} weight="duotone" className={stats.paymentVerified ? 'text-[var(--ok)]' : 'text-[var(--muted)]'} /></div>
      {stats.rating != null ? <div className="mt-5 rounded-2xl bg-[var(--paper)] p-4">
        <div className="flex items-end justify-between gap-3"><span className="text-3xl font-semibold leading-none tracking-[-.05em]">{stats.rating.toFixed(1)}</span><Stars rating={stats.rating} /></div>
        <p className="mt-2 text-[11px] font-medium text-[var(--muted)]" aria-label={`Rating is ${stats.rating.toFixed(1)} out of 5`}>{stats.rating.toFixed(2)} of {stats.reviews != null ? count(stats.reviews, 'review') : 'reviews'}</p>
      </div> : <p className="mt-5 rounded-2xl bg-[var(--paper)] p-4 text-xs text-[var(--muted)]">No reviews yet</p>}
      <div className="mt-5 space-y-4">{rows}</div>
    </div>
  </div>
}

function PitchList({ text }) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.every((line) => /^[-•*]\s+/.test(line))) return <p className="mt-4 max-w-3xl whitespace-pre-wrap text-base leading-7 sm:text-lg">{text}</p>
  return <ul className="mt-5 grid gap-3">{lines.map((line) => <li key={line} className="flex gap-3 text-[15px] leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent-strong)]" />{line.replace(/^[-•*]\s+/, '')}</li>)}</ul>
}

function CoverLetterSection({ job, onApply }) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const fetchLetter = useMutation({
    mutationFn: () => api.getCoverLetter(job),
    onSuccess: (coverLetter) => queryClient.setQueryData(['job', job.id], (current) => current ? { ...current, coverLetter } : current),
  })
  const copy = async () => {
    await navigator.clipboard?.writeText(job.coverLetter)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return <section data-detail className="border-t border-black/10 py-12 dark:border-white/10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={eyebrow}>Cover letter</p>
      {job.coverLetter && <div className="flex items-center gap-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-2 text-[11px] font-bold ring-1 ring-[var(--line)] transition-colors hover:bg-[var(--paper)]">{copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" onClick={onApply} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[11px] font-bold text-white transition-transform hover:-translate-y-0.5">Use in application<ArrowUpRight size={13} /></button>
      </div>}
    </div>
    {job.coverLetter ? <div className="mt-6 rounded-[1.8rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
      <div className="max-h-[34rem] overflow-y-auto rounded-[calc(1.8rem-.375rem)] bg-[var(--surface)] p-6 sm:p-8"><p className="max-w-3xl whitespace-pre-wrap break-words text-[15px] leading-7 text-[#3f413b]">{job.coverLetter}</p></div>
    </div> : <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-dashed border-[var(--line)] bg-[var(--surface)]/60 p-6 text-center sm:p-10">
      <span className={`mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--lime)]/35 text-[var(--accent-strong)] ${fetchLetter.isPending ? 'animate-pulse' : ''}`}><FileText size={22} weight="duotone" /></span>
      <h3 className="mt-4 text-lg font-semibold tracking-[-.02em]">{fetchLetter.isPending ? 'Writing a cover letter…' : 'No cover letter yet'}</h3>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[var(--muted)]">{fetchLetter.isPending ? 'This usually takes a few seconds.' : 'Fetch a tailored cover letter for this job, then review and copy it into your proposal.'}</p>
      {fetchLetter.isError && <p role="alert" className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-xl bg-[var(--bad-bg)] px-4 py-3 text-left text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />{fetchLetter.error?.message}</p>}
      <button type="button" disabled={fetchLetter.isPending} onClick={() => fetchLetter.mutate()} className={`${primaryButton} mt-6`}>
        <span>{fetchLetter.isPending ? 'Fetching…' : fetchLetter.isError ? 'Try again' : 'Fetch cover letter'}</span>
        <span className="grid size-8 place-items-center rounded-full bg-white/10">{fetchLetter.isPending ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ArrowClockwise size={15} />}</span>
      </button>
    </div>}
  </section>
}

export default function JobDetail() {
  const { id } = useParams(), [dialog, setDialog] = useState(null), root = useRef(null), seenJob = useRef(null), queryClient = useQueryClient()
  const now = useNow()
  const { data: job, isLoading, isError, error, refetch } = useQuery({ queryKey: ['job', id], queryFn: () => api.getJob(id), enabled: Boolean(id), retry: false })
  const jobId = job?.id
  const { mutate: markJobSeen } = useMutation({
    mutationFn: () => api.updateStatus({ id, status: 'Seen' }),
    onSuccess: (updatedJob) => {
      queryClient.setQueryData(['job', id], (current) => ({ ...updatedJob, coverLetter: current?.coverLetter || updatedJob.coverLetter }))
      queryClient.setQueriesData({ queryKey: ['jobs'] }, (data) => {
        if (Array.isArray(data)) return data.map((item) => item.id === id ? { ...item, status: 'Seen' } : item)
        if (!data?.pages) return data
        return { ...data, pages: data.pages.map((page) => ({ ...page, records: page.records.map((item) => item.id === id ? { ...item, status: 'Seen' } : item) })) }
      })
    },
  })
  useEffect(() => {
    if (job?.status !== 'New' || seenJob.current === id) return
    const timer = window.setTimeout(() => {
      seenJob.current = id
      markJobSeen()
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [job?.status, id, markJobSeen])
  useEffect(() => { if (!jobId || !root.current) return; const ctx = gsap.context(() => gsap.fromTo('[data-detail]', { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .72, stagger: .07, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }), root); return () => ctx.revert() }, [jobId])
  if (isLoading) return <Shell><JobDetailSkeleton /></Shell>
  if (isError || !job) return <NotFound type={error?.code ? undefined : 'job-not-found'} error={error} onRetry={refetch} backTo="/jobs" />
  const fit = scoreJob(job)
  const hasAiMatch = job.match > 0
  const postedAgo = timeAgo(job.postedAt, now) || job.posted

  return <Shell><main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-8 sm:px-6 md:pt-12">
    <div data-detail className="flex flex-wrap items-center justify-between gap-4">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-xs font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><span className="grid size-9 place-items-center rounded-full bg-black/5 dark:bg-white/10"><ArrowLeft size={15} /></span>All jobs</Link>
      <div className="flex flex-wrap items-center justify-end gap-2">{job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="upwork-view-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold"><span>View job</span><ArrowSquareOut size={14} /></a>}{job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="upwork-apply-button inline-flex shrink-0 items-center gap-3 rounded-full py-2 pl-5 pr-2 text-sm font-bold"><span>Apply on Upwork</span><span className="relative z-10 grid size-8 place-items-center rounded-full bg-black/15"><ArrowSquareOut size={15} /></span></a>}</div>
    </div>

    <section className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,.75fr)] xl:gap-14">
      <div className="min-w-0">
        <header data-detail className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] px-6 py-7 sm:px-9 sm:py-9">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusPill status={job.status} />
              <span className="rounded-full bg-[var(--paper)] px-3 py-1 font-mono text-[10px] font-semibold text-[var(--muted)]">{job.jobId}</span>
              <time dateTime={job.postedAt} title={job.posted} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]"><Clock size={13} weight="bold" />Posted {postedAgo}</time>
            </div>
            <h1 className="job-detail-title mt-5 text-[var(--text)]">{job.title}</h1>
            {job.summary && <p className="mt-4 max-w-3xl text-[15px] leading-7 text-[var(--muted)] sm:text-base">{job.summary}</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              {job.clientStats.country && <HeroChip icon={MapPin}>{job.clientStats.country}</HeroChip>}
              {job.tags[0] && <HeroChip icon={Briefcase}>{job.tags[0]}</HeroChip>}
              {job.duration && <HeroChip icon={CalendarBlank}>{job.duration}</HeroChip>}
              {job.workload && <HeroChip icon={Hourglass}>{job.workload}</HeroChip>}
              {job.clientStats.rating != null && <HeroChip icon={Star}>{job.clientStats.rating.toFixed(1)} client rating</HeroChip>}
            </div>
            <div className="mt-8 grid border-t border-black/[.07] pt-2 sm:grid-cols-3 dark:border-white/[.08]">
              <Metric label="Budget" value={job.budget} note={job.type} />
              <Metric label="Experience" value={job.level} note={job.duration} />
              <Metric label={hasAiMatch ? 'AI match' : 'Fit signal'} value={`${hasAiMatch ? job.match : fit.score}%`} note={hasAiMatch ? job.fitLabel : fit.verdict} last />
            </div>
          </div>
        </header>

        {job.matchReason && <section data-detail className="mt-6 flex gap-4 rounded-[1.8rem] bg-[var(--lime)]/20 p-6 ring-1 ring-[var(--lime-dark)]/20 sm:p-7"><Sparkle size={20} weight="duotone" className="mt-0.5 shrink-0 text-[var(--accent-strong)]" /><div><p className={eyebrow}>Why it matches</p><p className="mt-3 max-w-3xl text-[15px] leading-7">{job.matchReason}</p></div></section>}
        <div data-detail className="mt-6"><ScoreBreakdown job={job} /></div>
        {job.pitch && <section data-detail className="mt-6 rounded-[1.8rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--line)]/70 sm:p-8"><p className={eyebrow}>Pitch angle</p><PitchList text={job.pitch} /></section>}
        <article data-detail className="py-14"><p className={eyebrow}>The brief</p><p className="mt-6 max-w-3xl whitespace-pre-wrap break-words text-lg leading-[1.75] tracking-[-.01em] text-[#3f413b] sm:text-xl"><LinkifiedDescription text={job.description} /></p><div className="mt-10"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Skills</p><div className="mt-3 flex flex-wrap gap-2">{(job.skills?.length ? job.skills : job.tags).map((skill) => <span key={skill} className="rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold ring-1 ring-black/5">{skill}</span>)}</div></div></article>
        <CoverLetterSection job={job} onApply={() => setDialog('apply')} />
      </div>

      <aside data-detail className="space-y-4 lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-[2rem] bg-[var(--ink)] p-1.5 text-white"><div className="rounded-[calc(2rem-.375rem)] bg-[#20221d] p-6 sm:p-7"><div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.2em] text-white/45">Next move</span><Sparkle size={16} /></div><h2 className="mt-5 text-2xl font-semibold leading-tight tracking-[-.04em] sm:text-[1.7rem]">Turn a good fit into a great pitch.</h2><p className="mt-3 text-xs leading-6 text-white/50">Review the tailored letter, make it yours, then log the outcome.</p><button onClick={() => setDialog('apply')} className={`${primaryButton} mt-6 w-full bg-[var(--lime)] text-[var(--ink)]`}><span>Review & apply</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-black/10"><ArrowUpRight size={15} /></span></button><button onClick={() => setDialog('reject')} className="mt-2 w-full rounded-full py-3 text-xs font-bold text-white/50 hover:text-white">Not the right fit</button></div></div>
        <AboutClient stats={job.clientStats} />
        <div className="rounded-[1.7rem] bg-black/[.045] p-1.5 ring-1 ring-black/5"><div className="rounded-[calc(1.7rem-.375rem)] bg-[var(--surface)] p-5"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Activity log</p><Clock size={15} /></div><div className="mt-5 space-y-4">{job.activity.map((item, index) => <div key={`${item}-${index}`} className="flex gap-3"><span className={`mt-1.5 size-2 shrink-0 rounded-full ${index === 0 ? 'bg-[var(--lime-dark)]' : 'bg-black/15'}`} /><div><p className="text-xs font-medium leading-5">{item}</p><p className="mt-1 text-[9px] text-[var(--muted)]">{index === 0 ? 'Latest' : `${index + 1} events ago`}</p></div></div>)}</div></div></div>
      </aside>
    </section>
    {dialog && <ActionDialog type={dialog} job={job} onClose={() => setDialog(null)} />}
  </main></Shell>
}
