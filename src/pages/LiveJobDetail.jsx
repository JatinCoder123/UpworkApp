import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowLeft, Briefcase, Broadcast, CalendarBlank, ChartBar, Clock, ClockCounterClockwise, CurrencyDollar, GlobeHemisphereWest, Heart, Hourglass, Lightning, MapPin, SealCheck, Star, Tag, Target, UsersThree } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NotFound from './NotFound'
import ExpandableText from '../components/ExpandableText'
import { AboutClient, CoverLetter, FactTile, LinkifiedDescription, Panel, card } from '../components/JobDetailParts'
import { CompetitionMeter, freshnessTone } from '../components/LiveJobCard'
import JobApplySection from '../components/JobApplySection'
import ShareJobDialog from '../components/ShareJobDialog'
import { findLiveJob, isEarlyBird, minutesSince } from '../lib/liveJobs'
import { timeAgo, useNow } from '../lib/time'
import { useJobReactions } from '../lib/jobSignals'
import { useAuth } from '../contexts/AuthContext'

const clock = (value) => (value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '')

function FreshnessRing({ minutes, tone }) {
  // The ring empties over the first hour so a very fresh job reads as a full ring.
  const value = Math.max(4, 100 - Math.min(100, (minutes / 60) * 100))
  return <div className="relative grid size-20 shrink-0 place-items-center">
    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" className="stroke-black/[.07] dark:stroke-white/10" /><circle cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${value} 100`} style={{ stroke: tone }} /></svg>
    <span className="text-center leading-none"><span className="block text-xl font-semibold tracking-[-.04em]">{minutes < 60 ? minutes : Math.floor(minutes / 60)}</span><span className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{minutes < 60 ? 'min old' : 'hrs old'}</span></span>
  </div>
}

// Live jobs have no CRM record, so Applied / Not a fit are tracked in this browser.
function ActionPanel({ job, reactions, onShare, showApply }) {
  const applied = reactions.isApplied(job.id), dismissed = reactions.isDismissed(job.id)
  return <JobApplySection
    job={job}
    statusLabel={applied ? 'Applied' : dismissed ? 'Not a fit' : 'Live'}
    dismissed={dismissed}
    onApplied={() => { if (!applied) reactions.toggleApplied(job.id) }}    onDismiss={() => reactions.toggleDismissed(job.id)}
    liked={reactions.isLiked(job.id)}
    favorite={reactions.isFavorite(job.id)}
    onLike={() => reactions.toggleLike(job.id, job)}
    onFavorite={() => reactions.toggleFavorite(job.id, job)}
    onShare={onShare}
    showApply={showApply}
  />
}

function LivePill() {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#c8e875]"><span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#c8e875] opacity-70" /><span className="relative size-1.5 rounded-full bg-[#c8e875]" /></span>Live</span>
}

