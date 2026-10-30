import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { toGatewayDateFilter } from './dateRange'
import { labeller, picked } from './feedView'
import { useRefreshFailedNotice } from './notify'

/*
 * A feed section's data (WordPress, LLM, AppScript, Social), filtered, searched, sorted, paged and counted by the
 * smart gateway (fetch + get_stats, like Jobs and AI News). Two things the gateway cannot do are finished on the page,
 * from everything the gateway matched (loaded whole): an OR over fields that hold several values per item (tags and
 * the like) or values it cannot filter on, and the sorts in `localSorts` (rank order such as high > medium > low,
 * empty values last). Counts that depend on those are counted on the page from the same items, so every number on a
 * choice is what picking it shows.
 *
 * `fields` is { key: [crmField, itemField, onPage] } (onPage: matched on the page); `filters` is { key: [values] }.
 * `stripKeys` are the groups counted all the time (the strips, tabs), `openKeys` the ones counted while a filter
 * dialog is open, and `allCountKeys` the groups that also need an "all" count (tabs).
 */

const NONE = []
const NO_PICKS = {}
const NO_OPTIONS = {}

// On the page: the page-matched fields, and (for counts) the gateway's fields, all but `skip`.
const matchesPage = (fields, filters, item, skip) => Object.entries(fields).every(([key, [, prop, page]]) => !page || key === skip || picked(filters[key], item[prop]))
const matchesGateway = (fields, filters, item, skip) => Object.entries(fields).every(([key, [, prop, page]]) => page || key === skip || picked(filters[key], item[prop]))

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function useGatewayFeed({ feed, fields, filters, search, dateFilter, dateField, sort, localSorts = NO_PICKS, stripKeys = NONE, openKeys = NONE, allCountKeys = NONE, perPage = 20 }) {
  const queryClient = useQueryClient()
  const searchText = useDebounced(search.trim(), 400)
  const gatewayDate = useMemo(() => toGatewayDateFilter(dateFilter, dateField), [dateFilter, dateField])
  const onPage = (key) => Boolean(fields[key][2])
  // What the gateway filters by: the one-value fields, as { crmField: [values] }.
  const gatewayPicks = useMemo(() => Object.fromEntries(Object.entries(fields).filter(([key, [, , page]]) => !page && filters[key]?.length).map(([key, [field]]) => [field, filters[key]])), [fields, filters])
  const pagePicked = Object.keys(fields).some((key) => onPage(key) && filters[key]?.length)
  const localSort = localSorts[sort]
  const gatewaySort = localSort ? '' : sort
  const countKeys = [...new Set([...stripKeys, ...openKeys])]
  // The page finishes the list while a page-matched choice is picked, the sort is its own, or a strip counts a
  // page-matched field (then the whole list is loaded anyway).
  const stripOnPage = useMemo(() => stripKeys.some((key) => Boolean(fields[key][2])), [stripKeys, fields])
  const listFromAll = pagePicked || Boolean(localSort) || stripOnPage

  // Labels and every choice of the module's dropdowns, and how many items it has in all.
  const { data: meta } = useQuery({ queryKey: [`${feed}-options`], queryFn: () => api.getFeedOptions(feed), staleTime: 10 * 60_000 })
  const options = meta?.options || NO_OPTIONS
  const labelOf = useMemo(() => labeller(options), [options])

  const params = { search: searchText, dateFilter: gatewayDate, sort: gatewaySort }
  const paged = useInfiniteQuery({
    queryKey: [`${feed}-feed`, gatewayPicks, searchText, gatewayDate, gatewaySort],
    queryFn: ({ pageParam }) => api.getFeedPage(feed, { picks: gatewayPicks, ...params, page: pageParam, perPage }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: (previous) => previous,
    enabled: !listFromAll,
  })
  const everything = (picks, enabled) => ({
    queryKey: [`${feed}-all`, picks, searchText, gatewayDate, gatewaySort],
    queryFn: () => api.getFeedAll(feed, { picks, ...params }),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    enabled,
  })
  // Everything the gateway matches: the list while the page finishes it, and the page-matched groups' counts.
  const matchedOn = listFromAll || countKeys.some(onPage)
  const matched = useQuery(everything(gatewayPicks, matchedOn))
  // Everything for the search and date alone: the gateway's groups' counts while a page-matched choice is picked.
  const universeOn = pagePicked && countKeys.some((key) => !onPage(key))
  const universe = useQuery(everything(NO_PICKS, universeOn))

  const matchedItems = matched.data
  const pages = paged.data?.pages
  const items = useMemo(() => {
    if (listFromAll) {
      const list = (matchedItems || NONE).filter((item) => matchesPage(fields, filters, item))
      return localSort ? [...list].sort(localSort) : list
    }
    const seen = new Set()
    return (pages || NONE).flatMap((page) => page.records).filter((item) => !seen.has(item.id) && seen.add(item.id))
  }, [listFromAll, matchedItems, pages, fields, filters, localSort])
  const list = listFromAll ? matched : paged
  const total = listFromAll ? items.length : paged.data?.pages?.[0]?.total ?? 0

  // The next page loads as the end of the list comes into view.
  const loadMoreRef = useRef(null)
  const { fetchNextPage, isFetchingNextPage } = paged
  // After a next page failed, scrolling stops asking (it would ask again and again) until Try again (retryMore).
  const hasMore = !listFromAll && Boolean(paged.hasNextPage) && !paged.isFetchNextPageError
  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !hasMore) return undefined
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage() }, { rootMargin: '600px' })
    observer.observe(target)
    // Already in view (a short list, or the page grew under it): load now rather than wait for a scroll.
    if (!isFetchingNextPage && target.getBoundingClientRect().top < window.innerHeight + 600) fetchNextPage()
    return () => observer.disconnect()
  }, [hasMore, isFetchingNextPage, fetchNextPage, items.length])

  // Counts from the gateway (get_stats): each choice of a one-value field with every other filter on, while no
  // page-matched choice is picked.
  const statsKeys = (pagePicked ? NONE : countKeys.filter((key) => !onPage(key))).join(',')
  const countRequests = useMemo(() => statsKeys.split(',').filter(Boolean).flatMap((key) => {
    const [field] = fields[key]
    const values = [...(options[field] || NONE).map((option) => option.value), ...(allCountKeys.includes(key) ? ['all'] : NONE)]
    return values.map((value) => ({ key: `${key}:${value}`, picks: { ...gatewayPicks, [field]: value === 'all' ? NONE : [value] }, search: searchText, dateFilter: gatewayDate }))
  }), [statsKeys, fields, options, allCountKeys, gatewayPicks, searchText, gatewayDate])
  // Asked once the choices are known (not an "all" count on its own first).
  const { data: stats } = useQuery({ queryKey: [`${feed}-counts`, countRequests], queryFn: () => api.countFeed(feed, countRequests), enabled: Boolean(meta) && countRequests.length > 0, placeholderData: (previous) => previous, staleTime: 60_000 })

  // How many items picking `value` in group `key` shows ('all' = the group left open), with every other filter on.
  const countOf = (key, value) => {
    const [, prop, page] = fields[key]
    const has = (item) => value === 'all' || picked([value], item[prop])
    if (page) return matchedOn && matchedItems ? matchedItems.filter((item) => matchesPage(fields, filters, item, key) && has(item)).length : null
    if (!pagePicked) return stats?.[`${key}:${value}`] ?? null
    return universeOn && universe.data ? universe.data.filter((item) => matchesPage(fields, filters, item) && matchesGateway(fields, filters, item, key) && has(item)).length : null
  }

  const refresh = () => queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith(`${feed}-`) })
  useRefreshFailedNotice(list, 'the list')

  return {
    // grandTotal: how many items the module has in all (undefined until known).
    options, labelOf, items, total, grandTotal: meta?.total, countOf, refresh,
    // isError only when there is nothing to show: a failed refresh or next page keeps the items already loaded.
    loading: list.isLoading, isError: list.isLoadingError, error: list.error,
    // New results on the way (not the next page): the list fades until they come.
    updating: list.isFetching && !isFetchingNextPage,
    hasMore, loadingMore: isFetchingNextPage, loadMoreRef,
    // The next page failed: shown at the end of the list (MoreLoader) with Try again.
    loadMoreError: paged.isFetchNextPageError ? paged.error : null, retryMore: () => fetchNextPage(),
  }
}

