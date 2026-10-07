import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CaretDown, SignOut, SlidersHorizontal, User, UserCircle } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { Mark, iconButton } from './ui'
import ThemeToggle from './ThemeToggle'
import { userInitials } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'

export default function Shell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [profileOpen, setProfileOpen] = useState(false)
  const { user, logout: endAuthSession } = useAuth()
  const menuRef = useRef(null)
  useEffect(() => {
    const dismiss = (event) => !menuRef.current?.contains(event.target) && setProfileOpen(false)
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  const logout = async () => {
    try {
      await endAuthSession()
      queryClient.clear()
      navigate('/login', { replace: true })
    } catch (error) {
      window.alert(error.message)
    }
  }
  const active = (path) => location.pathname.startsWith(path)
  return <div className="min-h-[100dvh] bg-[var(--paper)]">
    <header className="sticky top-0 z-30 px-3 pt-3 md:px-6 md:pt-5">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between rounded-full bg-[var(--surface)]/90 px-3 py-2 ring-1 ring-black/5 shadow-[0_18px_60px_rgba(30,32,25,.08)] backdrop-blur-xl">
        <Link to="/jobs" className="flex items-center gap-2.5 rounded-full pr-3 text-sm font-bold tracking-[-.02em]"><Mark />UpWorkApp</Link>
        <nav className="hidden items-center gap-1 rounded-full bg-[var(--ink)]/[.045] p-1 md:flex">
          <Link to="/jobs" className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${active('/jobs') ? 'bg-white shadow-[0_4px_18px_rgba(0,0,0,.07)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>Opportunities</Link>
          <Link to="/activity" className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${active('/activity') ? 'bg-white shadow-[0_4px_18px_rgba(0,0,0,.07)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>Activity</Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-[var(--muted)] sm:flex"><span className="size-2 rounded-full bg-[var(--lime-dark)]" />API connected</span>
          <ThemeToggle />
          <div ref={menuRef} className="relative">
            <button aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)} className={`${iconButton} size-9`} aria-label="Open profile menu"><User size={17} weight="light" /></button>
            {profileOpen && <div className="absolute right-0 top-12 w-72 rounded-[1.5rem] bg-black/5 p-1.5 ring-1 ring-black/5 shadow-[0_24px_70px_rgba(30,32,25,.18)]"><div className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-3 px-2 py-3"><div className="grid size-11 place-items-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">{userInitials(user?.name)}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name}</p><p className="truncate text-[10px] text-[var(--muted)]">{user?.email}</p></div></div>
              <div className="my-2 h-px bg-black/[.07]" />
              <button onClick={() => { navigate('/profile'); setProfileOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition-colors duration-300 hover:bg-black/[.04]"><UserCircle size={18} weight="light" />View profile<CaretDown size={12} className="ml-auto -rotate-90" /></button>
              <button onClick={() => { navigate('/preferences'); setProfileOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition-colors duration-300 hover:bg-black/[.04]"><SlidersHorizontal size={18} weight="light" />Work preferences<CaretDown size={12} className="ml-auto -rotate-90" /></button>
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[var(--danger)] transition-colors duration-300 hover:bg-[#f5d6cf]/50"><SignOut size={18} weight="light" />Log out</button>
            </div></div>}
          </div>
        </div>
      </div>
    </header>
    {children}
  </div>
}
