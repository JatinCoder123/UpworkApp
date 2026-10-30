import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowClockwise, ArrowLeft, Broadcast, Clock, Crosshair, Lightning, MagnifyingGlass, Plus, Sparkle, Timer, Users, WarningCircle, X } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import LiveJobCard, { freshnessTone } from '../components/LiveJobCard'
import JobDrawer from '../components/JobDrawer'
import { MoreFiltersMenu, SortMenu } from '../components/JobListControls'
import { api } from '../services/api'
import { LIVE_WINDOWS, isEarlyBird, loadLiveResult, loadLiveSettings, minutesSince, newSince, saveLiveResult, saveLiveSettings, scanSteps } from '../lib/liveJobs'
import { loadExtraFilters, saveExtraFilters } from '../lib/preferences'
import { matchesExtraFilters, useJobReactions, usePreviewParam } from '../lib/jobSignals'
import { timeAgo, useNow } from '../lib/time'
import { useSaveToCrm } from '../lib/crmSave'
import { useAuth } from '../contexts/AuthContext'
import ErrorBoundary, { CardError } from '../components/ErrorBoundary'
import NotFound from './NotFound'
import { asArray, asObject, asText } from '../lib/safe'

const AUTO_SCAN_MS = 5 * 60_000
// Brighter versions of the card freshness tones, readable on the dark radar.
const BLIP_COLORS = { 'var(--lime-dark)': 'var(--hero-accent)', 'var(--score-mid)': 'var(--hero-warn)', 'var(--orange)': 'var(--hero-hot)' }
const label = 'text-[9px] font-bold uppercase tracking-[.18em]'
// Live jobs come straight from Upwork, so they are sorted in the browser.
const LIVE_SORTS = [
  { id: 'newest', label: 'Newest first', compare: (a, b) => new Date(b.postedAt) - new Date(a.postedAt) },
  { id: 'oldest', label: 'Oldest first', compare: (a, b) => new Date(a.postedAt) - new Date(b.postedAt) },
  { id: 'applicants', label: 'Fewest applicants', compare: (a, b) => a.applicants - b.applicants },
  { id: 'spent', label: 'Client spend: high to low', compare: (a, b) => (Number(b.raw?.client?.totalSpent?.rawValue ?? b.raw?.client?.totalSpent) || 0) - (Number(a.raw?.client?.totalSpent?.rawValue ?? a.raw?.client?.totalSpent) || 0) },
]

// Stable pseudo-random angle per job so blips do not jump between renders.
function angleFor(id) {
  let hash = 0
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) % 3600
  return (hash / 10) * (Math.PI / 180)
}