/** The full live job detail; `embedded` renders it as one column inside the preview drawer. */
export function LiveJobDetailView({ id, job: passedJob, embedded = false }) {
  const { user } = useAuth()
  const reactions = useJobReactions(user?.email)
  const now = useNow(30_000)
  const root = useRef(null)
  const [stored] = useState(() => passedJob || findLiveJob(id))
  const [coverLetter, setCoverLetter] = useState('')
  const [share, setShare] = useState(null)
  useEffect(() => { if (embedded || !stored || !root.current) return undefined; const ctx = gsap.context(() => gsap.fromTo('[data-detail]', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .05, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }), root); return () => ctx.revert() }, [stored, embedded])

  if (!stored) {
    if (embedded) return <p className="m-5 rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-xs font-semibold text-[var(--warn)]">This live job has expired. Run a new live scan to find it again.</p>
    return <NotFound title="Live job expired." message="Live jobs are kept only for this browser session. Run a new live scan to find it again." backTo="/live-jobs" backLabel="Back to live jobs" />
  }

  const job = { ...stored, coverLetter }
  const minutes = minutesSince(job.postedAt, now)
  const tone = freshnessTone(minutes, 60)
  const matched = new Set(job.matchedSkills.map((skill) => skill.toLowerCase()))
  const earlyBird = isEarlyBird(job, now)
  const timeline = [
    job.renewedAt && ['Renewed on Upwork', job.renewedAt],
    ['Published on Upwork', job.postedAt],
    job.raw?.createdDateTime && ['Draft created', job.raw.createdDateTime.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')],
  ].filter(Boolean)
  const sidebar = <>
    <ActionPanel job={job} reactions={reactions} onShare={setShare} showApply={!embedded} />
    {job.preferredLocations.length > 0 && <div className="flex items-start gap-3 rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70"><GlobeHemisphereWest size={18} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" /><div><p className="text-sm font-semibold">Preferred location</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{job.preferredLocations.join(', ')} · {job.preferredLocationMandatory ? 'required by the client' : 'not required'}</p></div></div>}
  </>
  const skillsCard = <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <div className="flex items-center justify-between gap-2">
      <p className="flex items-center gap-2 text-sm font-semibold"><Target size={16} />Skills and expertise</p>
      <span className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--muted)]" title={`${job.skills.length} skill${job.skills.length === 1 ? '' : 's'} requested`}>{job.skills.length}</span>
    </div>
    {matched.size > 0 && <p className="mt-1 text-[11px] text-[var(--muted)]">{job.matchedSkills.join(', ')} matched your scan</p>}
    <div className="mt-4 flex flex-wrap gap-1.5">{job.skills.map((skill) => <span key={skill} aria-pressed={matched.has(skill.toLowerCase())} className="skill-tag rounded-full px-2.5 py-1 text-[11px] font-semibold">{skill}</span>)}</div>
  </div>
  const timelineCard = <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <p className="flex items-center gap-2 text-sm font-semibold"><ClockCounterClockwise size={16} />Timeline</p>
    <ol className="mt-4 space-y-3 border-l border-[var(--line)] pl-4">{timeline.map(([text, value], index) => <li key={text} className="relative text-xs leading-5"><span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ring-2 ring-[var(--surface)] ${index === 0 ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`} />{text}<span className="block text-[11px] text-[var(--muted)]">{clock(value)} · {timeAgo(value, now)}</span></li>)}</ol>
  </div>

  const content = <div ref={root} className={embedded ? 'space-y-5 p-4 sm:p-6' : 'mx-auto w-full max-w-[1320px] px-4 pb-20 pt-6 sm:px-6 md:pt-8'}>
    {!embedded && <Link data-detail to="/live-jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><span className="grid size-8 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)]"><ArrowLeft size={14} /></span>Live jobs</Link>}

    <div className={embedded ? 'grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]' : 'mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8'}>
      <div className="min-w-0 space-y-5">
        <header data-detail className="relative overflow-hidden rounded-[1.8rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lime)]/25 to-transparent" />
          <div className="relative p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <LivePill />
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
              {earlyBird && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--warn)]"><Lightning size={12} weight="fill" />Early bird</span>}
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">{job.raw?.recordNumber || job.jobId}</span>
              {job.tags[0] && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"><Tag size={12} weight="bold" />{job.tags[0]}</span>}
              <time dateTime={job.postedAt} title={clock(job.postedAt)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tone }}><Clock size={13} weight="bold" />Posted {timeAgo(job.postedAt, now)}</time>
            </div>
            <h1 className="job-detail-title mt-5">{job.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]"><MapPin size={15} weight="bold" />{job.clientStats.country || 'Location not shared'}{job.clientStats.paymentVerified && <><span aria-hidden="true">·</span><SealCheck size={14} weight="fill" className="text-[var(--ok)]" />Payment verified</>}{job.tags[1] && <><span aria-hidden="true">·</span>{job.tags[1]}</>}</p>
            <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4">
              <FactTile icon={CurrencyDollar} label="Budget" value={job.budget} note={job.type} />
              <FactTile icon={ChartBar} label="Experience" value={job.level} />
              <FactTile icon={CalendarBlank} label="Duration" value={job.duration} />
              <FactTile icon={Hourglass} label="Workload" value={job.workload || 'Not specified'} />
            </div>
          </div>
        </header>

        {embedded && <div data-detail className="xl:hidden space-y-4">{sidebar}</div>}

        <AboutClient stats={job.clientStats} now={now} />

        <section data-detail className={`${card} flex flex-col gap-5 sm:flex-row sm:items-center`}>
          <FreshnessRing minutes={minutes} tone={tone} />
          <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0"><p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-strong)]"><Broadcast size={14} weight="fill" />Live signal</p><p className="mt-1 text-sm font-semibold">{minutes <= 20 ? 'Brand new post' : minutes <= 60 ? 'Still fresh' : 'Aging post'}</p><p className="mt-0.5 text-[11px] text-[var(--muted)]">{clock(job.postedAt)}</p></div>
            <CompetitionMeter applicants={job.applicants} compact />
            <div className="min-w-0"><p className="flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]"><UsersThree size={12} weight="bold" />Hiring</p><p className="mt-1 text-sm font-semibold">{job.freelancersToHire > 1 ? `${job.freelancersToHire} freelancers` : '1 freelancer'}</p><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{job.preferredLocations.length ? `Prefers ${job.preferredLocations.join(', ')}${job.preferredLocationMandatory ? ' only' : ''}` : 'Open worldwide'}</p></div>
          </div>
        </section>

        <Panel icon={Briefcase} title="Job description" subtitle="As posted on Upwork">
          <ExpandableText collapsedHeight="12rem"><p className="whitespace-pre-wrap break-words text-[15px] leading-[1.8] text-[#3f413b]"><LinkifiedDescription text={job.description} /></p></ExpandableText>
        </Panel>

        {/* Skills live in the right sidebar; the drawer hides that sidebar below xl, so show them here instead. */}
        {embedded && <div data-detail className="xl:hidden">{skillsCard}</div>}

        <CoverLetter job={job} onLetter={setCoverLetter} />

        {embedded && <div data-detail className="xl:hidden">{timelineCard}</div>}
      </div>

      <aside data-detail className={`space-y-4 ${embedded ? 'hidden xl:block xl:sticky xl:top-2 xl:self-start' : 'lg:sticky lg:top-[calc(var(--shell-h)+1rem)] lg:self-start'}`}>
        {sidebar}
        {skillsCard}
        {timelineCard}
      </aside>
    </div>
    {share && <ShareJobDialog job={job} mode={share} onClose={() => setShare(null)} />}
  </div>
  return embedded ? content : <Shell><main>{content}</main></Shell>
}

export default function LiveJobDetail() {
  const { id } = useParams()
  return <LiveJobDetailView key={id} id={id} />
}
