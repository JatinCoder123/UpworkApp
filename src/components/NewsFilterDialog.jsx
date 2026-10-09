import { useState } from 'react'
import {
  Alarm,
  ArrowUpRight,
  Buildings,
  CheckCircle,
  Globe,
  PenNib,
} from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'

const tierOptions = [
  { id: 'BLOCKBUSTER', label: 'Blockbuster', note: 'Critical high-impact developments', dot: 'bg-rose-500' },
  { id: 'HOT', label: 'Hot', note: 'Trending releases and significant moves', dot: 'bg-amber-500' },
  { id: 'NORMAL', label: 'Normal', note: 'Standard industry reporting and updates', dot: 'bg-purple-500' },
]

const sourceOptions = [
  { id: 'FirstParty', label: 'FirstParty', note: 'Direct from official source or press page', icon: Buildings },
  { id: 'ThirdParty', label: 'ThirdParty', note: 'Reported by external media and news sites', icon: Globe },
  { id: 'YouBlogging', label: 'YouBlogging', note: 'Story well-suited for blog and video content', icon: PenNib },
  { id: 'HurryUp', label: 'HurryUp', note: 'Time-sensitive news posted recently', icon: Alarm },
]

export default function NewsFilterDialog({
  value = {},
  categoryOptions = [],
  categoryCounts = {},
  onApply,
  onClose,
}) {
  // Normalize incoming values (support both array format and legacy single value format)
  const initialTiers = Array.isArray(value.tiers)
    ? value.tiers
    : value.tier && value.tier !== 'All'
      ? [value.tier]
      : []

  const initialSources = Array.isArray(value.sourceTypes)
    ? value.sourceTypes
    : value.sourceType && value.sourceType !== 'All'
      ? [value.sourceType]
      : []

  const initialCategories = Array.isArray(value.categories)
    ? value.categories
    : value.category && value.category !== 'All'
      ? [value.category]
      : []

  const [selectedTiers, setSelectedTiers] = useState(initialTiers)
  const [selectedSources, setSelectedSources] = useState(initialSources)
  const [selectedCategories, setSelectedCategories] = useState(initialCategories)

  const toggleTier = (tierId) => {
    setSelectedTiers((current) =>
      current.includes(tierId)
        ? current.filter((id) => id !== tierId)
        : [...current, tierId]
    )
  }

  const toggleSource = (sourceId) => {
    setSelectedSources((current) =>
      current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId]
    )
  }

  const toggleCategory = (cat) => {
    setSelectedCategories((current) =>
      current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat]
    )
  }

  const totalActiveCount =
    selectedTiers.length + selectedSources.length + selectedCategories.length

  const handleApply = () => {
    onApply({
      tiers: selectedTiers,
      sourceTypes: selectedSources,
      categories: selectedCategories,
    })
    onClose()
  }

  const handleReset = () => {
    setSelectedTiers([])
    setSelectedSources([])
    setSelectedCategories([])
    onApply({
      tiers: [],
      sourceTypes: [],
      categories: [],
    })
    onClose()
  }

  return (
    <Modal onClose={onClose} wide>
      <DialogHeader
        eyebrow="Refine news"
        title="Filter your news feed"
        onClose={onClose}
      />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Select multiple filters simultaneously across technical categories, score tiers, and source types.
      </p>

      {/* Section 1: Categories (Multi-select) */}
      {categoryOptions.length > 0 && (
        <div className="mt-6 rounded-2xl bg-[var(--paper)] p-4 ring-1 ring-black/5 dark:ring-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">
                Categories
              </span>
              {selectedCategories.length > 0 && (
                <span className="rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[9px] font-bold text-[#34420f]">
                  {selectedCategories.length} selected
                </span>
              )}
            </div>
            {selectedCategories.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedCategories([])}
                className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Clear categories
              </button>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {categoryOptions.map((cat) => {
              const isSelected = selectedCategories.includes(cat)
              const count = categoryCounts[cat] || 0
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-300 ${
                    isSelected
                      ? 'bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/40 font-bold shadow-xs'
                      : 'bg-[var(--surface)] text-[var(--ink)] ring-1 ring-black/5 hover:ring-black/15'
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                      isSelected
                        ? 'bg-black/10 text-[#26320b]'
                        : 'bg-black/5 dark:bg-white/10 text-[var(--muted)]'
                    }`}
                  >
                    {count}
                  </span>
                  {isSelected && (
                    <CheckCircle size={14} weight="fill" className="text-[#26320b]" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 2: Score Tier (Multi-select) */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">
              Score Tier
            </span>
            {selectedTiers.length > 0 && (
              <span className="rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[9px] font-bold text-[#34420f]">
                {selectedTiers.length} selected
              </span>
            )}
          </div>
          {selectedTiers.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTiers([])}
              className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Reset to All Tiers
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {/* Quick "All Tiers" card */}
          <button
            type="button"
            onClick={() => setSelectedTiers([])}
            className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${
              selectedTiers.length === 0
                ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 font-bold shadow-xs'
                : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15'
            }`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                selectedTiers.length === 0 ? 'bg-black/10' : 'bg-white'
              }`}
            >
              <span className="size-3 rounded-xs bg-zinc-400" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold">All Tiers</span>
              <span
                className={`mt-0.5 block truncate text-[9px] ${
                  selectedTiers.length === 0 ? 'text-[#536520]' : 'text-[var(--muted)]'
                }`}
              >
                Show stories across all evaluated score tiers
              </span>
            </span>
            {selectedTiers.length === 0 && (
              <CheckCircle size={17} weight="fill" className="shrink-0 text-[#26320b]" />
            )}
          </button>

          {/* Individual Score Tiers */}
          {tierOptions.map((opt) => {
            const isSelected = selectedTiers.includes(opt.id)
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleTier(opt.id)}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${
                  isSelected
                    ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 font-bold shadow-xs'
                    : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15'
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    isSelected ? 'bg-black/10' : 'bg-white'
                  }`}
                >
                  <span className={`size-3 rounded-xs ${opt.dot}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span
                    className={`mt-0.5 block truncate text-[9px] ${
                      isSelected ? 'text-[#536520]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {opt.note}
                  </span>
                </span>
                {isSelected && (
                  <CheckCircle size={17} weight="fill" className="shrink-0 text-[#26320b]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 3: Source Type (Multi-select) */}
      <div className="mt-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">
              Source Type
            </span>
            {selectedSources.length > 0 && (
              <span className="rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[9px] font-bold text-[#34420f]">
                {selectedSources.length} selected
              </span>
            )}
          </div>
          {selectedSources.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSources([])}
              className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              Reset to All Sources
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {/* Quick "All Sources" card */}
          <button
            type="button"
            onClick={() => setSelectedSources([])}
            className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${
              selectedSources.length === 0
                ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 font-bold shadow-xs'
                : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15'
            }`}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                selectedSources.length === 0 ? 'bg-black/10' : 'bg-white'
              }`}
            >
              <Globe size={16} weight="bold" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold">All Sources</span>
              <span
                className={`mt-0.5 block truncate text-[9px] ${
                  selectedSources.length === 0 ? 'text-[#536520]' : 'text-[var(--muted)]'
                }`}
              >
                Show stories regardless of provenance
              </span>
            </span>
            {selectedSources.length === 0 && (
              <CheckCircle size={17} weight="fill" className="shrink-0 text-[#26320b]" />
            )}
          </button>

          {/* Individual Source Types */}
          {sourceOptions.map((opt) => {
            const isSelected = selectedSources.includes(opt.id)
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleSource(opt.id)}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${
                  isSelected
                    ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 font-bold shadow-xs'
                    : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15'
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    isSelected ? 'bg-black/10' : 'bg-white'
                  }`}
                >
                  <Icon size={16} weight="bold" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span
                    className={`mt-0.5 block truncate text-[9px] ${
                      isSelected ? 'text-[#536520]' : 'text-[var(--muted)]'
                    }`}
                  >
                    {opt.note}
                  </span>
                </span>
                {isSelected && (
                  <CheckCircle size={17} weight="fill" className="shrink-0 text-[#26320b]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dialog Footer Actions */}
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-black/[.07] dark:border-white/[.08] pt-5">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors text-left sm:text-center"
        >
          Reset all filters
        </button>

        <div className="flex items-center justify-end gap-3">
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
              Apply filters{totalActiveCount > 0 ? ` (${totalActiveCount})` : ''}
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
