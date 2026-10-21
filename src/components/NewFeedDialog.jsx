import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleNotch, Plus } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { useCreateFeed } from '../lib/feeds'
import { asArray } from '../lib/safe'

const NAME_MAX = 40
const fieldLabel = 'text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]'
const inputClass = 'mt-2 w-full rounded-xl bg-[var(--paper)] px-3.5 py-3 text-sm text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--lime-dark)]'

/**
 * "+ New feed": the user names the feed and describes what it should show; no developer needed. It is saved in the
 * CRM, shows up in everyone's Feeds menu and opens right away. The description is the feed's prompt: once the feed is
 * connected to an endpoint, it is sent there and the feed shows the content that comes back.
 * `takenNames` are the names already in the nav (sections and feeds).
 */
export default function NewFeedDialog({ user, takenNames = [], onClose }) {
  const navigate = useNavigate()
  const create = useCreateFeed(user)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const trimmed = name.trim()
  const taken = asArray(takenNames).some((taken) => taken.trim().toLowerCase() === trimmed.toLowerCase())
  const close = create.isPending ? () => {} : onClose

  const submit = (event) => {
    event.preventDefault()
    if (!trimmed || !description.trim() || taken) return
    create.mutate({ name: trimmed, description }, {
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
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} required placeholder="Describe what this feed should show, e.g. “The latest Shopify app and theme updates that matter for our clients, with a short summary of each.”" className={`${inputClass} resize-y`} />
      </label>

      {create.error && <p role="alert" className="rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-xs font-semibold text-[var(--bad)]">{create.error.message || 'The feed could not be created. Please try again.'}</p>}
      <div className="flex justify-end">
        <button type="submit" disabled={!trimmed || !description.trim() || taken || create.isPending} className={primaryButton}>
          <span>{create.isPending ? 'Creating…' : 'Create feed'}</span>
          <span className="grid size-8 place-items-center rounded-full bg-white/10">{create.isPending ? <CircleNotch size={14} className="animate-spin" /> : <Plus size={14} weight="bold" />}</span>
        </button>
      </div>
    </form>
  </Modal>
}
