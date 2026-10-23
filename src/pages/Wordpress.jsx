import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ArrowSquareOut, BookmarkSimple, CalendarBlank, Circle, CircleNotch, ClockCounterClockwise, DownloadSimple, Eye, EyeSlash, Fire, Flag, Folder, Funnel, Gauge, GearSix, Globe, Layout, Lightbulb, MagnifyingGlass, Minus, Newspaper, PaintBrush, Plug, PuzzlePiece, Rocket, ShoppingCart, SlidersHorizontal, Sparkle, SquaresFour, Stack, Star, Tag, Tray, TrendDown, TrendUp, User, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import HScroll from '../components/HScroll'
import LogoLoader from '../components/LogoLoader'
import DateTimeRangeFilter from '../components/DateTimeRangeFilter'
import { ActiveDateFilterChip, RefreshFilterButton } from '../components/FilterToolbarControls'
import { SortMenu } from '../components/JobListControls'
import { ClearFilters, FilterToggle, NothingMatches, SectionPanel, SectionTab, sectionLabel as label } from '../components/SectionControls'
import CategoryFilterDialog from '../components/CategoryFilterDialog'
import WordpressFilterDialog from '../components/WordpressFilterDialog'
import { EMPTY_WP_FILTERS, PRIORITY_OPTIONS, countWpFilters } from '../lib/wordpressFilters'
import { DialogHeader, Modal, iconButton, primaryButton } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { EMPTY_DATE_RANGE, resolveDateRange } from '../lib/dateRange'
import { forgetSearch, loadRecentSearches, rememberSearch, skillStyle } from '../lib/jobSignals'
import { timeAgo, useNow } from '../lib/time'

/*
 * WordPress section: the outr_wordpress market feed (trending plugins, themes, blocks, extensions, templates and
 * WordPress news), each with its demand score, trend and the product opportunity for us. Same panel as Jobs. Labels,
 * tabs and chips come from the module's dropdown lists; the feed status is saved to the CRM.
 */

const QUERY_KEY = ['wordpress-feed']
// Feed status: icon and badge colours (feed_status keys).
const STATUS = {
  new: [Sparkle, 'bg-[#e8e4fb] text-[#4b3f8f] ring-[#d3cbf5] dark:bg-[#2a2545] dark:text-[#c4b9f5] dark:ring-[#3d355f]'],
  read: [Eye, 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]'],
  shortlisted: [BookmarkSimple, 'bg-[#f6e8b8] text-[#655419] ring-[#e8d48a] dark:bg-[#383017] dark:text-[#e8c867] dark:ring-[#56491f]'],
  ignored: [EyeSlash, 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]'],
  converted_to_project: [Rocket, 'bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40'],
}
// Item type: icon and tile colour (item_type keys).
const TYPES = {
  plugin: [Plug, 'bg-[#e8eafe] text-[#3b3f8f] dark:bg-[#252845] dark:text-[#b9befa]'],
  theme: [PaintBrush, 'bg-[#fce7f3] text-[#9d2a6a] dark:bg-[#3d1d30] dark:text-[#f3a6d0]'],
  block: [SquaresFour, 'bg-[#ddf6ea] text-[#1f6b4a] dark:bg-[#17352a] dark:text-[#8fdcb6]'],
  extension: [PuzzlePiece, 'bg-[#fff0d7] text-[#8a5a00] dark:bg-[#3a2e17] dark:text-[#f2c26b]'],
  template: [Layout, 'bg-[#e0f2fe] text-[#1e5a85] dark:bg-[#18303f] dark:text-[#9fd0f2]'],
  market_news: [Newspaper, 'bg-[#e8eaf0] text-[#334155] dark:bg-[#262a33] dark:text-[#c3cad6]'],
}
const TREND = {
  rising: [TrendUp, 'text-[#3f7d1c] dark:text-[#a8d86e]'],
  stable: [Minus, 'text-[var(--muted)]'],
  declining: [TrendDown, 'text-[#9a3412] dark:text-[#fdba9a]'],
}
// Demand score -> priority: the card's top edge and the demand bar use its colour.
const PRIORITIES = [
  { key: 'high', min: 80, label: 'High priority', short: 'High', color: 'bg-[var(--lime-dark)]', text: 'text-[#3f7d1c] dark:text-[#a8d86e]' },
  { key: 'medium', min: 60, label: 'Medium priority', short: 'Medium', color: 'bg-[#e0a526]', text: 'text-[#9a6b00] dark:text-[#e8c867]' },
  { key: 'low', min: 0, label: 'Low priority', short: 'Low', color: 'bg-[#e05a47]', text: 'text-[#b4432f] dark:text-[#fdba9a]' },
]
const priorityOf = (score) => (score == null ? null : PRIORITIES.find((priority) => score >= priority.min))
const SORTS = [{ id: 'demand', label: 'Highest demand' }, { id: 'newest', label: 'Newest first' }, { id: 'popular', label: 'Most installs / sales' }, { id: 'rating', label: 'Top rated' }]
const EMPTY_OPTIONS = {}
const SEARCH_SCOPE = 'wordpress'
const SEARCH_SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '')
const money = (price) => `$${Number.isInteger(price) ? price : price.toFixed(2)}`

