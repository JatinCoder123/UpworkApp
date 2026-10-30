import { useMemo, useState } from 'react'
import { ArrowRight, ArrowSquareOut, ClockCounterClockwise, CurrencyDollar, DownloadSimple, Eye, Folder, Gauge, Globe, Layout, Lightbulb, Minus, Newspaper, PaintBrush, Plug, PuzzlePiece, ShoppingCart, SquaresFour, Stack, Star, Tag, Tray, TrendDown, TrendUp, User } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LogoLoader from '../components/LogoLoader'
import DateTimeRangeFilter from '../components/DateTimeRangeFilter'
import { ActiveDateFilterChip, RefreshFilterButton } from '../components/FilterToolbarControls'
import { SortMenu } from '../components/JobListControls'
import { ClearFilters, NothingMatches, SectionPanel, sectionLabel as label } from '../components/SectionControls'
import FeedSearch from '../components/FeedSearch'
import FeedFilterDialog from '../components/FeedFilterDialog'
import FilterListDialog from '../components/FilterListDialog'
import { FactList, FeedIndex, FilterButton, FilterChip, FilterStrip, Metric, MoreLoader, metricRow, stripRow } from '../components/FeedParts'
import { DialogHeader, Modal, primaryButton } from '../components/ui'
import ErrorBoundary, { CardError, DialogError } from '../components/ErrorBoundary'
import { useAuth } from '../contexts/AuthContext'
import { EMPTY_DATE_RANGE } from '../lib/dateRange'
import { countFilters, useFeedIndex } from '../lib/feedView'
import { useGatewayFeed, useOpenItem } from '../lib/gatewayFeed'
import { skillStyle } from '../lib/jobSignals'
import { timeAgo, useNow } from '../lib/time'

/*
 * WordPress section: the outr_wordpress market feed (trending plugins, themes, blocks, extensions, templates and
 * WordPress news), each with its demand score, trend and the product opportunity for us. Same panel as Jobs: search,
 * sort, date and the universal filter (type, category, pricing, trend, source, tags). The smart gateway does the
 * filtering, search, sorting, paging and counts; tags, which hold several values per item, are matched on the page
 * (see useGatewayFeed). Labels and choices come from the module's dropdown lists. Read only: no feed status for now.
 */

// Item type: icon and tile colour (item_type keys).
const TYPES = {
  plugin: [Plug, 'bg-tone-indigo-bg text-tone-indigo'],
  theme: [PaintBrush, 'bg-tone-pink-bg text-tone-pink'],
  block: [SquaresFour, 'bg-tone-mint-bg text-tone-mint'],
  extension: [PuzzlePiece, 'bg-tone-amber-bg text-tone-amber'],
  template: [Layout, 'bg-info-bg text-info'],
  market_news: [Newspaper, 'bg-tone-slate-bg text-tone-slate'],
}
const TREND = {
  rising: [TrendUp, 'text-rise'],
  stable: [Minus, 'text-[var(--muted)]'],
  declining: [TrendDown, 'text-clay'],
}
const PRICING_ICONS = { free: Tag, paid: CurrencyDollar, freemium: Stack }
// Pricing chips in the filters: lime free, blue paid, purple freemium.
const PRICING_TONE = {
  free: 'bg-(--lime-tint)/40 text-[var(--ink)]',
  paid: 'bg-info-bg text-info',
  freemium: 'bg-tone-violet-bg text-tone-violet',
}
// Trend chips in the filters: green rising, grey stable, red declining.
const TREND_TONE = {
  rising: 'bg-rise-bg text-rise',
  stable: 'bg-[var(--paper)] text-[var(--muted)]',
  declining: 'bg-clay-bg text-clay',
}
// Sorts the gateway applies (see FEEDS in services/api).
const SORTS = [{ id: 'demand', label: 'Highest demand' }, { id: 'newest', label: 'Newest first' }, { id: 'installs', label: 'Most installs' }, { id: 'sales', label: 'Most sales' }, { id: 'rating', label: 'Top rated' }]
// Universal filter: key -> [CRM field, item field, matched on the page]. Tags hold several values per item, which the
// gateway cannot OR, so they are matched on the page (several can be picked).
const FIELDS = { types: ['item_type', 'itemType'], categories: ['category', 'category'], pricing: ['pricing_type', 'pricingType'], trends: ['trend', 'trend'], sources: ['source', 'source'], tags: ['tags', 'tags', true] }
const EMPTY_FILTERS = Object.fromEntries(Object.keys(FIELDS).map((key) => [key, []]))
// The filters shown on the page (the universal filter has them all): key and icon.
const STRIPS = [['types', Stack], ['categories', Folder], ['pricing', Tag]]
const STRIP_KEYS = STRIPS.map(([key]) => key)
// Error fallbacks: a card, the index, the strips or a dialog fail on their own; the rest of the page
// keeps working.
const CARD_ERROR = { what: 'item' }
const INDEX_ERROR = { title: 'The list index could not load', className: 'hidden self-start lg:block' }
const FILTERS_ERROR = { title: 'The filters could not load', className: 'm-3' }
const ALL_KEYS = Object.keys(FIELDS)
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '')
const money = (price) => `$${Number.isInteger(price) ? price : price.toFixed(2)}`

