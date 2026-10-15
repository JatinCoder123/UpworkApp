import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Clock, Heart, Hourglass, MapPin, MicrosoftTeamsLogo, SealCheck, Star, Target } from '@phosphor-icons/react'
import { StatusPill } from './ui'
import { Chips, Price } from './JobApplySection'
import ShareJobDialog from './ShareJobDialog'
import { scoreJob } from '../lib/scoring'
import { timeAgo } from '../lib/time'
import { previewClick, skillStyle } from '../lib/jobSignals'

function matchTone(score) {
  if (score >= 75) return 'var(--lime-dark)'
  if (score >= 55) return '#d9a53a'
  return 'var(--danger)'
}

function Fact({ icon: Icon, children }) {
  if (!children) return null
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"><Icon size={13} weight="bold" className="shrink-0 opacity-70" />{children}</span>
}

function ReactionButton({ active, onClick, label, activeStyle, children }) {
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={label} title={label} className={`grid size-10 place-items-center rounded-full ring-1 transition-all duration-300 active:scale-90 ${active ? (activeStyle || 'bg-[var(--ink)] text-white ring-[var(--ink)]') : 'bg-[var(--raised)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}>{children}</button>
}

// Right side of a list card: price at a glance plus quick like, favorite and Teams share.
export function JobCardAside({ job, liked, favorite, onLike, onFavorite, extra }) {
  const [sharing, setSharing] = useState(false)
  return <aside className="flex flex-col gap-3 border-t border-[var(--line)]/70 bg-[var(--paper)]/45 p-5 md:border-l md:border-t-0">
    <Price job={job} />
    <Chips job={job} />
    {extra}
    <div className="mt-auto flex items-center gap-2 pt-2">
      <ReactionButton
        active={liked}
        onClick={onLike}
        label={liked ? 'Unlike job' : 'Like job'}
        activeStyle="bg-[#fff1f2] text-[#e11d48] ring-1 ring-[#fecdd3] dark:bg-[#fda4af]/20 dark:text-[#fda4af] dark:ring-[#fda4af]/30"
      >
        <Heart size={17} weight={liked ? 'fill' : 'regular'} className={liked ? 'text-[#fb7185] dark:text-[#fda4af]' : ''} />
      </ReactionButton>
      <ReactionButton
        active={favorite}
        onClick={onFavorite}
        label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        activeStyle="bg-[#fef9c3] text-[#b45309] ring-1 ring-[#fde047] dark:bg-[#fef08a]/20 dark:text-[#fde047] dark:ring-[#fde047]/30"
      >
        <Star size={17} weight={favorite ? 'fill' : 'regular'} className={favorite ? 'text-[#f59e0b] dark:text-[#fde047]' : ''} />
      </ReactionButton>
      <ReactionButton active={false} onClick={() => setSharing(true)} label="Share in Teams"><MicrosoftTeamsLogo size={17} weight="fill" className="text-[#4b53bc]" /></ReactionButton>
    </div>
    {sharing && <ShareJobDialog job={job} mode="teams" onClose={() => setSharing(false)} />}
  </aside>
}

export default function JobCard({ job, index, now, liked, favorite, onLike, onFavorite, onOpen }) {
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
    <div className="grid overflow-hidden rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] md:grid-cols-[minmax(0,1fr)_17rem]">
      <Link to={`/jobs/${job.id}`} onClick={previewClick(onOpen)} className="block min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {index != null && <span className="font-mono text-[11px] font-bold text-[var(--muted)]">{String(index + 1).padStart(2, '0')}</span>}
          <StatusPill status={job.status} />
          {favorite && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fef9c3] px-2.5 py-0.5 text-[10px] font-bold text-[#92400e] ring-1 ring-[#fde047]/60 dark:bg-[#fef08a]/15 dark:text-[#fde047] dark:ring-[#fde047]/30">
              <Star size={11} weight="fill" className="text-[#f59e0b] dark:text-[#fde047]" /> Favorited
            </span>
          )}
          {liked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffe4e6] px-2.5 py-0.5 text-[10px] font-bold text-[#be123c] ring-1 ring-[#fecdd3] dark:bg-[#fda4af]/15 dark:text-[#fda4af] dark:ring-[#fda4af]/30">
              <Heart size={11} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" /> Liked
            </span>
          )}
          {isNew && <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-60" /><span className="relative size-2 rounded-full bg-[var(--accent)]" /></span>}
          <time dateTime={job.postedAt} title={job.posted} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-strong)]"><Clock size={12} weight="bold" />{timeAgo(job.postedAt, now) || job.posted}</time>
          <span className="truncate text-[11px] font-medium text-[var(--muted)]">{job.jobId}</span>
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-.025em] transition-colors duration-300 group-hover:text-[var(--accent-strong)] sm:text-[1.2rem]">{job.title}</h3>
        {summary && <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-6 text-[var(--muted)]">{summary}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Fact icon={MapPin}>{client.country || 'Location not shared'}</Fact>
          {client.rating != null && <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)]"><Star size={13} weight="fill" className="text-[#e6a817]" /><span className="font-semibold text-[var(--text)]">{client.rating.toFixed(1)}</span>{client.reviews != null && `(${client.reviews})`}</span>}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${client.paymentVerified ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}><SealCheck size={11} weight="fill" />{client.paymentVerified ? 'Payment verified' : 'Payment unverified'}</span>
          <Fact icon={Briefcase}>{[client.hires != null && `${client.hires} hires`, client.proposals != null && `${client.proposals} proposals`].filter(Boolean).join(' · ')}</Fact>
          <Fact icon={Hourglass}>{job.workload}</Fact>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => <span key={skill} style={skillStyle(skill)} className="skill-chip max-w-44 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold">{skill}</span>)}
          {skills.length > visibleSkills.length && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">+{skills.length - visibleSkills.length}</span>}
        </div>
        <div className="mt-4 max-w-md">
          <div className="flex items-center justify-between gap-3 text-[11px] font-bold"><span className="flex items-center gap-1 text-[var(--muted)]"><Target size={12} weight="bold" />{job.match > 0 ? 'AI score' : 'Fit'}{matchLabel && <span className="truncate font-medium" title={matchLabel}>· {matchLabel}</span>}</span><span>{score}%</span></div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[.07] dark:bg-white/10"><div className="h-full rounded-full" style={{ width: `${score}%`, background: matchTone(score) }} /></div>
        </div>
      </Link>

      <JobCardAside job={job} liked={liked} favorite={favorite} onLike={onLike} onFavorite={onFavorite} />
    </div>
  </article>
}
