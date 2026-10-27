import { createElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { ArrowRight, Brain, Briefcase, Broadcast, Bug, CaretDown, Check, Code, MagnifyingGlass, MicrosoftTeamsLogo, PaintBrush, PenNib, SignOut, Sparkle, Target, UserCircle, UsersThree, WarningCircle } from '@phosphor-icons/react'
import { Mark, primaryButton } from '../components/ui'
import ThemeToggle from '../components/ThemeToggle'
import GridPattern from '../components/GridPattern'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { asArray, asText } from '../lib/safe'
import { needsRole } from '../lib/permissions'

const ROLE_ICONS = {
  developer: Code,
  qa: Bug,
  seo: MagnifyingGlass,
  content: PenNib,
  design: PaintBrush,
  'ai manager': Brain,
  manager: Briefcase,
}
const iconFor = (name) => ROLE_ICONS[asText(name).trim().toLowerCase()] || UserCircle

function RoleIcon({ name, active = false }) {
  return <span className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 transition-colors ${active ? 'bg-[var(--lime)] text-[#26320b] ring-[var(--lime-dark)]/40' : 'bg-[var(--surface)] text-[var(--accent-strong)] ring-[var(--line)]'}`}>
    {createElement(iconFor(name), { size: 17, weight: 'duotone' })}
  </span>
}

// Dropdown of CRM roles, in the app's style, with arrow keys, Enter/Space to pick and Escape to close.
function RolePicker({ roles, value, onChange, loading, disabled }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef(null)
  const trigger = useRef(null)
  const list = useRef(null)
  const listId = useId()
  const selected = roles.find((role) => role.id === value)

  useEffect(() => {
    if (!open) return undefined
    list.current?.focus({ preventScroll: true })
    const dismiss = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])
  // Keeps the highlighted role visible by scrolling the list only, never the page.
  useEffect(() => {
    const ul = list.current
    const li = open ? ul?.querySelector(`[data-index="${active}"]`) : null
    if (!li) return
    if (li.offsetTop < ul.scrollTop) ul.scrollTop = li.offsetTop
    else if (li.offsetTop + li.offsetHeight > ul.scrollTop + ul.clientHeight) ul.scrollTop = li.offsetTop + li.offsetHeight - ul.clientHeight
  }, [open, active])

  const openList = () => {
    if (disabled || loading || !roles.length) return
    setActive(Math.max(0, roles.findIndex((role) => role.id === value)))
    setOpen(true)
  }
  const close = () => { setOpen(false); trigger.current?.focus() }
  const pick = (role) => { onChange(role.id); close() }
  const onListKey = (event) => {
    const keys = {
      ArrowDown: () => setActive((index) => Math.min(index + 1, roles.length - 1)),
      ArrowUp: () => setActive((index) => Math.max(index - 1, 0)),
      Home: () => setActive(0),
      End: () => setActive(roles.length - 1),
      Enter: () => pick(roles[active]),
      ' ': () => pick(roles[active]),
      Escape: close,
      Tab: () => setOpen(false),
    }
    if (!keys[event.key]) return
    if (event.key !== 'Tab') event.preventDefault()
    keys[event.key]()
  }

  return <div ref={root} className="relative">
    <button
      ref={trigger}
      type="button"
      id={`${listId}-trigger`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      disabled={disabled || loading}
      onClick={() => (open ? setOpen(false) : openList())}
      onKeyDown={(event) => { if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); openList() } }}
      className={`flex h-14 w-full items-center gap-3 rounded-2xl bg-[var(--paper)] pl-2.5 pr-4 text-left ring-1 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lime-dark)] disabled:cursor-wait disabled:opacity-70 ${open ? 'ring-2 ring-[var(--lime-dark)]' : 'ring-[var(--line)] hover:ring-[var(--lime-dark)]/60'}`}
    >
      {loading
        ? <><span className="skeleton-bone size-9 shrink-0 rounded-xl" /><span className="text-sm font-medium text-[var(--muted)]">Loading roles…</span></>
        : selected
          ? <><RoleIcon name={selected.name} active /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]">{selected.name}</span></>
          : <><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--line)]"><UserCircle size={17} /></span><span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--muted)]">Select your role</span></>}
      {!loading && <CaretDown size={14} weight="bold" className={`ml-auto shrink-0 text-[var(--muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />}
    </button>

    {open && <ul
      ref={list}
      id={listId}
      role="listbox"
      tabIndex={-1}
      aria-labelledby={`${listId}-trigger`}
      aria-activedescendant={`${listId}-option-${active}`}
      onKeyDown={onListKey}
      className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl bg-[var(--surface)] p-1.5 shadow-[0_24px_60px_rgba(20,28,21,.18)] outline-none ring-1 ring-[var(--line)] [scrollbar-width:thin] dark:shadow-[0_24px_60px_rgba(0,0,0,.45)]"
    >
      {roles.map((role, index) => {
        const isSelected = role.id === value
        return <li
          key={role.id}
          id={`${listId}-option-${index}`}
          data-index={index}
          role="option"
          aria-selected={isSelected}
          onPointerEnter={() => setActive(index)}
          onClick={() => pick(role)}
          className={`flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors ${index === active ? 'bg-[var(--paper)]' : ''}`}
        >
          <RoleIcon name={role.name} active={isSelected} />
          <span className={`min-w-0 flex-1 truncate text-sm ${isSelected ? 'font-semibold text-[var(--text)]' : 'font-medium text-[var(--text)]/85'}`}>{role.name}</span>
          {isSelected && <Check size={15} weight="bold" className="shrink-0 text-[var(--accent-strong)]" />}
        </li>
      })}
    </ul>}
  </div>
}

