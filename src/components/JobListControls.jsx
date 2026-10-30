import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowsDownUp, CaretDown, Check, MagnifyingGlass, MapPin, SlidersHorizontal } from '@phosphor-icons/react'
import { EMPTY_EXTRA_FILTERS } from '../lib/preferences'
import { CLIENT_LOCATIONS, POPULAR_CLIENT_LOCATIONS, clientLocation, countExtraFilters, searchClientLocations } from '../lib/jobSignals'

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

const trigger = (active) => `flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 transition-all duration-300 ${active ? 'bg-[var(--lime)] !text-[var(--on-lime)] ring-[var(--lime-dark)]/35' : 'bg-[var(--paper)] text-[var(--muted)] ring-black/5 hover:text-[var(--ink)]'}`
const sheet = 'absolute right-0 top-12 z-50 rounded-[1.5rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgb(var(--shadow-rgb)/.2)] ring-1 ring-black/5'
// A trigger on a --paper box (as fields there, see fieldTone): --surface, so it stands out in both themes.
const triggerOnPaper = (active) => (active ? trigger(true) : 'flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-all duration-300 hover:text-[var(--ink)]')

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
        {options.map((option) => <li key={option.id}><button type="button" role="option" aria-selected={option.id === value} onClick={() => { onChange(option.id); setOpen(false) }} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${option.id === value ? 'bg-[var(--lime-tint)]/35 text-[var(--ink)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`}>{option.label}{option.id === value && <Check size={13} weight="bold" />}</button></li>)}
      </ul>
    </div>}
  </div>
}

// A dropdown like the sort menu, for any short list of choices: [{ id, label }]. `align` opens it from the left or
// right edge; `icon` leads the button; `heading` titles the list; `onPaper` when it sits on a --paper box.
export function SelectMenu({ value, options, onChange, label, heading = label, icon: Icon, align = 'left', onPaper = false }) {
  const { open, setOpen, root } = usePopover()
  const current = options.find((option) => option.id === value) || options[0]
  return <div ref={root} className="relative shrink-0 text-xs font-semibold">
    <button type="button" aria-expanded={open} aria-haspopup="listbox" aria-label={`${label}: ${current.label}`} onClick={() => setOpen((state) => !state)} className={onPaper ? triggerOnPaper(false) : trigger(false)}>
      {Icon && <Icon size={15} weight="bold" />}<span className="max-w-48 truncate text-[var(--ink)]">{current.label}</span><CaretDown size={12} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className={`${sheet} ${align === 'left' ? '!left-0 !right-auto' : ''} w-60`}>
      <ul role="listbox" aria-label={label} className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-2">
        {heading && <li className="px-3 pb-1.5 pt-1 text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{heading}</li>}
        {options.map((option) => <li key={option.id}><button type="button" role="option" aria-selected={option.id === value} onClick={() => { onChange(option.id); setOpen(false) }} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${option.id === value ? 'bg-[var(--lime-tint)]/35 text-[var(--ink)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`}>{option.label}{option.id === value && <Check size={13} weight="bold" />}</button></li>)}
      </ul>
    </div>}
  </div>
}

// A button with the same look as these menus that switches something on and off (green while on).
export function ToggleChip({ pressed, onClick, icon: Icon, children, onPaper = false }) {
  return <span className="shrink-0 text-xs font-semibold"><button type="button" onClick={onClick} aria-pressed={pressed} className={onPaper ? triggerOnPaper(pressed) : trigger(pressed)}>{Icon && <Icon size={15} weight="bold" />}{children}</button></span>
}

const JOB_TYPES = [['any', 'Any'], ['hourly', 'Hourly'], ['fixed', 'Fixed price']]
const fieldLabel = 'text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]'

// Fields sit on --paper inside surface menus, and on --surface inside paper boxes (like the dialog's skill chips).
const fieldTone = (onPaper) => (onPaper ? { field: 'bg-[var(--surface)]', hover: 'hover:bg-[var(--paper)]' } : { field: 'bg-[var(--paper)]', hover: 'hover:bg-[var(--surface)]' })

// Any country: type to search; without a search, Any location and the popular countries come before the full A–Z list.
export function LocationSelect({ value, onChange, onPaper = false }) {
  const { open, setOpen, root } = usePopover()
  const [term, setTerm] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef(null)
  const listId = useId()
  const current = clientLocation(value)
  const tone = fieldTone(onPaper)
  const searching = term.trim().length > 0
  // One flat list for the arrow keys; a section's first row carries its heading. A popular country is listed twice, so
  // rows are keyed by section too.
  const rows = useMemo(() => {
    const sections = searching
      ? [{ title: '', options: searchClientLocations(term) }]
      : [{ title: '', options: [CLIENT_LOCATIONS[0]] }, { title: 'Popular', options: POPULAR_CLIENT_LOCATIONS }, { title: 'All countries', options: searchClientLocations('') }]
    return sections.flatMap((section) => section.options.map((option, position) => ({ ...option, key: `${section.title}:${option.id}`, heading: position === 0 ? section.title : '' })))
  }, [searching, term])

  useEffect(() => { list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }) }, [active, open])

  const toggle = () => { setTerm(''); setActive(0); setOpen((state) => !state) }
  const choose = (option) => { onChange(option.id === value ? 'any' : option.id); setOpen(false) }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, rows.length - 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)) }
    else if (event.key === 'Enter' && rows[active]) { event.preventDefault(); choose(rows[active]) }
  }

  return <div ref={root} className="relative">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`Client location: ${current.label}`} onClick={toggle} className={`flex h-11 w-full items-center gap-2.5 rounded-xl ${tone.field} px-3 text-left text-xs font-semibold ring-1 transition-shadow ${open ? 'ring-[var(--lime-dark)]' : 'ring-black/5 hover:ring-black/15 dark:ring-white/10'}`}>
      <MapPin size={15} weight={value === 'any' ? 'regular' : 'fill'} className={`shrink-0 ${value === 'any' ? 'text-[var(--muted)]' : 'text-[var(--accent-strong)]'}`} />
      <span className={`min-w-0 flex-1 truncate ${value === 'any' ? 'text-[var(--muted)]' : ''}`}>{current.label}</span>
      <CaretDown size={12} className={`shrink-0 text-[var(--muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="absolute inset-x-0 top-[calc(100%+.5rem)] z-50 rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgb(var(--shadow-rgb)/.2)] ring-1 ring-black/5">
      <div className="overflow-hidden rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)]">
        <label className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
          <input
            autoFocus
            value={term}
            onChange={(event) => { setTerm(event.target.value); setActive(0) }}
            onKeyDown={onKeyDown}
            placeholder="Search countries"
            aria-label="Search countries"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </label>
        <ul ref={list} id={listId} role="listbox" aria-label="Client location" className="max-h-64 overflow-y-auto p-2 [scrollbar-width:thin]">
          {rows.map((option, row) => [
            option.heading && <li key={`title:${option.heading}`} role="presentation" className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">{option.heading}</li>,
            <li key={option.key}><button type="button" id={`${listId}-${row}`} role="option" aria-selected={option.id === value} data-active={row === active} tabIndex={-1} onMouseEnter={() => setActive(row)} onClick={() => choose(option)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${option.id === value ? 'bg-[var(--lime-tint)]/35 text-[var(--ink)]' : row === active ? 'bg-[var(--paper)] text-[var(--ink)]' : 'text-[var(--muted)]'}`}>{option.label}{option.id === value && <Check size={13} weight="bold" />}</button></li>,
          ])}
          {searching && !rows.length && <li role="presentation" className="px-3 py-4 text-center text-xs text-[var(--muted)]">No country matches “{term.trim()}”.</li>}
        </ul>
      </div>
    </div>}
  </div>
}

