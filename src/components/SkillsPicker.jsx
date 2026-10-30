import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretDown, Check, CircleNotch, MagnifyingGlass, Plus, Sparkle, X } from '@phosphor-icons/react'
import { api } from '../services/api'

const fieldLabel = 'mb-1 block text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]'
// Skill names compared: case and extra spaces do not matter.
const skillKey = (name) => String(name || '').trim().replace(/\s+/g, ' ').toLowerCase()

// Skills of a preference: chips for the picked ones (x removes) and "Add skill", which opens a searchable list of the
// Department's skills from the Skills module (all skills for "Any department"); clicking one adds or removes it.
// No skill picked = any skill in that Department. Used by My preferences, the New feed dialog and the user's own
// skills (onboarding, My skills). `allowNew`: a skill not in the list can be typed in and added as new
// ({ id: 'new:…', name, isNew }); it is created in the CRM when saved.
export default function SkillsPicker({ category, skills, onChange, allowNew = false, label = 'Skills', noneLabel = '(any)', noneHint = 'None selected = any skill' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const panel = useRef(null)
  const { data = [], isLoading, isError, error, refetch } = useQuery({
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
  // A typed skill: the existing one when the name matches (case and spaces do not matter), else a new one.
  const typed = query.trim().replace(/\s+/g, ' ')
  const existing = typed && data.find((skill) => skillKey(skill.name) === skillKey(typed))
  const canAddNew = allowNew && typed && !existing && !skills.some((skill) => skillKey(skill.name) === skillKey(typed))
  const addTyped = () => {
    if (existing) { if (!picked(existing.id)) toggle(existing) } else if (canAddNew) onChange([...skills, { id: `new:${skillKey(typed)}`, name: typed, isNew: true }])
    setQuery('')
  }
  const onKeyDown = (event) => {
    // Escape closes the list only, not the whole dialog.
    if (event.key === 'Escape' && open) {
      event.nativeEvent.stopPropagation()
      setOpen(false)
    }
  }
  // Enter in the search adds the typed skill (with allowNew) and never submits the form around the picker.
  const onSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (allowNew) addTyped()
  }

  return <div ref={panel} className="min-w-0" onKeyDown={onKeyDown}>
    <p className={fieldLabel}>{label} <span className="font-medium normal-case tracking-normal">{skills.length ? `(${skills.length})` : noneLabel}</span></p>
    {/* index.css gives buttons and inputs `font: inherit`, so their text size and weight are set on the wrappers. */}
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--surface)] p-1.5 text-[11px] font-bold ring-1 ring-[var(--line)]">
      {skills.map((skill) => <span key={skill.id} className="inline-flex items-center gap-1 rounded-full bg-(--lime-tint)/40 py-1 pl-2.5 pr-1 text-[11px] font-semibold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/40">
        {skill.name || 'Saved skill'}
        {skill.isNew && <span title="A new skill: added to the skills list when you save" className="rounded-full bg-[var(--surface)] px-1.5 py-px text-[9px] font-bold uppercase tracking-[.08em] text-[var(--accent-strong)]">New</span>}
        <button type="button" onClick={() => toggle(skill)} aria-label={`Remove ${skill.name}`} className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/15"><X size={9} weight="bold" /></button>
      </span>)}
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition-colors ${open ? 'bg-[var(--text)] text-[var(--paper)]' : 'border border-dashed border-[var(--line)] text-[var(--muted)] hover:border-[var(--lime-dark)] hover:text-[var(--ink)]'}`}>
        <Plus size={11} weight="bold" />Add skill<CaretDown size={10} weight="bold" className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </div>
    {open && <div className="mt-1.5 overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[0_18px_50px_rgb(var(--shadow-rgb)/.14)] ring-1 ring-[var(--line)]">
      <label className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 text-xs font-semibold">
        <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={onSearchKeyDown} autoFocus placeholder={allowNew ? 'Search, or type a new skill' : 'Search skills'} aria-label="Search skills" className="h-7 min-w-0 flex-1 bg-transparent text-xs font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10"><X size={10} weight="bold" /></button>}
      </label>
      <ul role="listbox" aria-multiselectable="true" aria-label="Skills" className="max-h-56 overflow-y-auto p-1 text-xs font-semibold">
        {canAddNew && <li role="option" aria-selected={false}>
          <button type="button" onClick={addTyped} className="flex w-full items-center gap-2.5 rounded-xl bg-(--lime-tint)/20 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/30 transition-colors hover:bg-(--lime-tint)/35">
            <Sparkle size={14} weight="fill" className="shrink-0 text-[var(--accent-strong)]" />
            <span className="truncate">Add “{typed}” as a new skill</span>
          </button>
        </li>}
        {isLoading && <li className="flex items-center gap-2 px-3 py-2.5 text-xs text-[var(--muted)]"><CircleNotch size={12} className="animate-spin" />Loading skills…</li>}
        {isError && <li role="alert" className="px-3 py-2.5 text-xs text-[var(--bad)]">The skills could not be loaded: {error?.message} <button type="button" onClick={() => refetch()} className="font-bold underline underline-offset-4">Try again</button></li>}
        {!isLoading && !isError && !list.length && !canAddNew && <li className="px-3 py-2.5 text-xs text-[var(--muted)]">{term ? `No skill matches “${query.trim()}”.` : 'No skills in this department yet.'}</li>}
        {list.map((skill) => {
          const on = picked(skill.id)
          return <li key={skill.id} role="option" aria-selected={on}>
            <button type="button" onClick={() => toggle(skill)} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] transition-colors ${on ? 'bg-(--lime-tint)/35' : 'hover:bg-black/[.04] dark:hover:bg-white/[.06]'}`}>
              <span className={`grid size-4 shrink-0 place-items-center rounded-[5px] ring-1 ${on ? 'bg-[var(--lime-dark)] text-white ring-[var(--lime-dark)]' : 'ring-[var(--line)]'}`}>{on && <Check size={10} weight="bold" />}</span>
              <span className="truncate">{skill.name}</span>
            </button>
          </li>
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-[var(--line)] px-3 py-2 text-[11px] font-bold">
        <span className="text-[11px] text-[var(--muted)]">{skills.length ? `${skills.length} selected` : noneHint}</span>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-[var(--text)] px-3 py-1 text-[11px] font-bold text-[var(--paper)] transition-transform hover:-translate-y-0.5">Done</button>
      </div>
    </div>}
  </div>
}
