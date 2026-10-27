import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowSquareOut, ArrowsClockwise, Check, Copy, Fire, FilmSlate, Hash, Lightning, MagnifyingGlass, ShieldCheck, Sparkle, Star, Timer, VideoCamera, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LogoLoader from '../components/LogoLoader'
import HScroll from '../components/HScroll'
import { primaryButton, stickyBand } from '../components/ui'
import { api } from '../services/api'
import { asArray } from '../lib/safe'

gsap.registerPlugin(ScrollTrigger)

const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'match', label: 'Best match' },
  { id: 'rating', label: 'Top rated' },
]
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function useCopy() {
  const [copied, setCopied] = useState('')
  const copy = async (key, text) => {
    await navigator.clipboard?.writeText(text)
    setCopied(key)
    window.setTimeout(() => setCopied((current) => current === key ? '' : current), 1600)
  }
  return [copied, copy]
}

export default function Video() {
  const { data: briefsData, isLoading, isError, error, refetch, isFetching } = useQuery({ queryKey: ['video-feeds'], queryFn: () => api.getVideoFeeds(), staleTime: 120_000 })
  const briefs = useMemo(() => asArray(briefsData), [briefsData])
  const [category, setCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('newest')
  const [active, setActive] = useState(0)
  const root = useRef(null)

  const categories = useMemo(() => ['All', ...new Set(briefs.map((brief) => brief.category))], [briefs])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = briefs.filter((brief) =>
      (category === 'All' || brief.category === category) &&
      (!query || `${brief.title} ${brief.category} ${brief.whyChosen} ${brief.targetSearchTerm} ${asArray(brief.hashtags).join(' ')}`.toLowerCase().includes(query)))
    if (sort === 'match') return [...list].sort((a, b) => b.match - a.match)
    if (sort === 'rating') return [...list].sort((a, b) => b.rating - a.rating)
    return [...list].sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt))
  }, [briefs, category, search, sort])
  const stats = useMemo(() => ({
    total: briefs.length,
    urgent: briefs.filter((brief) => brief.hurryUp).length,
    p1: briefs.filter((brief) => brief.priority === 'P1').length,
    match: briefs.length ? Math.round(briefs.reduce((sum, brief) => sum + brief.match, 0) / briefs.length) : 0,
  }), [briefs])
  const hashtags = useMemo(() => [...new Set(briefs.flatMap((brief) => asArray(brief.hashtags)))].slice(0, 28), [briefs])

  // Hero entrance and counters.
  useEffect(() => {
    if (isLoading || !root.current) return undefined
    const ctx = gsap.context(() => {
      if (reduceMotion()) return
      gsap.fromTo('[data-hero-fade]', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .8, stagger: .08, delay: .35, ease: 'power3.out' })
      gsap.utils.toArray('[data-count]').forEach((node) => {
        const target = Number(node.dataset.count) || 0
        const counter = { value: 0 }
        gsap.to(counter, { value: target, duration: 1.4, delay: .4, ease: 'power3.out', onUpdate: () => { node.textContent = Math.round(counter.value) } })
      })
    }, root)
    return () => ctx.revert()
  }, [isLoading])

  // Scroll-driven card choreography, rebuilt whenever the visible list changes.
  useEffect(() => {
    if (isLoading || !root.current) return undefined
    const ctx = gsap.context(() => {
      gsap.to('[data-scroll-progress]', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } })
      gsap.utils.toArray('[data-brief]').forEach((card, index) => {
        ScrollTrigger.create({ trigger: card, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => self.isActive && setActive(index) })
        if (reduceMotion()) return
        gsap.fromTo(card, { y: 90, scale: .93, rotateX: 9, autoAlpha: .2 }, { y: 0, scale: 1, rotateX: 0, autoAlpha: 1, ease: 'power2.out', scrollTrigger: { trigger: card, start: 'top 96%', end: 'top 50%', scrub: .7 } })
        const ring = card.querySelector('[data-ring]')
        if (ring) gsap.fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: 100 - Number(ring.dataset.ring), duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: card, start: 'top 75%', toggleActions: 'play none none reverse' } })
        const beats = card.querySelector('[data-beats]')
        const line = card.querySelector('[data-beat-line]')
        if (beats && line) gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: beats, start: 'top 72%', end: 'bottom 62%', scrub: .4 } })
        card.querySelectorAll('[data-beat]').forEach((beat) => {
          gsap.fromTo(beat, { x: 28, autoAlpha: .12 }, { x: 0, autoAlpha: 1, ease: 'power2.out', scrollTrigger: { trigger: beat, start: 'top 88%', end: 'top 64%', scrub: .5 } })
        })
      })
    }, root)
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [isLoading, filtered])

  const jumpTo = (index) => document.getElementById(`brief-${filtered[index]?.id}`)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })

  return (
    <Shell>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[3px]"><div data-scroll-progress className="h-full origin-left scale-x-0 bg-[var(--lime-dark)]" /></div>
      <main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-6 sm:px-6 md:pt-8">
        <header className="relative">
          <h1 className="mb-5 text-2xl font-semibold tracking-[-.04em]">Video</h1>
          <dl data-hero-fade className="grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-[1.6rem] bg-[var(--line)]/70 ring-1 ring-[var(--line)]/70 sm:grid-cols-4">
            {[['Briefs', stats.total, FilmSlate], ['Priority 1', stats.p1, Lightning], ['Hurry up', stats.urgent, Fire], ['Avg match %', stats.match, Sparkle]].map(([label, value, Icon]) => <div key={label} className="bg-[var(--surface)] px-5 py-4">
              <dt className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]"><Icon size={13} weight="duotone" />{label}</dt>
              <dd data-count={value} className="mt-2 text-3xl font-semibold tabular-nums tracking-[-.05em]">{value}</dd>
            </div>)}
          </dl>
        </header>

        {hashtags.length > 0 && <div data-hero-fade className="marquee-mask relative -mx-4 mt-12 overflow-hidden sm:-mx-6" aria-hidden="true">
          <div className="marquee-track flex w-max py-1">{[...hashtags, ...hashtags].map((tag, index) => <span key={`${tag}-${index}`} className="mr-2 shrink-0 rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]/70">{tag}</span>)}</div>
        </div>}

        <div className={`${stickyBand} mt-10`}>
          <div className="flex flex-col gap-3 rounded-[1.6rem] bg-[var(--surface)] p-2 ring-1 ring-[var(--line)]/70 shadow-[0_18px_50px_rgba(30,32,25,.08)] lg:flex-row lg:items-center">
            <HScroll className="flex-1" innerClassName="gap-1" label="categories">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-bold transition-all duration-300 ${category === item ? 'bg-[var(--lime)] !text-[#26320b] shadow-sm' : 'text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'}`}>{item}</button>)}</HScroll>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full bg-[var(--paper)] p-1">{SORTS.map((item) => <button type="button" key={item.id} onClick={() => setSort(item.id)} aria-pressed={sort === item.id} className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${sort === item.id ? 'bg-[var(--raised)] text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{item.label}</button>)}</div>
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-3.5 py-2 lg:w-56 lg:flex-none">
                <MagnifyingGlass size={14} className="shrink-0 text-[var(--muted)]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search briefs" className="min-w-0 flex-1 bg-transparent text-xs outline-none" />
                {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="grid size-5 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10"><X size={11} weight="bold" /></button>}
              </label>
              <button type="button" onClick={() => refetch()} aria-label="Refresh briefs" className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]"><ArrowsClockwise size={15} className={isFetching ? 'animate-spin' : ''} /></button>
            </div>
          </div>
        </div>

        {isLoading ? <LogoLoader className="min-h-[40dvh]" label="Loading video briefs" />
          : isError ? <section className="py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--bad-bg)] text-[var(--bad)]"><VideoCamera size={22} /></span><h3 className="mt-5 text-xl font-semibold">Could not load video briefs</h3><p className="mt-2 text-sm text-[var(--muted)]">{error?.message}</p><button type="button" onClick={() => refetch()} className={`${primaryButton} mt-6`}>Try again</button></section>
            : filtered.length ? <div className="mt-12 grid gap-10 xl:grid-cols-[13rem_minmax(0,1fr)]">
              <nav aria-label="Brief index" className="hidden xl:block"><div className="sticky top-[calc(var(--shell-h)+5.5rem)] space-y-1">
                <p className="mb-3 text-[9px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">{filtered.length} briefs</p>
                {filtered.map((brief, index) => <button type="button" key={brief.id} onClick={() => jumpTo(index)} className={`group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-all duration-300 ${active === index ? 'bg-[var(--surface)] shadow-sm ring-1 ring-[var(--line)]' : 'opacity-55 hover:opacity-100'}`}>
                  <span className={`mt-0.5 font-mono text-[10px] font-bold ${active === index ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="line-clamp-2 text-[11px] font-semibold leading-4">{brief.title}</span>
                </button>)}
              </div></nav>
              <div className="space-y-8 [perspective:1400px]">{filtered.map((brief, index) => <BriefCard key={brief.id} brief={brief} index={index} />)}</div>
            </div>
              : <div className="py-24 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--line)]"><VideoCamera size={22} /></span><h3 className="mt-5 text-xl font-semibold">No briefs found</h3><p className="mt-2 text-sm text-[var(--muted)]">Try another category or search phrase.</p></div>}
      </main>
    </Shell>
  )
}

