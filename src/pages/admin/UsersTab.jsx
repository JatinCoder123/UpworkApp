import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleNotch, FloppyDisk, LockSimple, MagnifyingGlass, Minus, Plus, ShieldCheck } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from '../../components/ui'
import ErrorBoundary, { SectionError } from '../../components/ErrorBoundary'
import { useAuth } from '../../contexts/AuthContext'
import { adminApi } from '../../services/adminApi'
import { api } from '../../services/api'
import SkillsPicker from '../../components/SkillsPicker'
import { ADMIN_KEYS, AdminBadge, Avatar, ErrorNote, Panel, RoleBadge, SectionTitle, Switch, usePermissionGroups, skeleton } from './adminParts'
import { asArray, asText } from '../../lib/safe'

const FILTERS = [
  ['all', 'All'],
  ['admins', 'Admins'],
  ['no-role', 'No role'],
]

function matchesFilter(user, filter) {
  if (filter === 'admins') return user.isAdmin
  if (filter === 'no-role') return !user.isAdmin && !user.role
  if (filter.startsWith('role:')) return user.role === filter.slice(5)
  return true
}

/** Left: searchable, filterable user list. Right: the selected user's role, admin switch, skills and permissions. */
export default function UsersTab({ catalog, filter, onFilterChange }) {
  const { user: me } = useAuth()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const users = asArray(catalog.users.data)
  const roles = asArray(catalog.roles.data)
  const counts = useMemo(() => ({
    all: users.length,
    admins: users.filter((user) => user.isAdmin).length,
    'no-role': users.filter((user) => !user.isAdmin && !user.role).length,
  }), [users])
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return users.filter((user) => matchesFilter(user, filter) && (!term || `${user.name} ${user.email}`.toLowerCase().includes(term)))
  }, [users, filter, search])
  const selected = users.find((user) => user.id === selectedId) || visible[0] || null
  const chip = (active) => `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition-colors ${active ? 'bg-[var(--ink)] text-white ring-[var(--ink)] dark:bg-(--lime) dark:text-[#26320b] dark:ring-[var(--lime)]' : 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--text)]'}`

  return <div className="grid items-start gap-4 lg:grid-cols-[21rem_minmax(0,1fr)]">
    <Panel>
      <label className="flex items-center gap-2 rounded-full bg-[var(--paper)] px-4 py-2.5 ring-1 ring-[var(--line)] focus-within:ring-[var(--lime-dark)]">
        <MagnifyingGlass size={14} className="text-[var(--muted)]" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" aria-label="Search users" className="min-w-0 flex-1 bg-transparent text-xs text-[var(--text)] outline-none" />
      </label>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {FILTERS.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => onFilterChange(id)} className={chip(filter === id)}>{label}<span className="font-mono text-[10px] opacity-70">{counts[id]}</span></button>)}
        {roles.map((role) => {
          const id = `role:${role.name}`
          return <button key={role.id} type="button" aria-pressed={filter === id} onClick={() => onFilterChange(id)} className={chip(filter === id)}>{role.name}<span className="font-mono text-[10px] opacity-70">{users.filter((user) => user.role === role.name).length}</span></button>
        })}
      </div>
      <ul className="mt-3 max-h-[34rem] space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]" aria-label="Users">
        {catalog.users.isLoading
          ? [0, 1, 2, 3, 4].map((item) => <li key={item}><span className={`${skeleton} h-14`} /></li>)
          : visible.length
            ? visible.map((user) => {
              const active = selected?.id === user.id
              return <li key={user.id}>
                <button type="button" aria-current={active} onClick={() => setSelectedId(user.id)} className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors ${active ? 'bg-(--lime)/20 ring-1 ring-[var(--lime-dark)]/30' : 'hover:bg-[var(--paper)]'}`}>
                  <Avatar name={user.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5"><span className="truncate text-xs font-semibold text-[var(--text)]">{user.name}</span>{user.id === me?.crmUserId && <span className="shrink-0 text-[10px] font-semibold text-[var(--muted)]">(you)</span>}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{user.email || 'No email'}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">{user.isAdmin && <AdminBadge />}<RoleBadge role={user.role} /></span>
                </button>
              </li>
            })
            : <li className="px-3 py-8 text-center text-xs text-[var(--muted)]">No users match.</li>}
      </ul>
    </Panel>

    {selected
      // One user's panel failing to render does not take the user list down with it.
      ? <ErrorBoundary name="admin-user-access" resetKey={selected.id} fallback={SectionError} fallbackProps={{ title: 'This user’s access could not load' }}>
        <UserAccess key={selected.id} summary={selected} roles={roles} permissions={asArray(catalog.permissions.data)} isSelf={selected.id === me?.crmUserId} />
      </ErrorBoundary>
      : <Panel><p className="py-16 text-center text-sm text-[var(--muted)]">{catalog.users.isLoading ? 'Loading users…' : 'Select a user to see their access.'}</p></Panel>}
  </div>
}

function UserAccess({ summary, roles, permissions, isSelf }) {
  const queryClient = useQueryClient()
  const permissionGroups = usePermissionGroups(permissions)
  const { syncAccess } = useAuth()
  const accessQuery = useQuery({ queryKey: ADMIN_KEYS.access(summary.id), queryFn: async () => (await adminApi.getUserAccess(summary.id)).access })
  const access = accessQuery.data
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [confirmAdmin, setConfirmAdmin] = useState(null)
  const roleName = access?.role?.name || ''

  // Every change waits for the server and redraws from the access it returns; nothing changes on screen before that.
  const run = async (key, call) => {
    setPending(key)
    setError(null)
    try {
      const { access: next } = await call()
      queryClient.setQueryData(ADMIN_KEYS.access(summary.id), next)
      queryClient.invalidateQueries({ queryKey: ADMIN_KEYS.users })
      if (isSelf) syncAccess({ force: true })
      return true
    } catch (changeError) {
      setError(changeError)
      return false
    } finally {
      setPending(null)
    }
  }

  const togglePermission = (permission, state) => {
    if (state === 'extra') run(permission.id, () => adminApi.removeUserPermission(summary.id, permission.id))
    else if (state === 'none') run(permission.id, () => adminApi.addUserPermission(summary.id, permission.id))
  }

  const stateOf = (permission) => {
    if (access?.isAdmin) return 'admin'
    if (asArray(access?.fromRole).includes(permission.id)) return 'role'
    if (asArray(access?.extra).includes(permission.id)) return 'extra'
    return 'none'
  }
  const effectiveCount = asArray(access?.effective).length

  return <Panel>
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)]/70 pb-4">
      <Avatar name={summary.name} large />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-base font-semibold text-[var(--text)]">{summary.name}{isSelf && <span className="text-xs font-medium text-[var(--muted)]">(you)</span>}</p>
        <p className="truncate text-xs text-[var(--muted)]">{summary.email || 'No email'}</p>
      </div>
      <div className="flex items-center gap-1.5">{access?.isAdmin && <AdminBadge />}<RoleBadge role={access ? roleName || null : summary.role} /></div>
    </div>

    <div className="mt-4 space-y-3">
      <ErrorNote error={accessQuery.error} onRetry={() => accessQuery.refetch()} />
      <ErrorNote error={error} onDismiss={() => setError(null)} />
    </div>

    {accessQuery.isLoading
      ? <div className="mt-4 space-y-3"><span className={`${skeleton} h-16`} /><span className={`${skeleton} h-16`} /><span className={`${skeleton} h-64`} /></div>
      : access && <>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[var(--paper)] p-4 ring-1 ring-[var(--line)]/70">
            <SectionTitle aside={pending === 'role' && <span className="size-3.5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />}>Role</SectionTitle>
            <select
              value={access.role?.id || ''}
              disabled={Boolean(pending)}
              onChange={(event) => run('role', () => adminApi.setUserRole(summary.id, event.target.value || null))}
              aria-label={`Role for ${summary.name}`}
              className="mt-2 h-11 w-full rounded-xl bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--text)] outline-none ring-1 ring-[var(--line)] focus:ring-2 focus:ring-[var(--lime-dark)] disabled:opacity-60"
            >
              <option value="">No role</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <p className="mt-2 text-[11px] leading-4 text-[var(--muted)]">The role brings its default permissions.</p>
          </div>
          <div className="rounded-2xl bg-[var(--paper)] p-4 ring-1 ring-[var(--line)]/70">
            <SectionTitle>Administrator</SectionTitle>
            <div className="mt-2 flex items-center gap-3">
              <p className="min-w-0 flex-1 text-[11px] leading-4 text-[var(--muted)]">{isSelf ? 'You can’t remove your own admin access.' : 'Every module, this admin panel and full CRM admin rights.'}</p>
              <Switch checked={access.isAdmin} disabled={isSelf || Boolean(pending)} pending={pending === 'admin'} onClick={() => setConfirmAdmin(!access.isAdmin)} label={`Administrator: ${summary.name}`} />
            </div>
          </div>
        </div>

        <UserSkills userId={summary.id} name={summary.name} isSelf={isSelf} />

        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Permissions</h3>
          <span className="text-[11px] font-semibold text-[var(--muted)]">{access.isAdmin ? 'Admins have every permission' : `${effectiveCount} of ${permissions.length} granted`}</span>
        </div>
        <div className="mt-3 space-y-4">
          {permissionGroups.map((group) => <div key={group.title}>
            <SectionTitle aside={<span className="text-[10px] text-[var(--muted)]">{group.note}</span>}>{group.title}</SectionTitle>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {group.items.map((permission) => <PermissionRow key={permission.id} permission={permission} state={stateOf(permission)} roleName={roleName} pending={pending === permission.id} disabled={Boolean(pending)} onToggle={togglePermission} />)}
            </ul>
          </div>)}
        </div>
      </>}

    {confirmAdmin !== null && <Modal onClose={() => setConfirmAdmin(null)}>
      <DialogHeader eyebrow="Administrator" title={confirmAdmin ? `Make ${summary.name} an admin?` : `Remove admin from ${summary.name}?`} onClose={() => setConfirmAdmin(null)} />
      <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{confirmAdmin
        ? 'They will be able to open every module and this admin panel. This also gives them full admin rights in the CRM.'
        : 'They will keep only the permissions from their role and any extra permissions. Their CRM admin rights are removed too.'}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => setConfirmAdmin(null)} className="rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)]">Cancel</button>
        <button type="button" onClick={async () => { const target = confirmAdmin; setConfirmAdmin(null); await run('admin', () => adminApi.setUserAdmin(summary.id, target)) }} className={primaryButton}>
          <span>{confirmAdmin ? 'Make admin' : 'Remove admin'}</span>
          <span className="grid size-7 place-items-center rounded-full bg-white/15"><ShieldCheck size={13} /></span>
        </button>
      </div>
    </Modal>}
  </Panel>
}

// The user's skills (CRM: Users <-> Skills): the admin adds, removes or creates them (a skill typed in that the Skills
// module does not have is created), then saves. A user left with no skills picks theirs at their next login. The
// user's Jobs page shows the jobs for these skills.
function UserSkills({ userId, name, isSelf }) {
  const queryClient = useQueryClient()
  const { user: me, skillsSaved } = useAuth()
  const skillsQuery = useQuery({ queryKey: ['user-skills', userId], queryFn: () => api.getUserSkills(userId) })
  const saved = asArray(skillsQuery.data)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const skills = draft ?? saved
  const changed = draft !== null && (draft.length !== saved.length || draft.some((skill) => !saved.some((item) => item.id === skill.id)))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const next = await api.saveUserSkills(userId, skills)
      queryClient.setQueryData(['user-skills', userId], next)
      setDraft(null)
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'skills' || query.queryKey[0] === 'my-skill-jobs' })
      // The admin's own skills: their Jobs page follows at once.
      if (isSelf) {
        queryClient.setQueryData(['my-skills', me?.email], next)
        if (next.length) skillsSaved()
      }
    } catch (saveError) {
      setError(saveError)
    } finally {
      setSaving(false)
    }
  }

  return <div className="mt-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Skills</h3>
      <span className="text-[11px] font-semibold text-[var(--muted)]">{skillsQuery.isLoading ? '…' : saved.length ? `${saved.length} skill${saved.length === 1 ? '' : 's'}` : 'None yet: picked at their next login'}</span>
    </div>
    <div className="mt-3 rounded-2xl bg-[var(--paper)] p-4 ring-1 ring-[var(--line)]/70">
      {skillsQuery.isLoading
        ? <span className={`${skeleton} h-10`} />
        : skillsQuery.isError
          ? <ErrorNote error={skillsQuery.error} onRetry={() => skillsQuery.refetch()} />
          : <SkillsPicker skills={skills} onChange={(next) => { setDraft(next); setError(null) }} allowNew label={`${name}'s skills`} noneLabel="(none)" noneHint="No skills: they pick theirs at their next login" />}
      {error && <div className="mt-3"><ErrorNote error={error} onDismiss={() => setError(null)} /></div>}
      {changed && <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={() => setDraft(null)} disabled={saving} className="rounded-full px-4 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
        <span className="text-xs font-bold"><button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text)] px-4 py-2 text-[var(--paper)] transition-transform hover:-translate-y-0.5 disabled:opacity-60">
          {saving ? <CircleNotch size={13} className="animate-spin" /> : <FloppyDisk size={13} weight="bold" />}{saving ? 'Saving…' : 'Save skills'}
        </button></span>
      </div>}
    </div>
  </div>
}

