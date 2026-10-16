import { useEffect, useId, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ArrowSquareOut, CaretDown, ChartBar, Check, Copy, Crown, Info, MagnifyingGlass, Sparkle, Star } from '@phosphor-icons/react'
import { CATEGORY_ICONS, STATUS_META } from './meta'
import { CHECK_CATEGORIES, domainLabel, formatPrice, goDaddySearchUrl, isPremiumDomain, oneYearPricePlan } from '../../services/domainApi'

const softButton = 'inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-all duration-300 hover:-translate-y-0.5 hover:ring-[var(--lime-dark)]/60 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50'

export function DomainName({ domain, className = '' }) {
  const label = domainLabel(domain)
  return <span className={`break-all font-semibold tracking-[-.045em] ${className}`}>{label}<span className="text-[var(--muted)]">{String(domain).slice(label.length)}</span></span>
}

export function ScoreRing({ score, size = 64, label = 'Brand score' }) {
  const radius = size / 2 - 5
  const circumference = 2 * Math.PI * radius
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(score))
    return () => cancelAnimationFrame(frame)
  }, [score])
  const color = score >= 80 ? 'var(--lime-dark)' : score >= 60 ? 'var(--warn)' : 'var(--bad)'
  return <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score} out of 100`}>
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth="5" />
      <circle className="domain-ring-track" cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown / 100)} />
    </svg>
    <span className="absolute text-base font-bold tabular-nums tracking-[-.04em]">{score}</span>
  </div>
}

export function DomainActions({ item, onCopy, onFavorite, onMoz, onUseName, mozBusy }) {
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={() => onCopy(item)} className={softButton}><Copy size={13} weight="bold" />Copy</button>
    <button type="button" onClick={() => onFavorite(item)} aria-pressed={Boolean(item.is_favorite)} className={`${softButton} ${item.is_favorite ? '!bg-[var(--lime)] !text-[#26320b] !ring-[var(--lime-dark)]/40' : ''}`}><Star size={13} weight={item.is_favorite ? 'fill' : 'bold'} />{item.is_favorite ? 'Favorited' : 'Favorite'}</button>
    {onMoz && <button type="button" onClick={() => onMoz(item)} disabled={mozBusy} className={softButton}><ChartBar size={13} weight="bold" />{mozBusy ? 'Loading Moz…' : item.moz ? 'Refresh Moz' : 'Check Moz'}</button>}
    {onUseName && <button type="button" onClick={() => onUseName(item.domain)} className={softButton}><MagnifyingGlass size={13} weight="bold" />Check this name</button>}
    <a href={goDaddySearchUrl(item.domain)} target="_blank" rel="noopener noreferrer" className="upwork-apply-button inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-bold"><span className="relative z-10 inline-flex items-center gap-1.5">Register <ArrowSquareOut size={13} weight="bold" /></span></a>
  </div>
}

export function MozBadges({ moz }) {
  if (!moz) return null
  if (moz.error && !Number.isFinite(moz.domain_authority)) return <p className="mt-3 flex items-start gap-2 text-[11px] font-semibold text-[var(--warn)]"><Info size={14} className="mt-px shrink-0" />{moz.error}</p>
  const metrics = [['Domain authority', moz.domain_authority], ['Page authority', moz.page_authority], ['Spam score', moz.spam_score, '%'], ['Linking domains', moz.linking_root_domains]]
  return <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
    {metrics.map(([label, value, suffix = '']) => <div key={label} className="domain-ticker rounded-2xl bg-[var(--paper)] px-3 py-2.5 ring-1 ring-[var(--line)]/70"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">{label}</p><p className="mt-1 text-lg font-bold tabular-nums tracking-[-.04em]">{Number.isFinite(value) ? `${value}${suffix}` : '—'}</p></div>)}
  </div>
}

function PriceStrip({ availability }) {
  const plan = oneYearPricePlan(availability?.prices)
  if (!plan) {
    return <p className="mt-5 rounded-2xl bg-[var(--paper)] px-4 py-3 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]/70">
      {availability?.source === 'rdap' ? 'Free in the public registry. Live registrar pricing was not available for this check.' : 'Available now; one-year pricing was not returned by the registrar.'}
    </p>
  }
  return <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-[var(--price-bg)] px-4 py-3 text-xs text-[var(--price-muted)] ring-1 ring-[var(--price-line)]">
    <span><strong className="text-base font-bold tracking-[-.03em] text-[var(--price-text)]">{formatPrice(plan.price)}</strong> first year</span>
    <span><strong className="text-sm font-bold text-[var(--price-text)]">{formatPrice(plan.renewalPrice)}</strong> renewal</span>
    <span className="ml-auto text-[10px] font-bold uppercase tracking-[.14em]">{availability.inventory || 'Registry'}</span>
  </div>
}

function categorySummary(checks) {
  return CHECK_CATEGORIES.map((category) => {
    const items = checks.filter((check) => check.category === category)
    const counts = { pass: 0, caution: 0, fail: 0, manual: 0 }
    items.forEach((item) => { counts[item.status] = (counts[item.status] || 0) + 1 })
    return { category, items, counts }
  }).filter((group) => group.items.length)
}

function Checklist({ checks }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [category, setCategory] = useState(null)
  const groups = useMemo(() => categorySummary(checks), [checks])
  const totals = useMemo(() => checks.reduce((acc, check) => ({ ...acc, [check.status]: (acc[check.status] || 0) + 1 }), {}), [checks])
  const visible = checks.filter((check) => (filter === 'all' || check.status === filter) && (!category || check.category === category))

  return <div className="mt-5">
    <div className="grid gap-x-5 gap-y-2.5 sm:grid-cols-3">
      {groups.map(({ category: name, items, counts }) => {
        const Icon = CATEGORY_ICONS[name] || Sparkle
        return <button key={name} type="button" onClick={() => { setCategory(category === name ? null : name); setOpen(true) }} className={`group rounded-xl px-2 py-1.5 text-left transition-colors ${category === name ? 'bg-[var(--lime)]/25' : 'hover:bg-[var(--paper)]'}`} aria-pressed={category === name}>
          <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]"><span className="flex min-w-0 items-center gap-1.5"><Icon size={12} weight="bold" className="shrink-0" /><span className="truncate">{name}</span></span><span className="tabular-nums">{counts.pass}/{items.length}</span></span>
          <span className="mt-1.5 flex h-1.5 gap-px overflow-hidden rounded-full">
            {['pass', 'caution', 'fail', 'manual'].map((status) => counts[status] ? <span key={status} className={STATUS_META[status].bar} style={{ flexGrow: counts[status] }} /> : null)}
          </span>
        </button>
      })}
    </div>
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent-strong)]">
      {open ? 'Hide' : 'Show'} all {checks.length} checks <CaretDown size={12} weight="bold" className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="domain-ticker mt-3 rounded-2xl bg-[var(--paper)] p-3 ring-1 ring-[var(--line)]/70">
      <div className="flex flex-wrap items-center gap-1.5">
        {['all', 'pass', 'caution', 'fail', 'manual'].map((status) => {
          const count = status === 'all' ? checks.length : totals[status] || 0
          return <button key={status} type="button" disabled={!count} onClick={() => setFilter(status)} aria-pressed={filter === status} className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all disabled:opacity-35 ${filter === status ? 'bg-[var(--ink)] text-white' : status === 'all' ? 'bg-[var(--surface)] text-[var(--muted)]' : STATUS_META[status].chip}`}>{status === 'all' ? 'All' : STATUS_META[status].label} {count}</button>
        })}
        {category && <button type="button" onClick={() => setCategory(null)} className="ml-auto rounded-full bg-[var(--lime)]/40 px-2.5 py-1 text-[10px] font-bold">{category} ×</button>}
      </div>
      <ul className="mt-3 divide-y divide-[var(--line)]/70">
        {visible.map((check) => <li key={check.id} className="grid grid-cols-[4.2rem_minmax(0,1fr)] gap-3 py-2.5">
          <span className={`h-fit rounded-full px-2 py-0.5 text-center text-[9px] font-bold uppercase tracking-[.08em] ${STATUS_META[check.status]?.chip || STATUS_META.manual.chip}`}>{STATUS_META[check.status]?.label || 'Review'}</span>
          <span className="min-w-0"><span className="block text-xs font-semibold">{check.check} <span className="font-medium text-[var(--muted)]">· {check.priority}</span></span><span className="mt-0.5 block text-[11px] leading-5 text-[var(--muted)]">{check.note}</span></span>
        </li>)}
        {!visible.length && <li className="py-4 text-center text-[11px] text-[var(--muted)]">No checks match this filter.</li>}
      </ul>
    </div>}
  </div>
}

