import { useState } from 'react'
import { ArrowUpRight } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'

export default function OpportunityFilterDialog({ skills, skillOptions, onApply, onClose }) {
  const [selectedSkills, setSelectedSkills] = useState(skills)
  const toggleSkill = (skill) => setSelectedSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill])

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow="Refine opportunities" title="Filter your job list" onClose={onClose} />
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choose one or more skills. Use the shared date control in the toolbar for posting time.</p>
    <div className="mt-7 rounded-2xl bg-[var(--paper)] p-4">
      <div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">All skills</p>{selectedSkills.length > 0 && <button onClick={() => setSelectedSkills([])} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear skills</button>}</div>
      <div className="mt-3 flex flex-wrap gap-2">{skillOptions.map((skill) => <button key={skill} onClick={() => toggleSkill(skill)} className={`rounded-full px-3 py-2 text-[10px] font-semibold transition-all duration-300 ${selectedSkills.includes(skill) ? 'bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/30' : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-black/5 hover:text-[var(--ink)]'}`}>{skill}</button>)}</div>
    </div>
    <button onClick={() => onApply(selectedSkills)} className={`${primaryButton} mt-7 w-full`}><span>Apply skill filters</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-white/10"><ArrowUpRight size={15} /></span></button>
  </Modal>
}