// One permission: from the role (locked), extra (removable), not granted (addable), or admin (all locked).
function PermissionRow({ permission, state, roleName, pending, disabled, onToggle }) {
  const checked = state !== 'none'
  const locked = state === 'role' || state === 'admin'
  const tag = state === 'role' ? `from ${roleName}` : state === 'extra' ? 'extra' : state === 'admin' ? 'admin' : ''
  const title = state === 'role' ? 'Comes with the role. Change the role instead.' : state === 'admin' ? 'Admins have every permission.' : state === 'extra' ? 'Extra permission. Click to remove.' : 'Click to give this permission.'
  return <li>
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={locked || disabled}
      disabled={locked || disabled}
      title={title}
      onClick={() => onToggle(permission, state)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ${checked ? 'bg-(--lime)/15 ring-[var(--lime-dark)]/25' : 'bg-[var(--surface)] ring-[var(--line)]'} ${locked ? 'cursor-default' : 'hover:ring-[var(--lime-dark)]/60'} disabled:cursor-default ${disabled && !locked ? 'opacity-60' : ''}`}
    >
      <span className={`grid size-5 shrink-0 place-items-center rounded-md ring-1 ${checked ? 'bg-(--lime) text-[#26320b] ring-[var(--lime-dark)]/40' : 'bg-[var(--paper)] ring-[var(--line)]'}`}>
        {pending ? <span className="size-3 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" /> : checked ? (locked ? <LockSimple size={11} weight="bold" /> : <Check size={12} weight="bold" />) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-[var(--text)]">{permission.name}</span>
        {permission.description && <span className="block truncate text-[10.5px] text-[var(--muted)]">{asText(permission.description)}</span>}
      </span>
      {tag && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${state === 'extra' ? 'bg-[var(--ink)] text-white dark:bg-(--lime) dark:text-[#26320b]' : 'bg-[var(--frame)] text-[var(--muted)]'}`}>{tag}</span>}
      {!locked && !pending && <span className="shrink-0 text-[var(--muted)]">{state === 'extra' ? <Minus size={13} weight="bold" /> : <Plus size={13} weight="bold" />}</span>}
    </button>
  </li>
}
