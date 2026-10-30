import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ArrowSquareOut, DotsThree, Shuffle, X } from '@phosphor-icons/react'
import { JobDetailView } from '../pages/JobDetail'
import { LiveJobDetailView } from '../pages/LiveJobDetail'
import { nextSimilarJob } from '../lib/jobSignals'
import ErrorBoundary, { SectionError } from './ErrorBoundary'

// A job whose details fail to render shows this inside the drawer; the list behind it keeps working.
const DrawerError = (props) => <div className="p-4 sm:p-6"><SectionError {...props} title="This job could not be displayed" /></div>

const menuItem = 'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40'

/**
 * Right-hand preview of a job, showing the same content as its detail page.
 * `live` switches to the live Upwork detail; `jobs` is the loaded list used for "Next similar".
 */
// `onApply(job)` runs when the header's Apply on Upwork is clicked, so the Live jobs page can mark the job applied.
// A CRM job becomes Applied only through Send proposal (in the job's apply box), so its Apply on Upwork, which only
// opens Upwork, is the secondary style. An already-applied job has no Apply on Upwork in the header.
export default function JobDrawer({ job, jobs = [], live = false, onSelect, onClose, onApply }) {
  const panel = useRef(null)
  const body = useRef(null)
  const closeRef = useRef(onClose)
  const menuRoot = useRef(null)
  const menuOpenRef = useRef(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [visited, setVisited] = useState(() => [job.id])
  const path = live ? `/live-jobs/${job.id}` : `/jobs/${job.id}`
  const similar = nextSimilarJob(job, jobs, visited)

  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tween = reduce ? null : gsap.fromTo(panel.current, { xPercent: 100 }, { xPercent: 0, duration: .5, ease: 'power4.out' })
    // Escape closes the actions menu first, then the drawer; never while a modal dialog is open on top.
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if (menuOpenRef.current) setMenuOpen(false)
      else closeRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { tween?.kill(); document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [])
  useEffect(() => { body.current?.scrollTo({ top: 0 }) }, [job.id])
  useEffect(() => {
    menuOpenRef.current = menuOpen
    if (!menuOpen) return undefined
    const dismiss = (event) => { if (!menuRoot.current?.contains(event.target)) setMenuOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [menuOpen])

  const goNext = () => {
    setMenuOpen(false)
    if (!similar) return
    setVisited((current) => [...current, similar.id])
    onSelect(similar)
  }
  // Without noopener the new tab inherits sessionStorage, which live jobs are read from.
  const openInNewWindow = () => { setMenuOpen(false); window.open(path, '_blank') }

  return createPortal(
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[90] flex justify-end bg-[var(--ink)]/45">
      {/* No backdrop blur and an isolated, contained panel: a blurred layer under the scroller gets re-rendered on every scroll frame. */}
      <aside ref={panel} role="complementary" aria-label={`Job preview: ${job.title}`} className="flex h-full w-full max-w-[min(96vw,72rem)] xl:max-w-[76rem] 2xl:max-w-[82rem] flex-col overflow-hidden bg-[var(--paper)] shadow-[-35px_0_90px_rgba(0,0,0,.22)] ring-1 ring-[var(--line)] [contain:layout_paint] sm:rounded-l-[2rem]">
        <header className="flex items-center gap-2 border-b border-[var(--line)]/70 bg-[var(--surface)] px-4 py-3 sm:rounded-tl-[2rem] sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">{live ? 'Live job preview' : 'Job preview'}</p>
            <p className="truncate text-sm font-semibold" title={job.title}>{job.title}</p>
          </div>
          {job.applyUrl && job.status !== 'Applied' && <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" onClick={() => onApply?.(job)} className={`${live ? 'upwork-apply-button' : 'upwork-view-button'} inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-bold`}><span className="relative z-10"><span className="sm:hidden">Apply</span><span className="hidden sm:inline">Apply on Upwork</span></span><ArrowSquareOut size={14} weight="bold" className="relative z-10 shrink-0" /></a>}
          <div ref={menuRoot} className="relative shrink-0">
            <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={menuOpen} aria-label="More actions" title="More actions" className={`grid size-9 place-items-center rounded-full ring-1 transition-colors ${menuOpen ? 'bg-[var(--lime)] !text-[var(--on-lime)] ring-[var(--lime-dark)]/35' : 'text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}><DotsThree size={18} weight="bold" /></button>
            {menuOpen && <div className="absolute right-0 top-11 z-50 w-64 rounded-[1.5rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgb(var(--shadow-rgb)/.2)] ring-1 ring-black/5">
              <div role="menu" aria-label="Job preview actions" className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-2">
                <button type="button" role="menuitem" onClick={goNext} disabled={!similar} title={similar ? `Next similar: ${similar.title}` : undefined} className={menuItem}><Shuffle size={15} weight="bold" className="shrink-0" /><span className="min-w-0 flex-1"><span className="block">Next similar</span>{!similar && <span className="block text-[10px] font-medium">No more similar jobs loaded</span>}</span></button>
                <button type="button" role="menuitem" onClick={openInNewWindow} className={menuItem}><ArrowSquareOut size={15} weight="bold" className="shrink-0" />Open in new window</button>              </div>
            </div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform hover:scale-105"><X size={15} weight="bold" /></button>
        </header>
        <div ref={body} className="drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          <ErrorBoundary name="job-drawer" resetKey={job.id} fallback={DrawerError}>
            {live ? <LiveJobDetailView key={job.id} id={job.id} job={job} embedded /> : <JobDetailView key={job.id} id={job.id} initialJob={job} embedded />}
          </ErrorBoundary>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
