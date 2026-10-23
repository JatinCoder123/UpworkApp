import { useState } from 'react'
import { ArrowUpRight, CheckCircle, CurrencyDollar, Gauge, Globe, Minus, Stack, Tag, TrendDown, TrendUp } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { EMPTY_WP_FILTERS, PRIORITY_OPTIONS, countWpFilters } from '../lib/wordpressFilters'

/*
 * The WordPress feed's filter panel (funnel / sliders button), in the same style as the AI News filter: multi-select
 * category chips, then option cards for pricing, trend, source and priority. Picks apply together on "Apply filters".
 * `options` are the CRM dropdown choices ({ value, label }) per field; `countOf(field, value)` is how many items each
 * choice has with the other filters on.
 */

const sectionLabel = 'text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]'
const PRICING_ICONS = { free: Tag, paid: CurrencyDollar, freemium: Stack }
const TREND_ICONS = { rising: TrendUp, stable: Minus, declining: TrendDown }

function SectionHead({ title, selected, onReset }) {
  return <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <span className={sectionLabel}>{title}</span>
      {selected > 0 && <span className="rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[9px] font-bold text-[#34420f] dark:text-[var(--accent-strong)]">{selected} selected</span>}
    </div>
    {selected > 0 && <button type="button" onClick={onReset} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Reset</button>}
  </div>
}

// One choice as a card: icon (or colour dot), label, note or count, and a tick when picked.
function OptionCard({ active, onClick, icon: Icon, dot, title, note }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${active ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 shadow-xs' : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15 dark:ring-white/10 dark:hover:ring-white/20'}`}>
    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${active ? 'bg-black/10' : 'bg-[var(--surface)]'}`}>{dot ? <span className={`size-3 rounded-xs ${dot}`} /> : <Icon size={16} weight="bold" />}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-xs font-bold">{title}</span>
      {note && <span className={`mt-0.5 block truncate text-[9px] ${active ? 'text-[#536520]' : 'text-[var(--muted)]'}`}>{note}</span>}
    </span>
    {active && <CheckCircle size={17} weight="fill" className="shrink-0 text-[#26320b]" />}
  </button>
}

export default function WordpressFilterDialog({ value = EMPTY_WP_FILTERS, options = {}, countOf = () => null, onApply, onClose }) {
  const [draft, setDraft] = useState({ ...EMPTY_WP_FILTERS, ...value })
  const toggle = (key, item) => setDraft((current) => ({ ...current, [key]: current[key].includes(item) ? current[key].filter((entry) => entry !== item) : [...current[key], item] }))
  const reset = (key) => setDraft((current) => ({ ...current, [key]: [] }))
  const total = countWpFilters(draft)
  const countNote = (field, choice) => { const count = countOf(field, choice); return count == null ? '' : `${count} ${count === 1 ? 'item' : 'items'}` }

  // A section of option cards for one field, with an "All" card first.
  const cards = (key, field, title, allNote, iconOf) => <section className="mt-7">
    <SectionHead title={title} selected={draft[key].length} onReset={() => reset(key)} />
    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
      <OptionCard active={!draft[key].length} onClick={() => reset(key)} icon={Globe} title={`All ${title.toLowerCase()}`} note={allNote} />
      {(options[field] || []).map((option) => <OptionCard key={option.value} active={draft[key].includes(option.value)} onClick={() => toggle(key, option.value)} icon={iconOf(option.value)} title={option.label} note={countNote(key, option.value)} />)}
    </div>
  </section>

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow="Refine the feed" title="Filter WordPress items" onClose={onClose} />
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Pick as many as you like across category, pricing, trend, source and priority.</p>

    <section className="mt-6 rounded-2xl bg-[var(--paper)] p-4">
      <SectionHead title="Categories" selected={draft.categories.length} onReset={() => reset('categories')} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(options.category || []).map((option) => {
          const active = draft.categories.includes(option.value)
          const count = countOf('categories', option.value)
          return <button key={option.value} type="button" aria-pressed={active} onClick={() => toggle('categories', option.value)} className={`rounded-full px-3 py-2 transition-all duration-300 ${active ? 'bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/30' : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-black/5 hover:text-[var(--ink)] dark:ring-white/10'}`}>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">{option.label}{count != null && <span className={`rounded-full px-1.5 py-px text-[9px] tabular-nums ${active ? 'bg-black/10' : 'bg-black/5 dark:bg-white/10'}`}>{count}</span>}</span>
          </button>
        })}
      </div>
    </section>

    {cards('pricing', 'pricing_type', 'Pricing', 'Free, paid and freemium', (choice) => PRICING_ICONS[choice] || Tag)}
    {cards('trends', 'trend', 'Trends', 'Rising, stable and declining', (choice) => TREND_ICONS[choice] || Minus)}
    {cards('sources', 'source', 'Sources', 'Every marketplace and site', () => Globe)}

    <section className="mt-7">
      <SectionHead title="Priority" selected={draft.priorities.length} onReset={() => reset('priorities')} />
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <OptionCard active={!draft.priorities.length} onClick={() => reset('priorities')} icon={Gauge} title="All priorities" note="Any demand score" />
        {PRIORITY_OPTIONS.map((option) => <OptionCard key={option.value} active={draft.priorities.includes(option.value)} onClick={() => toggle('priorities', option.value)} dot={option.dot} title={option.label} note={[option.note, countNote('priorities', option.value)].filter(Boolean).join(' · ')} />)}
      </div>
    </section>

    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-black/[.07] pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[.08]">
      <button type="button" onClick={() => { onApply(EMPTY_WP_FILTERS); onClose() }} className="rounded-full px-4 py-2 text-left text-xs font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)] sm:text-center">Reset all filters</button>
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-xs font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)]">Cancel</button>
        <button type="button" onClick={() => { onApply(draft); onClose() }} className={primaryButton}>
          <span>Apply filters{total > 0 ? ` (${total})` : ''}</span>
          <span className="grid size-7 place-items-center rounded-full bg-white/15"><ArrowUpRight size={14} /></span>
        </button>
      </div>
    </div>
  </Modal>
}
