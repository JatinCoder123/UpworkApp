import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowSquareOut, Article, BookOpen, Buildings, CalendarBlank, ChartBar, CheckCircle, Circle, Clock, Cpu, CurrencyDollar, Desktop, Flag, Gift, GitBranch, GithubLogo, Globe, GraduationCap, Info, Lightbulb, Lightning, ListChecks, LockKey, LockKeyOpen, Newspaper, Path, Plugs, Sparkle, Stack, Tag, Target, Tray, Wrench, YoutubeLogo } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LogoLoader from '../components/LogoLoader'
import DateTimeRangeFilter from '../components/DateTimeRangeFilter'
import { ActiveDateFilterChip, RefreshFilterButton } from '../components/FilterToolbarControls'
import { SortMenu } from '../components/JobListControls'
import { ClearFilters, NothingMatches, SectionPanel, SectionTab, sectionLabel as label } from '../components/SectionControls'
import FeedSearch from '../components/FeedSearch'
import FeedFilterDialog from '../components/FeedFilterDialog'
import FilterListDialog from '../components/FilterListDialog'
import { FactIcon, FeedIndex, FilterButton, FilterChip, FilterStrip, Metric, MoreLoader } from '../components/FeedParts'
import { DialogHeader, Modal, primaryButton } from '../components/ui'
import ErrorBoundary, { CardError, DialogError } from '../components/ErrorBoundary'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { EMPTY_DATE_RANGE } from '../lib/dateRange'
import { countFilters, useFeedIndex } from '../lib/feedView'
import { useGatewayFeed, useOpenItem } from '../lib/gatewayFeed'
import { skillStyle } from '../lib/jobSignals'
import { timeAgo, useNow } from '../lib/time'

/*
 * LLM section: the outr_llm feed in three groups (tabs): model News (releases, pricing, policy), Learning resources
 * (videos, repos, books, courses, guides; some are steps of a learning journey) and project Suggestions. Same panel as
 * Jobs and WordPress: search, group tabs, sort, date and the universal filter. The smart gateway does the filtering,
 * search, sorting, paging and counts; tags (several per item) and the rank sorts are finished on the page (see
 * useGatewayFeed). Labels and choices come from the module's dropdown lists. Read only: no status or learning
 * progress for now.
 */

