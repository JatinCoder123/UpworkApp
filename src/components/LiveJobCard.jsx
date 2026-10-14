import { Link } from 'react-router-dom'
import { ArrowSquareOut, ArrowUpRight, Briefcase, CalendarBlank, Clock, Heart, Hourglass, Lightning, MapPin, SealCheck, Sparkle, Star, Users } from '@phosphor-icons/react'
import { timeAgo } from '../lib/time'
import { competition, isEarlyBird, minutesSince } from '../lib/liveJobs'

// The left edge fades from lime to amber as a job ages across the scan window.
export function freshnessTone(minutes, windowMinutes) {
  const ratio = Math.min(1, minutes / Math.max(windowMinutes, 1))
  if (ratio < .34) return 'var(--lime-dark)'
  if (ratio < .67) return '#d9a53a'
  return 'var(--orange)'
}

export function CompetitionMeter({ applicants, compact = false }) {
  const level = competition(applicants)
  return <div>
    <div className="flex items-center justify-between text-[11px] font-bold"><span className="flex items-center gap-1 text-[var(--muted)]"><Users size={12} weight="bold" />{applicants} applicant{applicants === 1 ? '' : 's'}</span>{!compact && <span style={{ color: level.tone }}>{level.label}</span>}</div>
    <div className="live-meter mt-1.5 flex gap-1" style={{ '--meter': level.tone }} aria-label={`${level.label}: ${applicants} applicants`}>{[1, 2, 3, 4].map((step) => <span key={step} data-on={step <= level.level} />)}</div>
    {compact && <p className="mt-1.5 text-[11px] font-semibold" style={{ color: level.tone }}>{level.label}</p>}
  </div>
}

function Fact({ icon: Icon, children }) {
  if (!children) return null
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"><Icon size={13} weight="bold" className="shrink-0 opacity-70" />{children}</span>
}

function ReactionButton({ active, onClick, label, children }) {
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} title={label} className={`grid size-9 place-items-center rounded-full ring-1 transition-all duration-300 active:scale-90 ${active ? 'bg-[var(--ink)] text-white ring-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}>{children}</button>
}

export default function LiveJobCard({ job, index, now, windowMinutes, justIn, liked, favorite, onLike, onFavorite }) {
  const minutes = minutesSince(job.postedAt, now)
  const tone = freshnessTone(minutes, windowMinutes)
  const matched = new Set(job.matchedSkills.map((skill) => skill.toLowerCase()))
  const skills = [...job.skills].sort((a, b) => matched.has(b.toLowerCase()) - matched.has(a.toLowerCase()))
  const visibleSkills = skills.slice(0, 6)
  const client = job.clientStats
  const earlyBird = isEarlyBird(job, now)

  return <article id={`live-${job.id}`} data-card data-job-id={job.id} style={{ '--fresh': tone }} className={`live-card group scroll-mt-[calc(var(--shell-h)+1rem)] rounded-[1.6rem] bg-[var(--frame)] p-1 ring-1 ring-[var(--line)]/60 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)] ${justIn ? 'live-just-in' : ''}`}>
    <span aria-hidden="true" className="absolute inset-y-6 left-0 z-10 w-1 rounded-r-full" style={{ background: tone }} />
    <div className="relative grid overflow-hidden rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] md:grid-cols-[minmax(0,1fr)_16.5rem]">
      <Link to={`/live-jobs/${job.id}`} className="block min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {index != null && <span className="font-mono text-[11px] font-bold text-[var(--muted)]">{String(index + 1).padStart(2, '0')}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#c8e875]"><span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#c8e875] opacity-70" /><span className="relative size-1.5 rounded-full bg-[#c8e875]" /></span>Live</span>
          {justIn && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lime)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#26320b]"><Sparkle size={11} weight="fill" />Just in</span>}
          {earlyBird && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--warn)]"><Lightning size={11} weight="fill" />Early bird</span>}
          {job.renewedAt && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Renewed</span>}
          <time dateTime={job.postedAt} className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: tone }}><Clock size={12} weight="bold" />{timeAgo(job.postedAt, now)}</time>
          {job.tags[1] && <span className="truncate text-[11px] font-medium text-[var(--muted)]">{job.tags[1]}</span>}
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-.025em] transition-colors duration-300 group-hover:text-[var(--accent-strong)] sm:text-[1.2rem]">{job.title}</h3>
        <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-6 text-[var(--muted)]">{job.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="rounded-lg bg-[var(--price-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--price-text)] ring-1 ring-[var(--price-line)]">{job.type} · {job.budget}</span>
          <Fact icon={Briefcase}>{job.level !== 'Not specified' && job.level}</Fact>
          <Fact icon={CalendarBlank}>{job.duration !== 'Duration not set' && job.duration}</Fact>
          <Fact icon={Hourglass}>{job.workload}</Fact>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => <span key={skill} aria-pressed={matched.has(skill.toLowerCase())} title={matched.has(skill.toLowerCase()) ? 'Matched your search' : undefined} className="skill-tag max-w-44 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold">{skill}</span>)}
          {skills.length > visibleSkills.length && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">+{skills.length - visibleSkills.length}</span>}
        </div>
      </Link>

      <aside className="flex flex-col gap-4 border-t border-[var(--line)]/70 bg-[var(--paper)]/45 p-5 md:border-l md:border-t-0">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">About the client</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold"><MapPin size={14} weight="bold" className="text-[var(--muted)]" />{client.country || 'Location not shared'}</p>
          <p className="mt-1.5 text-xs text-[var(--muted)]">{[client.jobsPosted != null && `${client.jobsPosted} jobs posted`, client.hires != null && `${client.hires} hires`].filter(Boolean).join(' · ') || 'New to Upwork'}</p>
          <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${client.paymentVerified ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}><SealCheck size={11} weight="fill" />{client.paymentVerified ? 'Payment verified' : 'Payment unverified'}</p>
        </div>
        <CompetitionMeter applicants={job.applicants} />
        <div className="mt-auto flex items-center gap-2">
          <ReactionButton active={liked} onClick={onLike} label={liked ? 'Unlike job' : 'Like job'}><Heart size={15} weight={liked ? 'fill' : 'bold'} /></ReactionButton>
          <ReactionButton active={favorite} onClick={onFavorite} label={favorite ? 'Remove from favorites' : 'Add to favorites'}><Star size={15} weight={favorite ? 'fill' : 'bold'} /></ReactionButton>
          {job.applyUrl && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" aria-label={`Apply to ${job.title} on Upwork`} title="Apply on Upwork" className="grid size-9 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] ring-1 ring-[var(--lime-dark)]/40 transition-transform duration-300 hover:-translate-y-0.5"><ArrowSquareOut size={15} weight="bold" /></a>}
          <Link to={`/live-jobs/${job.id}`} aria-label={`Open ${job.title}`} className="ml-auto grid size-9 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform duration-500 group-hover:rotate-12"><ArrowUpRight size={15} /></Link>
        </div>
      </aside>
    </div>
  </article>
}
