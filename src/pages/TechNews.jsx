import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import {
  ArrowClockwise,
  ArrowUpRight,
  Funnel,
  MagnifyingGlass,
  Newspaper,
  Plus,
  X,
} from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NewsFilterDialog from '../components/NewsFilterDialog'
import CategoryFilterDialog from '../components/CategoryFilterDialog'
import { iconButton } from '../components/ui'
import { api } from '../services/api'
import {
  prepareDailyTechDigest,
  SCORE_TIER_THRESHOLDS,
} from '../lib/newsClassification'

// Show strictly 3 fixed categories on the main screen (All, Other Tech (Cloud), AI)
// Notice AI is moved to third position so All and AI are not side-by-side
const SCREEN_CATEGORIES = ['All', 'Other Tech (Cloud)', 'AI']

// Source Type tabs matching Opportunity Desk pipeline
const SOURCE_TYPE_TABS = ['All', 'FirstParty', 'ThirdParty', 'YouBlogging', 'HurryUp']

function SourceTypeBadge({ type }) {
  if (type === 'FirstParty') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        <span>FirstParty</span>
      </span>
    )
  }
  if (type === 'YouBlogging') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
        <span className="size-1.5 rounded-full bg-purple-500" />
        <span>YouBlogging</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
      <span className="size-1.5 rounded-full bg-blue-500" />
      <span>ThirdParty</span>
    </span>
  )
}

function ScoreBadge({ tier }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
      <span className={`size-2 rounded-xs ${tier?.squareClass || 'bg-purple-500'}`} />
      <span>{tier?.label || 'NORMAL'}</span>
    </span>
  )
}

