import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowSquareOut, CaretDown, CircleNotch, PencilSimple, Rows, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NotFound from './NotFound'
import SessionLoader from '../components/SessionLoader'
import NewFeedDialog from '../components/NewFeedDialog'
import FeedBuildStatus from '../components/FeedBuildStatus'
import FeedSection from '../components/FeedSection'
import { Modal, iconButton } from '../components/ui'
import { sectionLabel } from '../components/SectionControls'
import { BUILDING, canSeeFeed, useFeedBuild, useFeedDefinition, useFeeds } from '../lib/feeds'
import { useAuth } from '../contexts/AuthContext'
import { isAdminUser } from '../lib/permissions'
import { describeSchedule } from '../lib/prompts'
import { asArray, asObject, asText } from '../lib/safe'

/**
 * A feed (/feeds/:id), made with "+ New feed". Once built it is a section like the others: its records, searched,
 * filtered and opened in a drawer, with Generate (FeedSection); admins open its settings from there. Until then, the
 * feed as defined: its build (followed live while it runs, with the log), what it is for, its fields, the documents it
 * generates, who sees it and its schedule; Edit opens the builder. A built feed opens for admins and for users holding its permission (from their role); one
 * not built yet opens for anyone with the link (its creator lands here after saving it).
 */
const TYPE_LABELS = { varchar: 'Short text', text: 'Long text', int: 'Whole number', decimal: 'Decimal', bool: 'Yes / No', date: 'Date', datetime: 'Date & time', url: 'Link', enum: 'Dropdown', multienum: 'Multi-select' }
const ACTION_LABELS = { doc: 'Document', blog: 'Blog post', video: 'Video', image: 'Image' }
const ACCESS_LABELS = { full: 'Full access', no_delete: 'All except delete', read_only: 'Read only' }
const card = 'rounded-[1.5rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 sm:p-6'
const optionsOf = (options) => (Array.isArray(options) ? options : Object.values(asObject(options))).map(asText).filter(Boolean)

export default function CustomFeed() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const feeds = useFeeds(user)
  const definition = useFeedDefinition(id)
  const build = useFeedBuild(id)
  const [editing, setEditing] = useState(false)
  const [settings, setSettings] = useState(false)

  if (definition.isLoading || feeds.isLoading) return <SessionLoader />
  if (definition.error) {
    if (/not found/i.test(definition.error.message)) return <NotFound />
    return <Shell>
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 md:pt-8">
        <p role="alert" className="rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">This feed could not be loaded: {definition.error.message} <button type="button" onClick={() => definition.refetch()} className="ml-2 underline">Try again</button></p>
      </main>
    </Shell>
  }

  const feed = definition.data
  const listed = feeds.data?.find((item) => item.id === id)
  if (listed?.buildStatus === 'built' && !canSeeFeed(user, listed)) return <NotFound type="forbidden" />
  const status = build.data?.status || feed.build_status || 'draft'
  const edit = () => { setSettings(false); setEditing(true) }
  const editor = editing && <NewFeedDialog feedId={id} onClose={() => setEditing(false)} onSaved={(savedId) => { setEditing(false); if (savedId && savedId !== id) navigate(`/feeds/${savedId}`) }} />
  // Built: the feed's records, like the other sections; admins open its settings (build, fields, roles) from there.
  if (status === 'built') return <>
    <FeedSection definition={feed} onSettings={isAdminUser(user) ? () => setSettings(true) : null} />
    {settings && <Modal onClose={() => setSettings(false)} full contained><FeedOverview feed={feed} build={build} status={status} onEdit={edit} onClose={() => setSettings(false)} /></Modal>}
    {editor}
  </>
  return <Shell>
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 md:pt-8"><FeedOverview feed={feed} build={build} status={status} onEdit={edit} /></main>
    {editor}
  </Shell>
}

