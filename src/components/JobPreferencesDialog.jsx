import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CaretDown, CircleNotch, Fire, FloppyDisk, Plus, Trash } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import SkillsPicker from './SkillsPicker'
import { api } from '../services/api'
import { asArray } from '../lib/safe'

const selectClass = 'h-9 w-full min-w-0 cursor-pointer appearance-none rounded-xl bg-[var(--surface)] pl-3 pr-8 text-xs font-semibold text-[var(--ink)] outline-none ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]/60 focus-visible:ring-2 focus-visible:ring-[var(--lime-dark)]'
const fieldLabel = 'mb-1 block text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]'

/*
 * One preference = a Department, one or more Skills and the lowest AI score that counts. The CRM keeps one skill per
 * outr_user_preferences record, so a preference with several skills is several records with the same Department,
 * AI score and Active; this dialog shows them grouped as one row and saves them back the same way.
 */
const groupKey = (preference) => `${preference.category}|${preference.minScore}|${preference.active ? 1 : 0}`

function groupPreferences(preferences) {
  const groups = new Map()
  for (const preference of asArray(preferences)) {
    const key = groupKey(preference)
    if (!groups.has(key)) groups.set(key, { key, category: preference.category, minScore: preference.minScore, active: preference.active, userCheck: preference.userCheck, records: [], skills: [] })
    const group = groups.get(key)
    group.records.push(preference)
    if (preference.skillId && !group.skills.some((skill) => skill.id === preference.skillId)) group.skills.push({ id: preference.skillId, name: preference.skillName })
  }
  return [...groups.values()]
}

/** What saving a row writes: one record per skill (existing records reused, same skill first) and the leftovers to delete. */
export function planRowSave(row, enabled = true) {
  const wanted = row.skills.length ? row.skills : [{ id: '', name: '' }]
  const spare = [...row.records]
  const take = (skillId) => {
    const index = spare.findIndex((record) => record.skillId === skillId)
    return index >= 0 ? spare.splice(index, 1)[0] : null
  }
  const pairs = wanted.map((skill) => ({ skill, record: take(skill.id) }))
  for (const pair of pairs) if (!pair.record) pair.record = spare.shift() || null
  const fields = { category: row.category, minScore: row.minScore, active: row.active, userCheck: row.userCheck ?? enabled }
  return {
    saves: pairs.map(({ skill, record }) => ({ ...fields, id: record?.id, skillId: skill.id, skillName: skill.name })),
    deletes: spare.map((record) => record.id),
  }
}

/**
 * The user's feed preferences (saved in the CRM). Jobs matching any of a preference's skills in its Department, with
 * at least its AI score, come first in the feed (highest AI score first); all other jobs follow below.
 */
export default function JobPreferencesDialog({ user, enabled = true, allJobs = false, preferences = [], options = { category: [] }, onClose }) {
  const queryClient = useQueryClient()
  const [rows, setRows] = useState(() => groupPreferences(preferences))
  const [removed, setRemoved] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const labelOf = (list, value) => asArray(list).find((option) => option.value === value)?.label || ''

  const update = (key, change) => setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change, dirty: true } : row)))
  const add = () => setRows((current) => [...current, { key: `new-${Date.now()}`, category: asArray(options.category)[0]?.value || '', minScore: 60, active: true, userCheck: enabled, records: [], skills: [], dirty: true }])
  const remove = (row) => {
    setRows((current) => current.filter((item) => item.key !== row.key))
    setRemoved((current) => [...current, ...row.records.map((record) => record.id)])
  }

  // Saves a row as one record per skill (or one "any skill" record), reusing its existing records where it can.
  const saveRow = (row) => {
    const { saves, deletes } = planRowSave(row, enabled)
    const labels = { category: labelOf(options.category, row.category) }
    return [...saves.map((record) => api.saveMyPreference(user.email, record, labels)), ...deletes.map((id) => api.deleteMyPreference(id))]
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await Promise.all([
        ...removed.map((id) => api.deleteMyPreference(id)),
        ...rows.filter((row) => row.dirty || !row.records.length).flatMap(saveRow),
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

    <div className="mt-6 space-y-3 text-xs font-bold">
      {rows.map((row) => <div key={row.key} className={`rounded-2xl bg-[var(--paper)] p-3 ring-1 ring-[var(--line)] ${row.active ? '' : 'opacity-60'}`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0"><span className={fieldLabel}>Department</span>
            <span className="relative block">
              <select value={row.category} onChange={(event) => update(row.key, { category: event.target.value, skills: [] })} className={selectClass}>
                <option value="">Any department</option>
                {asArray(options.category).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <CaretDown size={12} weight="bold" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            </span>
          </label>
          <label className="min-w-0"><span className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Min AI score<b className="font-mono text-xs tracking-normal text-[var(--ink)]">{row.minScore}%</b></span>
            <input type="range" min="0" max="100" step="5" value={row.minScore} onChange={(event) => update(row.key, { minScore: Number(event.target.value) })} className="mt-2 w-full accent-[var(--lime-dark)]" />
          </label>
          <div className="sm:col-span-2"><SkillsPicker category={row.category} skills={row.skills} onChange={(skills) => update(row.key, { skills })} /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[var(--ink)]">
              <input type="checkbox" checked={row.active} onChange={(event) => update(row.key, { active: event.target.checked })} className="size-4 accent-[var(--lime-dark)]" />Active
            </label>
            <HotJobsCount user={user} row={row} allJobs={allJobs} />
          </div>
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

// Live count of the hot jobs this preference row brings to the top of the feed (the same gateway match as the feed:
// Department + any of its skills + AI score, New or Seen, any age), counted again once the row stops changing.
function HotJobsCount({ user, row, allJobs }) {
  const settled = useSettled(JSON.stringify([row.category, row.minScore, row.skills.map((skill) => skill.name)]))
  const { data, isFetching, isError } = useQuery({
    queryKey: ['preferred-jobs', 'count', allJobs ? 'all' : user?.email, settled],
    queryFn: () => {
      const [category, minScore, names] = JSON.parse(settled)
      const preferences = (names.length ? names : ['']).map((skillName) => ({ category, skillName, minScore, active: true }))
      return api.getPreferredJobs({ userEmail: user.email, preferences, allJobs })
    },
    enabled: Boolean(user?.email),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
  if (isError) return null
  const count = asArray(data).length
  return <span title="Jobs that match this preference: New or Seen, any age" className="inline-flex items-center gap-1 rounded-full bg-[#fff1e6] px-2.5 py-1 text-[11px] font-semibold text-[#c2410c] ring-1 ring-[#fed7aa] dark:bg-[#3b1d0e] dark:text-[#fdba74] dark:ring-[#7c2d12]">
    {isFetching ? <CircleNotch size={11} className="animate-spin" /> : <Fire size={11} weight="fill" className="text-[#f97316]" />}
    {data ? `${count}${count >= 100 ? '+' : ''} hot job${count === 1 ? '' : 's'}` : 'Counting hot jobs…'}
  </span>
}

// The value once it has stayed the same for a moment, so dragging the AI score does not send a request per step.
function useSettled(value, delay = 400) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}
