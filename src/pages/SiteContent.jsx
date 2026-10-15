import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Circle,
  Copy,
  DownloadSimple,
  Eye,
  FileDoc,
  Fire,
  Globe,
  Key,
  LinkSimple,
  MagnifyingGlass,
  Newspaper,
  Quotes,
  Sparkle,
  Target,
  WarningCircle,
  X,
} from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LogoLoader from '../components/LogoLoader'
import HScroll from '../components/HScroll'
import { Modal, primaryButton, stickyBand } from '../components/ui'
import { api } from '../services/api'

gsap.registerPlugin(ScrollTrigger)

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SITE_TONES = ['#c8e875', '#cbc6ef', '#f6c9a8', '#b8e0d2', '#f2d27a', '#a9c8f0', '#f0b5c4']

function siteTone(site) {
  const hash = [...site].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return SITE_TONES[hash % SITE_TONES.length]
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function useDesktop() {
  const query = '(min-width: 1024px)'
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return desktop
}

function SiteMark({ site, size = 'size-9' }) {
  return (
    <span
      className={`${size} grid shrink-0 place-items-center rounded-xl text-xs font-bold uppercase text-[#26320b]`}
      style={{ background: siteTone(site) }}
    >
      {site.replace(/^www\./, '').slice(0, 2)}
    </span>
  )
}

export default function SiteContent() {
  const queryClient = useQueryClient()
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['site-content'],
    queryFn: () => api.getSiteContent(),
    staleTime: 120_000,
  })

  const [site, setSite] = useState('All')
  const [category, setCategory] = useState('All')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const desktop = useDesktop()
  const root = useRef(null)

  const sites = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => counts.set(item.site, (counts.get(item.site) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const categories = useMemo(
    () => ['All', ...new Set(items.map((item) => item.category))],
    [items]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items
      .filter(
        (item) =>
          (site === 'All' || item.site === site) &&
          (category === 'All' || item.category === category) &&
          (!urgentOnly || item.importance === 'HURRYUP') &&
          (!hideDone || !item.done)
      )
      .filter(
        (item) =>
          !query ||
          `${item.headline} ${item.site} ${item.summary} ${item.angle} ${item.keywords.primary} ${item.keywords.secondary.join(' ')}`
            .toLowerCase()
            .includes(query)
      )
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt) || a.priority - b.priority)
  }, [items, site, category, urgentOnly, hideDone, search])

  const selected = filtered.find((item) => item.id === selectedId) || filtered[0]

  const stats = useMemo(
    () => ({
      ideas: items.length,
      sites: sites.length,
      urgent: items.filter((item) => item.importance === 'HURRYUP').length,
      done: items.filter((item) => item.done).length,
      docsReady: items.filter((item) => Boolean(item.notesId)).length,
    }),
    [items, sites]
  )

  const select = (id) => {
    setSelectedId(id)
    if (!desktop) setMobileOpen(true)
  }

  // Keyboard navigation through list on desktop
  useEffect(() => {
    if (!desktop) return undefined
    const onKey = (event) => {
      if (event.target.closest('input, textarea') || !filtered.length) return
      const step =
        event.key === 'ArrowDown' || event.key === 'j'
          ? 1
          : event.key === 'ArrowUp' || event.key === 'k'
          ? -1
          : 0
      if (!step) return
      event.preventDefault()
      const index = Math.max(0, filtered.findIndex((item) => item.id === selected?.id))
      const next = filtered[Math.min(filtered.length - 1, Math.max(0, index + step))]
      setSelectedId(next.id)
      document
        .getElementById(`idea-${next.id}`)
        ?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desktop, filtered, selected?.id])

  useEffect(() => {
    if (isLoading || !root.current) return undefined
    const ctx = gsap.context(() => {
      if (reduceMotion()) return
      gsap.fromTo(
        '[data-hero-word]',
        { yPercent: 110 },
        { yPercent: 0, duration: 1.05, stagger: 0.08, ease: 'expo.out' }
      )
      gsap.fromTo(
        '[data-hero-fade]',
        { y: 16, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.75, stagger: 0.07, delay: 0.3, ease: 'power3.out' }
      )
      gsap.utils.toArray('[data-count]').forEach((node) => {
        const counter = { value: 0 }
        gsap.to(counter, {
          value: Number(node.dataset.count) || 0,
          duration: 1.3,
          delay: 0.35,
          ease: 'power3.out',
          onUpdate: () => {
            node.textContent = Math.round(counter.value)
          },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [isLoading])

  useEffect(() => {
    if (isLoading || !root.current || reduceMotion()) return undefined
    const ctx = gsap.context(() => {
      gsap.set('[data-idea]', { y: 40, autoAlpha: 0 })
      ScrollTrigger.batch('[data-idea]', {
        start: 'top 94%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            y: 0,
            autoAlpha: 1,
            duration: 0.7,
            stagger: 0.06,
            ease: 'power3.out',
            overwrite: true,
          }),
      })
    }, root)
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [isLoading, filtered])

  return (
    <Shell>
      <main ref={root} className="mx-auto w-full max-w-[1560px] px-4 pb-28 pt-8 sm:px-6 md:pt-10">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p
              data-hero-fade
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[var(--muted)]"
            >
              <Newspaper size={15} weight="duotone" />
              Site content
            </p>
            <h1 className="mt-4 text-[clamp(2.7rem,6.2vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
              <span className="block overflow-hidden pb-1">
                <span data-hero-word className="inline-block">Stories&nbsp;</span>
                <span data-hero-word className="inline-block">your&nbsp;</span>
                <span data-hero-word className="inline-block">sites</span>
              </span>
              <span className="block overflow-hidden pb-2">
                <span data-hero-word className="inline-block font-serif font-medium italic">
                  should publish.
                </span>
              </span>
            </h1>
            <p data-hero-fade className="mt-5 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Fresh, sourced content ideas for every site, with the angle, keywords and AI document generator to build each post.
            </p>
          </div>
          <dl
            data-hero-fade
            className="grid grid-cols-4 gap-px overflow-hidden rounded-[1.4rem] bg-[var(--line)]/70 ring-1 ring-[var(--line)]/70"
          >
            {[
              ['Ideas', stats.ideas],
              ['Sites', stats.sites],
              ['Hurry up', stats.urgent],
              ['Docs Ready', stats.docsReady],
            ].map(([label, value]) => (
              <div key={label} className="bg-[var(--surface)] px-4 py-3.5 sm:px-5">
                <dt className="text-[9px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">
                  {label}
                </dt>
                <dd
                  data-count={value}
                  className="mt-1.5 text-2xl font-semibold tabular-nums tracking-[-.05em]"
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </header>

        {sites.length > 0 && (
          <HScroll data-hero-fade className="mt-9" innerClassName="gap-2 py-1" fade="var(--paper)" label="sites">
            <SiteTab active={site === 'All'} onClick={() => setSite('All')} label="All sites" count={items.length} />
            {sites.map(([name, count]) => (
              <SiteTab
                key={name}
                active={site === name}
                onClick={() => setSite(name)}
                label={name}
                count={count}
                mark={<SiteMark site={name} size="size-7" />}
              />
            ))}
          </HScroll>
        )}

        <div className={`${stickyBand} mt-4`}>
          <div className="flex flex-col gap-2 rounded-[1.6rem] bg-[var(--surface)] p-2 ring-1 ring-[var(--line)]/70 shadow-[0_18px_50px_rgba(30,32,25,.08)] lg:flex-row lg:items-center">
            <HScroll className="flex-1" innerClassName="gap-1" label="categories">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold transition-all duration-300 ${
                    category === item
                      ? 'bg-[var(--lime)] !text-[#26320b] shadow-sm'
                      : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </HScroll>
            <div className="flex flex-wrap items-center gap-2">
              <Toggle active={urgentOnly} onClick={() => setUrgentOnly((value) => !value)} icon={Fire}>
                Hurry up
              </Toggle>
              <Toggle active={hideDone} onClick={() => setHideDone((value) => !value)} icon={CheckCircle}>
                Hide done
              </Toggle>
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-3.5 py-2 lg:w-52 lg:flex-none">
                <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search ideas"
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10"
                  >
                    <X size={11} weight="bold" />
                  </button>
                )}
              </label>
              <button
                type="button"
                onClick={() => refetch()}
                aria-label="Refresh ideas"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"
              >
                <ArrowsClockwise size={15} className={isFetching ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <LogoLoader className="min-h-[40dvh]" label="Loading site content" />
        ) : isError ? (
          <section className="py-24 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--bad-bg)] text-[var(--bad)]">
              <Newspaper size={22} />
            </span>
            <h3 className="mt-5 text-xl font-semibold">Could not load site content</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p>
            <button type="button" onClick={() => refetch()} className={`${primaryButton} mt-6`}>
              Try again
            </button>
          </section>
        ) : filtered.length ? (
          /* DECREASED LEFT SIDEBAR: ~32% left, ~68% right, making right panel cleanly visible, spacious & wide */
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(310px,0.72fr)_minmax(0,1.28fr)] xl:grid-cols-[minmax(330px,0.68fr)_minmax(0,1.32fr)]">
            <ol className="space-y-3">
              {filtered.map((item) => (
                <li key={item.id} id={`idea-${item.id}`} data-idea className="scroll-mt-[calc(var(--shell-h)+6rem)]">
                  <IdeaCard
                    item={item}
                    selected={desktop && selected?.id === item.id}
                    onSelect={() => select(item.id)}
                  />
                </li>
              ))}
            </ol>
            {desktop && selected && (
              <div className="sticky top-[calc(var(--shell-h)+5.5rem)] self-start">
                <IdeaDetail
                  key={selected.id}
                  item={selected}
                  onDocUpdated={() => queryClient.invalidateQueries({ queryKey: ['site-content'] })}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="py-24 text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--line)]">
              <Newspaper size={22} />
            </span>
            <h3 className="mt-5 text-xl font-semibold">No ideas match</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Try another site, category or search phrase.</p>
          </div>
        )}

        {!desktop && mobileOpen && selected && (
          <Modal wide onClose={() => setMobileOpen(false)}>
            <IdeaDetail
              item={selected}
              onClose={() => setMobileOpen(false)}
              onDocUpdated={() => queryClient.invalidateQueries({ queryKey: ['site-content'] })}
              bare
            />
          </Modal>
        )}
      </main>
    </Shell>
  )
}

function SiteTab({ active, onClick, label, count, mark }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-2.5 rounded-2xl py-2 pl-2 pr-4 text-left ring-1 transition-all duration-300 ${
        active
          ? 'bg-[var(--ink)] text-white ring-[var(--ink)]'
          : 'bg-[var(--surface)] ring-[var(--line)]/70 hover:-translate-y-0.5 hover:ring-[var(--lime-dark)]'
      }`}
    >
      {mark || (
        <span
          className={`grid size-7 place-items-center rounded-xl ${
            active ? 'bg-white/15' : 'bg-[var(--paper)]'
          }`}
        >
          <Globe size={14} weight="bold" />
        </span>
      )}
      <span className="text-xs font-bold">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
          active ? 'bg-white/15' : 'bg-[var(--paper)] text-[var(--muted)]'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function Toggle({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold transition-all ${
        active ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'
      }`}
    >
      <Icon size={13} weight={active ? 'fill' : 'bold'} />
      {children}
    </button>
  )
}

function IdeaCard({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative w-full overflow-hidden rounded-[1.4rem] p-1 text-left transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${
        selected
          ? 'bg-[var(--new-border)] shadow-[0_14px_42px_var(--new-shadow)]'
          : 'bg-[var(--frame)] ring-1 ring-[var(--line)]/60 hover:-translate-y-0.5'
      }`}
    >
      <span className="block rounded-[calc(1.4rem-.25rem)] bg-[var(--surface)] p-4 sm:p-4.5">
        <span className="flex items-center gap-2.5">
          <SiteMark site={item.site} size="size-8" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-bold text-[var(--ink)]">{item.site}</span>
            <span className="mt-0.5 block truncate text-[10px] text-[var(--muted)]">
              {item.category} · {item.posted}
            </span>
          </span>
          {item.notesId ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--ok-bg)] px-2 py-0.5 text-[9px] font-bold text-[var(--ok)] ring-1 ring-[var(--ok)]/25"
              title="Document available"
            >
              <FileDoc size={10} weight="fill" />
              <span>Doc</span>
            </span>
          ) : null}
          {item.importance === 'HURRYUP' && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--bad-bg)] px-2 py-0.5 text-[9px] font-bold text-[var(--bad)]">
              <Fire size={10} weight="fill" />
              <span>Hurry</span>
            </span>
          )}
          {item.done && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--ok-bg)] px-2 py-0.5 text-[9px] font-bold text-[var(--ok)]">
              <Check size={10} weight="bold" />
              <span>Done</span>
            </span>
          )}
        </span>

        <span className="mt-3 block text-sm font-semibold leading-[1.3] tracking-[-.02em] transition-colors group-hover:text-[var(--accent-strong)] line-clamp-2">
          {item.headline}
        </span>

        {item.summary && (
          <span className="mt-1.5 line-clamp-2 block text-[11px] leading-4 text-[var(--muted)]">
            {item.summary}
          </span>
        )}

        <span className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-[var(--ink)] px-2 py-0.5 text-[9px] font-bold text-white">
            P{item.priority}
          </span>
          {item.partyType && (
            <span className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[9px] font-semibold text-[var(--muted)]">
              {item.partyType.replace(/([a-z])([A-Z])/g, '$1 $2')}
            </span>
          )}
          {item.keywords.primary && (
            <span className="max-w-[11rem] truncate rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[9px] font-semibold text-[var(--accent-strong)]">
              {item.keywords.primary}
            </span>
          )}
        </span>
      </span>
      {selected && (
        <span className="absolute right-4 top-1/2 hidden h-10 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)] lg:block" />
      )}
    </button>
  )
}

function IdeaDetail({ item, onClose, onDocUpdated, bare = false }) {
  const panel = useRef(null)
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState('')
  const [activeNoteId, setActiveNoteId] = useState(item.notesId || '')
  const [isTriggering, setIsTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState('')

  // Keep state in sync with selected item
  useEffect(() => {
    setActiveNoteId(item.notesId || '')
    setIsTriggering(false)
    setTriggerError('')
  }, [item.id, item.notesId])

  // Real-time backend note tracking via smart gateway with 10-minute window and generous timeout
  const {
    data: note,
    isFetching: isNoteFetching,
    refetch: refetchNote,
  } = useQuery({
    queryKey: ['site-content-note', activeNoteId],
    queryFn: async () => {
      try {
        const res = await api.getNote(activeNoteId, { timeout: 600_000 })
        return res
      } catch (err) {
        console.warn('Note polling check had a momentary delay/timeout, keeping previous data:', err)
        // Keep existing note data so polling continues without aborting
        return queryClient.getQueryData(['site-content-note', activeNoteId]) || null
      }
    },
    enabled: Boolean(activeNoteId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      // Poll every 7s while queued or processing (keeps polling for 10+ minutes gently)
      return status === 'queued' || status === 'processing' || isTriggering ? 7000 : false
    },
    refetchIntervalInBackground: true, // keeps polling active even if user switches browser tab or window
    retry: Infinity, // never stop polling/retrying during the 8-10 minute generation process
    retryDelay: 4000,
    placeholderData: (prev) => prev,
  })

  // When note generation finishes, notify parent to refresh item list badges
  useEffect(() => {
    if (note?.status === 'completed' && isTriggering) {
      setIsTriggering(false)
      onDocUpdated?.()
    }
  }, [note?.status, isTriggering, onDocUpdated])

  // Generate / Regenerate handler:
  // Calls entryPoint=TechContentDocx&id=${item.id} using the specific content module ID!
  const handleGenerateDoc = async (isRegen = false) => {
    try {
      setIsTriggering(true)
      setTriggerError('')
      const res = await api.generateTechContentDoc(item.id)
      if (res?.note_id) {
        setActiveNoteId(res.note_id)
        queryClient.invalidateQueries({ queryKey: ['site-content-note', res.note_id] })
        onDocUpdated?.()
      }
    } catch (err) {
      setIsTriggering(false)
      setTriggerError(err?.message || 'Failed to start document generation')
    }
  }

  const copy = async (key, text) => {
    await navigator.clipboard?.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1600)
  }

  useEffect(() => {
    if (!panel.current || reduceMotion()) return undefined
    const ctx = gsap.context(
      () =>
        gsap.fromTo(
          '[data-detail-part]',
          { y: 18, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.05, ease: 'power3.out' }
        ),
      panel
    )
    return () => ctx.revert()
  }, [])

  const keywordText = [item.keywords.primary, ...item.keywords.secondary].filter(Boolean).join(', ')

  const body = (
    <div
      ref={panel}
      className={bare ? '' : 'max-h-[calc(100dvh-13rem)] overflow-y-auto overscroll-contain p-6 sm:p-7'}
    >
      {/* Top Header */}
      <div data-detail-part className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <SiteMark site={item.site} size="size-10" />
          <div>
            <p className="text-sm font-bold text-[var(--ink)]">{item.site}</p>
            <p className="text-[11px] text-[var(--muted)]">
              {item.category} · Item {item.itemNumber ?? '–'} · {item.posted}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Main Headline */}
      <h2
        data-detail-part
        className="mt-5 text-[1.65rem] sm:text-2xl lg:text-[1.85rem] font-semibold leading-[1.2] tracking-[-.035em] [text-wrap:balance]"
      >
        {item.headline}
      </h2>

      {/* Quick Action Pills Row */}
      <div data-detail-part className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => copy('headline', item.headline)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm hover:brightness-110 active:scale-95 transition-all"
        >
          {copied === 'headline' ? <Check size={12} weight="bold" /> : <Copy size={12} />}
          {copied === 'headline' ? 'Copied' : 'Copy headline'}
        </button>

        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="upwork-view-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold"
          >
            <span>Source</span>
            <ArrowSquareOut size={12} />
          </a>
        )}

        {item.publishedUrl && (
          <a
            href={item.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="upwork-apply-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold"
          >
            <span className="relative z-10">View published</span>
            <ArrowSquareOut size={12} className="relative z-10" />
          </a>
        )}
      </div>

      {/* SMART GATEWAY DOCUMENT INTEGRATION SECTION (THEME MATCHED & ANIMATED) */}
      <div data-detail-part className="mt-5">
        <DocSection
          item={item}
          note={note}
          activeNoteId={activeNoteId}
          isTriggering={isTriggering}
          triggerError={triggerError}
          onGenerateDoc={() => handleGenerateDoc(false)}
          onRegenerateDoc={() => handleGenerateDoc(true)}
          onRefresh={() => refetchNote()}
        />
      </div>

      {/* Summary */}
      {item.summary && (
        <p data-detail-part className="mt-6 text-[15px] leading-7 text-[var(--ink)]">
          {item.summary}
        </p>
      )}

      {/* Content Angle */}
      {item.angle && (
        <div
          data-detail-part
          className="mt-5 flex gap-3 rounded-2xl bg-[var(--lime)]/20 p-4 ring-1 ring-[var(--lime-dark)]/20"
        >
          <Quotes size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--accent-strong)]">
              Content angle
            </p>
            <p className="mt-1.5 text-sm font-medium leading-6">{item.angle}</p>
          </div>
        </div>
      )}

      {/* Target Keywords */}
      {keywordText && (
        <section data-detail-part className="mt-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
              <Key size={12} weight="bold" />
              Keywords
            </p>
            <button
              type="button"
              onClick={() => copy('keywords', keywordText)}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {copied === 'keywords' ? <Check size={12} weight="bold" /> : <Copy size={12} />}
              {copied === 'keywords' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {item.keywords.primary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1.5 text-[11px] font-semibold text-white">
                <Target size={11} weight="bold" />
                {item.keywords.primary}
              </span>
            )}
            {item.keywords.secondary.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-[var(--paper)] px-3 py-1.5 text-[11px] font-medium text-[var(--muted)]"
              >
                {keyword}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Outline Brief */}
      {item.brief.length > 0 && (
        <section data-detail-part className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Brief</p>
          <dl className="mt-3 divide-y divide-[var(--line)]/70 rounded-2xl bg-[var(--paper)] px-4">
            {item.brief.map((section, index) => (
              <div
                key={`${section.label}-${index}`}
                className="grid gap-1 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-3"
              >
                <dt className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
                  {section.label || 'Note'}
                </dt>
                <dd className="text-xs leading-5 text-[var(--ink)]">{section.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Grounding References */}
      {(item.references.length > 0 || item.source) && (
        <section data-detail-part className="mt-6">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
            <LinkSimple size={12} weight="bold" />
            References
          </p>
          {item.source && (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {item.source}
              {item.sourceNote && ` · ${item.sourceNote}`}
            </p>
          )}
          <ul className="mt-3 grid gap-1.5">
            {item.references.map((link, index) => (
              <li key={link}>
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--paper)]"
                >
                  <span className="font-mono text-[10px] font-bold text-[var(--muted)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{hostname(link)}</span>
                    <span className="block truncate text-[10px] text-[var(--muted)]">{link}</span>
                  </span>
                  <ArrowSquareOut
                    size={13}
                    className="shrink-0 text-[var(--muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )

  if (bare) return body
  return (
    <div className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70 shadow-[0_20px_50px_rgba(0,0,0,.06)]">
      <div className="overflow-hidden rounded-[calc(2rem-.375rem)] bg-[var(--surface)]">{body}</div>
    </div>
  )
}

function DocSection({
  item,
  note,
  activeNoteId,
  isTriggering,
  triggerError,
  onGenerateDoc,
  onRegenerateDoc,
  onRefresh,
}) {
  const isQueued = !isTriggering && note?.status === 'queued'
  const isProcessing =
    isTriggering ||
    note?.status === 'processing' ||
    (isQueued && !note?.filename)

  const isCompleted = note?.status === 'completed'
  const isFailed = note?.status === 'failed'

  // CASE 1: QUEUED OR PROCESSING -> Animated pipeline stages with theme colors
  if (isTriggering || note?.status === 'queued' || note?.status === 'processing') {
    return (
      <DocProcessingStages
        status={note?.status || (isTriggering ? 'queued' : 'processing')}
        onRefresh={onRefresh}
      />
    )
  }

  // CASE 2: COMPLETED -> 3 requested actions: View Doc, Download Doc, Regenerate Doc
  if (isCompleted) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-4 sm:p-5 ring-1 ring-[var(--line)] shadow-sm transition-all hover:ring-[var(--lime-dark)]/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--ok-bg)] text-[var(--ok)] ring-1 ring-[var(--ok)]/30">
              <FileDoc size={24} weight="duotone" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--lime)] px-2 py-0.5 text-[9px] font-bold text-[#26320b] uppercase tracking-wider">
                  DOCX
                </span>
                <span className="text-[10px] text-[var(--muted)]">
                  {note.dateModified || note.dateEntered || 'Document Ready'}
                </span>
              </div>
              <p
                className="mt-1 truncate text-xs sm:text-sm font-bold text-[var(--ink)]"
                title={note.filename}
              >
                {note.filename || `${item.headline.slice(0, 48)}.docx`}
              </p>
            </div>
          </div>

          {/* THREE REQUESTED ACTIONS: 1. View Doc, 2. Download Doc, 3. Regenerate Doc */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* 1. View Doc */}
            <a
              href={note.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="upwork-view-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[var(--ink)] active:scale-95 transition-all"
              title="Open document viewer in new tab"
            >
              <Eye size={14} weight="bold" />
              <span>View doc</span>
            </a>

            {/* 2. Download Doc */}
            <a
              href={note.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={note.filename || true}
              className="upwork-apply-button inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold active:scale-95 transition-all"
              title="Download Microsoft Word .docx"
            >
              <DownloadSimple size={14} weight="bold" />
              <span>Download</span>
            </a>

            {/* 3. Regenerate Doc (Passes item.id to TechContentDocx&id=${item.id}) */}
            <button
              type="button"
              onClick={onRegenerateDoc}
              className="upwork-view-button inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] active:scale-95 transition-all"
              title="Regenerate this document with AI"
            >
              <ArrowsClockwise size={14} weight="bold" className={isTriggering ? 'animate-spin' : ''} />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // CASE 3: FAILED STATUS -> Animated error card with Retry / Regenerate option
  if (isFailed) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-[var(--bad-bg)]/40 p-4 sm:p-5 ring-1 ring-[var(--bad)]/35 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bad-bg)] text-[var(--bad)] ring-1 ring-[var(--bad)]/30 animate-pulse">
              <WarningCircle size={22} weight="fill" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-[var(--bad)]">
                  Document Generation Failed
                </h4>
                <span className="rounded-full bg-[var(--bad)]/15 px-2 py-0.5 text-[9px] font-bold text-[var(--bad)]">
                  Failed
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                The AI document process timed out or encountered an issue. Click below to regenerate.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRegenerateDoc}
            className="upwork-apply-button inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-sm active:scale-95 transition-all"
          >
            <ArrowsClockwise size={14} weight="bold" />
            <span>Regenerate doc</span>
          </button>
        </div>
      </div>
    )
  }

  // CASE 4: NOTE ID IS NOT PRESENT -> Option to generate doc
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper)]/50 p-4 sm:p-5 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--line)] shadow-sm">
            <FileDoc size={22} weight="duotone" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-[var(--ink)]">Technical Content Document</h4>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              No document generated yet for this idea. Click Generate doc to synthesize research and build a DOCX file.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGenerateDoc}
          className="upwork-apply-button inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-sm active:scale-95 transition-all"
        >
          <Sparkle size={14} weight="fill" />
          <span>Generate doc</span>
        </button>
      </div>
      {triggerError && (
        <p className="mt-2 text-xs font-medium text-[var(--bad)]">{triggerError}</p>
      )}
    </div>
  )
}

function DocProcessingStages({ status, onRefresh }) {
  const STAGES = [
    {
      title: 'Audience & Angle Analysis',
      desc: 'Target audience, search intent & keywords',
      icon: Target,
    },
    {
      title: 'Synthesizing Source References',
      desc: 'Grounding citations & competitor benchmarks',
      icon: LinkSimple,
    },
    {
      title: 'Drafting Comprehensive Article',
      desc: 'Synthesizing technical article with AI',
      icon: Quotes,
    },
    {
      title: 'Compiling DOCX Document',
      desc: 'Formatting styles, tables, headings & packaging',
      icon: FileDoc,
    },
  ]

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const elapsedTimer = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(elapsedTimer)
  }, [])

  // Paced for an 8–10 minute generation timeline (600 seconds total)
  const activeStage = useMemo(() => {
    if (status === 'queued' || elapsed < 90) return 0 // Stage 1: Audience & Angle (0 - 1.5 min)
    if (elapsed < 240) return 1 // Stage 2: Sourcing References (1.5 - 4.0 min)
    if (elapsed < 480) return 2 // Stage 3: Deep Technical Drafting (4.0 - 8.0 min)
    return 3 // Stage 4: Compiling DOCX (8.0 - 10.0 min)
  }, [status, elapsed])

  // Progress rises smoothly from 8% up to ~94% over 10 minutes (600s)
  const percent = Math.min(94, Math.max(8, Math.round(8 + (elapsed / 600) * 86)))

  const formatElapsed = (s) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs} (~8-10m)`
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--surface)] p-4 sm:p-5 ring-1 ring-[var(--line)] shadow-sm">
      {/* Background ambient shimmer matching theme */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[var(--lime)]/5 to-transparent animate-pulse" />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)]/60 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="relative grid size-10 place-items-center rounded-xl bg-[var(--lime)]/25 text-[#26320b] dark:text-[#c0df78] ring-1 ring-[var(--lime-dark)]/30">
            <Sparkle size={19} weight="fill" className="animate-spin text-[var(--lime-dark)]" />
            <span className="absolute -top-1 -right-1 flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lime)] opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[var(--lime-dark)]" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-[var(--ink)]">
                {status === 'queued' ? 'Queued for Document Generation' : 'Generating Technical Document'}
              </h4>
              <span className="rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[10px] font-bold text-[#26320b] dark:text-[#c0df78]">
                {status === 'queued' ? 'Queued' : 'Processing'}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              {status === 'queued'
                ? 'Registered in pipeline. Processing starts shortly...'
                : 'AI deep-research drafting & packaging Word DOCX file (takes ~8–10 mins)'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          title="Click to check status immediately"
          className="flex items-center gap-2 font-mono text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)] bg-[var(--paper)] hover:bg-[var(--frame)] px-2.5 py-1 rounded-full ring-1 ring-[var(--line)] transition-all cursor-pointer active:scale-95"
        >
          <ArrowsClockwise size={13} className="animate-spin text-[var(--lime-dark)]" />
          <span>{formatElapsed(elapsed)}</span>
        </button>
      </div>

      {/* Progress bar */}
      <div className="relative mt-3.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--paper)] ring-1 ring-[var(--line)]/40">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--lime)] to-[var(--lime-dark)] transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Stages Stepper List */}
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
        {STAGES.map((step, idx) => {
          const isDone = idx < activeStage
          const isCurrent = idx === activeStage

          return (
            <div
              key={step.title}
              className={`flex items-start gap-2.5 rounded-xl p-2.5 transition-all ${
                isCurrent
                  ? 'bg-[var(--lime)]/15 ring-1 ring-[var(--lime-dark)]/35'
                  : isDone
                  ? 'bg-[var(--ok-bg)]/40'
                  : 'opacity-55'
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle size={15} weight="fill" className="text-[var(--ok)]" />
                ) : isCurrent ? (
                  <Sparkle size={15} weight="fill" className="animate-spin text-[var(--lime-dark)]" />
                ) : (
                  <Circle size={15} className="text-[var(--muted)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[11px] font-bold leading-tight ${
                    isCurrent ? 'text-[var(--ink)]' : 'text-[var(--muted)]'
                  }`}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">{step.desc}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Helpful 8-10 minute background notice */}
      <div className="relative mt-3.5 flex flex-wrap items-center justify-between gap-1 border-t border-[var(--line)]/50 pt-2.5 text-[10px] text-[var(--muted)]">
        <span>Full technical document compilation takes 8–10 minutes.</span>
        <span>You can switch tabs or explore other ideas; polling runs in the background.</span>
      </div>
    </div>
  )
}
