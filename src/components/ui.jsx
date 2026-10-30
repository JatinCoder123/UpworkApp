import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { X } from '@phosphor-icons/react'

export const iconButton = 'grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ink)]/5 text-[var(--ink)] transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:scale-105 hover:bg-[var(--ink)] hover:text-white active:scale-95'
// A button in the Shell top bar's tray: flat on the tray, with a soft fill on hover and while its menu is open.
export const barButton = 'relative grid size-9 shrink-0 place-items-center rounded-full text-[var(--text)] transition-colors duration-300 hover:bg-[var(--paper)] hover:text-[var(--accent-strong)] aria-expanded:bg-[var(--paper)] aria-expanded:text-[var(--accent-strong)]'
// Page-level sticky bar that docks under the Shell header. The solid band hides content scrolling beneath it.
export const stickyBand = 'sticky top-[var(--shell-h)] z-20 -mx-4 bg-[var(--paper)] px-4 pb-3 pt-1 sm:-mx-6 sm:px-6 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-5 after:bg-gradient-to-b after:from-[var(--paper)] after:to-transparent'
export const primaryButton = 'group inline-flex items-center justify-center gap-3 rounded-full bg-[var(--ink)] py-2 pl-5 pr-2 text-sm font-semibold text-white transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50'

export function Mark() {
  return <img src="https://www.outrightcrm.com/wp-content/uploads/2021/09/cropped-cropped-cropped-OutRightcrm-web-192x192.png" alt="" aria-hidden="true" className="size-9 shrink-0 object-contain" />
}

export function StatusPill({ status }) {
  const colors = {
    New: 'bg-tone-indigo-bg text-tone-indigo',
    Seen: 'bg-tone-slate-bg text-tone-slate',
    Shortlisted: 'bg-tone-blue-bg text-tone-blue',
    Drafting: 'bg-warning-bg text-warning',
    Applied: 'bg-[var(--lime)] text-[var(--on-lime)]',
    Interview: 'bg-tone-mint-bg text-tone-mint',
    Won: 'bg-success-bg text-success',
    Lost: 'bg-[var(--paper)] text-[var(--muted)]',
    Rejected: 'bg-clay-bg text-clay ring-1 ring-clay-line',
  }[status] || 'bg-[var(--paper)] text-[var(--muted)]'
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] ${colors}`}><span className="size-1.5 rounded-full bg-current" />{status}</span>
}

// `contained`: the content scrolls inside the rounded frame (thin scrollbar), so a tall dialog's frame stays even.
// `full`: nearly the whole screen at a fixed height (use with `contained`; the content can split into panes that
// scroll on their own).
export function Modal({ children, onClose, wide = false, contained = false, full = false }) {
  const panel = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    const tween = gsap.fromTo(panel.current, { y: 34, autoAlpha: 0, scale: .97 }, { y: 0, autoAlpha: 1, scale: 1, duration: .55, ease: 'power4.out' })
    // With dialogs stacked (one opened from another), Esc closes only the top one.
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return
      const panels = document.querySelectorAll('[data-modal-panel]')
      if (panels[panels.length - 1] === panel.current) closeRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { tween.kill(); document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [])
  return createPortal(
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[100] grid place-items-end bg-[var(--ink)]/55 p-2 backdrop-blur-md sm:place-items-center sm:p-5"><div ref={panel} data-modal-panel role="dialog" aria-modal="true" className={`max-h-[92dvh] w-full rounded-[2rem] bg-black/10 p-1.5 ring-1 ring-white/15 ${contained ? 'flex overflow-hidden' : 'overflow-y-auto'} ${full ? 'h-[92dvh] max-w-[96rem]' : wide ? 'max-w-3xl' : 'max-w-xl'}`}>{contained
      ? <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[calc(2rem-.375rem)] bg-[var(--surface)] shadow-[0_40px_100px_rgba(0,0,0,.25)]"><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [scrollbar-color:color-mix(in_srgb,var(--muted)_40%,transparent)_transparent] [scrollbar-gutter:stable_both-edges] [scrollbar-width:thin] sm:p-8">{children}</div></div>
      : <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-5 shadow-[0_40px_100px_rgba(0,0,0,.25)] sm:p-8">{children}</div>}</div></div>,
    document.body,
  )
}

export function DialogHeader({ eyebrow, title, onClose }) {
  return <div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">{eyebrow}</span><h2 className="mt-3 text-3xl font-semibold tracking-[-.05em]">{title}</h2></div><button aria-label="Close dialog" className={iconButton} onClick={onClose}><X size={16} /></button></div>
}
