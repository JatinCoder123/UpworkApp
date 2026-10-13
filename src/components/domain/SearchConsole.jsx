import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Globe, Lightning, MagicWand, Question, X } from '@phosphor-icons/react'
import { checkRdap, detectInputMode, domainLabel, isAbortError, tryNormalizeDomain } from '../../services/domainApi'

const TLD_OPTIONS = ['com', 'io', 'ai', 'co', 'net']

const MODES = [
  { id: 'auto', label: 'Auto' },
  { id: 'domain', label: 'Domain' },
  { id: 'prompt', label: 'Idea' },
]

const EXAMPLES = [
  'AI bookkeeping for freelancers',
  'Plant-based snacks for kids',
  'A CRM for real-estate agents',
  'Travel planner for remote workers',
  'outright',
]

const PLACEHOLDERS = [
  'Type a name like “lumora” or “lumora.ai”…',
  'Or describe your idea: “a calm meditation app for nurses”…',
  'Paste a URL to check it: https://example.com',
]

function useRotatingPlaceholder(active) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setIndex((value) => (value + 1) % PLACEHOLDERS.length), 3600)
    return () => clearInterval(timer)
  }, [active])
  return PLACEHOLDERS[index]
}

/** Instant, free registry peek (RDAP) while the user types a single name. */
function useRegistryPeek(value, tlds, enabled) {
  const [statuses, setStatuses] = useState({})
  const key = useMemo(() => {
    const raw = String(value || '').trim().toLowerCase()
    const exact = enabled ? tryNormalizeDomain(raw) : ''
    if (!exact || domainLabel(exact).length < 2) return ''
    const label = domainLabel(exact)
    return [...new Set([raw.includes('.') ? exact : null, ...tlds.map((tld) => `${label}.${tld}`)].filter(Boolean))].slice(0, 6).join(' ')
  }, [value, tlds, enabled])
  useEffect(() => {
    if (!key) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      key.split(' ').forEach((domain) => {
        checkRdap(domain, { signal: controller.signal })
          .then((result) => setStatuses((current) => ({ ...current, [domain]: result.available === true ? 'free' : result.available === false ? 'taken' : 'unknown' })))
          .catch((error) => { if (!isAbortError(error)) setStatuses((current) => ({ ...current, [domain]: 'unknown' })) })
      })
    }, 650)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key])
  return key ? key.split(' ').map((domain) => ({ domain, status: statuses[domain] || 'loading' })) : []
}