// Content group tabs and card tiles (content_group keys).
const GROUPS = {
  news: [Newspaper, 'bg-[#e8eafe] text-[#3b3f8f] dark:bg-[#252845] dark:text-[#b9befa]'],
  learning: [GraduationCap, 'bg-[#ddf6ea] text-[#1f6b4a] dark:bg-[#17352a] dark:text-[#8fdcb6]'],
  suggestion: [Lightbulb, 'bg-[#fff0d7] text-[#8a5a00] dark:bg-[#3a2e17] dark:text-[#f2c26b]'],
}
// Learning format icons (learning_format keys); a learning card's tile shows its format.
const FORMATS = { video: YoutubeLogo, github_repo: GithubLogo, book: BookOpen, course: GraduationCap, article: Article }
// Priority and impact (CRM fields): badge colours and the filter's colour dots.
const PRIORITY = {
  high: ['bg-[#fde2e1] text-[#b42318] ring-[#f7c1bd] dark:bg-[#3d1a18] dark:text-[#fca5a0] dark:ring-[#6b2a25]', 'bg-[#e5484d]'],
  medium: ['bg-[#f6e8b8] text-[#655419] ring-[#e8d48a] dark:bg-[#383017] dark:text-[#e8c867] dark:ring-[#56491f]', 'bg-[#e0a526]'],
  low: ['bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]', 'bg-[#94a3b8]'],
}
const IMPACT = {
  major: ['bg-[#efe4fb] text-[#6b2fa8] ring-[#dcc6f5] dark:bg-[#2e1f45] dark:text-[#d2b4fa] dark:ring-[#4a3370]', 'bg-[#8b5cf6]'],
  medium: ['bg-[#e0f2fe] text-[#0369a1] ring-[#bae6fd] dark:bg-[#7dd3fc]/15 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/30', 'bg-[#38bdf8]'],
  minor: ['bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]', 'bg-[#94a3b8]'],
}
// Access and cost share one style (access / cost keys): lime free, green open source, blue paid, slate closed API;
// each with its icon. Used by the Access strip, the filter and the card badge.
const ACCESS_TONE = {
  free: 'bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40',
  open_source: 'bg-[#ddf6ea] text-[#1f6b4a] ring-[#b5e8cf] dark:bg-[#17352a] dark:text-[#8fdcb6] dark:ring-[#2a5a45]',
  paid: 'bg-[#e0f2fe] text-[#0369a1] ring-[#bae6fd] dark:bg-[#7dd3fc]/15 dark:text-[#7dd3fc] dark:ring-[#7dd3fc]/30',
  closed_api: 'bg-[#e8eaf0] text-[#334155] ring-[#cbd2dc] dark:bg-[#262a33] dark:text-[#c3cad6] dark:ring-[#3a404c]',
}
const ACCESS_ICONS = { free: Gift, open_source: GitBranch, paid: CurrencyDollar, closed_api: LockKey }
const RANK = { high: 3, major: 3, medium: 2, low: 1, minor: 1 }
const SORTS = [{ id: 'newest', label: 'Newest first' }, { id: 'priority', label: 'Highest priority' }, { id: 'impact', label: 'Biggest impact' }, { id: 'company', label: 'Company A–Z' }]
// Sorts the gateway cannot do, done on the page: rank order (the CRM keys sort alphabetically) and A–Z with the items
// without a company last. Ties keep journey steps in order, else the newest first. "Newest first" is the gateway's.
const time = (item) => new Date(item.publishedAt).getTime() || 0
const tie = (a, b) => (a.journeyName && a.journeyName === b.journeyName ? (a.stepNumber || 0) - (b.stepNumber || 0) : time(b) - time(a))
const LOCAL_SORTS = {
  priority: (a, b) => (RANK[b.priority] || 0) - (RANK[a.priority] || 0) || tie(a, b),
  impact: (a, b) => (RANK[b.impact] || 0) - (RANK[a.impact] || 0) || tie(a, b),
  company: (a, b) => (a.company || '\uffff').localeCompare(b.company || '\uffff') || tie(a, b),
}
// Every filter: key -> [CRM field, item field, matched on the page]. `group` is the tabs; tags hold several values
// per item, which the gateway cannot OR, so they are matched on the page.
const FIELDS = {
  group: ['content_group', 'contentGroup'], newsTypes: ['news_type', 'newsType'], companies: ['company', 'company'], priorities: ['priority', 'priority'],
  impacts: ['impact_level', 'impact'], access: ['access', 'access'], topics: ['topic', 'topic'], levels: ['skill_level', 'skillLevel'],
  formats: ['learning_format', 'learningFormat'], sources: ['source', 'source'], tags: ['tags', 'tags', true],
  modelTypes: ['model_type', 'modelType'], cost: ['cost', 'cost'],
}
// The universal filter's groups (the tabs are separate).
const FILTER_KEYS = Object.keys(FIELDS).filter((key) => key !== 'group')
const EMPTY_FILTERS = Object.fromEntries(FILTER_KEYS.map((key) => [key, []]))
const NONE = []
// The filters shown on the page (the universal filter has them all): key and icon.
const STRIPS = [['newsTypes', Stack], ['companies', Buildings], ['access', LockKeyOpen]]
// Counted all the time: the tabs (with "All") and the strips.
const STRIP_KEYS = ['group', ...STRIPS.map(([key]) => key)]
const TAB_KEYS = ['group']
// Error fallbacks: a card, the index, the strips, a journey or a dialog fail on their own; the rest of the page
// keeps working.
const CARD_ERROR = { what: 'item' }
const INDEX_ERROR = { title: 'The list index could not load', className: 'hidden self-start lg:block' }
const FILTERS_ERROR = { title: 'The filters could not load', className: 'm-3' }
const JOURNEY_ERROR = { title: 'This learning journey could not load' }
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const byStep = (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)