// The brand panel is dark in both themes, so its colours are fixed.
const glassCard = 'rounded-2xl bg-white/[.05] ring-1 ring-inset ring-white/[.09] backdrop-blur-sm'

// How the portal works, in three steps a non-technical reader can follow; each has a small real-looking example.
const HOW_IT_WORKS = [
  {
    icon: Broadcast,
    title: 'Collects',
    text: 'New Upwork jobs and tech news, around the clock.',
    example: <><span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#c8e875] opacity-70" /><span className="relative size-1.5 rounded-full bg-[#c8e875]" /></span>12 new jobs this hour</>,
  },
  {
    icon: Sparkle,
    title: 'AI does the groundwork',
    text: 'Scores every job, writes cover letters and drafts site content.',
    example: <><Target size={11} weight="bold" />72% match · cover letter ready</>,
  },
  {
    icon: UsersThree,
    title: 'Your team acts',
    text: 'Apply, publish and share in Microsoft Teams, from one place.',
    example: <><MicrosoftTeamsLogo size={11} weight="fill" />Shared with Jatin</>,
  },
]

const WORKSPACES = ['Jobs', 'Live Jobs', 'AI News', 'Site Content', 'SEO', 'Domain', 'Video', 'Social', 'Email to Blog', 'WordPress', 'AppScript', 'LLM', 'Cloud', 'API Playground']

