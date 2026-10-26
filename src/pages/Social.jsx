import { useMemo, useState } from 'react'
import { ArrowSquareOut, Article, CalendarBlank, Cards, ChartBarHorizontal, ChatCircle, Check, CircleDashed, Clock, Copy, DeviceMobile, Eye, FacebookLogo, FilePdf, FileText, FilmReel, Hash, Heart, Image, InstagramLogo, Lightbulb, LinkedinLogo, ListBullets, ListNumbers, Megaphone, Minus, PaperPlaneTilt, Recycle, RedditLogo, ShareFat, Sparkle, Stack, Tag, Target, TextAa, ThreadsLogo, TiktokLogo, Tray, TrendDown, TrendUp, UsersThree, VideoCamera, XLogo, YoutubeLogo } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LogoLoader from '../components/LogoLoader'
import DateTimeRangeFilter from '../components/DateTimeRangeFilter'
import { ActiveDateFilterChip, RefreshFilterButton } from '../components/FilterToolbarControls'
import { SortMenu } from '../components/JobListControls'
import { ClearFilters, NothingMatches, SectionPanel, sectionLabel as label } from '../components/SectionControls'
import FeedSearch from '../components/FeedSearch'
import FeedFilterDialog from '../components/FeedFilterDialog'
import FilterListDialog from '../components/FilterListDialog'
import { FactIcon, FilterButton, FilterChip, FilterStrip, Metric, MoreLoader } from '../components/FeedParts'
import { DialogHeader, Modal, primaryButton } from '../components/ui'
import ErrorBoundary, { CardError, DialogError } from '../components/ErrorBoundary'
import { useAuth } from '../contexts/AuthContext'
import { EMPTY_DATE_RANGE } from '../lib/dateRange'
import { countFilters } from '../lib/feedView'
import { useGatewayFeed, useOpenItem } from '../lib/gatewayFeed'
import { timeAgo, useNow } from '../lib/time'
import { useWideScreen } from '../lib/media'

/*
 * Social section: the outr_socials drafts, ready-to-post social media posts per platform. Same panel as WordPress, LLM
 * and AppScript (search, sort, date, strips, universal filter): the queue of posts on the left (platform, title,
 * format, its results, expected reach) and, on a wide screen, the details of one post on the
 * right (the picked one, else the first), the same as its details dialog; on a phone a post opens in that dialog. The smart gateway does the filtering, search, sorting, paging and
 * counts; hashtags and "repurpose for" are finished on the page (see useGatewayFeed).
 * Read only: no post status for now.
 */

