import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowSquareOut, ArrowsClockwise, Check, CheckCircle, Copy, Fire, Globe, Key, LinkSimple, MagnifyingGlass, Newspaper, Quotes, Target, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LogoLoader from '../components/LogoLoader'
import HScroll from '../components/HScroll'
import { Modal, primaryButton, stickyBand } from '../components/ui'
import { api } from '../services/api'

gsap.registerPlugin(ScrollTrigger)

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const SITE_TONES = ['#c8e875', '#cbc6ef', '#f6c9a8', '#b8e0d2', '#f2d27a', '#a9c8f0', '#f0b5c4']

function siteTone(site) {
  const hash = [...site].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return SITE_TONES[hash % SITE_TONES.length]
}

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function useDesktop() {
  const query = '(min-width: 1024px)'
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setDesktop(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return desktop
}

function SiteMark({ site, size = 'size-9' }) {
  return <span className={`${size} grid shrink-0 place-items-center rounded-xl text-xs font-bold uppercase text-[#26320b]`} style={{ background: siteTone(site) }}>{site.replace(/^www\./, '').slice(0, 2)}</span>
}

export default function SiteContent() {
  const { data: items = [], isLoading, isError, error, refetch, isFetching } = useQuery({ queryKey: ['site-content'], queryFn: () => api.getSiteContent(), staleTime: 120_000 })
  const [site, setSite] = useState('All')
  const [category, setCategory] = useState('All')
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [hideDone, setHideDone] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const desktop = useDesktop()
  const root = useRef(null)

  const sites = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => counts.set(item.site, (counts.get(item.site) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [items])
  const categories = useMemo(() => ['All', ...new Set(items.map((item) => item.category))], [items])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items
      .filter((item) => (site === 'All' || item.site === site) && (category === 'All' || item.category === category) && (!urgentOnly || item.importance === 'HURRYUP') && (!hideDone || !item.done))
      .filter((item) => !query || `${item.headline} ${item.site} ${item.summary} ${item.angle} ${item.keywords.primary} ${item.keywords.secondary.join(' ')}`.toLowerCase().includes(query))
      .sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt) || a.priority - b.priority)
  }, [items, site, category, urgentOnly, hideDone, search])
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0]
  const stats = useMemo(() => ({ ideas: items.length, sites: sites.length, urgent: items.filter((item) => item.importance === 'HURRYUP').length, done: items.filter((item) => item.done).length }), [items, sites])

  const select = (id) => { setSelectedId(id); if (!desktop) setMobileOpen(true) }

  // Keyboard: up/down (or j/k) moves through the list on desktop.
  useEffect(() => {
    if (!desktop) return undefined
    const onKey = (event) => {
      if (event.target.closest('input, textarea') || !filtered.length) return
      const step = event.key === 'ArrowDown' || event.key === 'j' ? 1 : event.key === 'ArrowUp' || event.key === 'k' ? -1 : 0
      if (!step) return
      event.preventDefault()
      const index = Math.max(0, filtered.findIndex((item) => item.id === selected?.id))
      const next = filtered[Math.min(filtered.length - 1, Math.max(0, index + step))]
      setSelectedId(next.id)
      document.getElementById(`idea-${next.id}`)?.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [desktop, filtered, selected?.id])

  useEffect(() => {
    if (isLoading || !root.current) return undefined
    const ctx = gsap.context(() => {
      if (reduceMotion()) return
      gsap.fromTo('[data-hero-word]', { yPercent: 110 }, { yPercent: 0, duration: 1.05, stagger: .08, ease: 'expo.out' })
      gsap.fromTo('[data-hero-fade]', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .75, stagger: .07, delay: .3, ease: 'power3.out' })
      gsap.utils.toArray('[data-count]').forEach((node) => {
        const counter = { value: 0 }
        gsap.to(counter, { value: Number(node.dataset.count) || 0, duration: 1.3, delay: .35, ease: 'power3.out', onUpdate: () => { node.textContent = Math.round(counter.value) } })
      })
    }, root)
    return () => ctx.revert()
  }, [isLoading])

  useEffect(() => {
    if (isLoading || !root.current || reduceMotion()) return undefined
    const ctx = gsap.context(() => {
      gsap.set('[data-idea]', { y: 40, autoAlpha: 0 })
      ScrollTrigger.batch('[data-idea]', { start: 'top 94%', once: true, onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, duration: .7, stagger: .06, ease: 'power3.out', overwrite: true }) })
    }, root)
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [isLoading, filtered])

  return <Shell>
    <main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-9 sm:px-6 md:pt-12">
      <header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p data-hero-fade className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.17em] text-[var(--muted)]"><Newspaper size={15} weight="duotone" />Site content</p>
          <h1 className="mt-4 text-[clamp(2.7rem,6.2vw,5.8rem)] font-semibold leading-[.92] tracking-[-.07em]">
            <span className="block overflow-hidden pb-1"><span data-hero-word className="inline-block">Stories&nbsp;</span><span data-hero-word className="inline-block">your&nbsp;</span><span data-hero-word className="inline-block">sites</span></span>
            <span className="block overflow-hidden pb-2"><span data-hero-word className="inline-block font-serif font-medium italic">should publish.</span></span>
          </h1>
          <p data-hero-fade className="mt-5 max-w-xl text-sm leading-6 text-[var(--muted)]">Fresh, sourced content ideas for every site, with the angle, keywords and links to build each post.</p>
        </div>
        <dl data-hero-fade className="grid grid-cols-4 gap-px overflow-hidden rounded-[1.4rem] bg-[var(--line)]/70 ring-1 ring-[var(--line)]/70">
          {[['Ideas', stats.ideas], ['Sites', stats.sites], ['Hurry up', stats.urgent], ['Done', stats.done]].map(([label, value]) => <div key={label} className="bg-[var(--surface)] px-4 py-3.5 sm:px-5"><dt className="text-[9px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">{label}</dt><dd data-count={value} className="mt-1.5 text-2xl font-semibold tabular-nums tracking-[-.05em]">{value}</dd></div>)}
        </dl>
      </header>

      {sites.length > 0 && <HScroll data-hero-fade className="mt-10" innerClassName="gap-2 py-1" fade="var(--paper)" label="sites">
        <SiteTab active={site === 'All'} onClick={() => setSite('All')} label="All sites" count={items.length} />
        {sites.map(([name, count]) => <SiteTab key={name} active={site === name} onClick={() => setSite(name)} label={name} count={count} mark={<SiteMark site={name} size="size-7" />} />)}
      </HScroll>}

      <div className={`${stickyBand} mt-4`}>
        <div className="flex flex-col gap-2 rounded-[1.6rem] bg-[var(--surface)] p-2 ring-1 ring-[var(--line)]/70 shadow-[0_18px_50px_rgba(30,32,25,.08)] lg:flex-row lg:items-center">
          <HScroll className="flex-1" innerClassName="gap-1" label="categories">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold transition-all duration-300 ${category === item ? 'bg-[var(--lime)] !text-[#26320b] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`}>{item}</button>)}</HScroll>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle active={urgentOnly} onClick={() => setUrgentOnly((value) => !value)} icon={Fire}>Hurry up</Toggle>
            <Toggle active={hideDone} onClick={() => setHideDone((value) => !value)} icon={CheckCircle}>Hide done</Toggle>
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-3.5 py-2 lg:w-52 lg:flex-none">
              <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ideas" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
              {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10"><X size={11} weight="bold" /></button>}
            </label>
            <button type="button" onClick={() => refetch()} aria-label="Refresh ideas" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"><ArrowsClockwise size={15} className={isFetching ? 'animate-spin' : ''} /></button>
          </div>
        </div>
      </div>

      {isLoading ? <LogoLoader className="min-h-[40dvh]" label="Loading site content" />
        : isError ? <section className="py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--bad-bg)] text-[var(--bad)]"><Newspaper size={22} /></span><h3 className="mt-5 text-xl font-semibold">Could not load site content</h3><p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p><button type="button" onClick={() => refetch()} className={`${primaryButton} mt-6`}>Try again</button></section>
          : filtered.length ? <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1.05fr)]">
            <ol className="space-y-3">{filtered.map((item) => <li key={item.id} id={`idea-${item.id}`} data-idea className="scroll-mt-[calc(var(--shell-h)+6rem)]"><IdeaCard item={item} selected={desktop && selected?.id === item.id} onSelect={() => select(item.id)} /></li>)}</ol>
            {desktop && selected && <div className="sticky top-[calc(var(--shell-h)+5.5rem)] self-start"><IdeaDetail key={selected.id} item={selected} /></div>}
          </div>
            : <div className="py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--line)]"><Newspaper size={22} /></span><h3 className="mt-5 text-xl font-semibold">No ideas match</h3><p className="mt-2 text-sm text-[var(--muted)]">Try another site, category or search phrase.</p></div>}
      {!desktop && mobileOpen && selected && <Modal wide onClose={() => setMobileOpen(false)}><IdeaDetail item={selected} onClose={() => setMobileOpen(false)} bare /></Modal>}
    </main>
  </Shell>
}

