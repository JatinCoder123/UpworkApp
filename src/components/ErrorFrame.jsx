import { Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import { Mark } from './ui'
import { useAuth } from '../contexts/AuthContext'
import { homePath } from '../lib/permissions'

/**
 * The frame of a full-page error (404, 403, a page that failed to load): the brand and the theme toggle, without the
 * sidebar. An error page is not a place to work from, and the sidebar may be what failed; the page offers the way back.
 */
export default function ErrorFrame({ children }) {
  const { status, user } = useAuth()
  const signedIn = status === 'authenticated'
  return <div className="min-h-[100dvh] bg-[var(--paper)]">
    <header className="px-4 pt-4 sm:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between rounded-full bg-[var(--surface)]/90 px-4 py-2 ring-1 ring-[var(--line)]/70 shadow-xs backdrop-blur-xl">
        <Link to={signedIn ? homePath(user) : '/login'} className="flex items-center gap-2.5 pr-3 text-sm font-bold tracking-[-.02em] text-[var(--ink)]"><Mark /><span>Outright Feed Portal</span></Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!signedIn && <Link to="/login" className="rounded-full bg-[var(--ink)] px-4 py-1.5 text-xs font-semibold text-[var(--paper)] shadow-xs">Sign in</Link>}
        </div>
      </div>
    </header>
    {children}
  </div>
}