export default function TechNews() {
  const [selectedCategories, setSelectedCategories] = useState([])
  const [selectedTiers, setSelectedTiers] = useState([])
  const [selectedSourceTypes, setSelectedSourceTypes] = useState([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterDialog, setFilterDialog] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const root = useRef(null)
  const loadMoreRef = useRef(null)

  // 350ms debounce for Smart Gateway search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Single cached unified query from Smart Gateway
  const {
    data: newsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['tech-news-feed'],
    queryFn: () => api.getAllTechNews(false),
    staleTime: 5 * 60 * 1000,
  })

  const handleRefresh = async () => {
    await api.getAllTechNews(true)
    await refetch()
  }

  // All records gathered across all loaded pages — strictly deduplicated by unique ID (zero duplication, zero repetition)
  const rawNews = useMemo(() => {
    const seen = new Set()
    const unique = []
    for (const item of newsData?.records || []) {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id)
        unique.push(item)
      }
    }
    return unique
  }, [newsData])

  // Dynamically extract only categories that actually exist in the Smart Gateway module AND have data
  const categoryList = useMemo(() => {
    // Find all distinct categories from records that actually have data
    const presentCategories = new Set(
      rawNews.map((item) => item.category?.trim()).filter(Boolean)
    )

    // Ensure 'Web Architecture' is completely excluded
    presentCategories.delete('Web Architecture')

    // Maintain preferred order for standard categories that have data
    const priorityOrder = [
      'Other Tech (Cloud)',
      'AI',
      'Other Tech (Security)',
      'Tech Product',
      'Other Tech (Hardware)',
      'Other Tech (Dev Tools)',
      'Other Tech (Business)',
    ]

    // Only include categories that actually have data inside them
    const ordered = priorityOrder.filter((cat) => presentCategories.has(cat))
    // Any other category in the CRM module with data is automatically discovered and added dynamically
    const others = [...presentCategories].filter((cat) => !priorityOrder.includes(cat)).sort()

    return ['All', ...ordered, ...others]
  }, [rawNews])

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
        selectedCategories.includes(item.category)

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
        selectedSourceTypes.length === 0 ||
        selectedSourceTypes.some((src) => {
          if (src === 'HurryUp') {
            return item.hurryUp === true
          }
          return item.sourceType === src
        })

      const textToSearch = `${item.title} ${item.summary} ${item.source} ${item.sourceNote || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
      const matchesSearch = !debouncedSearch || textToSearch.includes(debouncedSearch.toLowerCase())

      return matchesCategory && matchesTier && matchesSource && matchesSearch
    })
  }, [digestStories, selectedCategories, selectedTiers, selectedSourceTypes, debouncedSearch])

  const categoryCounts = useMemo(() => {
    const counts = { All: newsData?.total || rawNews.length }

    categoryList.forEach((cat) => {
      if (cat !== 'All') {
        counts[cat] = rawNews.filter((item) => item.category === cat).length
      }
    })

    return counts
  }, [newsData, rawNews, categoryList])

  const sourceTypeCounts = useMemo(() => {
    const counts = {
      All: rawNews.length,
      FirstParty: 0,
      ThirdParty: 0,
      YouBlogging: 0,
      HurryUp: 0,
    }

    for (const item of rawNews) {
      if (item.sourceType === 'FirstParty') counts.FirstParty++
      else if (item.sourceType === 'ThirdParty') counts.ThirdParty++
      else if (item.sourceType === 'YouBlogging') counts.YouBlogging++

      if (item.hurryUp) counts.HurryUp++
    }

    return counts
  }, [rawNews])

  const totalActiveFilters =
    selectedCategories.length + selectedTiers.length + selectedSourceTypes.length

  const activeCategoryTitle = useMemo(() => {
    if (selectedCategories.length === 0) return 'All Stories'
    if (selectedCategories.length === 1) return selectedCategories[0]
    return `${selectedCategories.length} Categories Selected`
  }, [selectedCategories])

  const removeCategory = (cat) => {
    setSelectedCategories((prev) => prev.filter((item) => item !== cat))
  }

  const removeTier = (tier) => {
    setSelectedTiers((prev) => prev.filter((item) => item !== tier))
  }

  const removeSourceType = (src) => {
    setSelectedSourceTypes((prev) => prev.filter((item) => item !== src))
  }

  const clearAllFilters = () => {
    setSelectedCategories([])
    setSelectedTiers([])
    setSelectedSourceTypes([])
    setSearch('')
  }

  const filterKey = `${selectedCategories.join(',')}|${selectedTiers.join(',')}|${selectedSourceTypes.join(',')}|${debouncedSearch}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  const [visibleCount, setVisibleCount] = useState(16)

  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setVisibleCount(16)
  }

  const displayedArticles = useMemo(() => {
    return filteredArticles.slice(0, visibleCount)
  }, [filteredArticles, visibleCount])

  const hasMore = visibleCount < filteredArticles.length

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + 12, filteredArticles.length))
  }, [filteredArticles.length])

  // Automatic Infinite Scroll observer (seamlessly reveals next chunk of stories on scroll)
  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '250px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  useEffect(() => {
    if (!isLoading && root.current) {
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
  }, [selectedCategories, selectedTiers, selectedSourceTypes, search, isLoading])

  return (
    <Shell>
      <main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-10 sm:px-6 md:pt-14">
        {/* Top Hero Section */}
        <section className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">
              <span className="h-px w-7 bg-[var(--ink)]/25" />
              Daily Tech Digest
            </div>
            <h1 className="max-w-4xl text-[clamp(2.8rem,5.5vw,5.5rem)] font-semibold leading-[.88] tracking-[-.075em] text-[var(--ink)]">
              Tech News,
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
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-4 sm:p-5 space-y-4">
            {/* Top Row: Source Types (Left) + Search & Filter (Right) */}
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              {/* Source Type Tabs in rounded-full pill container (matching Opportunity Desk pipeline) */}
              <div className="flex gap-1 overflow-x-auto rounded-full bg-[var(--paper)] p-1 scrollbar-none">
                {SOURCE_TYPE_TABS.map((item) => {
                  const isSelected =
                    item === 'All'
                      ? selectedSourceTypes.length === 0
                      : selectedSourceTypes.length === 1 && selectedSourceTypes[0] === item
                  const count = sourceTypeCounts[item] || 0

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        if (item === 'All') {
                          setSelectedSourceTypes([])
                        } else {
                          setSelectedSourceTypes((prev) =>
                            prev.length === 1 && prev[0] === item ? [] : [item]
                          )
                        }
                      }}
                      className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-300 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-white shadow-xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>{item}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-black/5 dark:bg-white/10 text-[var(--muted)]'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Search Bar + Filter Button (Like Opportunity Desk) */}
              <div className="flex items-center gap-2.5 shrink-0">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-3.5 py-2 ring-1 ring-black/5 transition-all focus-within:ring-[var(--lime-dark)] sm:w-64">
                  <MagnifyingGlass size={15} className="shrink-0 text-[var(--muted)]" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search stories, sources..."
                    className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none text-[var(--ink)] placeholder:text-[var(--muted)]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>

                {/* Filter Button on right side of search bar */}
                <button
                  type="button"
                  onClick={() => setFilterDialog(true)}
                  aria-label="Open filter dialog"
                  title="Filter by Category, Score Tier, and Source Type"
                  className={`relative ${iconButton} ${
                    totalActiveFilters > 0
                      ? 'bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/40 font-bold'
                      : ''
                  }`}
                >
                  <Funnel size={16} weight={totalActiveFilters > 0 ? 'fill' : 'regular'} />
                  {totalActiveFilters > 0 && (
                    <span className="absolute -top-1 -right-1 grid size-4.5 place-items-center rounded-full bg-[var(--ink)] text-[9px] font-bold text-white shadow-xs">
                      {totalActiveFilters}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Bottom Row: Category Navigation with Universal Refresh Circle Button */}
            <div className="flex flex-wrap items-center gap-2 border-t border-black/[.06] dark:border-white/[.08] pt-3 text-xs">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)] mr-1">
                Category:
              </span>

              {/* Universal Refresh Circle Button */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                title="Refresh news feed"
                aria-label="Refresh news feed"
                className={`grid size-8 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--muted)] ring-1 ring-black/5 transition-all hover:bg-black/5 hover:text-[var(--ink)] dark:ring-white/10 dark:hover:bg-white/5 ${
                  isFetching ? 'opacity-70 cursor-not-allowed' : 'active:scale-95'
                }`}
              >
                <ArrowClockwise
                  size={15}
                  weight="bold"
                  className={isFetching ? 'animate-spin text-[var(--lime-dark)]' : ''}
                />
              </button>

              {/* Strictly 3 fixed categories: All, Other Tech (Cloud), AI */}
              {SCREEN_CATEGORIES.map((cat) => {
                const isSelected =
                  cat === 'All'
                    ? selectedCategories.length === 0
                    : selectedCategories.length === 1 && selectedCategories[0] === cat
                const count = categoryCounts[cat] || 0

                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (cat === 'All') {
                        setSelectedCategories([])
                      } else {
                        setSelectedCategories((prev) =>
                          prev.length === 1 && prev[0] === cat ? [] : [cat]
                        )
                      }
                    }}
                    className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                      isSelected
                        ? 'bg-[var(--ink)] text-white shadow-xs'
                        : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] ring-1 ring-black/5 dark:ring-white/10 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{cat}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-black/5 dark:bg-white/10 text-[var(--muted)]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}

              {/* + More categories button (Opens modal with all categories) */}
              {(() => {
                const isExternalSelected =
                  selectedCategories.length > 0 &&
                  !(selectedCategories.length === 1 && SCREEN_CATEGORIES.includes(selectedCategories[0]))

                return (
                  <button
                    type="button"
                    onClick={() => setCategoryDialog(true)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isExternalSelected
                        ? 'bg-[var(--ink)] text-white ring-1 ring-black/10 shadow-xs'
                        : 'bg-transparent text-[var(--muted)] ring-1 ring-black/10 hover:text-[var(--ink)] hover:ring-black/20 dark:ring-white/10 dark:hover:ring-white/20'
                    }`}
                    title="View and select from all categories"
                  >
                    <Plus size={13} weight="bold" />
                    <span>More categories</span>
                    {isExternalSelected && (
                      <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white">
                        {selectedCategories.length === 1
                          ? selectedCategories[0]
                          : `${selectedCategories.length} selected`}
                      </span>
                    )}
                  </button>
                )
              })()}
            </div>

            {/* Active Filters Display */}
            {totalActiveFilters > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-black/[.06] dark:border-white/[.08] pt-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)] mr-1">
                  Active Filters ({totalActiveFilters}):
                </span>

                {/* Category chips */}
                {selectedCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1 text-[11px] font-bold text-[var(--ink)] ring-1 ring-black/10 shadow-xs"
                  >
                    <span>Category: {cat}</span>
                    <button
                      type="button"
                      onClick={() => removeCategory(cat)}
                      aria-label={`Remove ${cat} category filter`}
                      className="hover:opacity-75"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}

                {/* Score Tier chips */}
                {selectedTiers.map((tier) => (
                  <span
                    key={tier}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1 text-[11px] font-bold text-[var(--ink)] ring-1 ring-black/10 shadow-xs"
                  >
                    <span
                      className={`size-2 rounded-xs ${
                        tier === 'BLOCKBUSTER'
                          ? 'bg-rose-500'
                          : tier === 'HOT'
                            ? 'bg-amber-500'
                            : 'bg-purple-500'
                      }`}
                    />
                    <span>
                      Tier: {tier === 'BLOCKBUSTER' ? 'Blockbuster' : tier === 'HOT' ? 'Hot' : 'Normal'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTier(tier)}
                      aria-label={`Remove ${tier} tier filter`}
                      className="hover:opacity-75"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}

                {/* Source Type chips */}
                {selectedSourceTypes.map((src) => (
                  <span
                    key={src}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1 text-[11px] font-bold text-[var(--ink)] ring-1 ring-black/10 shadow-xs"
                  >
                    <span
                      className={`size-2 rounded-full ${
                        src === 'FirstParty'
                          ? 'bg-emerald-500'
                          : src === 'ThirdParty'
                            ? 'bg-blue-500'
                            : src === 'YouBlogging'
                              ? 'bg-purple-500'
                              : 'bg-amber-500'
                      }`}
                    />
                    <span>Source: {src}</span>
                    <button
                      type="button"
                      onClick={() => removeSourceType(src)}
                      aria-label={`Remove ${src} source filter`}
                      className="hover:opacity-75"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}

                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="ml-auto text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Main Content: Left Main Stories Grid + Right "Latest News" Sidebar */}
        <section className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] items-start">
          {/* LEFT: Main Categorized News Feed */}
          <div className="space-y-6 min-w-0">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="font-bold uppercase tracking-wider text-[var(--ink)]">
                {activeCategoryTitle} ({filteredArticles.length})
              </span>
              <span className="text-[11px]">Click any story to open whole-page detail</span>
            </div>

            {/* Articles Grid */}
            {isLoading ? (
              <p className="py-24 text-center text-sm text-[var(--muted)]">Loading tech news...</p>
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
              <div className="grid gap-6 sm:grid-cols-2">
                {displayedArticles.map((story) => (
                  <article
                    key={story.id}
                    data-card
                    className="group flex flex-col overflow-hidden rounded-[1.8rem] bg-black/[.045] p-1.5 ring-1 ring-black/5 transition-all duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1 hover:bg-black/[.07]"
                  >
                    <div className="relative flex flex-1 flex-col overflow-hidden rounded-[calc(1.8rem-.375rem)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,.9)]">
                      {/* Topic-Matching Banner Image */}
                      {story.image && (
                        <Link
                          to={`/tech-news/${story.id}`}
                          className="relative block h-44 w-full overflow-hidden bg-[var(--ink)]"
                        >
                          <img
                            src={story.image}
                            alt={story.title}
                            className="size-full object-cover opacity-85 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                          {/* Source Type & HurryUp Badges on Image (High-contrast generic styling) */}
                          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                            <SourceTypeBadge type={story.sourceType} />

                            {story.hurryUp && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
                                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>HurryUp</span>
                              </span>
                            )}
                          </div>

                          {/* Bottom row in image */}
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                            <span className="rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.1em] backdrop-blur-md">
                              {story.category}
                            </span>
                            <span className="text-[10px] opacity-90">{story.readTime}</span>
                          </div>
                        </Link>
                      )}

                      {/* Card Body */}
                      <div className="flex flex-1 flex-col p-5 sm:p-6">
                        {/* Classification Row: Score Tier & Posted time */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[.06] dark:border-white/[.08] pb-3 text-xs">
                          <ScoreBadge tier={story.tier} />
                          <span className="text-[10px] font-semibold text-[var(--muted)]">
                            {story.posted}
                          </span>
                        </div>

                        {/* Source Provenance */}
                        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--muted)]">
                          <span className="font-bold uppercase tracking-[.1em] text-[var(--ink)]">
                            {story.source}
                          </span>
                          {story.sourceNote && (
                            <span className="truncate max-w-[170px] italic text-[10px]">
                              {story.sourceNote}
                            </span>
                          )}
                        </div>

                        {/* Linked Headline (Clicking navigates to whole-page detail view) */}
                        <Link
                          to={`/tech-news/${story.id}`}
                          className="mt-3 block group/title"
                        >
                          <h2 className="text-lg font-semibold leading-[1.3] tracking-[-.035em] text-[var(--ink)] transition-colors duration-300 group-hover/title:text-[#668c16] sm:text-xl">
                            {story.title}
                          </h2>
                        </Link>

                        {/* Summary */}
                        <p className="mt-2.5 flex-1 text-xs leading-5 text-[var(--muted)] line-clamp-3">
                          {story.summary}
                        </p>

                        {/* Card Footer Actions */}
                        <div className="mt-6 flex items-center justify-between border-t border-black/[.07] dark:border-white/[.08] pt-4">
                          <Link
                            to={`/tech-news/${story.id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[var(--ink)] hover:text-[#668c16] transition-colors"
                          >
                            <span>Read full story</span>
                            <ArrowUpRight size={13} />
                          </Link>

                          <div className="flex items-center gap-2">
                            {story.url && (
                              <a
                                href={story.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open original source on ${story.source}`}
                                className="grid size-8 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] ring-1 ring-black/5 transition-transform duration-500 hover:rotate-12"
                              >
                                <ArrowUpRight size={13} weight="light" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Progressive Scroll Sentinel element */}
            <div ref={loadMoreRef} className="py-6 flex flex-col items-center justify-center">
              {hasMore ? (
                <div className="flex items-center gap-2.5 rounded-full bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Showing {displayedArticles.length} of {filteredArticles.length} stories...</span>
                </div>
              ) : (
                rawNews.length > 0 && (
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
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Live Feed</span>
                  </span>
                </div>

                {/* Latest News Feed Container (Scrolls independently when cursor is over it) */}
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

                {/* Footer note with item count */}
                <div className="border-t border-black/[.06] dark:border-white/[.08] pt-3 text-[11px] text-[var(--muted)] flex items-center justify-between">
                  <span>{allLatestNewsStories.length} live stories in feed</span>
                  <ArrowUpRight size={13} className="text-[var(--muted)]" />
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* Category Modal Dialog (Triggered by + More categories) */}
        {categoryDialog && (
          <CategoryFilterDialog
            categories={categoryList}
            categoryCounts={categoryCounts}
            selectedCategories={selectedCategories}
            onApply={(cats) => setSelectedCategories(cats)}
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