// The Price tile, from the CRM's pricing type and price: "Free", "$79" (paid), or for freemium (a free version plus a
// paid Pro version) "Freemium" with "Pro $49" (the Pro version's price) under it.
function PriceValue({ item, labelOf }) {
  const amount = item.price ? money(item.price) : ''
  if (item.pricingType === 'freemium') return <span className="block leading-5">{labelOf('pricing_type', 'freemium')}{amount && <span className="mt-0.5 block whitespace-nowrap text-xs font-medium text-[var(--muted)]">Pro {amount}</span>}</span>
  if (item.pricingType === 'paid') return amount || labelOf('pricing_type', 'paid')
  return item.pricingType ? labelOf('pricing_type', item.pricingType) : amount
}

export default function Wordpress() {
  const now = useNow()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [dateFilter, setDateFilter] = useState(EMPTY_DATE_RANGE)
  const [sort, setSort] = useState('demand')
  const [filterDialog, setFilterDialog] = useState(false)
  const [listKey, setListKey] = useState(null)

  // Counts: the strips all the time, every group while the universal filter or a full list is open.
  const { options, labelOf, items, total, grandTotal, countOf, refresh, loading, isError, error, updating, hasMore, loadingMore, loadMoreRef } = useGatewayFeed({
    feed: 'wordpress', fields: FIELDS, filters, search, dateFilter, dateField: 'published_date', sort,
    stripKeys: STRIP_KEYS, openKeys: filterDialog || listKey ? ALL_KEYS : undefined,
  })
  const { activeId, jumpTo } = useFeedIndex(items)

  // Search suggestions: the most used tags among the items shown.
  const searchSuggestions = useMemo(() => {
    const tally = {}
    items.forEach((item) => item.tags.forEach((tag) => { tally[tag] = (tally[tag] || 0) + 1 }))
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([tag]) => labelOf('tags', tag))
  }, [items, labelOf])

  const used = (field) => options[field] || []
  const filterSections = [
    { key: 'types', title: 'Types', icon: Stack, kind: 'cards', options: used('item_type').map((option) => ({ ...option, icon: (TYPES[option.value] || [Tag])[0], tone: TYPES[option.value]?.[1] })) },
    { key: 'categories', title: 'Categories', icon: Folder, kind: 'chips', options: used('category') },
    { key: 'pricing', title: 'Pricing', icon: Tag, kind: 'cards', options: used('pricing_type').map((option) => ({ ...option, icon: PRICING_ICONS[option.value] || Tag, tone: PRICING_TONE[option.value] })) },
    { key: 'trends', title: 'Trends', icon: TrendUp, kind: 'cards', options: used('trend').map((option) => ({ ...option, icon: (TREND[option.value] || TREND.stable)[0], tone: TREND_TONE[option.value] })) },
    { key: 'sources', title: 'Sources', icon: Globe, kind: 'cards', options: used('source').map((option) => ({ ...option, icon: Globe })) },
    { key: 'tags', title: 'Tags', icon: Tag, kind: 'chips', options: used('tags') },
  ]
  const filterCount = countFilters(filters)
  const hasFilters = Boolean(search || filterCount || dateFilter.preset !== 'all')
  const clearAll = () => { setSearch(''); setFilters(EMPTY_FILTERS); setDateFilter(EMPTY_DATE_RANGE) }
  const removeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key].filter((entry) => entry !== value) }))
  // Chips for every filter picked, so it is clear why the list is narrower.
  const activeChips = Object.entries(FIELDS).flatMap(([key, [field]]) => filters[key].map((value) => [key, value, labelOf(field, value)]))
  const listSection = filterSections.find((entry) => entry.key === listKey)
  // The open item is in the link (?wordpress=id).
  const { open, openItem, closeItem } = useOpenItem('wordpress', items, 'wordpress')

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-4 sm:px-6 md:pt-6">
      <SectionPanel>
        {/* Row 1: title, search, then sort, date, the universal filter and refresh. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <h1 className="flex shrink-0 items-baseline gap-2 text-2xl font-semibold tracking-[-.04em]">Wordpress<span className="font-mono text-[13px] font-semibold tracking-normal text-[var(--muted)] tabular-nums">{loading || updating ? '…' : `${total} of ${grandTotal ?? total}`}</span></h1>
          <FeedSearch value={search} onChange={setSearch} email={user?.email} scope="wordpress" suggestions={searchSuggestions} placeholder="Search plugins, themes, opportunities, tags…" label="Search the WordPress feed" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SortMenu value={sort} options={SORTS} onChange={setSort} label="Sort the feed" />
            <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Published" />
            <FilterButton count={filterCount} onClick={() => setFilterDialog(true)} title="Filter by type, category, pricing, trend, source and tags" />
            <RefreshFilterButton onClick={refresh} loading={updating} label="Refresh the feed" />
          </div>
        </div>

        {/* Row 2: the main filters on the page, a few choices at a time; the wheel opens each whole list and the
            universal filter has every option. Several choices can be picked at once. */}
        {Object.keys(options).length > 0 && <ErrorBoundary name="wordpress-filters" fallbackProps={FILTERS_ERROR} resetKey={options}><div className={`${stripRow} border-t border-[var(--line)]/70 px-4 py-2.5 sm:px-6`}>
          {STRIPS.map(([key, icon]) => {
            const section = filterSections.find((entry) => entry.key === key)
            return <FilterStrip key={key} title={section.title} icon={icon} options={section.options} value={filters[key]} countOf={(value) => countOf(key, value)} onChange={(values) => setFilters((current) => ({ ...current, [key]: values }))} onOpenAll={() => setListKey(key)} />
          })}
        </div></ErrorBoundary>}

        {/* Filters in use, each removable. */}
        {(activeChips.length > 0 || dateFilter.preset !== 'all') && <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)]/70 px-4 py-2.5 sm:px-6">
          {activeChips.map(([key, value, text]) => <FilterChip key={`${key}-${value}`} onClear={() => removeFilter(key, value)}>{text}</FilterChip>)}
          <ActiveDateFilterChip value={dateFilter} onClear={() => setDateFilter(EMPTY_DATE_RANGE)} />
          {hasFilters && <span className="ml-auto"><ClearFilters onClick={clearAll} /></span>}
        </div>}
      </SectionPanel>

      {loading
        ? <LogoLoader className="min-h-[40dvh]" label="Loading the WordPress feed" />
        : isError
          ? <section className="py-24 text-center">
            <h3 className="text-xl font-semibold">Could not load the WordPress feed</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p>
            <button type="button" onClick={refresh} className={`${primaryButton} mt-6`}>Try again</button>
          </section>
          : items.length
            ? <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <ErrorBoundary name="wordpress-index" fallbackProps={INDEX_ERROR} resetKey={items}><FeedIndex items={items} activeId={activeId} onJump={jumpTo}
                meta={(item) => { const [TypeIcon] = TYPES[item.itemType] || [Tag]; return <><TypeIcon size={10} />{labelOf('item_type', item.itemType)}</> }}
                mark={(item) => item.demandScore != null && <span title={`Demand score ${item.demandScore}`} className="mt-0.5 shrink-0 self-start rounded-md bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--muted)] ring-1 ring-[var(--line)]/70">{item.demandScore}</span>} /></ErrorBoundary>
              <div className="@container min-w-0">
                <section className={`grid content-start gap-4 transition-opacity @4xl:grid-cols-2 ${updating ? 'opacity-60' : ''}`}>{items.map((item) => <ErrorBoundary key={item.id} name="wordpress-card" fallback={CardError} fallbackProps={CARD_ERROR} resetKey={item}><FeedCard item={item} labelOf={labelOf} onOpen={() => openItem(item.id)} /></ErrorBoundary>)}</section>
                <MoreLoader ref={loadMoreRef} loading={loadingMore} more={hasMore} total={total} />
              </div>
            </div>
            : grandTotal
              ? <NothingMatches onClear={clearAll} />
              : <p className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center text-sm text-[var(--muted)] ring-1 ring-[var(--line)]/70">The WordPress feed is empty.</p>}

      {open && <ErrorBoundary name="wordpress-details" fallback={DialogError} fallbackProps={{ onClose: closeItem }} resetKey={open.id}><FeedDialog item={open} labelOf={labelOf} now={now} onClose={closeItem} /></ErrorBoundary>}
      {listSection && <ErrorBoundary name="wordpress-list" fallback={DialogError} fallbackProps={{ onClose: () => setListKey(null) }}><FilterListDialog title={`Pick the ${listSection.title.toLowerCase()}`} noun={listSection.title.toLowerCase()} options={listSection.options} value={filters[listKey]} countOf={(value) => countOf(listKey, value)} onApply={(values) => setFilters((current) => ({ ...current, [listKey]: values }))} onClose={() => setListKey(null)} /></ErrorBoundary>}
      {filterDialog && <ErrorBoundary name="wordpress-filter" fallback={DialogError} fallbackProps={{ onClose: () => setFilterDialog(false) }}><FeedFilterDialog title="Filter WordPress items" sections={filterSections} value={filters} countOf={countOf} onApply={(next) => setFilters({ ...EMPTY_FILTERS, ...next })} onClose={() => setFilterDialog(false)} /></ErrorBoundary>}
    </main>
  </Shell>
}

