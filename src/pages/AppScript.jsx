import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowClockwise, ArrowLeft, ArrowRight, ArrowSquareOut, Article, BookOpenText, Briefcase, CalendarBlank, ChartBar, ChatCircle, CheckCircle, CircleNotch, ClipboardText, Code, Coins, CurrencyDollar, DownloadSimple, EnvelopeSimple, Eye, FileText, Flag, Folder, Gauge, Globe, GoogleDriveLogo, Hourglass, Lightbulb, ListChecks, Minus, Plugs, PresentationChart, PuzzlePiece, Quotes, Sparkle, Stack, Table, Tag, Target, Timer, Tray, TrendDown, TrendUp, Users, VideoCamera, WarningCircle, X } from '@phosphor-icons/react'
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
import { FactIcon, FeedIndex, FilterButton, FilterChip, FilterStrip, Metric, MoreLoader } from '../components/FeedParts'
import { primaryButton } from '../components/ui'
import ErrorBoundary, { CardError, DialogError, SectionError } from '../components/ErrorBoundary'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { initDocSocket, subscribeDocStatus } from '../services/docSocket'
import { fillOutputNotificationLinks, outputTypeOf, recordDocNotification, removeNotification } from '../services/docNotifications'
import { EMPTY_DATE_RANGE } from '../lib/dateRange'
import { countFilters, useFeedIndex } from '../lib/feedView'
import { patchFeedItem, useGatewayFeed, useOpenItem } from '../lib/gatewayFeed'
import { skillStyle } from '../lib/jobSignals'
import { asObject } from '../lib/safe'
import { timeAgo, useNow } from '../lib/time'

/*
 * AppScript section: the outr_appscripts feed of Google Apps Script tools worth building: the problem, how it works,
 * the Google apps it uses, demand, trend, difficulty, how it earns and our edge. Same panel as WordPress and LLM:
 * search, sort, date, the strips and the universal filter. The smart gateway does the filtering, search, sorting and
 * counts; the fields holding several values per idea (Google apps, integrations, target users, tags) and the rank
 * sorts are finished on the page (see useGatewayFeed). Labels and choices come from the module's dropdown lists.
 * Generate (script, blog, video): the user adds a suggestion and starts it; the CRM gets the suggestion, the generate
 * box and "queued", and the page follows the status the generator sets until the document is ready (or failed).
 */