// Platform: logo, logo tile, soft chip colours and the post's character limit (platform keys).
const PLATFORMS = {
  linkedin: { icon: LinkedinLogo, tile: 'bg-[#0a66c2] text-white', tone: 'bg-[#e1edf9] text-[#0a66c2] dark:bg-[#0a66c2]/25 dark:text-[#8cc0f2]', limit: 3000 },
  x: { icon: XLogo, tile: 'bg-[#111] text-white dark:bg-white dark:text-[#111]', tone: 'bg-[#e8eaf0] text-[#111] dark:bg-white/10 dark:text-white', limit: 280 },
  instagram: { icon: InstagramLogo, tile: 'bg-gradient-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white', tone: 'bg-[#fde2ef] text-[#c1356f] dark:bg-[#dd2a7b]/20 dark:text-[#f6a5c8]', limit: 2200 },
  facebook: { icon: FacebookLogo, tile: 'bg-[#1877f2] text-white', tone: 'bg-[#e3eefd] text-[#1660c9] dark:bg-[#1877f2]/25 dark:text-[#93bdf7]', limit: 63206 },
  youtube: { icon: YoutubeLogo, tile: 'bg-[#ff0000] text-white', tone: 'bg-[#fde2e1] text-[#c8102e] dark:bg-[#ff0000]/20 dark:text-[#ff9b9b]', limit: 5000 },
  tiktok: { icon: TiktokLogo, tile: 'bg-[#111] text-[#25f4ee] dark:bg-[#25f4ee] dark:text-[#111]', tone: 'bg-[#dcf9f8] text-[#0b7f7b] dark:bg-[#25f4ee]/15 dark:text-[#7cf2ee]', limit: 2200 },
  threads: { icon: ThreadsLogo, tile: 'bg-[#111] text-white dark:bg-white dark:text-[#111]', tone: 'bg-[#e8eaf0] text-[#111] dark:bg-white/10 dark:text-white', limit: 500 },
  reddit: { icon: RedditLogo, tile: 'bg-[#ff4500] text-white', tone: 'bg-[#ffe6dc] text-[#c43a00] dark:bg-[#ff4500]/20 dark:text-[#ffa27a]', limit: 40000 },
}
const NO_PLATFORM = { icon: Megaphone, tile: 'bg-[var(--paper)] text-[var(--muted)]', tone: 'bg-[var(--paper)] text-[var(--muted)]', limit: null }
// Post format icons (post_format keys).
const FORMATS = { text_post: TextAa, carousel: Cards, image: Image, reel: FilmReel, short: DeviceMobile, thread: ListBullets, long_video: VideoCamera, story: CircleDashed, poll: ChartBarHorizontal, article: FileText, document_pdf: FilePdf }
const GOALS = { reach: Megaphone, engagement: Heart, leads: Target, brand: Sparkle, traffic: ArrowSquareOut }
const TREND = {
  rising: [TrendUp, 'text-[#3f7d1c] dark:text-[#a8d86e]', 'bg-[#e9f6dc] text-[#3f7d1c] dark:bg-[#1f3315] dark:text-[#a8d86e]'],
  stable: [Minus, 'text-[var(--muted)]', 'bg-[var(--paper)] text-[var(--muted)]'],
  declining: [TrendDown, 'text-[#9a3412] dark:text-[#fdba9a]', 'bg-[#fbe1d8] text-[#9a3412] dark:bg-[#4a2318] dark:text-[#fdba9a]'],
}
const SORTS = [{ id: 'reach', label: 'Highest expected reach' }, { id: 'newest', label: 'Newest first' }, { id: 'views', label: 'Most views' }]
// Universal filter: key -> [CRM field, item field, matched on the page]. Hashtags and "repurpose for" hold several
// values per post, which the gateway cannot OR, so they are matched on the page.
const FIELDS = {
  platforms: ['platform', 'platform'], formats: ['post_format', 'format'], niches: ['niche', 'niche'], contentTypes: ['content_type', 'contentType'],
  goals: ['goal', 'goal'], trends: ['trend', 'trend'], hashtags: ['hashtags', 'hashtags', true], repurpose: ['repurpose_for', 'repurposeFor', true]
}
const EMPTY_FILTERS = Object.fromEntries(Object.keys(FIELDS).map((key) => [key, []]))
// The filters shown on the page (the universal filter has them all): key and icon.
const STRIPS = [['platforms', Megaphone], ['formats', Cards], ['niches', Tag]]
const STRIP_KEYS = STRIPS.map(([key]) => key)
// Error fallbacks: a card, the index, the strips or a dialog fail on their own; the rest of the page
// keeps working.
const CARD_ERROR = { what: 'post' }
const DETAILS_ERROR = { title: 'These details could not load' }
const FILTERS_ERROR = { title: 'The filters could not load', className: 'm-3' }
const ALL_KEYS = Object.keys(FIELDS)
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const platformOf = (key) => PLATFORMS[key] || NO_PLATFORM
const posted = (item) => [item.views, item.likes, item.comments, item.shares, item.leads].some((value) => value != null)

