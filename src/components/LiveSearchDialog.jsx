import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ArrowUpRight, Broadcast, CheckCircle, Info, MagnifyingGlass, X } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { api } from '../services/api'

const STEPS = [
  'Connecting to the Upwork marketplace',
  'Searching jobs for your keywords',
  'Filtering by posting time and budget',
  'Scoring matches against your skills',
  'Removing jobs already in your feed',
]
const STEP_MS = 1000

export default function LiveSearchDialog({ suggestions = [], onClose }) {
  const [query, setQuery] = useState('')
  const [step, setStep] = useState(0)
  const controller = useRef(null)
  const search = useMutation({
    mutationFn: (value) => {
      controller.current = new AbortController()
      return api.liveSearchJobs({ query: value, signal: controller.current.signal })
    },
  })

  useEffect(() => {
    if (!search.isPending) return undefined
    const timer = window.setInterval(() => setStep((current) => Math.min(current + 1, STEPS.length - 1)), STEP_MS)
    return () => window.clearInterval(timer)
  }, [search.isPending])
  useEffect(() => () => controller.current?.abort(), [])

  const start = (value = query) => {
    const trimmed = value.trim()
    if (!trimmed || search.isPending) return
    setQuery(trimmed)
    setStep(0)
    search.mutate(trimmed)
  }
  const cancel = () => { controller.current?.abort(); search.reset() }
  const done = search.isSuccess

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow="Live from Upwork" title="Search jobs live" onClose={onClose} />
    <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">Search Upwork directly for fresh jobs that are not in your feed yet.</p>

    <form onSubmit={(event) => { event.preventDefault(); start() }} className="mt-7 flex items-center gap-2 rounded-2xl bg-[var(--paper)] p-2 ring-1 ring-black/5 focus-within:ring-[var(--lime-dark)]">
      <span className="grid size-10 shrink-0 place-items-center text-[var(--muted)]"><MagnifyingGlass size={18} /></span>
      <input autoFocus value={query} disabled={search.isPending} onChange={(event) => { setQuery(event.target.value); if (done) search.reset() }} placeholder="e.g. WordPress plugin, SuiteCRM, Twilio" className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none disabled:opacity-60" />
      {search.isPending
        ? <button type="button" onClick={cancel} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--muted)] hover:bg-black/5"><X size={13} weight="bold" />Stop</button>
        : <button type="submit" disabled={!query.trim()} className="shrink-0 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-xs font-bold text-white transition-opacity disabled:opacity-40">Search</button>}
    </form>

    {!search.isPending && !done && suggestions.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Try</span>
      {suggestions.slice(0, 6).map((item) => <button key={item} type="button" onClick={() => start(item)} className="rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]">{item}</button>)}
    </div>}

    {search.isPending && <div className="mt-7 grid gap-6 sm:grid-cols-[9rem_1fr] sm:items-center" role="status" aria-live="polite">
      <div className="live-radar mx-auto" aria-hidden="true"><span /><span /><span /><i /><Broadcast size={22} weight="duotone" className="relative z-10 text-[var(--accent-strong)]" /></div>
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/[.07] dark:bg-white/10"><div className="live-progress h-full rounded-full bg-[var(--lime-dark)]" /></div>
        <ol className="mt-5 space-y-2.5">{STEPS.map((label, index) => <li key={label} className={`flex items-center gap-2.5 text-xs font-semibold transition-all duration-500 ${index > step ? 'translate-x-2 opacity-0' : 'translate-x-0 opacity-100'}`}>
          {index < step ? <CheckCircle size={15} weight="fill" className="shrink-0 text-[var(--lime-dark)]" /> : <span className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" />}
          <span className={index < step ? 'text-[var(--muted)]' : ''}>{index === 1 ? `Searching jobs for “${query}”` : label}</span>
        </li>)}</ol>
      </div>
      <div className="grid gap-2 sm:col-span-2">{[0, 1, 2].map((item) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-[var(--paper)] p-3"><span className="skeleton-bone size-9 rounded-xl" /><div className="flex-1 space-y-2"><span className="skeleton-bone block h-2.5 w-3/4 rounded-full" /><span className="skeleton-bone block h-2 w-1/3 rounded-full" /></div></div>)}</div>
    </div>}

    {done && (search.data.records.length ? <ul className="mt-7 grid gap-2">{search.data.records.map((job) => <li key={job.id || job.url}><a href={job.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--paper)] p-4 text-sm font-semibold transition-colors hover:bg-[var(--lime)]/25"><span className="min-w-0 truncate">{job.title}</span><ArrowUpRight size={15} className="shrink-0" /></a></li>)}</ul> : <div className="mt-7 rounded-2xl bg-[var(--paper)] p-5">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--lime)]/40 text-[var(--accent-strong)]"><Info size={18} weight="duotone" /></span><div>
        <p className="text-sm font-semibold">{search.data.connected ? `No new jobs for “${search.data.query}”` : 'Live search is not connected yet'}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{search.data.connected ? 'Try broader keywords or check back in a few minutes.' : 'The search ran in preview mode. Live Upwork results will appear here once the search endpoint is connected.'}</p>
      </div></div>
    </div>)}
    {search.isError && search.error?.code !== 'ABORTED' && <p role="alert" className="mt-5 rounded-xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">{search.error?.message}</p>}

    {done && <button type="button" onClick={() => start()} className={`${primaryButton} mt-6 w-full`}><span>Search again</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-white/10"><ArrowUpRight size={15} /></span></button>}
  </Modal>
}
