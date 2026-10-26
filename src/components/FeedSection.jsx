import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowSquareOut, Article, BookOpenText, CalendarBlank, CheckCircle, FileText, GearSix, Hash, Image, Link as LinkIcon, ListBullets, Rows, Sparkle, Tag, TextAlignLeft, Tray, VideoCamera, X, XCircle } from '@phosphor-icons/react'
import Shell from './Shell'
import LogoLoader from './LogoLoader'
import DateTimeRangeFilter from './DateTimeRangeFilter'
import { ActiveDateFilterChip, RefreshFilterButton } from './FilterToolbarControls'
import { SelectMenu, SortMenu } from './JobListControls'
import { ClearFilters, NothingMatches, SectionPanel, sectionLabel as label } from './SectionControls'
import FeedSearch from './FeedSearch'
import FeedFilterDialog from './FeedFilterDialog'
import FilterListDialog from './FilterListDialog'
import GenerationInstructions from './GenerationInstructions'
import { ItemDrawer, OutputRow, StageChip } from './GenerateOutput'
import { FactIcon, FeedIndex, FilterButton, FilterChip, FilterStrip, Metric, MoreLoader } from './FeedParts'
import { primaryButton } from './ui'
import ErrorBoundary, { CardError, DialogError, SectionError } from './ErrorBoundary'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../services/api'
import { EMPTY_DATE_RANGE } from '../lib/dateRange'
import { countFilters, useFeedIndex } from '../lib/feedView'
import { useGatewayFeed, useOpenItem } from '../lib/gatewayFeed'
import { stageOf, useGenerateOutput, useGenerationWatch } from '../lib/generation'
import { describeSchedule } from '../lib/prompts'
import { asArray, asText } from '../lib/safe'
import { timeAgo, useNow } from '../lib/time'

/*
 * A built feed made with "+ New feed", as a section like AppScript: the same panel (search, sort, date, the strips of
 * its dropdown fields and the universal filter), its records as cards with the list index beside them, and a record
 * opening in the drawer with every field and Generate for each of the feed's outputs (suggestion, status, View,
 * Download, Prompt & guidelines). Everything comes from the feed's definition: its module, its fields (by type) and its
 * outputs; the smart gateway does the filtering, search, sorting, paging and counts, as for the other sections.
 */

// The outputs a feed can generate: name, short name, icon and an example suggestion.
const OUTPUTS = {
  doc: ['Document', 'Document', FileText, 'e.g. Keep it to one page and end with a clear next step'],
  blog: ['Blog post', 'Blog', Article, 'e.g. Write for small business owners, in a friendly tone'],
  video: ['Video', 'Video', VideoCamera, 'e.g. Keep it under 60 seconds and end on a question'],
  image: ['Image', 'Image', Image, 'e.g. Bright and simple, with the title as large text'],
}
// Ready documents and blog posts are published on the sites, so their login is offered with them.
const PUBLISHED = ['doc', 'blog']
const CHOICE_TYPES = ['enum', 'multienum']
const SHORT_TYPES = ['varchar', 'int', 'decimal', 'bool', 'date', 'datetime', 'enum']
const CARD_ERROR = { what: 'record' }
const INDEX_ERROR = { title: 'The list index could not load', className: 'hidden self-start lg:block' }
const FILTERS_ERROR = { title: 'The filters could not load', className: 'm-3' }
const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
const hasValue = (value) => (Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== '')

// A field's value as text: choices by their labels, yes / no, dates and numbers as people read them.
function shown(field, value, labelOf) {
  if (!hasValue(value)) return ''
  if (field.type === 'bool') return value ? 'Yes' : 'No'
  if (field.type === 'enum') return labelOf(field.name, value)
  if (field.type === 'multienum') return value.map((item) => labelOf(field.name, item)).join(', ')
  if (field.type === 'date' || field.type === 'datetime') return formatDate(value) || String(value)
  if (field.type === 'int' || field.type === 'decimal') return Number(value).toLocaleString('en-IN')
  return String(value)
}
const iconOf = (field) => ({ int: Hash, decimal: Hash, date: CalendarBlank, datetime: CalendarBlank, bool: CheckCircle, url: LinkIcon, enum: Tag, multienum: ListBullets, text: TextAlignLeft }[field.type] || Rows)

