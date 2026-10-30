import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from '@phosphor-icons/react'
import { PALETTES, PALETTE_KEY, storedPalette } from '../lib/palette'

export default function PalettePicker() {
  const [palette, setPalette] = useState(storedPalette)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const closeOnEscape = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])
  // Same circular reveal as the light/dark toggle, from the clicked option.
  const choose = (event, next) => {
    setOpen(false)
    if (next === palette) return
    document.documentElement.style.setProperty('--theme-x', `${event.clientX}px`)
    document.documentElement.style.setProperty('--theme-y', `${event.clientY}px`)
    const apply = () => {
      document.documentElement.dataset.palette = next
      try { localStorage.setItem(PALETTE_KEY, next) } catch { /* storage blocked: palette still applies for this page */ }
      setPalette(next)
    }
    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply)
    else apply()
  }
  return <div ref={ref} className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)} aria-label="Color theme" title="Color theme" className="relative grid size-9 place-items-center rounded-full bg-[var(--ink)]/5 text-[var(--text)] ring-1 ring-black/5 transition-colors hover:bg-(--lime-tint)/35 hover:text-[var(--accent-strong)]">
      <Palette size={17} weight="light" />
      <span aria-hidden="true" className="absolute right-1 top-1 size-2 rounded-full bg-[var(--lime)] ring-2 ring-[var(--surface)]" />
    </button>
    {open && <div role="menu" aria-label="Color theme" className="absolute right-0 top-12 z-40 w-64 rounded-[1.25rem] bg-black/5 p-1.5 ring-1 ring-black/5 shadow-[0_24px_70px_rgb(var(--shadow-rgb)/.18)]"><div className="rounded-[calc(1.25rem-.375rem)] bg-[var(--surface)] p-1.5">
      <p className="px-3 pb-1.5 pt-2 text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Color theme</p>
      {PALETTES.map((option) => {
        const active = option.id === palette
        return <button key={option.id} type="button" role="menuitemradio" aria-checked={active} onClick={(event) => choose(event, option.id)} className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${active ? 'bg-[var(--paper)] ring-1 ring-[var(--line)]' : 'hover:bg-black/[.04] dark:hover:bg-white/[.06]'}`}>
          <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">{option.swatch.map((colour) => <span key={colour} className="size-5 rounded-full ring-2 ring-[var(--surface)] shadow-[inset_0_0_0_1px_rgba(0,0,0,.12)]" style={{ background: colour }} />)}</span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-bold text-[var(--text)]">{option.name}</span><span className="block truncate text-[10px] text-[var(--muted)]">{option.note}</span></span>
          {active && <Check size={14} weight="bold" className="shrink-0 text-[var(--accent-strong)]" />}
        </button>
      })}
    </div></div>}
  </div>
}
