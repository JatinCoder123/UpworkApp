import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import {
  ArrowUpRight,
  ClockCounterClockwise,
  Funnel,
  MagnifyingGlass,
  Newspaper,
  X,
  YoutubeLogo,
} from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NewsFilterDialog from '../components/NewsFilterDialog'
import CategoryFilterDialog from '../components/CategoryFilterDialog'
import DateTimeRangeFilter from '../components/DateTimeRangeFilter'
import { ActiveDateFilterChip, RefreshFilterButton } from '../components/FilterToolbarControls'
import LogoLoader from '../components/LogoLoader'
import HScroll from '../components/HScroll'
import { iconButton } from '../components/ui'
import { api } from '../services/api'
import {
  prepareDailyTechDigest,
  SCORE_TIER_THRESHOLDS,
} from '../lib/newsClassification'
import { EMPTY_DATE_RANGE, toGatewayDateFilter } from '../lib/dateRange'
import { asArray, asObject, asText } from '../lib/safe'
import {
  loadCustomTechNewsCategories,
  loadDateFilter,
  loadTechNewsFilters,
  loadTechNewsLayout,
  saveDateFilter,
  saveTechNewsFilters,
  saveTechNewsLayout,
} from '../lib/preferences'
import { forgetSearch, loadRecentSearches, rememberSearch } from '../lib/jobSignals'
import { useAuth } from '../contexts/AuthContext'
import LayoutToggle from '../components/LayoutToggle'
import TechNewsCard from '../components/TechNewsCard'

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Screen categories displayed on the main toolbar ("All" is inside the filter dialog)
const SCREEN_CATEGORIES = ['Other Tech (Cloud)', 'AI']

// Source Type tabs displayed on the main toolbar ("All" is inside the filter dialog)
const SOURCE_TYPE_TABS = ['FirstParty', 'ThirdParty', 'YouBlogging', 'HurryUp']