// Dropdown key -> its CRM label (the key itself when the list does not have it).
const labeller = (options) => (field, value) => options[field]?.find((option) => option.value === value)?.label || value

// "Free", "$79" or "Free · Pro $49", from the pricing type and price.
function priceText(item, labelOf) {
  const amount = item.price ? money(item.price) : ''
  if (item.pricingType === 'freemium') return amount ? `Free · Pro ${amount}` : labelOf('pricing_type', 'freemium')
  if (item.pricingType === 'paid') return amount || labelOf('pricing_type', 'paid')
  return item.pricingType ? labelOf('pricing_type', item.pricingType) : amount
}

// Saves an item's feed status to the CRM, showing it straight away (rolled back if the save fails).
function useFeedStatus(item) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status) => api.setWordpressStatus(item.id, status),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData(QUERY_KEY)
      queryClient.setQueryData(QUERY_KEY, (current) => current && { ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, status } : entry) })
      return { previous }
    },
    onError: (_, __, context) => { if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous) },
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  })
}

export default function Wordpress() {
  const now = useNow()
  const { user } = useAuth()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({ queryKey: QUERY_KEY, queryFn: () => api.getWordpressFeed(), staleTime: 120_000 })
  const allItems = useMemo(() => data?.items || [], [data])
  const options = data?.options || EMPTY_OPTIONS
  const labelOf = useMemo(() => labeller(options), [options])

  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [filters, setFilters] = useState(EMPTY_WP_FILTERS)
  const [dateFilter, setDateFilter] = useState(EMPTY_DATE_RANGE)
  const [sort, setSort] = useState('demand')
  const [openId, setOpenId] = useState(null)
  const [activeId, setActiveId] = useState(null)
  const [filterDialog, setFilterDialog] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const query = search.trim().toLowerCase()

  // One check for every filter; `skip` leaves one out, so a tab or chip can count what it would show.
  const passes = useMemo(() => {
    const { start, end } = resolveDateRange(dateFilter)
    const has = (list, value) => !list.length || list.includes(value)
    return (item, skip = '') => {
      const time = new Date(item.publishedAt)
      return (skip === 'type' || !type || item.itemType === type)
        && (skip === 'status' || status === 'all' || item.status === status)
        && (skip === 'categories' || has(filters.categories, item.category))
        && (skip === 'pricing' || has(filters.pricing, item.pricingType))
        && (skip === 'trends' || has(filters.trends, item.trend))
        && (skip === 'sources' || has(filters.sources, item.source))
        && (skip === 'priorities' || has(filters.priorities, priorityOf(item.demandScore)?.key || ''))
        && (!start || time >= start) && (!end || time <= end)
        && (!query || [item.name, item.summary, item.description, item.opportunity, item.author, ...item.tags.map((tag) => labelOf('tags', tag))].join(' ').toLowerCase().includes(query))
    }
  }, [type, status, filters, dateFilter, query, labelOf])
  const items = useMemo(() => {
    const by = {
      demand: (item) => item.demandScore ?? -1,
      popular: (item) => item.installs ?? item.sales ?? -1,
      rating: (item) => item.rating ?? -1,
      newest: (item) => new Date(item.publishedAt).getTime() || 0,
    }[sort]
    return allItems.filter((item) => passes(item)).sort((a, b) => by(b) - by(a))
  }, [allItems, passes, sort])

  // How many items a choice would show with every other filter on.
  const FIELD_OF = { type: 'itemType', status: 'status', categories: 'category', pricing: 'pricingType', trends: 'trend', sources: 'source' }
  const countOf = (key, value) => allItems.filter((item) => passes(item, key) && (key === 'priorities' ? priorityOf(item.demandScore)?.key === value : value === 'all' || item[FIELD_OF[key]] === value)).length
  const statuses = options.feed_status || []
  // Only the choices some item has, in the CRM's order.
  const used = (field, key) => (options[field] || []).filter((option) => allItems.some((item) => item[key] === option.value))
  const usedOptions = { category: used('category', 'category'), pricing_type: used('pricing_type', 'pricingType'), trend: used('trend', 'trend'), source: used('source', 'source') }
  const filterCount = countWpFilters(filters)
  const toggleIn = (key, value) => setFilters((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((entry) => entry !== value) : [...current[key], value] }))
  const only = (key, value) => filters[key].length === 1 && filters[key][0] === value
  const hasFilters = Boolean(search || type || filterCount || dateFilter.preset !== 'all')
  const clearAll = () => { setSearch(''); setType(''); setFilters(EMPTY_WP_FILTERS); setDateFilter(EMPTY_DATE_RANGE) }
  const open = allItems.find((item) => item.id === openId)

  // Index on the left: highlights the card in the middle of the screen; clicking an entry scrolls to its card.
  useEffect(() => {
    const cards = document.querySelectorAll('[data-wp-card]')
    if (!cards.length || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (visible) setActiveId(visible.target.dataset.wpCard)
    }, { rootMargin: '-35% 0px -60% 0px' })
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [items])
  const jumpTo = (id) => {
    setActiveId(id)
    document.getElementById(`wp-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  // Chips for every filter set in the panels, so it is clear why the list is narrower.
  const activeChips = [
    ...filters.categories.map((value) => ['categories', value, labelOf('category', value)]),
    ...filters.pricing.map((value) => ['pricing', value, labelOf('pricing_type', value)]),
    ...filters.trends.map((value) => ['trends', value, `${labelOf('trend', value)} trend`]),
    ...filters.sources.map((value) => ['sources', value, `From ${labelOf('source', value)}`]),
    ...filters.priorities.map((value) => ['priorities', value, PRIORITY_OPTIONS.find((option) => option.value === value)?.label || value]),
  ]

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
      <SectionPanel>
        {/* Row 1: title and search (with recent searches and Ctrl K, like Jobs). */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--line)]/70 px-4 py-4 sm:px-6">
          <h1 className="flex shrink-0 items-baseline gap-2 text-2xl font-semibold tracking-[-.04em]">Wordpress<span className="font-mono text-xs font-semibold tracking-normal text-[var(--muted)] tabular-nums">{isLoading ? '…' : `${items.length} of ${allItems.length}`}</span></h1>
          <FeedSearch value={search} onChange={setSearch} email={user?.email} />
        </div>

        {/* Row 2: feed status tabs, then sort, date, the filter panel (funnel) and refresh. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line)]/70 px-4 sm:px-6">
          <div role="tablist" aria-label="Feed status" className="flex min-w-0 items-stretch gap-1 self-stretch overflow-x-auto [scrollbar-width:none]">
            <SectionTab active={status === 'all'} onClick={() => setStatus('all')} count={countOf('status', 'all')}><Stack size={15} />All</SectionTab>
            {statuses.map((option) => {
              const [Icon] = STATUS[option.value] || [Circle]
              return <SectionTab key={option.value} active={status === option.value} onClick={() => setStatus(status === option.value ? 'all' : option.value)} count={countOf('status', option.value)}><Icon size={15} />{option.label}</SectionTab>
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 py-3">
            <SortMenu value={sort} options={SORTS} onChange={setSort} label="Sort the feed" />
            <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Published" />
            <button type="button" onClick={() => setFilterDialog(true)} aria-label="Open filters" title="Filter by category, pricing, trend, source and priority" className={`relative ${iconButton} ${filterCount ? 'bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/40' : ''}`}>
              <Funnel size={16} weight={filterCount ? 'fill' : 'regular'} />
              {filterCount > 0 && <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-[var(--text)] text-[9px] font-bold text-[var(--paper)] ring-2 ring-[var(--surface)]">{filterCount}</span>}
            </button>
            <RefreshFilterButton onClick={() => refetch()} loading={isFetching} label="Refresh the feed" />
          </div>
        </div>

        {/* Row 3: type switch, then the quick toggles (High priority, Rising), Clear and the sliders (filter panel). */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)]/70 px-4 py-3 sm:px-6">
          <div role="group" aria-label="Item type" className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-[var(--paper)] p-1 [scrollbar-width:none]">
            <TypeOption active={!type} onClick={() => setType('')} icon={Stack} count={countOf('type', 'all')}>All</TypeOption>
            {used('item_type', 'itemType').map((option) => <TypeOption key={option.value} active={type === option.value} onClick={() => setType(type === option.value ? '' : option.value)} icon={(TYPES[option.value] || [Tag])[0]} count={countOf('type', option.value)}>{option.label}</TypeOption>)}
          </div>
          <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-[var(--line)] sm:block" />
          <div className="flex shrink-0 items-center gap-2">
            <QuickToggle active={only('priorities', 'high')} onClick={() => setFilters((current) => ({ ...current, priorities: only('priorities', 'high') ? [] : ['high'] }))} icon={Fire} tone="hot" count={countOf('priorities', 'high')}>High priority</QuickToggle>
            <QuickToggle active={only('trends', 'rising')} onClick={() => setFilters((current) => ({ ...current, trends: only('trends', 'rising') ? [] : ['rising'] }))} icon={TrendUp} tone="rising" count={countOf('trends', 'rising')}>Rising</QuickToggle>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {hasFilters && <ClearFilters onClick={clearAll} />}
            <button type="button" onClick={() => setFilterDialog(true)} aria-label="Open filters" title="All filters" className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors duration-300 hover:bg-[var(--paper)] hover:text-[var(--ink)]"><SlidersHorizontal size={17} weight="bold" /></button>
          </div>
        </div>

        {/* Row 4: categories (most items first), with the gear for the full list. */}
        <div className="flex items-center gap-2 px-4 py-3 sm:px-6">
          <span className={`${label} shrink-0`}>Category</span>
          <HScroll className="min-w-0 flex-1" innerClassName="gap-1" fade="var(--surface)" label="categories">
            <CategoryChip active={!filters.categories.length} onClick={() => setFilters((current) => ({ ...current, categories: [] }))} count={countOf('categories', 'all')}>All</CategoryChip>
            {[...usedOptions.category].sort((a, b) => countOf('categories', b.value) - countOf('categories', a.value)).map((option) => <CategoryChip key={option.value} active={filters.categories.includes(option.value)} onClick={() => toggleIn('categories', option.value)} count={countOf('categories', option.value)}>{option.label}</CategoryChip>)}
          </HScroll>
          <button type="button" onClick={() => setCategoryDialog(true)} aria-label="All categories" title="Browse all categories" className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-300 hover:rotate-45 ${filters.categories.length ? 'bg-[var(--lime)] text-[#26320b] ring-2 ring-[var(--lime-dark)]/40 shadow-xs' : 'text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}>
            <GearSix size={16} weight="bold" />
          </button>
        </div>

        {/* Active filters from the panels and the date picker, each removable. */}
        {(activeChips.length > 0 || dateFilter.preset !== 'all') && <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)]/70 px-4 py-3 sm:px-6">
          {activeChips.map(([key, value, text]) => <FilterChip key={`${key}-${value}`} onClear={() => toggleIn(key, value)}>{text}</FilterChip>)}
          <ActiveDateFilterChip value={dateFilter} onClear={() => setDateFilter(EMPTY_DATE_RANGE)} />
        </div>}
      </SectionPanel>

      {isLoading
        ? <LogoLoader className="min-h-[40dvh]" label="Loading the WordPress feed" />
        : isError
          ? <section className="py-24 text-center">
            <h3 className="text-xl font-semibold">Could not load the WordPress feed</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p>
            <button type="button" onClick={() => refetch()} className={`${primaryButton} mt-6`}>Try again</button>
          </section>
          : items.length
            ? <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <ItemIndex items={items} activeId={activeId} labelOf={labelOf} now={now} onJump={jumpTo} />
              <section className="grid min-w-0 content-start gap-4 min-[1400px]:grid-cols-2">{items.map((item) => <FeedCard key={item.id} item={item} labelOf={labelOf} now={now} onOpen={() => setOpenId(item.id)} />)}</section>
            </div>
            : allItems.length
              ? <NothingMatches onClear={() => { clearAll(); setStatus('all') }} />
              : <p className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center text-sm text-[var(--muted)] ring-1 ring-[var(--line)]/70">The WordPress feed is empty.</p>}

      {open && <FeedDialog item={open} labelOf={labelOf} statuses={statuses} now={now} onClose={() => setOpenId(null)} />}
      {filterDialog && <WordpressFilterDialog value={filters} options={usedOptions} countOf={countOf} onApply={setFilters} onClose={() => setFilterDialog(false)} />}
      {/* The gear's full category list: picks one category ("All" clears it). */}
      {categoryDialog && <CategoryFilterDialog
        categories={['All', ...usedOptions.category.map((option) => option.label)]}
        categoryCounts={{ All: countOf('categories', 'all'), ...Object.fromEntries(usedOptions.category.map((option) => [option.label, countOf('categories', option.value)])) }}
        selectedCategory={filters.categories.length === 1 ? labelOf('category', filters.categories[0]) : 'All'}
        onSelect={(picked) => setFilters((current) => ({ ...current, categories: picked === 'All' ? [] : usedOptions.category.filter((option) => option.label === picked).map((option) => option.value) }))}
        eyebrow="Wordpress"
        title="Filter by category"
        description="Pick a category to see only its plugins, themes and templates. Each shows how many items it has with your other filters on."
        onClose={() => setCategoryDialog(false)}
      />}
    </main>
  </Shell>
}

// The search bar, styled like the Jobs search: lime magnifier, Ctrl K / ⌘K to focus, and the user's recent searches
// (saved in this browser) under it while it has focus.
function FeedSearch({ value, onChange, email }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const [recent, setRecent] = useState(() => loadRecentSearches(email, SEARCH_SCOPE))
  const history = recent.filter((term) => term.toLowerCase() !== value.trim().toLowerCase() && (!value.trim() || term.toLowerCase().includes(value.trim().toLowerCase()))).slice(0, 6)
  const remember = () => { if (value.trim()) setRecent(rememberSearch(email, value, SEARCH_SCOPE)) }
  useEffect(() => {
    const focusSearch = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); inputRef.current?.focus() } }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  return <form onSubmit={(event) => { event.preventDefault(); remember(); setFocused(false) }} className="job-search relative order-last flex w-full min-w-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-1.5 md:order-none md:w-auto md:max-w-xl md:flex-1">
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] shadow-[0_2px_8px_color-mix(in_srgb,var(--lime-dark)_35%,transparent)]"><MagnifyingGlass size={15} weight="bold" /></span>
    <input ref={inputRef} value={value} onChange={(event) => { onChange(event.target.value); setFocused(true) }} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); remember() }} onKeyDown={(event) => event.key === 'Escape' && (value ? onChange('') : event.currentTarget.blur())} placeholder="Search plugins, themes, opportunities, tags…" aria-label="Search the WordPress feed" aria-keyshortcuts="Control+K Meta+K" autoComplete="off" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-[var(--muted)]" />
    {value
      ? <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(''); inputRef.current?.focus() }} aria-label="Clear search" className="grid size-7 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 hover:text-[var(--ink)] dark:bg-white/10"><X size={12} weight="bold" /></button>
      : <kbd className="hidden shrink-0 rounded-lg bg-[var(--surface)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] sm:inline-block">{SEARCH_SHORTCUT}</kbd>}
    {focused && history.length > 0 && <div onMouseDown={(event) => event.preventDefault()} className="absolute inset-x-0 top-[calc(100%+.5rem)] z-50 rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5">
      <div className="rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-2">
        <div className="flex items-center justify-between px-2 pb-1.5 pt-1"><span className={label}>Recent searches</span><button type="button" onClick={() => { recent.forEach((term) => forgetSearch(email, term, SEARCH_SCOPE)); setRecent([]) }} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear history</button></div>
        <ul>{history.map((term) => <li key={term} className="group/term flex items-center rounded-xl hover:bg-[var(--paper)]">
          <button type="button" onClick={() => { onChange(term); setRecent(rememberSearch(email, term, SEARCH_SCOPE)); setFocused(false) }} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs font-semibold text-[var(--muted)] group-hover/term:text-[var(--ink)]"><ClockCounterClockwise size={14} className="shrink-0" /><span className="truncate">{term}</span></button>
          <button type="button" onClick={() => setRecent(forgetSearch(email, term, SEARCH_SCOPE))} aria-label={`Forget search ${term}`} className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10 hover:text-[var(--ink)]"><X size={11} /></button>
        </li>)}</ul>
      </div>
    </div>}
  </form>
}

// One option of the type switch (like the Jobs "My Jobs / All Jobs" switch), with its icon and count.
function TypeOption({ active, onClick, icon: Icon, count, children }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-2 transition-all duration-300 ${active ? 'bg-[var(--raised)] text-[var(--text)] shadow-sm ring-1 ring-[var(--line)]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold"><Icon size={14} weight={active ? 'bold' : 'regular'} />{children}<span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">{count}</span></span>
  </button>
}

// Coloured quick filter (like Liked / Saved on Jobs): orange for High priority, green for Rising.
const TOGGLE_TONES = {
  hot: { on: 'bg-[#fff1e6] text-[#c2410c] ring-[#fed7aa] shadow-sm dark:bg-[#3b1d0e] dark:text-[#fdba74] dark:ring-[#7c2d12]', hover: 'hover:ring-[#fed7aa]', icon: 'text-[#f97316]' },
  rising: { on: 'bg-[#e9f6dc] text-[#3f7d1c] ring-[#c6e6ad] shadow-sm dark:bg-[#1f3315] dark:text-[#a8d86e] dark:ring-[#3d5e25]', hover: 'hover:ring-[#c6e6ad]', icon: 'text-[#4d9a22] dark:text-[#a8d86e]' },
}
function QuickToggle({ active, onClick, icon: Icon, tone, count, children }) {
  const colours = TOGGLE_TONES[tone]
  return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex shrink-0 items-center rounded-full ring-1 transition-all duration-300 hover:-translate-y-0.5 ${active ? colours.on : `bg-[var(--surface)] text-[var(--ink)] ring-[var(--line)] ${colours.hover}`}`}>
    <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold"><Icon size={14} weight="fill" className={colours.icon} />{children}<span className={`font-mono text-[10px] tabular-nums ${active ? 'opacity-75' : 'text-[var(--muted)]'}`}>{count}</span></span>
  </button>
}

