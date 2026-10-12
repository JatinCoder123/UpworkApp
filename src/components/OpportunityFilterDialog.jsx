import { useState } from 'react'
import { ArrowUpRight, Plus, X } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { loadCustomJobSkills, saveCustomJobSkills } from '../lib/preferences'

export default function OpportunityFilterDialog({ skills, skillOptions, onApply, onAddCustomSkill, onClose }) {
  const [selectedSkills, setSelectedSkills] = useState(skills)
  const [customSkills, setCustomSkills] = useState(loadCustomJobSkills)
  const [isAdding, setIsAdding] = useState(false)
  const [newSkill, setNewSkill] = useState('')

  const allSkills = [...new Set([...(skillOptions || []), ...customSkills])].sort()

  const toggleSkill = (skill) =>
    setSelectedSkills((current) =>
      current.includes(skill)
        ? current.filter((item) => item !== skill)
        : [...current, skill]
    )

  const handleAddSkill = () => {
    const trimmed = newSkill.trim()
    if (!trimmed) return
    const existing = allSkills.find((s) => s.toLowerCase() === trimmed.toLowerCase())
    const skillToUse = existing || trimmed

    if (!existing) {
      const updatedCustom = [...customSkills, skillToUse]
      setCustomSkills(updatedCustom)
      saveCustomJobSkills(updatedCustom)
      if (onAddCustomSkill) onAddCustomSkill(updatedCustom)
    }

    if (!selectedSkills.includes(skillToUse)) {
      setSelectedSkills((current) => [...current, skillToUse])
    }

    setNewSkill('')
    setIsAdding(false)
  }

  return (
    <Modal onClose={onClose} wide>
      <DialogHeader eyebrow="Refine opportunities" title="Filter your job list" onClose={onClose} />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Choose one or more skills. Use the shared date control in the toolbar for posting time.
      </p>
      <div className="mt-7 rounded-2xl bg-[var(--paper)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">All skills</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAdding((prev) => !prev)}
              aria-label="Add custom skill"
              className="inline-flex items-center gap-1 rounded-full bg-[var(--raised)] px-3 py-1 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-all duration-300 hover:ring-[var(--lime-dark)]"
            >
              <Plus size={11} weight="bold" />
              <span>Add skill</span>
            </button>
            {selectedSkills.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedSkills([])}
                className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Clear skills
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {allSkills.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => toggleSkill(skill)}
              className={`rounded-full px-3 py-2 text-[10px] font-semibold transition-all duration-300 ${
                selectedSkills.includes(skill)
                  ? 'bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/30'
                  : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-black/5 hover:text-[var(--ink)]'
              }`}
            >
              {skill}
            </button>
          ))}
          {isAdding ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--raised)] py-1 pl-3 pr-1.5 ring-1 ring-[var(--lime-dark)]">
              <input
                autoFocus
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddSkill()
                  } else if (e.key === 'Escape') {
                    setIsAdding(false)
                    setNewSkill('')
                  }
                }}
                placeholder="New skill..."
                className="w-28 bg-transparent text-[10px] font-semibold text-[var(--ink)] outline-none placeholder:text-[var(--muted)]"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                aria-label="Save skill"
                className="grid size-5 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] transition-colors hover:brightness-95"
              >
                <Plus size={11} weight="bold" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false)
                  setNewSkill('')
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
              aria-label="Add custom skill"
              title="Add custom skill"
              className="grid size-7 place-items-center rounded-full bg-[var(--raised)] text-[var(--ink)] ring-1 ring-[var(--line)] transition-all duration-300 hover:ring-[var(--lime-dark)]"
            >
              <Plus size={12} weight="bold" />
            </button>
          )}
        </div>
      </div>
      <button onClick={() => onApply(selectedSkills)} className={`${primaryButton} mt-7 w-full`}>
        <span>Apply skill filters</span>
        <span className="ml-auto grid size-8 place-items-center rounded-full bg-white/10">
          <ArrowUpRight size={15} />
        </span>
      </button>
    </Modal>
  )
}
