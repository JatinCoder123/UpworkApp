import { ArrowSquareOut, Check, Eye, Heart, LinkSimple, MicrosoftTeamsLogo, PaperPlaneTilt, Star, UsersThree, X } from '@phosphor-icons/react'
import { useCopied } from './JobDetailParts'
import { jobShareLink } from '../lib/jobSignals'

// "$45–$100/hr" or "Hourly $45–$100" reads as a large amount with a small unit.
export function Price({ job, className = '' }) {
  const text = String(job.budget || '').replace(/^(hourly|fixed(?:[\s-]price)?)\s*:?\s*/i, '')
  if (!/\d/.test(text)) return <p className={`text-lg font-semibold tracking-[-.02em] text-[var(--muted)] ${className}`}>{job.budget || 'Budget not specified'}</p>
  const match = text.match(/^(.*?)\s*\/\s*(?:hr|hour)$/i)
  const hourly = Boolean(match) || job.type === 'Hourly'
  return <p className={`min-w-0 truncate text-[1.65rem] font-bold leading-none tracking-[-.04em] ${className}`} title={job.budget}>{match ? match[1] : text}{hourly && <span className="ml-0.5 text-sm font-medium tracking-normal text-[var(--muted)]">/hr</span>}</p>
}

const jobChips = (job) => [job.type, job.level !== 'Not specified' && job.level, job.duration !== 'Duration not set' && job.duration].filter(Boolean)

export function Chips({ job }) {
  const chips = jobChips(job)
  if (!chips.length) return null
  return <div className="flex flex-wrap gap-1.5">{chips.map((chip) => <span key={chip} className="rounded-full bg-[var(--frame)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">{chip}</span>)}</div>
}

const squareButton = (active) => `grid h-11 min-w-11 place-items-center rounded-2xl ring-1 transition-all duration-300 active:scale-90 ${active ? 'bg-[var(--ink)] text-white ring-[var(--ink)]' : 'bg-[var(--raised)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`

/** Price, apply, status and sharing controls for the job detail page and preview drawer. */
export default function JobApplySection({ job, statusLabel, applied, dismissed, onApplied, onDismiss, liked, favorite, onLike, onFavorite, onShare }) {
  const [copied, copy] = useCopied()
  const segment = (active, tone) => `flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-xs font-semibold transition-colors ${active ? tone : 'text-[var(--muted)] hover:text-[var(--ink)]'}`

  return <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <div className="flex items-start justify-between gap-3">
      <Price job={job} />
      {statusLabel && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--frame)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]"><span className="size-1.5 rounded-full bg-current" />{statusLabel}</span>}
    </div>
    <div className="mt-3"><Chips job={job} /></div>

    <div className="mt-5 flex gap-2">
      {job.applyUrl
        ? <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="upwork-apply-button flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold"><span className="relative z-10 truncate">Apply on Upwork</span><ArrowSquareOut size={15} weight="bold" className="relative z-10 shrink-0" /></a>
        : <span className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-[var(--frame)] text-xs font-semibold text-[var(--muted)]">No Upwork link</span>}
      {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label="View job on Upwork" title="View job on Upwork" className={squareButton(false)}><Eye size={17} weight="bold" /></a>}
    </div>

    <div className="mt-2 flex h-11 gap-1 rounded-2xl bg-[var(--raised)] p-1 ring-1 ring-[var(--line)]">
      <button type="button" onClick={onApplied} aria-pressed={applied} className={segment(applied, 'bg-[var(--lime)]/45 text-[#26320b]')}><PaperPlaneTilt size={14} weight={applied ? 'fill' : 'regular'} />Applied</button>
      <button type="button" onClick={onDismiss} aria-pressed={dismissed} className={segment(dismissed, 'bg-[var(--bad-bg)] text-[var(--bad)]')}><X size={14} />Not a fit</button>
    </div>

    <div className="mt-2 grid grid-cols-5 gap-2">
      <button type="button" onClick={onLike} aria-pressed={liked} aria-label={liked ? 'Unlike job' : 'Like job'} title={liked ? 'Unlike' : 'Like'} className={squareButton(liked)}><Heart size={16} weight={liked ? 'fill' : 'regular'} /></button>
      <button type="button" onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} title={favorite ? 'Remove from favorites' : 'Add to favorites'} className={squareButton(favorite)}><Star size={16} weight={favorite ? 'fill' : 'regular'} /></button>
      <button type="button" onClick={() => copy('link', jobShareLink(job))} aria-label="Copy job link" title={copied === 'link' ? 'Copied' : 'Copy link'} className={squareButton(false)}>{copied === 'link' ? <Check size={16} weight="bold" className="text-[var(--accent-strong)]" /> : <LinkSimple size={16} />}</button>
      <button type="button" onClick={() => onShare('teams')} aria-label="Share in Teams" title="Share in Teams" className={squareButton(false)}><MicrosoftTeamsLogo size={17} weight="fill" className="text-[#4b53bc]" /></button>
      <button type="button" onClick={() => onShare('notify')} aria-label="Notify team" title="Notify team" className={squareButton(false)}><UsersThree size={16} weight="bold" /></button>
    </div>
  </div>
}
