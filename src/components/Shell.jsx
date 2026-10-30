import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Article, Brain, Briefcase, Browsers, CaretLeft, CaretRight, CaretUpDown, ChatCircleText, Clock, Cloud, Code, DotsThreeOutline, EnvelopeSimple, Globe, List, MagnifyingGlass, Megaphone, Newspaper, PlugsConnected, Plus, Robot, ShareNetwork, ShieldCheck, SignOut, SlidersHorizontal, UserCircle, VideoCamera, WarningCircle, X } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import gsap from 'gsap'
import { Mark, barButton, iconButton } from './ui'
import ThemeToggle from './ThemeToggle'
import PalettePicker from './PalettePicker'
import DocNotificationBell from './DocNotificationBell'
import PromptManagerDialog from './PromptManagerDialog'
import ErrorBoundary, { DialogError } from './ErrorBoundary'
import GridPattern from './GridPattern'
import FeedbackWidget from './FeedbackWidget'
import NewFeedDialog from './NewFeedDialog'
import FeedBuildStatus from './FeedBuildStatus'
import { userInitials } from '../lib/auth'
import { canSeeFeed, feedPath, useFeeds } from '../lib/feeds'
import { useAuth } from '../contexts/AuthContext'
import { accessNotice, canAccess, homePath, isAdminUser, roleLabel as labelForRole } from '../lib/permissions'

// The sidebar's sections. A page can be in more than one group (LLM); the sidebar lists it once, in the first.
const NAV_GROUPS = [
  { label: 'Development', icon: Code, items: [
    ['/jobs', 'Jobs', Briefcase],
    ['/appscript', 'AppScript', Code],
    ['/api-playground', 'API Playground', PlugsConnected],
    ['/wordpress', 'Wordpress', Browsers],
    ['/llm', 'LLM', Brain],
    ['/cloud', 'Cloud', Cloud],
  ] },
  { label: 'Digital Marketing', icon: Megaphone, items: [
    ['/tech-news', 'AI News', Newspaper],
    ['/llm', 'LLM', Brain],
    ['/site-content', 'Site Content', Article],
    ['/seo', 'SEO', MagnifyingGlass],
    ['/email-to-blog', 'Email to Blog', EnvelopeSimple],
    ['/video', 'Video', VideoCamera],
  ] },
  { label: 'Others', icon: DotsThreeOutline, items: [
    ['/domain', 'Domain', Globe],
    ['/social', 'Social', ShareNetwork],
  ] },
]
// Pages outside the sidebar, named in the top bar.
const ACCOUNT_PAGES = [['/profile', 'Profile', UserCircle], ['/activity', 'Activity', Clock], ['/preferences', 'Work preferences', SlidersHorizontal], ['/admin', 'Admin panel', ShieldCheck]]

const SIDEBAR_KEY = 'pitchflow-sidebar'
const storedRail = () => {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'rail' } catch { return false }
}
// Each page renders its own Shell, so the sidebar mounts again on every navigation. What carries over from one page
// to the next lives here: how far the sidebar list was scrolled, and where the active pill last stood.
const carried = { scrollTop: 0, pill: null }

// A feed's initial on a tile tinted from its name (the skill-chip colours), so each feed is easy to spot.
const feedHue = (name = '') => [...name].reduce((hue, char) => (hue * 31 + char.charCodeAt(0)) % 360, 7)
function FeedTile({ name, className = 'size-6 rounded-lg text-[10px]' }) {
  return <span aria-hidden="true" className={`skill-chip grid shrink-0 place-items-center font-bold uppercase ${className}`} style={{ '--skill-h': feedHue(name) }}>{(name || '?').trim().charAt(0)}</span>
}

// One sidebar entry. The active entry's fill is the sliding pill behind it (Shell), so the link only changes colour.
// In the rail (collapsed sidebar) it shows the icon only and reports hover/focus for the floating label.
function SideLink({ to, label, icon: Icon, tile, active, rail, onTip, badge }) {
  const tipEvents = rail ? { onMouseEnter: (event) => onTip(label, event.currentTarget), onFocus: (event) => onTip(label, event.currentTarget), onMouseLeave: () => onTip(null), onBlur: () => onTip(null) } : {}
  return <Link to={to} aria-current={active ? 'page' : undefined} aria-label={rail ? label : undefined} {...tipEvents} className={`group/link relative z-10 flex h-10 items-center gap-3 rounded-xl text-[13px] font-semibold transition-colors duration-300 ${rail ? 'mx-auto w-10 justify-center' : 'px-3'} ${active ? 'text-[var(--on-lime)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--text)]'}`}>
    {tile || <Icon size={18} weight={active ? 'fill' : 'regular'} className={`shrink-0 transition-transform duration-300 ${active ? '' : 'group-hover/link:scale-110'}`} />}
    {!rail && <span className="min-w-0 flex-1 truncate">{label}</span>}
    {!rail && badge}
  </Link>
}

