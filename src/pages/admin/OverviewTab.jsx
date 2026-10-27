import { ArrowRight, Check, ShieldCheck, UserCircleDashed, UsersThree } from '@phosphor-icons/react'
import { Avatar, Panel, SectionTitle, usePermissionGroups, skeleton } from './adminParts'
import { asArray } from '../../lib/safe'

/** Everything at a glance: totals, people per role, which role gets which module, and who still needs a role. */
export default function OverviewTab({ catalog, onOpenUsers }) {
  const users = asArray(catalog.users.data)
  const roles = asArray(catalog.roles.data)
  const permissions = asArray(catalog.permissions.data)
  const permissionGroups = usePermissionGroups(permissions)
  const loading = catalog.users.isLoading || catalog.roles.isLoading || catalog.permissions.isLoading
  const admins = users.filter((user) => user.isAdmin)
  const withoutRole = users.filter((user) => !user.isAdmin && !user.role)
  const perRole = roles.map((role) => ({ role, count: users.filter((user) => user.role === role.name).length }))
  const maxPerRole = Math.max(1, ...perRole.map((item) => item.count))

  const stats = [
    { label: 'Users', value: users.length, icon: UsersThree, action: () => onOpenUsers('all') },
    { label: 'Admins', value: admins.length, icon: ShieldCheck, action: () => onOpenUsers('admins') },
    { label: 'Without a role', value: withoutRole.length, icon: UserCircleDashed, action: () => onOpenUsers('no-role'), warn: withoutRole.length > 0 },
    { label: 'Roles', value: roles.length },
    { label: 'Permissions', value: permissions.length },
  ]

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {stats.map(({ label, value, icon: Icon, action, warn }) => {
        const content = <>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]">{Icon && <Icon size={14} weight="bold" className={warn ? 'text-[var(--warn)]' : 'text-[var(--accent-strong)]'} />}{label}</span>
          <span className="mt-2 block text-3xl font-semibold tracking-[-.04em] text-[var(--text)]">{loading ? <span className={`${skeleton} h-8 w-12`} /> : value}</span>
          {action && <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--muted)]">View<ArrowRight size={10} weight="bold" /></span>}
        </>
        const style = `rounded-[1.4rem] bg-[var(--surface)] p-4 text-left ring-1 ${warn ? 'ring-[var(--warn)]/30' : 'ring-[var(--line)]/70'}`
        return action
          ? <button key={label} type="button" onClick={action} className={`${style} transition-colors hover:ring-[var(--lime-dark)]`}>{content}</button>
          : <div key={label} className={style}>{content}</div>
      })}
    </div>

    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel>
        <SectionTitle aside={<span className="text-[10px] text-[var(--muted)]">Role defaults; extras are per user</span>}>Who gets what</SectionTitle>
        {loading
          ? <span className={`${skeleton} mt-3 h-72`} />
          : <div className="mt-3 overflow-x-auto [scrollbar-width:thin]">
            <table className="w-full min-w-[34rem] border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 bg-[var(--surface)] py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Permission</th>
                  {roles.map((role) => <th key={role.id} scope="col" className="px-2 py-2 text-center text-[11px] font-semibold text-[var(--text)]">{role.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {permissionGroups.flatMap((group) => [
                  <tr key={group.title}><td colSpan={roles.length + 1} className="pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">{group.title}</td></tr>,
                  ...group.items.map((permission) => <tr key={permission.id} className="odd:bg-[var(--paper)]/60">
                    <th scope="row" className="sticky left-0 rounded-l-lg bg-inherit py-1.5 pl-2 pr-3 text-left font-semibold text-[var(--text)]">{permission.name}</th>
                    {roles.map((role) => {
                      const has = asArray(role.permissionIds).includes(permission.id)
                      return <td key={role.id} className="px-2 py-1.5 text-center last:rounded-r-lg">
                        {has ? <span className="inline-grid size-5 place-items-center rounded-md bg-(--lime) text-[#26320b]" aria-label="Yes"><Check size={11} weight="bold" /></span> : <span className="text-[var(--line)]" aria-label="No">·</span>}
                      </td>
                    })}
                  </tr>),
                ])}
              </tbody>
            </table>
          </div>}
      </Panel>

      <div className="space-y-4">
        <Panel>
          <SectionTitle>People per role</SectionTitle>
          <ul className="mt-3 space-y-2.5">
            {perRole.map(({ role, count }) => <li key={role.id}>
              <button type="button" onClick={() => onOpenUsers(`role:${role.name}`)} className="w-full text-left">
                <span className="flex items-center justify-between text-xs"><span className="font-semibold text-[var(--text)]">{role.name}</span><span className="font-mono text-[11px] text-[var(--muted)]">{count}</span></span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--frame)]"><span className="block h-full rounded-full bg-[var(--lime-dark)]" style={{ width: `${(count / maxPerRole) * 100}%` }} /></span>
              </button>
            </li>)}
          </ul>
        </Panel>
        <Panel>
          <SectionTitle aside={withoutRole.length > 0 && <button type="button" onClick={() => onOpenUsers('no-role')} className="text-[10px] font-bold text-[var(--accent-strong)]">Assign roles</button>}>Waiting for a role</SectionTitle>
          {withoutRole.length
            ? <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto [scrollbar-width:thin]">
              {withoutRole.map((user) => <li key={user.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                <Avatar name={user.name} />
                <span className="min-w-0"><span className="block truncate text-xs font-semibold text-[var(--text)]">{user.name}</span><span className="block truncate text-[11px] text-[var(--muted)]">{user.email || 'No email'}</span></span>
              </li>)}
            </ul>
            : <p className="mt-3 text-xs text-[var(--muted)]">{loading ? 'Loading…' : 'Everyone has a role.'}</p>}
        </Panel>
      </div>
    </div>
  </div>
}
