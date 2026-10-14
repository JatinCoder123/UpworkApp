import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowLeft, ArrowSquareOut, Briefcase, CalendarBlank, ChartBar, Check, Clock, ClockCounterClockwise, CurrencyDollar, Heart, Hourglass, Lightbulb, LinkSimple, MapPin, PaperPlaneTilt, SealCheck, Sparkle, Star, Tag, Target, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NotFound from './NotFound'
import ExpandableText from '../components/ExpandableText'
import { AboutClient, CoverLetter, FactTile, LinkifiedDescription, Panel, card, useCopied } from '../components/JobDetailParts'
import { ActionDialog } from '../components/dialogs'
import { StatusPill } from '../components/ui'
import { api } from '../services/api'
import JobDetailSkeleton from '../components/JobDetailSkeleton'
import { timeAgo, useNow } from '../lib/time'
import { skillStyle, useJobReactions } from '../lib/jobSignals'
import { useAuth } from '../contexts/AuthContext'

function MatchRing({ value }) {
  const tone = value >= 75 ? 'var(--lime-dark)' : value >= 55 ? '#d9a53a' : 'var(--danger)'
  return <div className="relative grid size-20 shrink-0 place-items-center">
    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" className="stroke-black/[.07] dark:stroke-white/10" /><circle cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${value} 100`} style={{ stroke: tone }} /></svg>
    <span className="text-center leading-none"><span className="block text-xl font-semibold tracking-[-.04em]">{value}%</span><span className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">match</span></span>
  </div>
}

function PitchList({ text }) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.every((line) => /^[-•*]\s+/.test(line))) return <p className="whitespace-pre-wrap text-sm leading-7">{text}</p>
  return <ul className="grid gap-2.5">{lines.map((line) => <li key={line} className="flex gap-3 text-sm leading-6"><Check size={15} weight="bold" className="mt-1 shrink-0 text-[var(--accent-strong)]" />{line.replace(/^[-•*]\s+/, '')}</li>)}</ul>
}

function ActionPanel({ job, liked, favorite, onLike, onFavorite, onApply, onReject }) {
  const [copied, copy] = useCopied()
  const outline = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold ring-1 ring-[var(--line)] transition-colors disabled:pointer-events-none disabled:opacity-45'
  const toggle = (active) => `${outline} ${active ? 'bg-[var(--ink)] text-white ring-[var(--ink)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`

  return <div className="overflow-hidden rounded-[1.6rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
    <div className="border-b border-[var(--line)]/70 bg-[var(--paper)]/60 p-5">
      <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-medium text-[var(--muted)]">{job.type}</p><StatusPill status={job.status} /></div>
      <p className="mt-1 text-2xl font-semibold tracking-[-.03em]">{job.budget}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{[job.level !== 'Not specified' && job.level, job.duration !== 'Duration not set' && job.duration].filter(Boolean).join(' · ')}</p>
    </div>
    <div className="space-y-2.5 p-5">
      {job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="upwork-apply-button flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold"><span className="relative z-10">Apply on Upwork</span><ArrowSquareOut size={15} className="relative z-10" /></a>}
      {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="upwork-view-button flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold">View job on Upwork<ArrowSquareOut size={15} /></a>}

      <p className="pt-3 text-[11px] font-medium text-[var(--muted)]">Update status</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={job.status === 'Applied'} onClick={onApply} className={`${outline} text-[var(--ink)] hover:bg-[var(--lime)]/30 hover:ring-[var(--lime-dark)]`}><PaperPlaneTilt size={14} />Mark applied</button>
        <button type="button" disabled={job.status === 'Rejected'} onClick={onReject} className={`${outline} text-[var(--ink)] hover:bg-[var(--bad-bg)] hover:text-[var(--bad)] hover:ring-[var(--bad)]/40`}><X size={14} />Not a fit</button>
      </div>

      <p className="pt-3 text-[11px] font-medium text-[var(--muted)]">Keep track</p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onLike} aria-pressed={liked} className={toggle(liked)}><Heart size={14} weight={liked ? 'fill' : 'regular'} />{liked ? 'Liked' : 'Like'}</button>
        <button type="button" onClick={onFavorite} aria-pressed={favorite} className={toggle(favorite)}><Star size={14} weight={favorite ? 'fill' : 'regular'} />{favorite ? 'Saved' : 'Save'}</button>
        <button type="button" onClick={() => copy('link', window.location.href)} className={toggle(false)}>{copied === 'link' ? <Check size={14} weight="bold" /> : <LinkSimple size={14} />}{copied === 'link' ? 'Copied' : 'Link'}</button>
      </div>
    </div>
  </div>
}

