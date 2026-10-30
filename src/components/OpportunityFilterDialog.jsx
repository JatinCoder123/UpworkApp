import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleNotch, Info, MagnifyingGlass, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react'
import { Modal } from './ui'
import { ExtraFilterFields } from './JobListControls'
import { api } from '../services/api'
import { EMPTY_EXTRA_FILTERS } from '../lib/preferences'
import { countExtraFilters } from '../lib/jobSignals'
import { asArray, asText } from '../lib/safe'


// Skills plus job type and client location; picks apply together when the dialog closes (outside click, X or Escape).
// With `skillsOnly` it is the skills panel of the skills row: category tabs, then (once a category is picked) its sub
// category tabs, then the skills; "All" is the default and nothing applies unless the user picks it. No job type / location.
export default function OpportunityFilterDialog({ skills = [], extraFilters = EMPTY_EXTRA_FILTERS, skillRecords = [], groupOptions = { category: [], subcategory: [] }, group = { category: '', subcategory: '' }, skillsOnly = false, isLoading, error, onApply, onRemove }) {
  const queryClient = useQueryClient()
  const [selectedSkills, setSelectedSkills] = useState(skills)
  const [filters, setFilters] = useState(extraFilters)
  const [isAdding, setIsAdding] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  // CRM dropdown keys ('' = all), starting from the category picked in the skills section.
  const [category, setCategory] = useState(group.category || '')
  const [subcategory, setSubcategory] = useState(group.category ? group.subcategory || '' : '')
  // Search box over the skills in the open tab (by name).
  const [query, setQuery] = useState('')

  const updateSkillCache = (updater) => queryClient.setQueryData(['skills'], (current) => {
    if (!asArray(current?.pages).length) return current
    return { ...current, pages: current.pages.map(updater) }
  })
  const createMutation = useMutation({
    // In the skills panel a new skill is filed under the open category / sub category.
    mutationFn: (name) => api.createSkill(name, skillsOnly ? { category, subcategory } : {}),
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: ['skills'] })
      const previous = queryClient.getQueryData(['skills'])
      const previousSelected = selectedSkills
      const trimmedName = name.trim()
      const optimisticId = `optimistic-${crypto.randomUUID()}`
      updateSkillCache((page, index) => index === 0 ? { ...page, total: page.total + 1, records: [...asArray(page.records), { id: optimisticId, name: trimmedName, _creating: true }] } : page)
      setSelectedSkills((current) => current.includes(trimmedName) ? current : [...current, trimmedName])
      setNewSkill('')
      setIsAdding(false)
      return { previous, previousSelected }
    },
    onError: (_, __, context) => { if (context?.previous) queryClient.setQueryData(['skills'], context.previous); if (context?.previousSelected) setSelectedSkills(context.previousSelected) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, name }) => api.updateSkill(id, name),
    onMutate: async ({ id, name, previousName }) => {
      await queryClient.cancelQueries({ queryKey: ['skills'] })
      const previous = queryClient.getQueryData(['skills'])
      const previousSelected = selectedSkills
      updateSkillCache((page) => ({ ...page, records: asArray(page.records).map((record) => record.id === id ? { ...record, name: name.trim(), _updating: true } : record) }))
      setSelectedSkills((current) => current.map((skill) => skill === previousName ? name.trim() : skill))
      return { previous, previousSelected }
    },
    onSuccess: () => setEditing(null),
    onError: (_, __, context) => { if (context?.previous) queryClient.setQueryData(['skills'], context.previous); if (context?.previousSelected) setSelectedSkills(context.previousSelected) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteSkill,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['skills'] })
      const previous = queryClient.getQueryData(['skills'])
      const previousSelected = selectedSkills
      const deletedSkill = skillRecords.find((record) => record.id === deletedId)
      updateSkillCache((page) => ({ ...page, records: asArray(page.records).map((record) => record.id === deletedId ? { ...record, _deleting: true } : record) }))
      if (deletedSkill) setSelectedSkills((current) => current.filter((skill) => skill !== deletedSkill.name))
      return { previous, previousSelected }
    },
    onSuccess: (_, deletedId) => {
      updateSkillCache((page) => ({ ...page, total: Math.max(0, page.total - 1), records: asArray(page.records).filter((record) => record.id !== deletedId) }))
      setDeleteCandidate(null)
    },
    onError: (_, __, context) => { if (context?.previous) queryClient.setQueryData(['skills'], context.previous); if (context?.previousSelected) setSelectedSkills(context.previousSelected) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  })

  const allSkillNames = skillRecords.map((record) => record.name).filter(Boolean)
  // Category and sub category tabs: the CRM jobs dropdowns. The skills in a tab and the tab counts come from the gateway.
  const labelOf = (field, value) => asArray(groupOptions[field]).find((option) => option.value === value)?.label || ''
  const categoryLabel = labelOf('category', category)
  const subcategoryLabel = labelOf('subcategory', subcategory)
  const { data: groupCounts } = useQuery({
    queryKey: ['skills', 'group-counts', groupOptions, category],
    queryFn: () => api.getSkillGroupCounts({ options: groupOptions, category }),
    enabled: asArray(groupOptions.category).length > 0,
    placeholderData: (previous) => previous,
  })
  const { data: groupSkills, isLoading: groupLoading } = useQuery({
    queryKey: ['skills', 'group', category, subcategory],
    queryFn: () => api.getSkillsInGroup({ category, subcategory }),
    enabled: Boolean(category),
    placeholderData: (previous) => previous,
  })
  const inGroup = new Set(asArray(groupSkills).map((record) => record.id))
  const searchText = query.trim().toLowerCase()
  const visibleSkills = (category ? skillRecords.filter((record) => inGroup.has(record.id) || editing?.id === record.id) : skillRecords)
    .filter((record) => !searchText || editing?.id === record.id || asText(record.name).toLowerCase().includes(searchText))
  const tabCount = (field, value) => groupCounts?.[field]?.[value]
  // Every sub category in the CRM dropdown is a tab, each with its skill count.
  const subcategoryTabs = asArray(groupOptions.subcategory)
  const pickCategory = (value) => { setCategory(value); setSubcategory('') }
  const tabClass = (active, small = false) => `inline-flex shrink-0 items-center gap-1.5 rounded-full ${small ? 'px-2.5 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]'} font-bold ring-1 transition-colors ${active ? (small ? 'bg-[var(--lime)] !text-[var(--on-lime)] ring-[var(--lime-dark)]/40' : 'bg-[var(--text)] text-[var(--paper)] ring-[var(--text)]') : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)]'}`
  const countBadge = (active, total) => total == null ? null : <span className={`rounded-full px-1.5 py-px text-[9px] tabular-nums ${active ? 'bg-black/10 dark:bg-white/15' : 'bg-[var(--paper)]'}`}>{total}</span>
  // Removing a filter takes effect on the list straight away; new picks still wait for "Apply filters".
  const removeNow = (next) => onRemove({ skills, extraFilters, ...next })
  const toggleSkill = (skill) => {
    if (!selectedSkills.includes(skill)) return setSelectedSkills((current) => [...current, skill])
    setSelectedSkills((current) => current.filter((item) => item !== skill))
    if (skills.includes(skill)) removeNow({ skills: skills.filter((item) => item !== skill) })
  }
  const changeFilters = (next) => {
    setFilters(next)
    const cleared = Object.keys(EMPTY_EXTRA_FILTERS).filter((key) => next[key] === EMPTY_EXTRA_FILTERS[key] && extraFilters[key] !== EMPTY_EXTRA_FILTERS[key])
    if (cleared.length) removeNow({ extraFilters: { ...extraFilters, ...Object.fromEntries(cleared.map((key) => [key, EMPTY_EXTRA_FILTERS[key]])) } })
  }
  const clearFilters = () => {
    setSelectedSkills([])
    setFilters(EMPTY_EXTRA_FILTERS)
    removeNow({ skills: [], extraFilters: EMPTY_EXTRA_FILTERS })
  }
  const hasFilters = selectedSkills.length > 0 || skills.length > 0 || countExtraFilters(filters) > 0 || countExtraFilters(extraFilters) > 0
  const handleAddSkill = () => {
    const trimmed = newSkill.trim()
    if (!trimmed) return
    const existing = allSkillNames.find((skill) => asText(skill).toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      setSelectedSkills((current) => current.includes(existing) ? current : [...current, existing])
      setNewSkill('')
      setIsAdding(false)
      return
    }
    createMutation.mutate(trimmed)
  }
  const handleUpdateSkill = () => {
    const name = editing?.name?.trim()
    if (!editing?.id || !name) return
    updateMutation.mutate({ id: editing.id, name, previousName: editing.previousName })
  }
  // The page's onApply also closes the dialog.
  // The skills panel moves the skills row to the category / sub category only when the user changed them here,
  // so opening and closing the panel never applies a filter by itself.
  const groupChanged = category !== (group.category || '') || subcategory !== (group.category ? group.subcategory || '' : '')
  const applyAndClose = () => onApply({ skills: selectedSkills, extraFilters: filters, ...(skillsOnly && groupChanged ? { group: { category, subcategory } } : {}) })
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error || error

  return (
    <Modal onClose={applyAndClose} wide>
      {/* Dark header with the lime circles, as in the design. */}
      <div className="relative -mx-5 -mt-5 mb-6 overflow-hidden rounded-t-[calc(2rem-.375rem)] bg-[var(--hero)] px-6 pb-7 pt-12 sm:-mx-8 sm:-mt-8 sm:px-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-[var(--hero-soft)]" />
        <span aria-hidden="true" className="pointer-events-none absolute right-12 top-20 size-12 rounded-full border-2 border-[var(--hero-soft)]/80" />
        {/* Solid dark circle, so the x shows clearly on top of the lime circle. */}
        <button type="button" onClick={applyAndClose} aria-label="Close dialog" className="absolute right-6 top-6 z-10 grid size-9 place-items-center rounded-full bg-[var(--hero)] text-white shadow-[0_4px_14px_rgba(0,0,0,.25)] ring-1 ring-white/25 transition-transform hover:scale-105"><X size={15} weight="bold" /></button>
        <h2 className="relative max-w-[17rem] text-[1.75rem] font-semibold leading-[1.05] tracking-[-.045em] text-white">Find the skills that <span className="block font-serif italic text-[var(--hero-soft)]">fit you.</span></h2>
      </div>

      {!skillsOnly && <div className="space-y-1"><ExtraFilterFields value={filters} onChange={changeFilters} /></div>}

      <div className={skillsOnly ? '' : 'mt-6'}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Skills</p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">{selectedSkills.length} selected · {skillRecords.length} from CRM</p>
          </div>
          {/* Clear and Apply filter, next to Add skill. */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {skillsOnly
              // Clear: no skills, back to All / All. The removed skills apply straight away, like other removals.
              ? <button type="button" disabled={!selectedSkills.length && !skills.length && !category} onClick={() => { setSelectedSkills([]); pickCategory(''); if (skills.length) removeNow({ skills: [] }) }} className="rounded-full px-3.5 py-2 text-xs font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40">Clear</button>
              : <button type="button" disabled={!hasFilters} onClick={clearFilters} className="rounded-full px-3.5 py-2 text-xs font-bold text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40">Clear filters</button>}
            <button type="button" onClick={applyAndClose} className="rounded-full bg-[var(--text)] px-4 py-2 text-xs font-bold text-[var(--paper)] transition-transform duration-300 hover:-translate-y-0.5">Apply filter</button>
            <button type="button" onClick={() => setIsAdding(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--raised)] px-3.5 py-2 text-xs font-bold text-[var(--ink)] ring-1 ring-[var(--ink)]/70 transition-colors hover:bg-[var(--paper)]">
              <Plus size={12} weight="bold" /> Add skill
            </button>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--raised)] px-3.5 py-2.5 ring-1 ring-[var(--line)] focus-within:ring-2 focus-within:ring-[var(--lime-dark)]">
          <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
          <span className="sr-only">Search skills</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape' && query) { event.stopPropagation(); setQuery('') } }} placeholder={`Search ${skillRecords.length} skills`} className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:text-[var(--ink)]"><X size={10} weight="bold" /></button>}
        </label>

        {asArray(groupOptions.category).length > 0 && <div role="tablist" aria-label="Departments" className="mt-4 flex gap-5 overflow-x-auto border-b border-[var(--line)] [scrollbar-width:none]">
          {[{ value: '', label: 'All', total: skillRecords.length }, ...groupOptions.category.map((option) => ({ ...option, total: tabCount('category', option.value) }))].map((option) => {
            const active = category === option.value
            return <button key={option.value || 'all'} type="button" role="tab" aria-selected={active} onClick={() => pickCategory(active ? '' : option.value)} title={active && option.value ? 'Click to remove' : undefined} className={`-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-xs font-semibold transition-colors ${active ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
              {option.label}
              {option.total != null && <span className={`rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${active ? 'bg-[var(--ink)] text-white dark:bg-[var(--text)] dark:text-[var(--paper)]' : 'bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)]'}`}>{option.total}</span>}
            </button>
          })}
        </div>}
        {/* Roles of the chosen department, under its tab. */}
        {category && subcategoryTabs.length > 0 && <div role="tablist" aria-label={`${categoryLabel} roles`} className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" role="tab" aria-selected={!subcategory} onClick={() => setSubcategory('')} className={tabClass(!subcategory, true)}>All {categoryLabel}{countBadge(!subcategory, tabCount('category', category))}</button>
          {subcategoryTabs.map((option) => {
            const active = subcategory === option.value
            return <button key={option.value} type="button" role="tab" aria-selected={active} onClick={() => setSubcategory(active ? '' : option.value)} title={active ? 'Click to remove' : undefined} className={tabClass(active, true)}>{option.label}{countBadge(active, tabCount('subcategory', option.value))}</button>
          })}
        </div>}

        {mutationError && <p role="alert" className="mt-4 rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-[10px] font-semibold text-[var(--danger)]">{mutationError.message || 'The skill change could not be saved.'}</p>}

        {isAdding && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--raised)] p-2 ring-1 ring-[var(--lime-dark)]/40">
            <input autoFocus value={newSkill} onChange={(event) => setNewSkill(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddSkill() } else if (event.key === 'Escape') { event.stopPropagation(); setIsAdding(false); setNewSkill('') } }} placeholder="Enter a skill name" className="min-w-0 flex-1 bg-transparent px-2 text-xs font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
            <button type="button" disabled={!newSkill.trim() || createMutation.isPending} onClick={handleAddSkill} className="grid size-7 place-items-center rounded-lg bg-[var(--lime)] text-[var(--on-lime)] disabled:opacity-40" aria-label="Create skill">{createMutation.isPending ? <CircleNotch size={13} className="animate-spin" /> : <Check size={13} weight="bold" />}</button>
            <button type="button" onClick={() => { setIsAdding(false); setNewSkill('') }} className="grid size-7 place-items-center rounded-lg bg-[var(--paper)] text-[var(--muted)]" aria-label="Cancel"><X size={12} weight="bold" /></button>
          </div>
        )}

        <div className="mt-3 flex max-h-[38dvh] min-h-24 flex-wrap content-start gap-2 overflow-y-auto rounded-2xl p-1 pr-2 [scrollbar-width:thin]">
          {visibleSkills.map((record) => editing?.id === record.id ? (
            <div key={record.id} className="flex items-center gap-1 rounded-full bg-[var(--raised)] p-1 ring-1 ring-[var(--lime-dark)]">
              <input autoFocus value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') handleUpdateSkill(); if (event.key === 'Escape') { event.stopPropagation(); setEditing(null) } }} className="w-32 bg-transparent px-2 text-[10px] font-semibold outline-none" />
              <button type="button" onClick={handleUpdateSkill} disabled={!editing.name.trim() || updateMutation.isPending} className="grid size-6 place-items-center rounded-full bg-[var(--lime)] text-[var(--on-lime)] disabled:opacity-40" aria-label="Save skill">{updateMutation.isPending ? <CircleNotch size={11} className="animate-spin" /> : <Check size={11} weight="bold" />}</button>
              <button type="button" onClick={() => setEditing(null)} className="grid size-6 place-items-center rounded-full text-[var(--muted)]" aria-label="Cancel editing"><X size={10} weight="bold" /></button>
            </div>
          ) : (
            <div key={record.id} className={`group flex items-center rounded-full ring-1 transition-all duration-300 ${record._deleting ? 'opacity-55' : ''} ${selectedSkills.includes(record.name) ? 'bg-[var(--lime-tint)]/55 text-[var(--lime-ink)] ring-[var(--lime-dark)]/50' : 'bg-[var(--raised)] text-[var(--ink)] ring-[var(--line)]'}`}>
              <button type="button" disabled={record._creating || record._deleting} onClick={() => toggleSkill(record.name)} className="inline-flex items-center gap-1 py-2 pl-3 pr-2 text-[11px] font-semibold disabled:cursor-wait">{selectedSkills.includes(record.name) && <Check size={11} weight="bold" />}{record.name}</button>
              {record._creating ? <span className="mr-2 grid size-5 place-items-center" aria-label="Creating skill"><CircleNotch size={11} className="animate-spin" /></span> : <button type="button" disabled={record._deleting} onClick={() => { setEditing({ id: record.id, name: asText(record.name), previousName: record.name }); setDeleteCandidate(null) }} className="grid size-6 place-items-center rounded-full opacity-45 transition-opacity hover:bg-black/5 hover:opacity-100 disabled:pointer-events-none" aria-label={`Rename ${record.name}`}><PencilSimple size={10} /></button>}
              {!record._creating && (record._deleting ? <span className="mr-2 grid size-6 place-items-center" aria-label="Deleting skill"><CircleNotch size={11} className="animate-spin" /></span> :
              deleteCandidate === record.id ? <>
                <button type="button" onClick={() => deleteMutation.mutate(record.id)} disabled={deleteMutation.isPending} className="grid size-6 place-items-center rounded-full bg-[var(--danger)] text-white" aria-label={`Confirm delete ${record.name}`}>{deleteMutation.isPending ? <CircleNotch size={10} className="animate-spin" /> : <Check size={10} weight="bold" />}</button>
                <button type="button" onClick={() => setDeleteCandidate(null)} className="mr-1 grid size-6 place-items-center rounded-full" aria-label="Cancel delete"><X size={10} /></button>
              </> : <button type="button" onClick={() => { setDeleteCandidate(record.id); setEditing(null) }} className="mr-1 grid size-6 place-items-center rounded-full opacity-45 transition-opacity hover:bg-[var(--bad-bg)] hover:text-[var(--danger)] hover:opacity-100" aria-label={`Delete ${record.name}`}><Trash size={10} /></button>)}
            </div>
          ))}
          {(isLoading || (category && groupLoading)) && <span className="rounded-full bg-[var(--surface)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)]">Loading skills…</span>}
          {!isLoading && skillRecords.length === 0 && !mutationError && <p className="py-6 text-xs text-[var(--muted)]">No CRM skills have been created yet.</p>}
          {!isLoading && !groupLoading && skillRecords.length > 0 && visibleSkills.length === 0 && <p className="px-2 py-6 text-xs text-[var(--muted)]">{searchText ? `No skills match "${query.trim()}".` : `No skills in ${[categoryLabel, subcategoryLabel].filter(Boolean).join(' · ')} yet.`}</p>}
        </div>
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--paper)] px-3 py-2 text-[11px] text-[var(--muted)] ring-1 ring-[var(--line)]/70"><Info size={13} className="shrink-0" />Edits to skills are shared with your whole team.</p>
      </div>

    </Modal>
  )
}
