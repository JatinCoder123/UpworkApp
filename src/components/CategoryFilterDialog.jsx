import { useState } from 'react'
import { ArrowUpRight, CheckCircle } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'

export default function CategoryFilterDialog({
  categories = [],
  categoryCounts = {},
  selectedCategories: initialPropSelected,
  activeCategory,
  onApply,
  onSelect,
  onClose,
}) {
  // Normalize incoming selection
  const initialList = Array.isArray(initialPropSelected)
    ? initialPropSelected
    : activeCategory && activeCategory !== 'All'
      ? [activeCategory]
      : []

  const [selected, setSelected] = useState(initialList)

  const toggleCategory = (cat) => {
    if (cat === 'All') {
      setSelected([])
      return
    }
    setSelected((current) =>
      current.includes(cat)
        ? current.filter((item) => item !== cat)
        : [...current, cat]
    )
  }

  const handleApply = () => {
    if (onApply) {
      onApply(selected)
    } else if (onSelect) {
      onSelect(selected.length === 1 ? selected[0] : selected.length === 0 ? 'All' : selected)
    }
    onClose()
  }

  const handleReset = () => {
    setSelected([])
    if (onApply) {
      onApply([])
    } else if (onSelect) {
      onSelect('All')
    }
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <DialogHeader
        eyebrow="Browse topics"
        title="All news categories"
        onClose={onClose}
      />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Choose one or multiple technical categories to filter your real-time intelligence feed.
      </p>

      {/* Categories List */}
      <div className="mt-6 space-y-2.5">
        {categories.map((cat) => {
          const isSelected = cat === 'All' ? selected.length === 0 : selected.includes(cat)
          const count = categoryCounts[cat] || 0

          return (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`flex w-full items-center justify-between rounded-2xl p-3.5 text-left ring-1 transition-all duration-300 ${
                isSelected
                  ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 font-bold shadow-xs'
                  : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${
                    isSelected
                      ? 'bg-black/10 text-[#26320b]'
                      : 'bg-[var(--surface)] text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10'
                  }`}
                >
                  {count}
                </span>
                <div>
                  <span className="block text-xs sm:text-sm font-semibold">{cat}</span>
                  <span
                    className={`block text-[10px] ${
                      isSelected ? 'text-[#536520]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {cat === 'All'
                      ? 'All curated technical coverage'
                      : `${count} classified stories`}
                  </span>
                </div>
              </div>

              {isSelected && (
                <CheckCircle size={18} weight="fill" className="shrink-0 text-[#26320b]" />
              )}
            </button>
          )
        })}
      </div>

      {/* Footer Actions */}
      <div className="mt-6 flex items-center justify-between border-t border-black/[.07] dark:border-white/[.08] pt-4">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          Reset to All
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={primaryButton}
          >
            <span>
              Apply{selected.length > 0 ? ` (${selected.length})` : ''}
            </span>
            <span className="grid size-7 place-items-center rounded-full bg-white/15">
              <ArrowUpRight size={14} />
            </span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