function LiveScope({ jobs, windowMinutes, scanning, now, onOpen }) {
  const [hovered, setHovered] = useState(null)
  const focus = hovered && jobs.find((job) => job.id === hovered)
  return <div className="mx-auto w-full max-w-[19rem]">
    <div className="live-scope" data-scanning={scanning}>
      {scanning && <><span className="live-ping" /><span className="live-ping" /><span className="live-sweep" /></>}
      <span className="absolute left-1/2 top-1/2 z-[1] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--hero-accent)] shadow-[0_0_24px_var(--hero-accent)]" />
      {!scanning && jobs.map((job, index) => {
        const minutes = minutesSince(job.postedAt, now)
        const radius = 10 + Math.min(1, minutes / Math.max(windowMinutes, 1)) * 36
        const angle = angleFor(job.id)
        return <button key={job.id} type="button" onClick={() => onOpen(job.id)} onMouseEnter={() => setHovered(job.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(job.id)} onBlur={() => setHovered(null)} aria-label={`Open ${job.title}`} className="live-blip" style={{ left: `${50 + radius * Math.cos(angle)}%`, top: `${50 + radius * Math.sin(angle)}%`, '--blip': BLIP_COLORS[freshnessTone(minutes, windowMinutes)], '--delay': `${(index % 5) * .4}s`, animationDelay: `${index * 30}ms` }} />
      })}
    </div>
    <div className="mt-4 min-h-10 text-center" aria-live="polite">
      {focus ? <p className="live-ticker text-xs font-semibold text-white"><span className="line-clamp-1">{focus.title}</span><span className="text-[11px] font-medium text-white/55">{timeAgo(focus.postedAt, now)} · {focus.applicants} applicants</span></p>
        : <p className="text-[11px] font-medium text-white/50">{scanning ? 'Sweeping the marketplace…' : jobs.length ? 'Centre is newest · edge is oldest' : 'Blips appear here after a scan'}</p>}
    </div>
  </div>
}

function SkillPicker({ skillRecords, loading, selected, onToggle, onAdd, onClear, disabled }) {
  const [draft, setDraft] = useState('')
  const known = new Set(skillRecords.map((record) => asText(record.name).toLowerCase()))
  const custom = selected.filter((skill) => !known.has(asText(skill).toLowerCase()))
  const add = () => { const value = draft.trim(); if (value) onAdd(value); setDraft('') }
  const chip = (name, active) => `shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 disabled:opacity-50 ${active ? 'bg-[var(--hero-accent)] text-[var(--on-hero-accent)] shadow-[0_6px_20px_color-mix(in_srgb,var(--hero-accent)_28%,transparent)]' : 'bg-white/[.07] text-white/70 ring-1 ring-white/10 hover:bg-white/[.12] hover:text-white'}`

  return <div>
    <div className="flex items-center justify-between gap-3">
      <p className={`${label} text-white/55`}>Skills to scan{selected.length > 0 && <span className="ml-2 rounded-full bg-[var(--hero-accent)] px-1.5 py-0.5 text-[var(--on-hero-accent)]">{selected.length}</span>}</p>
      {selected.length > 0 && <button type="button" disabled={disabled} onClick={onClear} className="text-[11px] font-bold text-white/55 hover:text-white">Clear</button>}
    </div>
    <div className="mt-3 flex max-h-[7.5rem] flex-wrap gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
      {skillRecords.map(({ id, name }) => <button key={id} type="button" disabled={disabled} aria-pressed={selected.includes(name)} onClick={() => onToggle(name)} className={chip(name, selected.includes(name))}>{name}</button>)}
      {custom.map((name) => <button key={name} type="button" disabled={disabled} aria-pressed="true" onClick={() => onToggle(name)} className={`${chip(name, true)} inline-flex items-center gap-1`}>{name}<X size={10} weight="bold" /></button>)}
      {loading && <span className="h-7 w-48 animate-pulse rounded-full bg-white/10" />}
    </div>
    <form onSubmit={(event) => { event.preventDefault(); add() }} className="mt-3 flex items-center gap-2 rounded-full bg-white/[.06] py-1 pl-4 pr-1 ring-1 ring-white/10 focus-within:ring-[var(--hero-accent)]/60">
      <MagnifyingGlass size={14} className="shrink-0 text-white/50" />
      <input value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} placeholder="Add any skill, e.g. Laravel" aria-label="Add a skill" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40" />
      <button type="submit" disabled={!draft.trim() || disabled} aria-label="Add skill" className="grid size-7 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-40"><Plus size={13} weight="bold" /></button>
    </form>
  </div>
}

function Stat({ icon: Icon, title, value, note }) {
  return <div data-card className="min-w-0 rounded-[1.4rem] bg-[var(--surface)] p-4 ring-1 ring-[var(--line)]/70">
    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--muted)]"><Icon size={14} weight="bold" className="text-[var(--accent-strong)]" />{title}</p>
    <p className="mt-2 truncate text-2xl font-semibold tracking-[-.04em]">{value}</p>
    {note && <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{note}</p>}
  </div>
}

