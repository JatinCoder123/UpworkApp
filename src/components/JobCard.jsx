import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUUpLeft, BookmarkSimple, Briefcase, CheckCircle, Clock, Fire, Heart, Hourglass, MapPin, MicrosoftTeamsLogo, SealCheck, Star, Target } from '@phosphor-icons/react'
import { StatusPill } from './ui'
import { Chips, Price } from './JobApplySection'
import ShareJobDialog from './ShareJobDialog'
import UpworkLogo from './UpworkLogo'
import { scoreJob } from '../lib/scoring'
import { timeAgo } from '../lib/time'
import { previewClick, skillStyle } from '../lib/jobSignals'
import { asArray, asObject } from '../lib/safe'

function matchTone(score) {
  if (score >= 75) return 'var(--lime-dark)'
  if (score >= 55) return '#d9a53a'
  return 'var(--danger)'
}

function Fact({ icon: Icon, children }) {
  if (!children) return null
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"><Icon size={13} weight="bold" className="shrink-0 opacity-70" />{children}</span>
}

// A count (total from every user) turns the round button into a pill with the number beside the icon.
function ReactionButton({ active, onClick, label, activeStyle, count, children }) {
  const shown = Number.isFinite(count) && count > 0
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={shown ? `${label} (${count})` : label} title={label} className={`${shown ? 'flex h-7 items-center gap-1 px-2' : 'grid size-7 place-items-center'} rounded-full transition-all duration-300 active:scale-90 ${active ? activeStyle : 'text-[var(--muted)] hover:bg-[var(--raised)] hover:text-[var(--ink)]'}`}>
    {children}
    {shown && <span className="font-mono text-[11px] font-bold tabular-nums">{count}</span>}
  </button>
}

const LIKE_STYLE = 'bg-[#fff1f2] text-[#e11d48] ring-1 ring-[#fecdd3] dark:bg-[#fda4af]/20 dark:text-[#fda4af] dark:ring-[#fda4af]/30'
const SAVE_STYLE = 'bg-[#e0f2fe] text-[#0369a1] ring-1 ring-[#bae6fd] dark:bg-[#7dd3fc]/20 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/30'
const FAVORITE_STYLE = 'bg-[#fef9c3] text-[#b45309] ring-1 ring-[#fde047] dark:bg-[#fef08a]/20 dark:text-[#fde047] dark:ring-[#fde047]/30'

// Like, save (or favorite, on live jobs) and Teams share as one pill in the top-right corner of a card's main column.
// CRM jobs pass `onLike`, `onSave` and the total likes from every user; saves are private and show no count.
// Without `onLike` / `onSave` / `onFavorite` (live jobs) only Teams share and the Upwork link show.
// The parent must be `relative`; the card header keeps right padding so its pills never run underneath.
export function JobCardActions({ job, liked, onLike, likeCount, saved, onSave, favorite, onFavorite }) {
  const [sharing, setSharing] = useState(false)
  return <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-[var(--paper)] p-1">
    {onLike && <ReactionButton active={liked} onClick={onLike} label={liked ? 'Unlike job' : 'Like job'} count={likeCount} activeStyle={LIKE_STYLE}>
      <Heart size={15} weight={liked ? 'fill' : 'regular'} className={liked ? 'text-[#fb7185] dark:text-[#fda4af]' : ''} />
    </ReactionButton>}
    {onSave
      ? <ReactionButton active={saved} onClick={onSave} label={saved ? 'Unsave job' : 'Save job'} activeStyle={SAVE_STYLE}>
        <BookmarkSimple size={15} weight={saved ? 'fill' : 'regular'} className={saved ? 'text-[#0284c7] dark:text-[#7dd3fc]' : ''} />
      </ReactionButton>
      : onFavorite && <ReactionButton active={favorite} onClick={onFavorite} label={favorite ? 'Remove from favorites' : 'Add to favorites'} activeStyle={FAVORITE_STYLE}>
        <Star size={15} weight={favorite ? 'fill' : 'regular'} className={favorite ? 'text-[#f59e0b] dark:text-[#fde047]' : ''} />
      </ReactionButton>}
    <ReactionButton active={false} onClick={() => setSharing(true)} label="Share in Teams"><MicrosoftTeamsLogo size={15} weight="fill" className="text-[#4b53bc]" /></ReactionButton>
    {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label="View job on Upwork" title="View job on Upwork" className="grid size-8 place-items-center rounded-full transition-all duration-300 hover:bg-[var(--raised)] active:scale-90"><UpworkLogo size={20} /></a>}
    {sharing && <ShareJobDialog job={job} mode="teams" onClose={() => setSharing(false)} />}
  </div>
}

// Right side of a list card: price at a glance.
// Price and its chips stay together as one budget block; `score` sits below that block.
export function JobCardAside({ job, score, extra }) {
  return <aside className="flex flex-col gap-3 border-t border-[var(--line)]/70 bg-[var(--paper)]/45 p-5 md:border-l md:border-t-0">
    <div className="min-w-0 space-y-2.5">
      <Price job={job} />
      <Chips job={job} />
    </div>
    {score}
    {extra}
  </aside>
}

