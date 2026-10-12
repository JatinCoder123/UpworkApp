import { useState } from 'react'
import { ArrowUpRight, Plus, X } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { loadCustomTechNewsCategories, saveCustomTechNewsCategories } from '../lib/preferences'

export default function CategoryFilterDialog({
  categories = [],
  selectedCategories: initialPropSelected,
  activeCategory,
  onApply,
  onSelect,
  onAddCustomCategory,
  onClose,
}) {
  const initialList = Array.isArray(initialPropSelected)
    ? initialPropSelected
    : activeCategory && activeCategory !== 'All'
      ? [activeCategory]
      : []

  const [selected, setSelected] = useState(initialList)
  const [customCategories, setCustomCategories] = useState(loadCustomTechNewsCategories)
  const [isAdding, setIsAdding] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  const baseCategories = (categories || []).filter((cat) => cat && cat !== 'All')
  const allCategories = [...new Set([...baseCategories, ...customCategories])]

  const toggleCategory = (cat) => {
    setSelected((current) =>
      current.includes(cat)
        ? current.filter((item) => item !== cat)
        : [...current, cat]
    )
  }

  const handleAddCategory = () => {
    const trimmed = newCategory.trim()
    if (!trimmed) return
    const existing = allCategories.find((c) => c.toLowerCase() === trimmed.toLowerCase())
    const categoryToUse = existing || trimmed

    if (!existing) {
      const updatedCustom = [...customCategories, categoryToUse]
      setCustomCategories(updatedCustom)
      saveCustomTechNewsCategories(updatedCustom)
      if (onAddCustomCategory) onAddCustomCategory(updatedCustom)
    }

    if (!selected.includes(categoryToUse)) {
      setSelected((current) => [...current, categoryToUse])
    }

    setNewCategory('')
    setIsAdding(false)
  }

  const handleApply = () => {
    if (onApply) {
      onApply(selected)
    } else if (onSelect) {
      onSelect(selected.length === 1 ? selected[0] : selected.length === 0 ? 'All' : selected)
    }
    onClose()
  }

  return (
    <Modal onClose={onClose} wide>
      <DialogHeader
        eyebrow="Browse topics"
        title="Filter your news list"
        onClose={onClose}
      />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Choose one or more categories. Use the shared date control in the toolbar for publishing time.
      </p>
      <div className="mt-7 rounded-2xl bg-[var(--paper)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">
            All categories
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAdding((prev) => !prev)}
              aria-label="Add custom category"
              className="inline-flex items-center gap-1 rounded-full bg-[var(--raised)] px-3 py-1 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-all duration-300 hover:ring-[var(--lime-dark)]"
            >
              <Plus size={11} weight="bold" />
              <span>Add category</span>
            </button>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Clear categories
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {allCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`rounded-full px-3 py-2 text-[10px] font-semibold transition-all duration-300 ${
                selected.includes(cat)
                  ? 'bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/30'
                  : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-black/5 hover:text-[var(--ink)]'
              }`}
            >
              {cat}
            </button>
          ))}
          {isAdding ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--raised)] py-1 pl-3 pr-1.5 ring-1 ring-[var(--lime-dark)]">
              <input
                autoFocus
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCategory()
                  } else if (e.key === 'Escape') {
                    setIsAdding(false)
                    setNewCategory('')
                  }
                }}
                placeholder="New category..."
                className="w-28 bg-transparent text-[10px] font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                aria-label="Save category"
                className="grid size-5 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] transition-colors hover:brightness-95"
              >
                <Plus size={11} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false)
                  setNewCategory('')
                }}
                aria-label="Cancel"
                className="grid size-5 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--ink)]"
              >
                <X size={10} weight="bold" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              aria-label="Add custom category"
              title="Add custom category"
              className="grid size-7 place-items-center rounded-full bg-[var(--raised)] text-[var(--ink)] ring-1 ring-[var(--line)] transition-all duration-300 hover:ring-[var(--lime-dark)]"
            >
              <Plus size={12} weight="bold" />
            </button>
          )}
        </div>
      </div>
      <button type="button" onClick={handleApply} className={`${primaryButton} mt-7 w-full`}>
        <span>Apply category filters</span>
        <span className="ml-auto grid size-8 place-items-center rounded-full bg-white/10">
          <ArrowUpRight size={15} />
        </span>
      </button>
    </Modal>
  )
}