function ScreeningScanner({ index }) {
  const [step, setStep] = useState(index % CHECK_CATEGORIES.length)
  useEffect(() => {
    const timer = setInterval(() => setStep((value) => (value + 1) % CHECK_CATEGORIES.length), 1700)
    return () => clearInterval(timer)
  }, [])
  const category = CHECK_CATEGORIES[step]
  const Icon = CATEGORY_ICONS[category] || Sparkle
  return <div className="mt-5" role="status" aria-live="off">
    <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-[var(--muted)]">
      <span key={category} className="domain-ticker inline-flex items-center gap-1.5"><Icon size={13} weight="bold" className="text-[var(--accent-strong)]" />Researching {category.toLowerCase()} signals…</span>
      <span className="hidden sm:inline">43 checks · live web research</span>
    </div>
    <div className="domain-scan mt-2 h-1.5 rounded-full bg-[var(--paper)] ring-1 ring-[var(--line)]/60" />
  </div>
}

// Premium names are dressed as a wrapped gift: gold paper pattern, a satin band along the top and a bow on it.
function GiftWrap() {
  const id = `gift${useId().replace(/[^\w-]/g, '')}`
  const gold = `${id}-gold`, tail = `${id}-tail`
  return <>
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.75rem]">
      <span className="gift-paper absolute inset-0" />
      <span className="gift-ribbon absolute inset-x-0 top-0 h-2" />
    </span>
    <svg aria-hidden="true" viewBox="0 0 64 40" className="gift-bow pointer-events-none absolute -top-[23px] left-1/2 h-12 w-[4.75rem] -translate-x-1/2 drop-shadow-[0_3px_4px_rgba(120,84,10,.28)]">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6dc82" /><stop offset=".55" stopColor="#dcae45" /><stop offset="1" stopColor="#b4841f" /></linearGradient>
        <linearGradient id={tail} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d4a43c" /><stop offset="1" stopColor="#a8791c" /></linearGradient>
      </defs>
      <path d="M29 21 19 37l5-1.6 3 3.6L32 23Z" fill={`url(#${tail})`} />
      <path d="M35 21 45 37l-5-1.6-3 3.6L32 23Z" fill={`url(#${tail})`} />
      <path d="M32 20C23 5 5 4 7.5 15.5 9.6 25 23 24 32 20Z" fill={`url(#${gold})`} />
      <path d="M32 20C41 5 59 4 56.5 15.5 54.4 25 41 24 32 20Z" fill={`url(#${gold})`} />
      <path d="M30 18.5C23 10 13 9 12.5 15M34 18.5C41 10 51 9 51.5 15" fill="none" stroke="#9c7016" strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14 11.5C16 9.6 19.5 9.4 22 10.6M50 11.5C48 9.6 44.5 9.4 42 10.6" fill="none" stroke="#fff6cf" strokeOpacity=".8" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="27" y="14.5" width="10" height="11" rx="3.2" fill={`url(#${gold})`} stroke="#a8791c" strokeOpacity=".5" />
    </svg>
  </>
}

