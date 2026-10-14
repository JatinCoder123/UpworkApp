import { useEffect, useState } from 'react'
import { ArrowRight, ClockCounterClockwise, Copy, MagicWand, Globe, Star } from '@phosphor-icons/react'
import { DialogHeader, Modal } from '../ui'
import { DomainName } from './DomainCards'
import { crmFavorites, crmHistory, formatPrice, oneYearPricePlan } from '../../services/domainApi'

function formatDate(value) {
  if (!value) return ''
  const date = new Date(`${String(value).replace(' ', 'T')}Z`)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--paper)] ring-1 ring-[var(--line)]"><Icon size={20} /></span><h3 className="mt-4 text-base font-semibold">{title}</h3><p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-[var(--muted)]">{text}</p></div>
}

export default function SavedDrawer({ crmEnabled, initialTab = 'history', onClose, onOpenSearch, onCopy, onUnfavorite }) {
  const [tab, setTab] = useState(initialTab)
  const [state, setState] = useState({ loading: crmEnabled, error: '', history: [], total: 0, page: 1, favorites: [] })

  const switchTab = (id) => {
    if (id === tab) return
    setTab(id)
    setState((current) => ({ ...current, loading: crmEnabled, error: '' }))
  }

  useEffect(() => {
    if (!crmEnabled) return undefined
    let alive = true
    const load = tab === 'history'
      ? crmHistory(1).then(({ history, total }) => alive && setState((current) => ({ ...current, loading: false, history, total, page: 1 })))
      : crmFavorites().then((favorites) => alive && setState((current) => ({ ...current, loading: false, favorites })))
    load.catch((error) => alive && setState((current) => ({ ...current, loading: false, error: error.message })))
    return () => { alive = false }
  }, [tab, crmEnabled])

  const loadMore = async () => {
    const page = state.page + 1
    setState((current) => ({ ...current, loading: true }))
    try {
      const { history } = await crmHistory(page)
      setState((current) => ({ ...current, loading: false, page, history: [...current.history, ...history] }))
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }))
    }
  }

  const unfavorite = async (item) => {
    setState((current) => ({ ...current, favorites: current.favorites.filter((favorite) => favorite.crm_result_id !== item.crm_result_id) }))
    await onUnfavorite(item)
  }

  return <Modal onClose={onClose} wide>
    <DialogHeader eyebrow="Domain Intelligence" title="Saved work" onClose={onClose} />
    <div className="mt-6 flex gap-1 rounded-full bg-[var(--paper)] p-1 ring-1 ring-[var(--line)]/70">
      {[['history', 'Recent searches', ClockCounterClockwise], ['favorites', 'Favorites', Star]].map(([id, label, Icon]) => <button key={id} type="button" onClick={() => switchTab(id)} aria-pressed={tab === id} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${tab === id ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}><Icon size={14} weight={tab === id ? 'fill' : 'regular'} />{label}</button>)}
    </div>

    <div className="mt-5 min-h-64">
      {!crmEnabled ? <EmptyState icon={ClockCounterClockwise} title="CRM not connected" text="Saved searches and favorites are not configured on the server yet." />
        : state.error ? <p className="rounded-2xl bg-[var(--bad-bg)] p-4 text-xs font-semibold text-[var(--bad)]">{state.error}</p>
          : state.loading && !(tab === 'history' ? state.history.length : state.favorites.length) ? <div className="space-y-2">{[0, 1, 2, 3].map((index) => <div key={index} className="skeleton-bone h-16 rounded-2xl" />)}</div>
            : tab === 'history' ? (state.history.length ? <>
              <ul className="divide-y divide-[var(--line)]/70">
                {state.history.map((search) => {
                  const Icon = search.detected_mode === 'prompt' ? MagicWand : Globe
                  return <li key={search.id}><button type="button" onClick={() => onOpenSearch(search)} className="group flex w-full items-center gap-3 py-3.5 text-left">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--paper)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]/70"><Icon size={17} weight="duotone" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold group-hover:text-[var(--accent-strong)]">{search.input_text || search.source_domain || search.name}</span><span className="mt-0.5 block text-[11px] text-[var(--muted)]">{formatDate(search.date_entered)} · {Number(search.result_count) || 0} results · {search.status}</span></span>
                    <ArrowRight size={14} className="shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                  </button></li>
                })}
              </ul>
              {state.history.length < state.total && <button type="button" onClick={loadMore} disabled={state.loading} className="mt-3 w-full rounded-full bg-[var(--paper)] py-2.5 text-xs font-bold ring-1 ring-[var(--line)] disabled:opacity-50">{state.loading ? 'Loading…' : 'Load older searches'}</button>}
            </> : <EmptyState icon={ClockCounterClockwise} title="No searches yet" text="Your domain checks and AI name searches will appear here." />)
              : state.favorites.length ? <ul className="grid gap-2">
                {state.favorites.map((item) => {
                  const plan = oneYearPricePlan(item.availability?.prices)
                  return <li key={item.crm_result_id} className="flex items-center gap-3 rounded-2xl bg-[var(--paper)] p-3.5 ring-1 ring-[var(--line)]/70">
                    <div className="min-w-0 flex-1"><DomainName domain={item.domain} className="text-lg leading-tight" /><p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">{plan ? `${formatPrice(plan.price)} first year · ` : ''}{item.brand_score ? `Score ${item.brand_score} · ` : ''}{item.search_input}</p></div>
                    <button type="button" onClick={() => onCopy(item)} aria-label={`Copy ${item.domain}`} className="grid size-9 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)]"><Copy size={14} /></button>
                    <button type="button" onClick={() => unfavorite(item)} aria-label={`Remove ${item.domain} from favorites`} className="grid size-9 place-items-center rounded-full bg-[var(--lime)] text-[#26320b]"><Star size={14} weight="fill" /></button>
                  </li>
                })}
              </ul> : <EmptyState icon={Star} title="No favorites yet" text="Star any domain in your results to keep it here." />}
    </div>
  </Modal>
}