// Google apps: icon and colour (google_app keys). The card's tile shows the first app.
const APPS = {
  sheets: [Table, 'bg-[#dcf3e3] text-[#137333] dark:bg-[#163323] dark:text-[#81c995]'],
  gmail: [EnvelopeSimple, 'bg-[#fce4e2] text-[#c5221f] dark:bg-[#3d1a18] dark:text-[#f28b82]'],
  drive: [GoogleDriveLogo, 'bg-[#fef3d6] text-[#a56b00] dark:bg-[#3a2e17] dark:text-[#fdd663]'],
  docs: [FileText, 'bg-[#e1ecfd] text-[#1a56c4] dark:bg-[#1c2a45] dark:text-[#8ab4f8]'],
  forms: [ClipboardText, 'bg-[#efe4fb] text-[#6b2fa8] dark:bg-[#2e1f45] dark:text-[#d2b4fa]'],
  calendar: [CalendarBlank, 'bg-[#e1ecfd] text-[#1a56c4] dark:bg-[#1c2a45] dark:text-[#8ab4f8]'],
  slides: [PresentationChart, 'bg-[#fff0d7] text-[#b45309] dark:bg-[#3a2a17] dark:text-[#fbbf73]'],
  chat: [ChatCircle, 'bg-[#dcf3e3] text-[#137333] dark:bg-[#163323] dark:text-[#81c995]'],
}
const TREND = {
  rising: [TrendUp, 'text-[#3f7d1c] dark:text-[#a8d86e]'],
  stable: [Minus, 'text-[var(--muted)]'],
  declining: [TrendDown, 'text-[#9a3412] dark:text-[#fdba9a]'],
}
// Priority and difficulty (CRM fields): badge colours and the filter's colour dots.
const PRIORITY = {
  high: ['bg-[#fde2e1] text-[#b42318] ring-[#f7c1bd] dark:bg-[#3d1a18] dark:text-[#fca5a0] dark:ring-[#6b2a25]', 'bg-[#e5484d]'],
  medium: ['bg-[#f6e8b8] text-[#655419] ring-[#e8d48a] dark:bg-[#383017] dark:text-[#e8c867] dark:ring-[#56491f]', 'bg-[#e0a526]'],
  low: ['bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]', 'bg-[#94a3b8]'],
}
const DIFFICULTY = {
  easy: ['bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40', 'bg-[var(--lime-dark)]'],
  medium: ['bg-[#f6e8b8] text-[#655419] ring-[#e8d48a] dark:bg-[#383017] dark:text-[#e8c867] dark:ring-[#56491f]', 'bg-[#e0a526]'],
  hard: ['bg-[#fde2e1] text-[#b42318] ring-[#f7c1bd] dark:bg-[#3d1a18] dark:text-[#fca5a0] dark:ring-[#6b2a25]', 'bg-[#e5484d]'],
}
// How an idea earns (earning_model keys).
const EARNING_ICONS = { addon: PuzzlePiece, freelance_gig: Briefcase, template_sale: Tag, saas: Coins, internal_use: Users }
// What can be made from an idea: type (the CRM fields' prefix), icon, name, short name and an example suggestion.
const OUTPUTS = [
  ['script', Code, 'Apps Script code', 'Script', 'e.g. Also log every sent invoice with a timestamp in a "Sent log" sheet'],
  ['blog', Article, 'Blog post', 'Blog', 'e.g. Write for small agencies and say it works with a free Gmail account'],
  ['video', VideoCamera, 'Video', 'Video', 'e.g. Keep it under 60 seconds and end on a question'],
]
// Where an output stands. The generator sets the status; a ticked box with no status yet is waiting to start.
const STAGES = ['queued', 'processing', 'completed', 'failed']
const stageOf = (output) => (STAGES.includes(output?.status) ? output.status : output?.requested ? 'queued' : 'idle')
const isRunning = (stage) => stage === 'queued' || stage === 'processing'
// Each stage's label, colours and icon (the spinner turns while the output is being made).
const STAGE_LOOK = {
  queued: ['Queued', 'bg-[#f6e8b8] text-[#655419] ring-[#e8d48a] dark:bg-[#383017] dark:text-[#e8c867] dark:ring-[#56491f]', Hourglass],
  processing: ['Generating', 'bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40', CircleNotch],
  completed: ['Ready', 'bg-[#dcf3e3] text-[#137333] ring-[#b7e1c3] dark:bg-[#163323] dark:text-[#81c995] dark:ring-[#2a5a3c]', CheckCircle],
  failed: ['Failed', 'bg-[#fde2e1] text-[#b42318] ring-[#f7c1bd] dark:bg-[#3d1a18] dark:text-[#fca5a0] dark:ring-[#6b2a25]', WarningCircle],
}
// The steps shown while an output is made.
const STEPS = [['queued', 'Queued'], ['processing', 'Generating'], ['completed', 'Ready']]
// After a socket event, if the idea reads the same as before (the CRM not saved yet), it is read once more this later.
const RECHECK_MS = 3000
// Trend chips in the filters: green rising, grey stable, red declining.
const TREND_TONE = {
  rising: 'bg-[#e9f6dc] text-[#3f7d1c] dark:bg-[#1f3315] dark:text-[#a8d86e]',
  stable: 'bg-[var(--paper)] text-[var(--muted)]',
  declining: 'bg-[#fbe1d8] text-[#9a3412] dark:bg-[#4a2318] dark:text-[#fdba9a]',
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

const isFeed = (query) => String(query.queryKey[0]).startsWith('appscript-')
const GENERATE_KEY = ['appscript-generate']

// Starts making one output (suggestion, generate box and "queued" saved in the CRM), showing it as queued straight away.
// It is also the user's own notification (bell and toast, as for Site Content documents): the socket events move it on
// while the user is on any page, and it opens AppScript.
function useGenerate(item, type, name) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: GENERATE_KEY,
    mutationFn: (suggestion) => api.generateAppScriptOutput(item.id, type, suggestion),
    onMutate: async (suggestion) => {
      // A read already on its way would bring back the old status.
      await queryClient.cancelQueries({ predicate: isFeed })
      const before = item.generation
      patchFeedItem(queryClient, 'appscript', item.id, { generation: { ...before, [type]: { ...before[type], requested: true, status: 'queued', suggestion: suggestion.trim() } } })
      // Before the save: the socket can report "queued" the moment the CRM saves it.
      const notificationId = recordDocNotification({ mine: true, contentId: item.id, docType: type, path: '/appscript', status: 'queued', title: `${name} · ${item.name}` })
      return { before, notificationId }
    },
    onError: (_, __, context) => {
      if (context?.before) patchFeedItem(queryClient, 'appscript', item.id, { generation: context.before })
      if (context?.notificationId) removeNotification(context.notificationId)
    },
    onSettled: () => queryClient.invalidateQueries({ predicate: isFeed }),
  })
}

