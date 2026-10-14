import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock } from '@phosphor-icons/react'
import { StatusPill } from './ui'
import { scoreJob } from '../lib/scoring'
import { timeAgo, useNow } from '../lib/time'

export default function JobCard({ job, layout = 'grid' }) {
  const now = useNow()
  const fit = scoreJob(job)
  const postedAgo = timeAgo(job.postedAt, now) || job.posted
  const skills = job.skills?.length ? job.skills : job.tags
  const visibleSkills = skills.slice(0, 2)
  const remainingSkills = Math.max(0, skills.length - visibleSkills.length)
  const isNew = job.status === 'New'
  const compact = layout === 'compact'
  const list = layout === 'list'

  return <article data-card className={`group relative rounded-[1.6rem] p-1 transition-all duration-500 hover:z-30 hover:-translate-y-0.5 ${isNew ? 'bg-[var(--new-border)] shadow-[0_14px_42px_var(--new-shadow)]' : 'bg-[var(--frame)] ring-1 ring-[var(--line)]/60'}`}>
    {isNew && <span className="absolute left-0 top-8 z-10 h-10 w-1 rounded-r-full bg-[var(--accent)]" />}
    <Link to={`/jobs/${job.id}`} className={`relative block h-full rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] ${list ? 'p-4 sm:grid sm:grid-cols-[minmax(0,1.65fr)_minmax(13rem,.7fr)_auto] sm:items-center sm:gap-7 sm:p-5' : compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className={list ? 'min-w-0' : ''}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`${compact ? 'size-9 rounded-xl' : 'size-11 rounded-2xl'} relative shrink-0 overflow-hidden bg-[var(--ink)] text-white`}>
              <img src={job.image} className="size-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-110" alt="" />
              <span className="absolute inset-0 grid place-items-center text-[10px] font-bold">{job.client}</span>
            </div>
            <div className="min-w-0"><p className="truncate text-xs font-bold">{job.company}</p><p className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-[var(--muted)]"><span className="truncate">{job.location}</span><span aria-hidden="true">·</span><time dateTime={job.postedAt} title={job.posted} className="inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--accent-strong)]"><Clock size={11} weight="bold" />{postedAgo}</time></p></div>
          </div>
          {!list && <StatusPill status={job.status} />}
        </div>
        <h3 className={`${compact ? 'mt-5 text-sm sm:text-[.9375rem]' : list ? 'mt-4 text-base sm:text-[1.0625rem]' : 'mt-7 text-lg sm:text-xl'} font-semibold leading-[1.3] tracking-[-.025em] transition-colors duration-300 group-hover:text-[var(--accent-strong)]`}>{job.title}</h3>
        <div className={`${compact ? 'mt-3' : 'mt-4'} flex flex-wrap items-center gap-2`}>
          {visibleSkills.map((skill) => <span key={skill} className="max-w-36 truncate rounded-full bg-[var(--paper)] px-3 py-1.5 text-[10px] font-medium text-[var(--muted)]">{skill}</span>)}
          {remainingSkills > 0 && <span className="group/skills relative z-20">
            <span aria-label={`${remainingSkills} more skills`} className="grid h-6 min-w-7 place-items-center rounded-full bg-[var(--lime)]/35 px-2 text-[9px] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--lime-dark)]/25 transition-all duration-300 group-hover/skills:bg-[var(--lime)] group-hover/skills:text-[#26320b]">+{remainingSkills}</span>
            <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 mb-3 w-56 -translate-x-1/2 translate-y-2 rounded-2xl bg-[var(--ink)] p-2 text-white opacity-0 shadow-[0_22px_55px_rgba(20,28,21,.28)] ring-1 ring-white/10 transition-all duration-300 group-hover/skills:translate-y-0 group-hover/skills:opacity-100">
              <span className="block rounded-xl bg-white/[.06] px-3 py-2.5">
                <span className="block text-[8px] font-bold uppercase tracking-[.18em] text-white/45">All skills</span>
                <span className="mt-2 flex flex-wrap gap-1.5">{skills.map((skill) => <span key={skill} className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-medium text-white/80">{skill}</span>)}</span>
              </span>
              <span className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-[var(--ink)]" />
            </span>
          </span>}
        </div>
      </div>
      <div className={`${list ? '' : compact ? 'mt-5' : 'mt-8 border-t border-[var(--line)]/70 pt-5'} flex items-end justify-between gap-4`}>
        <div className="rounded-xl bg-[var(--price-bg)] px-3 py-2 ring-1 ring-[var(--price-line)]"><p className={`${compact ? 'text-sm' : 'text-lg'} font-semibold tracking-[-.03em] text-[var(--price-text)]`}>{job.budget}</p><p className="mt-0.5 text-[9px] text-[var(--price-muted)]">{job.type} · {job.level}</p></div>
        {list && <StatusPill status={job.status} />}
      </div>
      <div className={`${list ? 'mt-4 sm:mt-0' : compact ? 'mt-4 border-t border-[var(--line)]/60 pt-3' : 'absolute bottom-5 right-5'} flex items-center justify-between gap-3`}>
        <span className={list ? 'text-right' : ''}><span className="block text-[10px] font-bold text-[var(--accent-strong)]">{fit.score}% match</span>{!compact && <span className="mt-0.5 block text-[8px] text-[var(--muted)]">{fit.verdict}</span>}</span>
        <span className={`${compact ? 'size-8' : 'size-9'} grid place-items-center rounded-full bg-[var(--ink)] text-white transition-transform duration-500 group-hover:rotate-12`}><ArrowUpRight size={14} weight="light" /></span>
      </div>
    </Link>
  </article>
}
