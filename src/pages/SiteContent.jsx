import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowSquareOut,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Circle,
  ClockCounterClockwise,
  Copy,
  DownloadSimple,
  Eye,
  FileDoc,
  Fire,
  GearSix,
  Globe,
  Key,
  LinkSimple,
  MagnifyingGlass,
  MicrosoftTeamsLogo,
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
import CategoryFilterDialog from '../components/CategoryFilterDialog'
import { ShareDialog } from '../components/ShareJobDialog'
import { api, getDocumentViewUrl, resolveCrmUser } from '../services/api'
import {
  subscribeDocStatus,
  getCachedDocStatus,
  getDocStartTime,
  recordDocStartTime,
  resetDocStartTime,
  saveDocInProgress,
  getDocInProgress,
  clearDocInProgress,
} from '../services/docSocket'
import { recordDocNotification } from '../services/docNotifications'
import { useAuth } from '../contexts/AuthContext'
import { forgetSearch, loadRecentSearches, rememberSearch } from '../lib/jobSignals'
import { asArray, asText } from '../lib/safe'

gsap.registerPlugin(ScrollTrigger)

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A link that opens this idea in Site Content (read back through ?item=).
const ideaLink = (item) => `${window.location.origin}/site-content?item=${encodeURIComponent(item.id)}`

// Starting message for sharing an idea in Teams; the document link is added once one exists.
const ideaShareMessage = (item, noteId) => [
  `Content idea for ${item.site}: ${item.headline}`,
  [item.category, item.importance === 'HURRYUP' && 'Urgent', item.done && 'Done'].filter(Boolean).join(' · '),
  item.keywords?.primary && `Primary keyword: ${item.keywords.primary}`,
  noteId && `Document: ${getDocumentViewUrl(noteId)}`,
  item.publishedUrl && `Published: ${item.publishedUrl}`,
  ideaLink(item),
].filter(Boolean).join('\n')

// WordPress login of the sites, where a ready document is published. Override with VITE_PUBLISH_SITE_URL.
const PUBLISH_SITE_URL = import.meta.env?.VITE_PUBLISH_SITE_URL || 'https://sites.outrightcrm.in/wp-login.php?4dx-one'

// "Login URL" pill: hovering stretches it to show the address, clicking opens it, the icon copies it.
function LoginUrlPill() {
  const [copied, setCopied] = useState(false)
  const shownUrl = PUBLISH_SITE_URL.replace(/^https?:\/\//, '')
  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(PUBLISH_SITE_URL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('Copy the login URL', PUBLISH_SITE_URL)
    }
  }
  return (
    <div className="group/login flex min-w-0 items-center rounded-full bg-[var(--paper)] ring-1 ring-[var(--line)] transition-shadow duration-300 hover:ring-[var(--lime-dark)] focus-within:ring-[var(--lime-dark)]">
      <a
        href={PUBLISH_SITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title={`Open ${PUBLISH_SITE_URL}`}
        className="flex min-w-0 items-center gap-1.5 py-1.5 pl-3 pr-1.5 text-[11px] font-bold text-[var(--ink)]"
      >
        <Key size={13} weight="bold" className="shrink-0 text-[var(--accent-strong)]" />
        <span className="shrink-0">Login URL</span>
        <span className="inline-block max-w-0 truncate font-mono text-[10px] font-medium text-[var(--muted)] opacity-0 transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover/login:max-w-[16rem] group-hover/login:opacity-100 group-focus-within/login:max-w-[16rem] group-focus-within/login:opacity-100">
          {shownUrl}
        </span>
        <ArrowSquareOut size={12} className="shrink-0 text-[var(--muted)]" />
      </a>
      <button
        type="button"
        onClick={copyUrl}
        aria-label={copied ? 'Login URL copied' : 'Copy login URL'}
        title={copied ? 'Copied' : 'Copy login URL'}
        className="mr-1 grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)]"
      >
        {copied ? <Check size={12} weight="bold" className="text-[var(--accent-strong)]" /> : <Copy size={12} />}
      </button>
    </div>
  )
}
const SITE_TONES = ['#c8e875', '#cbc6ef', '#f6c9a8', '#b8e0d2', '#f2d27a', '#a9c8f0', '#f0b5c4']

function siteTone(site) {
  const hash = [...asText(site)].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return SITE_TONES[hash % SITE_TONES.length]
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
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
      {asText(site).replace(/^www\./, '').slice(0, 2)}
    </span>
  )
}

