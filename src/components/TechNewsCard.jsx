import { Link } from 'react-router-dom'
import { ArrowUpRight } from '@phosphor-icons/react'

export function SourceTypeBadge({ type }) {
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

export function ScoreBadge({ tier }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
      <span className={`size-2 rounded-xs ${tier?.squareClass || 'bg-purple-500'}`} />
      <span>{tier?.label || 'NORMAL'}</span>
    </span>
  )
}

export default function TechNewsCard({ story, layout = 'grid' }) {
  const isList = layout === 'list'
  const isCompact = layout === 'compact'
  const isHurry = Boolean(story.hurryUp)

  // 1. LIST VIEW ("point" / editorial row layout)
  if (isList) {
    return (
      <article
        data-card
        className="group relative overflow-hidden rounded-[1.6rem] bg-black/[.045] p-1.5 ring-1 ring-black/5 transition-all duration-500 hover:-translate-y-0.5 hover:bg-black/[.07]"
      >
        <div className="rounded-[calc(1.6rem-.375rem)] bg-[var(--surface)] p-4 sm:p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          {story.image && (
            <Link
              to={`/tech-news/${story.id}`}
              className="relative size-24 sm:size-28 shrink-0 overflow-hidden rounded-2xl bg-[var(--ink)] block"
            >
              <img
                src={story.image}
                alt={story.title}
                className="size-full object-cover opacity-85 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {story.readTime && (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                  {story.readTime}
                </span>
              )}
            </Link>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <SourceTypeBadge type={story.sourceType} />
              <ScoreBadge tier={story.tier} />
              {story.category && (
                <span className="rounded-full bg-[var(--paper)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                  {story.category}
                </span>
              )}
              <span className="text-[10px] font-medium text-[var(--muted)]">
                · {story.source} · {story.posted}
              </span>
            </div>

            <Link to={`/tech-news/${story.id}`} className="mt-2 block group/title">
              <h2 className="text-base sm:text-lg font-semibold leading-[1.3] tracking-[-.025em] text-[var(--ink)] transition-colors group-hover/title:text-[#668c16] line-clamp-2">
                {story.title}
              </h2>
            </Link>

            {story.summary && (
              <p className="mt-1 text-xs leading-5 text-[var(--muted)] line-clamp-2">
                {story.summary}
              </p>
            )}
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 self-stretch border-t sm:border-t-0 border-black/[.06] dark:border-white/[.08] pt-3 sm:pt-0">
            {isHurry && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span>HurryUp</span>
              </span>
            )}
            <Link
              to={`/tech-news/${story.id}`}
              className="size-9 grid place-items-center rounded-full bg-[var(--ink)] text-white transition-transform duration-500 group-hover:rotate-12 shadow-xs"
              aria-label="View story details"
            >
              <ArrowUpRight size={14} weight="light" />
            </Link>
          </div>
        </div>
      </article>
    )
  }

  // 2. COMPACT VIEW (dense fast-scan cards)
  if (isCompact) {
    return (
      <article
        data-card
        className="group relative overflow-hidden rounded-[1.4rem] bg-black/[.045] p-1 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-black/[.07]"
      >
        <div className="h-full rounded-[calc(1.4rem-.25rem)] bg-[var(--surface)] p-3.5 sm:p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <ScoreBadge tier={story.tier} />
              <span className="text-[10px] font-semibold text-[var(--muted)]">
                {story.posted}
              </span>
            </div>

            <Link to={`/tech-news/${story.id}`} className="mt-2.5 block group/title">
              <h3 className="text-sm font-semibold leading-snug tracking-[-.02em] text-[var(--ink)] transition-colors group-hover/title:text-[#668c16] line-clamp-3">
                {story.title}
              </h3>
            </Link>
          </div>

          <div className="mt-3.5 flex items-center justify-between border-t border-black/[.06] dark:border-white/[.08] pt-2.5 text-[11px] text-[var(--muted)]">
            <span className="font-bold uppercase tracking-wider text-[var(--ink)] truncate max-w-[130px]">
              {story.source}
            </span>
            <Link
              to={`/tech-news/${story.id}`}
              className="size-7 grid place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-300 group-hover:rotate-12"
              aria-label="View story"
            >
              <ArrowUpRight size={12} weight="light" />
            </Link>
          </div>
        </div>
      </article>
    )
  }

  // 3. GRID VIEW (default rich media card layout)
  return (
    <article
      data-card
      className="group flex flex-col overflow-hidden rounded-[1.8rem] bg-black/[.045] p-1.5 ring-1 ring-black/5 transition-all duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1 hover:bg-black/[.07]"
    >
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-[calc(1.8rem-.375rem)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,.9)] dark:shadow-none">
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

            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <SourceTypeBadge type={story.sourceType} />
              {isHurry && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] shadow-xs ring-1 ring-black/10 dark:ring-white/10">
                  <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>HurryUp</span>
                </span>
              )}
            </div>

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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[.06] dark:border-white/[.08] pb-3 text-xs">
            <ScoreBadge tier={story.tier} />
            <span className="text-[10px] font-semibold text-[var(--muted)]">
              {story.posted}
            </span>
          </div>

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

          <Link to={`/tech-news/${story.id}`} className="mt-3 block group/title">
            <h2 className="text-lg font-semibold leading-[1.3] tracking-[-.035em] text-[var(--ink)] transition-colors duration-300 group-hover/title:text-[#668c16] sm:text-xl">
              {story.title}
            </h2>
          </Link>

          <p className="mt-2.5 flex-1 text-xs leading-5 text-[var(--muted)] line-clamp-3">
            {story.summary}
          </p>

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
                  className="grid size-8 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-500 hover:rotate-12"
                >
                  <ArrowUpRight size={13} weight="light" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
