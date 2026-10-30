import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowSquareOut, BookOpenText, Briefcase, CalendarBlank, ChartBar, ChatCircle, CheckCircle, ClipboardText, Code, Coins, CurrencyDollar, EnvelopeSimple, FileText, Flag, Folder, Gauge, Globe, GoogleDriveLogo, Lightbulb, ListChecks, Minus, Plugs, PresentationChart, PuzzlePiece, Sparkle, Stack, Table, Tag, Target, Timer, Tray, TrendDown, TrendUp, Users, VideoCamera, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LogoLoader from '../components/LogoLoader'
import DateTimeRangeFilter from '../components/DateTimeRangeFilter'
import { ActiveDateFilterChip, RefreshFilterButton } from '../components/FilterToolbarControls'
import { SelectMenu, SortMenu } from '../components/JobListControls'
import { ClearFilters, NothingMatches, SectionPanel, sectionLabel as label } from '../components/SectionControls'
import FeedSearch from '../components/FeedSearch'
import FeedFilterDialog from '../components/FeedFilterDialog'
import FilterListDialog from '../components/FilterListDialog'
import GenerationInstructions from '../components/GenerationInstructions'
import { ItemDrawer, OutputRow, StageChip } from '../components/GenerateOutput'
import { FactList, FeedIndex, FilterButton, FilterChip, FilterStrip, Metric, MoreLoader, metricRow, stripRow } from '../components/FeedParts'
import { primaryButton } from '../components/ui'
import ErrorBoundary, { CardError, DialogError, SectionError } from '../components/ErrorBoundary'
import NotFound from './NotFound'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { EMPTY_DATE_RANGE } from '../lib/dateRange'
import { countFilters, useFeedIndex } from '../lib/feedView'
import { useGatewayFeed, useOpenItem } from '../lib/gatewayFeed'
import { stageOf, useGenerateOutput, useGenerationWatch, usePublishOutput } from '../lib/generation'
import { skillStyle } from '../lib/jobSignals'
import { timeAgo, useNow } from '../lib/time'

/*
 * AppScript section: the outr_appscripts feed of Google Apps Script tools worth building: the problem, how it works,
 * the Google apps it uses, demand, trend, difficulty, how it earns and our edge. Same panel as WordPress and LLM:
 * search, sort, date, the strips and the universal filter. The smart gateway does the filtering, search, sorting and
 * counts; the fields holding several values per idea (Google apps, integrations, target users, tags) and the rank
 * sorts are finished on the page (see useGatewayFeed). Labels and choices come from the module's dropdown lists.
 * Generate (script, video): the user adds a suggestion and starts it; the CRM gets the suggestion, the generate
 * box and "queued", and the page follows the status the generator sets until the document is ready (or failed).
 * Once the script is ready, the user is asked whether to publish it on WordPress (post_script); ticked, the sites'
 * login URL is shown with it.
 */

