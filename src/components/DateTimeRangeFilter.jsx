import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CalendarBlank, CaretDown, Check, X } from '@phosphor-icons/react'
import { DATE_RANGE_PRESETS, EMPTY_DATE_RANGE, formatDateRange } from '../lib/dateRange'

export default function DateTimeRangeFilter({
  value = EMPTY_DATE_RANGE,
  onApply,
  label = 'Date & time',
  align = 'right',
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const root = useRef(null)
  const active = value.preset && value.preset !== 'all'

  useEffect(() => {
    const close = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const choosePreset = (preset) => {
    const next = { preset, from: '', to: '' }
    setDraft(next)
    if (preset !== 'custom') {
      onApply(next)
      setOpen(false)
    }
  }

  const reset = () => {
    setDraft(EMPTY_DATE_RANGE)
    onApply(EMPTY_DATE_RANGE)
    setOpen(false)
  }

  const customInvalid = !draft.from || !draft.to || new Date(draft.from) > new Date(draft.to)

  return <div ref={root} className="relative shrink-0">
    <button
      type="button"
      aria-expanded={open}
      onClick={() => {
        if (!open) setDraft(value)
        setOpen((current) => !current)
      }}
      className={`flex h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 transition-all duration-300 ${active ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/35' : 'bg-[var(--paper)] text-[var(--muted)] ring-black/5 hover:text-[var(--ink)]'}`}
    >
      <CalendarBlank size={15} weight={active ? 'fill' : 'regular'} />
      <span className="hidden max-w-44 truncate sm:block">{formatDateRange(value)}</span>
      <CaretDown size={12} className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>

    {open && <div className={`absolute top-12 z-50 w-[min(23rem,calc(100vw-2rem))] rounded-[1.5rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5 ${align === 'left' ? 'left-0' : 'right-0'}`}>
      <div className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-4">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{label}</p><p className="mt-1 text-sm font-semibold">Choose a time window</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close date filter" className="grid size-8 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"><X size={13} /></button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {DATE_RANGE_PRESETS.map((preset) => {
            const selected = draft.preset === preset.id
            return <button key={preset.id} type="button" onClick={() => choosePreset(preset.id)} className={`flex min-h-14 items-center gap-2 rounded-xl p-2.5 text-left ring-1 transition-colors ${selected ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/35' : 'bg-[var(--paper)] ring-black/5 hover:ring-black/15'}`}>
              <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold">{preset.label}</span><span className={`mt-0.5 block truncate text-[8px] ${selected ? 'text-[#536520]' : 'text-[var(--muted)]'}`}>{preset.note}</span></span>
              {selected && <Check size={13} weight="bold" />}
            </button>
          })}
        </div>

        {draft.preset === 'custom' && <div className="mt-3 grid gap-3 rounded-2xl bg-[var(--paper)] p-3 sm:grid-cols-2">
          <label className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">From<input type="datetime-local" value={draft.from || ''} max={draft.to || undefined} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} className="mt-2 block w-full rounded-xl bg-[var(--surface)] px-3 py-2.5 text-[10px] font-medium normal-case tracking-normal text-[var(--ink)] outline-none ring-1 ring-black/5 focus:ring-[var(--lime-dark)]" /></label>
          <label className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">To<input type="datetime-local" value={draft.to || ''} min={draft.from || undefined} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} className="mt-2 block w-full rounded-xl bg-[var(--surface)] px-3 py-2.5 text-[10px] font-medium normal-case tracking-normal text-[var(--ink)] outline-none ring-1 ring-black/5 focus:ring-[var(--lime-dark)]" /></label>
        </div>}

        <div className="mt-4 flex items-center justify-between border-t border-black/[.06] pt-3">
          <button type="button" onClick={reset} className="px-2 py-2 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Reset</button>
          {draft.preset === 'custom' && <button type="button" disabled={customInvalid} onClick={() => { onApply(draft); setOpen(false) }} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] py-2 pl-4 pr-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Apply range<span className="grid size-6 place-items-center rounded-full bg-white/10"><ArrowUpRight size={12} /></span></button>}
        </div>
      </div>
    </div>}
  </div>
}
