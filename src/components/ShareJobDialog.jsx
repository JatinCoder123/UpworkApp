import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowSquareOut, Check, CheckCircle, ClockCounterClockwise, Copy, EnvelopeSimple, MagnifyingGlass, MicrosoftTeamsLogo, Plus, UsersThree, WarningCircle, X } from '@phosphor-icons/react'
import { DialogHeader, Modal } from './ui'
import { useCopied } from './JobDetailParts'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { forgetRecipient, jobShareLink, loadRecentRecipients, rememberRecipients } from '../lib/jobSignals'
import { asArray, asText } from '../lib/safe'

const defaultMessage = (job) => [
  `Job worth a look: ${job.title}`,
  [job.type, job.budget, job.level !== 'Not specified' && job.level].filter(Boolean).join(' · '),
  job.clientStats?.country && `Client: ${job.clientStats.country}${job.clientStats.paymentVerified ? ' (payment verified)' : ''}`,
  job.match > 0 && `AI match: ${job.match}%`,
  jobShareLink(job),
].filter(Boolean).join('\n')

const teamsShareUrl = (href, text) => `https://teams.microsoft.com/share?href=${encodeURIComponent(href)}&msgText=${encodeURIComponent(text)}&preview=true`
const teamsChatUrl = (emails, topic, text) => `https://teams.microsoft.com/l/chat/0/0?users=${emails.map(encodeURIComponent).join(',')}${emails.length > 1 ? `&topicName=${encodeURIComponent(asText(topic).slice(0, 120))}` : ''}&message=${encodeURIComponent(text)}`

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/
const sameEmail = (a, b) => asText(a).toLowerCase() === asText(b).toLowerCase()
const initialsOf = (name) => asText(name).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase()

function Avatar({ name, small = false }) {
  return <span className={`grid shrink-0 place-items-center rounded-full bg-[var(--ink)] font-bold text-white ${small ? 'size-5 text-[8px]' : 'size-8 text-[10px]'}`}>{initialsOf(name)}</span>
}

// People this user shared with before; one click adds them again, the x drops them from the list.
function RecentPeople({ people, selected, onPick, onForget }) {
  const shown = people.filter((person) => !selected.some((email) => sameEmail(email, person.email)))
  if (!shown.length) return null
  return <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]"><ClockCounterClockwise size={12} weight="bold" />Recent</span>
    {shown.map((person) => <span key={person.email} className="inline-flex items-center rounded-full bg-[var(--paper)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]">
      <button type="button" onClick={() => onPick(person)} title={`Add ${person.email}`} className="inline-flex items-center gap-1.5 py-1 pl-1 pr-1.5 text-[11px] font-semibold"><Avatar name={person.name} small />{person.name}</button>
      <button type="button" onClick={() => onForget(person.email)} aria-label={`Remove ${person.name} from recent`} title="Remove from recent" className="mr-1 grid size-4 place-items-center rounded-full text-[var(--muted)] opacity-60 transition-opacity hover:bg-black/10 hover:opacity-100"><X size={9} weight="bold" /></button>
    </span>)}
  </div>
}

