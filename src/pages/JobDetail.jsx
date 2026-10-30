import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowLeft, BookmarkSimple, Briefcase, CalendarBlank, ChartBar, Clock, CurrencyDollar, Heart, Hourglass, MapPin, SealCheck, Sparkle, Star, Tag, Target, WarningCircle } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NotFound from './NotFound'
import ExpandableText from '../components/ExpandableText'
import AskAiSelection from '../components/AskAiSelection'
import { AboutClient, CoverLetter, FactTile, JobPdf, LinkifiedDescription, Panel, Tips, card } from '../components/JobDetailParts'
import JobApplySection from '../components/JobApplySection'
import ErrorBoundary from '../components/ErrorBoundary'
import ShareJobDialog from '../components/ShareJobDialog'
import JobActivity from '../components/JobActivity'
import { StatusPill } from '../components/ui'
import { api, rejectReasonOf } from '../services/api'
import JobDetailSkeleton, { DrawerDetailSkeleton } from '../components/JobDetailSkeleton'
import { timeAgo, useNow } from '../lib/time'
import { skillStyle } from '../lib/jobSignals'
import { useCrmReactions } from '../lib/crmReactions'
import { useJobStatus } from '../lib/jobStatus'
import { useAuth } from '../contexts/AuthContext'
import { asArray, asObject } from '../lib/safe'

function MatchRing({ value }) {
  const tone = value >= 75 ? 'var(--lime-dark)' : value >= 55 ? 'var(--score-mid)' : 'var(--danger)'
  return <div className="relative grid size-20 shrink-0 place-items-center">
    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" className="stroke-black/[.07] dark:stroke-white/10" /><circle cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${value} 100`} style={{ stroke: tone }} /></svg>
    <span className="text-center leading-none"><span className="block text-xl font-semibold tracking-[-.04em]">{value}%</span><span className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">match</span></span>
  </div>
}

// Sidebar cards are components (not inline JSX) so each one's ErrorBoundary catches its own render errors.
function SkillsCard({ skills = [] }) {
  return <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold"><Target size={16} />Skills and expertise</p>
      <span className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--muted)]" title={`${skills.length} skill${skills.length === 1 ? '' : 's'} requested`}>{skills.length}</span>
    </div>
    <div className="mt-4 flex flex-wrap gap-1.5">{skills.map((skill) => <span key={skill} style={skillStyle(skill)} className="skill-chip rounded-full px-2.5 py-1 text-[11px] font-semibold">{skill}</span>)}</div>
  </div>
}

/**
 * The full CRM job detail. Rendered as a page at /jobs/:id and, with `embedded`,
 * inside the job preview drawer as a single column.
 */
