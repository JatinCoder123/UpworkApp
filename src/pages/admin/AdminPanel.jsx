import { useSearchParams } from 'react-router-dom'
import { ChartPieSlice, ChatCircleText, IdentificationBadge, ShieldCheck, UsersThree } from '@phosphor-icons/react'
import Shell from '../../components/Shell'
import ErrorBoundary, { SectionError } from '../../components/ErrorBoundary'
import { ErrorNote, useAdminCatalog } from './adminParts'
import UsersTab from './UsersTab'
import RolesTab from './RolesTab'
import OverviewTab from './OverviewTab'
import FeedbackTab from './FeedbackTab'

const TABS = [
  ['users', 'Users', UsersThree],
  ['roles', 'Roles', IdentificationBadge],
  ['overview', 'Overview', ChartPieSlice],
  ['feedback', 'Feedback', ChatCircleText],
]

/**
 * Admin panel (admins only; the route shows 403 to everyone else): manage each user's role, admin access
 * and extra permissions, edit role defaults, and see the whole picture. The tab and user filter live in the URL.
 */
export default function AdminPanel() {
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'users'
  const filter = params.get('filter') || 'all'
  const catalog = useAdminCatalog()
  const loadError = catalog.permissions.error || catalog.roles.error || catalog.users.error

  const openTab = (id, extra = {}) => setParams({ tab: id, ...extra }, { replace: false })
  const retry = () => { catalog.permissions.refetch(); catalog.roles.refetch(); catalog.users.refetch() }
  const tabClass = (active) => `inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${active ? 'bg-[var(--ink)] text-white dark:bg-(--lime) dark:text-[var(--on-lime)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-4 sm:px-6 md:pt-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]"><ShieldCheck size={13} weight="fill" className="text-[var(--accent-strong)]" />Admin</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] text-[var(--text)] sm:text-4xl">Access &amp; permissions</h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">Decide who can open each module. Changes reach people within about a minute.</p>
        </div>
        <nav aria-label="Admin sections" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-[var(--surface)] p-1 ring-1 ring-[var(--line)]/70 [scrollbar-width:none]">
          {TABS.map(([id, label, Icon]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => openTab(id)} className={`${tabClass(tab === id)} shrink-0 whitespace-nowrap`}><Icon size={14} weight="bold" />{label}</button>)}
        </nav>
      </header>

      {loadError && <div className="mt-5"><ErrorNote error={loadError} onRetry={retry} /></div>}

      <div className="mt-6">
        {/* A tab that fails to render shows an error card here; the header and the other tabs keep working. */}
        <ErrorBoundary name={`admin-${tab}`} resetKey={tab} fallback={SectionError} fallbackProps={{ title: 'This part of the admin panel could not load' }}>
          {tab === 'users' && <UsersTab catalog={catalog} filter={filter} onFilterChange={(next) => openTab('users', next === 'all' ? {} : { filter: next })} />}
          {tab === 'roles' && <RolesTab catalog={catalog} />}
          {tab === 'feedback' && <FeedbackTab />}
          {tab === 'overview' && <OverviewTab catalog={catalog} onOpenUsers={(next) => openTab('users', next === 'all' ? {} : { filter: next })} />}
        </ErrorBoundary>
      </div>

    </main>
  </Shell>
}