// "Send to" field: as the user types, suggests CRM teammates by name or email, or offers to add a typed email address.
function RecipientPicker({ members, loading, selected, exclude, nameOf, onAdd, onRemove }) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const query = term.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (!query) return []
    const taken = (email) => sameEmail(email, exclude) || selected.some((item) => sameEmail(item, email))
    // Names that start with the typed text come first; the list is already alphabetical.
    const matches = members
      .filter((member) => !taken(member.email) && `${member.name} ${member.email}`.toLowerCase().includes(query))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(query)) - Number(!b.name.toLowerCase().startsWith(query)))
      .slice(0, 6)
    const typed = EMAIL.test(query) && !taken(query) && !matches.some((member) => sameEmail(member.email, query))
    return typed ? [...matches, { email: term.trim(), name: term.trim(), typed: true }] : matches
  }, [members, query, term, selected, exclude])
  const listOpen = open && query.length > 0

  const pick = (person) => { onAdd(person); setTerm(''); setActive(0) }
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, suggestions.length - 1)) }
    else if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)) }
    else if (event.key === 'Enter' && listOpen && suggestions[active]) { event.preventDefault(); pick(suggestions[active]) }
    else if (event.key === 'Backspace' && !term && selected.length) onRemove(selected[selected.length - 1])
    // Escape closes the suggestions first; a second Escape closes the dialog.
    else if (event.key === 'Escape' && listOpen) { event.stopPropagation(); setOpen(false) }
  }

  return <div className="relative mt-2">
    <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-[var(--paper)] px-3 py-2 ring-1 ring-black/5 focus-within:ring-[var(--lime-dark)]">
      {selected.map((email) => <span key={email} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--surface)] py-1 pl-1 pr-1.5 text-[11px] font-semibold ring-1 ring-[var(--line)]">
        <Avatar name={nameOf(email)} small />
        <span className="truncate" title={email}>{nameOf(email)}</span>
        <button type="button" onClick={() => onRemove(email)} aria-label={`Remove ${nameOf(email)}`} className="grid size-4 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10 hover:text-[var(--ink)]"><X size={10} weight="bold" /></button>
      </span>)}
      <input
        value={term}
        onChange={(event) => { setTerm(event.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={selected.length ? 'Add another person' : 'Type a name or email'}
        aria-label="Send to"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls="share-suggestions"
        aria-autocomplete="list"
        className="min-w-[10rem] flex-1 bg-transparent py-1 text-xs outline-none"
      />
    </div>
    {listOpen && <div id="share-suggestions" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-60 overflow-y-auto rounded-2xl bg-[var(--surface)] p-1 shadow-[0_18px_50px_rgb(var(--shadow-rgb)/.18)] ring-1 ring-[var(--line)] [scrollbar-width:thin]">
      {loading && !suggestions.length ? <p className="p-3 text-xs text-[var(--muted)]">Loading teammates…</p>
        : suggestions.length ? suggestions.map((person, index) => <button
          key={person.email}
          type="button"
          role="option"
          aria-selected={index === active}
          // mousedown keeps focus in the input, so its blur does not close the list before the click lands.
          onMouseDown={(event) => { event.preventDefault(); pick(person) }}
          onMouseEnter={() => setActive(index)}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${index === active ? 'bg-[var(--paper)]' : ''}`}
        >
          {person.typed ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[var(--on-lime)]"><Plus size={13} weight="bold" /></span> : <Avatar name={person.name} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{person.typed ? `Add ${person.email}` : person.name}</span>
            <span className="block truncate text-[11px] text-[var(--muted)]">{person.typed ? 'Not in the CRM user list' : [person.title, person.email].filter(Boolean).join(' · ')}</span>
          </span>
        </button>)
          : <p className="p-3 text-xs text-[var(--muted)]">No teammate matches “{term.trim()}”. Type a full email address to add someone else.</p>}
    </div>}
  </div>
}

/** Shares a job; see ShareDialog. */
export default function ShareJobDialog({ job, mode, onClose }) {
  return <ShareDialog
    noun="job"
    eyebrow={job.status === 'Live' ? 'Live Upwork job' : job.company}
    title={job.title}
    link={jobShareLink(job)}
    text={defaultMessage(job)}
    subject={`Job: ${job.title}`}
    mode={mode}
    onClose={onClose}
  />
}

/**
 * Shares anything with a title and a link in Teams, with type-ahead recipients and a per-user Recent list.
 * mode: 'teams' shares in Teams (to chosen people, or any chat picked in Teams), 'notify' messages chosen teammates directly.
 * `link` is what Teams previews; `text` is the editable starting message; `subject` is used for email.
 */
export function ShareDialog({ noun = 'job', eyebrow, title, link, text, subject, mode: initialMode = 'teams', onClose }) {
  const { user } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [message, setMessage] = useState(() => text)
  const [query, setQuery] = useState('')
  // Emails of the people to send to; shared by both tabs.
  const [selected, setSelected] = useState([])
  const [recent, setRecent] = useState(() => loadRecentRecipients(user?.email))
  const [copied, copy] = useCopied()
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['team-members'], queryFn: api.getTeamMembers, staleTime: 10 * 60_000 })
  const members = useMemo(() => asArray(data), [data])
  const self = String(user?.email || '').toLowerCase()
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return members.filter((member) => asText(member.email).toLowerCase() !== self && (!term || `${member.name} ${member.email} ${member.title}`.toLowerCase().includes(term)))
  }, [members, query, self])
  const nameOf = (email) => members.find((member) => sameEmail(member.email, email))?.name || recent.find((person) => sameEmail(person.email, email))?.name || email
  const add = (person) => setSelected((current) => (current.some((email) => sameEmail(email, person.email)) ? current : [...current, person.email]))
  const remove = (email) => setSelected((current) => current.filter((item) => !sameEmail(item, email)))
  // Called on send, so the people show under Recent next time.
  const rememberSelected = () => setRecent(rememberRecipients(user?.email, selected.map((email) => ({ email, name: nameOf(email) }))))
  const forget = (email) => setRecent(forgetRecipient(user?.email, email))
  const tab = (value) => `flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${mode === value ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`
  const open = (url) => window.open(url, '_blank', 'noopener,noreferrer')
  const sendChat = () => { rememberSelected(); open(teamsChatUrl(selected, title, message.trim())) }

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow={`Share ${noun}`} title={mode === 'teams' ? 'Share in Teams chat' : 'Notify your team'} onClose={onClose} />
    <div className="mt-6 flex gap-1 rounded-full bg-[var(--paper)] p-1">
      <button type="button" aria-pressed={mode === 'teams'} onClick={() => setMode('teams')} className={tab('teams')}><MicrosoftTeamsLogo size={15} weight="fill" />Share in Teams</button>
      <button type="button" aria-pressed={mode === 'notify'} onClick={() => setMode('notify')} className={tab('notify')}><UsersThree size={15} weight="bold" />Notify team</button>
    </div>

    <div className="mt-5 rounded-2xl bg-[var(--paper)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">{eyebrow}</p><p className="mt-1 text-sm font-semibold">{title}</p></div>

    <div className="mt-5 flex items-center justify-between"><label htmlFor="share-message" className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Message</label><button type="button" onClick={() => copy('message', message)} className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">{copied === 'message' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'message' ? 'Copied' : 'Copy'}</button></div>
    <textarea id="share-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={6} className="mt-2 w-full resize-y rounded-2xl bg-[var(--paper)] p-4 text-sm leading-6 outline-none ring-1 ring-black/5 focus:ring-[var(--lime-dark)]" />

    {mode === 'teams'
      ? <>
        <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Send to <span className="normal-case tracking-normal opacity-70">(optional)</span></p>{selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear</button>}</div>
        <RecipientPicker members={members} loading={isLoading} selected={selected} exclude={self} nameOf={nameOf} onAdd={add} onRemove={remove} />
        {isError && <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">{error?.message || 'Could not load teammates.'} You can still type a full email address.</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Retry</button></p>}
        <RecentPeople people={recent} selected={selected} onPick={add} onForget={forget} />
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{selected.length ? 'Opens a Teams chat with these people and the message ready to send.' : 'Leave this empty to pick any chat or channel in Teams instead.'}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)]">Cancel</button>
          <button type="button" disabled={!message.trim()} onClick={() => (selected.length ? sendChat() : open(teamsShareUrl(link, message.trim())))} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-teams px-5 py-3 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"><MicrosoftTeamsLogo size={16} weight="fill" />{selected.length ? `Send to ${selected.length === 1 ? nameOf(selected[0]) : `${selected.length} people`}` : 'Share in Teams'}<ArrowSquareOut size={14} /></button>
        </div>
      </>
      : <>
        <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Teammates{selected.length > 0 && <span className="ml-2 rounded-full bg-[var(--lime)] px-1.5 py-0.5 text-[var(--on-lime)]">{selected.length}</span>}</p>{selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear</button>}</div>
        <RecentPeople people={recent} selected={selected} onPick={add} onForget={forget} />
        <label className="mt-2 flex items-center gap-2 rounded-full bg-[var(--paper)] px-4 py-2.5 ring-1 ring-black/5 focus-within:ring-[var(--lime-dark)]"><MagnifyingGlass size={14} className="text-[var(--muted)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" aria-label="Search teammates" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl ring-1 ring-[var(--line)] [scrollbar-width:thin]">
          {isLoading ? <div className="space-y-2 p-3">{[0, 1, 2].map((item) => <span key={item} className="skeleton-bone block h-10 rounded-xl" />)}</div>
            : isError ? <p role="alert" className="flex items-start gap-2 p-4 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">{error?.message || 'Could not load teammates.'}</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Retry</button></p>
              : visible.length ? visible.map((member) => {
                const active = selected.some((email) => sameEmail(email, member.email))
                return <button key={member.id} type="button" aria-pressed={active} onClick={() => (active ? remove(member.email) : add(member))} className={`flex w-full items-center gap-3 border-b border-[var(--line)]/60 px-3 py-2.5 text-left last:border-0 transition-colors ${active ? 'bg-[var(--lime-tint)]/25' : 'hover:bg-[var(--paper)]'}`}>
                  <Avatar name={member.name} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{member.name}</span><span className="block truncate text-[11px] text-[var(--muted)]">{[member.title, member.email].filter(Boolean).join(' · ')}</span></span>
                  {active && <CheckCircle size={17} weight="fill" className="shrink-0 text-[var(--accent-strong)]" />}
                </button>
              }) : <p className="p-4 text-center text-xs text-[var(--muted)]">{query ? 'No teammate matches that search.' : 'No teammates found.'}</p>}
        </div>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Opens a Teams chat with the selected teammates and this message ready to send.</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)]">Cancel</button>
          <button type="button" disabled={!selected.length || !message.trim()} onClick={() => { rememberSelected(); window.location.href = `mailto:${selected.join(',')}?subject=${encodeURIComponent(subject || title)}&body=${encodeURIComponent(message.trim())}` }} className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs font-bold ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)] disabled:opacity-50"><EnvelopeSimple size={15} />Email instead</button>
          <button type="button" disabled={!selected.length || !message.trim()} onClick={sendChat} className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-teams px-5 py-3 text-xs font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"><MicrosoftTeamsLogo size={16} weight="fill" />Notify in Teams<ArrowSquareOut size={14} /></button>
        </div>
      </>}
  </Modal>
}
