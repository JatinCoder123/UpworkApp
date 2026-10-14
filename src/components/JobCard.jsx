import { Link } from 'react-router-dom'
import { ArrowUpRight, Briefcase, CalendarBlank, Clock, Heart, Hourglass, MapPin, SealCheck, Star, Target } from '@phosphor-icons/react'
import { StatusPill } from './ui'
import { scoreJob } from '../lib/scoring'
import { timeAgo } from '../lib/time'
import { skillStyle } from '../lib/jobSignals'

function matchTone(score) {
  if (score >= 75) return 'var(--lime-dark)'
  if (score >= 55) return '#d9a53a'
  return 'var(--danger)'
}

function Fact({ icon: Icon, children }) {
  if (!children) return null
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"><Icon size={13} weight="bold" className="shrink-0 opacity-70" />{children}</span>
}

function ReactionButton({ active, onClick, label, children }) {
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} title={label} className={`grid size-9 place-items-center rounded-full ring-1 transition-all duration-300 active:scale-90 ${active ? 'bg-[var(--ink)] text-white ring-[var(--ink)]' : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}>{children}</button>
}

export default function JobCard({ job, index, now, liked, favorite, onLike, onFavorite }) {
  const fit = job.match > 0 ? null : scoreJob(job)
  const score = fit ? fit.score : job.match
  const matchLabel = fit ? fit.verdict : job.fitLabel
  const skills = job.skills?.length ? job.skills : job.tags
  const visibleSkills = skills.slice(0, 5)
  const client = job.clientStats
  const isNew = job.status === 'New'
  const summary = job.summary || job.description

  return <article id={`job-${job.id}`} data-card data-job-id={job.id} className="group relative scroll-mt-[calc(var(--shell-h)+1rem)] rounded-[1.6rem] bg-[var(--frame)] p-1 ring-1 ring-[var(--line)]/60 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)]">
    <span aria-hidden="true" className="absolute inset-y-6 left-0 w-1 rounded-r-full" style={{ background: matchTone(score) }} />
    <div className="grid overflow-hidden rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] md:grid-cols-[minmax(0,1fr)_16.5rem]">
      <Link to={`/jobs/${job.id}`} className="block min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {index != null && <span className="font-mono text-[11px] font-bold text-[var(--muted)]">{String(index + 1).padStart(2, '0')}</span>}
          <StatusPill status={job.status} />
          {isNew && <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-60" /><span className="relative size-2 rounded-full bg-[var(--accent)]" /></span>}
          <time dateTime={job.postedAt} title={job.posted} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-strong)]"><Clock size={12} weight="bold" />{timeAgo(job.postedAt, now) || job.posted}</time>
          <span className="truncate text-[11px] font-medium text-[var(--muted)]">{job.jobId}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-.025em] transition-colors duration-300 group-hover:text-[var(--accent-strong)] sm:text-[1.2rem]">{job.title}</h3>
        {summary && <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-6 text-[var(--muted)]">{summary}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="rounded-lg bg-[var(--price-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--price-text)] ring-1 ring-[var(--price-line)]">{job.budget}</span>
          <Fact icon={Briefcase}>{job.level !== 'Not specified' && job.level}</Fact>
          <Fact icon={CalendarBlank}>{job.duration !== 'Duration not set' && job.duration}</Fact>
          <Fact icon={Hourglass}>{job.workload}</Fact>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => <span key={skill} style={skillStyle(skill)} className="skill-chip max-w-44 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold">{skill}</span>)}
          {skills.length > visibleSkills.length && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">+{skills.length - visibleSkills.length}</span>}
        </div>
      </Link>

      <aside className="flex flex-col gap-4 border-t border-[var(--line)]/70 bg-[var(--paper)]/45 p-5 md:border-l md:border-t-0">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">About the client</p>
          <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold"><MapPin size={14} weight="bold" className="text-[var(--muted)]" />{client.country || 'Location not shared'}</p>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            {client.rating != null ? <><Star size={13} weight="fill" className="text-[#e6a817]" /><span className="font-semibold text-[var(--text)]">{client.rating.toFixed(1)}</span>{client.reviews != null && <span>({client.reviews} reviews)</span>}</> : 'No reviews yet'}
          </p>
          <p className="mt-1.5 text-xs text-[var(--muted)]">{[client.hires != null && `${client.hires} hires`, client.proposals != null && `${client.proposals} proposals`].filter(Boolean).join(' · ')}</p>
          <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${client.paymentVerified ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}><SealCheck size={11} weight="fill" />{client.paymentVerified ? 'Payment verified' : 'Payment unverified'}</p>
        </div>
        <div>
          <div className="flex items-center justify-between text-[11px] font-bold"><span className="flex items-center gap-1 text-[var(--muted)]"><Target size={12} weight="bold" />{job.match > 0 ? 'AI match' : 'Fit'}</span><span>{score}%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[.07] dark:bg-white/10"><div className="h-full rounded-full" style={{ width: `${score}%`, background: matchTone(score) }} /></div>
          {matchLabel && <p className="mt-1.5 line-clamp-1 text-[11px] text-[var(--muted)]" title={matchLabel}>{matchLabel}</p>}
        </div>
        <div className="mt-auto flex items-center gap-2">
          <ReactionButton active={liked} onClick={onLike} label={liked ? 'Unlike job' : 'Like job'}><Heart size={15} weight={liked ? 'fill' : 'bold'} /></ReactionButton>
          <ReactionButton active={favorite} onClick={onFavorite} label={favorite ? 'Remove from favorites' : 'Add to favorites'}><Star size={15} weight={favorite ? 'fill' : 'bold'} /></ReactionButton>
          <Link to={`/jobs/${job.id}`} aria-label={`Open ${job.title}`} className="ml-auto grid size-9 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform duration-500 group-hover:rotate-12"><ArrowUpRight size={15} /></Link>
        </div>
      </aside>
    </div>
  </article>
}