export default function SearchConsole({ value, onChange, mode, onModeChange, tlds, onTldsChange, onSubmit, busy, inputRef, onPeekCheck }) {
  const [focused, setFocused] = useState(false)
  const detected = mode === 'auto' ? detectInputMode(value) : mode
  const promptMode = detected === 'prompt'
  const placeholder = useRotatingPlaceholder(!focused && !value)
  const peek = useRegistryPeek(value, tlds, !promptMode && !busy)
  const hint = !value.trim() && mode === 'auto'
    ? 'Enter a domain, a single name, or describe your business.'
    : mode === 'auto'
      ? `Detected: ${promptMode ? 'business idea — AI will coin names and check them' : 'domain name — we will check it and find alternatives'}`
      : promptMode ? 'AI will suggest names and check availability.' : `Checks this exact name; bare names use .${tlds.includes('com') ? 'com' : tlds[0]}.`

  const toggleTld = (tld) => {
    const next = tlds.includes(tld) ? tlds.filter((item) => item !== tld) : [...tlds, tld]
    if (next.length) onTldsChange(TLD_OPTIONS.filter((item) => next.includes(item)))
  }

  const submit = (event) => {
    event.preventDefault()
    onSubmit()
  }

  return <form onSubmit={submit} className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
    <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-4 shadow-[0_24px_70px_rgba(30,32,25,.08)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Search by" className="flex gap-1 rounded-full bg-[var(--paper)] p-1 ring-1 ring-[var(--line)]/70">
          {MODES.map((item) => <button key={item.id} type="button" role="radio" aria-checked={mode === item.id} onClick={() => onModeChange(item.id)} className={`rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-all duration-300 ${mode === item.id ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item.label}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-1" aria-label="Extensions to search">
          {TLD_OPTIONS.map((tld) => <button key={tld} type="button" aria-pressed={tlds.includes(tld)} onClick={() => toggleTld(tld)} className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-medium ring-1 transition-all duration-300 ${tlds.includes(tld) ? 'bg-[var(--lime)] text-[#26320b] ring-[var(--lime-dark)]/40' : 'text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)]'}`}>.{tld}</button>)}
        </div>
      </div>

      <div className={`mt-4 flex flex-col gap-3 rounded-[1.5rem] bg-[var(--paper)] p-3 ring-1 transition-all duration-300 sm:flex-row sm:items-end ${focused ? 'ring-[var(--lime-dark)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--lime)_30%,transparent)]' : 'ring-[var(--line)]'}`}>
        <span className="hidden size-11 shrink-0 place-items-center rounded-2xl bg-[var(--surface)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]/70 sm:grid">{promptMode ? <MagicWand size={20} weight="duotone" /> : <Globe size={20} weight="duotone" />}</span>
        <label htmlFor="domain-search" className="sr-only">Domain name or business description</label>
        <textarea
          id="domain-search"
          ref={inputRef}
          value={value}
          rows={2}
          maxLength={1500}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSubmit() } }}
          placeholder={placeholder}
          className="min-h-14 w-full flex-1 resize-none bg-transparent px-1 py-2 text-lg font-medium tracking-[-.02em] outline-none placeholder:text-[var(--muted)]/70 sm:text-xl"
        />
        <button type="submit" disabled={busy} className="upwork-apply-button inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold disabled:pointer-events-none disabled:opacity-60">
          <span className="relative z-10 inline-flex items-center gap-2">{busy ? 'Working…' : promptMode ? 'Find available names' : 'Check availability'}<ArrowRight size={15} weight="bold" /></span>
        </button>
      </div>

      <p className="mt-3 flex items-center gap-1.5 px-1 text-[11px] font-medium text-[var(--muted)]"><Lightning size={12} weight="fill" className="text-[var(--accent)]" />{hint} <span className="hidden sm:inline">· Enter to search, Shift+Enter for a new line.</span></p>

      {peek.length > 0 && <div className="mt-4 border-t border-[var(--line)]/70 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Registry peek · tap to run a full check</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {peek.map((entry, index) => <button key={entry.domain} type="button" onClick={() => onPeekCheck(entry.domain)} style={{ '--i': index }} className={`domain-chip-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs ring-1 transition-transform hover:-translate-y-0.5 ${entry.status === 'free' ? 'bg-[var(--ok-bg)] text-[var(--ok)] ring-[var(--ok)]/25' : entry.status === 'taken' ? 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]' : 'bg-[var(--paper)] text-[var(--ink)] ring-[var(--line)]'}`}>
            {entry.status === 'loading' && <span className="domain-pulse-dot size-1.5 rounded-full bg-[var(--accent)]" />}
            {entry.status === 'free' && <Check size={12} weight="bold" />}
            {entry.status === 'taken' && <X size={11} weight="bold" />}
            {entry.status === 'unknown' && <Question size={12} weight="bold" />}
            <span className={entry.status === 'taken' ? 'line-through' : ''}>{entry.domain}</span>
          </button>)}
        </div>
      </div>}

      {!value.trim() && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)]/70 pt-4">
        <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Try</span>
        {EXAMPLES.map((example) => <button key={example} type="button" onClick={() => onChange(example)} className="rounded-full bg-[var(--paper)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] transition-all hover:-translate-y-0.5 hover:ring-[var(--lime-dark)]">{example}</button>)}
      </div>}
    </div>
  </form>
}