function TypeTile({ type }) {
  const [Icon, tone] = TYPES[type] || [Tag, TYPES.market_news[1]]
  return <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={21} weight="duotone" /></span>
}

function TypeChip({ type, labelOf }) {
  const [Icon, tone] = TYPES[type] || [Tag, TYPES.market_news[1]]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}><Icon size={12} weight="bold" />{labelOf('item_type', type)}</span>
}

function TrendChip({ trend, labelOf }) {
  if (!trend) return null
  const [Icon, tone] = TREND[trend] || TREND.stable
  return <span className={`inline-flex items-center gap-1 rounded-full bg-[var(--paper)] px-2.5 py-1 text-xs font-semibold ring-1 ring-[var(--line)]/70 ${tone}`}><Icon size={12} weight="bold" />{labelOf('trend', trend)}</span>
}

// Demand (score and bar), trend, installs or sales, rating and price, each with its icon.
function Metrics({ item, labelOf }) {
  const [TrendIcon, trendTone] = TREND[item.trend] || TREND.stable
  const sales = item.installs == null && item.sales != null
  return <div className={metricRow}>
    <Metric icon={Gauge} tone="text-[var(--lime-dark)]" caption="Demand" value={item.demandScore != null && <span className="font-mono">{item.demandScore}<span className="text-[11px] text-[var(--muted)]">/100</span></span>}>
      {item.demandScore != null && <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full rounded-full bg-[var(--lime-dark)]" style={{ width: `${Math.min(100, item.demandScore)}%` }} /></span>}
    </Metric>
    <Metric icon={TrendIcon} tone={trendTone} caption="Trend" value={item.trend && <span className={trendTone}>{labelOf('trend', item.trend)}</span>} />
    <Metric icon={sales ? ShoppingCart : DownloadSimple} caption={sales ? 'Sales' : 'Installs'} value={(item.installs ?? item.sales) != null && <span className="font-mono">{compact.format(item.installs ?? item.sales)}</span>} />
    <Metric icon={Star} tone="text-star" caption="Rating" value={item.rating != null && <span className="font-mono">{item.rating.toFixed(1)}</span>} />
    <Metric icon={Tag} caption="Price" value={<PriceValue item={item} labelOf={labelOf} />} wrap />
  </div>
}

function Opportunity({ text, clamp = false }) {
  return <div className="flex gap-2.5 rounded-xl border-l-4 border-[var(--lime-dark)] bg-(--lime-tint)/15 px-3.5 py-3">
    <Lightbulb size={17} weight="fill" className="mt-0.5 shrink-0 text-[var(--lime-dark)]" />
    <div className="min-w-0"><p className={label}>Opportunity for us</p><p className={`mt-0.5 text-sm leading-6 ${clamp ? 'line-clamp-2' : ''}`}>{text}</p></div>
  </div>
}

function Tags({ tags, labelOf }) {
  if (!tags.length) return null
  return <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} style={skillStyle(tag)} className="skill-chip rounded-full px-2.5 py-1 text-xs font-semibold">{labelOf('tags', tag)}</span>)}</div>
}