// While an output is queued or being made, the page does not ask the CRM on a timer: it listens to the backend's
// WebSocket (the doc-status events Site Content uses for its documents). When an event names one of these ideas or one
// of their documents, that idea's generation fields are read once, so the cards and the details follow each step
// (queued, generating, ready or failed). It is also read once when the watch starts (opening or coming back to the page,
// where the list can be a minute old) and whenever the socket (re)connects, for any change missed meanwhile.
function useGenerationWatch(items) {
  const queryClient = useQueryClient()
  const watched = useMemo(() => items.filter((item) => OUTPUTS.some(([type]) => isRunning(stageOf(item.generation[type])))), [items])
  const watchedRef = useRef(watched)
  useEffect(() => { watchedRef.current = watched }, [watched])
  const watching = watched.length > 0
  useEffect(() => {
    if (!watching) return undefined
    const timers = new Set()
    // `event`: the socket event that asked for this read (none for the first read and on reconnect).
    const read = async (ids, event) => {
      if (!ids.length) return
      const before = JSON.stringify(watchedRef.current.filter((item) => ids.includes(item.id)).map((item) => item.generation))
      try {
        const data = await api.getAppScriptGeneration(ids)
        Object.entries(data).forEach(([id, generation]) => {
          patchFeedItem(queryClient, 'appscript', id, { generation })
          // A finished output's links for the user's notification, when the socket event had none.
          OUTPUTS.forEach(([type]) => { if (generation[type].status === 'completed') fillOutputNotificationLinks(id, type, { viewUrl: generation[type].viewUrl, documentUrl: generation[type].downloadUrl }) })
        })
        // The event can come just before the CRM is saved: if the CRM does not show it yet, one more read a moment
        // later. An event names its output (raw.type), so that output's status tells; otherwise any change does.
        const type = outputTypeOf(event)
        const shown = OUTPUTS.some(([key]) => key === type)
          ? ids.every((id) => data[id]?.[type]?.status === event.status)
          : JSON.stringify(ids.map((id) => data[id]).filter(Boolean)) !== before
        if (event && !shown) {
          const timer = setTimeout(() => { timers.delete(timer); read(ids) }, RECHECK_MS)
          timers.add(timer)
        }
      } catch { /* the next event or reconnect reads it again */ }
    }
    const names = (event, item) => {
      const values = [event.contentId, event.noteId, ...Object.values(asObject(event.raw))].map((value) => String(value ?? ''))
      return values.includes(item.id) || OUTPUTS.some(([type]) => item.generation[type].docId && values.includes(item.generation[type].docId))
    }
    const unsubscribe = subscribeDocStatus((event) => read(watchedRef.current.filter((item) => names(event, item)).map((item) => item.id), event))
    const socket = initDocSocket()
    const catchUp = () => read(watchedRef.current.map((item) => item.id))
    socket.on('connect', catchUp)
    // The first read; not while Generate is saving (it could bring back the old status: the save refreshes the list).
    if (!queryClient.isMutating({ mutationKey: GENERATE_KEY })) catchUp()
    return () => {
      unsubscribe()
      socket.off('connect', catchUp)
      timers.forEach(clearTimeout)
    }
  }, [watching, queryClient])
}

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
  const { options, labelOf, items, total, grandTotal, countOf, refresh, loading, isError, error, updating, hasMore, loadingMore, loadMoreRef } = useGatewayFeed({
    feed: 'appscript', fields: FIELDS, filters, search, dateFilter, dateField: 'posted_date', sort, localSorts: LOCAL_SORTS,
    stripKeys: STRIP_KEYS, openKeys: filterDialog || listKey ? ALL_KEYS : undefined,
  })
  const { activeId, jumpTo } = useFeedIndex(items)
  // The open idea is in the link (?appscript=id); one opened from a link that is not in the list is followed too.
  const { open, openItem, closeItem } = useOpenItem('appscript', items, 'appscript')
  // A line per idea in the lists (the page's and the drawer's): app, category, age, and the demand score.
  const indexMeta = (item) => { const [AppIcon] = APPS[item.apps[0]] || [Stack]; return <><AppIcon size={10} /><span className="truncate">{labelOf('category', item.category)} · {timeAgo(item.publishedAt, now)}</span></> }
  const indexMark = (item) => item.demandScore != null && <span title={`Demand score ${item.demandScore}`} className="mt-0.5 shrink-0 self-start rounded-md bg-[var(--paper)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--muted)] ring-1 ring-[var(--line)]/70">{item.demandScore}</span>
  const watchedItems = useMemo(() => (open && !items.some((item) => item.id === open.id) ? [...items, open] : items), [items, open])
  useGenerationWatch(watchedItems)
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

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
      <SectionPanel>
        {/* Row 1: title, search, then sort, date, the universal filter and refresh. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
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
        {Object.keys(options).length > 0 && <ErrorBoundary name="appscript-filters" fallbackProps={FILTERS_ERROR} resetKey={options}><div className="grid gap-2 border-t border-[var(--line)]/70 px-4 py-3 sm:px-6 xl:grid-cols-3">
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
              <div className="min-w-0">
                <section className={`grid content-start gap-4 transition-opacity min-[1400px]:grid-cols-2 ${updating ? 'opacity-60' : ''}`}>{items.map((item) => <ErrorBoundary key={item.id} name="appscript-card" fallback={CardError} fallbackProps={CARD_ERROR} resetKey={item}><IdeaCard item={item} labelOf={labelOf} onOpen={() => openItem(item.id)} /></ErrorBoundary>)}</section>
                <MoreLoader ref={loadMoreRef} loading={loadingMore} more={hasMore} total={total} />
              </div>
            </div>
            : grandTotal
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

// Demand (score and bar), trend, build time and price, each with its icon.
function Metrics({ item, labelOf }) {
  const [TrendIcon, trendTone] = TREND[item.trend] || TREND.stable
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <Metric icon={Gauge} tone="text-[var(--lime-dark)]" caption="Demand" value={item.demandScore != null && <span className="font-mono">{item.demandScore}<span className="text-[11px] text-[var(--muted)]">/100</span></span>}>
      {item.demandScore != null && <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full rounded-full bg-[var(--lime-dark)]" style={{ width: `${Math.min(100, item.demandScore)}%` }} /></span>}
    </Metric>
    <Metric icon={TrendIcon} tone={trendTone} caption="Trend" value={item.trend && <span className={trendTone}>{labelOf('trend', item.trend)}</span>} />
    <Metric icon={Timer} caption="Build time" value={item.buildTime} />
    <Metric icon={CurrencyDollar} caption="Price" value={item.priceRange} wrap />
  </div>
}

// A highlighted line: the problem it solves, or our edge.
function Callout({ icon: Icon, title, text, clamp = false, tone = 'lime' }) {
  const colours = tone === 'lime' ? 'border-[var(--lime-dark)] bg-(--lime)/15' : 'border-[#e0a526] bg-[#fdf3d7] dark:bg-[#383017]/60'
  return <div className={`flex gap-2.5 rounded-xl border-l-4 px-3.5 py-3 ${colours}`}>
    <Icon size={17} weight="fill" className={`mt-0.5 shrink-0 ${tone === 'lime' ? 'text-[var(--lime-dark)]' : 'text-[#b7791f] dark:text-[#e8c867]'}`} />
    <div className="min-w-0"><p className={label}>{title}</p><p className={`mt-0.5 text-sm leading-6 ${clamp ? 'line-clamp-2' : ''}`}>{text}</p></div>
  </div>
}

function Tags({ tags, labelOf }) {
  if (!tags.length) return null
  return <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} style={skillStyle(tag)} className="skill-chip rounded-full px-2.5 py-1 text-xs font-semibold">{labelOf('tags', tag)}</span>)}</div>
}

function IdeaCard({ item, labelOf, onOpen }) {
  const made = OUTPUTS.map(([type, icon, , short]) => [type, icon, short, stageOf(item.generation[type])]).filter(([, , , stage]) => stage !== 'idle')
  return <article id={`feed-${item.id}`} data-feed-card={item.id} className={`flex scroll-mt-[calc(var(--shell-h)+1rem)] flex-col gap-3.5 rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)]`}>
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

function ChipList({ icon: Icon, title, values, field, labelOf }) {
  if (!values.length) return null
  return <section><p className={`${label} flex items-center gap-1.5`}><Icon size={13} weight="bold" />{title}</p><div className="mt-2 flex flex-wrap gap-1.5">{values.map((value) => <span key={value} className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-xs font-semibold ring-1 ring-[var(--line)]/70">{labelOf(field, value)}</span>)}</div></section>
}

// One idea: how it works, the problem, features, apps, integrations, users, the competition and our edge, plus Generate
// (script, blog, video) with each one's status. `onPanel(type)` opens an output's Prompt & guidelines (null closes).
function IdeaDetails({ item, labelOf, now, panelType, onPanel }) {
  const facts = [
    [Folder, 'Category', labelOf('category', item.category)],
    [Gauge, 'Demand score', item.demandScore != null && `${item.demandScore} / 100`],
    [ListChecks, 'Demand proof', item.demandProof],
    [Timer, 'Build time', item.buildTime],
    [CurrencyDollar, 'Price range', item.priceRange],
    [Coins, 'Earning model', item.earningModel && labelOf('earning_model', item.earningModel)],
    [Stack, 'Similar tools', item.similarTools],
    [Globe, 'Source', labelOf('source', item.source)],
    [CalendarBlank, 'Posted', formatDate(item.publishedAt)],
    [Tray, 'Added to the feed', item.addedAt && `${formatDate(item.addedAt)} · ${timeAgo(item.addedAt, now)}`],
  ].filter(([, , value]) => value)

  return <>
    <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">AppScript · {labelOf('category', item.category)}</p>
    <h2 className="mt-3 text-3xl font-semibold tracking-[-.05em]">{item.name}</h2>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Badges item={item} labelOf={labelOf} />
      {item.sourceUrl && <span className="ml-auto text-xs font-bold"><a href={item.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[#26320b] transition-transform hover:-translate-y-0.5"><Globe size={13} weight="bold" />Open on {labelOf('source', item.source)}<ArrowSquareOut size={12} weight="bold" /></a></span>}
    </div>
    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.pitch}</p>
    <div className="mt-3"><AppChips apps={item.apps} labelOf={labelOf} /></div>
    <div className="mt-4"><Metrics item={item} labelOf={labelOf} /></div>

    <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm leading-6">
        {item.problem && <Callout icon={Target} title="Problem it solves" text={item.problem} tone="amber" />}
        <TextBlock icon={Code} title="How it works">{item.description}</TextBlock>
        {item.features.length > 0 && <section><p className={`${label} flex items-center gap-1.5`}><ListChecks size={13} weight="bold" />Key features</p><ul className="mt-1.5 grid gap-1 sm:grid-cols-2">{item.features.map((feature) => <li key={feature} className="flex gap-2"><CheckCircle size={15} weight="fill" className="mt-1 shrink-0 text-[var(--lime-dark)]" /><span className="first-letter:uppercase">{feature}</span></li>)}</ul></section>}
        {item.edge && <Callout icon={Lightbulb} title="Our edge" text={item.edge} />}
        <ChipList icon={Plugs} title="Integrations" values={item.integrations} field="integrations" labelOf={labelOf} />
        <ChipList icon={Users} title="Target users" values={item.targetUsers} field="target_users" labelOf={labelOf} />
        <Tags tags={item.tags} labelOf={labelOf} />
      </div>

      <div className="space-y-4">
        <dl className="rounded-2xl bg-[var(--paper)] p-3.5 text-[13px] ring-1 ring-[var(--line)]/70">
          {facts.map(([Icon, title, value]) => <div key={title} className="flex items-start justify-between gap-3 border-t border-[var(--line)]/60 py-2 first:border-t-0 first:pt-0 last:pb-0">
            <dt className="flex shrink-0 items-center gap-2.5 text-[var(--muted)]"><FactIcon icon={Icon} title={title} />{title}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>)}
        </dl>

      </div>
    </div>

    {/* Generate: a suggestion first, then Start; the generator makes it and its status shows here as it goes. Each
        output's prompt and guidelines (CRM) can be read and edited first. */}
    <section className="mt-5 rounded-2xl bg-[var(--paper)] p-3.5 ring-1 ring-[var(--line)]/70 sm:p-4">
      <p className={`${label} flex items-center gap-1.5`}><Sparkle size={13} weight="bold" />Generate from this idea</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Check the prompt and guidelines, add a suggestion, then start. When it is ready you can view it, download it or regenerate it with a new suggestion.</p>
      <div className="mt-3 grid gap-2">
        {OUTPUTS.map(([type, icon, name, short, example]) => <OutputRow key={type} item={item} type={type} icon={icon} name={name} short={short} example={example} panelOpen={panelType === type} onPanel={() => onPanel(panelType === type ? null : type)} />)}
      </div>
    </section>
  </>
}

