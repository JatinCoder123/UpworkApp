import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CaretDown, CircleNotch, Plus } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import SkillsPicker from './SkillsPicker'
import { api } from '../services/api'
import { FEEDS_READY, useCreateFeed } from '../lib/feeds'
import { asArray } from '../lib/safe'

const NAME_MAX = 40
const fieldLabel = 'text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]'
const inputClass = 'mt-2 w-full rounded-xl bg-[var(--paper)] px-3.5 py-3 text-sm text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--lime-dark)]'

/**
 * "+ New feed": the user names the feed and describes what it should show; no developer needed. It is saved in the
 * CRM, shows up in everyone's Feeds menu and opens right away. The description is the feed's prompt: once the feed is
 * connected to an endpoint, it is sent there and the feed shows the content that comes back. The feed can be tied to a
 * Department and one or more Skills (the CRM's lists, picked like in My preferences), or a custom skill typed in.
 * `takenNames` are the names already in the nav (sections and feeds).
 */
export default function NewFeedDialog({ user, takenNames = [], onClose }) {
  const navigate = useNavigate()
  const create = useCreateFeed(user)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [department, setDepartment] = useState('')
  // Skills picked, as { id, name }; none = any skill.
  const [skills, setSkills] = useState([])
  const [customSkill, setCustomSkill] = useState('')

  // Departments: the same CRM list (and cache) as the Jobs skills row; the skills come with the picker.
  const { data: groupOptions } = useQuery({ queryKey: ['skills', 'group-options'], queryFn: () => api.getGroupOptions(), staleTime: 10 * 60_000 })
  const departments = asArray(groupOptions?.category)

  const trimmed = name.trim()
  const taken = asArray(takenNames).some((taken) => taken.trim().toLowerCase() === trimmed.toLowerCase())
  const close = create.isPending ? () => {} : onClose

  const submit = (event) => {
    event.preventDefault()
    if (!FEEDS_READY || !trimmed || !description.trim() || taken) return
    // The CRM field takes the skills' names together ("PHP, SuiteCRM"); none = any skill.
    create.mutate({ name: trimmed, description, department, skill: skills.map((item) => item.name).join(', '), customSkill }, {
      onSuccess: (id) => { onClose(); if (id) navigate(`/feeds/${id}`) },
    })
  }

  return <Modal onClose={close}>
    <DialogHeader eyebrow="Feeds" title="Create a new feed" onClose={close} />

    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className={`${fieldLabel} flex justify-between`}>Feed name<span className="font-mono normal-case tracking-normal">{trimmed.length}/{NAME_MAX}</span></span>
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={NAME_MAX} required autoFocus placeholder="e.g. Shopify updates" className={inputClass} />
        {taken && <span role="alert" className="mt-1.5 block text-[11px] font-semibold text-[var(--bad)]">A section or feed with this name already exists.</span>}
      </label>
      <label className="block">
        <span className={fieldLabel}>Description</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} required placeholder="Describe what this feed should show, e.g. “The latest Shopify app and theme updates that matter for our clients, with a short summary of each.”" className={`${inputClass} resize-y`} />
      </label>

      <label className="block">
        <span className={fieldLabel}>Department</span>
        <span className="relative block">
          <select value={department} onChange={(event) => { setDepartment(event.target.value); setSkills([]) }} className={`${inputClass} cursor-pointer appearance-none pr-9`}>
            <option value="">Any department</option>
            {departments.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <CaretDown size={13} weight="bold" className="pointer-events-none absolute right-3.5 top-1/2 mt-1 -translate-y-1/2 text-[var(--muted)]" />
        </span>
      </label>
      {/* Several skills, like in My preferences: chips, "Add skill" and a searchable list of the Department's skills. */}
      <SkillsPicker category={department} skills={skills} onChange={setSkills} />
      <label className="block">
        <span className={fieldLabel}>Custom skill <span className="font-medium normal-case tracking-normal">(not in the list)</span></span>
        <input value={customSkill} onChange={(event) => setCustomSkill(event.target.value)} maxLength={60} placeholder="e.g. Shopify Liquid" className={inputClass} />
      </label>

      {create.error && <p role="alert" className="rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-xs font-semibold text-[var(--bad)]">{create.error.message || 'The feed could not be created. Please try again.'}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={!FEEDS_READY || !trimmed || !description.trim() || taken || create.isPending} className={primaryButton}>
          <span>{create.isPending ? 'Creating…' : 'Create feed'}</span>
          <span className="grid size-8 place-items-center rounded-full bg-white/10">{create.isPending ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />}</span>
        </button>
      </div>
    </form>
  </Modal>
}
