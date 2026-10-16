import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowLeft, Briefcase, CalendarBlank, ChartBar, Clock, ClockCounterClockwise, CurrencyDollar, Hourglass, MapPin, SealCheck, Sparkle, Star, Tag, Target, WarningCircle } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NotFound from './NotFound'
import ExpandableText from '../components/ExpandableText'
import { AboutClient, CoverLetter, FactTile, LinkifiedDescription, Panel, Strategy, card } from '../components/JobDetailParts'
import JobApplySection from '../components/JobApplySection'
import ShareJobDialog from '../components/ShareJobDialog'
import { ActionDialog } from '../components/dialogs'
import { StatusPill } from '../components/ui'
import { api } from '../services/api'
import JobDetailSkeleton, { DrawerDetailSkeleton } from '../components/JobDetailSkeleton'
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

/**
 * The full CRM job detail. Rendered as a page at /jobs/:id and, with `embedded`,
 * inside the job preview drawer as a single column.
 */
export function JobDetailView({ id, initialJob, embedded = false }) {
  const [dialog, setDialog] = useState(null), [share, setShare] = useState(null), root = useRef(null), seenJob = useRef(null), queryClient = useQueryClient()
  const { user } = useAuth()
  const reactions = useJobReactions(user?.email)
  const now = useNow()
  const { data: job, isLoading, isError, error, refetch } = useQuery({ queryKey: ['job', id], queryFn: () => api.getJob(id), enabled: Boolean(id), retry: false, placeholderData: initialJob })
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
  useEffect(() => { if (embedded || !jobId || !root.current) return; const ctx = gsap.context(() => gsap.fromTo('[data-detail]', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .05, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }), root); return () => ctx.revert() }, [jobId, embedded])
  if (isLoading) return embedded ? <DrawerDetailSkeleton /> : <Shell><JobDetailSkeleton /></Shell>
  if (isError || !job) {
    if (!embedded) return <NotFound type={error?.code ? undefined : 'job-not-found'} error={error} onRetry={refetch} backTo="/jobs" />
    return <div role="alert" className="m-5 flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">{error?.message || 'Could not load this job.'}</span><button type="button" onClick={() => refetch()} className="font-bold underline underline-offset-4">Try again</button></div>
  }

  const skills = job.skills?.length ? job.skills : job.tags
  const setLetter = (coverLetter) => queryClient.setQueryData(['job', job.id], (current) => (current ? { ...current, coverLetter } : current))
  const setStrategy = (pitch) => queryClient.setQueryData(['job', job.id], (current) => (current ? { ...current, pitch } : current))
  const actions = <JobApplySection
    job={job}
    statusLabel={job.status}
    applied={job.status === 'Applied'}
    dismissed={job.status === 'Rejected'}
    onApplied={() => job.status !== 'Applied' && setDialog('apply')}
    onDismiss={() => job.status !== 'Rejected' && setDialog('reject')}
    liked={reactions.isLiked(job.id)}
    favorite={reactions.isFavorite(job.id)}
    onLike={() => reactions.toggleLike(job.id, job)}
    onFavorite={() => reactions.toggleFavorite(job.id, job)}
    onShare={setShare}
  />
  const activity = <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <p className="flex items-center gap-2 text-sm font-semibold"><ClockCounterClockwise size={16} />Activity</p>
    <ol className="mt-4 space-y-3 border-l border-[var(--line)] pl-4">{job.activity.map((item, index) => <li key={`${item}-${index}`} className="relative text-xs leading-5"><span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ring-2 ring-[var(--surface)] ${index === 0 ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`} />{item}</li>)}</ol>
  </div>

  const content = <div ref={root} className={embedded ? 'space-y-5 p-4 sm:p-6' : 'mx-auto w-full max-w-[1320px] px-4 pb-20 pt-6 sm:px-6 md:pt-8'}>
    {!embedded && <Link data-detail to="/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><span className="grid size-8 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)]"><ArrowLeft size={14} /></span>All jobs</Link>}

    <div className={embedded ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]' : 'mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8'}>
      <div className="min-w-0 space-y-5">
        <header data-detail className="relative overflow-hidden rounded-[1.8rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lime)]/25 to-transparent" />
          <div className="relative p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={job.status} />
              {reactions.isFavorite(job.id) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fef9c3] px-2.5 py-1 text-[11px] font-bold text-[#92400e] ring-1 ring-[#fde047]/60 dark:bg-[#fef08a]/15 dark:text-[#fde047] dark:ring-[#fde047]/30">
                  <Star size={12} weight="fill" className="text-[#f59e0b] dark:text-[#fde047]" /> Favorited
                </span>
              )}
              {reactions.isLiked(job.id) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ffe4e6] px-2.5 py-1 text-[11px] font-bold text-[#be123c] ring-1 ring-[#fecdd3] dark:bg-[#fda4af]/15 dark:text-[#fda4af] dark:ring-[#fda4af]/30">
                  <Heart size={12} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" /> Liked
                </span>
              )}
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">{job.jobId}</span>
              {job.tags[0] && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"><Tag size={12} weight="bold" />{job.tags[0]}</span>}
              <time dateTime={job.postedAt} title={job.posted} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)]"><Clock size={13} weight="bold" />Posted {timeAgo(job.postedAt, now) || job.posted}</time>
            </div>
            <h1 className="job-detail-title mt-5">{job.title}</h1>
            {job.clientStats.country && <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--muted)]"><MapPin size={15} weight="bold" />{job.clientStats.country}{job.clientStats.rating != null && <><span aria-hidden="true">·</span><Star size={14} weight="fill" className="text-[#e6a817]" />{job.clientStats.rating.toFixed(1)}</>}{job.clientStats.paymentVerified && <><span aria-hidden="true">·</span><SealCheck size={14} weight="fill" className="text-[var(--ok)]" />Payment verified</>}</p>}
            {job.summary && <ExpandableText className="mt-5 max-w-3xl" collapsedHeight="3.6rem"><p className="text-[15px] leading-7">{job.summary}</p></ExpandableText>}
            <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
              <FactTile icon={CurrencyDollar} label="Budget" value={job.budget} note={job.type} />
              <FactTile icon={ChartBar} label="Experience" value={job.level} />
              <FactTile icon={CalendarBlank} label="Duration" value={job.duration} />
              <FactTile icon={Hourglass} label="Workload" value={job.workload || 'Not specified'} />
            </div>
          </div>
        </header>

        {embedded && <div data-detail className="xl:hidden">{actions}</div>}

        <AboutClient stats={job.clientStats} now={now} />

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

        <Strategy job={job} onStrategy={setStrategy} />

        <CoverLetter job={job} onLetter={setLetter} />

        {embedded && <div data-detail className="xl:hidden">{activity}</div>}
      </div>

      <aside data-detail className={`space-y-4 ${embedded ? 'hidden xl:block xl:sticky xl:top-2 xl:self-start' : 'lg:sticky lg:top-[calc(var(--shell-h)+1rem)] lg:self-start'}`}>
        {actions}
        {activity}
      </aside>
    </div>
    {dialog && <ActionDialog type={dialog} job={job} stay={embedded} onClose={() => setDialog(null)} />}
    {share && <ShareJobDialog job={job} mode={share} onClose={() => setShare(null)} />}
  </div>
  return embedded ? content : <Shell><main>{content}</main></Shell>
}

export default function JobDetail() {
  const { id } = useParams()
  return <JobDetailView id={id} />
}