/** Shows a change to an item at once, in every list of the feed already loaded (the CRM is saved separately). */
export function patchFeedItem(queryClient, feed, id, changes) {
  const patch = (item) => (item.id === id ? { ...item, ...changes } : item)
  queryClient.setQueriesData({ queryKey: [`${feed}-feed`] }, (data) => data && { ...data, pages: data.pages.map((page) => ({ ...page, records: page.records.map(patch) })) })
  queryClient.setQueriesData({ queryKey: [`${feed}-all`] }, (data) => data && data.map(patch))
  queryClient.setQueriesData({ queryKey: [`${feed}-item`] }, (data) => data && patch(data))
}

// The item whose details are open, kept in the link (?param=id, as the Jobs page does with ?job=), so the view can be
// shared and survives a reload. The item comes from the list loaded, or is read on its own when it is not in it
// (further down, or filtered out). A link whose item does not open (gone, a wrong id, or not readable now) is
// `missing` ({ error, retrying, retry }): the section shows the error page at that link, as /jobs/:id does. Opening
// one while another is open replaces it in the history, so Back leaves the details instead of stepping through them.
export function useOpenItem(feed, items, param) {
  const [params, setParams] = useSearchParams()
  const openId = params.get(param)
  const listed = openId ? items.find((item) => item.id === openId) || null : null
  const { data: fetched, isSuccess, isError, error, isFetching, refetch } = useQuery({
    queryKey: [`${feed}-item`, openId],
    queryFn: () => api.getFeedItem(feed, openId),
    enabled: Boolean(openId) && !listed,
    staleTime: 60_000,
  })
  const open = listed || (fetched?.id === openId ? fetched : null)
  const update = useCallback((id, replace) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (id) next.set(param, id)
    else next.delete(param)
    return next
  }, { replace }), [setParams, param])
  const openItem = useCallback((id) => update(id, Boolean(openId)), [update, openId])
  const closeItem = useCallback(() => update(null, true), [update])
  const failed = Boolean(openId) && !listed && (isError || (isSuccess && !fetched))
  const missing = failed ? { error: isError ? error : null, retrying: isFetching, retry: () => refetch() } : null
  return { openId, open, openItem, closeItem, missing }
}