function FeedCard({ item, labelOf, onOpen }) {
  return <article id={`feed-${item.id}`} data-feed-card={item.id} className={`flex scroll-mt-[calc(var(--shell-h)+1rem)] flex-col gap-3.5 rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgb(var(--shadow-rgb)/.1)]`}>
    <header className="flex items-start gap-3">
      <TypeTile type={item.itemType} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{labelOf('item_type', item.itemType)}<span aria-hidden="true">·</span><Folder size={11} weight="bold" />{labelOf('category', item.category)}</p>
        <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-[-.02em]"><button type="button" onClick={onOpen} className="text-left hover:underline">{item.name}</button></h3>
      </div>
    </header>

    <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.summary || item.description}</p>
    <Metrics item={item} labelOf={labelOf} />
    {item.opportunity && <Opportunity text={item.opportunity} clamp />}
    <Tags tags={item.tags} labelOf={labelOf} />

    <footer className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1"><Globe size={12} />{labelOf('source', item.source)}</span>
        {item.lastUpdated && <span className="inline-flex items-center gap-1"><ClockCounterClockwise size={12} />Updated {shortDate(item.lastUpdated)}</span>}
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs font-bold"><button type="button" onClick={onOpen} className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--text)] px-3.5 py-2 text-[var(--paper)] transition-transform hover:-translate-y-0.5">Details<ArrowRight size={12} weight="bold" /></button></span>
      </div>
    </footer>
  </article>
}