export default function SiteContent() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const {
    data: itemsData,
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
  const items = useMemo(() => asArray(itemsData), [itemsData])

  const [site, setSite] = useState('All')
  const [category, setCategory] = useState('All')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounced(searchInput.trim(), 400)
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches(user?.email, 'sitecontent'))
  const [searchFocused, setSearchFocused] = useState(false)
  // A shared link (?item=<id>) opens that idea; filters start at All, so it is in the list.
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(() => searchParams.get('item'))
  const [mobileOpen, setMobileOpen] = useState(() => Boolean(searchParams.get('item')))
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const desktop = useDesktop()
  const root = useRef(null)

  useEffect(() => {
    setRecentSearches(loadRecentSearches(user?.email, 'sitecontent'))
  }, [user?.email])

  const commitSearch = (value = searchInput) =>
    setRecentSearches(rememberSearch(user?.email, value, 'sitecontent'))

  const applySearch = (value) => {
    setSearchInput(value)
    commitSearch(value)
    setSearchFocused(false)
  }

  const historyTerm = searchInput.trim().toLowerCase()
  const searchHistory = recentSearches.filter(
    (term) =>
      !historyTerm ||
      (asText(term).toLowerCase().includes(historyTerm) && asText(term).toLowerCase() !== historyTerm)
  )

  const searching = isFetching || (searchInput.trim() !== debouncedSearch)

  const hasFilters = Boolean(
    site !== 'All' ||
    category !== 'All' ||
    urgentOnly ||
    hideDone ||
    searchInput.trim()
  )

  const sites = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => counts.set(item.site, (counts.get(item.site) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const categories = useMemo(
    () => ['All', ...new Set(items.map((item) => item.category).filter(Boolean))],
    [items]
  )

  const categoryCounts = useMemo(() => {
    const counts = { All: items.length }
    items.forEach((item) => {
      if (item.category) {
        counts[item.category] = (counts[item.category] || 0) + 1
      }
    })
    return counts
  }, [items])

  useEffect(() => {
    if (category && category !== 'All') {
      const el = document.getElementById(`cat-chip-${category}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [category])

  const filtered = useMemo(() => {
    const query = debouncedSearch.toLowerCase()
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
          `${item.headline} ${item.site} ${item.summary} ${item.angle} ${item.keywords?.primary} ${asArray(item.keywords?.secondary).join(' ')}`
            .toLowerCase()
            .includes(query)
      )
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt) || a.priority - b.priority)
  }, [items, site, category, urgentOnly, hideDone, debouncedSearch])

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
      <main ref={root} className="mx-auto w-full max-w-[1560px] px-4 pb-28 pt-6 sm:px-6 md:pt-8">
        <header className="flex justify-end">
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
          <HScroll data-hero-fade className="mt-6" innerClassName="gap-2 py-1" fade="var(--paper)" label="sites">
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
          <div className="flex flex-col gap-2 rounded-[1.6rem] bg-[var(--surface)] p-2 ring-1 ring-[var(--line)]/70 shadow-[0_18px_50px_rgba(30,32,25,.08)]">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center justify-between">
              <div className="flex shrink-0 items-center gap-1.5">
                <HScroll
                  className="min-w-0 max-w-[19rem] sm:max-w-[22rem] md:max-w-[24rem]"
                  innerClassName="gap-1"
                  fade="var(--surface)"
                  label="categories"
                >
                  {categories.map((item) => (
                    <button
                      key={item}
                      id={`cat-chip-${item}`}
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
                <button
                  type="button"
                  onClick={() => setCategoryDialogOpen(true)}
                  aria-label="All content categories"
                  title="Browse all categories"
                  className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 hover:rotate-45 ${
                    category !== 'All'
                      ? 'bg-[var(--lime)] text-[#26320b] ring-2 ring-[var(--lime-dark)]/40 shadow-xs'
                      : 'text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'
                  }`}
                >
                  <GearSix size={16} weight="bold" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
                <Toggle active={urgentOnly} onClick={() => setUrgentOnly((value) => !value)} icon={Fire}>
                  Hurry up
                </Toggle>
                <Toggle active={hideDone} onClick={() => setHideDone((value) => !value)} icon={CheckCircle}>
                  Hide done
                </Toggle>

                {/* Search Bar matching Jobs & Tech News */}
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    commitSearch()
                    setSearchFocused(false)
                  }}
                  className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-4 py-2 ring-1 ring-transparent transition-shadow focus-within:ring-[var(--lime-dark)] sm:w-64 lg:w-72 lg:flex-none"
                >
                  {searching ? (
                    <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" />
                  ) : (
                    <MagnifyingGlass size={15} className="shrink-0 text-[var(--muted)]" />
                  )}
                  <input
                    value={searchInput}
                    onChange={(event) => {
                      setSearchInput(event.target.value)
                      setSearchFocused(true)
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => {
                      setSearchFocused(false)
                      if (searchInput.trim()) commitSearch()
                    }}
                    onKeyDown={(event) => event.key === 'Escape' && setSearchFocused(false)}
                    placeholder="Search ideas, site, angle, keywords…"
                    aria-label="Search site content"
                    aria-expanded={searchFocused && searchHistory.length > 0}
                    aria-controls="site-content-search-history"
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('')
                        setSearchFocused(false)
                      }}
                      aria-label="Clear search"
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 dark:bg-white/10"
                    >
                      <X size={11} weight="bold" />
                    </button>
                  )}
                  {searchFocused && searchHistory.length > 0 && (
                    <div
                      id="site-content-search-history"
                      onMouseDown={(event) => event.preventDefault()}
                      className="absolute inset-x-0 top-[calc(100%+.5rem)] z-50 rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5"
                    >
                      <div className="rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-2">
                        <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                          <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">
                            Recent searches
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              recentSearches.forEach((term) => forgetSearch(user?.email, term, 'sitecontent'))
                              setRecentSearches([])
                            }}
                            className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                          >
                            Clear history
                          </button>
                        </div>
                        <ul>
                          {searchHistory.map((term) => (
                            <li
                              key={term}
                              className="group/term flex items-center rounded-xl hover:bg-[var(--paper)]"
                            >
                              <button
                                type="button"
                                onClick={() => applySearch(term)}
                                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs font-semibold text-[var(--muted)] group-hover/term:text-[var(--ink)]"
                              >
                                <ClockCounterClockwise size={14} className="shrink-0" />
                                <span className="truncate">{term}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecentSearches(forgetSearch(user?.email, term, 'sitecontent'))}
                                aria-label={`Forget search ${term}`}
                                className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10 hover:text-[var(--ink)]"
                              >
                                <X size={11} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </form>

                <button
                  type="button"
                  onClick={() => refetch()}
                  aria-label="Refresh ideas"
                  title="Refresh content ideas"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] active:scale-95 transition-all"
                >
                  <ArrowsClockwise size={15} className={isFetching ? 'animate-spin text-[var(--lime-dark)]' : ''} />
                </button>
              </div>
            </div>

            {/* Active Filter Chips */}
            {hasFilters && (
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[.06] px-1 pt-2 dark:border-white/[.08]">
                {debouncedSearch && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
                    <span>"{debouncedSearch}"</span>
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      aria-label="Remove search filter"
                      className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
                {urgentOnly && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
                    <span>Hurry up</span>
                    <button
                      type="button"
                      onClick={() => setUrgentOnly(false)}
                      aria-label="Remove hurry up filter"
                      className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
                {hideDone && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
                    <span>Hide done</span>
                    <button
                      type="button"
                      onClick={() => setHideDone(false)}
                      aria-label="Remove hide done filter"
                      className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
                {site !== 'All' && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
                    <span>Site: {site}</span>
                    <button
                      type="button"
                      onClick={() => setSite('All')}
                      aria-label="Remove site filter"
                      className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
                {category !== 'All' && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
                    <span>Category: {category}</span>
                    <button
                      type="button"
                      onClick={() => setCategory('All')}
                      aria-label="Remove category filter"
                      className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"
                    >
                      <X size={11} />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    setUrgentOnly(false)
                    setHideDone(false)
                    setSite('All')
                    setCategory('All')
                  }}
                  className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
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

        {categoryDialogOpen && (
          <CategoryFilterDialog
            categories={categories}
            categoryCounts={categoryCounts}
            selectedCategory={category}
            onSelect={(cat) => setCategory(cat)}
            onClose={() => setCategoryDialogOpen(false)}
          />
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
              {asText(item.partyType).replace(/([a-z])([A-Z])/g, '$1 $2')}
            </span>
          )}
          {item.keywords?.primary && (
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
  const { user } = useAuth()
  const [copied, setCopied] = useState('')
  const [sharing, setSharing] = useState(false)
  const [activeNoteId, setActiveNoteId] = useState(item.notesId || '')
  const [isTriggering, setIsTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState('')
  const [justCompleted, setJustCompleted] = useState(false)
  const [liveSocketStatus, setLiveSocketStatus] = useState(() => {
    const cached = getCachedDocStatus(item.notesId, item.id)
    return cached?.status || null
  })
  const [liveUserName, setLiveUserName] = useState(() => {
    const cached = getCachedDocStatus(item.notesId, item.id)
    return cached?.userName || ''
  })
  const [liveNoteFields, setLiveNoteFields] = useState(null)

  // Keep state in sync with selected item
  useEffect(() => {
    const cached = getCachedDocStatus(item.notesId, item.id)
    const inProg = Boolean(cached?.status && ['queued', 'processing', 'compiling'].includes(cached.status))
    setActiveNoteId(item.notesId || cached?.noteId || '')
    setIsTriggering(inProg)
    setTriggerError('')
    setJustCompleted(false)
    setLiveSocketStatus(cached?.status || null)
    setLiveUserName(cached?.userName || '')
    if (cached?.filename || cached?.viewUrl || cached?.documentUrl) {
      setLiveNoteFields({
        filename: cached.filename,
        viewUrl: cached.viewUrl,
        documentUrl: cached.documentUrl,
      })
    } else {
      setLiveNoteFields(null)
    }
  }, [item.id, item.notesId])

  // Single on-demand note query via smart gateway (NO CONTINUOUS POLLING!)
  // Endpoint is queried once on initial load, or when websocket signals completion
  const {
    data: fetchedNote,
    refetch: refetchNote,
  } = useQuery({
    queryKey: ['site-content-note', activeNoteId],
    queryFn: async () => {
      if (!activeNoteId) return null
      return api.getNote(activeNoteId, { timeout: 60_000 })
    },
    enabled: Boolean(activeNoteId),
    refetchInterval: false, // ZERO POLLING: Driven purely via WebSocket events
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  })

  // Listen to WebSocket 'doc-status' events
  useEffect(() => {
    const unsubscribe = subscribeDocStatus((event) => {
      // Check if this event matches activeNoteId, item.notesId, or item.id
      const matches =
        (activeNoteId && event.noteId && event.noteId === activeNoteId) ||
        (item.notesId && event.noteId && event.noteId === item.notesId) ||
        (item.id && event.contentId && event.contentId === item.id)

      if (!matches) return

      console.log('[SiteContent] Matching doc-status from WebSocket:', event)

      if (event.noteId && (!activeNoteId || activeNoteId !== event.noteId)) {
        setActiveNoteId(event.noteId)
      }

      // Update the live status immediately in UI without hitting endpoint
      if (event.status) {
        setLiveSocketStatus(event.status)
      }

      if (event.userName) {
        setLiveUserName(event.userName)
      }

      if (event.filename || event.viewUrl || event.documentUrl) {
        setLiveNoteFields((prev) => ({
          ...prev,
          filename: event.filename || prev?.filename,
          viewUrl: event.viewUrl || prev?.viewUrl,
          documentUrl: event.documentUrl || prev?.documentUrl,
        }))
      }

      // STRICT RULE: Only hit the SuiteCRM endpoint when the status actually changes to completed or failed
      if (event.status === 'completed') {
        setIsTriggering(false)
        setJustCompleted(true)
        clearDocInProgress(item.id, event.noteId || activeNoteId)
        refetchNote()
        onDocUpdated?.()
        queryClient.invalidateQueries({ queryKey: ['site-content'] })
      } else if (event.status === 'failed') {
        setIsTriggering(false)
        clearDocInProgress(item.id, event.noteId || activeNoteId)
        refetchNote()
      }
    })

    return () => unsubscribe()
  }, [activeNoteId, item.id, item.notesId, refetchNote, onDocUpdated, queryClient])

  // Merged note representation (fetched details + live WebSocket updates)
  const note = useMemo(() => {
    if (!fetchedNote && !liveNoteFields && !liveSocketStatus) return null
    const base = fetchedNote || {}
    return {
      ...base,
      ...liveNoteFields,
      // Only who actually generated it (socket event or the note); never the signed-in user as a stand-in.
      userName: liveUserName || liveNoteFields?.userName || base?.userName || '',
      status: liveSocketStatus || liveNoteFields?.status || base?.status || '',
    }
  }, [fetchedNote, liveNoteFields, liveSocketStatus, liveUserName])

  // When note generation finishes, notify parent to refresh item list badges
  useEffect(() => {
    if (note?.status === 'completed' && isTriggering) {
      setIsTriggering(false)
      setJustCompleted(true)
      clearDocInProgress(item.id, activeNoteId)
      onDocUpdated?.()
    }
  }, [note?.status, isTriggering, onDocUpdated, item.id, activeNoteId])

  // Generate / Regenerate handler:
  // Calls entryPoint=TechContentDocx&id=${item.id} with userName and userId!
  const handleGenerateDoc = async (_isRegen = false) => {
    try {
      setIsTriggering(true)
      setTriggerError('')
      setLiveSocketStatus('queued')
      const now = Date.now()

      // Resolve CRM user identity to send to generation endpoint
      const resolved = await resolveCrmUser(user)
      const effectiveUserName = resolved?.userName || user?.name || user?.email?.split('@')[0] || 'User'
      const effectiveUserId = resolved?.userId || user?.crmUserId || user?.id || ''
      setLiveUserName(effectiveUserName)

      resetDocStartTime(item.id, activeNoteId, now)
      saveDocInProgress(item.id, {
        noteId: activeNoteId,
        status: 'queued',
        startTime: now,
        title: item.headline,
        userName: effectiveUserName,
      })
      recordDocNotification({
        mine: true,
        contentId: item.id,
        // A regenerate gets a new note; it is filled in when the endpoint (or the socket) returns it.
        noteId: '',
        status: 'queued',
        title: item.headline,
        userName: effectiveUserName,
        timestamp: now,
      })
      const res = await api.generateTechContentDoc(item.id, {
        userName: effectiveUserName,
        userId: effectiveUserId,
      })
      if (res?.note_id) {
        setActiveNoteId(res.note_id)
        recordDocStartTime(item.id, res.note_id, now)
        saveDocInProgress(item.id, {
          noteId: res.note_id,
          status: 'queued',
          startTime: now,
          title: item.headline,
          userName: effectiveUserName,
        })
        recordDocNotification({
          mine: true,
          contentId: item.id,
          noteId: res.note_id,
          status: 'queued',
          title: item.headline,
          userName: effectiveUserName,
          timestamp: now,
        })
        onDocUpdated?.()
      }
    } catch (err) {
      console.warn('Doc generation trigger notice:', err)
      // Even if direct fetch response had a CORS header restriction, the request reached
      // the server (HTTP 202 Accepted). Keep 'queued' state and let WebSocket update the UI!
      if (/failed to fetch|cors|network/i.test(err?.message || '')) {
        setLiveSocketStatus('queued')
        setTriggerError('')
      } else {
        setIsTriggering(false)
        setLiveSocketStatus(null)
        clearDocInProgress(item.id, activeNoteId)
        setTriggerError(err?.message || 'Failed to start document generation')
      }
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

  const keywordText = [item.keywords?.primary, ...asArray(item.keywords?.secondary)].filter(Boolean).join(', ')

  const body = (
    <div
      ref={panel}
      className={bare ? '' : 'max-h-[calc(100dvh-13rem)] overflow-y-auto overscroll-contain p-6 sm:p-7'}
    >
      {/* Top Header */}
      <div data-detail-part className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SiteMark site={item.site} size="size-10" />
          <div>
            <p className="text-sm font-bold text-[var(--ink)]">{item.site}</p>
            <p className="text-[11px] text-[var(--muted)]">
              {item.category} · Item {item.itemNumber ?? '–'} · {item.posted}
            </p>
          </div>
        </div>
        <div className="flex min-w-0 shrink items-center gap-2">
          <LoginUrlPill />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
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

        <button
          type="button"
          onClick={() => setSharing(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#4b53bc] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-sm hover:brightness-110 active:scale-95 transition-all"
        >
          <MicrosoftTeamsLogo size={13} weight="fill" />
          Share in Teams
        </button>
        {sharing && (
          <ShareDialog
            noun="content idea"
            eyebrow={item.site}
            title={item.headline}
            link={ideaLink(item)}
            text={ideaShareMessage(item, activeNoteId)}
            subject={`Content idea: ${item.headline}`}
            onClose={() => setSharing(false)}
          />
        )}

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
          userName={liveUserName || note?.userName}
          isTriggering={isTriggering}
          triggerError={triggerError}
          justCompleted={justCompleted}
          onDismissCompleted={() => setJustCompleted(false)}
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
            {item.keywords?.primary && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1.5 text-[11px] font-semibold text-white">
                <Target size={11} weight="bold" />
                {item.keywords.primary}
              </span>
            )}
            {asArray(item.keywords?.secondary).map((keyword) => (
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
      {asArray(item.brief).length > 0 && (
        <section data-detail-part className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Brief</p>
          <dl className="mt-3 divide-y divide-[var(--line)]/70 rounded-2xl bg-[var(--paper)] px-4">
            {asArray(item.brief).map((section, index) => (
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
      {(asArray(item.references).length > 0 || item.source) && (
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
            {asArray(item.references).map((link, index) => (
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
  userName,
  isTriggering,
  triggerError,
  justCompleted,
  onDismissCompleted,
  onGenerateDoc,
  onRegenerateDoc,
  onRefresh,
}) {
  const currentStatus = asText(note?.status || (isTriggering ? 'queued' : '')).toLowerCase()
  const isQueued = currentStatus === 'queued'
  const isProcessing = currentStatus === 'processing'
  const isCompiling = currentStatus === 'compiling' || currentStatus === 'compiliing'
  const isCompleted = currentStatus === 'completed'
  const isFailed = currentStatus === 'failed'

  const effectiveUserName = userName || note?.userName || ''

  const [isDownloading, setIsDownloading] = useState(false)

  // CASE 1: QUEUED, PROCESSING, OR COMPILING -> Live WebSocket animated pipeline stages
  if (isTriggering || isQueued || isProcessing || isCompiling) {
    return (
      <DocProcessingStages
        status={currentStatus || (isTriggering ? 'queued' : 'processing')}
        itemId={item.id}
        noteId={activeNoteId || note?.id || item.notesId}
        noteDateEntered={note?.dateEntered}
        userName={effectiveUserName}
        onRefresh={onRefresh}
      />
    )
  }

  // Direct Word Document Download Handler
  const handleDownload = async () => {
    const noteId = activeNoteId || note?.id || item.notesId
    const viewUrl = note?.viewUrl || getDocumentViewUrl(noteId)
    const rawFilename = asText(note?.filename) || `${asText(item.headline).slice(0, 48)}.doc`
    const downloadFilename = rawFilename.endsWith('.docx')
      ? rawFilename.replace(/\.docx$/, '.doc')
      : rawFilename.endsWith('.doc')
      ? rawFilename
      : `${rawFilename}.doc`

    setIsDownloading(true)
    try {
      // 1. Fetch the formatted document through proxy or direct viewdoc endpoint
      const fetchUrl = import.meta.env?.DEV
        ? `/crm-entrypoint/index.php?entryPoint=viewdoc&id=${encodeURIComponent(noteId)}`
        : viewUrl

      const res = await fetch(fetchUrl)
      if (res.ok) {
        const html = await res.text()
        const blob = new Blob([html], { type: 'application/msword;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = downloadFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setIsDownloading(false)
        return
      }
    } catch (e) {
      console.warn('Direct fetch download notice, falling back to viewer:', e)
    }

    // 2. Fallback: Open formatted document view directly in a new tab
    // (Never open entryPoint=download which requires SuiteCRM session auth and returns "Not a Valid Entry Point")
    setIsDownloading(false)
    window.open(viewUrl, '_blank')
  }

  // CASE 2: COMPLETED -> 3 requested actions: View Doc, Download Doc, Regenerate Doc
  if (isCompleted && (note?.viewUrl || note?.documentUrl || note?.filename || activeNoteId || item.notesId)) {
    const noteId = activeNoteId || note?.id || item.notesId
    const viewUrl = note?.viewUrl || getDocumentViewUrl(noteId)

    return (
      <div className="space-y-3">
        {/* Document Generation Complete Celebration Banner */}
        {justCompleted && (
          <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl bg-[var(--ok-bg)] p-3.5 sm:p-4 ring-1 ring-[var(--ok)]/35 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 min-w-0">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ok)] text-white shadow-sm">
                <CheckCircle size={20} weight="fill" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-[var(--ok)]">
                    🎉 Document Generated Successfully!
                  </h4>
                  <span className="rounded-full bg-[var(--ok)]/20 px-2 py-0.5 text-[9px] font-bold text-[var(--ok)] uppercase tracking-wider">
                    Ready
                  </span>
                </div>
                {effectiveUserName && (
                  <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">Generated by <span className="font-bold text-[var(--accent-strong)]">{effectiveUserName}</span></p>
                )}
                <p className="mt-0.5 truncate text-[11px] text-[var(--ink)]">
                  Your document has finished compiling. You can now view it online or download the Word file below.
                </p>
              </div>
            </div>
            {onDismissCompleted && (
              <button
                type="button"
                onClick={onDismissCompleted}
                aria-label="Dismiss completion banner"
                className="grid size-7 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)] transition-colors"
              >
                <X size={13} weight="bold" />
              </button>
            )}
          </div>
        )}

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
                    {note?.dateModified || note?.dateEntered || 'Document Ready'}
                  </span>
                </div>
                <p
                  className="mt-1 truncate text-xs sm:text-sm font-bold text-[var(--ink)]"
                  title={note?.filename}
                >
                  {note?.filename || `${asText(item.headline).slice(0, 48)}.docx`}
                </p>
                {effectiveUserName && (
                  <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">Generated by <span className="font-bold text-[var(--accent-strong)]">{effectiveUserName}</span></p>
                )}
              </div>
            </div>

            {/* THREE REQUESTED ACTIONS: 1. View Doc, 2. Download Doc, 3. Regenerate Doc */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* 1. View Doc */}
              <a
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="upwork-view-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-[var(--ink)] active:scale-95 transition-all"
                title="Open document viewer in new tab"
              >
                <Eye size={14} weight="bold" />
                <span>View doc</span>
              </a>

              {/* 2. Download Doc */}
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="upwork-apply-button inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold active:scale-95 transition-all cursor-pointer disabled:opacity-60"
                title="Download Microsoft Word document"
              >
                {isDownloading ? (
                  <ArrowsClockwise size={14} weight="bold" className="animate-spin" />
                ) : (
                  <DownloadSimple size={14} weight="bold" />
                )}
                <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
              </button>

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
                The AI document process encountered an issue. Click below to regenerate.
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

function DocProcessingStages({ status, itemId, noteId, noteDateEntered, userName, onRefresh }) {
  const inProg = getDocInProgress(itemId, noteId)
  const effectiveUserName = userName || inProg?.userName || ''

  const STAGES = [
    {
      key: 'queued',
      title: 'Queued in Pipeline',
      desc: 'Accepted and queued for synthesis',
      icon: Target,
    },
    {
      key: 'processing',
      title: 'AI Drafting & Research Synthesis',
      desc: 'Grounded citations, competitor benchmarks & content',
      icon: Quotes,
    },
    {
      key: 'compiling',
      title: 'Compiling DOCX & Layout Packaging',
      desc: 'Typography, tables, styles & Word DOCX generation',
      icon: FileDoc,
    },
  ]

  // Track the persistent start time for this specific content item / note
  const [startTime, setStartTime] = useState(() => {
    const existing = getDocStartTime(itemId, noteId)
    if (existing) return existing

    if (noteDateEntered) {
      const parsed = new Date(noteDateEntered).getTime()
      if (!isNaN(parsed) && parsed > 0 && Date.now() - parsed < 25 * 60 * 1000) {
        recordDocStartTime(itemId, noteId, parsed)
        return parsed
      }
    }

    const now = Date.now()
    recordDocStartTime(itemId, noteId, now)
    return now
  })

  // Synchronize start time when itemId or noteId changes (e.g. user selects different content item)
  useEffect(() => {
    const existing = getDocStartTime(itemId, noteId)
    if (existing) {
      setStartTime(existing)
    } else if (noteDateEntered) {
      const parsed = new Date(noteDateEntered).getTime()
      if (!isNaN(parsed) && parsed > 0 && Date.now() - parsed < 25 * 60 * 1000) {
        recordDocStartTime(itemId, noteId, parsed)
        setStartTime(parsed)
      } else {
        const now = Date.now()
        recordDocStartTime(itemId, noteId, now)
        setStartTime(now)
      }
    } else {
      const now = Date.now()
      recordDocStartTime(itemId, noteId, now)
      setStartTime(now)
    }
  }, [itemId, noteId, noteDateEntered])

  // Real-time elapsed time calculated directly from the absolute startTime
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startTime) / 1000))
  )

  useEffect(() => {
    // Update immediately on mount or when startTime changes
    setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)))

    const elapsedTimer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)))
    }, 1000)

    return () => clearInterval(elapsedTimer)
  }, [startTime])

  // Maps backend status directly to the stage index
  const activeStage = useMemo(() => {
    if (status === 'queued') return 0
    if (status === 'compiling' || status === 'compiliing') return 2
    return 1 // 'processing' or default
  }, [status])

  // Progress rises based on active stage and elapsed seconds
  const percent = useMemo(() => {
    if (status === 'queued') return Math.min(30, Math.max(15, Math.round(15 + elapsed / 4)))
    if (status === 'compiling' || status === 'compiliing') return Math.min(95, Math.max(82, Math.round(82 + elapsed / 10)))
    return Math.min(78, Math.max(45, Math.round(45 + elapsed / 8))) // processing
  }, [status, elapsed])

  const formatElapsed = (s) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const stageHeaderInfo = useMemo(() => {
    if (status === 'queued') {
      return {
        title: 'Queued for Document Generation',
        badge: 'Queued',
        desc: 'Request queued in pipeline. Processing starts momentarily...',
      }
    }
    if (status === 'compiling' || status === 'compiliing') {
      return {
        title: 'Compiling Word Document (.docx)',
        badge: 'Compiling',
        desc: 'Packaging formatted article, typography & tables into DOCX...',
      }
    }
    return {
      title: 'Synthesizing Article & Research',
      badge: 'Processing',
      desc: 'Deep AI article synthesis with grounded source citations...',
    }
  }, [status])

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
                {stageHeaderInfo.title}
              </h4>
              <span className="rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[10px] font-bold text-[#26320b] dark:text-[#c0df78]">
                {stageHeaderInfo.badge}
              </span>
            </div>
            {effectiveUserName && (
              <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">Generated by <span className="font-bold text-[var(--accent-strong)]">{effectiveUserName}</span></p>
            )}
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">
              {stageHeaderInfo.desc}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh status"
            className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)] bg-[var(--paper)] hover:bg-[var(--frame)] px-2.5 py-1 rounded-full ring-1 ring-[var(--line)] transition-all cursor-pointer active:scale-95"
          >
            <ArrowsClockwise size={12} className="text-[var(--lime-dark)]" />
            <span>{formatElapsed(elapsed)}</span>
          </button>
        </div>
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

      {/* Stages Stepper List: Queued -> Processing -> Compiling */}
      <div className="relative mt-4 grid gap-2 sm:grid-cols-3">
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

      {/* Notice */}
      <div className="relative mt-3.5 flex items-center justify-between gap-1 border-t border-[var(--line)]/50 pt-2.5 text-[10px] text-[var(--muted)]">
        <span>You can continue exploring or working; this post will update automatically.</span>
      </div>
    </div>
  )
}