// Job type and client location; shared by the jobs filter dialog and the live jobs More filters menu.
export function ExtraFilterFields({ value, onChange, onPaper = false }) {
  const tone = fieldTone(onPaper)
  return <>
    <p className={fieldLabel}>Job type</p>
    <div className={`mt-2 grid grid-cols-3 gap-1 rounded-xl ${tone.field} p-1 ring-1 ring-black/5 dark:ring-white/10`} role="radiogroup" aria-label="Job type">
      {JOB_TYPES.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={value.jobType === id} onClick={() => onChange({ ...value, jobType: value.jobType === id ? 'any' : id })} className={`whitespace-nowrap rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${value.jobType === id ? 'bg-[var(--ink)] text-white shadow-sm dark:bg-[var(--text)] dark:text-[var(--paper)]' : `text-[var(--muted)] ${tone.hover} hover:text-[var(--ink)]`}`}>{label}</button>)}
    </div>

    <p className={`${fieldLabel} mt-4`}>Client location</p>
    <div className="mt-2"><LocationSelect value={value.location} onPaper={onPaper} onChange={(location) => onChange({ ...value, location })} /></div>
  </>
}

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

        <div className="mt-4"><ExtraFilterFields value={value} onChange={onChange} /></div>
      </div>
    </div>}
  </div>
}
