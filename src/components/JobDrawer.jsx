import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ArrowSquareOut, Shuffle, X } from '@phosphor-icons/react'
import { JobDetailView } from '../pages/JobDetail'
import { LiveJobDetailView } from '../pages/LiveJobDetail'
import { nextSimilarJob } from '../lib/jobSignals'

const headerButton = 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] hover:ring-[var(--lime-dark)] disabled:pointer-events-none disabled:opacity-40'

/**
 * Right-hand preview of a job, showing the same content as its detail page.
 * `live` switches to the live Upwork detail; `jobs` is the loaded list used for "Next similar".
 */
export default function JobDrawer({ job, jobs = [], live = false, onSelect, onClose }) {
  const panel = useRef(null)
  const body = useRef(null)
  const closeRef = useRef(onClose)
  const [visited, setVisited] = useState(() => [job.id])
  const path = live ? `/live-jobs/${job.id}` : `/jobs/${job.id}`
  const similar = nextSimilarJob(job, jobs, visited)

  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tween = reduce ? null : gsap.fromTo(panel.current, { xPercent: 100 }, { xPercent: 0, duration: .5, ease: 'power4.out' })
    const closeOnEscape = (event) => event.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]') && closeRef.current()
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { tween?.kill(); document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [])
  useEffect(() => { body.current?.scrollTo({ top: 0 }) }, [job.id])

  const goNext = () => {
    if (!similar) return
    setVisited((current) => [...current, similar.id])
    onSelect(similar)
  }
  // Without noopener the new tab inherits sessionStorage, which live jobs are read from.
  const openInNewWindow = () => window.open(path, '_blank')

  return createPortal(
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[90] flex justify-end bg-[var(--ink)]/45">
      {/* No backdrop blur and an isolated, contained panel: a blurred layer under the scroller gets re-rendered on every scroll frame. */}
      <aside ref={panel} role="complementary" aria-label={`Job preview: ${job.title}`} className="flex h-full w-full max-w-[52rem] flex-col overflow-hidden bg-[var(--paper)] shadow-[-30px_0_80px_rgba(0,0,0,.18)] ring-1 ring-[var(--line)] [contain:layout_paint] sm:rounded-l-[2rem]">
        <header className="flex items-center gap-2 border-b border-[var(--line)]/70 bg-[var(--surface)] px-4 py-3 sm:rounded-tl-[2rem] sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">{live ? 'Live job preview' : 'Job preview'}</p>
            <p className="truncate text-sm font-semibold" title={job.title}>{job.title}</p>
          </div>
          <button type="button" onClick={goNext} disabled={!similar} title={similar ? `Next similar: ${similar.title}` : 'No more similar jobs loaded'} className={`${headerButton} text-[var(--muted)]`}><Shuffle size={14} weight="bold" /><span className="hidden sm:inline">Next similar</span></button>
          <button type="button" onClick={openInNewWindow} title="Open in new window" aria-label="Open in new window" className={`${headerButton} text-[var(--muted)]`}><ArrowSquareOut size={15} weight="bold" /><span className="hidden md:inline">Open in new window</span></button>
          <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform hover:scale-105"><X size={15} weight="bold" /></button>
        </header>
        <div ref={body} className="drawer-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          {live ? <LiveJobDetailView key={job.id} id={job.id} job={job} embedded /> : <JobDetailView key={job.id} id={job.id} initialJob={job} embedded />}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
