import { useMemo } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowUpRight,
  ShieldCheck,
  Tag,
} from '@phosphor-icons/react'
import Shell from '../components/Shell'
import { primaryButton } from '../components/ui'
import { api } from '../services/api'
import {
  classifyScoreTier,
  classifySourceType,
  isHurryUp,
} from '../lib/newsClassification'

function SourceIcon({ type }) {
  if (type === 'FirstParty') return <span className="size-1.5 rounded-full bg-emerald-500" />
  if (type === 'YouBlogging') return <span className="size-1.5 rounded-full bg-purple-500" />
  return <span className="size-1.5 rounded-full bg-blue-500" />
}

export default function TechNewsDetail() {
  const { id } = useParams()

  const { data: story, isLoading, isError } = useQuery({
    queryKey: ['tech-news-item', id],
    queryFn: () => api.getTechNewsItem(id),
  })

  const { data: newsResult } = useQuery({
    queryKey: ['tech-news-sidebar'],
    queryFn: () => api.getTechNews({ page: 1, perPage: 15 }),
  })

  const allNews = useMemo(() => newsResult?.records || [], [newsResult])

  // All Up Next / Latest News items excluding the current story (strictly deduplicated)
  const allUpNextStories = useMemo(() => {
    const seen = new Set()
    const unique = []
    for (const item of allNews) {
      if (item?.id && item.id !== id && !seen.has(item.id)) {
        seen.add(item.id)
        unique.push(item)
      }
    }
    return unique.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0))
  }, [allNews, id])

  if (isLoading) {
    return (
      <Shell>
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-10 sm:px-6 md:pt-14">
          <p className="py-24 text-center text-sm text-[var(--muted)]">Loading story details...</p>
        </main>
      </Shell>
    )
  }

  if (isError || !story) {
    return <Navigate to="/tech-news" replace />
  }

  const score = typeof story.score === 'number' ? story.score : 0
  const tier = classifyScoreTier(score)
  const sourceType = classifySourceType(story)
  const hurryUp = isHurryUp(story)

  return (
    <Shell>
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-10 sm:px-6 md:pt-14">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/tech-news"
            className="inline-flex items-center gap-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            <span className="grid size-9 place-items-center rounded-full bg-black/5 dark:bg-white/5">
              <ArrowLeft size={15} />
            </span>
            <span>All tech news</span>
          </Link>

          {story.url && (
            <a
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className={primaryButton}
            >
              <span>Open original article</span>
              <span className="grid size-7 place-items-center rounded-full bg-white/15">
                <ArrowSquareOut size={14} />
              </span>
            </a>
          )}
        </div>

        {/* Main Content Layout */}
        <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,.75fr)] xl:gap-16">
          <div>
            {/* Header Classification Badges (High-contrast generic styling) */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Score Tier Badge */}
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 shadow-xs">
                <span className={`size-2.5 rounded-xs ${tier.squareClass}`} />
                <span>{tier.label}</span>
              </span>

              {/* Source Type Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 shadow-xs">
                <SourceIcon type={sourceType} />
                <span>Source: {sourceType}</span>
              </span>

              {/* HurryUp Badge */}
              {hurryUp && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-xs font-bold text-[var(--ink)] ring-1 ring-black/10 dark:ring-white/10 shadow-xs">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>HurryUp</span>
                </span>
              )}

              <span className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)] ml-auto">
                {story.category} · {story.posted}
              </span>
            </div>

            {/* Headline */}
            <h1 className="mt-6 max-w-5xl text-[clamp(2.2rem,4.5vw,4.5rem)] font-semibold leading-[1.02] tracking-[-.06em] text-[var(--ink)]">
              {story.title}
            </h1>

            {/* Hero Image */}
            {story.image && (
              <div className="mt-8 overflow-hidden rounded-[2rem] bg-black/[.05] p-1.5 ring-1 ring-black/5">
                <div className="relative h-72 sm:h-96 w-full overflow-hidden rounded-[calc(2rem-.375rem)] bg-[var(--ink)]">
                  <img
                    src={story.image}
                    alt={story.title}
                    className="size-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white">
                    <span className="rounded-full bg-black/60 px-3 py-1 font-bold backdrop-blur-md">
                      {story.source}
                    </span>
                    <span className="opacity-90">{story.readTime}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Summary & In-Depth Details */}
            <article className="mt-10 rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
              <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-6 sm:p-8 space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
                    Story Brief
                  </p>
                  <p className="mt-2 text-base sm:text-lg leading-7 sm:leading-8 text-[var(--ink)] font-normal">
                    {story.summary}
                  </p>
                </div>

                {story.contentAngle && (
                  <div className="rounded-2xl bg-[var(--paper)] p-4 ring-1 ring-black/5 dark:ring-white/5">
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
                      Strategic Angle & Question
                    </p>
                    <p className="mt-1.5 text-sm font-medium italic text-[var(--ink)]">
                      "{story.contentAngle}"
                    </p>
                  </div>
                )}

                {story.details && (
                  <div className="border-t border-black/[.06] dark:border-white/[.08] pt-5">
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
                      In-Depth Analysis & Context
                    </p>
                    <p className="mt-3 text-sm sm:text-base leading-7 text-[var(--ink)] font-normal">
                      {story.details}
                    </p>
                  </div>
                )}

                {Array.isArray(story.bulletPoints) && story.bulletPoints.length > 0 && (
                  <div className="border-t border-black/[.06] dark:border-white/[.08] pt-5">
                    <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
                      Key Takeaways & Industry Signal
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {story.bulletPoints.map((point, index) => (
                        <li key={index} className="flex items-start gap-2.5 text-xs sm:text-sm leading-6 text-[var(--ink)]">
                          <span className="mt-2 size-1.5 rounded-full bg-[var(--ink)] shrink-0 opacity-70" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>

            {/* Tags */}
            {Array.isArray(story.tags) && story.tags.length > 0 && (
              <div className="mt-10 flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)] mr-2">
                  <Tag size={13} />
                  <span>Tags:</span>
                </span>
                {story.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--muted)] ring-1 ring-black/5 dark:ring-white/10"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar / Aside (Sticky on desktop) */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-6">
            {/* Quick Metrics Card */}
            <div className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
              <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-black/[.07] dark:border-white/[.08] pb-4">
                  <span className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--muted)]">
                    Intelligence Overview
                  </span>
                  <ShieldCheck size={18} className="text-[#668c16]" />
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)] block">
                      Score Tier
                    </span>
                    <span className="mt-1 inline-flex items-center gap-2 font-bold text-[var(--ink)] text-sm">
                      <span className={`size-2 rounded-xs ${tier.squareClass}`} />
                      <span>{tier.label}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)] block">
                      Source Provenance
                    </span>
                    <span className="font-bold text-[var(--ink)]">
                      {sourceType}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)] block">
                      Publisher / Source
                    </span>
                    <span className="font-medium text-[var(--ink)]">
                      {story.source}
                    </span>
                  </div>

                  {story.sourceNote && (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)] block">
                        Source Note
                      </span>
                      <span className="text-[11px] text-[var(--muted)] italic leading-4 block mt-0.5">
                        {story.sourceNote}
                      </span>
                    </div>
                  )}

                  {story.author && (
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)] block">
                        Reported By
                      </span>
                      <span className="font-medium text-[var(--ink)]">
                        {story.author}
                      </span>
                    </div>
                  )}
                </div>

                {story.url && (
                  <div className="border-t border-black/[.07] dark:border-white/[.08] pt-4">
                    <a
                      href={story.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${primaryButton} w-full`}
                    >
                      <span>Read original source</span>
                      <span className="ml-auto grid size-7 place-items-center rounded-full bg-white/15">
                        <ArrowSquareOut size={13} />
                      </span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Up Next / Latest News in Sidebar with Natural Scroll */}
            {allUpNextStories.length > 0 && (
              <div className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5">
                <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-black/[.06] dark:border-white/[.08] pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)] block">
                        Up Next
                      </span>
                      <h3 className="text-base font-bold tracking-tight text-[var(--ink)]">
                        Latest News
                      </h3>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Live Feed</span>
                    </span>
                  </div>

                  <div className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1.5 space-y-3.5 divide-y divide-black/[.06] dark:divide-white/[.08] scroll-smooth overscroll-contain">
                    {allUpNextStories.map((item) => (
                      <Link
                        key={item.id}
                        to={`/tech-news/${item.id}`}
                        className="group block pt-3.5 first:pt-0 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-[#668c16]">
                                {item.category}
                              </span>
                              <span className="text-[9px] text-[var(--muted)]">·</span>
                              <span className="text-[9px] text-[var(--muted)]">{item.posted}</span>
                            </div>
                            <h4 className="text-xs font-semibold leading-snug text-[var(--ink)] line-clamp-2 transition-colors duration-300 group-hover:text-[#668c16]">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-2 pt-0.5">
                              <span className="text-[10px] text-[var(--muted)] truncate max-w-[110px]">
                                {item.source}
                              </span>
                              <span className={`inline-block size-1.5 rounded-full ${item.tier?.squareClass || 'bg-purple-500'}`} />
                              <span className="text-[9px] font-bold text-[var(--ink)]">{item.tier?.label}</span>
                            </div>
                          </div>

                          {item.image && (
                            <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--ink)] ring-1 ring-black/5">
                              <img
                                src={item.image}
                                alt={item.title}
                                className="size-full object-cover transition-transform duration-500 group-hover:scale-108"
                              />
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="border-t border-black/[.06] dark:border-white/[.08] pt-2 text-[10px] text-[var(--muted)] flex items-center justify-between">
                    <span>{allUpNextStories.length} stories available</span>
                    <ArrowUpRight size={12} />
                  </div>
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>
    </Shell>
  )
}