export default function JobDetail() {
  const { id } = useParams(), [dialog, setDialog] = useState(null), root = useRef(null), seenJob = useRef(null), queryClient = useQueryClient()
  const { user } = useAuth()
  const reactions = useJobReactions(user?.email)
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
  useEffect(() => { if (!jobId || !root.current) return; const ctx = gsap.context(() => gsap.fromTo('[data-detail]', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .05, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }), root); return () => ctx.revert() }, [jobId])
  if (isLoading) return <Shell><JobDetailSkeleton /></Shell>
  if (isError || !job) return <NotFound type={error?.code ? undefined : 'job-not-found'} error={error} onRetry={refetch} backTo="/jobs" />

  const skills = job.skills?.length ? job.skills : job.tags

  return <Shell><main ref={root} className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
    <Link data-detail to="/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><span className="grid size-8 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)]"><ArrowLeft size={14} /></span>All jobs</Link>

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
      <div className="min-w-0 space-y-5">
        <header data-detail className="relative overflow-hidden rounded-[1.8rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lime)]/25 to-transparent" />
          <div className="relative p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={job.status} />
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">{job.jobId}</span>
              {job.tags[0] && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"><Tag size={12} weight="bold" />{job.tags[0]}</span>}
              <time dateTime={job.postedAt} title={job.posted} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)]"><Clock size={13} weight="bold" />Posted {timeAgo(job.postedAt, now) || job.posted}</time>
            </div>
            <h1 className="job-detail-title mt-5">{job.title}</h1>
            {job.clientStats.country && <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--muted)]"><MapPin size={15} weight="bold" />{job.clientStats.country}{job.clientStats.rating != null && <><span aria-hidden="true">·</span><Star size={14} weight="fill" className="text-[#e6a817]" />{job.clientStats.rating.toFixed(1)}</>}{job.clientStats.paymentVerified && <><span aria-hidden="true">·</span><SealCheck size={14} weight="fill" className="text-[var(--ok)]" />Payment verified</>}</p>}
            {job.summary && <ExpandableText className="mt-5 max-w-3xl" collapsedHeight="3.6rem"><p className="text-[15px] leading-7">{job.summary}</p></ExpandableText>}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FactTile icon={CurrencyDollar} label="Budget" value={job.budget} note={job.type} />
              <FactTile icon={ChartBar} label="Experience" value={job.level} />
              <FactTile icon={CalendarBlank} label="Duration" value={job.duration} />
              <FactTile icon={Hourglass} label="Workload" value={job.workload || 'Not specified'} />
            </div>
          </div>
        </header>

        {job.match > 0 && <section data-detail className={`${card} flex flex-col gap-5 sm:flex-row sm:items-start`}>
          <MatchRing value={job.match} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)]"><Sparkle size={14} weight="fill" />AI match</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-.02em]">{job.fitLabel || 'Match assessment'}</h2>
            {job.matchReason && <ExpandableText className="mt-2" collapsedHeight="3.3rem"><p className="text-sm leading-6 text-[var(--muted)]">{job.matchReason}</p></ExpandableText>}
          </div>
        </section>}

        <Panel icon={Briefcase} title="Job description" subtitle="As posted on Upwork">
          <ExpandableText collapsedHeight="12rem"><p className="whitespace-pre-wrap break-words text-[15px] leading-[1.8] text-[#3f413b]"><LinkifiedDescription text={job.description} /></p></ExpandableText>
        </Panel>

        <Panel icon={Target} title="Skills and expertise" subtitle={`${skills.length} skill${skills.length === 1 ? '' : 's'} requested`}>
          <div className="flex flex-wrap gap-2">{skills.map((skill) => <span key={skill} style={skillStyle(skill)} className="skill-chip rounded-full px-3 py-1.5 text-xs font-semibold">{skill}</span>)}</div>
        </Panel>

        <AboutClient stats={job.clientStats} now={now} />

        {job.pitch && <Panel icon={Lightbulb} title="Pitch angle" subtitle="Points to lead with in the proposal">
          <ExpandableText collapsedHeight="8rem"><PitchList text={job.pitch} /></ExpandableText>
        </Panel>}

        <CoverLetter job={job} onLetter={(coverLetter) => queryClient.setQueryData(['job', job.id], (current) => (current ? { ...current, coverLetter } : current))} />
      </div>

      <aside data-detail className="space-y-4 lg:sticky lg:top-[calc(var(--shell-h)+1rem)] lg:self-start">
        <ActionPanel job={job} liked={reactions.isLiked(job.id)} favorite={reactions.isFavorite(job.id)} onLike={() => reactions.toggleLike(job.id)} onFavorite={() => reactions.toggleFavorite(job.id)} onApply={() => setDialog('apply')} onReject={() => setDialog('reject')} />
        <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
          <p className="flex items-center gap-2 text-sm font-semibold"><ClockCounterClockwise size={16} />Activity</p>
          <ol className="mt-4 space-y-3 border-l border-[var(--line)] pl-4">{job.activity.map((item, index) => <li key={`${item}-${index}`} className="relative text-xs leading-5"><span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ring-2 ring-[var(--surface)] ${index === 0 ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`} />{item}</li>)}</ol>
        </div>
      </aside>
    </div>
    {dialog && <ActionDialog type={dialog} job={job} onClose={() => setDialog(null)} />}
  </main></Shell>
}
