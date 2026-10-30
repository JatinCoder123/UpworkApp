import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ChatCircleText, CheckCircle, CircleNotch, Star } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { useAuth } from '../contexts/AuthContext'
import { sectionForPath, useFeedback, useSendFeedback } from '../lib/feedback'

const STATUS_TONE = {
  new: 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]',
  in_progress: 'bg-[var(--warn-bg)] text-[var(--warn)] ring-[var(--warn)]/25',
  done: 'bg-[var(--ok-bg)] text-[var(--ok)] ring-[var(--ok)]/25',
  wont_do: 'bg-[var(--bad-bg)] text-[var(--bad)] ring-[var(--bad)]/25',
}

export function FeedbackStatus({ status, label }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${STATUS_TONE[status] || STATUS_TONE.new}`}>{label}</span>
}

export function Stars({ value, onChange, size = 18 }) {
  return <div className="flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined} aria-label="Rating">
    {[1, 2, 3, 4, 5].map((star) => {
      const on = star <= value
      const icon = <Star size={size} weight={on ? 'fill' : 'regular'} className={on ? 'text-star' : 'text-[var(--muted)]'} />
      return onChange
        ? <button key={star} type="button" role="radio" aria-checked={value === star} aria-label={`${star} of 5`} onClick={() => onChange(value === star ? 0 : star)} className="rounded p-0.5 transition-transform hover:scale-110">{icon}</button>
        : <span key={star}>{icon}</span>
    })}
  </div>
}

/**
 * "Feedback" on every signed-in page: `trigger(open)` draws its button, which the Shell keeps in the sidebar and the
 * phone menu so it never covers the page. The form knows the section and page it was opened on; the user adds a
 * type, an optional 1-5 rating and the message, saved in the CRM (outr_feedback). Below it, the user's own feedback
 * with its status.
 */
export default function FeedbackWidget({ trigger }) {
  const { user } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  if (!user) return null
  return <>
    {trigger(() => setOpen(true))}
    {open && <FeedbackDialog user={user} section={sectionForPath(location.pathname)} pageUrl={`${location.pathname}${location.search}`} onClose={() => setOpen(false)} />}
  </>
}

function FeedbackDialog({ user, section, pageUrl, onClose }) {
  const { entries: mine, types, typeLabel, statusLabel, isLoading, error: loadError } = useFeedback({ user, mine: true })
  const send = useSendFeedback(user)
  const [type, setType] = useState('improvement')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  const submit = (event) => {
    event.preventDefault()
    send.mutate({ section, pageUrl, type, typeLabel: typeLabel(type), rating, message }, {
      onSuccess: () => { setMessage(''); setRating(0); setSent(true) },
    })
  }

  return <Modal onClose={onClose}>
    <DialogHeader eyebrow={`Feedback · ${section}`} title="Help us improve" onClose={onClose} />

    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Type</p>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--paper)] p-1 ring-1 ring-[var(--line)] sm:grid-cols-4" role="radiogroup" aria-label="Feedback type">
          {types.map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={type === id} onClick={() => setType(id)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${type === id ? 'bg-[var(--text)] text-[var(--paper)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{label}</button>)}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">How is {section} working for you? <span className="font-medium normal-case tracking-normal">(optional)</span></p>
        <div className="mt-2"><Stars value={rating} onChange={setRating} size={22} /></div>
      </div>
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Your feedback</span>
        <textarea value={message} onChange={(event) => { setMessage(event.target.value); setSent(false) }} rows={4} required placeholder={`What should we improve in ${section}?`} className="mt-2 w-full resize-y rounded-xl bg-[var(--paper)] px-3.5 py-3 text-sm text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--lime-dark)]" />
      </label>
      {send.error && <p role="alert" className="rounded-xl bg-[var(--bad-bg)] px-3 py-2 text-xs font-semibold text-[var(--bad)]">{send.error.message || 'Your feedback could not be sent. Please try again.'}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-[11px] text-[var(--muted)]">Page: {pageUrl}</p>
        {sent
          ? <p role="status" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-[var(--ok)]"><CheckCircle size={15} weight="fill" />Thanks, sent!</p>
          : <button type="submit" disabled={!message.trim() || send.isPending} className={primaryButton}><span>{send.isPending ? 'Sending…' : 'Send feedback'}</span><span className="grid size-8 place-items-center rounded-full bg-white/10">{send.isPending ? <CircleNotch size={14} className="animate-spin" /> : <ChatCircleText size={14} />}</span></button>}
      </div>
    </form>

    <div className="mt-7 border-t border-[var(--line)] pt-5">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">My feedback <span className="font-mono">{mine.length}</span></p>
      {isLoading && <p className="mt-3 text-xs text-[var(--muted)]">Loading…</p>}
      {loadError && <p role="alert" className="mt-3 text-xs font-semibold text-[var(--bad)]">Your feedback could not be loaded: {loadError.message}</p>}
      {!isLoading && !loadError && !mine.length && <p className="mt-3 text-xs text-[var(--muted)]">Nothing sent yet.</p>}
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
        {mine.map((entry) => <li key={entry.id} className="rounded-xl bg-[var(--paper)] p-3 ring-1 ring-[var(--line)]">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
            <FeedbackStatus status={entry.status} label={statusLabel(entry.status)} />
            <span className="font-semibold text-[var(--ink)]">{entry.section}</span>·<span>{typeLabel(entry.type)}</span>
            {entry.rating > 0 && <Stars value={entry.rating} size={11} />}
            <span className="ml-auto" title={entry.createdAt}>{entry.createdAgo || entry.createdAt}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-xs text-[var(--ink)]">{entry.message}</p>
        </li>)}
      </ul>
    </div>
  </Modal>
}