function SiteTab({ active, onClick, label, count, mark }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex shrink-0 items-center gap-2.5 rounded-2xl py-2 pl-2 pr-4 text-left ring-1 transition-all duration-300 ${active ? 'bg-[var(--ink)] text-white ring-[var(--ink)]' : 'bg-[var(--surface)] ring-[var(--line)]/70 hover:-translate-y-0.5 hover:ring-[var(--lime-dark)]'}`}>
    {mark || <span className={`grid size-7 place-items-center rounded-xl ${active ? 'bg-white/15' : 'bg-[var(--paper)]'}`}><Globe size={14} weight="bold" /></span>}
    <span className="text-xs font-bold">{label}</span>
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${active ? 'bg-white/15' : 'bg-[var(--paper)] text-[var(--muted)]'}`}>{count}</span>
  </button>
}

function Toggle({ active, onClick, icon: Icon, children }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold transition-all ${active ? 'bg-[var(--ink)] text-white' : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'}`}><Icon size={13} weight={active ? 'fill' : 'bold'} />{children}</button>
}

function IdeaCard({ item, selected, onSelect }) {
  return <button type="button" onClick={onSelect} aria-pressed={selected} className={`group relative w-full overflow-hidden rounded-[1.5rem] p-1 text-left transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${selected ? 'bg-[var(--new-border)] shadow-[0_14px_42px_var(--new-shadow)]' : 'bg-[var(--frame)] ring-1 ring-[var(--line)]/60 hover:-translate-y-0.5'}`}>
    <span className="block rounded-[calc(1.5rem-.25rem)] bg-[var(--surface)] p-5">
      <span className="flex items-center gap-3">
        <SiteMark site={item.site} />
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{item.site}</span><span className="mt-0.5 block text-[10px] text-[var(--muted)]">{item.category} · {item.posted}</span></span>
        {item.importance === 'HURRYUP' && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bad-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--bad)]"><Fire size={11} weight="fill" />Hurry up</span>}
        {item.done && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ok-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--ok)]"><Check size={11} weight="bold" />Done</span>}
      </span>
      <span className="mt-4 block text-base font-semibold leading-[1.35] tracking-[-.02em] transition-colors group-hover:text-[var(--accent-strong)] sm:text-[1.0625rem]">{item.headline}</span>
      {item.summary && <span className="mt-2 line-clamp-2 block text-xs leading-5 text-[var(--muted)]">{item.summary}</span>}
      <span className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-bold text-white">P{item.priority}</span>
        {item.partyType && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)]">{item.partyType.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>}
        {item.keywords.primary && <span className="max-w-[16rem] truncate rounded-full bg-[var(--lime)]/30 px-2.5 py-1 text-[10px] font-semibold text-[var(--accent-strong)]">{item.keywords.primary}</span>}
      </span>
    </span>
    {selected && <span className="absolute right-4 top-1/2 hidden h-10 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)] lg:block" />}
  </button>
}