// The idea opens like a job preview: a drawer from the right over the page. Down its left side the ideas listed on the
// page, to move between them (the open one marked); beside it the details. Each side scrolls on its own. An output's
// Prompt & guidelines opens on the right of the details while the list makes room (on a phone, in the details' place).
// Esc closes the Prompt & guidelines first, then the drawer.
function IdeaDrawer({ item, items, labelOf, now, indexMeta, indexMark, onSelect, onClose }) {
  const panel = useRef(null)
  const body = useRef(null)
  const [opened, setOpened] = useState(null)
  const panelType = opened?.id === item.id ? opened.type : null
  const onPanel = (type) => setOpened(type ? { id: item.id, type } : null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  const panelRef = useRef(panelType)
  useEffect(() => { panelRef.current = panelType }, [panelType])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tween = reduce ? null : gsap.fromTo(panel.current, { xPercent: 100 }, { xPercent: 0, duration: .5, ease: 'power4.out' })
    // Not while a dialog or a dropdown is open on top.
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || document.querySelector('[data-modal-panel], [role="listbox"]')) return
      if (panelRef.current) setOpened(null)
      else closeRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { tween?.kill(); document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [])
  // Another idea opens at its top.
  useEffect(() => { body.current?.scrollTo({ top: 0 }) }, [item.id])

  return createPortal(
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[90] flex justify-end bg-[var(--ink)]/45">
      <aside ref={panel} aria-label={`AppScript idea: ${item.name}`} className="flex h-full w-full max-w-[min(96vw,84rem)] flex-col overflow-hidden bg-[var(--paper)] shadow-[-35px_0_90px_rgba(0,0,0,.22)] ring-1 ring-black/5 sm:rounded-l-[2rem]">
        <header className="flex items-center gap-2 border-b border-[var(--line)]/70 bg-[var(--surface)] px-4 py-3 sm:rounded-tl-[2rem] sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">AppScript idea</p>
            <p className="truncate text-sm font-semibold" title={item.name}>{item.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close the idea" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform hover:scale-105"><X size={15} weight="bold" /></button>
        </header>
        <div className="flex min-h-0 flex-1">
          {!panelType && <div className="hidden w-72 shrink-0 border-r border-[var(--line)]/70 p-3 lg:block">
            <FeedIndex fill items={items} activeId={item.id} onJump={onSelect} meta={indexMeta} mark={indexMark} />
          </div>}
          <div ref={body} className={`min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 [scrollbar-width:thin] sm:px-8 ${panelType ? 'hidden lg:block' : ''}`}>
            <ErrorBoundary name="appscript-idea" resetKey={item.id} fallback={SectionError} fallbackProps={{ title: 'This idea could not load' }}><IdeaDetails item={item} labelOf={labelOf} now={now} panelType={panelType} onPanel={onPanel} /></ErrorBoundary>
          </div>
          {panelType && <div className="flex min-h-0 w-full flex-col p-3 lg:w-[42%] lg:shrink-0 lg:border-l lg:border-[var(--line)]/70">
            <ErrorBoundary name="appscript-instructions" resetKey={panelType} fallback={SectionError} fallbackProps={{ title: 'The prompt and guidelines could not load' }}><InstructionsPanel type={panelType} onType={onPanel} onClose={() => onPanel(null)} /></ErrorBoundary>
          </div>}
        </div>
      </aside>
    </div>,
    document.body,
  )
}

// A stage as a small coloured chip (the card's line of outputs and each output's header in the details).
function StageChip({ icon: Icon, name, stage }) {
  const [text, tone, StageIcon] = STAGE_LOOK[stage]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}>
    {Icon && <Icon size={11} weight="bold" />}{name ? `${name} · ${text}` : text}
    <StageIcon size={11} weight={stage === 'processing' ? 'bold' : 'fill'} className={stage === 'processing' ? 'animate-spin' : stage === 'queued' ? 'animate-pulse' : ''} />
  </span>
}