// Google apps: icon and colour (google_app keys). The card's tile shows the first app.
const APPS = {
  sheets: [Table, 'bg-success-bg text-success'],
  gmail: [EnvelopeSimple, 'bg-danger-bg text-danger'],
  drive: [GoogleDriveLogo, 'bg-tone-amber-bg text-tone-amber'],
  docs: [FileText, 'bg-tone-blue-bg text-tone-blue'],
  forms: [ClipboardText, 'bg-tone-violet-bg text-tone-violet'],
  calendar: [CalendarBlank, 'bg-tone-blue-bg text-tone-blue'],
  slides: [PresentationChart, 'bg-tone-amber-bg text-tone-amber'],
  chat: [ChatCircle, 'bg-success-bg text-success'],
}
const TREND = {
  rising: [TrendUp, 'text-rise'],
  stable: [Minus, 'text-[var(--muted)]'],
  declining: [TrendDown, 'text-clay'],
}
// Priority and difficulty (CRM fields): badge colours and the filter's colour dots.
const PRIORITY = {
  high: ['bg-danger-bg text-danger ring-danger-line', 'bg-danger-solid'],
  medium: ['bg-warning-bg text-warning ring-warning-line', 'bg-warning-solid'],
  low: ['bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]', 'bg-tone-slate-solid'],
}
const DIFFICULTY = {
  easy: ['bg-(--lime-tint)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40', 'bg-[var(--lime-dark)]'],
  medium: ['bg-warning-bg text-warning ring-warning-line', 'bg-warning-solid'],
  hard: ['bg-danger-bg text-danger ring-danger-line', 'bg-danger-solid'],
}
// How an idea earns (earning_model keys).
const EARNING_ICONS = { addon: PuzzlePiece, freelance_gig: Briefcase, template_sale: Tag, saas: Coins, internal_use: Users }
// What can be made from an idea: type (the CRM fields' prefix), icon, name, short name and an example suggestion.
const OUTPUTS = [
  ['script', Code, 'Apps Script code', 'Script', 'e.g. Also log every sent invoice with a timestamp in a "Sent log" sheet'],
  ['video', VideoCamera, 'Video', 'Video', 'e.g. Keep it under 60 seconds and end on a question'],
]
// The outputs' CRM prefixes, and the ones that can be published on WordPress (only the script).
const OUTPUT_TYPES = OUTPUTS.map(([type]) => type)
const PUBLISHED = ['script']
// Trend chips in the filters: green rising, grey stable, red declining.
const TREND_TONE = {
  rising: 'bg-rise-bg text-rise',
  stable: 'bg-[var(--paper)] text-[var(--muted)]',
  declining: 'bg-clay-bg text-clay',
}
const RANK = { high: 3, medium: 2, low: 1 }
const EASE = { easy: 3, medium: 2, hard: 1 }
const SORTS = [{ id: 'demand', label: 'Highest demand' }, { id: 'priority', label: 'Highest priority' }, { id: 'easy', label: 'Easiest first' }, { id: 'newest', label: 'Newest first' }]
// Sorts the gateway cannot do (rank order; the CRM keys sort alphabetically), done on the page; ties go by demand.
// "Highest demand" and "Newest first" are the gateway's.
const demand = (item) => item.demandScore ?? -1
const LOCAL_SORTS = {
  priority: (a, b) => (RANK[b.priority] || 0) - (RANK[a.priority] || 0) || demand(b) - demand(a),
  easy: (a, b) => (EASE[b.difficulty] || 0) - (EASE[a.difficulty] || 0) || demand(b) - demand(a),
}
// Universal filter: key -> [CRM field, item field, matched on the page]. Google apps, integrations, target users and
// tags hold several values per idea, which the gateway cannot OR, so they are matched on the page.
const FIELDS = {
  apps: ['google_app', 'apps', true], categories: ['category', 'category'], priorities: ['priority', 'priority'], difficulty: ['difficulty', 'difficulty'],
  earning: ['earning_model', 'earningModel'], trends: ['trend', 'trend'], integrations: ['integrations', 'integrations', true],
  users: ['target_users', 'targetUsers', true], sources: ['source', 'source'], tags: ['tags', 'tags', true],
}
const EMPTY_FILTERS = Object.fromEntries(Object.keys(FIELDS).map((key) => [key, []]))
// The filters shown on the page (the universal filter has them all): key and icon.
const STRIPS = [['apps', Stack], ['categories', Folder], ['sources', Globe]]
const STRIP_KEYS = STRIPS.map(([key]) => key)
// Error fallbacks: a card, the index, the strips or a dialog fail on their own; the rest of the page
// keeps working.
const CARD_ERROR = { what: 'idea' }
const INDEX_ERROR = { title: 'The list index could not load', className: 'hidden self-start lg:block' }
const FILTERS_ERROR = { title: 'The filters could not load', className: 'm-3' }
const ALL_KEYS = Object.keys(FIELDS)
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export default function AppScript() {
  const now = useNow()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [dateFilter, setDateFilter] = useState(EMPTY_DATE_RANGE)
  const [sort, setSort] = useState('demand')
  const [filterDialog, setFilterDialog] = useState(false)
  const [listKey, setListKey] = useState(null)

  // Counts: the strips all the time, every group while the universal filter or a full list is open.
  const { options, labelOf, items, total, grandTotal, countOf, refresh, loading, isError, error, updating, hasMore, loadingMore, loadMoreRef, loadMoreError, retryMore } = useGatewayFeed({
    feed: 'appscript', fields: FIELDS, filters, search, dateFilter, dateField: 'posted_date', sort, localSorts: LOCAL_SORTS,
    stripKeys: STRIP_KEYS, openKeys: filterDialog || listKey ? ALL_KEYS : undefined,
  })
  const { activeId, jumpTo } = useFeedIndex(items)
  // The open idea is in the link (?appscript=id); one opened from a link that is not in the list is followed too.
  const { open, openItem, closeItem, missing } = useOpenItem('appscript', items, 'appscript')
  // A line per idea in the lists (the page's and the drawer's): app, category, age, and the demand score.
  const indexMeta = (item) => { const [AppIcon] = APPS[item.apps[0]] || [Stack]; return <><AppIcon size={10} /><span className="truncate">{labelOf('category', item.category)} · {timeAgo(item.publishedAt, now)}</span></> }
  const indexMark = (item) => item.demandScore != null && <span title={`Demand score ${item.demandScore}`} className="mt-0.5 shrink-0 self-start rounded-md bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--muted)] ring-1 ring-[var(--line)]/70">{item.demandScore}</span>
  const watchedItems = useMemo(() => (open && !items.some((item) => item.id === open.id) ? [...items, open] : items), [items, open])
  useGenerationWatch({ feed: 'appscript', items: watchedItems, types: OUTPUT_TYPES, read: api.getAppScriptGeneration })
  // Search suggestions: the most used tags among the ideas shown (search matches tag names).
  const searchSuggestions = useMemo(() => {
    const counts = {}
    items.forEach((item) => item.tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag]) => labelOf('tags', tag))
  }, [items, labelOf])

  const used = (key) => options[FIELDS[key][0]] || []
  const filterSections = [
    { key: 'apps', title: 'Google apps', icon: Table, kind: 'cards', options: used('apps').map((option) => ({ ...option, icon: (APPS[option.value] || [Stack])[0], tone: APPS[option.value]?.[1] })) },
    { key: 'priorities', title: 'Priority', icon: Flag, kind: 'cards', options: used('priorities').map((option) => ({ ...option, dot: (PRIORITY[option.value] || PRIORITY.low)[1], tone: PRIORITY[option.value]?.[0] })) },
    { key: 'difficulty', title: 'Difficulty', icon: ChartBar, kind: 'cards', options: used('difficulty').map((option) => ({ ...option, dot: (DIFFICULTY[option.value] || DIFFICULTY.medium)[1], tone: DIFFICULTY[option.value]?.[0] })) },
    { key: 'earning', title: 'Earning model', icon: Coins, kind: 'cards', options: used('earning').map((option) => ({ ...option, icon: EARNING_ICONS[option.value] || Coins })) },
    { key: 'trends', title: 'Trends', icon: TrendUp, kind: 'cards', options: used('trends').map((option) => ({ ...option, icon: (TREND[option.value] || TREND.stable)[0], tone: TREND_TONE[option.value] })) },
    { key: 'categories', title: 'Categories', icon: Folder, kind: 'chips', options: used('categories') },
    { key: 'integrations', title: 'Integrations', icon: Plugs, kind: 'chips', options: used('integrations') },
    { key: 'users', title: 'Target users', icon: Users, kind: 'chips', options: used('users') },
    { key: 'sources', title: 'Sources', icon: Globe, kind: 'chips', options: used('sources') },
    { key: 'tags', title: 'Tags', icon: Tag, kind: 'chips', options: used('tags') },
  ]
  const filterCount = countFilters(filters)
  const hasFilters = Boolean(search || filterCount || dateFilter.preset !== 'all')
  const clearAll = () => { setSearch(''); setFilters(EMPTY_FILTERS); setDateFilter(EMPTY_DATE_RANGE) }
  const removeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key].filter((entry) => entry !== value) }))
  const activeChips = Object.entries(FIELDS).flatMap(([key, [field]]) => filters[key].map((value) => [key, value, labelOf(field, value)]))
  const listSection = filterSections.find((entry) => entry.key === listKey)

  // A ?appscript= link whose idea does not open: the error page at that link, as /jobs/:id shows it.
  if (missing) return <NotFound record="item" error={missing.error} onRetry={missing.retry} retrying={missing.retrying} backTo="/appscript" backLabel="Back to AppScript" />

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-4 sm:px-6 md:pt-6">
      <SectionPanel>
        {/* Row 1: title, search, then sort, date, the universal filter and refresh. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <h1 className="flex shrink-0 items-baseline gap-2 text-2xl font-semibold tracking-[-.04em]">AppScript<span className="font-mono text-[13px] font-semibold tracking-normal text-[var(--muted)] tabular-nums">{loading || updating ? '…' : `${total} of ${grandTotal ?? total}`}</span></h1>
          <FeedSearch value={search} onChange={setSearch} email={user?.email} scope="appscript" suggestions={searchSuggestions} placeholder="Search ideas, Google apps, features, tags…" label="Search the AppScript ideas" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SortMenu value={sort} options={SORTS} onChange={setSort} label="Sort the ideas" />
            <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Posted" />
            <FilterButton count={filterCount} onClick={() => setFilterDialog(true)} title="Filter by Google app, priority, difficulty, earning model and more" />
            <RefreshFilterButton onClick={refresh} loading={updating} label="Refresh the ideas" />
          </div>
        </div>

        {/* Row 2: the main filters on the page, a few choices at a time; the wheel opens each whole list and the
            universal filter has every option. Several choices can be picked at once. */}
        {Object.keys(options).length > 0 && <ErrorBoundary name="appscript-filters" fallbackProps={FILTERS_ERROR} resetKey={options}><div className={`${stripRow} border-t border-[var(--line)]/70 px-4 py-2.5 sm:px-6`}>
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
        ? <LogoLoader className="min-h-[40dvh]" label="Loading the AppScript ideas" />
        : isError
          ? <section className="py-24 text-center">
            <h3 className="text-xl font-semibold">Could not load the AppScript ideas</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p>
            <button type="button" onClick={refresh} className={`${primaryButton} mt-6`}>Try again</button>
          </section>
          : items.length
            ? <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <ErrorBoundary name="appscript-index" fallbackProps={INDEX_ERROR} resetKey={items}><FeedIndex items={items} activeId={activeId} onJump={jumpTo} meta={indexMeta} mark={indexMark} /></ErrorBoundary>
              <div className="@container min-w-0">
                <section className={`grid content-start gap-4 transition-opacity @4xl:grid-cols-2 ${updating ? 'opacity-60' : ''}`}>{items.map((item) => <ErrorBoundary key={item.id} name="appscript-card" fallback={CardError} fallbackProps={CARD_ERROR} resetKey={item}><IdeaCard item={item} labelOf={labelOf} onOpen={() => openItem(item.id)} /></ErrorBoundary>)}</section>
                <MoreLoader ref={loadMoreRef} loading={loadingMore} more={hasMore} total={total} error={loadMoreError} onRetry={retryMore} />
              </div>
            </div>
            : grandTotal || hasFilters
              ? <NothingMatches onClear={clearAll} />
              : <p className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center text-sm text-[var(--muted)] ring-1 ring-[var(--line)]/70">No AppScript ideas yet.</p>}

      {open && <ErrorBoundary name="appscript-details" fallback={DialogError} fallbackProps={{ onClose: closeItem }}><IdeaDrawer item={open} items={items} labelOf={labelOf} now={now} indexMeta={indexMeta} indexMark={indexMark} onSelect={openItem} onClose={closeItem} /></ErrorBoundary>}
      {listSection && <ErrorBoundary name="appscript-list" fallback={DialogError} fallbackProps={{ onClose: () => setListKey(null) }}><FilterListDialog title={`Pick the ${listSection.title.toLowerCase()}`} noun={listSection.title.toLowerCase()} options={listSection.options} value={filters[listKey]} countOf={(value) => countOf(listKey, value)} onApply={(values) => setFilters((current) => ({ ...current, [listKey]: values }))} onClose={() => setListKey(null)} /></ErrorBoundary>}
      {filterDialog && <ErrorBoundary name="appscript-filter" fallback={DialogError} fallbackProps={{ onClose: () => setFilterDialog(false) }}><FeedFilterDialog title="Filter AppScript ideas" sections={filterSections} value={filters} countOf={countOf} onApply={(next) => setFilters({ ...EMPTY_FILTERS, ...next })} onClose={() => setFilterDialog(false)} /></ErrorBoundary>}
    </main>
  </Shell>
}

