import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowClockwise, Brain, ClockCounterClockwise, GameController, Info, MagnifyingGlass, Plus, ShieldCheck, Star, Warning } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import SearchConsole from '../components/domain/SearchConsole'
import SavedDrawer from '../components/domain/SavedDrawer'
import { DirectResult, SuggestionCard } from '../components/domain/DomainCards'
import { NamingLab, ScreeningBanner, WhileYouWait } from '../components/domain/NamingLab'
import {
  BATCH_SIZE, DEFAULT_TLDS, MAX_SUGGESTIONS, analyzeDomains, applyMozToChecks, checkDomainAvailability, checkNameSiloDomain,
  collectAvailableSuggestions, crmBeginSearch, crmHistory, crmRecordCopy, crmSaveDomainResult, crmSaveMoz, crmSearchResults, crmSetFavorite,
  crmUpdateSearch, detectInputMode, domainLabel, domainTld, getDomainConfig, isAbortError, makeId, normalizeDomain, normalizeTlds,
  oneYearPricePlan, requestMozMetrics,
} from '../services/domainApi'
import { asArray, asObject, asText } from '../lib/safe'
import { useAuth } from '../contexts/AuthContext'

const EMPTY_LAB = { round: 0, step: 0, candidates: [] }

function labReducer(lab, event) {
  if (event.type === 'round') return { ...lab, round: event.round, step: 0 }
  if (event.type === 'candidates') return { ...lab, step: 1, candidates: [...lab.candidates, ...asArray(event.candidates).map((candidate) => ({ domain: candidate?.domain, status: 'checking' }))] }
  if (event.type === 'availability') {
    return {
      ...lab,
      step: 2,
      candidates: lab.candidates.map((candidate) => {
        const result = asObject(event.results)[candidate.domain]
        if (!result || candidate.status !== 'checking') return candidate
        return { ...candidate, status: result.available === true ? 'free' : result.available === false ? 'taken' : 'unknown' }
      }),
    }
  }
  return lab
}

const SORTS = [
  ['rank', 'As found'],
  ['score', 'Best score'],
  ['price', 'Lowest price'],
  ['length', 'Shortest'],
]

const priceValue = (item) => Number(oneYearPricePlan(item.availability?.prices)?.price?.value ?? Infinity)

function readSessionKey() {
  try {
    const existing = sessionStorage.getItem('domain-intel-session')
    if (existing) return existing
    const created = makeId()
    sessionStorage.setItem('domain-intel-session', created)
    return created
  } catch {
    return makeId()
  }
}

// The page's current search for each signed-in user while the app is open, so leaving for another section and coming
// back shows the same search and results. A fresh visit (reload, other browser) opens the latest search from the CRM.
const lastViews = new Map()

// A view saved while a step was still running: the stopped step's names are shown as not screened.
function settledView(view) {
  if (!view) return null
  return {
    ...view,
    results: asArray(view.results).map((item) => (item.stage === 'screening' ? { ...item, stage: 'unscreened' } : item)),
    direct: view.direct?.status === 'loading' ? null : view.direct,
  }
}