export default function TechNews() {
  const { user } = useAuth()
  const [layout, setLayout] = useState(loadTechNewsLayout)
  const [selectedCategories, setSelectedCategories] = useState(() => loadTechNewsFilters().categories)
  const [customCategories, setCustomCategories] = useState(loadCustomTechNewsCategories)
  const [selectedTiers, setSelectedTiers] = useState(() => loadTechNewsFilters().tiers)
  const [selectedSourceTypes, setSelectedSourceTypes] = useState(() => loadTechNewsFilters().sourceTypes)
  const [searchInput, setSearchInput] = useState(() => loadTechNewsFilters().search)
  const debouncedSearch = useDebounced(searchInput.trim(), 450)
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches(user?.email, 'technews'))
  const [searchFocused, setSearchFocused] = useState(false)
  const [filterDialog, setFilterDialog] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [dateFilter, setDateFilter] = useState(() => loadDateFilter('techNews'))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const root = useRef(null)
  const loadMoreRef = useRef(null)
  const gatewayDateFilter = useMemo(() => toGatewayDateFilter(dateFilter), [dateFilter])

  useEffect(() => saveDateFilter('techNews', dateFilter), [dateFilter])

  useEffect(() => {
    setRecentSearches(loadRecentSearches(user?.email, 'technews'))
  }, [user?.email])

  // Save selected filters to localStorage so they persist across tabs and navigation
  useEffect(() => {
    saveTechNewsFilters({
      categories: selectedCategories,
      sourceTypes: selectedSourceTypes,
      tiers: selectedTiers,
      search: searchInput,
    })
  }, [selectedCategories, selectedSourceTypes, selectedTiers, searchInput])

  const primaryCategory = selectedCategories.length === 1 ? selectedCategories[0] : undefined
  const primarySourceType = selectedSourceTypes.length === 1 ? selectedSourceTypes[0] : undefined

  // Infinite query for stories feed from Smart Gateway (page by page as user scrolls)
  const {
    data: newsPages,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      'tech-news-feed',
      gatewayDateFilter,
      debouncedSearch,
      primaryCategory,
      primarySourceType,
    ],
    queryFn: ({ pageParam = 1 }) =>
      api.getTechNewsPage({
        page: pageParam,
        perPage: 16,
        dateFilter: gatewayDateFilter,
        search: debouncedSearch,
        category: primaryCategory,
        tag: primarySourceType,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage?.page < lastPage?.totalPages ? lastPage.page + 1 : undefined,
    placeholderData: (previous) => previous,
  })

  // Fast lightweight stats query for accurate total and badge counts from Smart Gateway
  const {
    data: newsStatsData,
    isFetching: isFetchingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['tech-news-stats', gatewayDateFilter],
    queryFn: () => api.getTechNewsStats({ dateFilter: gatewayDateFilter }),
  })

  const newsStats = asObject(newsStatsData)

  const searching = isFetching && !isFetchingNextPage && searchInput.trim() === debouncedSearch

  const handleRefresh = async () => {
    if (isRefreshing || isFetching || isFetchingStats) return
    try {
      setIsRefreshing(true)
      await Promise.all([refetch(), refetchStats()])
    } finally {
      setIsRefreshing(false)
    }
  }

  // Searches are saved to history on Enter, on picking a past search, or when leaving the box with a term in it.
  const commitSearch = (value = searchInput) => setRecentSearches(rememberSearch(user?.email, value, 'technews'))
  const applySearch = (value) => {
    setSearchInput(value)
    commitSearch(value)
    setSearchFocused(false)
  }
  const historyTerm = searchInput.trim().toLowerCase()
  const searchHistory = recentSearches.filter(
    (term) => !historyTerm || (asText(term).toLowerCase().includes(historyTerm) && asText(term).toLowerCase() !== historyTerm)
  )

  // All records gathered across all loaded pages — strictly deduplicated by unique ID (zero duplication, zero repetition)
  const rawNews = useMemo(() => {
    const seen = new Set()
    const unique = []
    for (const page of asArray(newsPages?.pages)) {
      for (const item of asArray(page?.records)) {
        if (item?.id && !seen.has(item.id)) {
          seen.add(item.id)
          unique.push(item)
        }
      }
    }
    return unique
  }, [newsPages])

  // Dynamically extract categories from Smart Gateway module and user's saved custom categories
  const categoryList = useMemo(() => {
    const presentCategories = new Set(
      rawNews.map((item) => asText(item.category).trim()).filter(Boolean)
    )

    presentCategories.delete('Web Architecture')

    const priorityOrder = [
      'Other Tech (Cloud)',
      'AI',
      'Other Tech (Security)',
      'Tech Product',
      'Other Tech (Hardware)',
      'Other Tech (Dev Tools)',
      'Other Tech (Business)',
    ]

    const ordered = priorityOrder.filter((cat) => presentCategories.has(cat))
    const others = [...new Set([...presentCategories, ...customCategories])]
      .filter((cat) => !priorityOrder.includes(cat))
      .sort()

    return ['All', ...ordered, ...others]
  }, [rawNews, customCategories])

  const digestStories = useMemo(() => {
    return prepareDailyTechDigest(rawNews)
  }, [rawNews])

  // All latest news stories sorted by recency for the Latest News sidebar
  const allLatestNewsStories = useMemo(() => {
    return [...rawNews].sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0))
  }, [rawNews])

  const filteredArticles = useMemo(() => {
    return digestStories.filter((item) => {
      const matchesCategory =
        selectedCategories.length === 0 ||
        selectedCategories.some(
          (cat) =>
            item.category === cat ||
            `${item.category || ''} ${item.title || ''} ${item.summary || ''} ${asArray(item.tags).join(' ')}`
              .toLowerCase()
              .includes(asText(cat).toLowerCase())
        )

      const matchesTier =
        selectedTiers.length === 0 ||
        selectedTiers.some((tier) => {
          if (tier === 'BLOCKBUSTER') {
            return item.score >= SCORE_TIER_THRESHOLDS.BLOCKBUSTER.min
          }
          if (tier === 'HOT') {
            return (
              item.score >= SCORE_TIER_THRESHOLDS.HOT.min &&
              item.score <= SCORE_TIER_THRESHOLDS.HOT.max
            )
          }
          if (tier === 'NORMAL') {
            return item.score <= SCORE_TIER_THRESHOLDS.NORMAL.max
          }
          return false
        })

      const matchesSource =
        selectedSourceTypes.includes('All') ||
        selectedSourceTypes.length === 0 ||
        selectedSourceTypes.some((src) => {
          if (src === 'HurryUp') return item.hurryUp === true || asArray(item.tags).some((t) => /hurryup/i.test(t))
          return item.sourceType === src || asArray(item.tags).some((t) => asText(t).toLowerCase() === asText(src).toLowerCase())
        })

      return matchesCategory && matchesTier && matchesSource
    })
  }, [digestStories, selectedCategories, selectedTiers, selectedSourceTypes])

  const totalCount = newsStats.total ?? newsPages?.pages?.[0]?.total ?? rawNews.length

  const categoryCounts = useMemo(() => {
    const counts = { All: totalCount }
    categoryList.forEach((cat) => {
      if (cat !== 'All') {
        counts[cat] = newsStats[`cat_${cat}`] ?? rawNews.filter((item) => item.category === cat).length
      }
    })
    return counts
  }, [newsStats, totalCount, categoryList, rawNews])

  const sourceTypeCounts = useMemo(() => {
    return {
      All: totalCount,
      FirstParty: newsStats.FirstParty ?? 0,
      ThirdParty: newsStats.ThirdParty ?? 0,
      YouBlogging: newsStats.YouBlogging ?? 0,
      HurryUp: newsStats.HurryUp ?? 0,
    }
  }, [newsStats, totalCount])

  const refinementFilterCount = selectedCategories.length + selectedTiers.length + selectedSourceTypes.length

  const activeCategoryTitle = useMemo(() => {
    if (selectedCategories.length === 0) return 'All Stories'
    if (selectedCategories.length === 1) return selectedCategories[0]
    return `${selectedCategories.length} Categories Selected`
  }, [selectedCategories])

  const clearAllFilters = () => {
    setSelectedCategories([])
    setSelectedTiers([])
    setSelectedSourceTypes([])
    setSearchInput('')
    setDateFilter(EMPTY_DATE_RANGE)
  }

  // Automatic Infinite Scroll observer (hits Smart Gateway for next page on scroll)
  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !hasNextPage) return undefined

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '500px 0px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, filteredArticles.length])

  useEffect(() => {
    if (!isLoading && !isRefreshing && root.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          '[data-card]',
          { y: 20, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.6,
            stagger: 0.05,
            ease: 'power3.out',
          }
        )
      }, root)
      return () => ctx.revert()
    }
  }, [selectedCategories, selectedTiers, selectedSourceTypes, debouncedSearch, dateFilter, isLoading, isRefreshing])

  return (
    <Shell>
      <main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-10 sm:px-6 md:pt-14">
        {/* Top Hero Section */}
        <section className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">
              <span className="h-px w-7 bg-[var(--ink)]/25" />
              Daily AI Digest
            </div>
            <h1 className="max-w-4xl text-[clamp(2.8rem,5.5vw,5.5rem)] font-semibold leading-[.88] tracking-[-.075em] text-[var(--ink)]">
              AI News,
              <br />
              <span className="font-serif font-medium italic">classified & curated.</span>
            </h1>
          </div>
          <div className="lg:pb-2">
            <p className="max-w-xs text-xs sm:text-sm leading-6 text-[var(--muted)]">
              Real-time intelligence feed categorized by source provenance and evaluated score tiers.
            </p>
          </div>
        </section>

        {/* Top Horizontal Navigation & Search/Filter Toolbar */}
        <section className="mt-10 rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
          <div className="space-y-4 rounded-[calc(2rem-.375rem)] bg-[var(--surface)] px-4 py-4 sm:px-6">
            {/* Top Row: Source Types (Left) + Search & Filter (Right) */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              {/* Source Type Tabs in rounded-full pill container (multi-select, "All" inside filter) */}
              <HScroll className="rounded-full bg-[var(--paper)] p-1" innerClassName="gap-1" fade="var(--paper)" label="source types">
                {SOURCE_TYPE_TABS.map((item) => {
                  const isSelected = selectedSourceTypes.includes(item)
                  const count = sourceTypeCounts[item] ?? 0

                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedSourceTypes((prev) =>
                          prev.includes(item) ? [] : [item]
                        )
                      }}
                      className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-300 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-white shadow-xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {item === 'YouBlogging' && <YoutubeLogo size={14} weight="fill" className="text-red-500" />}
                      <span>{item}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-black/5 dark:bg-white/10 text-[var(--muted)]'
                        }`}
                      >
                        {isFetchingStats && sourceTypeCounts[item] == null ? '…' : count}
                      </span>
                    </button>
                  )
                })}
              </HScroll>

              {/* Layout Toggle + Search Bar + Filter Button (Matching Opportunity Desk) */}
              <div className="flex items-center gap-2.5 shrink-0">
                <LayoutToggle
                  layout={layout}
                  onChange={(next) => {
                    setLayout(next)
                    saveTechNewsLayout(next)
                  }}
                  ariaLabel="AI news layout"
                />

                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    commitSearch()
                    setSearchFocused(false)
                  }}
                  className="relative flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-4 py-2.5 ring-1 ring-transparent transition-shadow focus-within:ring-[var(--lime-dark)] sm:w-72"
                >
                  {searching ? (
                    <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" />
                  ) : (
                    <MagnifyingGlass size={15} className="shrink-0 text-[var(--muted)]" />
                  )}
                  <input
                    value={searchInput}
                    onChange={(event) => {
                      setSearchInput(event.target.value)
                      setSearchFocused(true)
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => {
                      setSearchFocused(false)
                      if (searchInput.trim()) commitSearch()
                    }}
                    onKeyDown={(event) => event.key === 'Escape' && setSearchFocused(false)}
                    placeholder="Search stories, sources, topics…"
                    aria-label="Search tech news"
                    aria-expanded={searchFocused && searchHistory.length > 0}
                    aria-controls="tech-news-search-history"
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('')
                        setSearchFocused(false)
                      }}
                      aria-label="Clear search"
                      className="grid size-5 shrink-0 place-items-center rounded-full bg-black/[.06] text-[var(--muted)] hover:bg-black/15 dark:bg-white/10"
                    >
                      <X size={11} weight="bold" />
                    </button>
                  )}
                  {searchFocused && searchHistory.length > 0 && (
                    <div
                      id="tech-news-search-history"
                      onMouseDown={(event) => event.preventDefault()}
                      className="absolute inset-x-0 top-[calc(100%+.5rem)] z-50 rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5"
                    >
                      <div className="rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-2">
                        <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
                          <span className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">
                            Recent searches
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              recentSearches.forEach((term) => forgetSearch(user?.email, term, 'technews'))
                              setRecentSearches([])
                            }}
                            className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                          >
                            Clear history
                          </button>
                        </div>
                        <ul>
                          {searchHistory.map((term) => (
                            <li
                              key={term}
                              className="group/term flex items-center rounded-xl hover:bg-[var(--paper)]"
                            >
                              <button
                                type="button"
                                onClick={() => applySearch(term)}
                                className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-xs font-semibold text-[var(--muted)] group-hover/term:text-[var(--ink)]"
                              >
                                <ClockCounterClockwise size={14} className="shrink-0" />
                                <span className="truncate">{term}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setRecentSearches(forgetSearch(user?.email, term, 'technews'))}
                                aria-label={`Forget search ${term}`}
                                className="mr-1.5 grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] hover:bg-black/10 hover:text-[var(--ink)]"
                              >
                                <X size={11} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </form>

                <DateTimeRangeFilter
                  value={dateFilter}
                  onApply={setDateFilter}
                  label="News publishing time"
                />

                {/* Filter Button on right side of search bar */}
                <button
                  type="button"
                  onClick={() => setFilterDialog(true)}
                  aria-label="Open filter dialog"
                  title="Filter by Category, Score Tier, and Source Type"
                  className={`relative ${iconButton} ${
                    refinementFilterCount > 0
                      ? 'bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/40 font-bold'
                      : ''
                  }`}
                >
                  <Funnel size={16} weight={refinementFilterCount > 0 ? 'fill' : 'regular'} />
                  {refinementFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-[var(--ink)] text-[9px] font-bold text-white shadow-xs">
                      {refinementFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Row: Category Navigation with Universal Refresh Circle Button */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[.06] pt-3 text-xs dark:border-white/[.08]">
              <span className="mr-1 shrink-0 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
                Category:
              </span>

              <RefreshFilterButton
                onClick={handleRefresh}
                loading={isFetching || isRefreshing}
                label="Refresh news feed"
              />

              <HScroll className="flex-1" innerClassName="gap-2" label="categories">
                {SCREEN_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategories.includes(cat)

                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedCategories((prev) =>
                          prev.includes(cat) ? [] : [cat]
                        )
                      }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold ring-1 transition-all duration-300 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-white ring-black/10 shadow-xs'
                          : 'bg-[var(--paper)] text-[var(--muted)] ring-black/5 hover:bg-black/5 hover:text-[var(--ink)] dark:ring-white/10 dark:hover:bg-white/5'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-black/5 dark:bg-white/10 text-[var(--muted)]'
                        }`}
                      >
                        {isFetchingStats && categoryCounts[cat] == null ? '…' : categoryCounts[cat] ?? 0}
                      </span>
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={() => setCategoryDialog(true)}
                  className="shrink-0 rounded-full bg-transparent px-3.5 py-2 text-xs font-bold text-[var(--muted)] ring-1 ring-black/10 transition-all hover:text-[var(--ink)] hover:ring-black/20 dark:ring-white/10 dark:hover:ring-white/20"
                >
                  + More categories
                </button>
              </HScroll>

              <ActiveDateFilterChip value={dateFilter} onClear={() => setDateFilter(EMPTY_DATE_RANGE)} className="ml-auto" />
              {(refinementFilterCount > 0 || dateFilter.preset !== 'all' || searchInput) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="shrink-0 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Main Content: Left Main Stories Grid + Right "Latest News" Sidebar */}
        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] items-start">
          {/* LEFT: Main Categorized News Feed */}
          <div className="space-y-6 min-w-0">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="font-bold uppercase tracking-wider text-[var(--ink)]">
                {activeCategoryTitle} ({totalCount != null ? totalCount : filteredArticles.length})
              </span>
              <span className="text-[11px]">Click any story to open whole-page detail</span>
            </div>

            {/* Articles Grid */}
            {isLoading && !isFetchingNextPage ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <LogoLoader
                  className="min-h-[38dvh]"
                  label={isRefreshing ? 'Refreshing AI news feed...' : 'Loading AI news feed...'}
                />
              </div>
            ) : isError ? (
              <div className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
                <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] py-20 text-center">
                  <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[var(--paper)] text-rose-500">
                    <Newspaper size={24} weight="light" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Could not load stories</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {error?.message || "Check your connection and try again."}
                  </p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-5 rounded-full bg-[var(--ink)] px-5 py-2 text-xs font-bold text-white"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
                <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] py-20 text-center">
                  <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--muted)]">
                    <Newspaper size={24} weight="light" />
                  </div>
                  <p className="text-sm font-semibold text-[var(--ink)]">No stories match your filters</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Try choosing another category or clearing your active filters.
                  </p>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="mt-5 rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-bold text-white"
                  >
                    Reset all filters
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`grid gap-4 sm:gap-5 ${
                  layout === 'grid'
                    ? 'sm:grid-cols-2'
                    : layout === 'compact'
                    ? 'sm:grid-cols-2 xl:grid-cols-3'
                    : 'grid-cols-1'
                }`}
              >
                {filteredArticles.map((story) => (
                  <TechNewsCard key={story.id} story={story} layout={layout} />
                ))}
              </div>
            )}

            {/* Progressive Scroll Sentinel element */}
            <div ref={loadMoreRef} className="py-6 flex flex-col items-center justify-center">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2.5 rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Loading more stories from gateway...</span>
                </div>
              ) : hasNextPage ? (
                <div className="flex items-center gap-2.5 rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Scroll for more stories</span>
                </div>
              ) : (
                filteredArticles.length > 0 && (
                  <p className="text-center text-xs text-[var(--muted)]">
                    All {filteredArticles.length} stories loaded from live feed.
                  </p>
                )
              )}
            </div>
          </div>

          {/* RIGHT: "Latest News" Sidebar (Natural scroll + sticky on desktop) */}
          <aside className="lg:sticky lg:top-24 space-y-6">
            <div className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
              <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
                {/* Header: Latest News */}
                <div className="flex items-center justify-between border-b border-black/[.06] dark:border-white/[.08] pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)] block">
                      Up Next
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">
                      Latest News
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 text-[10px] font-extrabold text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-600/30 dark:ring-emerald-500/40 shadow-xs">
                    <span className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                    <span className="tracking-wide">{isLoading || isRefreshing ? 'Loading...' : 'Live Feed'}</span>
                  </span>
                </div>

                {/* Latest News Feed Container (Scrolls independently when cursor is over it) */}
                {isLoading || isRefreshing ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="space-y-4 divide-y divide-black/[.06] dark:divide-white/[.08]"
                  >
                    {[0, 1, 2, 3, 4].map((index) => (
                      <div key={index} className="flex items-start gap-3 pt-4 first:pt-0">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="skeleton-bone h-2.5 w-16 rounded-full" />
                            <span className="skeleton-bone h-2.5 w-10 rounded-full" />
                          </div>
                          <span className="skeleton-bone block h-3.5 w-full rounded-lg" />
                          <span className="skeleton-bone block h-3.5 w-4/5 rounded-lg" />
                          <div className="flex items-center gap-2 pt-1">
                            <span className="skeleton-bone h-2.5 w-20 rounded-full" />
                            <span className="skeleton-bone h-2.5 w-12 rounded-full" />
                          </div>
                        </div>
                        <span className="skeleton-bone size-20 sm:size-22 shrink-0 rounded-xl" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1.5 space-y-4 divide-y divide-black/[.06] dark:divide-white/[.08] scroll-smooth overscroll-contain">
                    {allLatestNewsStories.map((item) => (
                      <Link
                        key={item.id}
                        to={`/tech-news/${item.id}`}
                        className="group block pt-4 first:pt-0 transition-all"
                      >
                        <div className="flex items-start gap-3">
                          {/* Text Information */}
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[#668c16]">
                                {item.category}
                              </span>
                              <span className="text-[9px] text-[var(--muted)]">·</span>
                              <span className="text-[9px] text-[var(--muted)]">{item.posted}</span>
                            </div>

                            <h3 className="text-xs sm:text-sm font-semibold leading-snug text-[var(--ink)] line-clamp-2 transition-colors duration-300 group-hover:text-[#668c16]">
                              {item.title}
                            </h3>

                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[10px] text-[var(--muted)] truncate max-w-[120px]">
                                {item.source}
                              </span>
                              <span className={`inline-block size-1.5 rounded-full ${item.tier?.squareClass || 'bg-purple-500'}`} />
                              <span className="text-[9px] font-bold text-[var(--ink)]">
                                {item.tier?.label}
                              </span>
                            </div>
                          </div>

                          {/* Topic Image Thumbnail */}
                          {item.image && (
                            <div className="relative size-20 sm:size-22 shrink-0 overflow-hidden rounded-xl bg-[var(--ink)] ring-1 ring-black/5">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="size-full object-cover transition-transform duration-500 group-hover:scale-108"
                              />
                              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Footer note with item count */}
                <div className="border-t border-black/[.06] dark:border-white/[.08] pt-3 text-[11px] text-[var(--muted)] flex items-center justify-between">
                  <span>
                    {isLoading || isRefreshing
                      ? 'Loading latest stories...'
                      : `${allLatestNewsStories.length} live stories in feed`}
                  </span>
                  <ArrowUpRight size={13} className="text-[var(--muted)]" />
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* Category Modal Dialog (Triggered by + More categories) */}
        {categoryDialog && (
          // The dialog picks one category (like the chips above); "Reset to All" sends 'All', which clears the filter.
          <CategoryFilterDialog
            categories={categoryList}
            categoryCounts={Object.fromEntries(categoryList.map((cat) => [cat, newsStats[`cat_${cat}`] ?? 0]))}
            selectedCategory={selectedCategories.length === 1 ? selectedCategories[0] : 'All'}
            onSelect={(cat) => setSelectedCategories(cat === 'All' ? [] : [cat])}
            onClose={() => setCategoryDialog(false)}
          />
        )}

        {/* Filter Dialog Modal (Multi-select across Categories, Tiers, and Source Types) */}
        {filterDialog && (
          <NewsFilterDialog
            value={{
              tiers: selectedTiers,
              sourceTypes: selectedSourceTypes,
              categories: selectedCategories,
            }}
            categoryOptions={categoryList.filter((c) => c !== 'All')}
            categoryCounts={categoryCounts}
            onAddCustomCategory={setCustomCategories}
            onApply={(filters) => {
              setSelectedTiers(filters.tiers)
              setSelectedSourceTypes(filters.sourceTypes)
              setSelectedCategories(filters.categories)
            }}
            onClose={() => setFilterDialog(false)}
          />
        )}
      </main>
    </Shell>
  )
}