function Badge({ tone, icon: Icon, children }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tone}`}>{Icon && <Icon size={11} weight="bold" />}{children}</span>
}


// Priority, difficulty and earning model, as coloured badges.
function Badges({ item, labelOf }) {
  const EarningIcon = EARNING_ICONS[item.earningModel] || Coins
  return <div className="flex flex-wrap items-center gap-1.5">
    {item.priority && <Badge tone={(PRIORITY[item.priority] || PRIORITY.low)[0]} icon={Flag}>{labelOf('priority', item.priority)} priority</Badge>}
    {item.difficulty && <Badge tone={(DIFFICULTY[item.difficulty] || DIFFICULTY.medium)[0]} icon={ChartBar}>{labelOf('difficulty', item.difficulty)}</Badge>}
    {item.earningModel && <Badge tone="bg-[var(--paper)] text-[var(--ink)] ring-[var(--line)]" icon={EarningIcon}>{labelOf('earning_model', item.earningModel)}</Badge>}
  </div>
}

// The Google apps the script uses, each in its own colour.
function AppChips({ apps, labelOf }) {
  return <div className="flex flex-wrap gap-1.5">{apps.map((app) => {
    const [Icon, tone] = APPS[app] || [Stack, 'bg-[var(--paper)] text-[var(--muted)]']
    return <span key={app} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}><Icon size={12} weight="bold" />{labelOf('google_app', app)}</span>
  })}</div>
}

// The card's tile: the first Google app's icon and colour.
function Tile({ apps }) {
  const [Icon, tone] = APPS[apps[0]] || [Code, 'bg-[var(--paper)] text-[var(--muted)]']
  return <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={21} weight="duotone" /></span>
}

// Price range as options ("$300–$800" per gig, "$39–$79" one-time template). In a tile (`full` off) the first option's
// amount, with what it is for and how many more under it, so every tile keeps two short lines; in the facts, every
// option on its own line.
function PriceValue({ prices, text, full = false }) {
  if (!prices.length) return null
  const [first] = prices
  const more = prices.length - 1
  const note = (price) => (price.amount ? price.note : `+ ${price.note}`)
  if (!full) {
    const under = [first.amount && first.note, more > 0 && `+${more} more`].filter(Boolean).join(' · ')
    return <span className="block min-w-0" title={text}>
      <span className="block truncate">{first.amount || first.note}</span>
      {under && <span className="mt-0.5 block truncate text-xs font-medium text-[var(--muted)]">{under}</span>}
    </span>
  }
  return <span className="block">{prices.map((price) => <span key={`${price.amount}${price.note}`} className="block">
    {price.amount}{price.amount && price.note && ' '}{price.note && <span className="font-medium text-[var(--muted)]">{note(price)}</span>}
  </span>)}</span>
}

// Demand (score and bar), trend, build time and price, each with its icon.
function Metrics({ item, labelOf }) {
  const [TrendIcon, trendTone] = TREND[item.trend] || TREND.stable
  return <div className={metricRow}>
    <Metric icon={Gauge} tone="text-[var(--lime-dark)]" caption="Demand" value={item.demandScore != null && <span className="font-mono">{item.demandScore}<span className="text-[11px] text-[var(--muted)]">/100</span></span>}>
      {item.demandScore != null && <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full rounded-full bg-[var(--lime-dark)]" style={{ width: `${Math.min(100, item.demandScore)}%` }} /></span>}
    </Metric>
    <Metric icon={TrendIcon} tone={trendTone} caption="Trend" value={item.trend && <span className={trendTone}>{labelOf('trend', item.trend)}</span>} />
    <Metric icon={Timer} caption="Build time" value={item.buildTime} />
    <Metric icon={CurrencyDollar} caption="Price" value={<PriceValue prices={item.prices} text={item.priceRange} />} wrap />
  </div>
}

// A highlighted line: the problem it solves, or our edge.
function Callout({ icon: Icon, title, text, clamp = false, tone = 'lime' }) {
  const colours = tone === 'lime' ? 'border-[var(--lime-dark)] bg-(--lime-tint)/15' : 'border-warning-solid bg-warning-bg/60'
  return <div className={`flex gap-2.5 rounded-xl border-l-4 px-3.5 py-3 ${colours}`}>
    <Icon size={17} weight="fill" className={`mt-0.5 shrink-0 ${tone === 'lime' ? 'text-[var(--lime-dark)]' : 'text-warning-icon'}`} />
    <div className="min-w-0"><p className={label}>{title}</p><p className={`mt-0.5 text-sm leading-6 ${clamp ? 'line-clamp-2' : ''}`}>{text}</p></div>
  </div>
}

function Tags({ tags, labelOf }) {
  if (!tags.length) return null
  return <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} style={skillStyle(tag)} className="skill-chip rounded-full px-2.5 py-1 text-xs font-semibold">{labelOf('tags', tag)}</span>)}</div>
}

function IdeaCard({ item, labelOf, onOpen }) {
  const made = OUTPUTS.map(([type, icon, , short]) => [type, icon, short, stageOf(item.generation[type])]).filter(([, , , stage]) => stage !== 'idle')
  return <article id={`feed-${item.id}`} data-feed-card={item.id} className={`flex scroll-mt-[calc(var(--shell-h)+1rem)] flex-col gap-3.5 rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgb(var(--shadow-rgb)/.1)]`}>
    <header className="flex items-start gap-3">
      <Tile apps={item.apps} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]"><Folder size={11} weight="bold" />{labelOf('category', item.category)}</p>
        <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-[-.02em]"><button type="button" onClick={onOpen} className="text-left hover:underline">{item.name}</button></h3>
      </div>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-2"><AppChips apps={item.apps} labelOf={labelOf} /><Badges item={item} labelOf={labelOf} /></div>
    <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.pitch || item.description}</p>
    <Metrics item={item} labelOf={labelOf} />
    {item.problem && <Callout icon={Target} title="Problem it solves" text={item.problem} clamp tone="amber" />}
    {item.edge && <Callout icon={Lightbulb} title="Our edge" text={item.edge} clamp />}
    <Tags tags={item.tags} labelOf={labelOf} />
    {made.length > 0 && <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Sparkle size={13} weight="fill" className="text-[var(--accent-strong)]" />{made.map(([type, icon, short, stage]) => <StageChip key={type} icon={icon} name={short} stage={stage} />)}</p>}

    <footer className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1"><Globe size={12} />{labelOf('source', item.source)}</span>
        <span className="inline-flex items-center gap-1" title="Posted"><CalendarBlank size={12} />{formatDate(item.publishedAt)}</span>
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs font-bold"><button type="button" onClick={onOpen} className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--text)] px-3.5 py-2 text-[var(--paper)] transition-transform hover:-translate-y-0.5">Details<ArrowRight size={12} weight="bold" /></button></span>
      </div>
    </footer>
  </article>
}

function TextBlock({ icon: Icon, title, children }) {
  if (!children) return null
  return <section><p className={`${label} flex items-center gap-1.5`}><Icon size={13} weight="bold" />{title}</p><p className="mt-1.5 text-[var(--muted)]">{children}</p></section>
}

// How it works: numbered steps when the idea writes it as points ("1. …" lines); otherwise the text, its line breaks kept.
function HowItWorks({ steps, text }) {
  if (!text) return null
  return <section>
    <p className={`${label} flex items-center gap-1.5`}><Code size={13} weight="bold" />How it works</p>
    {steps.length
      ? <ol className="mt-2 space-y-2">{steps.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2.5">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--paper)] font-mono text-[10px] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--line)]">{index + 1}</span>
        <span className="min-w-0 text-[var(--muted)]">{step}</span>
      </li>)}</ol>
      : <p className="mt-1.5 whitespace-pre-line text-[var(--muted)]">{text}</p>}
  </section>
}

// Demand proof: where the need was seen, one card per proof with its source and a link to it.
function DemandProof({ proofs }) {
  if (!proofs.length) return null
  return <section>
    <p className={`${label} flex items-center gap-1.5`}><TrendUp size={13} weight="bold" />Demand proof</p>
    <ul className="mt-2 grid gap-2">{proofs.map((proof) => <li key={`${proof.source}${proof.text}`} className="flex items-start gap-3 rounded-xl bg-[var(--paper)] px-3.5 py-3 ring-1 ring-[var(--line)]/70">
      <div className="min-w-0 flex-1">
        {proof.source && <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--accent-strong)]">{proof.source}</p>}
        <p className="mt-0.5 break-words text-[13px] leading-5">{proof.text}</p>
      </div>
      {proof.url && <span className="shrink-0 text-[11px] font-bold"><a href={proof.url} target="_blank" rel="noreferrer" title={proof.url} className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]">Open<ArrowSquareOut size={11} weight="bold" /></a></span>}
    </li>)}</ul>
  </section>
}

function ChipList({ icon: Icon, title, values, field, labelOf }) {
  if (!values.length) return null
  return <section><p className={`${label} flex items-center gap-1.5`}><Icon size={13} weight="bold" />{title}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-xs font-semibold ring-1 ring-[var(--line)]/70">{labelOf(field, value)}</span>)}</div></section>
}

// One idea: the problem, how it works, features, our edge, integrations and users on the left; the facts, demand proof
// and similar tools on the right; plus Generate
// (script, video) with each one's status. `onPanel(type)` opens an output's Prompt & guidelines (null closes).
function IdeaDetails({ item, labelOf, now, panelType, onPanel }) {
  const facts = [
    [Folder, 'Category', labelOf('category', item.category)],
    [Gauge, 'Demand score', item.demandScore != null && `${item.demandScore} / 100`],
    [Timer, 'Build time', item.buildTime],
    [CurrencyDollar, 'Price range', item.prices.length > 0 && <PriceValue key="price" prices={item.prices} text={item.priceRange} full />],
    [Coins, 'Earning model', item.earningModel && labelOf('earning_model', item.earningModel)],
    [Globe, 'Source', labelOf('source', item.source)],
    [CalendarBlank, 'Posted', formatDate(item.publishedAt)],
    [Tray, 'Added to the feed', item.addedAt && `${formatDate(item.addedAt)} · ${timeAgo(item.addedAt, now)}`],
  ].filter(([, , value]) => value)

  return <>
    <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">AppScript · {labelOf('category', item.category)}</p>
    <h2 className="mt-3 text-3xl font-semibold tracking-[-.05em]">{item.name}</h2>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Badges item={item} labelOf={labelOf} />
      {item.sourceUrl && <span className="ml-auto text-xs font-bold"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[var(--on-lime)] transition-transform hover:-translate-y-0.5"><Globe size={13} weight="bold" />Open on {labelOf('source', item.source)}<ArrowSquareOut size={12} weight="bold" /></a></span>}
    </div>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.pitch}</p>
    <div className="mt-3"><AppChips apps={item.apps} labelOf={labelOf} /></div>
    <div className="mt-4"><Metrics item={item} labelOf={labelOf} /></div>

    <div className="@container mt-5"><div className="grid gap-5 @xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm leading-6">
        {item.problem && <Callout icon={Target} title="Problem it solves" text={item.problem} tone="amber" />}
        <HowItWorks steps={item.steps} text={item.description} />
        {item.features.length > 0 && <section><p className={`${label} flex items-center gap-1.5`}><ListChecks size={13} weight="bold" />Key features</p><ul className="mt-1.5 grid gap-1 @md:grid-cols-2">{item.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle size={15} weight="fill" className="mt-1 shrink-0 text-[var(--lime-dark)]" /><span className="first-letter:uppercase">{feature}</span></li>)}</ul></section>}
        {item.edge && <Callout icon={Lightbulb} title="Our edge" text={item.edge} />}
        <ChipList icon={Plugs} title="Integrations" values={item.integrations} field="integrations" labelOf={labelOf} />
        <ChipList icon={Users} title="Target users" values={item.targetUsers} field="target_users" labelOf={labelOf} />
        <Tags tags={item.tags} labelOf={labelOf} />
      </div>

      {/* Beside the long texts: the short facts, then the demand proof and the similar tools under them (as their own
          sections, not squeezed into a fact row). */}
      <div className="space-y-4 text-sm leading-6">
        <FactList facts={facts} />
        <DemandProof proofs={item.demandProofs} />
        <TextBlock icon={Stack} title="Similar tools">{item.similarTools}</TextBlock>
      </div>
    </div></div>

    {/* Generate: a suggestion first, then Start; the generator makes it and its status shows here as it goes. Each
        output's prompt and guidelines (CRM) can be read and edited first. */}
    <section className="mt-5 rounded-2xl bg-[var(--paper)] p-3.5 ring-1 ring-[var(--line)]/70 sm:p-4">
      <p className={`${label} flex items-center gap-1.5`}><Sparkle size={13} weight="bold" />Generate from this idea</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Check the prompt and guidelines, add a suggestion, then start. When it is ready you can view it, download it or regenerate it with a new suggestion.</p>
      <div className="mt-3 grid gap-2">
        {OUTPUTS.map(([type, icon, name, short, example]) => <AppScriptOutput key={type} item={item} type={type} icon={icon} name={name} short={short} example={example} panelOpen={panelType === type} onPanel={() => onPanel(panelType === type ? null : type)} />)}
      </div>
    </section>
  </>
}

// The idea opens like a job preview (the shared drawer): the ideas down its left, the details beside them, an output's
// Prompt & guidelines on the right.
function IdeaDrawer({ item, items, labelOf, now, indexMeta, indexMark, onSelect, onClose }) {
  return <ItemDrawer kind="AppScript idea" closeLabel="Close the idea" item={item} items={items} indexMeta={indexMeta} indexMark={indexMark} onSelect={onSelect} onClose={onClose}
    details={({ panelType, onPanel }) => <ErrorBoundary name="appscript-idea" resetKey={item.id} fallback={SectionError} fallbackProps={{ title: 'This idea could not load' }}><IdeaDetails item={item} labelOf={labelOf} now={now} panelType={panelType} onPanel={onPanel} /></ErrorBoundary>}
    panel={({ panelType, onPanel }) => <ErrorBoundary name="appscript-instructions" resetKey={panelType} fallback={SectionError} fallbackProps={{ title: 'The prompt and guidelines could not load' }}><InstructionsPanel type={panelType} onType={onPanel} onClose={() => onPanel(null)} /></ErrorBoundary>} />
}

// One output in the details (the shared row), generating through the idea's CRM fields; the script also asks whether
// to publish it on WordPress.
function AppScriptOutput({ item, type, name, ...row }) {
  const generate = useGenerateOutput({ feed: 'appscript', item, type, title: `${name} · ${item.name}`, path: '/appscript', save: (suggestion) => api.generateAppScriptOutput(item.id, type, suggestion) })
  const publish = usePublishOutput({ feed: 'appscript', item, type, save: (on) => api.setAppScriptPost(item.id, type, on) })
  return <OutputRow {...row} output={item.generation[type]} type={type} name={name} generate={generate} publish={PUBLISHED.includes(type) ? publish : undefined} />
}

// The prompt and guidelines of one output, beside the details (on a phone, in their place): the output picker, then
// the shared viewer (one prompt part at a time, guidelines behind their own button).
function InstructionsPanel({ type, onType, onClose }) {
  const [, Icon, name] = OUTPUTS.find(([key]) => key === type)
  return <div className="flex h-full min-h-0 flex-col rounded-2xl bg-[var(--paper)] ring-1 ring-[var(--line)]/70">
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)]/70 px-4 py-3">
      <div className="min-w-0">
        <p className={`${label} flex items-center gap-1.5`}><BookOpenText size={13} weight="bold" />Prompt &amp; guidelines</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Icon size={15} weight="bold" className="text-[var(--accent-strong)]" />{name}</p>
      </div>
      <span className="text-xs font-bold"><button type="button" onClick={onClose} aria-label="Close the prompt and guidelines" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)]">
        <ArrowLeft size={13} weight="bold" className="lg:hidden" /><span className="lg:hidden">Back to the idea</span><X size={13} weight="bold" className="hidden lg:block" />
      </button></span>
    </div>
    <GenerationInstructions promptName={`appscript_${type}`} guidelinesName={`appscript_${type}_guidelines`} what={`the ${name.toLowerCase()}`}
      toolbar={<SelectMenu label="Output" value={type} options={OUTPUTS.map(([key, , text]) => ({ id: key, label: text }))} onChange={onType} icon={Sparkle} onPaper />} />
  </div>
}
