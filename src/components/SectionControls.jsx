/*
 * Pieces of the section panel used by Jobs-style pages (WordPress, LLM): the panel, underlined view tabs with counts,
 * toggle chips and the "nothing matches" box.
 */

export const sectionLabel = 'text-[11px] font-bold uppercase tracking-[.16em] text-[var(--muted)]'

// The panel around a section's toolbar: title row, tabs row and chips row go inside.
export function SectionPanel({ children }) {
  return <section className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
    <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)]">{children}</div>
  </section>
}

// Underlined view tab with a count, like the Jobs status tabs.
export function SectionTab({ active, onClick, count, children }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors duration-300 ${active ? 'border-[var(--text)] text-[var(--text)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}>
    {children}
    {count != null && <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums ${active ? 'bg-[var(--lime)] !text-[#26320b]' : 'bg-[var(--paper)] text-[var(--muted)]'}`}>{count}</span>}
  </button>
}

// index.css gives buttons `font: inherit`, so the text size and weight sit on the inner span.
export function FilterToggle({ active, onClick, children }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-2 ring-1 transition-all duration-300 ${active ? 'bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40' : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]/60'}`}><span className="text-[13px] font-semibold">{children}</span></button>
}

export function NothingMatches({ onClear }) {
  return <div className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-[var(--line)]/70">
    <p className="text-sm font-semibold">Nothing matches these filters.</p>
    <button type="button" onClick={onClear} className="mt-3 text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 hover:decoration-[var(--lime-dark)]"><span className="text-[13px] font-semibold">Clear filters</span></button>
  </div>
}

export function ClearFilters({ onClick }) {
  return <button type="button" onClick={onClick} className="text-[var(--ink)] underline decoration-[var(--line)] underline-offset-4 transition-colors hover:decoration-[var(--lime-dark)]"><span className="text-[13px] font-semibold">Clear</span></button>
}