// One output in the details, on one line: name and status, then Prompt & guidelines, View and Download (when ready)
// and Generate (Regenerate once it has a status). Generate opens the suggestion box, prefilled with the last
// suggestion; Start saves it and the output shows its steps while it is made.
function OutputRow({ item, type, icon: Icon, name, short, example, panelOpen, onPanel }) {
  const output = item.generation[type]
  const stage = stageOf(output)
  const running = isRunning(stage)
  // The suggestion being written; null while the box is closed.
  const [draft, setDraft] = useState(null)
  const generate = useGenerate(item, type, name)
  const start = (event) => {
    event.preventDefault()
    const text = draft
    setDraft(null)
    // If it cannot be saved, the box opens again with what was written.
    generate.mutate(text, { onError: () => setDraft(text) })
  }
  const pill = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors'

  return <div data-output={type} className="rounded-xl bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* The name never shrinks: when the buttons do not fit beside it, they go to the next line. */}
      <span className="flex min-w-fit flex-1 items-center gap-2.5">
        <Icon size={16} weight="bold" className={`shrink-0 ${stage === 'idle' ? 'text-[var(--muted)]' : 'text-[var(--accent-strong)]'}`} />
        <span className="whitespace-nowrap text-[13px] font-semibold">{name}</span>
        {stage !== 'idle' && <span key={stage} className="shrink-0 animate-[domain-chip-in_.35s_ease-out]"><StageChip stage={stage} /></span>}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
        <button type="button" onClick={onPanel} aria-pressed={panelOpen} title={panelOpen ? 'Close the prompt and guidelines' : 'Open the prompt and guidelines beside the details'} className={`${pill} ring-1 ${panelOpen ? 'bg-(--lime)/35 text-[var(--ink)] ring-[var(--lime-dark)]/40' : 'text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}><BookOpenText size={13} weight="bold" />Prompt &amp; guidelines</button>
        {stage === 'completed' && output.viewUrl && <a href={output.viewUrl} target="_blank" rel="noreferrer" className={`${pill} bg-[var(--lime)] text-[#26320b] hover:-translate-y-0.5`}><Eye size={13} weight="bold" />View</a>}
        {stage === 'completed' && output.downloadUrl && <a href={output.downloadUrl} target="_blank" rel="noreferrer" className={`${pill} bg-[var(--paper)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)]`}><DownloadSimple size={13} weight="bold" />Download</a>}
        {!running && draft === null && <button type="button" onClick={() => { generate.reset(); setDraft(output.suggestion) }} className={`${pill} ${stage === 'idle' ? 'bg-[var(--text)] text-[var(--paper)] hover:-translate-y-0.5' : 'bg-[var(--paper)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)]'}`}>
          {stage === 'idle' ? <><Sparkle size={12} weight="fill" />Generate</> : <><ArrowClockwise size={12} weight="bold" />Regenerate</>}
        </button>}
      </div>
    </div>

    {running && <GenerateProgress stage={stage} name={short.toLowerCase()} />}
    {stage !== 'idle' && output.suggestion && draft === null && <p className="mt-2 flex gap-1.5 text-xs leading-5 text-[var(--muted)]"><Quotes size={12} weight="fill" className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{output.suggestion}</span></p>}
    {stage === 'failed' && draft === null && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">It could not be made this time. Regenerate it, maybe with another suggestion.</p>}

    {draft !== null && <form onSubmit={start} className="mt-3">
      <label className="block">
        <span className={label}>Your suggestion (optional)</span>
        <span className="block text-[13px] leading-5"><textarea autoFocus rows={3} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={example} className="mt-1.5 w-full resize-y rounded-xl bg-[var(--paper)] px-3 py-2 text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-[var(--lime-dark)]" /></span>
      </label>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs font-bold">
        <button type="button" onClick={() => setDraft(null)} className="rounded-full px-3 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
        <span className="text-xs font-bold"><button type="submit" className={`${pill} bg-[var(--text)] text-[var(--paper)] hover:-translate-y-0.5`}><Sparkle size={12} weight="fill" />{stage === 'idle' ? 'Start generating' : 'Start regenerating'}</button></span>
      </div>
    </form>}
    {generate.isError && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger)]">{generate.error?.message || 'It could not be started. Please try again.'}</p>}
  </div>
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

// While an output is made: the steps, each a bar (done: full, current: moving) with its name, and what is happening.
function GenerateProgress({ stage, name }) {
  const at = STEPS.findIndex(([key]) => key === stage)
  return <div role="status" aria-live="polite" className="mt-2.5">
    <ol className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
      {STEPS.map(([key, text], index) => <li key={key} className={index <= at ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}>
        <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--line)]/70">
          {index < at && <span className="block h-full rounded-full bg-[var(--lime-dark)]" />}
          {index === at && <span className="session-loader-progress block h-full w-1/2 rounded-full bg-[var(--lime-dark)]" />}
        </span>
        <span className="mt-1.5 flex items-center gap-1">
          {index < at ? <CheckCircle size={12} weight="fill" className="shrink-0 text-[var(--lime-dark)]" /> : index === at ? <CircleNotch size={12} weight="bold" className="shrink-0 animate-spin text-[var(--accent-strong)]" /> : <span className="size-1.5 shrink-0 rounded-full bg-[var(--line)]" />}
          {text}
        </span>
      </li>)}
    </ol>
    <p className="mt-2 text-xs text-[var(--muted)]">{stage === 'queued' ? `Waiting for the generator to start the ${name}…` : `Generating the ${name}…`} The status updates here by itself.</p>
  </div>
}
