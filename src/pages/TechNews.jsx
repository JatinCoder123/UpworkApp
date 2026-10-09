import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import {
  Alarm,
  ArrowUpRight,
  Buildings,
  Funnel,
  Globe,
  MagnifyingGlass,
  Newspaper,
  PenNib,
  X,
} from '@phosphor-icons/react'
import Shell from '../components/Shell'
import NewsFilterDialog from '../components/NewsFilterDialog'
import { iconButton } from '../components/ui'
import { api } from '../services/api'
import {
  prepareDailyTechDigest,
  SCORE_TIER_THRESHOLDS,
} from '../lib/newsClassification'

const CATEGORY_LIST = [
  'All',
  'AI',
  'Other Tech (Cloud)',
  'Other Tech (Security)',
  'Tech Product',
  'Web Architecture',
]

function SourceTypeBadge({ type }) {
  if (type === 'FirstParty') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500/30 backdrop-blur-md">
        <Buildings size={13} weight="bold" />
        <span>FirstParty</span>
      </span>
    )
  }
  if (type === 'YouBlogging') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-2.5 py-1 text-[10px] font-bold text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-500/30 backdrop-blur-md">
        <PenNib size={13} weight="bold" />
        <span>YouBlogging</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2.5 py-1 text-[10px] font-bold text-blue-900 dark:text-blue-200 ring-1 ring-blue-500/30 backdrop-blur-md">
      <Globe size={13} weight="bold" />
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
  const { data: rawNews = [], isLoading } = useQuery({
    queryKey: ['tech-news'],
    queryFn: api.getTechNews,
  })

  const [activeCategory, setActiveCategory] = useState('All')
  const [activeTier, setActiveTier] = useState('All')
  const [activeSourceType, setActiveSourceType] = useState('All')
  const [search, setSearch] = useState('')
  const [filterDialog, setFilterDialog] = useState(false)
  const root = useRef(null)

  const digestStories = useMemo(() => {
    return prepareDailyTechDigest(rawNews)
  }, [rawNews])

  // Latest 2 to 3 news stories for the "Up Next / Latest News" sidebar
  const latestNewsStories = useMemo(() => {
    return [...digestStories]
      .sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0))
      .slice(0, 3)
  }, [digestStories])

  const filteredArticles = useMemo(() => {
    return digestStories.filter((item) => {
      const matchesCategory =
        activeCategory === 'All' || item.category === activeCategory

      const matchesTier =
        activeTier === 'All' ||
        (activeTier === 'BLOCKBUSTER' && item.score >= SCORE_TIER_THRESHOLDS.BLOCKBUSTER.min) ||
        (activeTier === 'HOT' &&
          item.score >= SCORE_TIER_THRESHOLDS.HOT.min &&
          item.score <= SCORE_TIER_THRESHOLDS.HOT.max) ||
        (activeTier === 'NORMAL' && item.score <= SCORE_TIER_THRESHOLDS.NORMAL.max)

      const matchesSource =
        activeSourceType === 'All' ||
        (activeSourceType === 'HurryUp' && item.hurryUp) ||
        item.sourceType === activeSourceType

      const textToSearch = `${item.title} ${item.summary} ${item.source} ${item.sourceNote || ''} ${(item.tags || []).join(' ')}`.toLowerCase()
      const matchesSearch = !search || textToSearch.includes(search.toLowerCase())

      return matchesCategory && matchesTier && matchesSource && matchesSearch
    })
  }, [digestStories, activeCategory, activeTier, activeSourceType, search])

  const categoryCounts = useMemo(() => {
    const counts = { All: digestStories.length }
    CATEGORY_LIST.forEach((cat) => {
      if (cat !== 'All') {
        counts[cat] = digestStories.filter((item) => item.category === cat).length
      }
    })
    return counts
  }, [digestStories])

  const hasActiveFilters = activeTier !== 'All' || activeSourceType !== 'All'

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
  }, [activeCategory, activeTier, activeSourceType, search, isLoading])

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

        {/* Top Horizontal Category Navigation (X-Axis) & Search/Filter Toolbar */}
        <section className="mt-10 rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Category Pills along the horizontal X-axis */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)] mr-1">
                  Category:
                </span>
                {CATEGORY_LIST.map((cat) => {
                  const isSelected = activeCategory === cat
                  const count = categoryCounts[cat] || 0

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-300 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-white shadow-xs'
                          : 'bg-[var(--paper)] text-[var(--ink)] ring-1 ring-black/5 hover:bg-black/5 dark:hover:bg-white/5'
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
                  title="Filter by Score Tier and Source Type"
                  className={`${iconButton} ${
                    hasActiveFilters
                      ? 'bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/40 font-bold'
                      : ''
                  }`}
                >
                  <Funnel size={16} weight={hasActiveFilters ? 'fill' : 'regular'} />
                </button>
              </div>
            </div>

            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 border-t border-black/[.06] dark:border-white/[.08] pt-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)] mr-1">
                  Active Filters:
                </span>
                {activeTier !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1 text-[11px] font-bold text-[var(--ink)] ring-1 ring-black/10">
                    <span>Tier: {activeTier}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTier('All')}
                      aria-label="Remove tier filter"
                      className="hover:opacity-75"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {activeSourceType !== 'All' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 py-1 text-[11px] font-bold text-[var(--ink)] ring-1 ring-black/10">
                    <span>Source: {activeSourceType}</span>
                    <button
                      type="button"
                      onClick={() => setActiveSourceType('All')}
                      aria-label="Remove source filter"
                      className="hover:opacity-75"
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTier('All')
                    setActiveSourceType('All')
                  }}
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
                {activeCategory === 'All' ? 'All Stories' : activeCategory} ({filteredArticles.length})
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
                    onClick={() => {
                      setActiveCategory('All')
                      setActiveTier('All')
                      setActiveSourceType('All')
                      setSearch('')
                    }}
                    className="mt-5 rounded-full bg-[var(--ink)] px-4 py-2 text-xs font-bold text-white"
                  >
                    Reset all filters
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {filteredArticles.map((story) => (
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

                            {/* Source Type Badge on Image */}
                            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                              <SourceTypeBadge type={story.sourceType} />

                              {story.hurryUp && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[9px] font-bold text-black shadow-xs">
                                  <Alarm size={11} weight="fill" />
                                  <span>HurryUp</span>
                                </span>
                              )}
                            </div>

                            {/* Bottom row in image */}
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
                              <span className="rounded-full bg-black/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[.1em] backdrop-blur-md">
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
          </div>

          {/* RIGHT: "Latest News" Sidebar (Referenced from Up Next & TechCrunch design) */}
          <aside className="lg:sticky lg:top-28 space-y-6">
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
                    <span>Real-time</span>
                  </span>
                </div>

                {/* 2 to 3 Latest News stories with topic thumbnails and badges */}
                <div className="space-y-4 divide-y divide-black/[.06] dark:divide-white/[.08]">
                  {latestNewsStories.map((item) => (
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

                {/* Footer note */}
                <div className="border-t border-black/[.06] dark:border-white/[.08] pt-3 text-[11px] text-[var(--muted)] flex items-center justify-between">
                  <span>Click any item for full article</span>
                  <ArrowUpRight size={13} className="text-[var(--muted)]" />
                </div>
              </div>
            </div>
          </aside>
        </section>

        {/* Filter Dialog Modal */}
        {filterDialog && (
          <NewsFilterDialog
            value={{
              tier: activeTier,
              sourceType: activeSourceType,
            }}
            onApply={(filters) => {
              setActiveTier(filters.tier)
              setActiveSourceType(filters.sourceType)
            }}
            onClose={() => setFilterDialog(false)}
          />
        )}
      </main>
    </Shell>
  )
}
