import { useState } from 'react'
import { Check, MagnifyingGlass, X } from '@phosphor-icons/react'
import { Modal } from './ui'
import { skillStyle } from '../lib/jobSignals'

/**
 * The whole list of one filter (opened by a strip's wheel), in the style of the Jobs skills panel: a short dark header,
 * a search box and chips to pick (several at once). Picks apply when the dialog closes (Apply, X, outside click or
 * Escape), like the Jobs panel. `options` are { value, label, icon?, tone? }; a chip shows its tone, or its own colour
 * like the skill chips, and turns lime with a tick when picked. `countOf(value)` is each choice's item count.
 */
export default function FilterListDialog({ title, accent = 'you want to see.', noun, options, value, countOf, onApply, onClose }) {
  const [picked, setPicked] = useState(value)
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  // Every CRM choice is shown; the ones with no items (with the other filters on) go last, faded.
  const empty = (option) => countOf?.(option.value) === 0 && !picked.includes(option.value)
  const shown = options.filter((option) => !term || option.label.toLowerCase().includes(term)).sort((a, b) => empty(a) - empty(b))
  const toggle = (choice) => setPicked((current) => current.includes(choice) ? current.filter((entry) => entry !== choice) : [...current, choice])
  const applyAndClose = () => { onApply(picked); onClose() }

  return <Modal onClose={applyAndClose} wide={options.length > 8}>
    {/* Short dark header with the lime circles, as in the Jobs skills panel. */}
    <div className="relative -mx-5 -mt-5 mb-5 overflow-hidden rounded-t-[calc(2rem-.375rem)] bg-[var(--hero)] px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8">
      <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 size-28 rounded-full bg-[var(--hero-soft)]" />
      <span aria-hidden="true" className="pointer-events-none absolute right-24 top-9 size-7 rounded-full border-2 border-[var(--hero-soft)]/80" />
      <button type="button" onClick={applyAndClose} aria-label="Close dialog" className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full bg-[var(--hero)] text-white ring-1 ring-white/25 transition-transform hover:scale-105"><X size={14} weight="bold" /></button>
      <h2 className="relative max-w-[80%] text-xl font-semibold leading-tight tracking-[-.03em] text-white">{title} <span className="font-serif italic text-[var(--hero-soft)]">{accent}</span></h2>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[13px] text-[var(--muted)]"><b className="font-semibold text-[var(--ink)]">{picked.length} selected</b> · {options.length} {noun}</p>
      <div className="flex items-center gap-1.5 text-[13px] font-bold">
        <button type="button" disabled={!picked.length} onClick={() => setPicked([])} className="rounded-full px-3 py-1.5 text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40">Clear</button>
        <button type="button" onClick={applyAndClose} className="rounded-full bg-[var(--text)] px-4 py-1.5 text-[var(--paper)] transition-transform duration-300 hover:-translate-y-0.5">Apply filter</button>
      </div>
    </div>

    {options.length > 6 && <label className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--raised)] px-3.5 py-2.5 ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--lime-dark)]">
      <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
      <span className="sr-only">Search {noun}</span>
      <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape' && query) { event.stopPropagation(); setQuery('') } }} autoFocus placeholder={`Search ${options.length} ${noun}`} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
      {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]"><X size={10} weight="bold" /></button>}
    </label>}

    <div className="mt-4 flex flex-wrap gap-2">
      {shown.map((option) => {
        const active = picked.includes(option.value)
        const Icon = option.icon
        const count = countOf?.(option.value)
        const colours = active ? 'bg-[var(--lime-tint)]/55 !text-[var(--lime-ink)] ring-1 ring-[var(--lime-dark)]/50 shadow-sm' : option.tone ? `${option.tone} opacity-90 hover:opacity-100` : 'skill-chip'
        return <button key={option.value} type="button" aria-pressed={active} onClick={() => toggle(option.value)} style={active || option.tone ? undefined : skillStyle(option.value)} className={`rounded-full px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 ${colours} ${empty(option) ? '!opacity-45' : ''}`}>
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
            {active ? <Check size={13} weight="bold" /> : Icon && <Icon size={14} />}
            {option.label}
            {count != null && <span className="rounded-full bg-black/10 px-1.5 py-px text-[11px] tabular-nums dark:bg-white/15">{count}</span>}
          </span>
        </button>
      })}
      {!shown.length && <p className="w-full rounded-xl bg-[var(--paper)] px-3 py-6 text-center text-sm text-[var(--muted)]">No {noun} match “{query.trim()}”.</p>}
    </div>
  </Modal>
}
