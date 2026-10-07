import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { X } from '@phosphor-icons/react'

export const iconButton = 'grid size-10 shrink-0 place-items-center rounded-full bg-[var(--ink)]/5 text-[var(--ink)] transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:scale-105 hover:bg-[var(--ink)] hover:text-white active:scale-95'
export const primaryButton = 'group inline-flex items-center justify-center gap-3 rounded-full bg-[var(--ink)] py-2 pl-5 pr-2 text-sm font-semibold text-white transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50'

export function Mark({ dark = false }) {
  return <div className={`grid size-9 place-items-center rounded-xl ${dark ? 'bg-[var(--lime)] text-[var(--ink)]' : 'bg-[var(--ink)] text-[var(--lime)]'}`}><svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none"><path d="M5 5.5v7a6.5 6.5 0 0 0 13 0V6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="m14 9 4-4 4 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
}

export function StatusPill({ status }) {
  const colors = {
    New: 'bg-[var(--lavender)]/60 text-[#494268]',
    Seen: 'bg-[#e5e9de] text-[#566044]',
    Shortlisted: 'bg-[#dce7f5] text-[#31506f]',
    Drafting: 'bg-[#f6e8b8] text-[#655419]',
    Applied: 'bg-[var(--lime)] text-[#2d3a0c]',
    Interview: 'bg-[#d8e8dd] text-[#28533a]',
    Won: 'bg-[#bce8cd] text-[#174b2b]',
    Lost: 'bg-[#e5e1dc] text-[#5b5550]',
    Rejected: 'bg-[#f5d6cf] text-[#8f3427]',
  }[status] || 'bg-[var(--paper)] text-[var(--muted)]'
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] ${colors}`}><span className="size-1.5 rounded-full bg-current" />{status}</span>
}

export function Modal({ children, onClose, wide = false }) {
  const panel = useRef(null)
  useEffect(() => {
    const tween = gsap.fromTo(panel.current, { y: 34, autoAlpha: 0, scale: .97 }, { y: 0, autoAlpha: 1, scale: 1, duration: .55, ease: 'power4.out' })
    const closeOnEscape = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { tween.kill(); document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [onClose])
  return <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-40 grid place-items-end bg-[var(--ink)]/55 p-2 backdrop-blur-md sm:place-items-center sm:p-5"><div ref={panel} role="dialog" aria-modal="true" className={`max-h-[92dvh] w-full overflow-y-auto rounded-[2rem] bg-black/10 p-1.5 ring-1 ring-white/15 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}><div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-5 shadow-[0_40px_100px_rgba(0,0,0,.25)] sm:p-8">{children}</div></div></div>
}

export function DialogHeader({ eyebrow, title, onClose }) {
  return <div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">{eyebrow}</span><h2 className="mt-3 text-3xl font-semibold tracking-[-.05em]">{title}</h2></div><button aria-label="Close dialog" className={iconButton} onClick={onClose}><X size={16} /></button></div>
}