// Category chip, like the Site Content category chips: lime when picked.
function CategoryChip({ active, onClick, count, children }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full px-3.5 py-1.5 transition-all duration-300 ${active ? 'bg-[var(--lime)] !text-[#26320b] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`}>
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold">{children}<span className={`rounded-full px-1.5 py-px text-[9px] tabular-nums ${active ? 'bg-black/10' : 'bg-black/5 dark:bg-white/10'}`}>{count}</span></span>
  </button>
}

// A filter in use, with x to remove it (like the Jobs filter chips).
function FilterChip({ children, onClear }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1.5 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
    {children}
    <button type="button" onClick={onClear} aria-label={`Remove ${children} filter`} className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10"><X size={11} /></button>
  </span>
}

// Sticky, scrollable list of every item shown (like the Jobs index): number, name, type, time, status and a dot in
// the priority colour. Clicking one jumps to its card.
function ItemIndex({ items, activeId, labelOf, now, onJump }) {
  return <nav aria-label="Jump to item" className="hidden lg:block">
    <div className="sticky top-[calc(var(--shell-h)+1rem)] max-h-[calc(100dvh-var(--shell-h)-2rem)] overflow-y-auto overscroll-contain rounded-[1.5rem] bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70 [scrollbar-width:thin]">
      <p className={`${label} px-2 pb-2`}>{items.length} {items.length === 1 ? 'item' : 'items'} shown</p>
      <ol className="space-y-0.5">{items.map((item, index) => {
        const active = activeId === item.id
        const [TypeIcon] = TYPES[item.itemType] || [Tag]
        const [StatusIcon] = STATUS[item.status] || [Circle]
        const priority = priorityOf(item.demandScore)
        return <li key={item.id}>
          <button type="button" onClick={() => onJump(item.id)} aria-current={active ? 'true' : undefined} className={`flex w-full gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${active ? 'bg-[var(--lime)]/30' : 'hover:bg-[var(--paper)]'}`}>
            <span className={`mt-0.5 font-mono text-[10px] font-bold ${active ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`}>{String(index + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[11px] font-semibold leading-4">{item.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                <TypeIcon size={10} />{labelOf('item_type', item.itemType)} · {timeAgo(item.publishedAt, now)}
                {item.status !== 'read' && <StatusIcon size={10} weight="fill" className="text-[var(--accent-strong)]" />}
              </span>
            </span>
            {priority && <span title={`${priority.label} · demand ${item.demandScore}`} className="mt-0.5 flex shrink-0 flex-col items-end gap-1"><span className={`size-2 rounded-full ${priority.color}`} /><span className="font-mono text-[9px] font-bold text-[var(--muted)]">{item.demandScore}</span></span>}
          </button>
        </li>
      })}</ol>
    </div>
  </nav>
}

function StatusBadge({ status, labelOf }) {
  const [Icon, tone] = STATUS[status] || [Circle, STATUS.read[1]]
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${tone}`}><Icon size={11} weight="bold" />{labelOf('feed_status', status)}</span>
}

function TypeTile({ type }) {
  const [Icon, tone] = TYPES[type] || [Tag, TYPES.market_news[1]]
  return <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={21} weight="duotone" /></span>
}

function TypeChip({ type, labelOf }) {
  const [Icon, tone] = TYPES[type] || [Tag, TYPES.market_news[1]]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}><Icon size={12} weight="bold" />{labelOf('item_type', type)}</span>
}

function TrendChip({ trend, labelOf }) {
  if (!trend) return null
  const [Icon, tone] = TREND[trend] || TREND.stable
  return <span className={`inline-flex items-center gap-1 rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-semibold ring-1 ring-[var(--line)]/70 ${tone}`}><Icon size={12} weight="bold" />{labelOf('trend', trend)}</span>
}

// One number with its icon and caption, e.g. "91 / Demand".
function Metric({ icon: Icon, tone = 'text-[var(--muted)]', value, caption, wrap = false, children }) {
  return <div className="min-w-0 rounded-xl bg-[var(--paper)] px-3 py-2.5 ring-1 ring-[var(--line)]/60">
    <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--muted)]"><Icon size={13} weight="bold" className={tone} />{caption}</p>
    <p className={`mt-1 text-sm font-semibold ${wrap ? 'leading-5' : 'truncate'}`}>{value || <span className="text-[var(--muted)]">-</span>}</p>
    {children}
  </div>
}

// Demand (score, coloured bar and priority), trend, installs or sales, rating and price, each with its icon.
function Metrics({ item, labelOf }) {
  const [TrendIcon, trendTone] = TREND[item.trend] || TREND.stable
  const priority = priorityOf(item.demandScore)
  const sales = item.installs == null && item.sales != null
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
    <Metric icon={Gauge} tone={priority?.text} caption="Demand" value={item.demandScore != null && <span className="font-mono">{item.demandScore}<span className={`ml-1 font-sans text-[10px] font-bold ${priority.text}`}>{priority.short}</span></span>}>
      {priority && <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--line)]"><span className={`block h-full rounded-full ${priority.color}`} style={{ width: `${Math.min(100, item.demandScore)}%` }} /></span>}
    </Metric>
    <Metric icon={TrendIcon} tone={trendTone} caption="Trend" value={item.trend && <span className={trendTone}>{labelOf('trend', item.trend)}</span>} />
    <Metric icon={sales ? ShoppingCart : DownloadSimple} caption={sales ? 'Sales' : 'Installs'} value={(item.installs ?? item.sales) != null && <span className="font-mono">{compact.format(item.installs ?? item.sales)}</span>} />
    <Metric icon={Star} tone="text-[#c99a06]" caption="Rating" value={item.rating != null && <span className="font-mono">{item.rating.toFixed(1)}</span>} />
    <Metric icon={Tag} caption="Price" value={priceText(item, labelOf)} wrap />
  </div>
}

// Demand score with its bar and priority (High 80+, Medium 60+, Low), for the details window.
function DemandBox({ score }) {
  const priority = priorityOf(score)
  return <div className="rounded-2xl bg-[var(--paper)] p-3.5 ring-1 ring-[var(--line)]/70">
    <div className="flex items-baseline justify-between gap-2"><p className={`${label} flex items-center gap-1.5`}><Gauge size={13} weight="bold" />Demand score</p><b className="font-mono text-lg tabular-nums">{score ?? '-'}</b></div>
    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--line)]">{priority && <span className={`block h-full rounded-full ${priority.color}`} style={{ width: `${Math.min(100, score)}%` }} />}</span>
    <p className={`mt-1.5 text-[11px] font-semibold ${priority?.text || 'text-[var(--muted)]'}`}>{priority?.label || 'No score yet'}</p>
  </div>
}

function Opportunity({ text, clamp = false }) {
  return <div className="flex gap-2.5 rounded-xl border-l-4 border-[var(--lime-dark)] bg-(--lime)/15 px-3.5 py-3">
    <Lightbulb size={17} weight="fill" className="mt-0.5 shrink-0 text-[var(--lime-dark)]" />
    <div className="min-w-0"><p className={label}>Opportunity for us</p><p className={`mt-0.5 text-sm leading-6 ${clamp ? 'line-clamp-2' : ''}`}>{text}</p></div>
  </div>
}

function Tags({ tags, labelOf }) {
  if (!tags.length) return null
  return <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} style={skillStyle(tag)} className="skill-chip rounded-full px-2.5 py-1 text-[11px] font-semibold">{labelOf('tags', tag)}</span>)}</div>
}

// Round icon button for quick status changes on a card.
function QuickAction({ icon: Icon, active, label: text, onClick }) {
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={text} title={text} className={`grid size-8 place-items-center rounded-full ring-1 transition-colors ${active ? 'bg-[var(--text)] text-[var(--paper)] ring-[var(--text)]' : 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}><Icon size={14} weight={active ? 'fill' : 'regular'} /></button>
}

function FeedCard({ item, labelOf, now, onOpen }) {
  const statusMutation = useFeedStatus(item)
  const priority = priorityOf(item.demandScore)
  // Toggle: clicking the active quick action puts the item back to Read.
  const toggle = (status) => statusMutation.mutate(item.status === status ? 'read' : status)
  return <article id={`wp-${item.id}`} data-wp-card={item.id} className={`relative flex scroll-mt-[calc(var(--shell-h)+1rem)] flex-col gap-3.5 overflow-hidden rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)] ${item.status === 'ignored' ? 'opacity-65' : ''}`}>
    {/* Top edge in the priority colour (High green, Medium amber, Low red). */}
    <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${priority?.color || 'bg-[var(--line)]'}`} />

    <header className="flex items-start gap-3">
      <TypeTile type={item.itemType} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{labelOf('item_type', item.itemType)}<span aria-hidden="true">·</span><Folder size={11} weight="bold" />{labelOf('category', item.category)}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug tracking-[-.02em]"><button type="button" onClick={onOpen} className="text-left hover:underline">{item.name}</button></h3>
      </div>
      <StatusBadge status={item.status} labelOf={labelOf} />
    </header>

    <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.summary || item.description}</p>
    <Metrics item={item} labelOf={labelOf} />
    {item.opportunity && <Opportunity text={item.opportunity} clamp />}
    <Tags tags={item.tags} labelOf={labelOf} />

    <footer className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1"><Globe size={12} />{labelOf('source', item.source)}</span>
        <span className="inline-flex items-center gap-1" title="Published"><CalendarBlank size={12} />{timeAgo(item.publishedAt, now)}</span>
        {item.lastUpdated && <span className="inline-flex items-center gap-1"><ClockCounterClockwise size={12} />Updated {shortDate(item.lastUpdated)}</span>}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        {statusMutation.isPending && <CircleNotch size={13} className="animate-spin text-[var(--muted)]" />}
        <QuickAction icon={BookmarkSimple} active={item.status === 'shortlisted'} label={item.status === 'shortlisted' ? 'Remove from shortlist' : 'Shortlist'} onClick={() => toggle('shortlisted')} />
        <QuickAction icon={EyeSlash} active={item.status === 'ignored'} label={item.status === 'ignored' ? 'Stop ignoring' : 'Ignore'} onClick={() => toggle('ignored')} />
        <span className="text-[11px] font-bold"><button type="button" onClick={onOpen} className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--text)] px-3.5 py-2 text-[var(--paper)] transition-transform hover:-translate-y-0.5">Details<ArrowRight size={12} weight="bold" /></button></span>
      </div>
    </footer>
  </article>
}

// One feed item: what is happening, the opportunity, every detail from the CRM, links, and the feed status.
function FeedDialog({ item, labelOf, statuses, now, onClose }) {
  const statusMutation = useFeedStatus(item)
  const facts = [
    [Folder, 'Category', labelOf('category', item.category)],
    [Tag, 'Pricing', item.pricingType && labelOf('pricing_type', item.pricingType)],
    [Globe, 'Source', labelOf('source', item.source)],
    [User, 'Author', item.author],
    [ClockCounterClockwise, 'Last updated', formatDate(item.lastUpdated)],
    [CalendarBlank, 'Published', item.publishedAt && `${formatDate(item.publishedAt)} · ${timeAgo(item.publishedAt, now)}`],
    [Tray, 'Added to the feed', item.addedAt && `${formatDate(item.addedAt)} · ${timeAgo(item.addedAt, now)}`],
  ].filter(([, , value]) => value)

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow={`Wordpress · ${labelOf('item_type', item.itemType)}`} title={item.name} onClose={onClose} />
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <StatusBadge status={item.status} labelOf={labelOf} />
      <TypeChip type={item.itemType} labelOf={labelOf} />
      <TrendChip trend={item.trend} labelOf={labelOf} />
      <div className="ml-auto flex flex-wrap items-center gap-2 text-[11px] font-bold">
        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[#26320b] transition-transform hover:-translate-y-0.5"><Globe size={13} weight="bold" />Open on {labelOf('source', item.source)}<ArrowSquareOut size={12} weight="bold" /></a>}
        {item.demoUrl && <a href={item.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><Eye size={13} weight="bold" />View demo<ArrowSquareOut size={12} weight="bold" /></a>}
      </div>
    </div>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>

    <div className="mt-4"><Metrics item={item} labelOf={labelOf} /></div>

    <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm leading-6">
        {item.description && <section>
          <p className={`${label} flex items-center gap-1.5`}><Newspaper size={13} weight="bold" />What is happening</p>
          <p className="mt-1.5 text-[var(--muted)]">{item.description}</p>
        </section>}
        {item.opportunity && <Opportunity text={item.opportunity} />}
        <Tags tags={item.tags} labelOf={labelOf} />
      </div>

      <div className="space-y-4">
        <DemandBox score={item.demandScore} />
        <dl className="rounded-2xl bg-[var(--paper)] p-3.5 text-xs ring-1 ring-[var(--line)]/70">
          {facts.map(([Icon, title, value]) => <div key={title} className="flex items-center justify-between gap-3 border-t border-[var(--line)]/60 py-2 first:border-t-0 first:pt-0 last:pb-0">
            <dt className="flex items-center gap-2 text-[var(--muted)]"><Icon size={14} />{title}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>)}
        </dl>

        {/* Feed status: saved to the CRM, the same for everyone. */}
        <section>
          <p className={`${label} flex items-center gap-1.5`}><Flag size={13} weight="bold" />Feed status{statusMutation.isPending && <CircleNotch size={11} className="animate-spin" />}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {statuses.map((option) => {
              const [Icon] = STATUS[option.value] || [Circle]
              return <FilterToggle key={option.value} active={item.status === option.value} onClick={() => item.status !== option.value && statusMutation.mutate(option.value)}><span className="inline-flex items-center gap-1.5"><Icon size={13} />{option.label}</span></FilterToggle>
            })}
          </div>
          {statusMutation.isError && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger)]">{statusMutation.error?.message || 'The status could not be saved.'}</p>}
        </section>
      </div>
    </div>
  </Modal>
}