export default function Llm() {
  const now = useNow()
  const { user } = useAuth()
  const [group, setGroup] = useState('all')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [dateFilter, setDateFilter] = useState(EMPTY_DATE_RANGE)
  const [sort, setSort] = useState('newest')
  const [filterDialog, setFilterDialog] = useState(false)
  const [listKey, setListKey] = useState(null)

  // The tab is one more filter (content_group).
  const picks = useMemo(() => ({ ...filters, group: group === 'all' ? NONE : [group] }), [filters, group])
  const { options, labelOf, items, total, grandTotal, countOf, refresh, loading, isError, error, updating, hasMore, loadingMore, loadMoreRef } = useGatewayFeed({
    feed: 'llm', fields: FIELDS, filters: picks, search, dateFilter, dateField: 'published_date', sort, localSorts: LOCAL_SORTS,
    stripKeys: STRIP_KEYS, openKeys: filterDialog || listKey ? FILTER_KEYS : undefined, allCountKeys: TAB_KEYS,
  })
  const { activeId, jumpTo } = useFeedIndex(items)
  // Search suggestions: the most used tags among the items shown (search matches tag names).
  const searchSuggestions = useMemo(() => {
    const counts = {}
    items.forEach((item) => item.tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag]) => labelOf('tags', tag))
  }, [items, labelOf])

  // Learning journeys among the items shown, each with every step (from the gateway, whatever the filters), so the
  // path stays whole.
  const journeyNames = useMemo(() => [...new Set(items.map((item) => item.journeyName).filter(Boolean))], [items])
  const { data: journeyData } = useQuery({ queryKey: ['llm-journeys', journeyNames], queryFn: () => api.getLlmJourneys(journeyNames), enabled: journeyNames.length > 0, staleTime: 60_000 })
  const journeySteps = journeyData || NONE
  const stepsOf = (name) => {
    const steps = journeySteps.filter((step) => step.journeyName === name)
    return [...(steps.length ? steps : items.filter((item) => item.journeyName === name))].sort(byStep)
  }
  const journeys = journeyNames.map((name) => [name, stepsOf(name)])

  const used = (key) => options[FIELDS[key][0]] || NONE
  const withIcons = (key, icons) => used(key).map((option) => ({ ...option, icon: icons[option.value]?.[0] || icons[option.value], tone: Array.isArray(icons[option.value]) ? icons[option.value][1] : undefined }))
  const withDots = (key, tones) => used(key).map((option) => ({ ...option, dot: tones[option.value]?.[1] || 'bg-[#94a3b8]', tone: tones[option.value]?.[0] }))
  const filterSections = [
    { key: 'priorities', title: 'Priority', icon: Flag, kind: 'cards', options: withDots('priorities', PRIORITY) },
    { key: 'impacts', title: 'Impact', icon: Lightning, kind: 'cards', options: withDots('impacts', IMPACT) },
    { key: 'newsTypes', title: 'Types', icon: Stack, kind: 'chips', options: used('newsTypes') },
    { key: 'companies', title: 'Companies and authors', icon: Buildings, kind: 'chips', options: used('companies') },
    { key: 'access', title: 'Access', icon: LockKeyOpen, kind: 'cards', options: used('access').map((option) => ({ ...option, icon: ACCESS_ICONS[option.value] || Tag, tone: ACCESS_TONE[option.value] })) },
    { key: 'topics', title: 'Learning topics', icon: GraduationCap, kind: 'chips', options: used('topics') },
    { key: 'levels', title: 'Skill levels', icon: ChartBar, kind: 'cards', options: used('levels').map((option) => ({ ...option, icon: ChartBar })) },
    { key: 'formats', title: 'Formats', icon: BookOpen, kind: 'chips', options: withIcons('formats', FORMATS) },
    { key: 'sources', title: 'Sources', icon: Globe, kind: 'chips', options: used('sources') },
    { key: 'modelTypes', title: 'Model types', icon: Cpu, kind: 'chips', options: used('modelTypes') },
    { key: 'cost', title: 'Cost', icon: CurrencyDollar, kind: 'cards', options: used('cost').map((option) => ({ ...option, icon: ACCESS_ICONS[option.value] || Tag, tone: ACCESS_TONE[option.value] })) },
    { key: 'tags', title: 'Tags', icon: Tag, kind: 'chips', options: used('tags') },
  ]
  const filterCount = countFilters(filters)
  const hasFilters = Boolean(search || filterCount || dateFilter.preset !== 'all')
  const clearAll = () => { setSearch(''); setFilters(EMPTY_FILTERS); setDateFilter(EMPTY_DATE_RANGE) }
  const removeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key].filter((entry) => entry !== value) }))
  const activeChips = FILTER_KEYS.flatMap((key) => filters[key].map((value) => [key, value, labelOf(FIELDS[key][0], value)]))
  const groups = options.content_group || NONE
  const listSection = filterSections.find((entry) => entry.key === listKey)
  // A journey step can be opened from the strip or the details even when the filters leave it out of the list.
  // The open item (a card or a journey step) is in the link (?llm=id).
  const openable = useMemo(() => [...items, ...journeySteps], [items, journeySteps])
  const { open, openItem, closeItem } = useOpenItem('llm', openable, 'llm')

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
      <SectionPanel>
        {/* Row 1: title and search. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-[var(--line)]/70 px-4 py-4 sm:px-6">
          <h1 className="flex shrink-0 items-baseline gap-2 text-2xl font-semibold tracking-[-.04em]">LLM<span className="font-mono text-[13px] font-semibold tracking-normal text-[var(--muted)] tabular-nums">{loading || updating ? '…' : `${total} of ${grandTotal ?? total}`}</span></h1>
          <FeedSearch value={search} onChange={setSearch} email={user?.email} scope="llm" suggestions={searchSuggestions} placeholder="Search models, companies, courses, tags…" label="Search the LLM feed" />
        </div>

        {/* Row 2: News / Learning / Suggestions tabs, then sort, date, the universal filter and refresh. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-6">
          <div role="tablist" aria-label="Content group" className="flex min-w-0 items-stretch gap-1 self-stretch overflow-x-auto [scrollbar-width:none]">
            <SectionTab active={group === 'all'} onClick={() => setGroup('all')} count={countOf('group', 'all')}><Stack size={15} />All</SectionTab>
            {groups.map((option) => {
              const [Icon] = GROUPS[option.value] || [Circle]
              return <SectionTab key={option.value} active={group === option.value} onClick={() => setGroup(group === option.value ? 'all' : option.value)} count={countOf('group', option.value)}><Icon size={15} />{option.label}</SectionTab>
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 py-3">
            <SortMenu value={sort} options={SORTS} onChange={setSort} label="Sort the feed" />
            <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Published" />
            <FilterButton count={filterCount} onClick={() => setFilterDialog(true)} title="Filter by priority, impact, type, company and more" />
            <RefreshFilterButton onClick={refresh} loading={updating} label="Refresh the feed" />
          </div>
        </div>

        {/* Row 3: the main filters on the page, a few choices at a time; the wheel opens each whole list and the
            universal filter has every option. Several choices can be picked at once. */}
        {Object.keys(options).length > 0 && <ErrorBoundary name="llm-filters" fallbackProps={FILTERS_ERROR} resetKey={options}><div className="grid gap-2 border-t border-[var(--line)]/70 px-4 py-3 sm:px-6 xl:grid-cols-3">
          {STRIPS.map(([key, icon]) => {
            const section = filterSections.find((entry) => entry.key === key)
            return <FilterStrip key={key} title={section.title} icon={icon} options={section.options} value={filters[key]} countOf={(value) => countOf(key, value)} onChange={(values) => setFilters((current) => ({ ...current, [key]: values }))} onOpenAll={() => setListKey(key)} />
          })}
        </div></ErrorBoundary>}

        {/* Filters in use, each removable. */}
        {(activeChips.length > 0 || dateFilter.preset !== 'all') && <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)]/70 px-4 py-3 sm:px-6">
          {activeChips.map(([key, value, text]) => <FilterChip key={`${key}-${value}`} onClear={() => removeFilter(key, value)}>{text}</FilterChip>)}
          <ActiveDateFilterChip value={dateFilter} onClear={() => setDateFilter(EMPTY_DATE_RANGE)} />
          {hasFilters && <span className="ml-auto"><ClearFilters onClick={clearAll} /></span>}
        </div>}
      </SectionPanel>

      {loading
        ? <LogoLoader className="min-h-[40dvh]" label="Loading the LLM feed" />
        : isError
          ? <section className="py-24 text-center">
            <h3 className="text-xl font-semibold">Could not load the LLM feed</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p>
            <button type="button" onClick={refresh} className={`${primaryButton} mt-6`}>Try again</button>
          </section>
          : items.length
            ? <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <ErrorBoundary name="llm-index" fallbackProps={INDEX_ERROR} resetKey={items}><FeedIndex items={items} activeId={activeId} onJump={jumpTo}
                meta={(item) => { const [GroupIcon] = GROUPS[item.contentGroup] || [Circle]; return <><GroupIcon size={10} /><span className="truncate">{labelOf('news_type', item.newsType)} · {timeAgo(item.publishedAt, now)}</span></> }}
                mark={(item) => item.priority && <span title={`${labelOf('priority', item.priority)} priority`} className={`mt-1 size-2 shrink-0 self-start rounded-full ${(PRIORITY[item.priority] || PRIORITY.low)[1]}`} />} /></ErrorBoundary>
              <div className="min-w-0 space-y-4">
                {journeys.map(([name, steps]) => <ErrorBoundary key={name} name="llm-journey" fallbackProps={JOURNEY_ERROR} resetKey={steps}><JourneyStrip name={name} steps={steps} labelOf={labelOf} onOpen={openItem} /></ErrorBoundary>)}
                <section className={`grid content-start gap-4 transition-opacity min-[1400px]:grid-cols-2 ${updating ? 'opacity-60' : ''}`}>{items.map((item) => <ErrorBoundary key={item.id} name="llm-card" fallback={CardError} fallbackProps={CARD_ERROR} resetKey={item}><LlmCard item={item} labelOf={labelOf} onOpen={() => openItem(item.id)} /></ErrorBoundary>)}</section>
                <MoreLoader ref={loadMoreRef} loading={loadingMore} more={hasMore} total={total} />
              </div>
            </div>
            : grandTotal
              ? <NothingMatches onClear={() => { clearAll(); setGroup('all') }} />
              : <p className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center text-sm text-[var(--muted)] ring-1 ring-[var(--line)]/70">The LLM feed is empty.</p>}

      {open && <ErrorBoundary name="llm-details" fallback={DialogError} fallbackProps={{ onClose: closeItem }} resetKey={open.id}><LlmDialog item={open} steps={open.journeyName ? stepsOf(open.journeyName) : NONE} labelOf={labelOf} now={now} onOpen={openItem} onClose={closeItem} /></ErrorBoundary>}
      {listSection && <ErrorBoundary name="llm-list" fallback={DialogError} fallbackProps={{ onClose: () => setListKey(null) }}><FilterListDialog title={`Pick the ${listSection.title.toLowerCase()}`} noun={listSection.title.toLowerCase()} options={listSection.options} value={filters[listKey]} countOf={(value) => countOf(listKey, value)} onApply={(values) => setFilters((current) => ({ ...current, [listKey]: values }))} onClose={() => setListKey(null)} /></ErrorBoundary>}
      {filterDialog && <ErrorBoundary name="llm-filter" fallback={DialogError} fallbackProps={{ onClose: () => setFilterDialog(false) }}><FeedFilterDialog title="Filter the LLM feed" sections={filterSections} value={filters} countOf={countOf} onApply={(next) => setFilters({ ...EMPTY_FILTERS, ...next })} onClose={() => setFilterDialog(false)} /></ErrorBoundary>}
    </main>
  </Shell>
}