export function SuggestionCard({ item, rank, onCopy, onFavorite, onMoz, onUseName, mozBusy }) {
  const premium = isPremiumDomain(item.availability)
  const ref = useRef(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const tween = gsap.fromTo(ref.current, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .6, ease: 'power3.out', delay: (rank % 5) * .07 })
    return () => tween.kill()
  }, [rank])
  const complete = item.stage === 'complete' && Array.isArray(item.checks)

  return <article ref={ref} className={`group relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-[1.75rem] bg-[var(--surface)] p-4 ring-1 transition-shadow duration-500 hover:shadow-[0_24px_60px_var(--new-shadow)] sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:p-6 ${premium ? 'gift-card mt-6 ring-[#d9b44a]/70' : 'ring-[var(--line)]'}`}>
    {premium && <GiftWrap />}
    <span className="relative pt-1 font-mono text-sm text-[var(--muted)] sm:text-base">#{rank + 1}</span>
    <div className="relative min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ok-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ok)]"><Check size={11} weight="bold" />Available</span>
            {premium && <span className="inline-flex items-center gap-1 rounded-full bg-[#f6e8b8] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[#655419]"><Crown size={11} weight="fill" />Premium</span>}
            {item.stage === 'screening' && <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lavender)]/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--ink)]"><span className="domain-pulse-dot size-1.5 rounded-full bg-current" />Screening</span>}
            {item.stage === 'unscreened' && <span className="rounded-full bg-[var(--ink)]/[.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Quick check only</span>}
            {complete && item.web_source_count > 0 && <span className="rounded-full bg-[var(--ink)]/[.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">{item.web_source_count} web sources</span>}
          </div>
          <h3 className="mt-3"><DomainName domain={item.domain} className="text-[clamp(1.6rem,3vw,2.3rem)] leading-none" /></h3>
          {item.rationale && <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">{item.rationale}</p>}
          {item.best_for && <p className="mt-2 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--accent-strong)]">Best for · <span className="normal-case tracking-normal">{item.best_for}</span></p>}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
          <ScoreRing score={item.brand_score} />
          <span className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">{complete ? 'Brand score' : 'Early score'}</span>
        </div>
      </div>
      <PriceStrip availability={item.availability} />
      {item.stage === 'screening' && <ScreeningScanner index={rank} />}
      {complete && <Checklist checks={item.checks} />}
      <MozBadges moz={item.moz} />
      <div className="mt-5 border-t border-[var(--line)]/70 pt-4">
        <DomainActions item={item} onCopy={onCopy} onFavorite={onFavorite} onMoz={onMoz} onUseName={onUseName} mozBusy={mozBusy} />
      </div>
    </div>
  </article>
}

function RegistrarCard({ provider }) {
  const plan = oneYearPricePlan(provider?.prices)
  const configured = provider?.configured !== false
  const status = !configured ? ['Connect API', 'bg-[var(--ink)]/[.06] text-[var(--muted)]'] : provider?.available === true ? ['Available', STATUS_META.pass.chip] : provider?.available === false ? ['Unavailable', STATUS_META.fail.chip] : ['Incomplete', STATUS_META.caution.chip]
  return <article className="rounded-[1.5rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--line)]">
    <div className="flex items-start justify-between gap-3">
      <div><h4 className="text-sm font-bold">{provider?.provider}</h4><p className="mt-1 text-[11px] leading-4 text-[var(--muted)]">{provider?.price_type === 'standard_tld_price' ? 'Standard account/TLD price; premium pricing excluded.' : provider?.source === 'rdap' ? 'Public registry lookup (GoDaddy unavailable).' : 'Live domain quote from the registrar.'}</p></div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] ${status[1]}`}>{status[0]}</span>
    </div>
    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
      {[['Register', plan?.price], ['Renew', plan?.renewalPrice], ['Transfer', plan?.transferPrice]].map(([label, value]) => <div key={label} className="rounded-xl bg-[var(--paper)] px-2 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p><p className="mt-1 text-sm font-bold tabular-nums">{formatPrice(value)}</p></div>)}
    </div>
    {provider?.error && <p className="mt-3 text-[11px] font-semibold leading-4 text-[var(--warn)]">{provider.error}</p>}
  </article>
}

export function DirectResult({ direct, onCopy, onFavorite, onMoz, mozBusy }) {
  const titleRef = useRef(null)
  const { domain, availability, namesilo, status, error } = direct
  useEffect(() => {
    if (status !== 'done' || !titleRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const letters = titleRef.current.querySelectorAll('[data-letter]')
    const tween = gsap.fromTo(letters, { yPercent: 70, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .5, stagger: .025, ease: 'power3.out' })
    return () => tween.kill()
  }, [status, domain])

  if (status === 'loading') {
    return <section className="mt-8 rounded-[2rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--line)] sm:p-9" aria-busy="true">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Checking registry</p>
      <h2 className="mt-3"><DomainName domain={domain} className="text-[clamp(2rem,5vw,3.6rem)] leading-none" /></h2>
      <div className="domain-scan mt-6 h-2 max-w-md rounded-full bg-[var(--paper)] ring-1 ring-[var(--line)]/60" />
      <p className="mt-3 text-xs text-[var(--muted)]">Asking GoDaddy and NameSilo for live availability and price…</p>
    </section>
  }
  if (status === 'error') {
    return <section className="mt-8 rounded-[2rem] bg-[var(--bad-bg)] p-6 text-[var(--bad)] ring-1 ring-[var(--bad)]/20 sm:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[.2em]">Could not check {domain}</p>
      <p className="mt-2 text-sm font-semibold">{error}</p>
    </section>
  }

  const available = availability?.available === true
  const prices = Array.isArray(availability?.prices) ? availability.prices : []
  const item = { domain, availability, is_favorite: direct.is_favorite, moz: direct.moz, crm_result_id: direct.crm_result_id }
  const godaddy = { provider: availability?.source === 'rdap' ? 'Public registry' : 'GoDaddy', configured: true, available: availability?.available ?? null, prices, price_type: 'live_domain_quote', source: availability?.source, error: availability?.fallbackReason ? `GoDaddy: ${availability.fallbackReason}` : availability?.error }

  return <section className="mt-8 overflow-hidden rounded-[2rem] bg-[var(--surface)] ring-1 ring-[var(--line)]">
    <div className={`relative p-6 sm:p-9 ${available ? 'bg-[var(--lime)]/20' : 'bg-[var(--bad-bg)]/60'}`}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Exact match</p>
          <h2 ref={titleRef} className="mt-3 overflow-hidden text-[clamp(2.2rem,6vw,4.6rem)] font-semibold leading-[1.02] tracking-[-.06em]" aria-label={domain}>
            {[...domain].map((char, index) => <span key={`${char}-${index}`} data-letter aria-hidden="true" className={`inline-block ${index >= domainLabel(domain).length ? 'text-[var(--muted)]' : ''}`}>{char}</span>)}
          </h2>
          <p className="mt-3 text-sm font-semibold">{available ? 'Available for registration' : availability?.available === false ? 'Already registered' : 'Availability could not be confirmed'} <span className="ml-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)] ring-1 ring-[var(--line)]">{availability?.inventory || 'Unknown'}</span></p>
        </div>
        <span className={`domain-stamp w-fit shrink-0 rounded-2xl border-[3px] px-5 py-2 text-xl font-black uppercase tracking-[.12em] ${available ? 'border-[var(--lime-dark)] text-[var(--accent-strong)]' : 'border-[var(--bad)] text-[var(--bad)]'}`}>{available ? 'Free' : availability?.available === false ? 'Taken' : 'Unknown'}</span>
      </div>
      <div className="mt-6"><DomainActions item={item} onCopy={onCopy} onFavorite={onFavorite} onMoz={onMoz} mozBusy={mozBusy} /></div>
      <MozBadges moz={direct.moz} />
    </div>
    <div className="grid gap-6 p-6 sm:p-9 lg:grid-cols-2">
      <div>
        <h3 className="text-lg font-semibold tracking-[-.03em]">Registrar comparison</h3>
        <div className="mt-4 grid gap-3">
          <RegistrarCard provider={godaddy} />
          {namesilo && <RegistrarCard provider={namesilo} />}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold tracking-[-.03em]">Registration terms</h3>
        {prices.length ? <div className="mt-4 overflow-x-auto rounded-[1.5rem] ring-1 ring-[var(--line)]">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <thead className="bg-[var(--paper)] text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]"><tr><th className="px-4 py-3">Term</th><th className="px-4 py-3">Register</th><th className="px-4 py-3">Renew</th></tr></thead>
            <tbody className="divide-y divide-[var(--line)]/70">
              {prices.map((plan) => <tr key={`${plan.period}-${plan.term}`}><td className="px-4 py-3 font-semibold">{plan.period} {Number(plan.period) === 1 ? 'year' : 'years'}</td><td className="px-4 py-3 font-bold tabular-nums">{formatPrice(plan.price)}</td><td className="px-4 py-3 tabular-nums text-[var(--muted)]">{formatPrice(plan.renewalPrice)}</td></tr>)}
            </tbody>
          </table>
        </div> : <p className="mt-4 rounded-[1.5rem] bg-[var(--paper)] p-4 text-xs leading-5 text-[var(--muted)] ring-1 ring-[var(--line)]/70">{available ? 'No term pricing was returned for this check.' : 'Registered domains have no registration pricing. Scroll down for available alternatives.'}</p>}
      </div>
    </div>
  </section>
}
