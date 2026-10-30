import { ArrowSquareOut, ArrowUUpLeft, BookmarkSimple, Check, Heart, LinkSimple, MicrosoftTeamsLogo, PaperPlaneTilt, Star, UsersThree, WarningCircle, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useCopied } from './JobDetailParts'
import UpworkLogo from './UpworkLogo'
import ProposalDialog from './ProposalDialog'
import { REJECT_REASONS } from '../lib/jobStatus'
import { jobShareLink } from '../lib/jobSignals'

// "$45–$100/hr" or "Hourly $45–$100" reads as a large amount with a small unit.
export function Price({ job, className = '' }) {
  const text = String(job.budget || '').replace(/^(hourly|fixed(?:[\s-]price)?)\s*:?\s*/i, '')
  if (!/\d/.test(text)) return <p className={`text-lg font-semibold tracking-[-.02em] text-[var(--muted)] ${className}`}>{job.budget || 'Budget not specified'}</p>
  const match = text.match(/^(.*?)\s*\/\s*(?:hr|hour)$/i)
  const hourly = Boolean(match) || job.type === 'Hourly'
  // A long budget ("USD 15.00 - USD 35.00/hr") goes on to a second line instead of being cut, so it reads the same in
  // the narrow price column of a wide screen as in the full-width one of a phone.
  return <p className={`min-w-0 break-words text-[1.65rem] font-bold leading-[1.1] tracking-[-.04em] ${className}`} title={job.budget}>{match ? match[1] : text}{hourly && <span className="ml-0.5 text-sm font-medium tracking-normal text-[var(--muted)]">/hr</span>}</p>
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
// `onApplied` runs when Apply on Upwork is clicked: live jobs track Applied with it. A CRM job becomes Applied only
// when its proposal is sent: Send proposal (CRM jobs with an Upwork link, not applied yet) is then the main button and
// Apply on Upwork, which only opens Upwork, the secondary one.
// `resolved` ('applied' | 'rejected') swaps Not a fit for that status and an Undo button wired to `onUndo`.
export default function JobApplySection({ job, statusLabel, dismissed, rejectReason = '', askReason = true, onApplied, onDismiss, liked, onLike, likeCount, saved, onSave, favorite, onFavorite, onShare, showApply = true, statusError, resolved = null, onUndo, undoing = false }) {
  const [copied, copy] = useCopied()
  const [proposing, setProposing] = useState(false)
  const canPropose = Boolean(job.applyUrl) && !['Live', 'Applied'].includes(job.status)
  const hasButtons = showApply || canPropose
  const segment = (active, tone) => `flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-xs font-semibold transition-colors ${active ? tone : 'text-[var(--muted)] hover:text-[var(--ink)]'}`

  return <div className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Client budget</p>
        <Price job={job} className="mt-1" />
      </div>
      {statusLabel && <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--frame)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]"><span className="size-1.5 rounded-full bg-current" />{statusLabel}</span>}
    </div>
    <div className="mt-3"><Chips job={job} /></div>

    {hasButtons && <div className="mt-5 grid gap-2">
      {canPropose && <button type="button" onClick={() => setProposing(true)} className="upwork-apply-button flex h-11 items-center justify-center rounded-2xl text-sm font-bold"><span className="relative z-10 inline-flex items-center gap-2"><PaperPlaneTilt size={15} weight="fill" />Send proposal</span></button>}
      {showApply && (job.applyUrl
        ? <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={onApplied} title={canPropose ? 'Opens the job on Upwork. Only a proposal sent from here marks it Applied.' : undefined} className={`${canPropose ? 'upwork-view-button h-10 text-xs' : 'upwork-apply-button h-11 text-sm'} flex min-w-0 items-center justify-center gap-2 rounded-2xl font-bold`}><span className="relative z-10 truncate">Apply on Upwork</span><ArrowSquareOut size={canPropose ? 13 : 15} weight="bold" className="relative z-10 shrink-0" /></a>
        : <span className="flex h-11 items-center justify-center rounded-2xl bg-[var(--frame)] text-xs font-semibold text-[var(--muted)]">No Upwork link</span>)}
    </div>}
    {proposing && <ProposalDialog job={job} onClose={() => setProposing(false)} />}

    {resolved && onUndo
      ? <div className={`${hasButtons ? 'mt-2' : 'mt-5'} flex items-center gap-3 rounded-2xl p-2.5 ring-1 ${resolved === 'applied' ? 'bg-[var(--lime-tint)]/20 text-[var(--accent-strong)] ring-[var(--lime-dark)]/25 dark:bg-[var(--lime-tint)]/10' : 'bg-[var(--reject-bg)] text-[var(--reject-text)] ring-[var(--reject-line)]'}`}>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${resolved === 'applied' ? 'bg-[var(--lime)] text-[var(--on-lime)]' : 'bg-[var(--reject-tile)]'}`}>{resolved === 'applied' ? <PaperPlaneTilt size={15} weight="fill" /> : <X size={15} weight="bold" />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-4">{resolved === 'applied' ? 'Applied' : 'Not a fit'}</p>
          <p className="mt-0.5 truncate text-[11px] leading-4 opacity-75">{resolved === 'applied' ? 'In your Applied list' : rejectReason ? `Reason: ${rejectReason}` : 'In your Rejected list'}</p>
        </div>
        <button type="button" onClick={onUndo} disabled={undoing} title="Move this job back to New" className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface)]/70 px-3 text-[11px] font-bold ring-1 transition-colors hover:bg-[var(--surface)] disabled:opacity-60 ${resolved === 'applied' ? 'ring-[var(--lime-dark)]/30' : 'ring-[var(--reject-line)]'}`}>
          {undoing ? <span className="size-3 animate-spin rounded-full border-2 border-[var(--line)] border-t-current" /> : <ArrowUUpLeft size={13} weight="bold" />}
          {undoing ? 'Undoing…' : 'Undo'}
        </button>
      </div>
      : <div className={`${hasButtons ? 'mt-2' : 'mt-5'} flex h-11 gap-1 rounded-2xl bg-[var(--raised)] p-1 ring-1 ring-[var(--line)]`}>
        {/* Applied button disabled: a CRM job becomes Applied when its proposal is sent (Send proposal).
        <button type="button" onClick={onApplied} aria-pressed={applied} className={segment(applied, 'bg-[var(--lime-tint)]/45 text-[var(--lime-ink)]')}><PaperPlaneTilt size={14} weight={applied ? 'fill' : 'regular'} />Applied</button>
        */}
        {/* CRM jobs ask why (kept in the activity log); live jobs keep their simple on / off toggle. */}
        {askReason
          ? <RejectReasonMenu dismissed={dismissed} onReject={onDismiss} />
          : <button type="button" onClick={() => onDismiss?.()} aria-pressed={dismissed} className={segment(dismissed, 'bg-[var(--reject-bg)] text-[var(--reject-text)] ring-1 ring-[var(--reject-line)]')}><X size={14} />Not a fit</button>}
      </div>}
    {statusError && <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{statusError}</p>}

    <div className={`mt-2 grid gap-2 ${GRID_COLS[[onLike, onSave || onFavorite, job.url].filter(Boolean).length + 3]}`}>
      {onLike && <button
        type="button"
        onClick={onLike}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike job' : 'Like job'}
        title={liked ? 'Unlike' : 'Like'}
        className={squareButton(liked, 'bg-like-bg text-like ring-1 ring-like-line')}
      >
        <span className="flex items-center gap-1">
          <Heart size={18} weight={liked ? 'fill' : 'regular'} className={liked ? 'text-like-icon' : ''} />
          <Count value={likeCount} />
        </span>
      </button>}
      {onSave ? <button
        type="button"
        onClick={onSave}
        aria-pressed={saved}
        aria-label={saved ? 'Unsave job' : 'Save job'}
        title={saved ? 'Unsave' : 'Save'}
        className={squareButton(saved, 'bg-info-bg text-info ring-1 ring-info-line')}
      >
        <BookmarkSimple size={18} weight={saved ? 'fill' : 'regular'} className={saved ? 'text-info-icon' : ''} />
      </button>
      : onFavorite && <button
        type="button"
        onClick={onFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        className={squareButton(favorite, 'bg-favorite-bg text-favorite ring-1 ring-favorite-line')}
      >
        <Star size={18} weight={favorite ? 'fill' : 'regular'} className={favorite ? 'text-favorite-icon' : ''} />
      </button>}
      <button type="button" onClick={() => copy('link', jobShareLink(job))} aria-label="Copy job link" title={copied === 'link' ? 'Copied' : 'Copy link'} className={squareButton(false)}>{copied === 'link' ? <Check size={16} weight="bold" className="text-[var(--accent-strong)]" /> : <LinkSimple size={16} />}</button>
      <button type="button" onClick={() => onShare('teams')} aria-label="Share in Teams" title="Share in Teams" className={squareButton(false)}><MicrosoftTeamsLogo size={17} weight="fill" className="text-brand-teams" /></button>
      <button type="button" onClick={() => onShare('notify')} aria-label="Notify team" title="Notify team" className={squareButton(false)}><UsersThree size={16} weight="bold" /></button>
      {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" aria-label="View job on Upwork" title="View job on Upwork" className={squareButton(false)}><UpworkLogo size={24} /></a>}
    </div>
  </div>
}

// "Not a fit" with a reason: the reasons from lib/jobStatus, or the user's own words. The reason is kept in the
// job's activity log (CRM) and shown on the job. Closes on a pick, an outside click or Escape.
function RejectReasonMenu({ dismissed, onReject }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [writing, setWriting] = useState(false)
  const root = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const away = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape) }
  }, [open])
  const pick = (reason) => { setOpen(false); setWriting(false); setCustom(''); onReject?.(reason) }
  const item = 'flex w-full items-center rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--paper)]'

  return <div ref={root} className="relative flex flex-1">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-pressed={dismissed} aria-haspopup="menu" aria-expanded={open} className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-xs font-semibold transition-colors ${dismissed || open ? 'bg-[var(--reject-bg)] text-[var(--reject-text)] ring-1 ring-[var(--reject-line)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}><X size={14} />Not a fit</button>
    {open && <div role="menu" aria-label="Why is this job not a fit?" className="absolute left-0 right-0 top-[calc(100%+.5rem)] z-30 rounded-2xl bg-[var(--surface)] p-1.5 shadow-[0_18px_50px_rgb(var(--shadow-rgb)/.18)] ring-1 ring-[var(--line)]">
      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Why is it not a fit?</p>
      {REJECT_REASONS.map((reason) => <button key={reason} type="button" role="menuitem" onClick={() => pick(reason)} className={item}>{reason}</button>)}
      {writing
        ? <form onSubmit={(event) => { event.preventDefault(); if (custom.trim()) pick(custom.trim()) }} className="flex items-center gap-1.5 p-1.5">
          <input autoFocus value={custom} onChange={(event) => setCustom(event.target.value)} maxLength={150} placeholder="Your reason" aria-label="Your reason" className="h-9 min-w-0 flex-1 rounded-xl bg-[var(--paper)] px-3 text-xs text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--lime-dark)]" />
          <button type="submit" disabled={!custom.trim()} className="h-9 shrink-0 rounded-xl bg-[var(--reject-bg)] px-3 text-xs font-bold text-[var(--reject-text)] ring-1 ring-[var(--reject-line)] disabled:opacity-40">Reject</button>
        </form>
        : <button type="button" role="menuitem" onClick={() => setWriting(true)} className={`${item} text-[var(--muted)]`}>Other reason…</button>}
      <p className="border-t border-[var(--line)] px-3 pb-1.5 pt-2.5 text-[11px] text-[var(--muted)]">The client will not be notified.</p>
    </div>}
  </div>
}
