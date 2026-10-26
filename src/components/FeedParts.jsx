import { useEffect, useRef } from 'react'
import { Check, Funnel, GearSix, X } from '@phosphor-icons/react'
import HScroll from './HScroll'
import { skillStyle } from '../lib/jobSignals'
import { iconButton } from './ui'
import { sectionLabel as label } from './SectionControls'

/* Small pieces shared by the feed sections (WordPress, LLM, AppScript, Social). */

// The universal filter button (funnel): lime with a count badge while filters are on, as on Jobs and AI News.
export function FilterButton({ count, onClick, title = 'Filters' }) {
  return <button type="button" onClick={onClick} aria-label="Open filters" title={title} className={`relative ${iconButton} ${count ? 'bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/40' : ''}`}>
    <Funnel size={16} weight={count ? 'fill' : 'regular'} />
    {count > 0 && <span className="absolute -right-1 -top-1 grid size-4.5 place-items-center rounded-full bg-[var(--text)] text-[10px] font-bold text-[var(--paper)] ring-2 ring-[var(--surface)]">{count}</span>}
  </button>
}

// The wheel (like Site Content's): opens the full list of one field (categories, types). Lime while one is picked.
export function WheelButton({ active, onClick, title, small = false }) {
  return <button type="button" onClick={onClick} aria-label={title} title={title} className={`grid ${small ? 'size-8' : 'size-10'} shrink-0 place-items-center rounded-full transition-all duration-300 hover:rotate-45 ${active ? 'bg-[var(--lime)] text-[#26320b] ring-2 ring-[var(--lime-dark)]/40 shadow-xs' : 'text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}>
    <GearSix size={small ? 15 : 17} weight="bold" />
  </button>
}

/**
 * One filter on the page (types, categories…): a few chips at a time with arrows to scroll the rest, and the wheel to
 * open the whole list. Chips toggle, so several can be picked; `value` is the picked values, `onChange` gets the new
 * list. `options` are { value, label, icon?, dot?, tone? }; `countOf(value)` is each choice's item count. A chip is in its
 * `tone` (colour classes, e.g. a Google app's colours) or, without one, in its own colour like the Jobs skill chips;
 * a picked chip gets a tick and a stronger look.
 */
export function FilterStrip({ title, icon: Icon, options, value, countOf, onChange, onOpenAll }) {
  const toggle = (choice) => onChange(value.includes(choice) ? value.filter((entry) => entry !== choice) : [...value, choice])
  // Every CRM choice is shown; the ones with no items (with the other filters on) go last, faded.
  const empty = (option) => countOf?.(option.value) === 0 && !value.includes(option.value)
  const ordered = [...options].sort((a, b) => empty(a) - empty(b))
  return <div className={`flex min-w-0 items-center gap-2 rounded-full py-1 pl-3.5 pr-1 ring-1 transition-colors ${value.length ? 'bg-(--lime)/15 ring-[var(--lime-dark)]/35' : 'bg-[var(--paper)] ring-[var(--line)]/60'}`}>
    <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">
      {Icon && <Icon size={13} weight="bold" />}{title}
      {value.length > 0 && <span className="grid min-w-4 place-items-center rounded-full bg-[var(--lime)] px-1 text-[10px] tracking-normal !text-[#26320b]">{value.length}</span>}
    </span>
    <HScroll className="min-w-0 flex-1" innerClassName="gap-1 py-0.5" fade={value.length ? 'color-mix(in srgb, var(--lime) 15%, var(--paper))' : 'var(--paper)'} label={title.toLowerCase()}>
      {ordered.map((option) => {
        const active = value.includes(option.value)
        const OptionIcon = option.icon
        const count = countOf?.(option.value)
        const colours = option.tone
          ? `${option.tone} ${active ? 'outline-2 outline-offset-1 outline-current shadow-sm' : 'opacity-90 hover:opacity-100'}`
          : 'skill-chip'
        return <button key={option.value} type="button" aria-pressed={active} onClick={() => toggle(option.value)} style={option.tone ? undefined : skillStyle(option.value)} className={`shrink-0 rounded-full px-2.5 py-1.5 transition-all duration-300 hover:-translate-y-0.5 ${colours} ${empty(option) ? '!opacity-45' : ''}`}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
            {active ? <Check size={11} weight="bold" /> : option.dot ? <span className={`size-2 rounded-full ${option.dot}`} /> : OptionIcon && <OptionIcon size={12} />}
            {option.label}
            {count != null && <span className="rounded-full bg-black/10 px-1.5 py-px text-[10px] tabular-nums dark:bg-white/15">{count}</span>}
          </span>
        </button>
      })}
    </HScroll>
    <WheelButton active={value.length > 0} onClick={onOpenAll} title={`All ${title.toLowerCase()}`} small />
  </div>
}

// Colours of the details-list icons, by row title, the same in every section (light and dark).
const FACT_TONES = {
  blue: 'bg-[#e0ecfe] text-[#1d4ed8] dark:bg-[#1c2a45] dark:text-[#8ab4f8]',
  violet: 'bg-[#efe4fb] text-[#6b2fa8] dark:bg-[#2e1f45] dark:text-[#d2b4fa]',
  green: 'bg-[#dcf3e3] text-[#137333] dark:bg-[#163323] dark:text-[#81c995]',
  lime: 'bg-(--lime)/40 text-[#3f5a12] dark:text-[var(--accent-strong)]',
  amber: 'bg-[#fef3d6] text-[#a56b00] dark:bg-[#3a2e17] dark:text-[#fdd663]',
  orange: 'bg-[#ffedd5] text-[#c2410c] dark:bg-[#3b1d0e] dark:text-[#fdba74]',
  rose: 'bg-[#fde2e7] text-[#be123c] dark:bg-[#3d1a22] dark:text-[#fda4af]',
  sky: 'bg-[#e0f2fe] text-[#0369a1] dark:bg-[#7dd3fc]/15 dark:text-[#7dd3fc]',
  teal: 'bg-[#ccfbf1] text-[#0f766e] dark:bg-[#123a35] dark:text-[#5eead4]',
  indigo: 'bg-[#e8eafe] text-[#3b3f8f] dark:bg-[#252845] dark:text-[#b9befa]',
  pink: 'bg-[#fce7f3] text-[#9d2a6a] dark:bg-[#3d1d30] dark:text-[#f3a6d0]',
  slate: 'bg-[#e8eaf0] text-[#334155] dark:bg-[#262a33] dark:text-[#c3cad6]',
}
const FACT_COLOURS = {
  Category: 'violet', Author: 'blue', 'Company / author': 'blue', Source: 'sky', Pricing: 'green', Price: 'green', 'Price range': 'green',
  Access: 'teal', Cost: 'green', 'Demand score': 'lime', 'Demand proof': 'lime', 'Last updated': 'amber', Published: 'teal', Posted: 'teal',
  'Added to the feed': 'pink', Model: 'indigo', 'Model type': 'violet', 'Available on': 'sky', Topic: 'violet', 'Skill level': 'orange',
  Duration: 'amber', 'Build time': 'amber', Prerequisites: 'rose', 'Tech stack': 'indigo', Hardware: 'slate', 'Earning model': 'orange',
  'Similar tools': 'indigo', Platform: 'blue', Format: 'indigo', 'Content type': 'violet', Niche: 'orange', Goal: 'rose',
  'Best time': 'amber', Scheduled: 'sky', 'Good time for post': 'sky', Characters: 'slate',
}

// The icon of a details-list row (Category, Author…), in a small tile in that row's colour.
export function FactIcon({ icon: Icon, title }) {
  return <span className={`grid size-6 shrink-0 place-items-center rounded-lg ${FACT_TONES[FACT_COLOURS[title]] || FACT_TONES.slate}`}><Icon size={13} weight="bold" /></span>
}

// A filter in use, with x to remove it (like the Jobs filter chips).
export function FilterChip({ children, onClear }) {
  return <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--lime)]/35 px-3 py-1.5 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--lime-dark)]/25">
    {children}
    <button type="button" onClick={onClear} aria-label={`Remove ${children} filter`} className="grid size-4 place-items-center rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/15"><X size={11} /></button>
  </span>
}

// The end of a paged list: the next page loads as it comes into view (`ref`); says "Loading more", "Scroll for more"
// or "All N loaded".
export function MoreLoader({ ref, loading, more, total }) {
  return <div ref={ref} className="flex min-h-16 items-center justify-center py-6" aria-live="polite">
    {loading
      ? <span className="flex items-center gap-3 text-[13px] font-semibold text-[var(--muted)]"><span className="size-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" />Loading more</span>
      : <span className={label}>{more ? 'Scroll for more' : `All ${total} loaded`}</span>}
  </div>
}

// Round icon button for a quick status change on a card.
export function QuickAction({ icon: Icon, active, label: text, onClick }) {
  return <button type="button" onClick={onClick} aria-pressed={active} aria-label={text} title={text} className={`grid size-8 place-items-center rounded-full ring-1 transition-colors ${active ? 'bg-[var(--text)] text-[var(--paper)] ring-[var(--text)]' : 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}><Icon size={14} weight={active ? 'fill' : 'regular'} /></button>
}

// One value with its icon and caption, e.g. "Installs / 120K". `wrap` lets a long value use two lines.
export function Metric({ icon: Icon, tone = 'text-[var(--muted)]', value, caption, wrap = false, children }) {
  return <div className="min-w-0 rounded-xl bg-[var(--paper)] px-3 py-2.5 ring-1 ring-[var(--line)]/60">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]"><Icon size={13} weight="bold" className={tone} />{caption}</p>
    <p className={`mt-1 text-[15px] font-semibold ${wrap ? 'leading-5' : 'truncate'}`}>{value || <span className="text-[var(--muted)]">-</span>}</p>
    {children}
  </div>
}