export default function Social() {
  const now = useNow()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [dateFilter, setDateFilter] = useState(EMPTY_DATE_RANGE)
  const [sort, setSort] = useState('reach')
  const [filterDialog, setFilterDialog] = useState(false)
  const [listKey, setListKey] = useState(null)

  // Counts: the strips all the time, every group while the universal filter or a full list is open.
  const { options, labelOf, items, total, grandTotal, countOf, refresh, loading, isError, error, updating, hasMore, loadingMore, loadMoreRef } = useGatewayFeed({
    feed: 'social', fields: FIELDS, filters, search, dateFilter, dateField: 'published_date', sort,
    stripKeys: STRIP_KEYS, openKeys: filterDialog || listKey ? ALL_KEYS : undefined,
  })
  // Search suggestions: the most used hashtags among the posts shown (search matches hashtag names).
  const searchSuggestions = useMemo(() => {
    const counts = {}
    items.forEach((item) => item.hashtags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag]) => labelOf('hashtags', tag).replace(/^#/, ''))
  }, [items, labelOf])

  const used = (key) => options[FIELDS[key][0]] || []
  const filterSections = [
    { key: 'platforms', title: 'Platforms', icon: Megaphone, kind: 'cards', options: used('platforms').map((option) => ({ ...option, icon: platformOf(option.value).icon, tone: platformOf(option.value).tone })) },
    { key: 'formats', title: 'Formats', icon: Cards, kind: 'cards', options: used('formats').map((option) => ({ ...option, icon: FORMATS[option.value] || Article })) },
    { key: 'niches', title: 'Niches', icon: Tag, kind: 'chips', options: used('niches') },
    { key: 'contentTypes', title: 'Content types', icon: Stack, kind: 'chips', options: used('contentTypes') },
    { key: 'goals', title: 'Goals', icon: Target, kind: 'cards', options: used('goals').map((option) => ({ ...option, icon: GOALS[option.value] || Target })) },
    { key: 'trends', title: 'Trends', icon: TrendUp, kind: 'cards', options: used('trends').map((option) => ({ ...option, icon: (TREND[option.value] || TREND.stable)[0], tone: (TREND[option.value] || TREND.stable)[2] })) },
    { key: 'repurpose', title: 'Repurpose for', icon: Recycle, kind: 'cards', options: used('repurpose').map((option) => ({ ...option, icon: platformOf(option.value).icon, tone: platformOf(option.value).tone })) },
    { key: 'hashtags', title: 'Hashtags', icon: Hash, kind: 'chips', options: used('hashtags') },
  ]
  const filterCount = countFilters(filters)
  const hasFilters = Boolean(search || filterCount || dateFilter.preset !== 'all')
  const clearAll = () => { setSearch(''); setFilters(EMPTY_FILTERS); setDateFilter(EMPTY_DATE_RANGE) }
  const removeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key].filter((entry) => entry !== value) }))
  const activeChips = Object.entries(FIELDS).flatMap(([key, [field]]) => filters[key].map((value) => [key, value, labelOf(field, value)]))
  const listSection = filterSections.find((entry) => entry.key === listKey)
  // The picked post is in the link (?social=id). A wide screen shows it beside the queue (the first post until one is
  // picked); a phone opens it in a dialog.
  const wide = useWideScreen()
  const { open, openItem, closeItem } = useOpenItem('social', items, 'social')
  const shown = open || items[0]
  const pick = openItem

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
      <SectionPanel>
        {/* Row 1: title, search, then sort, date, the universal filter and refresh. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <h1 className="flex shrink-0 items-baseline gap-2 text-2xl font-semibold tracking-[-.04em]">Social<span className="font-mono text-[13px] font-semibold tracking-normal text-[var(--muted)] tabular-nums">{loading || updating ? '…' : `${total} of ${grandTotal ?? total}`}</span></h1>
          <FeedSearch value={search} onChange={setSearch} email={user?.email} scope="social" suggestions={searchSuggestions} placeholder="Search posts, hooks, hashtags, platforms…" label="Search the social posts" />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SortMenu value={sort} options={SORTS} onChange={setSort} label="Sort the posts" />
            <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Published" />
            <FilterButton count={filterCount} onClick={() => setFilterDialog(true)} title="Filter by platform, format, niche, goal, hashtags and more" />
            <RefreshFilterButton onClick={refresh} loading={updating} label="Refresh the posts" />
          </div>
        </div>

        {/* Row 2: the main filters on the page, a few choices at a time; the wheel opens each whole list. */}
        {Object.keys(options).length > 0 && <ErrorBoundary name="social-filters" fallbackProps={FILTERS_ERROR} resetKey={options}><div className="grid gap-2 border-t border-[var(--line)]/70 px-4 py-3 sm:px-6 xl:grid-cols-3">
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
        ? <LogoLoader className="min-h-[40dvh]" label="Loading the social posts" />
        : isError
          ? <section className="py-24 text-center">
            <h3 className="text-xl font-semibold">Could not load the social posts</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p>
            <button type="button" onClick={refresh} className={`${primaryButton} mt-6`}>Try again</button>
          </section>
          : items.length
            ? <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)]">
              {/* On a wide screen each side scrolls on its own: the queue here, the details beside it. At either end the
                  page carries on scrolling. */}
              <div className="min-w-0 lg:sticky lg:top-[calc(var(--shell-h)+1rem)] lg:flex lg:max-h-[calc(100dvh-var(--shell-h)-2rem)] lg:flex-col">
                <p className={`${label} mb-2.5 shrink-0 px-1`}>{total} {total === 1 ? 'post' : 'posts'} in the queue</p>
                <div data-feed-queue className="min-h-0 lg:-m-1 lg:flex-1 lg:overflow-y-auto lg:p-1 lg:[scrollbar-width:thin]">
                  <ol className={`space-y-2 transition-opacity ${updating ? 'opacity-60' : ''}`}>{items.map((item) => <li key={item.id}><ErrorBoundary name="social-row" fallback={CardError} fallbackProps={CARD_ERROR} resetKey={item}><PostRow item={item} labelOf={labelOf} selected={item.id === shown?.id} onPick={() => pick(item.id)} /></ErrorBoundary></li>)}</ol>
                  <MoreLoader ref={loadMoreRef} loading={loadingMore} more={hasMore} total={total} />
                </div>
              </div>
              {shown && <div className="sticky top-[calc(var(--shell-h)+1rem)] hidden max-h-[calc(100dvh-var(--shell-h)-2rem)] overflow-y-auto rounded-[1.6rem] [scrollbar-width:thin] lg:block">
                <ErrorBoundary name="social-details-panel" fallbackProps={DETAILS_ERROR} resetKey={shown}><PostPanel item={shown} labelOf={labelOf} now={now} /></ErrorBoundary>
              </div>}
            </div>
            : grandTotal
              ? <NothingMatches onClear={clearAll} />
              : <p className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center text-sm text-[var(--muted)] ring-1 ring-[var(--line)]/70">No social posts yet.</p>}

      {open && !wide && <ErrorBoundary name="social-details" fallback={DialogError} fallbackProps={{ onClose: closeItem }} resetKey={open.id}><PostDialog item={open} labelOf={labelOf} now={now} onClose={closeItem} /></ErrorBoundary>}
      {listSection && <ErrorBoundary name="social-list" fallback={DialogError} fallbackProps={{ onClose: () => setListKey(null) }}><FilterListDialog title={`Pick the ${listSection.title.toLowerCase()}`} noun={listSection.title.toLowerCase()} options={listSection.options} value={filters[listKey]} countOf={(value) => countOf(listKey, value)} onApply={(values) => setFilters((current) => ({ ...current, [listKey]: values }))} onClose={() => setListKey(null)} /></ErrorBoundary>}
      {filterDialog && <ErrorBoundary name="social-filter" fallback={DialogError} fallbackProps={{ onClose: () => setFilterDialog(false) }}><FeedFilterDialog title="Filter social posts" sections={filterSections} value={filters} countOf={countOf} onApply={(next) => setFilters({ ...EMPTY_FILTERS, ...next })} onClose={() => setFilterDialog(false)} /></ErrorBoundary>}
    </main>
  </Shell>
}

