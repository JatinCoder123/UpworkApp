import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CircleNotch, FloppyDisk, Plus, Trash } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { api } from '../services/api'
import { asArray } from '../lib/safe'

const selectClass = 'h-9 w-full min-w-0 cursor-pointer rounded-xl bg-[var(--paper)] px-3 text-xs font-semibold text-[var(--ink)] outline-none ring-1 ring-[var(--line)] focus-visible:ring-2 focus-visible:ring-[var(--lime-dark)]'

/**
 * The user's feed preferences (outr_user_preferences, one CRM record each): Department, Role, the lowest AI score
 * that counts, and a priority. Matching jobs come first in the feed, highest priority first, whatever their age;
 * all other jobs follow below. Changes are saved to the CRM together with "Save preferences".
 */
export default function JobPreferencesDialog({ user, preferences = [], options = { category: [], subcategory: [] }, onClose }) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState(() => asArray(preferences).map((preference) => ({ ...preference, key: preference.id })))
  const [removed, setRemoved] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const labelOf = (list, value) => asArray(list).find((option) => option.value === value)?.label || ''

  const update = (key, change) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change, dirty: true } : row)))
  const add = () => setRows((current) => [...current, { key: `new-${Date.now()}`, category: asArray(options.category)[0]?.value || '', subcategory: '', minScore: 60, priority: 70, active: true, dirty: true }])
  const remove = (row) => {
    setRows((current) => current.filter((item) => item.key !== row.key))
    if (row.id) setRemoved((current) => [...current, row.id])
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await Promise.all([
        ...removed.map((id) => api.deleteMyPreference(id)),
        ...rows.filter((row) => row.dirty || !row.id).map((row) => api.saveMyPreference(user.email, row, { category: labelOf(options.category, row.category), subcategory: labelOf(options.subcategory, row.subcategory) })),
      ])
      await queryClient.invalidateQueries({ queryKey: ['my-preferences'] })
      queryClient.invalidateQueries({ queryKey: ['preferred-jobs'] })
      onClose()
    } catch (saveError) {
      setError(saveError?.message || 'Your preferences could not be saved. Please try again.')
      setSaving(false)
    }
  }

  return <Modal onClose={saving ? () => {} : onClose} wide>
    <DialogHeader eyebrow="Your feed" title="Job preferences" onClose={saving ? () => {} : onClose} />

    <div className="mt-6 space-y-3">
      {rows.map((row) => <div key={row.key} className={`rounded-2xl bg-[var(--paper)] p-3 ring-1 ring-[var(--line)] ${row.active ? '' : 'opacity-60'}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Department</span>
            <select value={row.category} onChange={(event) => update(row.key, { category: event.target.value })} className={selectClass}>
              <option value="">Any department</option>
              {asArray(options.category).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Role</span>
            <select value={row.subcategory} onChange={(event) => update(row.key, { subcategory: event.target.value })} className={selectClass}>
              <option value="">Any role</option>
              {asArray(options.subcategory).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="min-w-0"><span className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Min AI score<b className="font-mono text-xs tracking-normal text-[var(--ink)]">{row.minScore}%</b></span>
            <input type="range" min="0" max="100" step="5" value={row.minScore} onChange={(event) => update(row.key, { minScore: Number(event.target.value) })} className="w-full accent-[var(--lime-dark)]" />
          </label>
          <label className="min-w-0"><span className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Priority in my feed<b className="font-mono text-xs tracking-normal text-[var(--ink)]">{row.priority}%</b></span>
            <input type="range" min="0" max="100" step="5" value={row.priority} onChange={(event) => update(row.key, { priority: Number(event.target.value) })} className="w-full accent-[var(--lime-dark)]" />
          </label>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ink)]">
            <input type="checkbox" checked={row.active} onChange={(event) => update(row.key, { active: event.target.checked })} className="size-4 accent-[var(--lime-dark)]" />Active
          </label>
          <button type="button" onClick={() => remove(row)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold text-[var(--muted)] transition-colors hover:bg-[var(--bad-bg)] hover:text-[var(--bad)]"><Trash size={12} />Remove</button>
        </div>
      </div>)}
      {!rows.length && <p className="rounded-2xl bg-[var(--paper)] px-4 py-6 text-center text-xs text-[var(--muted)] ring-1 ring-[var(--line)]">No preferences yet. Add one to bring the jobs you want to the top of your feed.</p>}
      <button type="button" onClick={add} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-2 text-xs font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><Plus size={12} weight="bold" />Add preference</button>
    </div>

    {error && <p role="alert" className="mt-4 rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-xs font-semibold text-[var(--bad)]">{error}</p>}
    <div className="mt-6 flex justify-end">
      <button type="button" onClick={save} disabled={saving} className={primaryButton}>
        <span>{saving ? 'Saving…' : 'Save preferences'}</span>
        <span className="grid size-8 place-items-center rounded-full bg-white/10">{saving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} />}</span>
      </button>
    </div>
  </Modal>
}