function IdeaDetail({ item, onClose, bare = false }) {
  const panel = useRef(null)
  const [copied, setCopied] = useState('')
  const copy = async (key, text) => {
    await navigator.clipboard?.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied((current) => current === key ? '' : current), 1600)
  }
  useEffect(() => {
    if (!panel.current || reduceMotion()) return undefined
    const ctx = gsap.context(() => gsap.fromTo('[data-detail-part]', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .55, stagger: .05, ease: 'power3.out' }), panel)
    return () => ctx.revert()
  }, [])
  const keywordText = [item.keywords.primary, ...item.keywords.secondary].filter(Boolean).join(', ')

  const body = <div ref={panel} className={bare ? '' : 'max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain p-6 sm:p-7'}>
    <div data-detail-part className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3"><SiteMark site={item.site} size="size-10" /><div><p className="text-sm font-bold">{item.site}</p><p className="text-[11px] text-[var(--muted)]">{item.category} · Item {item.itemNumber ?? '–'} · {item.posted}</p></div></div>
      {onClose && <button type="button" onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-[var(--paper)]"><X size={14} /></button>}
    </div>
    <h2 data-detail-part className="mt-6 text-[1.65rem] font-semibold leading-[1.15] tracking-[-.035em] [text-wrap:balance]">{item.headline}</h2>
    <div data-detail-part className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={() => copy('headline', item.headline)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-[11px] font-bold text-white">{copied === 'headline' ? <Check size={12} weight="bold" /> : <Copy size={12} />}{copied === 'headline' ? 'Copied' : 'Copy headline'}</button>
      {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="upwork-view-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold">Source<ArrowSquareOut size={12} /></a>}
      {item.publishedUrl && <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="upwork-apply-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold"><span className="relative z-10">View published</span><ArrowSquareOut size={12} className="relative z-10" /></a>}
    </div>

    {item.summary && <p data-detail-part className="mt-6 text-[15px] leading-7">{item.summary}</p>}
    {item.angle && <div data-detail-part className="mt-5 flex gap-3 rounded-2xl bg-[var(--lime)]/20 p-4 ring-1 ring-[var(--lime-dark)]/20"><Quotes size={18} weight="fill" className="mt-0.5 shrink-0 text-[var(--accent-strong)]" /><div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--accent-strong)]">Content angle</p><p className="mt-1.5 text-sm font-medium leading-6">{item.angle}</p></div></div>}

    {keywordText && <section data-detail-part className="mt-6">
      <div className="flex items-center justify-between"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]"><Key size={12} weight="bold" />Keywords</p><button type="button" onClick={() => copy('keywords', keywordText)} className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">{copied === 'keywords' ? <Check size={12} weight="bold" /> : <Copy size={12} />}{copied === 'keywords' ? 'Copied' : 'Copy'}</button></div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {item.keywords.primary && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1.5 text-[11px] font-semibold text-white"><Target size={11} weight="bold" />{item.keywords.primary}</span>}
        {item.keywords.secondary.map((keyword) => <span key={keyword} className="rounded-full bg-[var(--paper)] px-3 py-1.5 text-[11px] font-medium text-[var(--muted)]">{keyword}</span>)}
      </div>
    </section>}

    {item.brief.length > 0 && <section data-detail-part className="mt-6"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Brief</p>
      <dl className="mt-3 divide-y divide-[var(--line)]/70 rounded-2xl bg-[var(--paper)] px-4">{item.brief.map((section, index) => <div key={`${section.label}-${index}`} className="grid gap-1 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-3">
        <dt className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{section.label || 'Note'}</dt>
        <dd className="text-xs leading-5">{section.value}</dd>
      </div>)}</dl>
    </section>}

    {(item.references.length > 0 || item.source) && <section data-detail-part className="mt-6"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]"><LinkSimple size={12} weight="bold" />References</p>
      {item.source && <p className="mt-2 text-xs text-[var(--muted)]">{item.source}{item.sourceNote && ` · ${item.sourceNote}`}</p>}
      <ul className="mt-3 grid gap-1.5">{item.references.map((link, index) => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--paper)]">
        <span className="font-mono text-[10px] font-bold text-[var(--muted)]">{String(index + 1).padStart(2, '0')}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{hostname(link)}</span><span className="block truncate text-[10px] text-[var(--muted)]">{link}</span></span>
        <ArrowSquareOut size={13} className="shrink-0 text-[var(--muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </a></li>)}</ul>
    </section>}
  </div>

  if (bare) return body
  return <div className="rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70"><div className="overflow-hidden rounded-[calc(2rem-.375rem)] bg-[var(--surface)]">{body}</div></div>
}