export default function Shell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [newFeedOpen, setNewFeedOpen] = useState(false)
  // Desktop sidebar: full width, or a rail of icons ("[" toggles it). Remembered per browser.
  const [rail, setRail] = useState(storedRail)
  // The rail's hover label: { label, top } of the hovered entry, or null.
  const [tip, setTip] = useState(null)
  // Prompt management lives in the URL (?prompts=<tab>&prompt=<id>), like a job preview, so a link opens it anywhere
  // and Back closes it.
  const [params, setParams] = useSearchParams()
  const promptsTab = params.get('prompts')
  const setPrompts = (tab, id = null, replace = false) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (tab) next.set('prompts', tab); else next.delete('prompts')
    if (tab && id) next.set('prompt', id); else next.delete('prompt')
    return next
  }, { replace })
  const { user, logout: endAuthSession } = useAuth()
  // The feeds this user sees: admins every feed, anyone else the built ones their role (or own permissions) opens.
  const { data: allFeeds = [] } = useFeeds(user)
  const feeds = allFeeds.filter((feed) => canSeeFeed(user, feed))
  const menuRef = useRef(null)
  const navRef = useRef(null)
  const scrollRef = useRef(null)
  const pillRef = useRef(null)
  const pillPlaced = useRef(false)
  const mobileMenuRef = useRef(null)
  const mobileBackdropRef = useRef(null)
  const mobilePanelRef = useRef(null)
  const mobileTimelineRef = useRef(null)
  const mobileNavigatingRef = useRef(false)
  const toggleRail = () => { setTip(null); setRail((value) => !value) }
  useEffect(() => {
    const dismiss = (event) => { if (!menuRef.current?.contains(event.target)) setProfileOpen(false) }
    const onKey = (event) => {
      if (event.key === 'Escape') setProfileOpen(false)
      // "[" collapses or expands the sidebar, except while typing or with a dialog open.
      if (event.key !== '[' || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target.closest?.('input, textarea, select, [contenteditable="true"]') || document.querySelector('[aria-modal="true"]')) return
      setTip(null)
      setRail((value) => !value)
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', onKey) }
  }, [])
  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, rail ? 'rail' : 'open') } catch { /* storage blocked: the choice lasts for this page */ }
  }, [rail])
  // Slide the pill onto the current page's entry, or fade it out on pages the sidebar doesn't list. A new Shell
  // first puts the pill where it stood on the previous page (without animating), so it slides from there.
  const placePill = () => {
    const pill = pillRef.current
    const current = navRef.current?.querySelector('[aria-current="page"]')
    if (!pill) return
    if (!current || !current.offsetHeight) { pill.style.opacity = '0'; pillPlaced.current = false; return }
    const next = { top: current.offsetTop, height: current.offsetHeight }
    if (!pillPlaced.current) {
      const from = carried.pill || next
      pill.style.transition = 'none'
      pill.style.top = `${from.top}px`
      pill.style.height = `${from.height}px`
      pill.style.opacity = '1'
      void pill.offsetHeight
      pill.style.transition = ''
      pillPlaced.current = true
    }
    pill.style.top = `${next.top}px`
    pill.style.height = `${next.height}px`
    pill.style.opacity = '1'
    carried.pill = next
  }
  useLayoutEffect(placePill)
  // Keep the sidebar list where it was scrolled on the previous page, and bring the current page's entry into view
  // if it is outside it (opened from a link, or the window is shorter).
  useLayoutEffect(() => {
    const box = scrollRef.current
    if (!box) return
    box.scrollTop = carried.scrollTop
    const current = navRef.current?.querySelector('[aria-current="page"]')
    if (!current || !box.clientHeight) return
    const top = navRef.current.offsetTop + current.offsetTop
    const bottom = top + current.offsetHeight
    if (top < box.scrollTop) box.scrollTop = top - 12
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight + 12
  }, [])
  // The sidebar is display:none below xl, so place the pill again when it appears or changes size.
  useEffect(() => {
    if (!navRef.current) return undefined
    const observer = new ResizeObserver(() => placePill())
    observer.observe(navRef.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const items = mobileMenuRef.current.querySelectorAll('[data-mobile-nav]')
      gsap.set(mobileMenuRef.current, { autoAlpha: 0 })
      gsap.set(mobileBackdropRef.current, { autoAlpha: 0 })
      gsap.set(mobilePanelRef.current, { xPercent: -105 })
      gsap.set(items, { x: -34, autoAlpha: 0 })
      mobileTimelineRef.current = gsap.timeline({ paused: true })
        .set(mobileMenuRef.current, { autoAlpha: 1 })
        .to(mobileBackdropRef.current, { autoAlpha: 1, duration: reduceMotion ? .01 : .3, ease: 'power2.out' })
        .to(mobilePanelRef.current, { xPercent: 0, duration: reduceMotion ? .01 : .68, ease: 'power4.out' }, '<')
        .to(items, { x: 0, autoAlpha: 1, duration: reduceMotion ? .01 : .42, stagger: reduceMotion ? 0 : .035, ease: 'power3.out' }, reduceMotion ? '<' : '-=.34')
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
      .to(mobilePanelRef.current, { xPercent: -10, duration: reduceMotion ? .01 : .2, ease: 'power2.in' })
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
  // Only the pages the user's permissions allow, with the same rule as the routes (lib/permissions). Each page is
  // listed once, and a group with none of the user's pages is hidden.
  const listed = new Set()
  const navGroups = NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(([path]) => {
    if (!canAccess(user, path) || listed.has(path)) return false
    listed.add(path)
    return true
  }) })).filter((group) => group.items.length)
  const roleLabel = labelForRole(user)
  // A user whose only access is a feed made with "+ New feed" does have a module.
  const notice = feeds.length && accessNotice(user) === 'none' ? null : accessNotice(user)
  const openNewFeed = () => { setMobileOpen(false); setNewFeedOpen(true) }
  // The top bar names the current page: its section, title and icon.
  const currentFeed = feeds.find((feed) => location.pathname === feedPath(feed))
  const currentGroup = navGroups.find((group) => group.items.some(([path]) => active(path)))
  const currentItem = currentGroup?.items.find(([path]) => active(path))
  const accountPage = ACCOUNT_PAGES.find(([path]) => active(path))
  const crumb = currentFeed ? { section: 'Feeds', label: currentFeed.name, tile: <FeedTile name={currentFeed.name} className="size-10 rounded-xl text-sm" /> }
    : currentItem ? { section: currentGroup.label, label: currentItem[1], icon: currentItem[2] }
      : accountPage ? { section: 'Account', label: accountPage[1], icon: accountPage[2] } : null
  const showTip = (label, element) => {
    if (!label) return setTip(null)
    const box = element.getBoundingClientRect()
    setTip({ label, top: box.top + box.height / 2 })
  }
  const menuItem = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors duration-300 hover:bg-[var(--paper)]'
  const go = (path) => { navigate(path); setProfileOpen(false) }
  const feedBadge = (feed) => feed.buildStatus !== 'built' && <FeedBuildStatus status={feed.buildStatus} />
  const groupLabel = 'mb-1 flex items-center gap-2 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]'
  const avatar = (size) => <span className="relative shrink-0">
    <span className={`grid ${size} place-items-center rounded-full bg-[var(--ink)] font-bold text-white`}>{userInitials(user?.name)}</span>
    <span aria-hidden="true" className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-success-solid ring-2 ring-[var(--surface)]" />
  </span>

  return <div className="relative isolate min-h-[100dvh] overflow-x-clip bg-[var(--paper)]" style={{ '--sidebar-w': rail ? '5rem' : '16.5rem' }}>
    <GridPattern
      width={72}
      height={72}
      squares={[[1, 1], [4, 2], [8, 4], [12, 1], [16, 6], [20, 3], [3, 9], [10, 11], [18, 13]]}
      className="app-grid-pattern pointer-events-none fixed inset-0 z-0"
    />

    {/* Desktop sidebar (xl and up): a floating framed panel. Smaller screens open the same navigation from the menu button. */}
    <aside aria-label="Main navigation" className="group/side fixed bottom-2 left-2 top-2 z-40 hidden w-[calc(var(--sidebar-w)-.5rem)] rounded-[1.75rem] bg-[var(--frame)]/70 p-1 ring-1 ring-[var(--line)]/60 shadow-[0_24px_60px_rgb(var(--shadow-rgb)/.08)] backdrop-blur-xl transition-[width] duration-500 ease-[cubic-bezier(.32,.72,0,1)] xl:block">
      <div className="relative flex h-full flex-col rounded-[calc(1.75rem-.25rem)] bg-[var(--surface)] ring-1 ring-black/[.03]">
        <div aria-hidden="true" className="side-glow pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-[calc(1.75rem-.25rem)]" />
        <div className={`relative flex h-14 shrink-0 items-center ${rail ? 'justify-center' : 'px-3'}`}>
          <Link to={homePath(user)} aria-label="Outright Feed Portal home" className="flex min-w-0 items-center gap-2.5">
            <Mark />
            {!rail && <span className="truncate text-sm font-bold tracking-[-.02em]">Outright Feed Portal</span>}
          </Link>
        </div>
        <div aria-hidden="true" className="relative mx-3 h-px bg-[var(--line)]/70" />
        <div ref={scrollRef} onScroll={(event) => { carried.scrollTop = event.currentTarget.scrollTop }} className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <nav ref={navRef} className="relative space-y-5">
            <span ref={pillRef} aria-hidden="true" className={`side-pill pointer-events-none absolute z-0 rounded-xl opacity-0 ${rail ? 'left-[calc(50%-1.25rem)] w-10' : 'left-0 w-full'}`} />
            {navGroups.map((group, index) => <div key={group.label}>
              {rail ? index > 0 && <div aria-hidden="true" className="mx-auto mb-2 h-px w-5 bg-[var(--line)]" /> : <p className={groupLabel}>{group.label}</p>}
              <div className="grid gap-0.5">
                {group.items.map(([path, label, Icon]) => <SideLink key={path} to={path} label={label} icon={Icon} active={active(path)} rail={rail} onTip={showTip} />)}
              </div>
            </div>)}
            {/* Feeds made with "+ New feed" (admins also see ones not built yet, with their status). */}
            <div>
              {rail ? <div aria-hidden="true" className="mx-auto mb-2 h-px w-5 bg-[var(--line)]" /> : <p className={groupLabel}>Feeds
                {feeds.length > 0 && <span className="font-mono text-[10px] font-medium tracking-normal">{feeds.length}</span>}
                <button type="button" onClick={openNewFeed} aria-label="New feed" title="New feed" className="ml-auto grid size-5 place-items-center rounded-md text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--text)]"><Plus size={10} weight="bold" /></button>
              </p>}
              <div className="grid gap-0.5">
                {feeds.map((feed) => <SideLink key={feed.id} to={feedPath(feed)} label={feed.name} tile={<FeedTile name={feed.name} />} active={location.pathname === feedPath(feed)} rail={rail} onTip={showTip} badge={feedBadge(feed)} />)}
                {rail
                  ? <button type="button" onClick={openNewFeed} aria-label="New feed" onMouseEnter={(event) => showTip('New feed', event.currentTarget)} onMouseLeave={() => showTip(null)} onFocus={(event) => showTip('New feed', event.currentTarget)} onBlur={() => showTip(null)} className="relative z-10 mx-auto grid size-10 place-items-center rounded-xl border border-dashed border-[var(--line)] text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--text)]"><Plus size={16} weight="bold" /></button>
                  : !feeds.length && <button type="button" onClick={openNewFeed} className="relative z-10 flex h-10 items-center gap-3 rounded-xl border border-dashed border-[var(--line)] px-3 text-[13px] font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--text)]"><Plus size={16} weight="bold" />New feed</button>}
              </div>
            </div>
          </nav>
        </div>
        {/* Feedback lives here, out of the page's way (it used to float over the bottom-left corner). */}
        <div className="shrink-0 px-3 pb-1.5 pt-1">
          <FeedbackWidget trigger={(open) => <button type="button" onClick={open} aria-label="Give feedback" onMouseEnter={rail ? (event) => showTip('Give feedback', event.currentTarget) : undefined} onMouseLeave={rail ? () => showTip(null) : undefined} onFocus={rail ? (event) => showTip('Give feedback', event.currentTarget) : undefined} onBlur={rail ? () => showTip(null) : undefined} className={`group/link flex h-10 items-center gap-3 rounded-xl text-[13px] font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--text)] ${rail ? 'mx-auto w-10 justify-center' : 'w-full px-3'}`}>
            <ChatCircleText size={18} className="shrink-0 transition-transform duration-300 group-hover/link:scale-110" />{!rail && 'Give feedback'}
          </button>} />
        </div>
        <div aria-hidden="true" className="mx-3 h-px bg-[var(--line)]/70" />
        <div ref={menuRef} className="relative shrink-0 p-2">
          <button type="button" aria-expanded={profileOpen} aria-haspopup="menu" aria-label="Open profile menu" onClick={() => setProfileOpen((open) => !open)} onMouseEnter={rail ? (event) => showTip(user?.name || 'Profile', event.currentTarget) : undefined} onMouseLeave={rail ? () => showTip(null) : undefined} className={`flex w-full items-center gap-2.5 rounded-2xl p-2 text-left ring-1 transition-colors ${rail ? 'justify-center' : ''} ${profileOpen ? 'bg-[var(--paper)] ring-[var(--line)]' : 'ring-transparent hover:bg-[var(--paper)] hover:ring-[var(--line)]/70'}`}>
            {avatar('size-9 text-xs')}
            {!rail && <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold">{user?.name}</span><span className="block truncate text-[10px] font-semibold text-[var(--muted)]">{roleLabel}</span></span>}
            {!rail && <CaretUpDown size={14} className="shrink-0 text-[var(--muted)]" />}
          </button>
          {profileOpen && <div role="menu" className="absolute bottom-full left-2 z-50 mb-2 w-72 rounded-[1.5rem] bg-black/5 p-1.5 ring-1 ring-black/5 shadow-[0_24px_70px_rgb(var(--shadow-rgb)/.18)]"><div className="rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-3">
            <div className="flex items-center gap-3 px-2 py-2">{avatar('size-11 text-sm')}<div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name}</p><p className="truncate text-[10px] text-[var(--muted)]">{user?.email}</p><p className="mt-1.5 inline-flex rounded-full bg-[var(--paper)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--line)]">{roleLabel}</p></div></div>
            <div className="my-2 h-px bg-[var(--line)]/70" />
            <button type="button" role="menuitem" onClick={() => go('/profile')} className={menuItem}><UserCircle size={18} weight="light" />View profile</button>
            <button type="button" role="menuitem" onClick={() => go('/activity')} className={menuItem}><Clock size={18} weight="light" />Activity</button>
            <button type="button" role="menuitem" onClick={() => go('/preferences')} className={menuItem}><SlidersHorizontal size={18} weight="light" />Work preferences</button>
            {isAdminUser(user) && <button type="button" role="menuitem" onClick={() => go('/admin/permissions')} className={menuItem}><ShieldCheck size={18} weight="light" />Admin panel</button>}
            <div className="my-2 h-px bg-[var(--line)]/70" />
            <button type="button" role="menuitem" onClick={logout} className={`${menuItem} text-[var(--danger)] hover:bg-[var(--bad-bg)]/60`}><SignOut size={18} weight="light" />Log out</button>
          </div></div>}
        </div>
      </div>
      {/* Edge handle: shows on hover (always on touch screens). */}
      <button type="button" onClick={toggleRail} aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!rail} title={`${rail ? 'Expand' : 'Collapse'} sidebar  [`} className="absolute -right-3 top-[4.25rem] z-10 grid size-6 place-items-center rounded-full bg-[var(--surface)] text-[var(--muted)] opacity-0 ring-1 ring-[var(--line)] shadow-[0_4px_12px_rgb(var(--shadow-rgb)/.12)] transition-all duration-300 hover:scale-110 hover:text-[var(--text)] focus-visible:opacity-100 group-hover/side:opacity-100 [@media(hover:none)]:opacity-100">
        {rail ? <CaretRight size={11} weight="bold" /> : <CaretLeft size={11} weight="bold" />}
      </button>
    </aside>
    {/* The rail's labels sit outside the scrolling list so they are never clipped. */}
    {rail && tip && <span role="tooltip" className="pointer-events-none fixed left-[calc(var(--sidebar-w)+.25rem)] z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[var(--ink)] px-3 py-1.5 text-[11px] font-bold text-white shadow-[0_10px_30px_rgb(var(--shadow-rgb)/.18)] ring-1 ring-white/10 xl:block" style={{ top: tip.top }}>{tip.label}</span>}

    <div className="relative z-10 transition-[padding] duration-500 ease-[cubic-bezier(.32,.72,0,1)] xl:pl-[var(--sidebar-w)]">
      {/* From xl the bar's bottom line runs on from the divider under the sidebar's logo (same height, --shell-h). */}
      <header className="sticky top-0 z-30 flex h-[var(--shell-h)] items-center gap-3 border-b border-[var(--line)]/70 bg-[var(--paper)] px-3 md:px-6">
        <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" aria-expanded={mobileOpen} className={`${iconButton} size-9 xl:hidden`}><List size={18} weight="bold" /></button>
        <Link to={homePath(user)} className="flex items-center gap-2.5 text-sm font-bold tracking-[-.02em] xl:hidden"><Mark /><span className="hidden sm:inline">Outright Feed Portal</span></Link>
        {crumb && <div className="hidden min-w-0 items-center gap-3 xl:flex">
          {crumb.tile || <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]/70 shadow-[0_6px_18px_rgb(var(--shadow-rgb)/.06)]"><crumb.icon size={18} weight="duotone" /></span>}
          <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{crumb.section}</p><p className="truncate text-base font-bold leading-tight tracking-[-.02em]">{crumb.label}</p></div>
        </div>}
        {/* The bar's tools in one tray: look (palette, light/dark), then prompts and notifications. */}
        <div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--surface)] p-1 ring-1 ring-[var(--line)]/70 shadow-[0_6px_18px_rgb(var(--shadow-rgb)/.06)]">
          <PalettePicker />
          <ThemeToggle flat />
          <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--line)]" />
          {canAccess(user, '/appscript') && <button type="button" onClick={() => setPrompts('prompts')} aria-label="Prompt management" title="Prompt management" className={barButton}><Robot size={17} weight="light" /></button>}
          <DocNotificationBell />
        </div>
      </header>
      {/* A short fade under the bar, as tall as the gap above the sticky side columns (index, queue, details: top
          --shell-h + 1rem). Page content fades out on the same line where those columns begin, instead of running on
          under the bar while they stop lower. It stays below page toolbars that stick (z-20) and takes no space. */}
      <div aria-hidden="true" className="pointer-events-none sticky top-[var(--shell-h)] z-[15] -mb-4 h-4 bg-[linear-gradient(to_bottom,var(--paper)_60%,transparent)]" />
      {notice && <div className="mx-auto mt-3 max-w-[1500px] px-3 md:px-6">
        <p role="status" className="flex items-start gap-2 rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-xs font-semibold text-[var(--warn)] ring-1 ring-[var(--warn)]/20">
          <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />
          {notice === 'unavailable' ? 'Some modules are unavailable right now. Try again shortly.' : 'You don’t have access to any modules yet. Ask an admin for access.'}
        </p>
      </div>}
      {children}
    </div>

    {/* Navigation below xl: a panel that slides in from the left, like the sidebar it stands in for. */}
    <div ref={mobileMenuRef} className={`fixed inset-0 z-50 xl:hidden ${mobileOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!mobileOpen}>
      <button ref={mobileBackdropRef} type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className="absolute inset-0 bg-[var(--ink)]/55 backdrop-blur-sm" />
      <aside ref={mobilePanelRef} role="dialog" aria-modal="true" aria-label="Mobile navigation" className="absolute inset-y-2 left-2 flex w-[min(86vw,21rem)] flex-col overflow-y-auto rounded-[1.75rem] bg-[var(--surface)] px-3 pb-3 pt-3 shadow-[24px_0_70px_rgb(var(--shadow-rgb)/.24)] ring-1 ring-[var(--line)]">
        <div aria-hidden="true" className="side-glow pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-[1.75rem]" />
        <div data-mobile-nav className="relative flex items-center justify-between px-1">
          <div className="flex min-w-0 items-center gap-2.5 text-sm font-bold tracking-[-.02em]"><Mark /><span className="truncate">Outright Feed Portal</span></div>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className={`${iconButton} size-9`}><X size={16} weight="bold" /></button>
        </div>
        <nav className="relative mt-5 grid gap-5" aria-label="Mobile navigation links">
          {navGroups.map((group) => <div key={group.label}>
            <p data-mobile-nav className={groupLabel}>{group.label}</p>
            <div className="grid gap-0.5">
              {group.items.map(([path, label, Icon]) => <Link data-mobile-nav key={path} to={path} onClick={(event) => navigateFromMobile(event, path)} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${active(path) ? 'side-pill !text-[var(--on-lime)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--text)]'}`}><Icon size={18} weight={active(path) ? 'fill' : 'regular'} className="shrink-0" /><span className="min-w-0 flex-1 truncate">{label}</span></Link>)}
            </div>
          </div>)}
          <div>
            <p data-mobile-nav className={groupLabel}>Feeds{feeds.length > 0 && <span className="font-mono text-[10px] font-medium tracking-normal">{feeds.length}</span>}</p>
            <div className="grid gap-0.5">
              {feeds.map((feed) => <Link data-mobile-nav key={feed.id} to={feedPath(feed)} onClick={(event) => navigateFromMobile(event, feedPath(feed))} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${location.pathname === feedPath(feed) ? 'side-pill !text-[var(--on-lime)]' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--text)]'}`}><FeedTile name={feed.name} /><span className="min-w-0 flex-1 truncate">{feed.name}</span>{feedBadge(feed)}</Link>)}
              <button data-mobile-nav type="button" onClick={openNewFeed} className="flex h-11 items-center gap-3 rounded-xl border border-dashed border-[var(--line)] px-3 text-left text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--text)]"><Plus size={16} weight="bold" />New feed</button>
            </div>
          </div>
        </nav>
        <div className="relative mt-auto pt-5">
          <div className="rounded-2xl bg-[var(--paper)] p-2 ring-1 ring-[var(--line)]/70">
            <div data-mobile-nav className="mb-1 flex items-center gap-3 px-2 py-1.5">{avatar('size-10 text-xs')}<div className="min-w-0"><p className="truncate text-sm font-bold">{user?.name}</p><p className="truncate text-[10px] font-semibold text-[var(--muted)]">{roleLabel} · {user?.email}</p></div></div>
            <Link data-mobile-nav to="/profile" onClick={(event) => navigateFromMobile(event, '/profile')} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface)]"><UserCircle size={18} />View profile</Link>
            <Link data-mobile-nav to="/activity" onClick={(event) => navigateFromMobile(event, '/activity')} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface)]"><Clock size={18} />Activity</Link>
            <Link data-mobile-nav to="/preferences" onClick={(event) => navigateFromMobile(event, '/preferences')} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface)]"><SlidersHorizontal size={18} />Work preferences</Link>
            <FeedbackWidget trigger={(open) => <button data-mobile-nav type="button" onClick={() => { setMobileOpen(false); open() }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold hover:bg-[var(--surface)]"><ChatCircleText size={18} />Give feedback</button>} />
            {isAdminUser(user) && <Link data-mobile-nav to="/admin/permissions" onClick={(event) => navigateFromMobile(event, '/admin/permissions')} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold hover:bg-[var(--surface)]"><ShieldCheck size={18} />Admin panel</Link>}
            <button data-mobile-nav type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-[var(--danger)] hover:bg-[var(--bad-bg)]/60"><SignOut size={18} />Log out</button>
          </div>
        </div>
      </aside>
    </div>
    {promptsTab && <ErrorBoundary name="prompt-management" fallback={DialogError} fallbackProps={{ onClose: () => setPrompts(null, null, true) }}>
      <PromptManagerDialog tab={promptsTab} onTab={(tab) => setPrompts(tab, null, true)} openId={params.get('prompt')} onOpen={(id) => setPrompts(promptsTab, id, Boolean(params.get('prompt')))} onClose={() => setPrompts(null, null, true)} />
    </ErrorBoundary>}
    {newFeedOpen && <NewFeedDialog onClose={() => setNewFeedOpen(false)} onSaved={(id) => { setNewFeedOpen(false); if (id) navigate(`/feeds/${id}`) }} />}
  </div>
}