export default function LiveJobs() {
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const now = useNow(30_000)
  const reactions = useJobReactions(user?.email)
  const crm = useSaveToCrm()
  const [settings, setSettings] = useState(loadLiveSettings)
  const [result, setResult] = useState(loadLiveResult)
  const [justIn, setJustIn] = useState(() => asArray(location.state?.justIn))
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [autoScan, setAutoScan] = useState(false)
  const [sort, setSort] = useState('newest')
  const [extraFilters, setExtraFilters] = useState(() => loadExtraFilters('live'))
  const { previewId, openPreview, closePreview } = usePreviewParam()
  useEffect(() => saveExtraFilters('live', extraFilters), [extraFilters])
  const root = useRef(null)
  const resultsRef = useRef(null)
  const jobsRef = useRef(null)

  const { data: skillPages, isLoading: skillsLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ['skills'],
    queryFn: ({ pageParam }) => api.getSkills({ page: pageParam, perPage: 50 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
  })
  useEffect(() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }, [fetchNextPage, hasNextPage, isFetchingNextPage])
  const skillRecords = useMemo(
    () => asArray(skillPages?.pages).flatMap((page) => asArray(page?.records)).filter((record, index, records) => records.findIndex((item) => item.id === record.id) === index).sort((a, b) => asText(a.name).localeCompare(asText(b.name))),
    [skillPages],
  )

  const controller = useRef(null)
  const scan = useMutation({
    mutationFn: (params) => {
      controller.current = new AbortController()
      return api.getLiveJobs({ ...params, signal: controller.current.signal })
    },
    onSuccess: (data) => {
      setJustIn(newSince(result, data))
      setResult(data)
      saveLiveResult(data)
      window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 120)
    },
  })
  const scanning = scan.isPending
  const windowLabel = LIVE_WINDOWS.find((item) => item.minutes === settings.minutes)?.label || `${settings.minutes} min`
  const stepList = scanSteps(settings.skills, windowLabel)

  const update = (patch) => setSettings((current) => { const next = { ...current, ...patch }; saveLiveSettings(next); return next })
  const toggleSkill = (name) => update({ skills: settings.skills.includes(name) ? settings.skills.filter((item) => item !== name) : [...settings.skills, name] })
  const addSkill = (name) => { if (!settings.skills.some((item) => asText(item).toLowerCase() === name.toLowerCase())) update({ skills: [...settings.skills, name] }) }
  const start = () => { if (!settings.skills.length || scanning) return; setStep(0); setElapsed(0); scan.mutate(settings) }

  useEffect(() => {
    if (!scanning) return undefined
    const stepTimer = window.setInterval(() => setStep((current) => Math.min(current + 1, stepList.length - 1)), 1400)
    const clock = window.setInterval(() => setElapsed((current) => current + 1), 1000)
    return () => { window.clearInterval(stepTimer); window.clearInterval(clock) }
  }, [scanning, stepList.length])

  useEffect(() => () => controller.current?.abort(), [])
  // Arriving from the jobs feed search: land on the job list, not the scanner at the top.
  useEffect(() => {
    if (!location.state?.fromSearch) return
    jobsRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
    // Drop the flag so a refresh or going back does not jump again.
    navigate(location.pathname, { replace: true, state: { justIn: location.state.justIn } })
  }, [location.state, location.pathname, navigate])
  const startRef = useRef(start)
  useEffect(() => { startRef.current = start })
  useEffect(() => {
    if (!autoScan) return undefined
    const timer = window.setInterval(() => startRef.current(), AUTO_SCAN_MS)
    return () => window.clearInterval(timer)
  }, [autoScan])

  const jobs = useMemo(() => asArray(result?.jobs), [result])
  const scanErrors = asArray(result?.errors)
  // Live jobs only exist in this browser's last scan; a ?job= link to one that is not in it shows "Live job expired".
  const preview = previewId ? jobs.find((job) => job.id === previewId) || null : null
  const visibleJobs = useMemo(() => {
    const compare = (LIVE_SORTS.find((item) => item.id === sort) || LIVE_SORTS[0]).compare
    return jobs
      .filter((job) => matchesExtraFilters(job, extraFilters))
      .sort(compare)
  }, [jobs, sort, extraFilters])
  const earlyBirds = jobs.filter((job) => isEarlyBird(job, now)).length
  const avgApplicants = jobs.length ? Math.round(jobs.reduce((sum, job) => sum + job.applicants, 0) / jobs.length) : 0
  const resultWindow = result?.windowMinutes || settings.minutes

  useEffect(() => {
    if (!root.current) return undefined
    const ctx = gsap.context(() => gsap.fromTo('[data-card]', { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .35, stagger: .025, ease: 'power2.out', clearProps: 'transform' }), root)
    return () => ctx.revert()
  }, [result])

  // A ?job= link to a live job that is not in this browser's last scan: the page at that link, as /live-jobs/:id shows it.
  if (previewId && !preview) return <NotFound title="Live job expired." message="Live jobs are kept only for this browser session, so this link no longer opens it. Run a new live scan to find it again." backTo="/live-jobs" backLabel="Back to Live Jobs" />

  return <Shell><main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-4 sm:px-6 md:pt-6">
    {can('Jobs') && <Link to="/jobs" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><span className="grid size-8 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)]"><ArrowLeft size={14} /></span>Jobs feed</Link>}

    <section className="mt-5 rounded-[2rem] bg-[var(--frame)] p-1.5 ring-1 ring-[var(--line)]/70">
      <div className="live-hero rounded-[calc(2rem-.375rem)] p-5 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center xl:gap-12">
          <div className="min-w-0">
            <p className={`${label} flex items-center gap-2 text-[var(--hero-accent)]`}><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--hero-accent)] opacity-70" /><span className="relative size-2 rounded-full bg-[var(--hero-accent)]" /></span>Live from Upwork</p>
            <h1 className="mt-3 max-w-2xl text-[clamp(1.9rem,3.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-.045em] text-white">Catch jobs the minute <span className="text-[var(--hero-accent)]">they drop.</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Scan Upwork directly for fresh posts in your skills, before they reach the feed and before the crowd shows up.</p>

            <div className="mt-6 rounded-[1.4rem] bg-white/[.04] p-4 ring-1 ring-white/10 backdrop-blur-sm sm:p-5">
              <SkillPicker skillRecords={skillRecords} loading={skillsLoading || isFetchingNextPage} selected={settings.skills} disabled={scanning} onToggle={toggleSkill} onAdd={addSkill} onClear={() => update({ skills: [] })} />

              <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-white/10 pt-5">
                <div className="min-w-0">
                  <p className={`${label} text-white/55`}>Posted within</p>
                  <div className="mt-2 flex flex-wrap gap-1 rounded-full bg-white/[.06] p-1 ring-1 ring-white/10" role="radiogroup" aria-label="Posted within">
                    {LIVE_WINDOWS.map((item) => <button key={item.minutes} type="button" role="radio" aria-checked={settings.minutes === item.minutes} disabled={scanning} onClick={() => update({ minutes: item.minutes })} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all duration-300 ${settings.minutes === item.minutes ? 'bg-white text-[var(--hero-deep)]' : 'text-white/60 hover:text-white'}`}>{item.label}</button>)}
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2.5 pb-1.5 text-[11px] font-semibold text-white/70">
                  <input type="checkbox" checked={settings.includeRenewed} disabled={scanning} onChange={(event) => update({ includeRenewed: event.target.checked })} className="peer sr-only" />
                  <span className="relative h-5 w-9 rounded-full bg-white/15 transition-colors peer-checked:bg-[var(--hero-accent)] peer-focus-visible:ring-2 peer-focus-visible:ring-white/60 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                  Include renewed posts
                </label>
                <div className="ml-auto flex items-center gap-2">
                  {scanning
                    ? <button type="button" onClick={() => { controller.current?.abort(); scan.reset() }} className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-bold text-white ring-1 ring-white/15 hover:bg-white/15"><X size={14} weight="bold" />Stop</button>
                    : <button type="button" onClick={start} disabled={!settings.skills.length} className="upwork-apply-button inline-flex h-12 items-center gap-2.5 rounded-full px-6 text-sm font-bold disabled:pointer-events-none disabled:opacity-40"><Crosshair size={18} weight="bold" className="relative z-10" /><span className="relative z-10">{result ? 'Scan again' : 'Start live scan'}</span></button>}
                </div>
              </div>
            </div>

            <div className="mt-4 min-h-6" aria-live="polite">
              {scanning ? <p key={step} className="live-ticker flex items-center gap-2 text-xs font-semibold text-white/80"><span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-[var(--hero-accent)]" />{stepList[step]}<span className="font-mono text-white/40">{elapsed}s</span></p>
                : !settings.skills.length ? <p className="text-xs text-white/50">Pick at least one skill to start scanning.</p>
                  : <button type="button" onClick={() => setAutoScan((value) => !value)} aria-pressed={autoScan} className={`inline-flex items-center gap-2 text-xs font-semibold transition-colors ${autoScan ? 'text-[var(--hero-accent)]' : 'text-white/50 hover:text-white'}`}><Timer size={14} weight="bold" />{autoScan ? 'Auto-scan on · every 5 minutes' : 'Turn on auto-scan every 5 minutes'}</button>}
            </div>
          </div>
          <LiveScope jobs={jobs} windowMinutes={resultWindow} scanning={scanning} now={now} onOpen={openPreview} />
        </div>
      </div>
    </section>

    {scan.isError && scan.error?.code !== 'ABORTED' && <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" /><span className="flex-1">{scan.error?.message || 'The live scan failed.'}</span><button type="button" onClick={start} className="font-bold underline underline-offset-4">Try again</button></p>}
    {scanErrors.length > 0 && <p className="mt-5 flex items-start gap-2 rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-xs font-semibold text-[var(--warn)]"><WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />Some skills could not be scanned: {scanErrors.map((item) => (typeof item === 'string' ? item : item?.message || item?.skill || JSON.stringify(item))).join(' · ')}</p>}

    <div ref={resultsRef} className="scroll-mt-[calc(var(--shell-h)+1rem)]">
      {scanning ? <div className="mt-8 space-y-4" aria-hidden="true">{[0, 1, 2].map((item) => <div key={item} className="rounded-[1.6rem] bg-[var(--frame)] p-1"><div className="grid gap-4 rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] p-6 md:grid-cols-[1fr_14rem]"><div className="space-y-3"><span className="skeleton-bone block h-3 w-40 rounded-full" /><span className="skeleton-bone block h-5 w-3/4 rounded-full" /><span className="skeleton-bone block h-3 w-full rounded-full" /><span className="skeleton-bone block h-3 w-2/3 rounded-full" /></div><div className="space-y-3"><span className="skeleton-bone block h-3 w-24 rounded-full" /><span className="skeleton-bone block h-2 w-full rounded-full" /><span className="skeleton-bone block h-9 w-full rounded-xl" /></div></div></div>)}</div>
        : result ? <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat icon={Broadcast} title="Jobs found" value={jobs.length} note={`Posted in the last ${LIVE_WINDOWS.find((item) => item.minutes === resultWindow)?.label || `${resultWindow} min`}`} />
            <Stat icon={Clock} title="Freshest" value={jobs[0] ? timeAgo(jobs[0].postedAt, now) : '—'} note={jobs[0]?.title} />
            <Stat icon={Users} title="Avg applicants" value={jobs.length ? avgApplicants : '—'} note={jobs.length ? 'Across this scan' : ''} />
            <Stat icon={Lightning} title="Early birds" value={earlyBirds} note="Under 20 min, under 10 applicants" />
          </div>

          <div ref={jobsRef} className="mt-8 flex scroll-mt-[calc(var(--shell-h)+1rem)] flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-[-.02em]">{visibleJobs.length === jobs.length ? `${jobs.length} jobs` : `${visibleJobs.length} of ${jobs.length} jobs`}</h2>
            <SortMenu value={sort} options={LIVE_SORTS} onChange={setSort} label="Sort live jobs" />
            <MoreFiltersMenu value={extraFilters} onChange={setExtraFilters} />
            <div className="flex flex-wrap gap-1.5">{Object.entries(asObject(result.skillsSearched)).map(([skill, count]) => <span key={skill} className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">{skill} · {count}</span>)}</div>
            <span className="ml-auto flex items-center gap-3 text-[11px] font-semibold text-[var(--muted)]">Scanned {timeAgo(result.generatedAt, now).toLowerCase()}
              <button type="button" onClick={start} disabled={!settings.skills.length} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)] disabled:opacity-40"><ArrowClockwise size={12} weight="bold" />Rescan</button>
            </span>
          </div>

          {jobs.length && !visibleJobs.length ? <section className="mt-4 rounded-[1.6rem] bg-[var(--surface)] px-6 py-12 text-center ring-1 ring-[var(--line)]/70">
            <h3 className="text-lg font-semibold">No jobs match these filters</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{jobs.length} jobs were found in this scan, but none match the job type or client location filter.</p>
          </section>
            : jobs.length ? <section className="mt-4 space-y-4">{visibleJobs.map((job, index) => <ErrorBoundary key={job.id} name="live-job-card" fallback={CardError} resetKey={job}><LiveJobCard job={job} index={index} now={now} windowMinutes={resultWindow} justIn={justIn.includes(job.id)} applied={reactions.isApplied(job.id)} dismissed={reactions.isDismissed(job.id)} onOpen={() => openPreview(job.id)} onSaveToCrm={() => crm.save(job)} crmSaved={crm.isSaved(job.id)} crmSaving={crm.pendingId === job.id} crmError={crm.errorId === job.id ? crm.error?.message || 'Could not save this job to the CRM.' : ''} /></ErrorBoundary>)}</section>
            : <section className="mt-4 rounded-[1.6rem] bg-[var(--surface)] px-6 py-16 text-center ring-1 ring-[var(--line)]/70">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--lime-tint)]/30 text-[var(--accent-strong)]"><Crosshair size={24} weight="duotone" /></div>
              <h3 className="mt-5 text-xl font-semibold">Quiet out there</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">No new posts for {asArray(result.skills).join(', ')} in the last {LIVE_WINDOWS.find((item) => item.minutes === resultWindow)?.label || `${resultWindow} min`}. Try a wider window or add more skills.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">{LIVE_WINDOWS.filter((item) => item.minutes > resultWindow).slice(0, 3).map((item) => <button key={item.minutes} type="button" onClick={() => { update({ minutes: item.minutes }); setStep(0); setElapsed(0); scan.mutate({ ...settings, minutes: item.minutes }) }} className="rounded-full bg-[var(--paper)] px-4 py-2 text-xs font-bold ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)]">Scan last {item.label}</button>)}</div>
            </section>}
        </>
          : <section className="mt-8 grid gap-3 md:grid-cols-3">
            {[[Sparkle, 'Pick your skills', 'Choose from your saved skills or type any Upwork skill.'], [Clock, 'Set the window', 'From the last 15 minutes up to a full day of posts.'], [Crosshair, 'Scan and pounce', 'Open any job for the full brief, client details and a cover letter.']].map(([Icon, title, text], index) => <div key={title} data-card className="rounded-[1.4rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[var(--lime-tint)]/30 text-[var(--accent-strong)]"><Icon size={17} weight="duotone" /></span><span className="font-mono text-[11px] font-bold text-[var(--muted)]">0{index + 1}</span></div>
              <p className="mt-4 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{text}</p>
            </div>)}
          </section>}
    </div>
    {preview && <JobDrawer job={preview} jobs={visibleJobs} live onSelect={(job) => openPreview(job.id)} onClose={closePreview} onApply={(job) => { if (!reactions.isApplied(job.id)) reactions.toggleApplied(job.id) }} />}
  </main></Shell>
}
