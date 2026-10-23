import { CaretDown, MagnifyingGlass, X } from '@phosphor-icons/react'

/*
 * Pieces of the section panel used by Jobs-style pages (WordPress): the green search bar, underlined view tabs with
 * counts, filter chips, dropdown filters and the "nothing matches" box.
 */

export const sectionLabel = 'text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]'

// The panel around a section's toolbar: title row, tabs row and chips row go inside.
export function SectionPanel({ children }) {
  return <section className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
    <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)]">{children}</div>
  </section>
}

export function SectionSearch({ value, onChange, placeholder, label = 'Search' }) {
  return <form onSubmit={(event) => event.preventDefault()} className="job-search relative order-last flex w-full min-w-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-1.5 md:order-none md:w-auto md:max-w-xl md:flex-1">
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] shadow-[0_2px_8px_color-mix(in_srgb,var(--lime-dark)_35%,transparent)]"><MagnifyingGlass size={15} weight="bold" /></span>
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} autoComplete="off" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-[var(--muted)]" />
    {value && <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="grid size-7 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 hover:text-[var(--ink)] dark:bg-white/10"><X size={12} weight="bold" /></button>}
  </form>
}

// Underlined view tab with a count, like the Jobs status tabs.
export function SectionTab({ active, onClick, count, children }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors duration-300 ${active ? 'border-[var(--text)] text-[var(--text)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}>
    {children}
    {count != null && <span className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${active ? 'bg-[var(--lime)] !text-[#26320b]' : 'bg-[var(--paper)] text-[var(--muted)]'}`}>{count}</span>}
  </button>
}

export function FilterToggle({ active, onClick, children }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition-all duration-300 ${active ? 'bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40' : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]/60'}`}>{children}</button>
}

// A dropdown filter styled like the chips ("" = all), as in the Jobs skills row. `options` are { value, label }.
export function SectionSelect({ label, value, placeholder, options, onChange }) {
  const active = Boolean(value)
  return <label className="relative inline-flex shrink-0 items-center">
    <span className="sr-only">{label}</span>
    <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-9 max-w-[13rem] cursor-pointer appearance-none truncate rounded-full py-0 pl-3.5 pr-8 text-[13px] font-semibold outline-none ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-[var(--lime-dark)] ${active ? 'bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40' : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:ring-[var(--lime-dark)]/60'}`}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <CaretDown size={12} weight="bold" className="pointer-events-none absolute right-3 text-[var(--muted)]" />
  </label>
}

export function NothingMatches({ onClear }) {
  return <div className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-[var(--line)]/70">
    <p className="text-sm font-semibold">Nothing matches these filters.</p>
    <button type="button" onClick={onClear} className="mt-3 text-xs font-semibold text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--lime-dark)]">Clear filters</button>
  </div>
}

export function ClearFilters({ onClick }) {
  return <button type="button" onClick={onClick} className="text-xs font-semibold text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--lime-dark)]">Clear</button>
}
