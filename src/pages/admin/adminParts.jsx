import { useQuery } from '@tanstack/react-query'
import { ArrowClockwise, ShieldCheck, WarningCircle, X } from '@phosphor-icons/react'
import { adminApi } from '../../services/adminApi'
import { api } from '../../services/api'
import { PAGE_PERMISSIONS, permissionKey } from '../../lib/permissions'
import { asArray, asText } from '../../lib/safe'

// React Query keys for the admin panel, so every tab shares one copy of the data.
export const ADMIN_KEYS = {
  permissions: ['admin', 'permissions'],
  roles: ['admin', 'roles'],
  users: ['admin', 'users'],
  access: (userId) => ['admin', 'access', userId],
  allAccess: ['admin', 'access'],
}

/** Permissions, roles and users, loaded once for the whole panel. */
export function useAdminCatalog() {
  const permissions = useQuery({ queryKey: ADMIN_KEYS.permissions, queryFn: async () => asArray((await adminApi.getPermissions()).permissions), staleTime: 5 * 60_000 })
  const roles = useQuery({ queryKey: ADMIN_KEYS.roles, queryFn: async () => asArray((await adminApi.getRoles()).roles), staleTime: 60_000 })
  const users = useQuery({ queryKey: ADMIN_KEYS.users, queryFn: async () => asArray((await adminApi.getUsers('')).users), staleTime: 60_000 })
  return { permissions, roles, users }
}

const SECTION_NAMES = new Set(Object.values(PAGE_PERMISSIONS).map(permissionKey))

/**
 * Section permissions open a page in the portal: the built-in pages and the feeds made with "+ New feed" (the build
 * saves the feed's module name in the permission's description), listed together; the rest (Reports, User
 * Management, ...) have no page yet.
 */
export function groupPermissions(permissions, feedModules = []) {
  const list = asArray(permissions)
  const modules = new Set(asArray(feedModules).map(permissionKey))
  const isSection = (permission) => SECTION_NAMES.has(permissionKey(permission.name)) || modules.has(permissionKey(permission.description))
  return [
    { title: 'Sections', note: 'Each opens a page in the portal.', items: list.filter(isSection) },
    { title: 'Other access', note: 'No page in the portal uses these yet.', items: list.filter((permission) => !isSection(permission)) },
  ].filter((group) => group.items.length)
}

/** groupPermissions with the feeds read from the CRM (the same list, and cache, as the nav). */
export function usePermissionGroups(permissions) {
  const feeds = useQuery({ queryKey: ['feeds'], queryFn: () => api.getAutoFeeds(), staleTime: 60_000 })
  return groupPermissions(permissions, asArray(feeds.data).map((feed) => feed.moduleName))
}

export const initialsOf = (name) => asText(name).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '?'

export function Avatar({ name, large = false }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-[var(--ink)] font-bold text-white dark:bg-[var(--raised)] dark:text-[var(--text)] dark:ring-1 dark:ring-[var(--line)] ${large ? 'size-12 text-sm' : 'size-9 text-[11px]'}`}>{initialsOf(name)}</span>
}

export function RoleBadge({ role }) {
  return role
    ? <span className="inline-flex max-w-[9rem] shrink-0 items-center truncate rounded-full bg-(--lime-tint)/30 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--lime-dark)]/25">{role}</span>
    : <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--frame)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">No role</span>
}

export function AdminBadge() {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[10px] font-bold text-white dark:bg-(--lime) dark:text-[var(--on-lime)]"><ShieldCheck size={11} weight="fill" />Admin</span>
}

/** On/off switch. `pending` shows a spinner in the knob while the change is being saved. */
export function Switch({ checked, onClick, disabled = false, pending = false, label }) {
  return <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled || pending}
    onClick={onClick}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full ring-1 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-55 ${checked ? 'bg-(--lime) ring-[var(--lime-dark)]/40' : 'bg-[var(--frame)] ring-[var(--line)]'}`}
  >
    <span className={`grid size-5 place-items-center rounded-full bg-white shadow-sm transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`}>
      {pending && <span className="size-3 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" />}
    </span>
  </button>
}

/** The project's double-bezel card. */
export function Panel({ children, className = '' }) {
  return <section className={`rounded-[1.8rem] bg-black/[.035] p-1.5 ring-1 ring-black/5 dark:bg-white/[.03] dark:ring-white/5 ${className}`}>
    <div className="h-full rounded-[calc(1.8rem-.375rem)] bg-[var(--surface)] p-4 sm:p-5">{children}</div>
  </section>
}

export function ErrorNote({ error, onRetry, onDismiss }) {
  if (!error) return null
  return <p role="alert" className="flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">
    <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />
    <span className="min-w-0 flex-1">{error.message || 'Something went wrong. Please try again.'}</span>
    {onRetry && <button type="button" onClick={onRetry} className="inline-flex shrink-0 items-center gap-1 underline underline-offset-4"><ArrowClockwise size={12} weight="bold" />Retry</button>}
    {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss" className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-black/10"><X size={11} weight="bold" /></button>}
  </p>
}

export function SectionTitle({ children, aside }) {
  return <div className="flex items-center justify-between gap-3">
    <h3 className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">{children}</h3>
    {aside}
  </div>
}

export const skeleton = 'skeleton-bone block rounded-xl'
