import { ArrowSquareOut, ArrowUUpLeft, BookmarkSimple, Check, Eye, Heart, LinkSimple, MicrosoftTeamsLogo, PaperPlaneTilt, Star, UsersThree, WarningCircle, X } from '@phosphor-icons/react'
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

// Total likes from every user; hidden at zero and on live jobs, which have no totals. Saves are private and show no count.
const Count = ({ value }) => (Number.isFinite(value) && value > 0 ? <span className="font-mono text-xs font-bold tabular-nums">{value}</span> : null)
// Static class names, so Tailwind generates them: 3 share buttons plus like, save/favorite and the Upwork link when present.
const GRID_COLS = { 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6' }
const squareButton = (active, activeStyle) => `grid h-11 min-w-11 place-items-center rounded-2xl ring-1 transition-all duration-300 active:scale-90 ${active ? (activeStyle || 'bg-[var(--ink)] text-white ring-[var(--ink)]') : 'bg-[var(--raised)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`

/**
 * Price, apply, status and sharing controls for the job detail page and preview drawer.
 * `showApply` is off in the drawer, whose header already carries Apply on Upwork.
 */
// `onApplied` runs when Apply on Upwork is clicked; the separate Applied button is commented out below.
// `resolved` ('applied' | 'rejected') swaps Not a fit for that status and an Undo button wired to `onUndo`.
export default function JobApplySection({ job, statusLabel, dismissed, onApplied, onDismiss, liked, onLike, likeCount, saved, onSave, favorite, onFavorite, onShare, showApply = true, statusError, resolved = null, onUndo, undoing = false }) {
  const [copied, copy] = useCopied()
  const segment = (active, tone) => `flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-xs font-semibold transition-colors ${active ? tone : 'text-[var(--muted)] hover:text-[var(--ink)]'}`

  return <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    {showApply && <div className="mb-5 flex gap-2">
      {job.applyUrl
        ? <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={onApplied} className="upwork-apply-button flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl text-sm font-bold"><span className="relative z-10 truncate">Apply on Upwork</span><ArrowSquareOut size={15} weight="bold" className="relative z-10 shrink-0" /></a>
        : <span className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-[var(--frame)] text-xs font-semibold text-[var(--muted)]">No Upwork link</span>}
    </div>}

    <div className="flex items-start justify-between gap-3">
      <Price job={job} />
      {statusLabel && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--frame)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]"><span className="size-1.5 rounded-full bg-current" />{statusLabel}</span>}
    </div>
    <div className="mt-3"><Chips job={job} /></div>

    {resolved && onUndo
      ? <div className={`mt-5 flex items-center gap-3 rounded-2xl p-2.5 ring-1 ${resolved === 'applied' ? 'bg-[var(--lime)]/20 text-[var(--accent-strong)] ring-[var(--lime-dark)]/25 dark:bg-[var(--lime)]/10' : 'bg-[var(--reject-bg)] text-[var(--reject-text)] ring-[var(--reject-line)]'}`}>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${resolved === 'applied' ? 'bg-[var(--lime)] text-[#26320b]' : 'bg-[var(--reject-tile)]'}`}>{resolved === 'applied' ? <PaperPlaneTilt size={15} weight="fill" /> : <X size={15} weight="bold" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-4">{resolved === 'applied' ? 'Applied' : 'Not a fit'}</p>
          <p className="mt-0.5 truncate text-[11px] leading-4 opacity-75">{resolved === 'applied' ? 'In your Applied list' : 'In your Rejected list'}</p>
        </div>
        <button type="button" onClick={onUndo} disabled={undoing} title="Move this job back to New" className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface)]/70 px-3 text-[11px] font-bold ring-1 transition-colors hover:bg-[var(--surface)] disabled:opacity-60 ${resolved === 'applied' ? 'ring-[var(--lime-dark)]/30' : 'ring-[var(--reject-line)]'}`}>
          {undoing ? <span className="size-3 animate-spin rounded-full border-2 border-[var(--line)] border-t-current" /> : <ArrowUUpLeft size={13} weight="bold" />}
          {undoing ? 'Undoing…' : 'Undo'}
        </button>
      </div>
      : <div className="mt-5 flex h-11 gap-1 rounded-2xl bg-[var(--raised)] p-1 ring-1 ring-[var(--line)]">
        {/* Applied button disabled: clicking Apply on Upwork now marks the job as applied.
        <button type="button" onClick={onApplied} aria-pressed={applied} className={segment(applied, 'bg-[var(--lime)]/45 text-[#26320b]')}><PaperPlaneTilt size={14} weight={applied ? 'fill' : 'regular'} />Applied</button>
        */}
        <button type="button" onClick={onDismiss} aria-pressed={dismissed} className={segment(dismissed, 'bg-[var(--reject-bg)] text-[var(--reject-text)] ring-1 ring-[var(--reject-line)]')}><X size={14} />Not a fit</button>
      </div>}
    {statusError && <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{statusError}</p>}

    <div className={`mt-2 grid gap-2 ${GRID_COLS[[onLike, onSave || onFavorite, job.url].filter(Boolean).length + 3]}`}>
      {onLike && <button
        type="button"
        onClick={onLike}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike job' : 'Like job'}
        title={liked ? 'Unlike' : 'Like'}
        className={squareButton(liked, 'bg-[#fff1f2] text-[#e11d48] ring-1 ring-[#fecdd3] dark:bg-[#fda4af]/20 dark:text-[#fda4af] dark:ring-[#fda4af]/30')}
      >
        <span className="flex items-center gap-1">
          <Heart size={18} weight={liked ? 'fill' : 'regular'} className={liked ? 'text-[#fb7185] dark:text-[#fda4af]' : ''} />
          <Count value={likeCount} />
        </span>
      </button>}
      {onSave ? <button
        type="button"
        onClick={onSave}
        aria-pressed={saved}
        aria-label={saved ? 'Unsave job' : 'Save job'}
        title={saved ? 'Unsave' : 'Save'}
        className={squareButton(saved, 'bg-[#e0f2fe] text-[#0369a1] ring-1 ring-[#bae6fd] dark:bg-[#7dd3fc]/20 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/30')}
      >
        <BookmarkSimple size={18} weight={saved ? 'fill' : 'regular'} className={saved ? 'text-[#0284c7] dark:text-[#7dd3fc]' : ''} />
      </button>
      : onFavorite && <button
        type="button"
        onClick={onFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        className={squareButton(favorite, 'bg-[#fef9c3] text-[#b45309] ring-1 ring-[#fde047] dark:bg-[#fef08a]/20 dark:text-[#fde047] dark:ring-[#fde047]/30')}
      >
        <Star size={18} weight={favorite ? 'fill' : 'regular'} className={favorite ? 'text-[#f59e0b] dark:text-[#fde047]' : ''} />
      </button>}
      <button type="button" onClick={() => copy('link', jobShareLink(job))} aria-label="Copy job link" title={copied === 'link' ? 'Copied' : 'Copy link'} className={squareButton(false)}>{copied === 'link' ? <Check size={16} weight="bold" className="text-[var(--accent-strong)]" /> : <LinkSimple size={16} />}</button>
      <button type="button" onClick={() => onShare('teams')} aria-label="Share in Teams" title="Share in Teams" className={squareButton(false)}><MicrosoftTeamsLogo size={17} weight="fill" className="text-[#4b53bc]" /></button>
      <button type="button" onClick={() => onShare('notify')} aria-label="Notify team" title="Notify team" className={squareButton(false)}><UsersThree size={16} weight="bold" /></button>
      {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label="View job on Upwork" title="View job on Upwork" className={squareButton(false)}><Eye size={17} weight="bold" /></a>}
    </div>
  </div>
}
