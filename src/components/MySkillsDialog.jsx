import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleNotch, FloppyDisk, WarningCircle } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import SkillsPicker from './SkillsPicker'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

/*
 * My skills: the skills the user works with (CRM: Users <-> Skills). Add them from the Skills list, remove them, or
 * type a new one (added to the Skills module when saved). With the Jobs page's "My skills" box ticked, only the jobs
 * linked to them show. `onSaved` gets the saved skills.
 */
export default function MySkillsDialog({ onClose, onSaved }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: saved, isLoading, isError, error: loadError, refetch } = useQuery({ queryKey: ['my-skills', user?.email], queryFn: () => api.getMySkills(user.email), enabled: Boolean(user?.email) })
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const skills = draft ?? saved ?? []
  const close = saving ? () => {} : onClose

  const save = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const result = await api.saveMySkills(user.email, skills)
      queryClient.setQueryData(['my-skills', user.email], result)
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'my-skill-jobs' || query.queryKey[0] === 'skills' })
      onSaved?.(result)
      onClose()
    } catch (saveError) {
      setError(saveError?.message || 'Your skills could not be saved. Please try again.')
      setSaving(false)
    }
  }

  return <Modal onClose={close}>
    <DialogHeader eyebrow="Jobs" title="My skills" onClose={close} />
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">Tick the skills you work with and untick the ones you don't. With My skills ticked, the Jobs page shows only the jobs for them. Can't find yours? Type it and add it as a new skill.</p>
    <div className="mt-5">
      {isLoading
        ? <p className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]"><CircleNotch size={13} className="animate-spin" />Loading your skills…</p>
        : isError
          ? <p role="alert" className="flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">{loadError?.message || 'Your skills could not be loaded.'}</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Retry</button></p>
          : <SkillsPicker skills={skills} onChange={(next) => { setDraft(next); setError('') }} allowNew label="Your skills" noneLabel="(none yet)" noneHint="None ticked: every job shows" />}
    </div>
    {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />{error}</p>}
    <div className="mt-6 flex items-center justify-end gap-3">
      <button type="button" onClick={save} disabled={saving || isLoading} className={primaryButton}>
        <span>{saving ? 'Saving…' : 'Save my skills'}</span>
        <span className="grid size-8 place-items-center rounded-full bg-white/10">{saving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} weight="bold" />}</span>
      </button>
    </div>
  </Modal>
}