// The feed as defined: its build (followed live, with the log), context, fields, outputs, access and schedule.
// `onClose`: shown in a dialog (the settings of a built feed).
function FeedOverview({ feed, build, status, onEdit, onClose }) {
  const moduleUrl = build.data?.moduleUrl || feed.module_url
  const recordUrl = build.data?.recordUrl || feed.record_url
  const fields = asArray(feed.fields)
  const actions = asArray(feed.actions).map(asText)
  const roles = asArray(feed.roles).map(asText)

  return <>
    <header className="flex flex-wrap items-start gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--lime)] text-[var(--on-lime)]"><Rows size={22} weight="bold" /></span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Feed<FeedBuildStatus status={status} /></p>
        <h1 className="mt-1.5 text-3xl font-semibold tracking-[-.05em] [overflow-wrap:anywhere]">{asText(feed.module_label) || asText(feed.name)}</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">{asText(feed.name)} · <span className="font-mono">{asText(feed.module_name)}</span></p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
        {status === 'built' && moduleUrl && <a href={moduleUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-(--lime-tint)/35 px-4 py-2 text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/40 transition-colors hover:bg-(--lime-tint)/55"><ArrowSquareOut size={13} weight="bold" />Open in CRM</a>}
        <button type="button" onClick={onEdit} disabled={BUILDING.includes(status)} title={BUILDING.includes(status) ? 'It can be edited once the build ends' : undefined} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-4 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)] disabled:opacity-50"><PencilSimple size={13} weight="bold" />Edit feed</button>
        {onClose && <button type="button" aria-label="Close dialog" onClick={onClose} className={iconButton}><X size={16} /></button>}
      </div>
    </header>

    <BuildCard status={status} log={build.data?.log} builtAt={build.data?.builtAt} recordUrl={recordUrl} error={build.error} />

    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section className={card}>
          <p className={sectionLabel}>Context</p>
          {asText(feed.context).trim()
            ? <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-[var(--ink)] [overflow-wrap:anywhere]">{asText(feed.context)}</p>
            : <p className="mt-3 text-[13px] text-[var(--muted)]">No context yet.</p>}
        </section>
        <section className={card}>
          <p className={sectionLabel}>Fields · {fields.length}</p>
          <ul className="mt-3 divide-y divide-[var(--line)]/70">
            {fields.map((field) => {
              const options = optionsOf(field.options)
              return <li key={asText(field.name)} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--ink)]">{asText(field.label)}{field.required && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--accent-strong)]">Required</span>}</p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">{asText(field.name)}{asText(field.help) && <span className="font-sans"> · {asText(field.help)}</span>}</p>
                  {options.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{options.map((option) => <span key={option} className="rounded-full bg-[var(--paper)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]/70">{option}</span>)}</div>}
                </div>
                <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)] ring-1 ring-[var(--line)]/70">{TYPE_LABELS[field.type] || asText(field.type)}</span>
              </li>
            })}
          </ul>
        </section>
      </div>
      <div className="space-y-5">
        <Facts title="Generates" items={actions.map((action) => ACTION_LABELS[action] || action)} empty="Nothing to generate" />
        <Facts title="Access" items={roles} empty="No roles yet" note={ACCESS_LABELS[feed.role_access] || asText(feed.role_access)} />
        <section className={card}>
          <p className={sectionLabel}>Scheduler</p>
          <p className="mt-3 text-[13px] font-semibold text-[var(--ink)]">{describeSchedule(feed.schedule)}</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">{asText(feed.crm_instance) || 'No CRM instance'} · {feed.create_scheduler_prompt ? 'Claude writes the scheduler prompt' : 'No scheduler prompt'}</p>
        </section>
      </div>
    </div>
  </>
}

function Facts({ title, items, empty, note }) {
  return <section className={card}>
    <p className={sectionLabel}>{title}</p>
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.length ? items.map((item) => <span key={item} className="rounded-full bg-(--lime-tint)/25 px-3 py-1 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/35">{item}</span>) : <span className="text-[13px] text-[var(--muted)]">{empty}</span>}
    </div>
    {note && <p className="mt-2 text-[11px] text-[var(--muted)]">{note}</p>}
  </section>
}

// The build: what is happening now, and the CRM's log (open while it runs or after it failed).
function BuildCard({ status, log, builtAt, recordUrl, error }) {
  const running = BUILDING.includes(status)
  const [open, setOpen] = useState(null)
  const shown = open ?? (running || status === 'failed')
  const lines = asText(log).split('\n').filter(Boolean)
  const text = {
    draft: ['Saved as a draft', 'Nothing is built yet. Edit the feed and choose “Save & build” to make the CRM module.'],
    queued: ['Waiting to build', 'The build starts in a moment. This page follows it; you can keep working elsewhere.'],
    building: ['Building the module', 'Making the module, its fields and roles, then the prompts and the scheduler prompt.'],
    built: ['Built', `The module is in the CRM${builtAt ? ` since ${builtAt}` : ''}.`],
    failed: ['The build failed', 'See the log below, fix the feed and build it again.'],
  }[status] || ['', '']

  return <section className={`mt-6 overflow-hidden rounded-[1.5rem] ring-1 ${status === 'failed' ? 'bg-[var(--bad-bg)]/50 ring-[var(--bad)]/25' : running ? 'bg-[var(--warn-bg)]/50 ring-[var(--warn)]/25' : 'bg-[var(--surface)] ring-[var(--line)]/70'}`}>
    {running && <div className="h-1 overflow-hidden bg-[var(--warn)]/15"><div className="h-full w-1/3 animate-[feed-build_1.4s_ease-in-out_infinite] rounded-full bg-[var(--warn)]" /></div>}
    <div className="flex flex-wrap items-center gap-3 p-5 sm:px-6">
      {running && <CircleNotch size={18} weight="bold" className="animate-spin text-[var(--warn)]" />}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--ink)]">{text[0]}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{text[1]}</p>
        {error && <p role="alert" className="mt-1 text-xs font-semibold text-[var(--bad)]">The build status could not be read: {error.message}</p>}
      </div>
      <div className="flex items-center gap-2 text-xs font-bold">
        {recordUrl && <a href={recordUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)]"><ArrowSquareOut size={12} weight="bold" />Feed record</a>}
        {lines.length > 0 && <button type="button" aria-expanded={shown} onClick={() => setOpen(!shown)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)]">Build log<CaretDown size={11} weight="bold" className={`transition-transform ${shown ? 'rotate-180' : ''}`} /></button>}
      </div>
    </div>
    {shown && lines.length > 0 && <ol className="max-h-72 overflow-y-auto border-t border-[var(--line)]/70 bg-[var(--paper)]/60 px-5 py-3 font-mono text-[11px] leading-5 text-[var(--ink)] [overflow-wrap:anywhere] [scrollbar-width:thin] sm:px-6">
      {lines.map((line, index) => <li key={index}>{line}</li>)}
    </ol>}
  </section>
}
