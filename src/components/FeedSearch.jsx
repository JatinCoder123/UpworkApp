import { useEffect, useRef, useState } from 'react'
import { ClockCounterClockwise, MagnifyingGlass, Sparkle, X } from '@phosphor-icons/react'
import { sectionLabel as label } from './SectionControls'
import { forgetSearch, loadRecentSearches, rememberSearch } from '../lib/jobSignals'

const SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'

/**
 * Search bar of the feed sections (WordPress, LLM), styled like the Jobs search: lime magnifier, Ctrl K / ⌘K to focus,
 * Esc to clear, and the user's recent searches (saved in this browser per `scope`) under it while it has focus, plus
 * a few `suggestions` (terms from the section's own data) so there is always something to pick.
 */
export default function FeedSearch({ value, onChange, email, scope, placeholder, label: ariaLabel = 'Search', suggestions = [] }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)
  const [recent, setRecent] = useState(() => loadRecentSearches(email, scope))
  const term = value.trim().toLowerCase()
  const history = recent.filter((item) => item.toLowerCase() !== term && (!term || item.toLowerCase().includes(term))).slice(0, 6)
  const suggested = [...new Set(suggestions)].filter((item) => item && item.toLowerCase() !== term && (!term || item.toLowerCase().includes(term)) && !history.some((entry) => entry.toLowerCase() === item.toLowerCase())).slice(0, 5)
  const pick = (item) => { onChange(item); setRecent(rememberSearch(email, item, scope)); setFocused(false) }
  const remember = () => { if (value.trim()) setRecent(rememberSearch(email, value, scope)) }
  useEffect(() => {
    const focusSearch = (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); inputRef.current?.focus() } }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  return <form onSubmit={(event) => { event.preventDefault(); remember(); setFocused(false) }} className="job-search relative order-last flex w-full min-w-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-1.5 md:order-none md:w-auto md:max-w-xl md:flex-1">
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--lime)] text-[#26320b] shadow-[0_2px_8px_color-mix(in_srgb,var(--lime-dark)_35%,transparent)]"><MagnifyingGlass size={15} weight="bold" /></span>
    <input ref={inputRef} value={value} onChange={(event) => { onChange(event.target.value); setFocused(true) }} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); remember() }} onKeyDown={(event) => event.key === 'Escape' && (value ? onChange('') : event.currentTarget.blur())} placeholder={placeholder} aria-label={ariaLabel} aria-expanded={focused && (history.length > 0 || suggested.length > 0)} aria-keyshortcuts="Control+K Meta+K" autoComplete="off" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-[var(--muted)]" />
    {value
      ? <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(''); inputRef.current?.focus() }} aria-label="Clear search" className="grid size-7 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 hover:text-[var(--ink)] dark:bg-white/10"><X size={12} weight="bold" /></button>
      : <kbd className="hidden shrink-0 rounded-lg bg-[var(--surface)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] sm:inline-block">{SHORTCUT}</kbd>}
    {focused && (history.length > 0 || suggested.length > 0) && <div onMouseDown={(event) => event.preventDefault()} className="absolute inset-x-0 top-[calc(100%+.5rem)] z-50 rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5">
      <div className="rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-2">
        {history.length > 0 && <>
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1"><span className={label}>Recent searches</span><button type="button" onClick={() => { recent.forEach((item) => forgetSearch(email, item, scope)); setRecent([]) }} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear history</button></div>
          <ul>{history.map((item) => <li key={item} className="group/term flex items-center rounded-xl hover:bg-[var(--paper)]">
            <button type="button" onClick={() => pick(item)} className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs font-semibold text-[var(--muted)] group-hover/term:text-[var(--ink)]"><ClockCounterClockwise size={14} className="shrink-0" /><span className="truncate">{item}</span></button>
            <button type="button" onClick={() => setRecent(forgetSearch(email, item, scope))} aria-label={`Forget search ${item}`} className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10 hover:text-[var(--ink)]"><X size={11} /></button>
          </li>)}</ul>
        </>}
        {suggested.length > 0 && <>
          <p className={`${label} px-2 pb-1.5 ${history.length ? 'mt-1.5 border-t border-[var(--line)]/70 pt-2.5' : 'pt-1'}`}>Try searching</p>
          <ul>{suggested.map((item) => <li key={item}>
            <button type="button" onClick={() => pick(item)} className="flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]"><Sparkle size={14} className="shrink-0 text-[var(--accent-strong)]" /><span className="truncate">{item}</span></button>
          </li>)}</ul>
        </>}
      </div>
    </div>}
  </form>
}