function PlatformTile({ platform, large = false }) {
  const { icon: Icon, tile } = platformOf(platform)
  return <span className={`grid shrink-0 place-items-center ${large ? 'size-14 rounded-2xl' : 'size-11 rounded-xl'} ${tile}`}><Icon size={large ? 28 : 22} weight="fill" /></span>
}

function Hashtags({ tags, labelOf }) {
  if (!tags.length) return null
  return <p className="flex flex-wrap gap-x-2 gap-y-0.5 text-[13px] font-semibold text-[#1d6fd6] dark:text-[#8ab4f8]">{tags.map((tag) => <span key={tag}>{labelOf('hashtags', tag)}</span>)}</p>
}

// "177 / 280" with a bar: green while short, amber near the platform's limit, red over it.
function CharacterMeter({ count, limit }) {
  if (count == null) return <span className="text-[var(--muted)]">-</span>
  if (!limit) return <span className="font-mono">{count}</span>
  const ratio = count / limit
  const colour = ratio > 1 ? 'bg-[#e5484d]' : ratio > 0.85 ? 'bg-[#e0a526]' : 'bg-[var(--lime-dark)]'
  return <span className="block">
    <span className="font-mono">{count}<span className="text-[11px] text-[var(--muted)]"> / {limit.toLocaleString('en-US')}</span></span>
    <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--line)]"><span className={`block h-full rounded-full ${colour}`} style={{ width: `${Math.max(4, Math.min(100, ratio * 100))}%` }} /></span>
  </span>
}

