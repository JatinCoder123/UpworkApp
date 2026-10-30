import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, EnvelopeSimple, IdentificationBadge, Rows, ShieldCheck, SignOut, SquaresFour } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import { primaryButton } from '../components/ui'
import { userInitials } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'
import { canSeeFeed, feedPath, useFeeds } from '../lib/feeds'
import { PAGE_PERMISSIONS, canAccess, isAdminUser, roleOf } from '../lib/permissions'
import { asArray } from '../lib/safe'
import { notify } from '../lib/notify'

/*
 * The signed-in user's page: who they are (name, email, role, admin), the sections and feeds they can open (each a
 * link), and Log out. Everything comes from the session and the access the CRM gave; nothing is made up.
 */
const card = 'rounded-[1.8rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70'
const inner = 'h-full rounded-[calc(1.8rem-.375rem)] bg-[var(--surface)] p-6 sm:p-8'
const eyebrow = 'text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]'
const chip = 'inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]'

export default function Profile() {
  const navigate = useNavigate(), queryClient = useQueryClient()
  const { user, logout: endAuthSession } = useAuth()
  const feeds = useFeeds(user)
  const admin = isAdminUser(user)
  const role = roleOf(user)
  const sections = Object.entries(PAGE_PERMISSIONS).filter(([path]) => canAccess(user, path))
  const openFeeds = asArray(feeds.data).filter((feed) => canSeeFeed(user, feed))
  const logout = async () => {
    try {
      await endAuthSession()
      queryClient.clear()
      navigate('/login', { replace: true })
    } catch (error) {
      notify({ title: 'Could not sign out', message: error.message })
    }
  }
  const facts = [
    [EnvelopeSimple, 'Email', user?.email || '—'],
    [IdentificationBadge, 'Role', role || (admin ? 'Admin' : 'No role yet')],
    [ShieldCheck, 'Administrator', admin ? 'Yes: every section and the admin panel' : 'No'],
  ]

  return <Shell><main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-14 sm:px-6 md:pt-20">
    <div className="rounded-[2.3rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
      <section className="relative overflow-hidden rounded-[calc(2.3rem-.375rem)] bg-[var(--surface)] p-6 sm:p-10">
        <div className="absolute right-0 top-0 h-56 w-72 bg-[var(--lime-tint)]/20 blur-[90px]" />
        <div className="relative flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <div>
            <div className="grid size-24 place-items-center rounded-[2rem] bg-[var(--ink)] text-2xl font-bold text-white shadow-[0_20px_50px_rgb(var(--shadow-rgb)/.2)]">{userInitials(user?.name)}</div>
            <p className={`mt-7 ${eyebrow}`}>{admin ? `Administrator${role ? ` · ${role}` : ''}` : role || 'No role yet'}</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-.065em] sm:text-7xl">{user?.name || 'Your profile'}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">{user?.email}</p>
          </div>
          <button onClick={logout} className={`${primaryButton} self-start bg-[var(--bad-bg)] text-[var(--danger)] md:self-auto`}><span>Log out</span><span className="grid size-8 place-items-center rounded-full bg-white/45"><SignOut size={15} /></span></button>
        </div>
      </section>
    </div>

    <section className="mt-5 grid gap-5 md:grid-cols-[.8fr_1fr]">
      <div className={card}><div className={inner}>
        <p className={eyebrow}>Account</p>
        <div className="mt-7 space-y-5">
          {facts.map(([Icon, label, value]) => <div key={label} className="flex items-center gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--paper)]"><Icon size={17} /></span>
            <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.13em] text-[var(--muted)]">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></div>
          </div>)}
        </div>
        {admin && <Link to="/admin/permissions" className="mt-7 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)] hover:underline">Open the admin panel<ArrowRight size={13} weight="bold" /></Link>}
      </div></div>

      <div className={card}><div className={inner}>
        <div className="flex items-center justify-between gap-3">
          <p className={eyebrow}>What you can open</p>
          <span className="font-mono text-xs font-semibold text-[var(--muted)]">{sections.length + openFeeds.length}</span>
        </div>
        <p className="mt-5 flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]"><SquaresFour size={13} weight="bold" />Sections</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {sections.length
            ? sections.map(([path, label]) => <Link key={path} to={path} className={chip}>{label}</Link>)
            : <span className="text-sm text-[var(--muted)]">No sections yet. Ask an admin to give you access.</span>}
        </div>
        <p className="mt-6 flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)]"><Rows size={13} weight="bold" />Feeds</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {feeds.isLoading
            ? <span className="text-sm text-[var(--muted)]">Loading…</span>
            : feeds.isError && !openFeeds.length
              ? <p role="alert" className="text-sm text-[var(--bad)]">Your feeds could not be loaded: {feeds.error?.message} <button type="button" onClick={() => feeds.refetch()} className="font-semibold underline underline-offset-4">Try again</button></p>
            : openFeeds.length
              ? openFeeds.map((feed) => <Link key={feed.id} to={feedPath(feed)} className={chip}>{feed.name}</Link>)
              : <span className="text-sm text-[var(--muted)]">No feeds yet.</span>}
        </div>
      </div></div>
    </section>
  </main></Shell>
}