export default function FeedSection({ definition, onSettings }) {
  const now = useNow()
  const { user } = useAuth()
  const title = asText(definition.module_label) || asText(definition.name)
  const module = asText(definition.module_name)
  // The feed's name in the queries ("feed-<id>"), once its definition is known to the gateway calls.
  const feed = useMemo(() => api.registerAutoFeed(definition), [definition])
  const fields = useMemo(() => asArray(definition.fields).filter((field) => field?.name && field.name !== 'name').map((field) => ({ ...field, label: asText(field.label) || field.name })), [definition])
  const outputs = useMemo(() => asArray(definition.actions).map(asText).filter((type) => OUTPUTS[type]), [definition])
  // The dropdown fields: filters (several values per record: matched on the page), the first three as strips.
  const choiceFields = useMemo(() => fields.filter((field) => CHOICE_TYPES.includes(field.type)), [fields])
  const filterFields = useMemo(() => Object.fromEntries(choiceFields.map((field) => [field.name, [field.name, `f_${field.name}`, field.type === 'multienum']])), [choiceFields])
  const emptyFilters = useMemo(() => Object.fromEntries(choiceFields.map((field) => [field.name, []])), [choiceFields])
  const stripKeys = useMemo(() => choiceFields.slice(0, 3).map((field) => field.name), [choiceFields])
  const sorts = useMemo(() => [
    { id: 'newest', label: 'Newest first' },
    { id: 'oldest', label: 'Oldest first' },
    ...fields.filter((field) => field.type === 'int' || field.type === 'decimal').map((field) => ({ id: `top_${field.name}`, label: `Highest ${field.label.toLowerCase()}` })),
    { id: 'name', label: 'Name A–Z' },
  ], [fields])

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [dateFilter, setDateFilter] = useState(EMPTY_DATE_RANGE)
  const [sort, setSort] = useState('newest')
  const [filterDialog, setFilterDialog] = useState(false)
  const [listKey, setListKey] = useState(null)
  const allKeys = Object.keys(filterFields)

  const { options, labelOf, items, total, grandTotal, countOf, refresh, loading, isError, error, updating, hasMore, loadingMore, loadMoreRef } = useGatewayFeed({
    feed, fields: filterFields, filters, search, dateFilter, dateField: 'date_entered', sort,
    stripKeys, openKeys: filterDialog || listKey ? allKeys : undefined,
  })
  const { activeId, jumpTo } = useFeedIndex(items)
  // The open record is in the link (?record=id), as in the other sections.
  const { open, openItem, closeItem } = useOpenItem(feed, items, 'record')
  const watchedItems = useMemo(() => (open && !items.some((item) => item.id === open.id) ? [...items, open] : items), [items, open])
  const readGeneration = useMemo(() => (ids) => api.getModuleGeneration(module, outputs, ids), [module, outputs])
  useGenerationWatch({ feed, items: watchedItems, types: outputs, read: readGeneration })

  const lead = choiceFields[0]
  const indexMeta = (item) => <span className="truncate">{lead && hasValue(item[`f_${lead.name}`]) ? `${shown(lead, item[`f_${lead.name}`], labelOf)} · ` : ''}{timeAgo(item.addedAt, now)}</span>
  const filterSections = choiceFields.map((field) => ({ key: field.name, title: field.label, icon: field.type === 'multienum' ? ListBullets : Tag, kind: 'chips', options: options[field.name] || [] }))
  const filterCount = countFilters(filters)
  const hasFilters = Boolean(search || filterCount || dateFilter.preset !== 'all')
  const clearAll = () => { setSearch(''); setFilters(emptyFilters); setDateFilter(EMPTY_DATE_RANGE) }
  const removeFilter = (key, value) => setFilters((current) => ({ ...current, [key]: current[key].filter((entry) => entry !== value) }))
  const activeChips = Object.keys(filterFields).flatMap((key) => (filters[key] || []).map((value) => [key, value, labelOf(key, value)]))
  const listSection = filterSections.find((entry) => entry.key === listKey)
  const noun = title.toLowerCase()

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
      <SectionPanel>
        {/* Row 1: title, search, then sort, date, the universal filter, refresh and (admins) the feed's settings. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <h1 className="flex shrink-0 items-baseline gap-2 text-2xl font-semibold tracking-[-.04em]">{title}<span className="font-mono text-[13px] font-semibold tracking-normal text-[var(--muted)] tabular-nums">{loading || updating ? '…' : `${total} of ${grandTotal ?? total}`}</span></h1>
          <FeedSearch value={search} onChange={setSearch} email={user?.email} scope={feed} placeholder={`Search ${noun}…`} label={`Search the ${noun}`} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SortMenu value={sort} options={sorts} onChange={setSort} label={`Sort the ${noun}`} />
            <DateTimeRangeFilter value={dateFilter} onApply={setDateFilter} label="Added" />
            {filterSections.length > 0 && <FilterButton count={filterCount} onClick={() => setFilterDialog(true)} title={`Filter by ${filterSections.map((section) => section.title.toLowerCase()).join(', ')}`} />}
            <RefreshFilterButton onClick={refresh} loading={updating} label={`Refresh the ${noun}`} />
            {onSettings && <button type="button" onClick={onSettings} aria-label="Feed settings" title="Feed settings: build, fields, roles, schedule" className="grid size-10 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]"><GearSix size={17} weight="bold" /></button>}
          </div>
        </div>

        {/* Row 2: the first dropdown fields as strips; the wheel opens each whole list. */}
        {stripKeys.length > 0 && Object.keys(options).length > 0 && <ErrorBoundary name="feed-filters" fallbackProps={FILTERS_ERROR} resetKey={options}><div className="grid gap-2 border-t border-[var(--line)]/70 px-4 py-3 sm:px-6 xl:grid-cols-3">
          {stripKeys.map((key) => {
            const section = filterSections.find((entry) => entry.key === key)
            return <FilterStrip key={key} title={section.title} icon={section.icon} options={section.options} value={filters[key]} countOf={(value) => countOf(key, value)} onChange={(values) => setFilters((current) => ({ ...current, [key]: values }))} onOpenAll={() => setListKey(key)} />
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
        ? <LogoLoader className="min-h-[40dvh]" label={`Loading ${noun}`} />
        : isError
          ? <section className="py-24 text-center">
            <h3 className="text-xl font-semibold">Could not load {title}</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p>
            <button type="button" onClick={refresh} className={`${primaryButton} mt-6`}>Try again</button>
          </section>
          : items.length
            ? <div className="mt-6 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
              <ErrorBoundary name="feed-index" fallbackProps={INDEX_ERROR} resetKey={items}><FeedIndex items={items} activeId={activeId} onJump={jumpTo} meta={indexMeta} /></ErrorBoundary>
              <div className="min-w-0">
                <section className={`grid content-start gap-4 transition-opacity min-[1400px]:grid-cols-2 ${updating ? 'opacity-60' : ''}`}>{items.map((item) => <ErrorBoundary key={item.id} name="feed-card" fallback={CardError} fallbackProps={CARD_ERROR} resetKey={item}><RecordCard item={item} fields={fields} outputs={outputs} labelOf={labelOf} lead={lead} onOpen={() => openItem(item.id)} /></ErrorBoundary>)}</section>
                <MoreLoader ref={loadMoreRef} loading={loadingMore} more={hasMore} total={total} />
              </div>
            </div>
            : grandTotal
              ? <NothingMatches onClear={clearAll} />
              : <div className="mt-8 rounded-[1.6rem] bg-[var(--surface)] px-6 py-14 text-center ring-1 ring-[var(--line)]/70">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-(--lime)/35 text-[var(--accent-strong)]"><Tray size={22} weight="bold" /></span>
                <p className="mt-4 text-sm font-semibold text-[var(--ink)]">No {noun} yet</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[var(--muted)]">{definition.schedule ? `The scheduler adds them: ${describeSchedule(definition.schedule).toLowerCase()}.` : 'They show here as soon as they are added in the CRM.'}</p>
              </div>}

      {open && <ErrorBoundary name="feed-details" fallback={DialogError} fallbackProps={{ onClose: closeItem }}>
        <ItemDrawer kind={title} closeLabel="Close the record" item={open} items={items} indexMeta={indexMeta} onSelect={openItem} onClose={closeItem}
          details={({ panelType, onPanel }) => <ErrorBoundary name="feed-record" resetKey={open.id} fallback={SectionError} fallbackProps={{ title: 'This record could not load' }}><RecordDetails feed={feed} module={module} title={title} item={open} fields={fields} outputs={outputs} lead={lead} labelOf={labelOf} now={now} panelType={panelType} onPanel={onPanel} /></ErrorBoundary>}
          panel={({ panelType, onPanel }) => <ErrorBoundary name="feed-instructions" resetKey={panelType} fallback={SectionError} fallbackProps={{ title: 'The prompt and guidelines could not load' }}><InstructionsPanel module={module} outputs={outputs} type={panelType} onType={onPanel} onClose={() => onPanel(null)} /></ErrorBoundary>} />
      </ErrorBoundary>}
      {listSection && <ErrorBoundary name="feed-list" fallback={DialogError} fallbackProps={{ onClose: () => setListKey(null) }}><FilterListDialog title={`Pick the ${listSection.title.toLowerCase()}`} noun={listSection.title.toLowerCase()} options={listSection.options} value={filters[listKey]} countOf={(value) => countOf(listKey, value)} onApply={(values) => setFilters((current) => ({ ...current, [listKey]: values }))} onClose={() => setListKey(null)} /></ErrorBoundary>}
      {filterDialog && <ErrorBoundary name="feed-filter" fallback={DialogError} fallbackProps={{ onClose: () => setFilterDialog(false) }}><FeedFilterDialog title={`Filter ${noun}`} sections={filterSections} value={filters} countOf={countOf} onApply={(next) => setFilters({ ...emptyFilters, ...next })} onClose={() => setFilterDialog(false)} /></ErrorBoundary>}
    </main>
  </Shell>
}

// Choice values as chips.
function Chips({ field, value, labelOf }) {
  const values = Array.isArray(value) ? value : [value]
  return <div className="flex flex-wrap gap-1.5">{values.map((item) => <span key={item} className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-xs font-semibold ring-1 ring-[var(--line)]/70">{labelOf(field.name, item)}</span>)}</div>
}

// A record as a card: the first dropdown above its name, the first long text, up to four short fields as tiles, its
// other choices as chips, the outputs started, and the first link with the date it was added.
function RecordCard({ item, fields, outputs, labelOf, lead, onOpen }) {
  const value = (field) => item[`f_${field.name}`]
  const text = fields.find((field) => field.type === 'text' && hasValue(value(field)))
  const tiles = fields.filter((field) => field !== lead && SHORT_TYPES.includes(field.type) && field.type !== 'enum' && hasValue(value(field))).slice(0, 4)
  const chips = fields.filter((field) => field !== lead && CHOICE_TYPES.includes(field.type) && hasValue(value(field))).slice(0, 2)
  const link = fields.find((field) => field.type === 'url' && value(field))
  const made = outputs.map((type) => [type, stageOf(item.generation[type])]).filter(([, stage]) => stage !== 'idle')
  return <article id={`feed-${item.id}`} data-feed-card={item.id} className="flex scroll-mt-[calc(var(--shell-h)+1rem)] flex-col gap-3.5 rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)]">
    <header className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-(--lime)/35 text-[var(--accent-strong)]"><Rows size={20} weight="duotone" /></span>
      <div className="min-w-0 flex-1">
        {lead && hasValue(value(lead)) && <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]"><Tag size={11} weight="bold" />{shown(lead, value(lead), labelOf)}</p>}
        <h3 className="mt-1 text-[17px] font-semibold leading-snug tracking-[-.02em]"><button type="button" onClick={onOpen} className="text-left hover:underline">{item.name}</button></h3>
      </div>
    </header>
    {(text || item.description) && <p className="line-clamp-2 text-sm leading-6 text-[var(--muted)]">{text ? value(text) : item.description}</p>}
    {tiles.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tiles.map((field) => <Metric key={field.name} icon={iconOf(field)} caption={field.label} value={shown(field, value(field), labelOf)} wrap />)}</div>}
    {chips.map((field) => <Chips key={field.name} field={field} value={value(field)} labelOf={labelOf} />)}
    {made.length > 0 && <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[var(--muted)]"><Sparkle size={13} weight="fill" className="text-[var(--accent-strong)]" />{made.map(([type, stage]) => <StageChip key={type} icon={OUTPUTS[type][2]} name={OUTPUTS[type][1]} stage={stage} />)}</p>}

    <footer className="mt-auto flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
      <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        {link && <a href={value(link)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-[var(--ink)]"><ArrowSquareOut size={12} />{link.label}</a>}
        <span className="inline-flex items-center gap-1" title="Added"><CalendarBlank size={12} />{formatDate(item.addedAt)}</span>
      </p>
      <span className="shrink-0 text-xs font-bold"><button type="button" onClick={onOpen} className="ml-1 inline-flex items-center gap-1 rounded-full bg-[var(--text)] px-3.5 py-2 text-[var(--paper)] transition-transform hover:-translate-y-0.5">Details<ArrowRight size={12} weight="bold" /></button></span>
    </footer>
  </article>
}

// A record in the drawer: its name and description, the long texts and choices on the left, every short field on the
// right, then Generate for each output.
function RecordDetails({ feed, module, title, item, fields, outputs, lead, labelOf, now, panelType, onPanel }) {
  const value = (field) => item[`f_${field.name}`]
  const texts = fields.filter((field) => field.type === 'text' && hasValue(value(field)))
  const lists = fields.filter((field) => field.type === 'multienum' && hasValue(value(field)))
  const links = fields.filter((field) => field.type === 'url' && value(field))
  const facts = [
    ...fields.filter((field) => SHORT_TYPES.includes(field.type)).map((field) => [iconOf(field), field.label, shown(field, value(field), labelOf), field.type === 'bool' && value(field) === false]),
    [Tray, 'Added to the feed', item.addedAt && `${formatDate(item.addedAt)} · ${timeAgo(item.addedAt, now)}`],
  ].filter(([, , text]) => text)

  return <>
    <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">{title}{lead && hasValue(value(lead)) ? ` · ${shown(lead, value(lead), labelOf)}` : ''}</p>
    <h2 className="mt-3 text-3xl font-semibold tracking-[-.05em] [overflow-wrap:anywhere]">{item.name}</h2>
    {links.length > 0 && <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">{links.map((field) => <a key={field.name} href={value(field)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lime)] px-3.5 py-2 text-[#26320b] transition-transform hover:-translate-y-0.5"><LinkIcon size={13} weight="bold" />{field.label}<ArrowSquareOut size={12} weight="bold" /></a>)}</div>}
    {item.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{item.description}</p>}

    <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="space-y-4 text-sm leading-6">
        {texts.map((field) => <section key={field.name}><p className={`${label} flex items-center gap-1.5`}><TextAlignLeft size={13} weight="bold" />{field.label}</p><p className="mt-1.5 whitespace-pre-wrap text-[var(--muted)] [overflow-wrap:anywhere]">{value(field)}</p></section>)}
        {lists.map((field) => <section key={field.name}><p className={`${label} flex items-center gap-1.5`}><ListBullets size={13} weight="bold" />{field.label}</p><div className="mt-2"><Chips field={field} value={value(field)} labelOf={labelOf} /></div></section>)}
        {!texts.length && !lists.length && !item.description && <p className="text-[var(--muted)]">Nothing more written for this record.</p>}
      </div>
      {facts.length > 0 && <dl className="self-start rounded-2xl bg-[var(--paper)] p-3.5 text-[13px] ring-1 ring-[var(--line)]/70">
        {facts.map(([Icon, name, text, off]) => <div key={name} className="flex items-start justify-between gap-3 border-t border-[var(--line)]/60 py-2 first:border-t-0 first:pt-0 last:pb-0">
          <dt className="flex shrink-0 items-center gap-2.5 text-[var(--muted)]"><FactIcon icon={off ? XCircle : Icon} title={name} />{name}</dt>
          <dd className="text-right font-semibold [overflow-wrap:anywhere]">{text}</dd>
        </div>)}
      </dl>}
    </div>

    {outputs.length > 0 && <section className="mt-5 rounded-2xl bg-[var(--paper)] p-3.5 ring-1 ring-[var(--line)]/70 sm:p-4">
      <p className={`${label} flex items-center gap-1.5`}><Sparkle size={13} weight="bold" />Generate from this record</p>
      <p className="mt-1 text-xs text-[var(--muted)]">Check the prompt and guidelines, add a suggestion, then start. When it is ready you can view it, download it or regenerate it with a new suggestion.</p>
      <div className="mt-3 grid gap-2">
        {outputs.map((type) => <RecordOutput key={type} feed={feed} module={module} item={item} type={type} panelOpen={panelType === type} onPanel={() => onPanel(panelType === type ? null : type)} />)}
      </div>
    </section>}
  </>
}

// One output of a record (the shared row), generating through the record's CRM fields; it reopens this feed.
function RecordOutput({ feed, module, item, type, panelOpen, onPanel }) {
  const [name, short, icon, example] = OUTPUTS[type]
  const path = `${window.location.pathname}?record=${item.id}`
  const generate = useGenerateOutput({ feed, item, type, title: `${name} · ${item.name}`, path, save: (suggestion) => api.generateModuleOutput(module, item.id, type, suggestion) })
  return <OutputRow output={item.generation[type]} type={type} icon={icon} name={name} short={short} example={example} panelOpen={panelOpen} onPanel={onPanel} generate={generate} published={PUBLISHED.includes(type)} />
}

// The prompt and guidelines of one output, beside the details (on a phone, in their place). The build named them after
// the module: <module>_<output> and <module>_<output>_guidelines.
function InstructionsPanel({ module, outputs, type, onType, onClose }) {
  const [name, , Icon] = OUTPUTS[type]
  return <div className="flex h-full min-h-0 flex-col rounded-2xl bg-[var(--paper)] ring-1 ring-[var(--line)]/70">
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)]/70 px-4 py-3">
      <div className="min-w-0">
        <p className={`${label} flex items-center gap-1.5`}><BookOpenText size={13} weight="bold" />Prompt &amp; guidelines</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Icon size={15} weight="bold" className="text-[var(--accent-strong)]" />{name}</p>
      </div>
      <span className="text-xs font-bold"><button type="button" onClick={onClose} aria-label="Close the prompt and guidelines" className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)]">
        <ArrowLeft size={13} weight="bold" className="lg:hidden" /><span className="lg:hidden">Back to the record</span><X size={13} weight="bold" className="hidden lg:block" />
      </button></span>
    </div>
    <GenerationInstructions promptName={`${module}_${type}`} guidelinesName={`${module}_${type}_guidelines`} what={`the ${name.toLowerCase()}`}
      toolbar={<SelectMenu label="Output" value={type} options={outputs.map((key) => ({ id: key, label: OUTPUTS[key][0] }))} onChange={onType} icon={Sparkle} onPaper />} />
  </div>
}