// One feed item: what is happening, the opportunity, every detail from the CRM and its links.
function FeedDialog({ item, labelOf, now, onClose }) {
  const facts = [
    [Folder, 'Category', labelOf('category', item.category)],
    [Tag, 'Pricing', item.pricingType && labelOf('pricing_type', item.pricingType)],
    [CurrencyDollar, 'Price', item.price != null && `${money(item.price)}${item.pricingType === 'freemium' ? ' (Pro version)' : ''}`],
    [Gauge, 'Demand score', item.demandScore != null && `${item.demandScore} / 100`],
    [Globe, 'Source', labelOf('source', item.source)],
    [User, 'Author', item.author],
    [ClockCounterClockwise, 'Last updated', formatDate(item.lastUpdated)],
    [Tray, 'Added to the feed', item.addedAt && `${formatDate(item.addedAt)} · ${timeAgo(item.addedAt, now)}`],
  ].filter(([, , value]) => value)

  return <Modal onClose={onClose} wide contained>
    <DialogHeader eyebrow={`Wordpress · ${labelOf('item_type', item.itemType)}`} title={item.name} onClose={onClose} />
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <TypeChip type={item.itemType} labelOf={labelOf} />
      <TrendChip trend={item.trend} labelOf={labelOf} />
      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-bold">
        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[var(--on-lime)] transition-transform hover:-translate-y-0.5"><Globe size={13} weight="bold" />Open on {labelOf('source', item.source)}<ArrowSquareOut size={12} weight="bold" /></a>}
        {item.demoUrl && <a href={item.demoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><Eye size={13} weight="bold" />View demo<ArrowSquareOut size={12} weight="bold" /></a>}
      </div>
    </div>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.summary}</p>

    <div className="mt-4"><Metrics item={item} labelOf={labelOf} /></div>

    <div className="@container mt-5"><div className="grid gap-5 @xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm leading-6">
        {item.description && <section>
          <p className={`${label} flex items-center gap-1.5`}><Newspaper size={13} weight="bold" />What is happening</p>
          <p className="mt-1.5 text-[var(--muted)]">{item.description}</p>
        </section>}
        {item.opportunity && <Opportunity text={item.opportunity} />}
        <Tags tags={item.tags} labelOf={labelOf} />

      </div>

      <FactList facts={facts} />
    </div></div>
  </Modal>
}
