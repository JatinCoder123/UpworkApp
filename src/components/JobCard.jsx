import { Link } from 'react-router-dom'
import { ArrowUpRight } from '@phosphor-icons/react'
import { StatusPill } from './ui'
import { scoreJob } from '../lib/scoring'

export default function JobCard({ job, layout = 'grid' }) {
  const fit = scoreJob(job)
  const isNew = job.status === 'New'
  const compact = layout === 'compact'
  const list = layout === 'list'

  return <article data-card className={`group relative overflow-hidden rounded-[1.6rem] p-1 transition-all duration-500 hover:-translate-y-0.5 ${isNew ? 'bg-[var(--new-border)] shadow-[0_14px_42px_var(--new-shadow)]' : 'bg-[var(--frame)] ring-1 ring-[var(--line)]/60'}`}>
    {isNew && <span className="absolute left-0 top-8 z-10 h-10 w-1 rounded-r-full bg-[var(--accent)]" />}
    <Link to={`/jobs/${job.id}`} className={`relative block h-full rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] ${list ? 'p-4 sm:grid sm:grid-cols-[minmax(0,1.65fr)_minmax(13rem,.7fr)_auto] sm:items-center sm:gap-7 sm:p-5' : compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className={list ? 'min-w-0' : ''}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`${compact ? 'size-9 rounded-xl' : 'size-11 rounded-2xl'} relative shrink-0 overflow-hidden bg-[var(--ink)] text-white`}>
              <img src={job.image} className="size-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-110" alt="" />
              <span className="absolute inset-0 grid place-items-center text-[10px] font-bold">{job.client}</span>
            </div>
            <div className="min-w-0"><p className="truncate text-xs font-bold">{job.company}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{job.location}</p></div>
          </div>
          {!list && <StatusPill status={job.status} />}
        </div>
        <h3 className={`${compact ? 'mt-5 text-sm sm:text-[.9375rem]' : list ? 'mt-4 text-base sm:text-[1.0625rem]' : 'mt-7 text-lg sm:text-xl'} font-semibold leading-[1.3] tracking-[-.025em] transition-colors duration-300 group-hover:text-[var(--accent-strong)]`}>{job.title}</h3>
        {!compact && <div className="mt-4 flex flex-wrap gap-2">{job.tags.slice(0, list ? 4 : undefined).map((tag) => <span key={tag} className="rounded-full bg-[var(--paper)] px-3 py-1.5 text-[10px] font-medium text-[var(--muted)]">{tag}</span>)}</div>}
      </div>
      <div className={`${list ? '' : compact ? 'mt-5' : 'mt-8 border-t border-[var(--line)]/70 pt-5'} flex items-end justify-between gap-4`}>
        <div className="rounded-xl bg-[var(--price-bg)] px-3 py-2 ring-1 ring-[var(--price-line)]"><p className={`${compact ? 'text-sm' : 'text-lg'} font-semibold tracking-[-.03em] text-[var(--price-text)]`}>{job.budget}</p><p className="mt-0.5 text-[9px] text-[var(--price-muted)]">{job.type} · {job.posted}</p></div>
        {list && <StatusPill status={job.status} />}
      </div>
      <div className={`${list ? 'mt-4 sm:mt-0' : compact ? 'mt-4 border-t border-[var(--line)]/60 pt-3' : 'absolute bottom-5 right-5'} flex items-center justify-between gap-3`}>
        <span className={list ? 'text-right' : ''}><span className="block text-[10px] font-bold text-[var(--accent-strong)]">{fit.score}% match</span>{!compact && <span className="mt-0.5 block text-[8px] text-[var(--muted)]">{fit.verdict}</span>}</span>
        <span className={`${compact ? 'size-8' : 'size-9'} grid place-items-center rounded-full bg-[var(--ink)] text-white transition-transform duration-500 group-hover:rotate-12`}><ArrowUpRight size={14} weight="light" /></span>
      </div>
    </Link>
  </article>
}
