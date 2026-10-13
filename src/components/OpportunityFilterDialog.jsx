import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, CircleNotch, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { api } from '../services/api'

export default function OpportunityFilterDialog({ skills, skillRecords = [], isLoading, error, onApply, onClose }) {
  const queryClient = useQueryClient()
  const [selectedSkills, setSelectedSkills] = useState(skills)
  const [isAdding, setIsAdding] = useState(false)
  const [newSkill, setNewSkill] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleteCandidate, setDeleteCandidate] = useState(null)

  const updateSkillCache = (updater) => queryClient.setQueryData(['skills'], (current) => {
    if (!current?.pages?.length) return current
    return { ...current, pages: current.pages.map(updater) }
  })
  const createMutation = useMutation({
    mutationFn: api.createSkill,
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: ['skills'] })
      const previous = queryClient.getQueryData(['skills'])
      const previousSelected = selectedSkills
      const trimmedName = name.trim()
      const optimisticId = `optimistic-${crypto.randomUUID()}`
      updateSkillCache((page, index) => index === 0 ? { ...page, total: page.total + 1, records: [...page.records, { id: optimisticId, name: trimmedName, _creating: true }] } : page)
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
      updateSkillCache((page) => ({ ...page, records: page.records.map((record) => record.id === id ? { ...record, name: name.trim(), _updating: true } : record) }))
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
      updateSkillCache((page) => ({ ...page, records: page.records.map((record) => record.id === deletedId ? { ...record, _deleting: true } : record) }))
      if (deletedSkill) setSelectedSkills((current) => current.filter((skill) => skill !== deletedSkill.name))
      return { previous, previousSelected }
    },
    onSuccess: (_, deletedId) => {
      updateSkillCache((page) => ({ ...page, total: Math.max(0, page.total - 1), records: page.records.filter((record) => record.id !== deletedId) }))
      setDeleteCandidate(null)
    },
    onError: (_, __, context) => { if (context?.previous) queryClient.setQueryData(['skills'], context.previous); if (context?.previousSelected) setSelectedSkills(context.previousSelected) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['skills'] }),
  })

  const allSkillNames = skillRecords.map((record) => record.name).filter(Boolean)
  const toggleSkill = (skill) => setSelectedSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill])
  const handleAddSkill = () => {
    const trimmed = newSkill.trim()
    if (!trimmed) return
    const existing = allSkillNames.find((skill) => skill.toLowerCase() === trimmed.toLowerCase())
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
  const mutationError = createMutation.error || updateMutation.error || deleteMutation.error || error

  return (
    <Modal onClose={onClose} wide>
      <DialogHeader eyebrow="Refine jobs" title="Filter your job list" onClose={onClose} />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Choose from the shared CRM skills. Changes here update the outr_skills module for everyone.
      </p>
      <div className="mt-7 rounded-2xl bg-[var(--paper)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">All skills</p>
            <p className="mt-1 text-[9px] text-[var(--muted)]">{skillRecords.length} loaded from CRM</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setIsAdding(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--raised)] px-3 py-1.5 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-all duration-300 hover:ring-[var(--lime-dark)]">
              <Plus size={11} weight="bold" /> Add skill
            </button>
            {selectedSkills.length > 0 && <button type="button" onClick={() => setSelectedSkills([])} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear skills</button>}
          </div>
        </div>

        {mutationError && <p role="alert" className="mt-4 rounded-xl bg-[#f5d6cf] px-3 py-2 text-[10px] font-semibold text-[var(--danger)]">{mutationError.message || 'The skill change could not be saved.'}</p>}

        {isAdding && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--raised)] p-2 ring-1 ring-[var(--lime-dark)]/40">
            <input autoFocus value={newSkill} onChange={(event) => setNewSkill(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddSkill() } else if (event.key === 'Escape') { setIsAdding(false); setNewSkill('') } }} placeholder="Enter a skill name" className="min-w-0 flex-1 bg-transparent px-2 text-xs font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" />
            <button type="button" disabled={!newSkill.trim() || createMutation.isPending} onClick={handleAddSkill} className="grid size-7 place-items-center rounded-lg bg-[var(--lime)] text-[#26320b] disabled:opacity-40" aria-label="Create skill">{createMutation.isPending ? <CircleNotch size={13} className="animate-spin" /> : <Check size={13} weight="bold" />}</button>
            <button type="button" onClick={() => { setIsAdding(false); setNewSkill('') }} className="grid size-7 place-items-center rounded-lg bg-[var(--paper)] text-[var(--muted)]" aria-label="Cancel"><X size={12} weight="bold" /></button>
          </div>
        )}

        <div className="mt-4 flex max-h-[42dvh] flex-wrap content-start gap-2 overflow-y-auto pr-1">
          {skillRecords.map((record) => editing?.id === record.id ? (
            <div key={record.id} className="flex items-center gap-1 rounded-full bg-[var(--raised)] p-1 ring-1 ring-[var(--lime-dark)]">
              <input autoFocus value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') handleUpdateSkill(); if (event.key === 'Escape') setEditing(null) }} className="w-32 bg-transparent px-2 text-[10px] font-semibold outline-none" />
              <button type="button" onClick={handleUpdateSkill} disabled={!editing.name.trim() || updateMutation.isPending} className="grid size-6 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] disabled:opacity-40" aria-label="Save skill">{updateMutation.isPending ? <CircleNotch size={11} className="animate-spin" /> : <Check size={11} weight="bold" />}</button>
              <button type="button" onClick={() => setEditing(null)} className="grid size-6 place-items-center rounded-full text-[var(--muted)]" aria-label="Cancel editing"><X size={10} weight="bold" /></button>
            </div>
          ) : (
            <div key={record.id} className={`group flex items-center rounded-full ring-1 transition-all duration-300 ${record._deleting ? 'opacity-55' : ''} ${selectedSkills.includes(record.name) ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/30' : 'bg-[var(--surface)] text-[var(--muted)] ring-black/5'}`}>
              <button type="button" disabled={record._creating || record._deleting} onClick={() => toggleSkill(record.name)} className="py-2 pl-3 pr-2 text-[10px] font-semibold disabled:cursor-wait">{record.name}</button>
              {record._creating ? <span className="mr-2 grid size-5 place-items-center" aria-label="Creating skill"><CircleNotch size={11} className="animate-spin" /></span> : <button type="button" disabled={record._deleting} onClick={() => { setEditing({ id: record.id, name: record.name, previousName: record.name }); setDeleteCandidate(null) }} className="grid size-6 place-items-center rounded-full opacity-45 transition-opacity hover:bg-black/5 hover:opacity-100 disabled:pointer-events-none" aria-label={`Rename ${record.name}`}><PencilSimple size={10} /></button>}
              {!record._creating && (record._deleting ? <span className="mr-2 grid size-6 place-items-center" aria-label="Deleting skill"><CircleNotch size={11} className="animate-spin" /></span> :
              deleteCandidate === record.id ? <>
                <button type="button" onClick={() => deleteMutation.mutate(record.id)} disabled={deleteMutation.isPending} className="grid size-6 place-items-center rounded-full bg-[var(--danger)] text-white" aria-label={`Confirm delete ${record.name}`}>{deleteMutation.isPending ? <CircleNotch size={10} className="animate-spin" /> : <Check size={10} weight="bold" />}</button>
                <button type="button" onClick={() => setDeleteCandidate(null)} className="mr-1 grid size-6 place-items-center rounded-full" aria-label="Cancel delete"><X size={10} /></button>
              </> : <button type="button" onClick={() => { setDeleteCandidate(record.id); setEditing(null) }} className="mr-1 grid size-6 place-items-center rounded-full opacity-45 transition-opacity hover:bg-[#f5d6cf] hover:text-[var(--danger)] hover:opacity-100" aria-label={`Delete ${record.name}`}><Trash size={10} /></button>)}
            </div>
          ))}
          {isLoading && <span className="rounded-full bg-[var(--surface)] px-3 py-2 text-[10px] font-semibold text-[var(--muted)]">Loading skills…</span>}
          {!isLoading && skillRecords.length === 0 && !mutationError && <p className="py-6 text-xs text-[var(--muted)]">No CRM skills have been created yet.</p>}
        </div>
      </div>
      <button onClick={() => onApply(selectedSkills)} className={`${primaryButton} mt-7 w-full`}>
        <span>Apply skill filters</span>
        <span className="ml-auto grid size-8 place-items-center rounded-full bg-white/10"><ArrowUpRight size={15} /></span>
      </button>
    </Modal>
  )
}
