import { useState } from 'react'
import { ArrowUpRight, Check, Funnel, MagnifyingGlass, X } from '@phosphor-icons/react'
import { Modal, primaryButton } from './ui'
import { skillStyle } from '../lib/jobSignals'

/*
 * The universal filter of the feed sections (funnel button), as a two-pane panel: the groups on the left (with how many
 * are picked in each), the open group's choices on the right as tidy checkbox rows in columns (colour dot or icon,
 * label, item count), with a search for long lists. Every group is multi-select; picks apply together on "Apply".
 * `sections` are [{ key, title, icon?, options: [{ value, label, icon?, dot?, tone? }] }]; `value` is { [key]: [values] }
 * ([] or missing = all); `countOf(key, value)` is how many items a choice has with the other filters on.
 */

// A choice's marker: its icon in its tone, its colour dot, or a dot in its own (skill-chip) colour.
function Marker({ option }) {
  const Icon = option.icon
  if (Icon) return <span className={`grid size-6 shrink-0 place-items-center rounded-lg ${option.tone || 'bg-[var(--paper)] text-[var(--muted)]'}`}><Icon size={13} weight="bold" /></span>
  if (option.dot) return <span className="grid size-6 shrink-0 place-items-center"><span className={`size-2.5 rounded-full ${option.dot}`} /></span>
  return <span className="grid size-6 shrink-0 place-items-center"><span className="size-2.5 rounded-full" style={{ ...skillStyle(option.value), background: 'hsl(var(--skill-h) 55% 52%)' }} /></span>
}

