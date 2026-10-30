import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowCounterClockwise, Check, FloppyDisk } from '@phosphor-icons/react'
import { primaryButton } from '../../components/ui'
import { useAuth } from '../../contexts/AuthContext'
import { adminApi } from '../../services/adminApi'
import { ADMIN_KEYS, ErrorNote, Panel, SectionTitle, usePermissionGroups, skeleton } from './adminParts'
import { asArray } from '../../lib/safe'

/** Left: the roles. Right: the selected role's default permissions, which every user with that role gets. */
export default function RolesTab({ catalog }) {
  const roles = asArray(catalog.roles.data)
  const users = asArray(catalog.users.data)
  const [selectedId, setSelectedId] = useState(null)
  const selected = roles.find((role) => role.id === selectedId) || roles[0] || null
  const usersWith = (role) => users.filter((user) => user.role === role.name).length

  return <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
    <Panel>
      <SectionTitle>Roles</SectionTitle>
      <ul className="mt-3 space-y-1">
        {catalog.roles.isLoading
          ? [0, 1, 2, 3].map((item) => <li key={item}><span className={`${skeleton} h-12`} /></li>)
          : roles.map((role) => {
            const active = selected?.id === role.id
            return <li key={role.id}>
              <button type="button" aria-current={active} onClick={() => setSelectedId(role.id)} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-(--lime-tint)/20 ring-1 ring-[var(--lime-dark)]/30' : 'hover:bg-[var(--paper)]'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text)]">{role.name}</span>
                  <span className="block text-[11px] text-[var(--muted)]">{asArray(role.permissionIds).length} permissions · {usersWith(role)} {usersWith(role) === 1 ? 'user' : 'users'}</span>
                </span>
              </button>
            </li>
          })}
      </ul>
    </Panel>
    {selected
      ? <RoleEditor key={selected.id} role={selected} permissions={asArray(catalog.permissions.data)} userCount={usersWith(selected)} />
      : <Panel><p className="py-16 text-center text-sm text-[var(--muted)]">{catalog.roles.isLoading ? 'Loading roles…' : 'No roles yet.'}</p></Panel>}
  </div>
}

function RoleEditor({ role, permissions, userCount }) {
  const queryClient = useQueryClient()
  const permissionGroups = usePermissionGroups(permissions)
  const { user: me, syncAccess } = useAuth()
  const saved = asArray(role.permissionIds)
  const [draft, setDraft] = useState(() => new Set(saved))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const changes = [...draft].filter((id) => !saved.includes(id)).length + saved.filter((id) => !draft.has(id)).length

  const toggle = (id) => {
    setDone(false)
    setDraft((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const { role: next } = await adminApi.setRolePermissions(role.id, [...draft])
      queryClient.setQueryData(ADMIN_KEYS.roles, (current) => asArray(current).map((item) => (item.id === next.id ? next : item)))
      // Users with this role now get different defaults.
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.allAccess })
      if (me?.role === role.name) syncAccess({ force: true })
      setDraft(new Set(asArray(next.permissionIds)))
      setDone(true)
    } catch (saveError) {
      setError(saveError)
    } finally {
      setSaving(false)
    }
  }

  return <Panel>
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)]/70 pb-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Role defaults</p>
        <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-[var(--text)]">{role.name}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">Every user with this role gets these permissions{userCount ? ` (${userCount} ${userCount === 1 ? 'user' : 'users'})` : ''}.</p>
      </div>
      <div className="flex items-center gap-2">
        {changes > 0 && <button type="button" onClick={() => { setDraft(new Set(saved)); setError(null) }} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"><ArrowCounterClockwise size={13} />Reset</button>}
        <button type="button" onClick={save} disabled={!changes || saving} className={primaryButton}>
          <span>{saving ? 'Saving…' : changes ? `Save ${changes} ${changes === 1 ? 'change' : 'changes'}` : done ? 'Saved' : 'No changes'}</span>
          <span className="grid size-7 place-items-center rounded-full bg-white/15">{saving ? <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : done && !changes ? <Check size={13} weight="bold" /> : <FloppyDisk size={13} />}</span>
        </button>
      </div>
    </div>
    <div className="mt-4"><ErrorNote error={error} onDismiss={() => setError(null)} /></div>
    <div className="mt-2 space-y-4">
      {permissionGroups.map((group) => <div key={group.title}>
        <SectionTitle aside={<span className="text-[10px] text-[var(--muted)]">{group.note}</span>}>{group.title}</SectionTitle>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {group.items.map((permission) => {
            const checked = draft.has(permission.id)
            const changed = checked !== saved.includes(permission.id)
            return <li key={permission.id}>
              <button type="button" role="checkbox" aria-checked={checked} disabled={saving} onClick={() => toggle(permission.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors hover:ring-[var(--lime-dark)]/60 disabled:opacity-60 ${checked ? 'bg-(--lime-tint)/15 ring-[var(--lime-dark)]/25' : 'bg-[var(--surface)] ring-[var(--line)]'}`}>
                <span className={`grid size-5 shrink-0 place-items-center rounded-md ring-1 ${checked ? 'bg-(--lime) text-[var(--on-lime)] ring-[var(--lime-dark)]/40' : 'bg-[var(--paper)] ring-[var(--line)]'}`}>{checked && <Check size={12} weight="bold" />}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text)]">{permission.name}</span>
                {changed && <span className="shrink-0 rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--warn)]">{checked ? 'adding' : 'removing'}</span>}
              </button>
            </li>
          })}
        </ul>
      </div>)}
    </div>
  </Panel>
}
