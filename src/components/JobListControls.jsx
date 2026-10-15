import { useEffect, useRef, useState } from 'react'
import { ArrowsDownUp, CaretDown, Check, SlidersHorizontal } from '@phosphor-icons/react'
import { EMPTY_EXTRA_FILTERS } from '../lib/preferences'
import { countExtraFilters } from '../lib/jobSignals'

function usePopover() {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    const escape = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [open])
  return { open, setOpen, root }
}

const trigger = (active) => `flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 transition-all duration-300 ${active ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/35' : 'bg-[var(--paper)] text-[var(--muted)] ring-black/5 hover:text-[var(--ink)]'}`
const sheet = 'absolute right-0 top-12 z-50 rounded-[1.5rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5'

export function SortMenu({ value, options, onChange, label = 'Sort jobs' }) {
  const { open, setOpen, root } = usePopover()
  const current = options.find((option) => option.id === value) || options[0]
  return <div ref={root} className="relative shrink-0">
    <button type="button" aria-expanded={open} aria-haspopup="listbox" aria-label={`${label}: ${current.label}`} onClick={() => setOpen((state) => !state)} className={trigger(value !== options[0].id)}>
      <ArrowsDownUp size={15} weight="bold" /><span className="hidden max-w-40 truncate sm:block">{current.label}</span><CaretDown size={12} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className={`${sheet} w-64`}>
      <ul role="listbox" aria-label={label} className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-2">
        <li className="px-3 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Sort by</li>
        {options.map((option) => <li key={option.id}><button type="button" role="option" aria-selected={option.id === value} onClick={() => { onChange(option.id); setOpen(false) }} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${option.id === value ? 'bg-[var(--lime)]/35 text-[var(--ink)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`}>{option.label}{option.id === value && <Check size={13} weight="bold" />}</button></li>)}
      </ul>
    </div>}
  </div>
}

const JOB_TYPES = [['any', 'Any'], ['hourly', 'Hourly'], ['fixed', 'Fixed price']]

export function MoreFiltersMenu({ value, onChange }) {
  const { open, setOpen, root } = usePopover()
  const count = countExtraFilters(value)
  return <div ref={root} className="relative shrink-0">
    <button type="button" aria-expanded={open} aria-label="More filters" onClick={() => setOpen((state) => !state)} className={trigger(count > 0)}>
      <SlidersHorizontal size={15} weight="bold" /><span className="hidden sm:block">More filters</span>
      {count > 0 && <span className="grid size-4.5 place-items-center rounded-full bg-[var(--ink)] text-[9px] font-bold text-white">{count}</span>}
    </button>
    {open && <div className={`${sheet} w-[min(21rem,calc(100vw-2rem))]`}>
      <div className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">More filters</p>
          <button type="button" disabled={!count} onClick={() => onChange(EMPTY_EXTRA_FILTERS)} className="rounded-full px-2.5 py-1 text-[11px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40">Reset</button>
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Job type</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[var(--paper)] p-1 ring-1 ring-[var(--line)]/70" role="radiogroup" aria-label="Job type">
          {JOB_TYPES.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={value.jobType === id} onClick={() => onChange({ ...value, jobType: id })} className={`whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${value.jobType === id ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]'}`}>{label}</button>)}
        </div>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Client location</p>
        <label className="mt-2 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-[var(--paper)] p-3 ring-1 ring-[var(--line)]/70">
          <span className="min-w-0"><span className="block text-xs font-semibold">USA clients only</span><span className="mt-0.5 block text-[11px] leading-4 text-[var(--muted)]">Hide clients outside the United States</span></span>
          <input type="checkbox" role="switch" checked={value.usaOnly} onChange={(event) => onChange({ ...value, usaOnly: event.target.checked })} className="peer sr-only" />
          <span aria-hidden="true" className="usa-switch relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--lime-dark)]/60 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:shadow-[0_1px_3px_rgba(0,0,0,.3)] after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>
    </div>}
  </div>
}