// `onUndo` (Applied and Rejected tabs) adds a button that puts the job back to Seen.
export default function JobCard({ job, index, now, rejectReason = '', liked, saved, onLike, onSave, onOpen, onUndo, undoing = false, undoError = '' }) {
  const fit = job.match > 0 ? null : scoreJob(job)
  const score = fit ? fit.score : job.match
  const matchLabel = fit ? fit.verdict : job.fitLabel
  const skills = asArray(job.skills).length ? job.skills : asArray(job.tags)
  const visibleSkills = skills.slice(0, 5)
  const client = asObject(job.clientStats)
  const isNew = job.status === 'New'
  const summary = job.summary || job.description

  return <article id={`job-${job.id}`} data-card data-job-id={job.id} className="group relative scroll-mt-[calc(var(--shell-h)+1rem)] rounded-[1.6rem] bg-[var(--frame)] p-1 ring-1 ring-[var(--line)]/60 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)]">
    <span aria-hidden="true" className="absolute inset-y-6 left-0 w-1 rounded-r-full" style={{ background: matchTone(score) }} />
    <div className="grid overflow-hidden rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="relative min-w-0">
      <Link to={`/jobs/${job.id}`} onClick={previewClick(onOpen)} className="block min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-48">
          {index != null && <span className="font-mono text-[11px] font-bold text-[var(--muted)]">{String(index + 1).padStart(2, '0')}</span>}
          <StatusPill status={job.status} />
          {job.status === 'Rejected' && rejectReason && <span title={`Not a fit: ${rejectReason}`} className="max-w-[18rem] truncate rounded-full bg-[#fbe1d8] px-2.5 py-0.5 text-[11px] font-bold text-[#9a3412] ring-1 ring-[#f1b39c] dark:bg-[#4a2318] dark:text-[#fdba9a] dark:ring-[#7c3a26]">{rejectReason}</span>}
          {saved && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-[10px] font-bold text-[#075985] ring-1 ring-[#bae6fd] dark:bg-[#7dd3fc]/15 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/30">
              <BookmarkSimple size={11} weight="fill" className="text-[#0284c7] dark:text-[#7dd3fc]" /> Saved
            </span>
          )}
          {liked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffe4e6] px-2.5 py-0.5 text-[10px] font-bold text-[#be123c] ring-1 ring-[#fecdd3] dark:bg-[#fda4af]/15 dark:text-[#fda4af] dark:ring-[#fda4af]/30">
              <Heart size={11} weight="fill" className="text-[#fb7185] dark:text-[#fda4af]" /> Liked
            </span>
          )}
          {isNew && <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-60" /><span className="relative size-2 rounded-full bg-[var(--accent)]" /></span>}
          <time dateTime={job.postedAt} title={job.posted} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-strong)]"><Clock size={12} weight="bold" />{timeAgo(job.postedAt, now) || job.posted}</time>
          {/* Solid colours only (no see-through tints), so it looks the same in every browser and theme. */}
          {job.preference && <span title="Matches your preferences" className="inline-flex items-center gap-1 rounded-full bg-[#fff1e6] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c] ring-1 ring-[#fed7aa] dark:bg-[#3b1d0e] dark:text-[#fdba74] dark:ring-[#7c2d12]"><Fire size={10} weight="fill" className="text-[#f97316]" />Hot</span>}
          {job.appliedAt && <span title={`You applied on ${job.appliedAt}`} className="inline-flex items-center gap-1 rounded-full bg-[var(--ok-bg)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--ok)]"><CheckCircle size={11} weight="fill" />You applied {job.appliedAgo || ''}{job.appliedAgo ? ' · ' : ''}{job.appliedAt}</span>}
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-.025em] transition-colors duration-300 group-hover:text-[var(--accent-strong)] sm:text-[1.2rem]">{job.title}</h3>
        {summary && <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-6 text-[var(--muted)]">{summary}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Fact icon={MapPin}>{client.country || 'Location not shared'}</Fact>
          {client.rating != null && <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--muted)]"><Star size={13} weight="fill" className="text-[#e6a817]" /><span className="font-semibold text-[var(--text)]">{Number(client.rating).toFixed(1)}</span>{client.reviews != null && `(${client.reviews})`}</span>}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${client.paymentVerified ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}><SealCheck size={11} weight="fill" />{client.paymentVerified ? 'Payment verified' : 'Payment unverified'}</span>
          <Fact icon={Briefcase}>{[client.hires != null && `${client.hires} hires`, client.proposals != null && `${client.proposals} proposals`].filter(Boolean).join(' · ')}</Fact>
          <Fact icon={Hourglass}>{job.workload}</Fact>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => <span key={skill} style={skillStyle(skill)} className="skill-chip max-w-44 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold">{skill}</span>)}
          {skills.length > visibleSkills.length && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">+{skills.length - visibleSkills.length}</span>}
        </div>
      </Link>
      <JobCardActions job={job} liked={liked} onLike={onLike} likeCount={job.engagement?.likesCount} saved={saved} onSave={onSave} />
      </div>

      <JobCardAside job={job} score={<div className="min-w-0 rounded-2xl bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]"><Target size={12} weight="bold" className="shrink-0" />{job.match > 0 ? 'AI score' : 'Fit score'}</span>
          <span className="text-sm font-bold tabular-nums tracking-[-.02em]">{score}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/[.07] dark:bg-white/10"><div className="h-full rounded-full" style={{ width: `${score}%`, background: matchTone(score) }} /></div>
        {matchLabel && <p className="mt-2 truncate text-[11px] font-medium text-[var(--muted)]" title={matchLabel}>{matchLabel}</p>}
      </div>} extra={onUndo && <div>
        <button type="button" onClick={onUndo} disabled={undoing} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)] disabled:opacity-60">
          {undoing ? <span className="size-3 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" /> : <ArrowUUpLeft size={13} weight="bold" />}
          {undoing ? 'Undoing…' : job.status === 'Applied' ? 'Undo applied' : 'Undo not a fit'}
        </button>
        {undoError && <p role="alert" className="mt-1.5 text-[11px] font-semibold text-[var(--bad)]">{undoError}</p>}
      </div>} />
    </div>
  </article>
}
