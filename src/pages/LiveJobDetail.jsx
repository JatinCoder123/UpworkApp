import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowLeft, ArrowSquareOut, Briefcase, Broadcast, CalendarBlank, ChartBar, Check, Clock, ClockCounterClockwise, CurrencyDollar, GlobeHemisphereWest, Heart, Hourglass, Lightning, LinkSimple, MapPin, SealCheck, Star, Tag, Target, UsersThree } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NotFound from './NotFound'
import ExpandableText from '../components/ExpandableText'
import { AboutClient, CoverLetter, FactTile, LinkifiedDescription, Panel, card, useCopied } from '../components/JobDetailParts'
import { CompetitionMeter, freshnessTone } from '../components/LiveJobCard'
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

function ActionPanel({ job, liked, favorite, onLike, onFavorite }) {
  const [copied, copy] = useCopied()
  const outline = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold ring-1 ring-[var(--line)] transition-colors'
  const toggle = (active) => `${outline} ${active ? 'bg-[var(--ink)] text-white ring-[var(--ink)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`

  return <div className="overflow-hidden rounded-[1.6rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
    <div className="border-b border-[var(--line)]/70 bg-[var(--paper)]/60 p-5">
      <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-medium text-[var(--muted)]">{job.type}</p><LivePill /></div>
      <p className="mt-1 text-2xl font-semibold tracking-[-.03em]">{job.budget}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{[job.level !== 'Not specified' && job.level, job.duration !== 'Duration not set' && job.duration].filter(Boolean).join(' · ')}</p>
    </div>
    <div className="space-y-2.5 p-5">
      {job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="upwork-apply-button flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold"><span className="relative z-10">Apply on Upwork</span><ArrowSquareOut size={15} className="relative z-10" /></a>}
      {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="upwork-view-button flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold">View job on Upwork<ArrowSquareOut size={15} /></a>}
      <p className="pt-3 text-[11px] font-medium text-[var(--muted)]">Keep track</p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onLike} aria-pressed={liked} className={toggle(liked)}><Heart size={14} weight={liked ? 'fill' : 'regular'} />{liked ? 'Liked' : 'Like'}</button>
        <button type="button" onClick={onFavorite} aria-pressed={favorite} className={toggle(favorite)}><Star size={14} weight={favorite ? 'fill' : 'regular'} />{favorite ? 'Saved' : 'Save'}</button>
        <button type="button" onClick={() => copy('link', job.url || window.location.href)} className={toggle(false)}>{copied === 'link' ? <Check size={14} weight="bold" /> : <LinkSimple size={14} />}{copied === 'link' ? 'Copied' : 'Link'}</button>
      </div>
    </div>
  </div>
}

function LivePill() {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#c8e875]"><span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#c8e875] opacity-70" /><span className="relative size-1.5 rounded-full bg-[#c8e875]" /></span>Live</span>
}

export default function LiveJobDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const reactions = useJobReactions(user?.email)
  const now = useNow(30_000)
  const root = useRef(null)
  const [stored] = useState(() => findLiveJob(id))
  const [coverLetter, setCoverLetter] = useState('')
  useEffect(() => { if (!stored || !root.current) return undefined; const ctx = gsap.context(() => gsap.fromTo('[data-detail]', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, stagger: .05, ease: 'power3.out', clearProps: 'opacity,visibility,transform' }), root); return () => ctx.revert() }, [stored])

  if (!stored) return <NotFound title="Live job expired." message="Live jobs are kept only for this browser session. Run a new live scan to find it again." backTo="/live-jobs" backLabel="Back to live jobs" />

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

  return <Shell><main ref={root} className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
    <Link data-detail to="/live-jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><span className="grid size-8 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)]"><ArrowLeft size={14} /></span>Live jobs</Link>

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8">
      <div className="min-w-0 space-y-5">
        <header data-detail className="relative overflow-hidden rounded-[1.8rem] bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--lime)]/25 to-transparent" />
          <div className="relative p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <LivePill />
              {earlyBird && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--warn)]"><Lightning size={12} weight="fill" />Early bird</span>}
              <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">{job.raw?.recordNumber || job.jobId}</span>
              {job.tags[0] && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"><Tag size={12} weight="bold" />{job.tags[0]}</span>}
              <time dateTime={job.postedAt} title={clock(job.postedAt)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold" style={{ color: tone }}><Clock size={13} weight="bold" />Posted {timeAgo(job.postedAt, now)}</time>
            </div>
            <h1 className="job-detail-title mt-5">{job.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-[var(--muted)]"><MapPin size={15} weight="bold" />{job.clientStats.country || 'Location not shared'}{job.clientStats.paymentVerified && <><span aria-hidden="true">·</span><SealCheck size={14} weight="fill" className="text-[var(--ok)]" />Payment verified</>}{job.tags[1] && <><span aria-hidden="true">·</span>{job.tags[1]}</>}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FactTile icon={CurrencyDollar} label="Budget" value={job.budget} note={job.type} />
              <FactTile icon={ChartBar} label="Experience" value={job.level} />
              <FactTile icon={CalendarBlank} label="Duration" value={job.duration} />
              <FactTile icon={Hourglass} label="Workload" value={job.workload || 'Not specified'} />
            </div>
          </div>
        </header>

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

        <Panel icon={Target} title="Skills and expertise" subtitle={`${job.skills.length} skill${job.skills.length === 1 ? '' : 's'} requested${matched.size ? ` · ${job.matchedSkills.join(', ')} matched your scan` : ''}`}>
          <div className="flex flex-wrap gap-2">{job.skills.map((skill) => <span key={skill} aria-pressed={matched.has(skill.toLowerCase())} className="skill-tag rounded-full px-3 py-1.5 text-xs font-semibold">{skill}</span>)}</div>
        </Panel>

        <AboutClient stats={job.clientStats} now={now} />

        <CoverLetter job={job} onLetter={setCoverLetter} />
      </div>

      <aside data-detail className="space-y-4 lg:sticky lg:top-[calc(var(--shell-h)+1rem)] lg:self-start">
        <ActionPanel job={job} liked={reactions.isLiked(job.id)} favorite={reactions.isFavorite(job.id)} onLike={() => reactions.toggleLike(job.id)} onFavorite={() => reactions.toggleFavorite(job.id)} />
        {job.preferredLocations.length > 0 && <div className="flex items-start gap-3 rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70"><GlobeHemisphereWest size={18} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" /><div><p className="text-sm font-semibold">Preferred location</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{job.preferredLocations.join(', ')} · {job.preferredLocationMandatory ? 'required by the client' : 'not required'}</p></div></div>}
        <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
          <p className="flex items-center gap-2 text-sm font-semibold"><ClockCounterClockwise size={16} />Timeline</p>
          <ol className="mt-4 space-y-3 border-l border-[var(--line)] pl-4">{timeline.map(([text, value], index) => <li key={text} className="relative text-xs leading-5"><span className={`absolute -left-[1.3rem] top-1.5 size-2 rounded-full ring-2 ring-[var(--surface)] ${index === 0 ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`} />{text}<span className="block text-[11px] text-[var(--muted)]">{clock(value)} · {timeAgo(value, now)}</span></li>)}</ol>
        </div>
      </aside>
    </div>
  </main></Shell>
}
