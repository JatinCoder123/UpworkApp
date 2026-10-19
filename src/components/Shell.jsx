import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CaretDown, ChartLineUp, Clock, List, SignOut, SlidersHorizontal, User, UserCircle, X } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import gsap from 'gsap'
import { Mark, iconButton } from './ui'
import ThemeToggle from './ThemeToggle'
import DocNotificationBell from './DocNotificationBell'
import GridPattern from './GridPattern'
import { userInitials } from '../lib/auth'
import { useAuth } from '../contexts/AuthContext'
import { canAccess, homePath, isAdminUser, rolesOf } from '../lib/roles'

const navigationItems = [
  ['/jobs', 'Jobs'],
  ['/tech-news', 'AI News'],
  ['/site-content', 'Site Content'],
  ['/domain', 'Domain'],
  ['/video', 'Video'],
  ['/seo', 'SEO'],
  ['/appscript', 'AppScript'],
  ['/llm', 'LLM'],
  ['/wordpress', 'Wordpress'],
  ['/cloud', 'Cloud'],
  ['/social', 'Social'],
  ['/email-to-blog', 'Email to Blog'],
  ['/api-playground', 'API Playground'],
]

export default function Shell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout: endAuthSession } = useAuth()
  const menuRef = useRef(null)
  const mobileMenuRef = useRef(null)
  const mobileBackdropRef = useRef(null)
  const mobilePanelRef = useRef(null)
  const mobileTimelineRef = useRef(null)
  const mobileNavigatingRef = useRef(false)
  useEffect(() => {
    const dismiss = (event) => !menuRef.current?.contains(event.target) && setProfileOpen(false)
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const items = mobileMenuRef.current.querySelectorAll('[data-mobile-nav]')
      gsap.set(mobileMenuRef.current, { autoAlpha: 0 })
      gsap.set(mobileBackdropRef.current, { autoAlpha: 0 })
      gsap.set(mobilePanelRef.current, { xPercent: 105 })
      gsap.set(items, { x: 34, autoAlpha: 0 })
      mobileTimelineRef.current = gsap.timeline({ paused: true })
        .set(mobileMenuRef.current, { autoAlpha: 1 })
        .to(mobileBackdropRef.current, { autoAlpha: 1, duration: reduceMotion ? .01 : .3, ease: 'power2.out' })
        .to(mobilePanelRef.current, { xPercent: 0, duration: reduceMotion ? .01 : .68, ease: 'power4.out' }, '<')
        .to(items, { x: 0, autoAlpha: 1, duration: reduceMotion ? .01 : .42, stagger: reduceMotion ? 0 : .065, ease: 'power3.out' }, reduceMotion ? '<' : '-=.34')
    }, mobileMenuRef)
    return () => { mobileTimelineRef.current?.kill(); ctx.revert() }
  }, [])
  useEffect(() => {
    if (mobileOpen) mobileTimelineRef.current?.play()
    else mobileTimelineRef.current?.pause(0)
  }, [mobileOpen])
  useEffect(() => {
    if (!mobileOpen) return undefined
    const closeOnEscape = (event) => event.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [mobileOpen])
  const navigateFromMobile = (event, path) => {
    event.preventDefault()
    if (mobileNavigatingRef.current) return
    if (location.pathname === path) {
      setMobileOpen(false)
      return
    }
    mobileNavigatingRef.current = true
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    gsap.timeline({
      onComplete: () => {
        setMobileOpen(false)
        navigate(path)
        mobileNavigatingRef.current = false
      },
    })
      .to(mobilePanelRef.current, { xPercent: 10, duration: reduceMotion ? .01 : .2, ease: 'power2.in' })
      .to(mobileBackdropRef.current, { autoAlpha: 0, duration: reduceMotion ? .01 : .16, ease: 'power1.out' }, '<')
  }
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
  // Only the sections the user's roles allow (handled here for now; an endpoint will decide this later).
  const navItems = navigationItems.filter(([path]) => canAccess(user, path))
  const roleLabel = isAdminUser(user) ? 'Admin' : rolesOf(user).join(', ') || 'All sections'
  return <div className="relative isolate min-h-[100dvh] overflow-x-clip bg-[var(--paper)]">
    <GridPattern
      width={72}
      height={72}
      squares={[[1, 1], [4, 2], [8, 4], [12, 1], [16, 6], [20, 3], [3, 9], [10, 11], [18, 13]]}
      className="app-grid-pattern pointer-events-none fixed inset-0 z-0"
    />
    <header className="sticky top-0 z-30 h-[var(--shell-h)] bg-[var(--paper)] px-3 pt-3 md:px-6 md:pt-5">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between rounded-full bg-[var(--surface)]/90 px-3 py-2 ring-1 ring-black/5 shadow-[0_18px_60px_rgba(30,32,25,.08)] backdrop-blur-xl">
        <Link to={homePath(user)} className="flex items-center gap-2.5 rounded-full pr-3 text-sm font-bold tracking-[-.02em]"><Mark /><span className="hidden sm:inline">Outright Feed Portal</span></Link>
        <nav className="hidden items-center gap-0.5 rounded-full bg-[var(--ink)]/[.045] p-1 xl:flex">
          {navItems.map(([path, label]) => <Link key={path} to={path} className={`whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${active(path) ? 'bg-[var(--lime)] text-[#26320b] ring-1 ring-[var(--lime-dark)]/25 shadow-[0_4px_18px_rgba(105,130,32,.14)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <div className="group relative" tabIndex={0} aria-label={`Role: ${roleLabel}`}>
            <span className="grid size-9 place-items-center rounded-full bg-[var(--lime)]/25 text-[var(--accent-strong)] ring-1 ring-[var(--lime-dark)]/30 transition-all duration-300 group-hover:bg-[var(--lime)]/45 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[var(--accent)]">
              <ChartLineUp size={17} weight="duotone" />
            </span>
            <span role="tooltip" className="pointer-events-none absolute right-1/2 top-12 z-40 translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[10px] font-bold text-white opacity-0 shadow-[0_10px_30px_rgba(30,32,25,.18)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus:translate-y-0 group-focus:opacity-100">
              {roleLabel}
            </span>
          </div>
          <ThemeToggle />
          <DocNotificationBell />
          <div ref={menuRef} className="relative hidden xl:block">
            <button aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)} className={`${iconButton} size-9`} aria-label="Open profile menu"><User size={17} weight="light" /></button>
            {profileOpen && <div className="absolute right-0 top-12 w-72 rounded-[1.5rem] bg-black/5 p-1.5 ring-1 ring-black/5 shadow-[0_24px_70px_rgba(30,32,25,.18)]"><div className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-3">
              <div className="flex items-center gap-3 px-2 py-3"><div className="grid size-11 place-items-center rounded-full bg-[var(--ink)] text-sm font-bold text-white">{userInitials(user?.name)}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name}</p><p className="truncate text-[10px] text-[var(--muted)]">{user?.email}</p></div></div>
              <div className="my-2 h-px bg-black/[.07]" />
              <button onClick={() => { navigate('/profile'); setProfileOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition-colors duration-300 hover:bg-black/[.04]"><UserCircle size={18} weight="light" />View profile<CaretDown size={12} className="ml-auto -rotate-90" /></button>
              <button onClick={() => { navigate('/activity'); setProfileOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition-colors duration-300 hover:bg-black/[.04]"><Clock size={18} weight="light" />Activity<CaretDown size={12} className="ml-auto -rotate-90" /></button>
              <button onClick={() => { navigate('/preferences'); setProfileOpen(false) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold transition-colors duration-300 hover:bg-black/[.04]"><SlidersHorizontal size={18} weight="light" />Work preferences<CaretDown size={12} className="ml-auto -rotate-90" /></button>
              <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[var(--danger)] transition-colors duration-300 hover:bg-[#f5d6cf]/50"><SignOut size={18} weight="light" />Log out</button>
            </div></div>}
          </div>
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" aria-expanded={mobileOpen} className={`${iconButton} size-9 xl:hidden`}><List size={18} weight="bold" /></button>
        </div>
      </div>
    </header>
    <div ref={mobileMenuRef} className={`fixed inset-0 z-50 xl:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
      <button ref={mobileBackdropRef} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className="absolute inset-0 bg-[var(--ink)]/55 backdrop-blur-sm" />
      <aside ref={mobilePanelRef} role="dialog" aria-modal="true" aria-label="Mobile navigation" className="absolute inset-y-0 right-0 flex w-[min(88vw,24rem)] flex-col overflow-y-auto bg-[var(--surface)] px-5 pb-6 pt-5 shadow-[-24px_0_70px_rgba(20,28,21,.24)] ring-1 ring-[var(--line)]">
        <div data-mobile-nav className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-sm font-bold"><Mark />Outright Feed Portal</div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className={`${iconButton} size-10`}><X size={17} weight="bold" /></button>
        </div>
        <div data-mobile-nav className="mt-8 flex items-center justify-between rounded-2xl bg-[var(--paper)] p-3 ring-1 ring-[var(--line)]/60">
          <div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Role</p><p className="mt-1 text-sm font-semibold">{roleLabel}</p></div>
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--lime)]/35 text-[var(--accent-strong)]"><ChartLineUp size={18} weight="duotone" /></span>
        </div>
        <nav className="mt-7 grid gap-1" aria-label="Mobile navigation links">
          {navItems.map(([path, label]) => <Link data-mobile-nav key={path} to={path} onClick={(event) => navigateFromMobile(event, path)} className={`group flex items-center justify-between rounded-2xl px-4 py-4 text-base font-semibold transition-colors ${active(path) ? 'bg-[var(--lime)] !text-[#26320b]' : 'hover:bg-[var(--paper)]'}`}><span>{label}</span><ArrowLink /></Link>)}
        </nav>
        <div className="mt-auto border-t border-[var(--line)] pt-5">
          <div data-mobile-nav className="mb-3 flex items-center gap-3 px-2"><div className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] text-xs font-bold text-white">{userInitials(user?.name)}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name}</p><p className="truncate text-[10px] text-[var(--muted)]">{user?.email}</p></div></div>
          <Link data-mobile-nav to="/profile" onClick={(event) => navigateFromMobile(event, '/profile')} className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold hover:bg-[var(--paper)]"><UserCircle size={18} />View profile</Link>
          <Link data-mobile-nav to="/activity" onClick={(event) => navigateFromMobile(event, '/activity')} className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold hover:bg-[var(--paper)]"><Clock size={18} />Activity</Link>
          <Link data-mobile-nav to="/preferences" onClick={(event) => navigateFromMobile(event, '/preferences')} className="flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-semibold hover:bg-[var(--paper)]"><SlidersHorizontal size={18} />Work preferences</Link>
          <button data-mobile-nav type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[var(--danger)] hover:bg-[#f5d6cf]/50"><SignOut size={18} />Log out</button>
        </div>
      </aside>
    </div>
    <div className="relative z-10">{children}</div>
  </div>
}

function ArrowLink() {
  return <CaretDown size={14} className="-rotate-90 opacity-45 transition-transform duration-300 group-hover:translate-x-0.5" />
}