// Three connected steps; a lime dot travels down the line like data moving through the portal.
function HowItWorks() {
  return <div className="relative">
    <span aria-hidden="true" className="absolute bottom-7 left-[1.375rem] top-7 w-px bg-gradient-to-b from-[#c8e875]/50 via-white/15 to-[#c8e875]/50" />
    <span aria-hidden="true" data-flow className="absolute left-[1.1rem] top-7 size-[.55rem] rounded-full bg-[#c8e875] shadow-[0_0_14px_rgba(200,232,117,.8)]" />
    <ol className="relative space-y-2.5">
      {HOW_IT_WORKS.map(({ icon: Icon, title, text, example }, index) => <li key={title} className="flex items-start gap-4">
        <span className="relative z-10 grid size-11 shrink-0 place-items-center rounded-xl bg-[#1d281f] text-[#c8e875] ring-1 ring-inset ring-[#c8e875]/30 shadow-[0_0_18px_rgba(200,232,117,.12)]">
          <Icon size={19} weight="duotone" />
        </span>
        <div className={`${glassCard} min-w-0 flex-1 px-4 py-3`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-white"><span className="font-mono text-[10px] font-bold text-[#c8e875]">0{index + 1}</span>{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-5 text-white/60">{text}</p>
          {/* Example badge; dropped on short screens so the whole overview fits without scrolling. */}
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/[.06] px-2.5 py-1 text-[10.5px] font-semibold text-white/80 [@media(max-height:860px)]:hidden">{example}</p>
        </div>
      </li>)}
    </ol>
  </div>
}

/**
 * First login: a user with no role picks one (saved in their CRM user's Role field), then the app opens their workspace.
 * Skills are picked later on the Jobs page (My skills).
 */
export default function Onboarding() {
  const { user, chooseRole, logout } = useAuth()
  const navigate = useNavigate()
  const root = useRef(null)
  const [roleId, setRoleId] = useState('')
  const askRole = needsRole(user)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { data, isLoading, isError, error: loadError, refetch } = useQuery({ queryKey: ['crm-roles'], queryFn: api.getRoles, staleTime: 5 * 60_000, enabled: askRole })
  const roles = useMemo(() => asArray(data), [data])
  const selected = roles.find((role) => role.id === roleId)
  const firstName = asText(user?.name).trim().split(/\s+/)[0] || 'there'

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-enter]', { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .9, stagger: .09, ease: 'power4.out' })
      // A dot travels down the "How it works" line, like data moving through the portal.
      gsap.fromTo('[data-flow]', { y: 0, autoAlpha: 0 }, { keyframes: [{ autoAlpha: 1, duration: .2 }, { y: () => (root.current?.querySelector('[data-flow]')?.parentElement?.offsetHeight || 260) - 70, duration: 2.6, ease: 'power1.inOut' }, { autoAlpha: 0, duration: .3 }], repeat: -1, repeatDelay: .6, delay: 1 })
    }, root)
    return () => ctx.revert()
  }, [])

  const ready = !askRole || Boolean(selected)
  const submit = async (event) => {
    event.preventDefault()
    if (!ready || saving) return
    setSaving(true)
    setError('')
    try {
      // Once the role is saved, the onboarding route sends the user on to the first page they can open.
      if (askRole) await chooseRole(selected)
    } catch (saveError) {
      setError(saveError?.message || 'Your role could not be saved. Please try again.')
      setSaving(false)
    }
  }

  const signOut = async () => {
    try { await logout() } finally { navigate('/login', { replace: true }) }
  }

  return <main ref={root} className="relative grid min-h-[100dvh] grid-cols-1 bg-[var(--paper)] lg:grid-cols-[.92fr_1.08fr]">
    {/* Brand side, the same as the sign-in screen. */}
    <section className="relative hidden min-h-[100dvh] flex-col overflow-hidden bg-[var(--ink)] px-14 py-6 text-white lg:flex">
      <GridPattern width={68} height={68} squares={[[1, 1], [3, 4], [6, 2], [9, 7], [13, 3]]} className="app-grid-pattern app-grid-pattern-login pointer-events-none absolute inset-0 z-0" />
      <div className="pointer-events-none absolute -left-36 top-1/3 size-[28rem] rounded-full bg-[var(--lime)]/10 blur-[110px]" />
      <div data-enter className="relative flex items-center gap-3">
        <Mark />
        <span className="text-sm font-bold tracking-[-.02em]">Outright Feed Portal</span>
        <span className="text-[10px] font-semibold uppercase tracking-[.18em] text-white/65">Get Your Live Feeds</span>
      </div>
      <div className="relative my-auto max-w-[34rem] py-6 xl:py-10">
        <h1 data-enter className="text-[clamp(2.6rem,4.2vw,4.2rem)] font-medium leading-[.9] tracking-[-.075em]">
          Welcome, <span className="font-serif italic text-[var(--lime)]">{firstName}</span>
        </h1>
        <p data-enter className="mt-4 text-[15px] leading-7 text-white/60">One portal that finds the work, does the groundwork with AI and keeps your team in sync.</p>
        <p data-enter className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-white/45 xl:mt-8">How it works</p>
        <div data-enter className="mt-3"><HowItWorks /></div>
        <div data-enter className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-white/45">{WORKSPACES.length} workspaces, one login</p>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {WORKSPACES.map((name) => <li key={name} className="rounded-full bg-white/[.05] px-2.5 py-1 text-[11px] font-medium text-white/70 ring-1 ring-inset ring-white/[.08]">{name}</li>)}
          </ul>
        </div>
      </div>
      <div data-enter className="relative flex items-end justify-between border-t border-white/10 pt-5 text-[10px] uppercase tracking-[.16em] text-white/50">
        <span>Built for focused teams</span>
        <span>© 2026</span>
      </div>
    </section>

    {/* Role step: follows the light / dark theme. */}
    <section className="relative isolate flex min-h-[100dvh] min-w-0 flex-col overflow-hidden px-4 py-5 sm:px-8 lg:px-14 lg:py-6">
      <GridPattern width={72} height={72} squares={[[2, 2], [7, 4], [12, 1], [5, 9]]} className="app-grid-pattern pointer-events-none absolute inset-0 -z-10" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-sm font-bold lg:invisible"><Mark />Outright Feed Portal</div>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button type="button" onClick={signOut} className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--ink)]/5 hover:text-[var(--text)]"><SignOut size={15} />Sign out</button>
        </div>
      </div>

      <div className="my-auto w-full py-10">
        <form data-enter onSubmit={submit} className="mx-auto w-full max-w-[29rem] rounded-[2rem] bg-[var(--ink)]/[.04] p-2 ring-1 ring-[var(--line)]/70 dark:bg-white/[.03]">
          <div className="rounded-[calc(2rem-.5rem)] bg-[var(--surface)] px-5 py-7 shadow-[0_30px_80px_rgba(30,40,25,.1)] dark:shadow-[0_30px_80px_rgba(0,0,0,.35)] sm:px-8 sm:py-10">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Workspace setup</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-[var(--text)]">Select your role</h2>

            {askRole && <>
              <p id="onboarding-role-label" className="mt-8 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Role</p>
              <div className="mt-2" aria-labelledby="onboarding-role-label">
                {isError
                  ? <p role="alert" className="flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">{loadError?.message || 'The roles could not be loaded.'}</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Retry</button></p>
                  : <RolePicker roles={roles} value={roleId} onChange={(id) => { setRoleId(id); setError('') }} loading={isLoading} disabled={saving} />}
              </div>
            </>}

            {error && <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />{error}</p>}

            <button type="submit" disabled={!ready || saving} className={`${primaryButton} mt-7 w-full bg-[var(--lime)] !text-[var(--ink)]`}>
              <span>{saving ? 'Saving…' : 'Continue'}</span>
              <span className="ml-auto grid size-8 place-items-center rounded-full bg-[var(--ink)] text-white">
                {saving ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <ArrowRight size={14} weight="bold" />}
              </span>
            </button>

            <p className="mt-6 truncate border-t border-[var(--line)]/70 pt-4 text-[11px] text-[var(--muted)]">Signed in as <span className="font-semibold text-[var(--text)]">{user?.email}</span></p>
          </div>
        </form>
      </div>
    </section>
  </main>
}