export default function FeedFilterDialog({ title = 'Filters', sections = [], value = {}, countOf = () => null, onApply, onClose }) {
  const groups = sections.filter((section) => section.options.length)
  const [draft, setDraft] = useState(() => Object.fromEntries(sections.map((section) => [section.key, value[section.key] || []])))
  // Open the first group that has picks, else the first group.
  const [openKey, setOpenKey] = useState(() => (groups.find((section) => value[section.key]?.length) || groups[0])?.key)
  const [query, setQuery] = useState('')
  const open = groups.find((section) => section.key === openKey) || groups[0]
  // A `single` group keeps one choice at a time; the others take several.
  const singles = new Set(sections.filter((section) => section.single).map((section) => section.key))
  const toggle = (key, choice) => setDraft((current) => ({ ...current, [key]: current[key].includes(choice) ? current[key].filter((entry) => entry !== choice) : singles.has(key) ? [choice] : [...current[key], choice] }))
  const reset = (key) => setDraft((current) => ({ ...current, [key]: [] }))
  const total = Object.values(draft).reduce((sum, list) => sum + list.length, 0)
  const term = query.trim().toLowerCase()
  // Every CRM choice is shown; the ones with no items (with the other filters on) go last, faded.
  const noItems = (key, option) => countOf(key, option.value) === 0 && !draft[key].includes(option.value)
  const shown = open ? open.options.filter((option) => !term || option.label.toLowerCase().includes(term)).sort((a, b) => noItems(open.key, a) - noItems(open.key, b)) : []
  const empty = Object.fromEntries(sections.map((section) => [section.key, []]))
  const pick = (key) => { setOpenKey(key); setQuery('') }

  return <Modal onClose={onClose} wide>
    {/* Short dark header, like the Jobs skills panel. */}
    <div className="relative -mx-5 -mt-5 mb-5 overflow-hidden rounded-t-[calc(2rem-.375rem)] bg-[#1f2a21] px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8">
      <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-12 size-28 rounded-full bg-[#c8df7a]" />
      <span aria-hidden="true" className="pointer-events-none absolute right-24 top-9 size-7 rounded-full border-2 border-[#c8df7a]/80" />
      <button type="button" onClick={onClose} aria-label="Close dialog" className="absolute right-4 top-4 z-10 grid size-8 place-items-center rounded-full bg-[#1f2a21] text-white ring-1 ring-white/25 transition-transform hover:scale-105"><X size={14} weight="bold" /></button>
      <h2 className="relative flex max-w-[80%] items-center gap-2.5 text-xl font-semibold leading-tight tracking-[-.03em] text-white"><Funnel size={20} weight="duotone" className="text-[#c8df7a]" />{title} <span className="font-serif italic text-[#c8df7a]">your way.</span></h2>
    </div>

    <div className="grid gap-4 sm:grid-cols-[13.5rem_minmax(0,1fr)]">
      {/* Groups: a column on wide screens, a scrolling row on phones. */}
      <nav aria-label="Filter groups" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mx-0 sm:max-h-[26rem] sm:flex-col sm:overflow-y-auto sm:px-0 sm:pb-0">
        {groups.map((section) => {
          const active = section.key === open?.key
          const count = draft[section.key].length
          const Icon = section.icon || Funnel
          return <button key={section.key} type="button" onClick={() => pick(section.key)} aria-current={active ? 'true' : undefined} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${active ? 'bg-[var(--text)] text-[var(--paper)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`}>
            <Icon size={17} weight={active ? 'bold' : 'regular'} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{section.title}</span>
            {count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[var(--lime)] px-1.5 text-[11px] font-bold !text-[#26320b]">{count}</span>}
          </button>
        })}
      </nav>

      {open && <section className="min-w-0 rounded-2xl bg-[var(--paper)] p-3.5 ring-1 ring-[var(--line)]/60">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-[var(--muted)]"><b className="font-semibold text-[var(--ink)]">{open.title}</b> · {draft[open.key].length ? `${draft[open.key].length} picked` : `All ${open.options.length}`}{open.single && ' · one at a time'}</p>
          {draft[open.key].length > 0 && <button type="button" onClick={() => reset(open.key)} className="text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear</button>}
        </div>
        {open.options.length > 8 && <label className="mt-2.5 flex items-center gap-2 rounded-xl bg-[var(--surface)] px-3 py-2 ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--lime-dark)]">
          <MagnifyingGlass size={13} className="shrink-0 text-[var(--muted)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${open.title.toLowerCase()}`} aria-label={`Search ${open.title.toLowerCase()}`} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]"><X size={10} weight="bold" /></button>}
        </label>}
        <div className="mt-2.5 grid max-h-[19rem] content-start gap-1.5 overflow-y-auto pr-0.5 sm:grid-cols-2">
          {shown.map((option) => {
            const checked = draft[open.key].includes(option.value)
            const count = countOf(open.key, option.value)
            return <button key={option.value} type="button" role="checkbox" aria-checked={checked} onClick={() => toggle(open.key, option.value)} className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ${checked ? 'bg-(--lime)/25 ring-[var(--lime-dark)]/45' : 'bg-[var(--surface)] ring-[var(--line)]/70 hover:ring-[var(--lime-dark)]/60'} ${noItems(open.key, option) ? 'opacity-50' : ''}`}>
              <span className={`grid size-4 shrink-0 place-items-center rounded-[5px] ring-1 transition-colors ${checked ? 'bg-[var(--lime-dark)] text-white ring-[var(--lime-dark)]' : 'bg-[var(--surface)] ring-[var(--line)]'}`}>{checked && <Check size={10} weight="bold" />}</span>
              <Marker option={option} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{option.label}</span>
              {count != null && <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--muted)]">{count}</span>}
            </button>
          })}
          {!shown.length && <p className="col-span-full py-6 text-center text-sm text-[var(--muted)]">No {open.title.toLowerCase()} match “{query.trim()}”.</p>}
        </div>
      </section>}
    </div>

    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-black/[.07] pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/[.08]">
      <button type="button" onClick={() => { onApply(empty); onClose() }} className="rounded-full px-4 py-2 text-left sm:text-center"><span className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">Reset all filters</span></button>
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2"><span className="text-sm font-bold text-[var(--muted)] hover:text-[var(--ink)]">Cancel</span></button>
        <button type="button" onClick={() => { onApply(draft); onClose() }} className={primaryButton}>
          <span>Apply filters{total > 0 ? ` (${total})` : ''}</span>
          <span className="grid size-7 place-items-center rounded-full bg-white/15"><ArrowUpRight size={14} /></span>
        </button>
      </div>
    </div>
  </Modal>
}