// An Applied or Rejected job shows its status with Undo instead of Not a fit, wherever it is opened from.
export function JobDetailView({ id, initialJob, embedded = false }) {
  const [share, setShare] = useState(null), root = useRef(null), seenJob = useRef(null), queryClient = useQueryClient()
  const { user } = useAuth()
  const status = useJobStatus()
  const reactions = useCrmReactions(user)
  const now = useNow()
  const { data: job, isLoading, isError, error, refetch } = useQuery({ queryKey: ['job', id], queryFn: () => api.getJob(id, user?.email), enabled: Boolean(id), retry: false, placeholderData: initialJob })
  const jobId = job?.id
  // Why a rejected job was rejected: its latest "Rejected: …" activity entry (shared with the Activity panel's query).
  const { data: activityEntries } = useQuery({ queryKey: ['job-activity', id], queryFn: () => api.getJobActivity(id), enabled: Boolean(id) && job?.status === 'Rejected', staleTime: 30_000 })
  const rejectReason = job?.status === 'Rejected' ? rejectReasonOf(asArray(activityEntries).find((entry) => /^Rejected/.test(entry.description))?.description) : ''
  const { mutate: markJobSeen } = useMutation({
    mutationFn: () => api.updateStatus({ id, status: 'Seen' }),
    onSuccess: (updatedJob) => {
      queryClient.setQueryData(['job', id], (current) => ({ ...updatedJob, coverLetter: current?.coverLetter || updatedJob.coverLetter }))
      queryClient.setQueriesData({ queryKey: ['jobs'] }, (data) => {
        if (Array.isArray(data)) return data.map((item) => item.id === id ? { ...item, status: 'Seen' } : item)
        if (!data?.pages) return data
        return { ...data, pages: asArray(data.pages).map((page) => ({ ...page, records: asArray(page?.records).map((item) => item.id === id ? { ...item, status: 'Seen' } : item) })) }
      })
    },
  })
  // Opening a job records one "Seen" activity per user; repeat visits create nothing.
  const userEmail = user?.email
  useEffect(() => {
    if (!jobId || !userEmail) return
    api.logJobActivity({ jobId, userEmail, description: 'Seen', once: true })
      .then((created) => { if (created) queryClient.invalidateQueries({ queryKey: ['job-activity', jobId] }) })
      .catch((error) => console.warn('Could not record job activity', error))
  }, [jobId, userEmail, queryClient])
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

  const tags = asArray(job.tags), clientStats = asObject(job.clientStats)
  const skills = asArray(job.skills).length ? job.skills : tags
  const setLetter = (coverLetter) => queryClient.setQueryData(['job', job.id], (current) => (current ? { ...current, coverLetter } : current))
  const setTips = (pitch) => queryClient.setQueryData(['job', job.id], (current) => (current ? { ...current, pitch } : current))
  const actions = <ErrorBoundary name="apply-box" resetKey={job.id}><JobApplySection
    job={job}
    statusLabel={job.status}
    dismissed={job.status === 'Rejected'}
    onDismiss={(reason) => status.markNotFit(job, reason)}
    rejectReason={rejectReason}
    statusError={status.errorId === job.id ? status.error?.message || 'Could not update this job.' : ''}
    resolved={job.status === 'Applied' ? 'applied' : job.status === 'Rejected' ? 'rejected' : null}
    onUndo={() => status.undo(job)}
    undoing={status.pendingId === job.id}
    liked={reactions.isLiked(job.id, job)}
    onLike={() => reactions.toggleLike(job.id, job)}
    likeCount={job.engagement?.likesCount}
    saved={reactions.isSaved(job.id, job)}
    onSave={() => reactions.toggleSave(job.id, job)}    onShare={setShare}
    showApply={!embedded && job.status !== 'Applied'}
  /></ErrorBoundary>
  const skillsCard = <ErrorBoundary name="skills" resetKey={job.id}><SkillsCard skills={skills} /></ErrorBoundary>
  const activity = <ErrorBoundary name="activity" resetKey={job.id}><JobActivity job={job} /></ErrorBoundary>

  const content = <div ref={root} className={embedded ? 'space-y-5 p-4 sm:p-6' : 'mx-auto w-full max-w-[1320px] px-4 pb-20 pt-6 sm:px-6 md:pt-8'}>
    {!embedded && <Link data-detail to="/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><span className="grid size-8 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)]"><ArrowLeft size={14} /></span>All jobs</Link>}

    <div className={embedded ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]' : 'mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8'}>
      <div className="min-w-0 space-y-5">
        <header data-detail className="relative overflow-hidden rounded-[1.8rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lime-tint)]/25 to-transparent" />
          <div className="relative p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={job.status} />
              {reactions.isSaved(job.id, job) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-[11px] font-bold text-info ring-1 ring-info-line">
                  <BookmarkSimple size={12} weight="fill" className="text-info-icon" /> Saved
                </span>
              )}
              {reactions.isLiked(job.id, job) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-like-bg px-2.5 py-1 text-[11px] font-bold text-like ring-1 ring-like-line">
                  <Heart size={12} weight="fill" className="text-like-icon" /> Liked
                </span>
              )}              {tags[0] && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"><Tag size={12} weight="bold" />{tags[0]}</span>}
              <time dateTime={job.postedAt} title={job.posted} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-strong)]"><Clock size={13} weight="bold" />Posted {timeAgo(job.postedAt, now) || job.posted}</time>
            </div>
            <h1 className="job-detail-title mt-5">{job.title}</h1>
            {clientStats.country && <p className="mt-3 flex items-center gap-1.5 text-sm text-[var(--muted)]"><MapPin size={15} weight="bold" />{clientStats.country}{clientStats.rating != null && <><span aria-hidden="true">·</span><Star size={14} weight="fill" className="text-star" />{Number(clientStats.rating).toFixed(1)}</>}{clientStats.paymentVerified && <><span aria-hidden="true">·</span><SealCheck size={14} weight="fill" className="text-[var(--ok)]" />Payment verified</>}</p>}
            {job.summary && <ExpandableText className="mt-5 max-w-3xl" collapsedHeight="3.6rem"><p className="text-[15px] leading-7">{job.summary}</p></ExpandableText>}
            <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
              <FactTile icon={CurrencyDollar} label="Budget" value={job.budget} note={job.type} wrap />
              <FactTile icon={ChartBar} label="Experience" value={job.level} />
              <FactTile icon={CalendarBlank} label="Duration" value={job.duration} />
              <FactTile icon={Hourglass} label="Workload" value={job.workload || 'Not specified'} />
            </div>
          </div>
        </header>

        {embedded && <div data-detail className="xl:hidden">{actions}</div>}

        <ErrorBoundary name="about-client" resetKey={job.id}><AboutClient stats={clientStats} now={now} /></ErrorBoundary>

        {job.match > 0 && <section data-detail className={`${card} flex flex-col gap-5 sm:flex-row sm:items-start`}>
          <MatchRing value={job.match} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)]"><Sparkle size={14} weight="fill" />AI match</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-.02em]">{job.fitLabel || 'Match assessment'}</h2>
            {job.matchReason && <ExpandableText className="mt-2" collapsedHeight="3.3rem"><p className="text-sm leading-6 text-[var(--muted)]">{job.matchReason}</p></ExpandableText>}
          </div>
        </section>}

        <Panel icon={Briefcase} title="Job description" subtitle="As posted on Upwork">
          <ExpandableText collapsedHeight="12rem"><p className="whitespace-pre-wrap break-words text-[15px] leading-[1.8] text-[var(--body-text)]"><LinkifiedDescription text={job.description} /></p></ExpandableText>
        </Panel>

        {/* Skills live in the right sidebar; the drawer hides that sidebar below xl, so show them here instead. */}
        {embedded && <div data-detail className="xl:hidden">{skillsCard}</div>}

        <ErrorBoundary name="tips" resetKey={job.id}><Tips job={job} onTips={setTips} /></ErrorBoundary>

        <ErrorBoundary name="cover-letter" resetKey={job.id}><CoverLetter job={job} onLetter={setLetter} /></ErrorBoundary>

        <ErrorBoundary name="job-pdf" resetKey={job.id}><JobPdf job={job} /></ErrorBoundary>

        {embedded && <div data-detail className="xl:hidden">{activity}</div>}
      </div>

      <aside data-detail className={`space-y-4 ${embedded ? 'hidden xl:block xl:sticky xl:top-2 xl:self-start' : 'lg:sticky lg:top-[calc(var(--shell-h)+1rem)] lg:self-start'}`}>
        {actions}
        {skillsCard}
        {activity}
      </aside>
    </div>
    {share && <ShareJobDialog job={job} mode={share} onClose={() => setShare(null)} />}
  </div>
  // Selecting any text in the job offers "Ask AI" about it.
  const page = <AskAiSelection>{content}</AskAiSelection>
  return embedded ? page : <Shell><main>{page}</main></Shell>
}

export default function JobDetail() {
  const { id } = useParams()
  return <JobDetailView id={id} />
}