function MatchRing({ value }) {
  return <div className="relative grid size-[4.5rem] shrink-0 place-items-center">
    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" className="stroke-black/[.07] dark:stroke-white/10" /><circle data-ring={value} cx="18" cy="18" r="15.9155" pathLength="100" fill="none" strokeWidth="3" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - value} className="stroke-[var(--lime-dark)]" /></svg>
    <span className="text-center leading-none"><span className="block text-lg font-semibold tracking-[-.04em]">{value}</span><span className="text-[8px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">match</span></span>
  </div>
}

function Fact({ icon: Icon, label, value }) {
  if (!value) return null
  return <div className="rounded-2xl bg-[var(--paper)] px-4 py-3"><p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.15em] text-[var(--muted)]"><Icon size={12} weight="bold" />{label}</p><p className="mt-1.5 text-sm font-semibold leading-5">{value}</p></div>
}

function BriefCard({ brief, index }) {
  const [copied, copy] = useCopy()
  const [showCheck, setShowCheck] = useState(false)
  const outline = asArray(brief.outline)
  const hashtags = asArray(brief.hashtags)
  const outlineText = outline.map((beat) => [beat.time, beat.label && `${beat.label}:`, beat.text].filter(Boolean).join(' ')).join('\n')

  return <article id={`brief-${brief.id}`} data-brief className="scroll-mt-[calc(var(--shell-h)+5.5rem)] origin-top rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70 will-change-transform">
    <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-[var(--accent-strong)]">#{String(index + 1).padStart(2, '0')}</span>
        {brief.priority && <span className="rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-bold text-white">{brief.priority}</span>}
        <span className="rounded-full bg-[var(--paper)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{brief.category}</span>
        {brief.hurryUp && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bad-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--bad)]"><Fire size={12} weight="fill" />Hurry up</span>}
        {brief.firstParty && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ok-bg)] px-2.5 py-1 text-[10px] font-bold text-[var(--ok)]"><ShieldCheck size={12} weight="fill" />First party</span>}
        <span className="ml-auto text-[11px] font-semibold text-[var(--muted)]">{brief.posted}</span>
      </div>

      <div className="mt-6 flex items-start gap-5">
        <h2 className="max-w-4xl flex-1 text-[clamp(1.45rem,2.6vw,2.35rem)] font-semibold leading-[1.1] tracking-[-.04em] [text-wrap:balance]">{brief.title}</h2>
        <MatchRing value={brief.match} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Fact icon={FilmSlate} label="Format" value={brief.format} />
        <Fact icon={Timer} label="Effort" value={brief.effort} />
        <Fact icon={Star} label="Rating" value={brief.rating ? `${brief.rating} / 10` : ''} />
        <Fact icon={Lightning} label="Mid-roll" value={brief.midRoll ? 'Yes' : 'No'} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-5 lg:sticky lg:top-[calc(var(--shell-h)+5.5rem)] lg:self-start">
          {brief.whyChosen && <section><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Why this video</p><p className="mt-2.5 text-[15px] leading-7">{brief.whyChosen}</p></section>}
          {brief.targetSearchTerm && <section className="rounded-2xl bg-[var(--lime)]/20 p-4 ring-1 ring-[var(--lime-dark)]/20"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--accent-strong)]"><MagnifyingGlass size={12} weight="bold" />Target search</p><p className="mt-2 text-sm font-semibold leading-6">{brief.targetSearchTerm}</p></section>}
          {brief.duplicateCheck && <section className="rounded-2xl bg-[var(--paper)]">
            <button type="button" onClick={() => setShowCheck((open) => !open)} aria-expanded={showCheck} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-xs font-bold"><span className="flex items-center gap-2"><Check size={14} weight="bold" className="text-[var(--ok)]" />Duplicate check</span><span className={`text-base leading-none text-[var(--muted)] transition-transform duration-300 ${showCheck ? 'rotate-45' : ''}`}>+</span></button>
            <div className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${showCheck ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}><p className="overflow-hidden px-4 text-xs leading-5 text-[var(--muted)]"><span className="block pb-4">{brief.duplicateCheck}</span></p></div>
          </section>}
          {hashtags.length > 0 && <section>
            <div className="flex items-center justify-between"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]"><Hash size={12} weight="bold" />Hashtags</p><button type="button" onClick={() => copy('tags', hashtags.join(' '))} className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">{copied === 'tags' ? <Check size={12} weight="bold" /> : <Copy size={12} />}{copied === 'tags' ? 'Copied' : 'Copy'}</button></div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">{hashtags.map((tag) => <span key={tag} className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">{tag}</span>)}</div>
          </section>}
          <div className="flex flex-wrap gap-2 pt-1">
            {brief.sourceUrl && <a href={brief.sourceUrl} target="_blank" rel="noopener noreferrer" className="upwork-view-button inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold">Source<ArrowSquareOut size={13} /></a>}
            <button type="button" onClick={() => copy('outline', `${brief.title}\n\n${outlineText}`)} className="inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2.5 text-xs font-bold text-white transition-transform hover:-translate-y-0.5">{copied === 'outline' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'outline' ? 'Copied' : 'Copy run sheet'}</button>
          </div>
        </div>

        <section>
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">Run sheet</p>
          <ol data-beats className="relative mt-4 space-y-1">
            <span aria-hidden="true" className="absolute bottom-3 left-[1.6rem] top-3 w-px bg-[var(--line)]" />
            <span data-beat-line aria-hidden="true" className="absolute bottom-3 left-[1.6rem] top-3 w-px origin-top bg-[var(--lime-dark)]" />
            {outline.map((beat, beatIndex) => <li key={`${beat.time}-${beatIndex}`} data-beat className="relative grid grid-cols-[3.2rem_1fr] gap-3 rounded-2xl py-2.5 pr-2 transition-colors hover:bg-[var(--paper)]">
              <span className="relative z-10 mx-auto h-fit rounded-lg bg-[var(--surface)] px-1.5 py-1 text-center font-mono text-[10px] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--line)]">{beat.time || '•'}</span>
              <p className="text-sm leading-6">{beat.label && <strong className="font-semibold">{beat.label}. </strong>}<span className="text-[var(--muted)]">{beat.text}</span></p>
            </li>)}
          </ol>
        </section>
      </div>
    </div>
  </article>
}