/**
 * Sticky, scrollable index of the items shown (like the Jobs index), hidden on small screens. Clicking an entry jumps
 * to its card; `activeId` is highlighted. `meta(item)` is the small line under the name, `mark(item)` an optional
 * badge on the right.
 */
// `fill`: the list fills its box (a drawer's side) instead of following the page, and keeps the active item in view.
export function FeedIndex({ items, activeId, onJump, meta, mark, fill = false }) {
  const list = useRef(null)
  useEffect(() => {
    if (fill) list.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [fill, activeId])
  return <nav aria-label="Jump to item" className={fill ? 'h-full' : 'hidden lg:block'}>
    <div ref={list} className={`${fill ? 'h-full' : 'sticky top-[calc(var(--shell-h)+1rem)] max-h-[calc(100dvh-var(--shell-h)-2rem)]'} overflow-y-auto overscroll-contain rounded-[1.5rem] bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70 [scrollbar-width:thin]`}>
      <p className={`${label} px-2 pb-2`}>{items.length} {items.length === 1 ? 'item' : 'items'} shown</p>
      <ol className="space-y-0.5">{items.map((item, index) => {
        const active = activeId === item.id
        return <li key={item.id}>
          <button type="button" onClick={() => onJump(item.id)} aria-current={active ? 'true' : undefined} className={`flex w-full gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${active ? 'bg-[var(--lime)]/30' : 'hover:bg-[var(--paper)]'}`}>
            <span className={`mt-0.5 font-mono text-[11px] font-bold ${active ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`}>{String(index + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-xs font-semibold leading-4">{item.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">{meta(item)}</span>
            </span>
            {mark?.(item)}
          </button>
        </li>
      })}</ol>
    </div>
  </nav>
}
