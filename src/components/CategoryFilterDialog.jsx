import { useState, useMemo } from 'react'
import { Check, MagnifyingGlass, SquaresFour, X } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'

export default function CategoryFilterDialog({
  categories = [],
  categoryCounts = {},
  selectedCategory = 'All',
  eyebrow = 'Content Filter',
  title = 'Filter by Topic / Field',
  description = 'Choose a content topic or field to filter your article ideas. Each category shows how many ideas are currently available.',
  onSelect,
  onClose,
}) {
  const [search, setSearch] = useState('')

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((cat) => cat.toLowerCase().includes(q))
  }, [categories, search])

  return (
    <Modal onClose={onClose}>
      <DialogHeader
        eyebrow={eyebrow}
        title={title}
        onClose={onClose}
      />
      <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
        {description}
      </p>

      {/* Search Input */}
      <div className="relative mt-5 flex items-center gap-2 rounded-2xl bg-[var(--paper)] px-3.5 py-2.5 ring-1 ring-[var(--line)]/60 focus-within:ring-[var(--lime-dark)] transition-shadow">
        <MagnifyingGlass size={15} className="shrink-0 text-[var(--muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories or fields…"
          aria-label="Search categories"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:text-[var(--muted)] placeholder:font-normal"
          autoFocus
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="grid size-5 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 dark:bg-white/10"
          >
            <X size={11} weight="bold" />
          </button>
        )}
      </div>

      {/* Categories Grid */}
      <div className="mt-4 max-h-[50vh] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full py-8 text-center text-xs text-[var(--muted)]">
            No categories match "{search}"
          </div>
        ) : (
          filteredCategories.map((item) => {
            const isSelected = selectedCategory === item
            const count = categoryCounts[item] ?? 0

            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onSelect(item)
                  onClose()
                }}
                className={`group flex items-center justify-between gap-3 rounded-2xl p-3 text-left transition-all duration-200 ring-1 ${
                  isSelected
                    ? 'bg-[var(--lime)] !text-[var(--on-lime)] ring-[var(--lime-dark)]/40 shadow-sm'
                    : 'bg-[var(--paper)] text-[var(--ink)] ring-[var(--line)]/60 hover:bg-[var(--surface)] hover:ring-[var(--line)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-xs transition-colors ${
                      isSelected
                        ? 'bg-black/15 text-[var(--on-lime)]'
                        : 'bg-[var(--surface)] text-[var(--muted)] group-hover:text-[var(--ink)]'
                    }`}
                  >
                    {isSelected ? (
                      <Check size={12} weight="bold" />
                    ) : (
                      <SquaresFour size={12} weight="light" />
                    )}
                  </span>
                  <span className="truncate text-xs font-bold leading-tight">
                    {item}
                  </span>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                    isSelected
                      ? 'bg-black/15 text-[var(--on-lime)]'
                      : 'bg-[var(--surface)] text-[var(--muted)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })
        )}
      </div>

      {/* Actions Footer */}
      <div className="mt-6 flex items-center justify-between border-t border-[var(--line)]/60 pt-4">
        <button
          type="button"
          onClick={() => {
            onSelect('All')
            onClose()
          }}
          className="text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          Reset to All
        </button>

        <button
          type="button"
          onClick={onClose}
          className={`${primaryButton} text-xs py-2 px-6`}
        >
          Done
        </button>
      </div>
    </Modal>
  )
}
