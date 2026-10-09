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
  { id: 'All', label: 'All Tiers', note: 'Show stories across all score tiers', dot: 'bg-zinc-400' },
  { id: 'BLOCKBUSTER', label: 'Blockbuster', note: 'Critical high-impact developments', dot: 'bg-rose-500' },
  { id: 'HOT', label: 'Hot', note: 'Trending releases and significant moves', dot: 'bg-amber-500' },
  { id: 'NORMAL', label: 'Normal', note: 'Standard industry reporting and updates', dot: 'bg-purple-500' },
]

const sourceOptions = [
  { id: 'All', label: 'All Sources', note: 'Show stories regardless of provenance', icon: Globe },
  { id: 'FirstParty', label: 'FirstParty', note: 'Direct from the official source or press page', icon: Buildings },
  { id: 'ThirdParty', label: 'ThirdParty', note: 'Reported by external media and news sites', icon: Globe },
  { id: 'YouBlogging', label: 'YouBlogging', note: 'Story well-suited for blog and video content', icon: PenNib },
  { id: 'HurryUp', label: 'HurryUp', note: 'Time-sensitive news posted recently', icon: Alarm },
]

export default function NewsFilterDialog({ value, onApply, onClose }) {
  const [selectedTier, setSelectedTier] = useState(value.tier || 'All')
  const [selectedSource, setSelectedSource] = useState(value.sourceType || 'All')

  const handleApply = () => {
    onApply({
      tier: selectedTier,
      sourceType: selectedSource,
    })
    onClose()
  }

  const handleReset = () => {
    setSelectedTier('All')
    setSelectedSource('All')
    onApply({
      tier: 'All',
      sourceType: 'All',
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
        Filter stories by evaluated News Score tier and source provenance type.
      </p>

      {/* Section 1: Score Tier */}
      <div className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">
          Score Tier
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {tierOptions.map((opt) => {
            const isSelected = selectedTier === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedTier(opt.id)}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${
                  isSelected
                    ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 font-bold'
                    : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15'
                }`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${isSelected ? 'bg-black/10' : 'bg-white'}`}>
                  <span className={`size-3 rounded-xs ${opt.dot}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className={`mt-0.5 block truncate text-[9px] ${isSelected ? 'text-[#536520]' : 'text-[var(--muted)]'}`}>
                    {opt.note}
                  </span>
                </span>
                {isSelected && <CheckCircle size={17} weight="fill" className="shrink-0 text-[#26320b]" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Section 2: Source Type */}
      <div className="mt-7">
        <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">
          Source Type
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {sourceOptions.map((opt) => {
            const isSelected = selectedSource === opt.id
            const Icon = opt.icon
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedSource(opt.id)}
                className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${
                  isSelected
                    ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50 font-bold'
                    : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15'
                }`}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${isSelected ? 'bg-black/10' : 'bg-white'}`}>
                  <Icon size={16} weight="bold" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{opt.label}</span>
                  <span className={`mt-0.5 block truncate text-[9px] ${isSelected ? 'text-[#536520]' : 'text-[var(--muted)]'}`}>
                    {opt.note}
                  </span>
                </span>
                {isSelected && <CheckCircle size={17} weight="fill" className="shrink-0 text-[#26320b]" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Dialog Footer Actions */}
      <div className="mt-8 flex items-center justify-between border-t border-black/[.07] pt-5">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-full px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          Reset filters
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
            <span>Apply filters</span>
            <span className="grid size-7 place-items-center rounded-full bg-white/15">
              <ArrowUpRight size={14} />
            </span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
