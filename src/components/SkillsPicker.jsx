import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretDown, Check, CircleNotch, MagnifyingGlass, Plus, X } from '@phosphor-icons/react'
import { api } from '../services/api'

const fieldLabel = 'mb-1 block text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]'

// Skills of a preference: chips for the picked ones (x removes) and "Add skill", which opens a searchable list of the
// Department's skills from the Skills module (all skills for "Any department"); clicking one adds or removes it.
// No skill picked = any skill in that Department. Used by My preferences and the New feed dialog.
export default function SkillsPicker({ category, skills, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const panel = useRef(null)
  const { data = [], isLoading } = useQuery({
    queryKey: ['skills', 'group', category || '', ''],
    queryFn: () => api.getSkillsInGroup({ category }),
    staleTime: 5 * 60_000,
  })
  useEffect(() => {
    if (!open) return undefined
    const dismiss = (event) => !panel.current?.contains(event.target) && setOpen(false)
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  const term = query.trim().toLowerCase()
  const list = [...data].sort((a, b) => a.name.localeCompare(b.name)).filter((skill) => !term || skill.name.toLowerCase().includes(term))
  const picked = (id) => skills.some((skill) => skill.id === id)
  const toggle = (skill) => onChange(picked(skill.id) ? skills.filter((item) => item.id !== skill.id) : [...skills, { id: skill.id, name: skill.name }])
  // Escape closes the list only, not the whole dialog.
  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !open) return
    event.nativeEvent.stopPropagation()
    setOpen(false)
  }

  return <div ref={panel} className="min-w-0" onKeyDown={onKeyDown}>
    <p className={fieldLabel}>Skills <span className="font-medium normal-case tracking-normal">{skills.length ? `(${skills.length})` : '(any)'}</span></p>
    {/* index.css gives buttons and inputs `font: inherit`, so their text size and weight are set on the wrappers. */}
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--surface)] p-1.5 text-[11px] font-bold ring-1 ring-[var(--line)]">
      {skills.map((skill) => <span key={skill.id} className="inline-flex items-center gap-1 rounded-full bg-(--lime)/40 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/40">
        {skill.name || 'Saved skill'}
        <button type="button" onClick={() => toggle(skill)} aria-label={`Remove ${skill.name}`} className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/15"><X size={9} weight="bold" /></button>
      </span>)}
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors ${open ? 'bg-[var(--text)] text-[var(--paper)]' : 'border border-dashed border-[var(--line)] text-[var(--muted)] hover:border-[var(--lime-dark)] hover:text-[var(--ink)]'}`}>
        <Plus size={11} weight="bold" />Add skill<CaretDown size={10} weight="bold" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
    {open && <div className="mt-1.5 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[0_18px_50px_rgba(30,32,25,.14)] ring-1 ring-[var(--line)]">
      <label className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-xs font-semibold">
        <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="Search skills" aria-label="Search skills" className="h-7 min-w-0 flex-1 bg-transparent text-xs font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10"><X size={10} weight="bold" /></button>}
      </label>
      <ul role="listbox" aria-multiselectable="true" aria-label="Skills" className="max-h-56 overflow-y-auto p-1 text-xs font-semibold">
        {isLoading && <li className="flex items-center gap-2 px-3 py-2.5 text-xs text-[var(--muted)]"><CircleNotch size={12} className="animate-spin" />Loading skills…</li>}
        {!isLoading && !list.length && <li className="px-3 py-2.5 text-xs text-[var(--muted)]">{term ? `No skill matches “${query.trim()}”.` : 'No skills in this department yet.'}</li>}
        {list.map((skill) => {
          const on = picked(skill.id)
          return <li key={skill.id} role="option" aria-selected={on}>
            <button type="button" onClick={() => toggle(skill)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] transition-colors ${on ? 'bg-(--lime)/35' : 'hover:bg-black/[.04] dark:hover:bg-white/[.06]'}`}>
              <span className={`grid size-4 shrink-0 place-items-center rounded-[5px] ring-1 ${on ? 'bg-[var(--lime-dark)] text-white ring-[var(--lime-dark)]' : 'ring-[var(--line)]'}`}>{on && <Check size={10} weight="bold" />}</span>
              <span className="truncate">{skill.name}</span>
            </button>
          </li>
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-2 text-[11px] font-bold">
        <span className="text-[11px] text-[var(--muted)]">{skills.length ? `${skills.length} selected` : 'None selected = any skill'}</span>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-[var(--text)] px-3 py-1 text-[11px] font-bold text-[var(--paper)] transition-transform hover:-translate-y-0.5">Done</button>
      </div>
    </div>}
  </div>
}
