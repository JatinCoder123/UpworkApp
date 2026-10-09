import { ListBullets, Rows, SquaresFour } from '@phosphor-icons/react'

const VIEW_LAYOUTS = [
  { id: 'grid', label: 'Grid', icon: SquaresFour },
  { id: 'list', label: 'List', icon: ListBullets },
  { id: 'compact', label: 'Compact', icon: Rows },
]

export default function LayoutToggle({ layout, onChange, ariaLabel = 'Change layout' }) {
  return (
    <div
      className="flex items-center rounded-full bg-[var(--paper)] p-1 ring-1 ring-black/5 dark:ring-white/10 shrink-0"
      aria-label={ariaLabel}
    >
      {VIEW_LAYOUTS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          title={`${label} view`}
          aria-label={`${label} view`}
          aria-pressed={layout === id}
          onClick={() => onChange(id)}
          className={`grid size-8 place-items-center rounded-full transition-all duration-300 ${
            layout === id
              ? 'bg-[var(--raised)] text-[var(--ink)] shadow-sm'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Icon size={15} weight={layout === id ? 'fill' : 'regular'} />
        </button>
      ))}
    </div>
  )
}
