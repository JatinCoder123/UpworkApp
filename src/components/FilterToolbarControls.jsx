import { ArrowClockwise, X } from '@phosphor-icons/react'
import { formatDateRange } from '../lib/dateRange'

export function RefreshFilterButton({ onClick, loading, label }) {
  return <button
    type="button"
    onClick={onClick}
    disabled={loading}
    title={label}
    aria-label={label}
    className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] ring-1 ring-black/5 transition-all duration-300 hover:bg-black/5 hover:text-[var(--ink)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 dark:ring-white/10 dark:hover:bg-white/5"
  >
    <ArrowClockwise size={15} weight="bold" className={loading ? 'animate-spin text-[var(--lime-dark)]' : ''} />
  </button>
}

export function ActiveDateFilterChip({ value, onClear, className = '' }) {
  if (!value || value.preset === 'all') return null
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1.5 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25 ${className}`}>
    <span>Time: {formatDateRange(value)}</span>
    <button type="button" onClick={onClear} aria-label="Remove date filter" className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"><X size={11} /></button>
  </span>
}