function Badge({ tone, icon: Icon, children }) {
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${tone}`}>{Icon && <Icon size={11} weight="bold" />}{children}</span>
}


// Priority, impact, access (or cost) and skill level, as coloured badges.
function Badges({ item, labelOf }) {
  const access = item.cost || item.access
  return <div className="flex flex-wrap items-center gap-1.5">
    {item.priority && <Badge tone={(PRIORITY[item.priority] || PRIORITY.low)[0]} icon={Flag}>{labelOf('priority', item.priority)} priority</Badge>}
    {item.impact && <Badge tone={(IMPACT[item.impact] || IMPACT.minor)[0]} icon={Lightning}>{labelOf('impact_level', item.impact)} impact</Badge>}
    {access && <Badge tone={ACCESS_TONE[access] || ACCESS_TONE.closed_api} icon={ACCESS_ICONS[access] || Tag}>{labelOf(item.cost ? 'cost' : 'access', access)}</Badge>}
    {item.skillLevel && <Badge tone="bg-[var(--paper)] text-[var(--ink)] ring-[var(--line)]" icon={ChartBar}>{labelOf('skill_level', item.skillLevel)}</Badge>}
  </div>
}

// The card's tile: the learning format for learning items, else the content group.
function Tile({ item }) {
  const [GroupIcon, tone] = GROUPS[item.contentGroup] || [Circle, GROUPS.news[1]]
  const Icon = FORMATS[item.learningFormat] && item.contentGroup === 'learning' ? FORMATS[item.learningFormat] : GroupIcon
  return <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={21} weight="duotone" /></span>
}

// A highlighted line: what to do with it (Use for us), why it was suggested, or what you will get (Outcome).
function Callout({ icon: Icon, title, text, clamp = false }) {
  return <div className="flex gap-2.5 rounded-xl border-l-4 border-[var(--lime-dark)] bg-(--lime)/15 px-3.5 py-3">
    <Icon size={17} weight="fill" className="mt-0.5 shrink-0 text-[var(--lime-dark)]" />
    <div className="min-w-0"><p className={label}>{title}</p><p className={`mt-0.5 text-sm leading-6 ${clamp ? 'line-clamp-2' : ''}`}>{text}</p></div>
  </div>
}

function Tags({ tags, labelOf }) {
  if (!tags.length) return null
  return <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} style={skillStyle(tag)} className="skill-chip rounded-full px-2.5 py-1 text-xs font-semibold">{labelOf('tags', tag)}</span>)}</div>
}

// The facts that matter for the item's group: model, pricing and availability for news; format, duration, level and
// stack for learning and suggestions.
function Facts({ item, labelOf }) {
  if (item.contentGroup === 'news') return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <Metric icon={Cpu} caption="Model" value={item.modelName} wrap />
    <Metric icon={CurrencyDollar} caption="Pricing" value={item.pricing} wrap />
    <Metric icon={Plugs} caption="Available on" value={item.availability || (item.modelType && labelOf('model_type', item.modelType))} />
  </div>
  const FormatIcon = FORMATS[item.learningFormat] || BookOpen
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <Metric icon={FormatIcon} caption="Format" value={item.learningFormat && labelOf('learning_format', item.learningFormat)} />
    <Metric icon={Clock} caption="Duration" value={item.duration} />
    <Metric icon={Wrench} caption="Tech stack" value={item.techStack} wrap />
  </div>
}

// "Step 2 of 4" with a dot for every step.
function JourneyLine({ item }) {
  if (!item.journeyName) return null
  const total = item.totalSteps || item.stepNumber || 0
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-[var(--paper)] px-3.5 py-2.5 text-[13px] ring-1 ring-[var(--line)]/60">
    <Path size={15} weight="bold" className="text-[var(--accent-strong)]" />
    <span className="font-semibold">Step {item.stepNumber} of {total}</span>
    <span className="flex items-center gap-1" aria-hidden="true">{Array.from({ length: total }, (_, index) => <span key={index} className={`h-1.5 w-5 rounded-full ${index + 1 < item.stepNumber ? 'bg-[var(--lime-dark)]/50' : index + 1 === item.stepNumber ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`} />)}</span>
    <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{item.journeyName}</span>
  </div>
}

// A learning journey's steps in order, above the cards; each step opens its details.
function JourneyStrip({ name, steps, labelOf, onOpen }) {
  return <section className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
    <div className="flex flex-wrap items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-(--lime)/35 text-[var(--accent-strong)]"><Path size={20} weight="bold" /></span>
      <div className="min-w-0 flex-1"><p className={label}>Learning journey</p><h2 className="text-base font-semibold tracking-[-.02em]">{name}</h2></div>
      <span className="rounded-full bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]/70">{steps.length} steps</span>
    </div>
    <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map((step) => {
        const FormatIcon = FORMATS[step.learningFormat] || BookOpen
        return <li key={step.id}>
          <button type="button" onClick={() => onOpen(step.id)} className="flex h-full w-full flex-col gap-1.5 rounded-2xl bg-[var(--paper)] p-3 text-left ring-1 ring-[var(--line)]/60 transition-all duration-300 hover:-translate-y-0.5 hover:ring-[var(--lime-dark)]">
            <span className="flex items-center justify-between gap-2"><span className="grid size-6 place-items-center rounded-full bg-[var(--lime)] font-mono text-[11px] font-bold text-[#26320b]">{step.stepNumber}</span><ArrowRight size={13} className="text-[var(--muted)]" /></span>
            <span className="line-clamp-2 text-[13px] font-semibold leading-5">{step.name}</span>
            <span className="mt-auto flex items-center gap-1 text-[11px] text-[var(--muted)]"><FormatIcon size={11} />{labelOf('learning_format', step.learningFormat)}{step.duration && ` · ${step.duration}`}</span>
          </button>
        </li>
      })}
    </ol>
  </section>
}

function LlmCard({ item, labelOf, onOpen }) {
  const callout = item.useForUs ? [Lightbulb, 'Use for us', item.useForUs] : item.suggestedBecause ? [Sparkle, 'Suggested because', item.suggestedBecause] : item.outcome ? [Target, 'What you will get', item.outcome] : null
  return <article id={`feed-${item.id}`} data-feed-card={item.id} className={`flex scroll-mt-[calc(var(--shell-h)+1rem)] flex-col gap-3.5 rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)]`}>
    <header className="flex items-start gap-3">
      <Tile item={item} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{labelOf('news_type', item.newsType)}{item.company && <><span aria-hidden="true">·</span><Buildings size={11} weight="bold" />{labelOf('company', item.company)}</>}</p>
        <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-[-.02em]"><button type="button" onClick={onOpen} className="text-left hover:underline">{item.name}</button></h3>
      </div>
    </header>

    <Badges item={item} labelOf={labelOf} />
    <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">{item.summary || item.description}</p>
    <Facts item={item} labelOf={labelOf} />
    <JourneyLine item={item} />
    {callout && <Callout icon={callout[0]} title={callout[1]} text={callout[2]} clamp />}
    {item.whyItMatters && <p className="flex gap-2 text-[13px] leading-5 text-[var(--muted)]"><Info size={14} weight="bold" className="mt-0.5 shrink-0" /><span className="line-clamp-2"><b className="font-semibold text-[var(--ink)]">Why it matters: </b>{item.whyItMatters}</span></p>}
    <Tags tags={item.tags} labelOf={labelOf} />

    <footer className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1"><Globe size={12} />{labelOf('source', item.source)}</span>
        <span className="inline-flex items-center gap-1" title="Published"><CalendarBlank size={12} />{formatDate(item.publishedAt)}</span>
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

// One item: everything the CRM has on it, its links and its journey.
// `steps`: every step of the item's learning journey, in order (none when it is not in one).
function LlmDialog({ item, steps, labelOf, now, onOpen, onClose }) {
  const highlights = item.keyHighlights.split(/;\s*/).filter(Boolean)
  const facts = [
    [Buildings, 'Company / author', item.company && labelOf('company', item.company)],
    [Cpu, 'Model', item.modelName],
    [Stack, 'Model type', item.modelType && labelOf('model_type', item.modelType)],
    [Plugs, 'Available on', item.availability],
    [CurrencyDollar, 'Pricing', item.pricing],
    [Tag, 'Access', item.access && labelOf('access', item.access)],
    [Tag, 'Cost', item.cost && labelOf('cost', item.cost)],
    [GraduationCap, 'Topic', item.topic && labelOf('topic', item.topic)],
    [ChartBar, 'Skill level', item.skillLevel && labelOf('skill_level', item.skillLevel)],
    [Clock, 'Duration', item.duration],
    [ListChecks, 'Prerequisites', item.prerequisites],
    [Wrench, 'Tech stack', item.techStack],
    [Desktop, 'Hardware', item.hardware],
    [Globe, 'Source', labelOf('source', item.source)],
    [CalendarBlank, 'Published', formatDate(item.publishedAt)],
    [Tray, 'Added to the feed', item.addedAt && `${formatDate(item.addedAt)} · ${timeAgo(item.addedAt, now)}`],
  ].filter(([, , value]) => value)

  return <Modal onClose={onClose} wide contained>
    <DialogHeader eyebrow={`LLM · ${labelOf('content_group', item.contentGroup)} · ${labelOf('news_type', item.newsType)}`} title={item.name} onClose={onClose} />
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Badges item={item} labelOf={labelOf} />
      <div className="ml-auto flex flex-wrap items-center gap-2 text-xs font-bold">
        {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[#26320b] transition-transform hover:-translate-y-0.5"><Globe size={13} weight="bold" />Open source<ArrowSquareOut size={12} weight="bold" /></a>}
        {item.docsUrl && <a href={item.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><BookOpen size={13} weight="bold" />Docs<ArrowSquareOut size={12} weight="bold" /></a>}
      </div>
    </div>

    <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm leading-6">
        <TextBlock icon={Newspaper} title="What it is">{item.description || item.summary}</TextBlock>
        {highlights.length > 0 && <section><p className={`${label} flex items-center gap-1.5`}><ListChecks size={13} weight="bold" />Key highlights</p><ul className="mt-1.5 space-y-1">{highlights.map((line) => <li key={line} className="flex gap-2"><CheckCircle size={15} weight="fill" className="mt-1 shrink-0 text-[var(--lime-dark)]" />{line}</li>)}</ul></section>}
        {item.useForUs && <Callout icon={Lightbulb} title="Use for us" text={item.useForUs} />}
        {item.suggestedBecause && <Callout icon={Sparkle} title="Suggested because" text={item.suggestedBecause} />}
        {item.outcome && <Callout icon={Target} title="What you will get" text={item.outcome} />}
        <TextBlock icon={Info} title="Why it matters">{item.whyItMatters}</TextBlock>
        <TextBlock icon={Cpu} title="Specs">{item.specs}</TextBlock>
        <TextBlock icon={ChartBar} title="Benchmarks">{item.benchmarks}</TextBlock>
        <Tags tags={item.tags} labelOf={labelOf} />

        {steps.length > 0 && <section>
          <p className={`${label} flex items-center gap-1.5`}><Path size={13} weight="bold" />Journey: {item.journeyName}</p>
          <ol className="mt-2 space-y-1.5">{steps.map((step) => {
            const current = step.id === item.id
            return <li key={step.id}><button type="button" disabled={current} onClick={() => onOpen(step.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[13px] ring-1 transition-colors ${current ? 'bg-(--lime)/30 ring-[var(--lime-dark)]/40' : 'bg-[var(--paper)] ring-[var(--line)]/60 hover:ring-[var(--lime-dark)]'}`}>
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--lime)] font-mono text-[11px] font-bold text-[#26320b]">{step.stepNumber}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{step.name}</span>
            </button></li>
          })}</ol>
        </section>}

      </div>

      {/* The details list runs to the bottom of the left column, its rows spread evenly. */}
      <dl className="flex flex-col self-stretch rounded-2xl bg-[var(--paper)] px-3.5 py-1.5 text-[13px] ring-1 ring-[var(--line)]/70">
        {facts.map(([Icon, title, value]) => <div key={title} className="flex max-h-14 min-h-11 flex-1 items-center justify-between gap-3 border-t border-[var(--line)]/60 py-2 first:border-t-0">
          <dt className="flex shrink-0 items-center gap-2.5 text-[var(--muted)]"><FactIcon icon={Icon} title={title} />{title}</dt>
          <dd className="text-right font-semibold">{value}</dd>
        </div>)}
      </dl>
    </div>
  </Modal>
}