// The post as it will be published: its text (line breaks kept) and hashtags.
function PostPreview({ item, labelOf, clamp = false }) {
  const FormatIcon = FORMATS[item.format] || Article
  return <div className="rounded-2xl bg-[var(--paper)] p-4 ring-1 ring-[var(--line)]/70">
    <p className={`${label} mb-2 flex items-center gap-1.5`}><FormatIcon size={13} weight="bold" />{labelOf('post_format', item.format) || 'Post'} preview</p>
    <p className={`whitespace-pre-line text-sm leading-6 ${clamp ? 'line-clamp-6' : ''}`}>{item.post || item.summary}</p>
    {item.hashtags.length > 0 && <div className="mt-2.5"><Hashtags tags={item.hashtags} labelOf={labelOf} /></div>}
  </div>
}

// Results of a posted post.
function Results({ item }) {
  const stats = [[Eye, 'Views', item.views], [Heart, 'Likes', item.likes], [ChatCircle, 'Comments', item.comments], [ShareFat, 'Shares', item.shares], [UsersThree, 'Leads', item.leads]]
  return <div className="rounded-2xl bg-[#e9f6e4] p-3 ring-1 ring-[#c6e6b8] dark:bg-[#163323] dark:ring-[#2a5a3a]">
    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[#137333] dark:text-[#81c995]"><PaperPlaneTilt size={13} weight="bold" />Results</p>
    <div className="mt-2 grid grid-cols-5 gap-1.5">{stats.map(([Icon, caption, value]) => <div key={caption} className="min-w-0 text-center">
      <p className="font-mono text-[15px] font-semibold tabular-nums">{value != null ? compact.format(value) : '-'}</p>
      <p className="flex items-center justify-center gap-1 text-[11px] text-[var(--muted)]"><Icon size={11} />{caption}</p>
    </div>)}</div>
  </div>
}

function CopyPost({ item, labelOf, big = false }) {
  const [copied, setCopied] = useState(false)
  const text = [item.post, item.hashtags.map((tag) => labelOf('hashtags', tag)).join(' ')].filter(Boolean).join('\n\n')
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch { /* clipboard blocked */ }
  }
  if (big) return <span className="text-[13px] font-bold"><button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[#26320b] transition-transform hover:-translate-y-0.5">{copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}{copied ? 'Copied' : 'Copy post'}</button></span>
  return <button type="button" onClick={copy} aria-label="Copy post" title={copied ? 'Copied' : 'Copy post with hashtags'} className={`grid size-8 place-items-center rounded-full ring-1 transition-colors ${copied ? 'bg-[var(--lime)] text-[#26320b] ring-[var(--lime-dark)]/40' : 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}>{copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}</button>
}

// Expected reach, trend, best time and characters.
function Metrics({ item, labelOf }) {
  const [TrendIcon, trendTone] = TREND[item.trend] || TREND.stable
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <Metric icon={Megaphone} tone="text-[var(--lime-dark)]" caption="Reach" value={item.reachScore != null && <span className="font-mono">{item.reachScore}<span className="text-[11px] text-[var(--muted)]">/100</span></span>}>
      {item.reachScore != null && <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full rounded-full bg-[var(--lime-dark)]" style={{ width: `${Math.min(100, item.reachScore)}%` }} /></span>}
    </Metric>
    <Metric icon={TrendIcon} tone={trendTone} caption="Trend" value={item.trend && <span className={trendTone}>{labelOf('trend', item.trend)}</span>} />
    <Metric icon={Clock} tone="text-[#b7791f] dark:text-[#e8c867]" caption="Best time" value={item.bestTime} wrap />
    <Metric icon={TextAa} caption="Characters" value={<CharacterMeter count={item.characters ?? item.post.length} limit={platformOf(item.platform).limit} />} />
  </div>
}

// One post in the queue: platform, title, format, when it is planned (or its results) and expected reach.
function PostRow({ item, labelOf, selected, onPick }) {
  const { icon: Icon, tile } = platformOf(item.platform)
  const FormatIcon = FORMATS[item.format] || Article
  return <article id={`feed-${item.id}`} data-feed-card={item.id}>
    <button type="button" onClick={onPick} aria-current={selected ? 'true' : undefined} className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-300 ${selected ? 'bg-(--lime)/25 shadow-sm ring-[var(--lime-dark)]/45' : 'bg-[var(--surface)] ring-[var(--line)]/70 hover:-translate-y-0.5 hover:ring-[var(--lime-dark)]/50'}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tile}`}><Icon size={20} weight="fill" /></span>
      <span className="min-w-0 flex-1">
        <span data-card-title className="line-clamp-2 text-sm font-semibold leading-5">{item.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-[var(--muted)]">
          <span className="inline-flex items-center gap-1"><FormatIcon size={12} />{labelOf('post_format', item.format)}</span>
          {posted(item) && <span className="inline-flex items-center gap-1 font-semibold text-[#137333] dark:text-[#81c995]"><PaperPlaneTilt size={12} weight="bold" />Posted{item.views != null && ` · ${compact.format(item.views)} views`}</span>}
        </span>
      </span>
      {item.reachScore != null && <span title={`Expected reach ${item.reachScore} / 100`} className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-sm font-bold tabular-nums">{item.reachScore}</span>
        <span className="block h-1 w-10 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full rounded-full bg-[var(--lime-dark)]" style={{ width: `${Math.min(100, item.reachScore)}%` }} /></span>
      </span>}
    </button>
  </article>
}

const eyebrowOf = (item, labelOf) => `Social · ${labelOf('platform', item.platform)} · ${labelOf('post_format', item.format)}`

// One post's details beside the queue (wide screens), the same as its dialog.
function PostPanel({ item, labelOf, now }) {
  return <section data-feed-pane className="rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 sm:p-6">
    <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">{eyebrowOf(item, labelOf)}</span>
    <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">{item.name}</h2>
    <PostDetails item={item} labelOf={labelOf} now={now} />
  </section>
}

function Callout({ icon: Icon, title, children }) {
  if (!children) return null
  return <div className="flex gap-2.5 rounded-xl border-l-4 border-[var(--lime-dark)] bg-(--lime)/15 px-3.5 py-3">
    <Icon size={17} weight="fill" className="mt-0.5 shrink-0 text-[var(--lime-dark)]" />
    <div className="min-w-0"><p className={label}>{title}</p><p className="mt-0.5 text-sm leading-6">{children}</p></div>
  </div>
}

// One post's details, in its dialog and in the panel beside the queue: the full post, how it is built (hook, outline,
// call to action), media, why it works, where else to post it, results, and every detail from the CRM. Its two columns
// follow the space it has (container width), so they fit the dialog and the panel alike.
function PostDetails({ item, labelOf, now }) {
  const facts = [
    [platformOf(item.platform).icon, 'Platform', labelOf('platform', item.platform)],
    [FORMATS[item.format] || Article, 'Format', labelOf('post_format', item.format)],
    [Stack, 'Content type', labelOf('content_type', item.contentType)],
    [Tag, 'Niche', labelOf('niche', item.niche)],
    [GOALS[item.goal] || Target, 'Goal', labelOf('goal', item.goal)],
    [Clock, 'Best time', item.bestTime],
    [TextAa, 'Characters', item.characters != null && `${item.characters} / ${(platformOf(item.platform).limit || 0).toLocaleString('en-US')}`],
    [CalendarBlank, 'Published', formatDate(item.publishedAt)],
    [Tray, 'Added to the feed', item.addedAt && `${formatDate(item.addedAt)} · ${timeAgo(item.addedAt, now)}`],
  ].filter(([, , value]) => value)

  return <div className="@container">
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <PlatformTile platform={item.platform} large />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm leading-6 text-[var(--muted)]">{item.summary}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold">
        <CopyPost item={item} labelOf={labelOf} big />
        {item.postUrl && <a href={item.postUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]">Open our post<ArrowSquareOut size={12} weight="bold" /></a>}
        {item.exampleUrl && <a href={item.exampleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]">Example post<ArrowSquareOut size={12} weight="bold" /></a>}
      </div>
    </div>

    <div className="mt-4"><Metrics item={item} labelOf={labelOf} /></div>
    {posted(item) && <div className="mt-3"><Results item={item} /></div>}

    <div className="mt-5 grid gap-5 @2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm leading-6">
        <PostPreview item={item} labelOf={labelOf} />
        <Callout icon={Sparkle} title="Hook (first line)">{item.hook}</Callout>
        {item.outline.length > 0 && <section>
          <p className={`${label} flex items-center gap-1.5`}><ListNumbers size={13} weight="bold" />Outline</p>
          <ol className="mt-2 space-y-1.5">{item.outline.map((step, index) => <li key={`${index}-${step}`} className="flex gap-2.5"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--lime)] font-mono text-[11px] font-bold text-[#26320b]">{index + 1}</span><span className="pt-0.5">{step.replace(/^(Slides?|Tweet|Part|Step)?\s*[\d–-]*:\s*/i, '')}</span></li>)}</ol>
        </section>}
        <Callout icon={Target} title="Call to action">{item.callToAction}</Callout>
        {item.whyThisWorks && <section><p className={`${label} flex items-center gap-1.5`}><Lightbulb size={13} weight="bold" />Why this works</p><p className="mt-1.5 text-[var(--muted)]">{item.whyThisWorks}</p></section>}
        {item.repurposeFor.length > 0 && <section>
          <p className={`${label} flex items-center gap-1.5`}><Recycle size={13} weight="bold" />Repurpose for</p>
          <div className="mt-2 flex flex-wrap gap-1.5">{item.repurposeFor.map((platform) => {
            const { icon: Icon, tone } = platformOf(platform)
            return <span key={platform} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}><Icon size={13} weight="fill" />{labelOf('repurpose_for', platform)}</span>
          })}</div>
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
  </div>
}

function PostDialog({ item, labelOf, now, onClose }) {
  return <Modal onClose={onClose} wide contained>
    <DialogHeader eyebrow={eyebrowOf(item, labelOf)} title={item.name} onClose={onClose} />
    <PostDetails item={item} labelOf={labelOf} now={now} />
  </Modal>
}