export default function Domain() {
  const { user } = useAuth()
  const viewKey = asText(user?.email).toLowerCase()
  const [restored] = useState(() => settledView(lastViews.get(viewKey)))
  const { data: domainConfig, isError: configFailed, error: configError, refetch: retryConfig } = useQuery({ queryKey: ['domain-config'], queryFn: getDomainConfig, staleTime: Infinity, retry: 1 })
  const integrations = useMemo(() => domainConfig?.integrations || {}, [domainConfig])
  // 50 names per batch, up to 200 per search (services/domainApi.js).
  const batchSize = BATCH_SIZE
  const maxSuggestions = MAX_SUGGESTIONS
  const [sessionKey] = useState(readSessionKey)
  const [input, setInput] = useState(() => restored?.input ?? '')
  const [mode, setMode] = useState(() => restored?.mode ?? 'auto')
  const [tlds, setTlds] = useState(() => restored?.tlds ?? DEFAULT_TLDS)
  const [direct, setDirect] = useState(() => restored?.direct ?? null)
  const [context, setContext] = useState(() => restored?.context ?? null)
  const [phase, setPhase] = useState('idle')
  const [phaseStartedAt, setPhaseStartedAt] = useState(null)
  const [lab, setLab] = useState(EMPTY_LAB)
  const [results, setResults] = useState(() => restored?.results ?? [])
  const [batch, setBatch] = useState(() => restored?.batch ?? 0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [crmStatus, setCrmStatus] = useState(() => restored?.crmStatus ?? '')
  const [toast, setToast] = useState('')
  const [mozBusy, setMozBusy] = useState(() => new Set())
  const [saved, setSaved] = useState(null)
  const [sort, setSort] = useState(() => restored?.sort ?? 'rank')
  const [tldFilter, setTldFilter] = useState(() => restored?.tldFilter ?? 'all')
  const [playOpen, setPlayOpen] = useState(false)
  // True once a batch finds no new names, so scrolling stops asking for more.
  const [exhausted, setExhausted] = useState(() => restored?.exhausted ?? false)
  const loadMoreRef = useRef(null)
  const inputRef = useRef(null)
  const controllerRef = useRef(null)
  const flowRef = useRef(0)
  const crmRef = useRef(restored?.crm ?? { searchId: '', requestKey: '' })
  const crmQueueRef = useRef(Promise.resolve())
  const resultsRef = useRef(results)

  useEffect(() => { resultsRef.current = results }, [results])
  // Keep this search for when the user comes back from another section.
  useEffect(() => {
    if (!viewKey || (!context && !direct && !results.length)) return
    lastViews.set(viewKey, { input, mode, tlds, direct, context, results, batch, crmStatus, sort, tldFilter, exhausted, crm: { ...crmRef.current } })
  }, [viewKey, input, mode, tlds, direct, context, results, batch, crmStatus, sort, tldFilter, exhausted])
  useEffect(() => () => controllerRef.current?.abort(), [])
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  /* CRM writes are best-effort and serialized so a result is created before it is updated. */
  const enqueueCrm = useCallback((task) => {
    if (!integrations.crm) return
    crmQueueRef.current = crmQueueRef.current
      .then(task)
      .then(() => setCrmStatus('Saved to CRM'))
      .catch((crmError) => setCrmStatus(`CRM sync pending: ${crmError.message}`))
  }, [integrations.crm])

  const ensureSearch = useCallback(async (crm, ctx) => {
    if (!crm.searchId) {
      crm.searchId = await crmBeginSearch({ sessionKey, requestKey: crm.requestKey, inputText: ctx.inputText, selectedMode: ctx.selectedMode, detectedMode: ctx.detectedMode, sourceDomain: ctx.sourceDomain, tlds: ctx.tlds })
    }
    return crm.searchId
  }, [sessionKey])

  const updateResult = (domain, patch) => setResults((current) => current.map((item) => (item.domain === domain ? { ...item, ...patch } : item)))

  const beginFlow = () => {
    controllerRef.current?.abort()
    controllerRef.current = new AbortController()
    flowRef.current += 1
    return { flowId: flowRef.current, signal: controllerRef.current.signal }
  }

  const resetResults = () => {
    resultsRef.current = []
    setResults([])
    setDirect(null)
    setError('')
    setNotice('')
    setLab(EMPTY_LAB)
    setBatch(0)
    setExhausted(false)
    setSort('rank')
    setTldFilter('all')
    setPhase('idle')
  }

  // Detailed screening of one set of names. Runs in the background while more names are being found.
  const screenNames = async ({ ctx, items, offset, batchNumber, resultType, signal, stale }) => {
    const crm = crmRef.current
    const domains = new Set(items.map((item) => item.domain))
    try {
      const { suggestions: analyzed } = await analyzeDomains({ sourceDomain: ctx.sourceDomain, brief: ctx.brief, candidates: items, signal })
      if (stale()) return
      const byDomain = new Map(analyzed.map((item) => [item.domain, item]))
      setResults((current) => current.map((item) => {
        if (!domains.has(item.domain)) return item
        const analysis = byDomain.get(item.domain)
        if (!analysis) return item.stage === 'screening' ? { ...item, stage: 'unscreened' } : item
        return { ...item, ...analysis, moz: item.moz || null, checks: applyMozToChecks(analysis.checks, item.moz), stage: 'complete' }
      }))
      enqueueCrm(async () => {
        const searchId = await ensureSearch(crm, ctx)
        for (const analysis of analyzed) {
          const rank = offset + items.findIndex((item) => item.domain === analysis.domain) + 1
          const id = await crmSaveDomainResult(searchId, { ...analysis, source_domain: ctx.sourceDomain || '' }, { resultType, state: 'complete', batch: batchNumber, rank })
          if (!stale()) updateResult(analysis.domain, { crm_result_id: id })
        }
        await crmUpdateSearch(searchId, { status: 'completed', resultCount: resultsRef.current.length, batchCount: batchNumber })
      })
    } catch (screenError) {
      if (isAbortError(screenError) || stale()) return
      setResults((current) => current.map((item) => (domains.has(item.domain) && item.stage === 'screening' ? { ...item, stage: 'unscreened' } : item)))
      setNotice(`Detailed screening could not finish for some names. ${screenError.message}`)
    }
  }

  // One batch = 50 names (fewer when close to the 200 limit). The domain service sends only a few names per
  // request, so requests repeat until the batch is full; each set shows, and starts screening, as soon as it arrives.
  const runBatch = async (ctx, batchNumber) => {
    const flowId = flowRef.current
    const signal = controllerRef.current.signal
    const crm = crmRef.current
    const stale = () => flowId !== flowRef.current
    const resultType = ctx.sourceDomain ? 'related_suggestion' : 'prompt_suggestion'
    const target = Math.min(batchSize, maxSuggestions - resultsRef.current.length)
    let found = 0
    let screening = Promise.resolve()
    setError('')
    setNotice('')
    setLab({ ...EMPTY_LAB, round: 1 })
    setBatch(batchNumber)
    setPhase('naming')
    setPhaseStartedAt(Date.now())

    try {
      while (found < target) {
        const { suggestions } = await collectAvailableSuggestions({
          sourceDomain: ctx.sourceDomain,
          brief: ctx.brief,
          tlds: ctx.tlds,
          targetCount: target - found,
          excludedDomains: resultsRef.current.map((item) => item.domain),
          signal,
          onEvent: (event) => { if (!stale()) setLab((current) => labReducer(current, event)) },
        })
        if (stale()) return
        const known = new Set(resultsRef.current.map((item) => item.domain))
        const fresh = suggestions.filter((suggestion) => suggestion?.domain && !known.has(suggestion.domain)).slice(0, target - found)
        if (!fresh.length) {
          setExhausted(true)
          setNotice(found ? `Found ${found} more names; no further available names came up for this search.` : 'No more available names were found for this search.')
          break
        }
        const offset = resultsRef.current.length
        const foundAt = Date.now()
        const items = fresh.map((suggestion) => ({ ...suggestion, source_domain: ctx.sourceDomain || '', stage: 'screening', batch: batchNumber, is_favorite: false, foundAt }))
        found += items.length
        resultsRef.current = [...resultsRef.current, ...items]
        setResults(resultsRef.current)
        enqueueCrm(async () => {
          const searchId = await ensureSearch(crm, ctx)
          for (const [index, item] of items.entries()) {
            const id = await crmSaveDomainResult(searchId, item, { resultType, state: 'quick', batch: batchNumber, rank: offset + index + 1 })
            if (!stale()) updateResult(item.domain, { crm_result_id: id })
          }
          await crmUpdateSearch(searchId, { status: 'processing', resultCount: offset + items.length, batchCount: batchNumber })
        })
        // Screening runs one set at a time, so the screening service is not flooded.
        screening = screening.then(() => screenNames({ ctx, items: fresh, offset, batchNumber, resultType, signal, stale }))
        if (found < target) setLab({ ...EMPTY_LAB, round: 1 })
      }
    } catch (flowError) {
      if (isAbortError(flowError) || stale()) return
      setError(found ? `Found ${found} names, then the domain service stopped: ${flowError.message}` : flowError.message)
    } finally {
      if (!stale()) {
        setPhase('idle')
        setPhaseStartedAt(null)
      }
    }
  }

  const checkDirect = async (text, selectedMode) => {
    const { flowId, signal } = beginFlow()
    let domain
    try {
      domain = normalizeDomain(text, tlds.includes('com') ? 'com' : tlds[0])
    } catch (validationError) {
      setError(validationError.message)
      return
    }
    const stale = () => flowId !== flowRef.current
    const crm = crmRef.current
    const ctx = { sourceDomain: domain, brief: '', tlds, selectedMode, detectedMode: 'domain', inputText: text }
    setInput(domain)
    setContext(ctx)
    setDirect({ domain, status: 'loading' })
    setPhase('checking')
    try {
      const [check, namesilo] = await Promise.all([checkDomainAvailability(domain, { signal }), checkNameSiloDomain(domain, { signal })])
      if (stale()) return
      const { availability } = check
      setDirect({ domain, status: 'done', availability, namesilo, is_favorite: false, moz: null, crm_result_id: '' })
      enqueueCrm(async () => {
        const searchId = await ensureSearch(crm, ctx)
        const id = await crmSaveDomainResult(searchId, { domain, source_domain: domain, availability, brand_score: 0, rationale: 'Direct domain availability check', best_for: 'Requested domain' }, { resultType: 'direct', state: 'complete', batch: 1, rank: 1 })
        if (!stale()) setDirect((current) => (current?.domain === domain ? { ...current, crm_result_id: id } : current))
        await crmUpdateSearch(searchId, { status: 'processing', resultCount: 1, batchCount: 1 })
      })
    } catch (checkError) {
      if (isAbortError(checkError) || stale()) return
      setDirect({ domain, status: 'error', error: checkError.message })
      setPhase('idle')
      return
    }
    if (integrations.foundry) runBatch(ctx, 1)
    else {
      setPhase('idle')
      setNotice('AI alternatives are not configured on the server yet.')
    }
  }

  const startSearch = (raw = input) => {
    const text = String(raw).trim()
    if (!domainConfig) {
      setError(configFailed ? 'The domain service is unavailable. Retry loading it first.' : 'The domain service is still loading. Try again in a moment.')
      return
    }
    const detectedMode = mode === 'auto' ? detectInputMode(text) : mode
    if (!text || (detectedMode === 'prompt' && text.length < 3)) {
      setError(detectedMode === 'prompt' ? 'Describe your business or idea in at least 3 characters.' : 'Enter a domain name or describe your business.')
      return
    }
    crmRef.current = { searchId: '', requestKey: makeId() }
    setCrmStatus('')
    resetResults()
    if (detectedMode === 'prompt') {
      beginFlow()
      const ctx = { sourceDomain: null, brief: text, tlds, selectedMode: mode, detectedMode, inputText: text }
      setContext(ctx)
      runBatch(ctx, 1)
    } else {
      checkDirect(text, mode)
    }
  }

  const checkExact = (domain) => {
    setMode('auto')
    setInput(domain)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    crmRef.current = { searchId: '', requestKey: makeId() }
    setCrmStatus('')
    resetResults()
    checkDirect(domain, 'domain')
  }

  const findMore = () => {
    if (!context || phase !== 'idle' || resultsRef.current.length >= maxSuggestions) return
    setExhausted(false)
    if (!controllerRef.current || controllerRef.current.signal.aborted) beginFlow()
    runBatch(context, batch + 1)
  }

  const showToast = (message) => setToast(message)

  const toggleFavorite = async (item) => {
    const next = !item.is_favorite
    const apply = (value) => {
      setResults((current) => current.map((result) => (result.domain === item.domain ? { ...result, is_favorite: value } : result)))
      setDirect((current) => (current?.domain === item.domain ? { ...current, is_favorite: value } : current))
    }
    apply(next)
    if (!integrations.crm) {
      showToast(next ? `Starred ${item.domain} for this session` : `Unstarred ${item.domain}`)
      return
    }
    if (!item.crm_result_id) {
      apply(!next)
      showToast('Still saving this result. Try again in a moment.')
      return
    }
    try {
      await crmSetFavorite(item.crm_result_id, next)
      showToast(next ? `Saved ${item.domain} to favorites` : `Removed ${item.domain} from favorites`)
    } catch (favoriteError) {
      apply(!next)
      showToast(favoriteError.message)
    }
  }

  const copyDomain = async (item) => {
    try {
      await navigator.clipboard.writeText(item.domain)
      showToast(`Copied ${item.domain}`)
    } catch {
      showToast('Copy failed. Select the name and copy it manually.')
    }
    if (integrations.crm && item.crm_result_id) crmRecordCopy(item.crm_result_id).catch(() => {})
  }

  const loadMoz = async (item) => {
    setMozBusy((current) => new Set(current).add(item.domain))
    try {
      const moz = await requestMozMetrics(item.domain).catch((mozError) => ({ spam_score: null, domain_authority: null, page_authority: null, linking_root_domains: null, error: mozError.message }))
      setResults((current) => current.map((result) => (result.domain === item.domain ? { ...result, moz, checks: applyMozToChecks(result.checks, moz) } : result)))
      setDirect((current) => (current?.domain === item.domain ? { ...current, moz } : current))
      if (integrations.crm && item.crm_result_id && !moz.error) crmSaveMoz(item.crm_result_id, moz).catch(() => {})
    } finally {
      setMozBusy((current) => {
        const next = new Set(current)
        next.delete(item.domain)
        return next
      })
    }
  }

  const openSavedSearch = async (search) => {
    setSaved(null)
    const { flowId } = beginFlow()
    crmRef.current = { searchId: search.id, requestKey: makeId() }
    resetResults()
    setInput(asText(search.input_text || search.source_domain || ''))
    setNotice('Loading saved search…')
    try {
      const records = await crmSearchResults(search.id)
      if (flowId !== flowRef.current) return
      const directRecord = records.find((record) => record.result_type === 'direct')
      const suggestions = records.filter((record) => record.result_type !== 'direct').map((record) => ({ ...record, stage: record.checks ? 'complete' : 'unscreened', batch: 0 }))
      const sourceDomain = search.detected_mode === 'domain' ? search.source_domain || null : null
      setContext({ sourceDomain, brief: sourceDomain ? '' : search.input_text || '', tlds: normalizeTlds(search.preferred_tlds || tlds), selectedMode: search.selected_mode || 'auto', detectedMode: search.detected_mode, inputText: search.input_text })
      setDirect(directRecord ? { domain: directRecord.domain, status: 'done', availability: directRecord.availability, namesilo: null, is_favorite: directRecord.is_favorite, moz: directRecord.moz, crm_result_id: directRecord.crm_result_id } : null)
      resultsRef.current = suggestions
      setResults(suggestions)
      setBatch(Math.max(1, Number(search.batch_count) || 1))
      setNotice(records.length ? '' : 'This saved search has no stored results.')
    } catch (loadError) {
      if (flowId === flowRef.current) {
        setNotice('')
        setError(loadError.message)
      }
    }
  }

  // A fresh visit (nothing kept from this session) opens the user's latest search from the CRM, with its results,
  // unless they have already started something themselves.
  const autoOpened = useRef(Boolean(restored))
  useEffect(() => {
    if (autoOpened.current || !domainConfig) return
    autoOpened.current = true
    // Why nothing was reopened is logged (browser console), so a missing CRM link or empty history is easy to spot.
    if (!integrations.crm) { console.info('[Domain] Last search not reopened: the domain service has no CRM connection (integrations.crm is off).'); return }
    crmHistory(1).then(({ history }) => {
      const latest = asArray(history)[0]
      if (!latest) { console.info('[Domain] Last search not reopened: no saved searches in the CRM for this user.'); return }
      if (flowRef.current === 0 && !resultsRef.current.length) openSavedSearch(latest)
    }).catch((historyError) => console.warn('[Domain] Last search could not be loaded from the CRM:', historyError))
    // openSavedSearch reads only refs and setters, so running it from this one-time effect is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainConfig, integrations.crm])

  const unfavoriteFromDrawer = async (item) => {
    try {
      await crmSetFavorite(item.crm_result_id, false)
      setResults((current) => current.map((result) => (result.crm_result_id === item.crm_result_id ? { ...result, is_favorite: false } : result)))
      showToast(`Removed ${item.domain} from favorites`)
    } catch (favoriteError) {
      showToast(favoriteError.message)
    }
  }

  const resultTlds = useMemo(() => [...new Set(results.map((item) => domainTld(item.domain)))], [results])
  const visibleResults = useMemo(() => {
    const ranked = results.map((item, index) => ({ item, rank: index })).filter(({ item }) => tldFilter === 'all' || domainTld(item.domain) === tldFilter)
    if (sort === 'score') ranked.sort((a, b) => b.item.brand_score - a.item.brand_score)
    if (sort === 'price') ranked.sort((a, b) => priceValue(a.item) - priceValue(b.item))
    if (sort === 'length') ranked.sort((a, b) => domainLabel(a.item.domain).length - domainLabel(b.item.domain).length)
    return ranked
  }, [results, sort, tldFilter])

  // Scrolling to the end of the list finds the next 50 names, until 200. Paused after an error, when a batch
  // found nothing new, or while an extension filter is on (the button below still works then).
  const findMoreRef = useRef(findMore)
  useEffect(() => { findMoreRef.current = findMore })
  const autoLoad = phase === 'idle' && Boolean(context) && results.length > 0 && results.length < maxSuggestions && !error && !exhausted && tldFilter === 'all'
  useEffect(() => {
    const target = loadMoreRef.current
    if (!autoLoad || !target) return undefined
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) findMoreRef.current() }, { rootMargin: '400px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [autoLoad])

  const busy = phase !== 'idle'
  const screeningCount = results.filter((item) => item.stage === 'screening').length
  // When the oldest name still being screened was found, for the banner's timer.
  const screeningStartedAt = screeningCount ? Math.min(...results.filter((item) => item.stage === 'screening').map((item) => item.foundAt || Infinity)) : null
  const screeningSince = Number.isFinite(screeningStartedAt) ? screeningStartedAt : null
  const subject = context?.sourceDomain || context?.brief || ''
  const showLanding = !direct && !results.length && phase === 'idle' && !error && !notice
  const labBlock = phase === 'naming' && <>
    <NamingLab lab={lab} startedAt={phaseStartedAt} subject={subject} />
    <p className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]"><GameController size={14} weight="duotone" />While you wait</p>
    <WhileYouWait onCheckName={(label) => { setInput(label); setMode('auto'); inputRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
  </>
  const missingKeys = [
    !integrations.godaddy && 'GoDaddy — live pricing (falling back to the public registry for availability)',
    !integrations.foundry && 'Azure AI Foundry — AI name suggestions and screening',
    !integrations.crm && 'CRM gateway — saved history and favorites',
    !integrations.namesilo && 'NameSilo — price comparison',
    !integrations.moz && 'Moz — domain metrics',
  ].filter(Boolean)

  return (
    <Shell>
      <main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 md:pt-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-[-.04em]">Domain</h1>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSaved('history')} className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2.5 text-xs font-bold ring-1 ring-[var(--line)] transition-all hover:-translate-y-0.5"><ClockCounterClockwise size={15} />Recent</button>
            <button type="button" onClick={() => setSaved('favorites')} className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-4 py-2.5 text-xs font-bold ring-1 ring-[var(--line)] transition-all hover:-translate-y-0.5"><Star size={15} />Favorites</button>
          </div>
        </header>

        {configFailed && <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--bad-bg)] px-4 py-3.5 text-sm font-semibold text-[var(--bad)]"><Warning size={18} weight="bold" className="mt-0.5 shrink-0" /><span className="flex-1">Could not load the domain service. {configError?.message}</span><button type="button" onClick={() => retryConfig()} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold underline-offset-2 hover:underline"><ArrowClockwise size={13} weight="bold" />Retry</button></div>}
        {import.meta.env.DEV && domainConfig && missingKeys.length > 0 && <details className="mt-6 rounded-2xl bg-[var(--warn-bg)] px-4 py-3 text-xs text-[var(--warn)]">
          <summary className="cursor-pointer font-bold"><Warning size={14} weight="bold" className="mr-1.5 inline" />{missingKeys.length} {missingKeys.length === 1 ? 'integration is' : 'integrations are'} not configured on the backend (dev-only notice)</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">{missingKeys.map((key) => <li key={key}>{key}</li>)}</ul>
        </details>}

        <section className="mt-4">
          <SearchConsole value={input} onChange={setInput} mode={mode} onModeChange={setMode} tlds={tlds} onTldsChange={setTlds} onSubmit={() => startSearch()} busy={busy} inputRef={inputRef} onPeekCheck={checkExact} />
        </section>

        {error && <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--bad-bg)] px-4 py-3.5 text-sm font-semibold text-[var(--bad)]"><Warning size={18} weight="bold" className="mt-0.5 shrink-0" /><span className="flex-1">{error}</span>{context && !busy && <button type="button" onClick={results.length ? findMore : () => startSearch(context.inputText)} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold underline-offset-2 hover:underline"><ArrowClockwise size={13} weight="bold" />Retry</button>}</div>}
        {notice && <div role="status" className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--surface)] px-4 py-3.5 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]"><Info size={16} weight="bold" className="mt-px shrink-0" />{notice}</div>}

        {direct && <DirectResult direct={direct} onCopy={copyDomain} onFavorite={toggleFavorite} onMoz={loadMoz} mozBusy={mozBusy.has(direct.domain)} />}

        {!results.length && labBlock}

        {results.length > 0 && <section className="mt-12" aria-labelledby="domain-results-title">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] pb-4">
            <div>
              <h2 id="domain-results-title" className="text-2xl font-semibold tracking-[-.04em] sm:text-3xl">{context?.sourceDomain ? <>Alternatives to <span className="font-serif italic">{context.sourceDomain}</span></> : 'Available names for your idea'}</h2>
              <p className="mt-1 text-xs font-medium text-[var(--muted)]">{results.length} of {maxSuggestions} available names{crmStatus && ` · ${crmStatus}`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {resultTlds.length > 1 && <div className="flex gap-1 rounded-full bg-[var(--surface)] p-1 ring-1 ring-[var(--line)]/70">
                {['all', ...resultTlds].map((tld) => <button key={tld} type="button" onClick={() => setTldFilter(tld)} aria-pressed={tldFilter === tld} className={`rounded-full px-2.5 py-1 font-mono text-[10px] transition-all ${tldFilter === tld ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{tld === 'all' ? 'all' : `.${tld}`}</button>)}
              </div>}
              <label className="flex items-center gap-1.5 rounded-full bg-[var(--surface)] py-1 pl-3 pr-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)] ring-1 ring-[var(--line)]/70">Sort
                <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-full bg-[var(--paper)] px-2 py-1 text-[11px] font-semibold normal-case tracking-normal text-[var(--ink)] outline-none">
                  {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
            </div>
          </div>

          {screeningCount > 0 && <>
            <ScreeningBanner startedAt={screeningSince} count={screeningCount} />
            {phase !== 'naming' && <button type="button" onClick={() => setPlayOpen((open) => !open)} aria-expanded={playOpen} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-strong)]"><GameController size={14} weight="duotone" />{playOpen ? 'Hide the mini games' : 'Play a quick game while this finishes'}</button>}
            {playOpen && phase !== 'naming' && <WhileYouWait onCheckName={(label) => { setInput(label); setMode('auto'); inputRef.current?.focus(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />}
          </>}

          <div className="mt-6 space-y-4">
            {visibleResults.map(({ item, rank }) => <SuggestionCard key={item.domain} item={item} rank={rank} onCopy={copyDomain} onFavorite={toggleFavorite} onMoz={loadMoz} onUseName={checkExact} mozBusy={mozBusy.has(item.domain)} />)}
            {!visibleResults.length && <p className="py-10 text-center text-sm text-[var(--muted)]">No names with this extension yet.</p>}
          </div>

          {labBlock}

          <div ref={loadMoreRef} aria-hidden="true" />
          {phase === 'idle' && context && results.length < maxSuggestions && <div className="mt-8 flex justify-center">
            <button type="button" onClick={findMore} className="group inline-flex items-center justify-center gap-3 rounded-full bg-[var(--ink)] py-2 pl-5 pr-2 text-sm font-semibold text-white transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-0.5 active:scale-[.98]">
              Find {Math.min(batchSize, maxSuggestions - results.length)} more names<span className="grid size-8 place-items-center rounded-full bg-white/15 transition-transform group-hover:rotate-90"><Plus size={14} weight="bold" /></span>
            </button>
          </div>}
        </section>}

        {showLanding && <section className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            [MagnifyingGlass, 'Check any name', 'Type a domain to get live availability, every registration term, renewal price and a NameSilo comparison.'],
            [Brain, 'Let AI coin names', 'Describe your idea. AI drafts distinctive names and keeps only the ones that are actually free to register.'],
            [ShieldCheck, 'Screen before you buy', 'Each shortlisted name is researched on the live web across 43 brand, trademark, SEO and growth checks.'],
          ].map(([Icon, title, text], index) => <article key={title} style={{ '--i': index * 2 }} className="domain-chip-in rounded-[1.75rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--line)]">
            <span className="grid size-11 place-items-center rounded-2xl bg-[var(--lime)]/35 text-[var(--accent-strong)]"><Icon size={20} weight="duotone" /></span>
            <p className="mt-5 font-mono text-[11px] text-[var(--muted)]">0{index + 1}</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-.03em]">{title}</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{text}</p>
          </article>)}
        </section>}
      </main>

      {saved && <SavedDrawer crmEnabled={Boolean(integrations.crm)} initialTab={saved} onClose={() => setSaved(null)} onOpenSearch={openSavedSearch} onCopy={copyDomain} onUnfavorite={unfavoriteFromDrawer} />}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && <p key={toast} className="domain-ticker rounded-full bg-[var(--ink)] px-5 py-3 text-xs font-semibold text-white shadow-[0_18px_50px_rgba(20,28,21,.3)]">{toast}</p>}
      </div>
    </Shell>
  )
}
