import { Link } from 'react-router-dom'
import { ArrowUpRight } from '@phosphor-icons/react'
import { StatusPill } from './ui'
import { scoreJob } from '../lib/scoring'

export default function JobCard({ job }) {
  const fit = scoreJob(job)
  return <Link to={`/jobs/${job.id}`} data-card className="group block rounded-[1.8rem] bg-black/[.045] p-1.5 ring-1 ring-black/5 transition-all duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1 hover:bg-black/[.07]">
    <article className="relative overflow-hidden rounded-[calc(1.8rem-.375rem)] bg-[var(--surface)] p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,.9)] sm:p-6">
      <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="relative size-11 overflow-hidden rounded-2xl bg-[var(--ink)] text-white"><img src={job.image} className="size-full object-cover opacity-75 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-110" alt="" /><span className="absolute inset-0 grid place-items-center text-xs font-bold">{job.client}</span></div><div><p className="text-xs font-bold">{job.company}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{job.location}</p></div></div><StatusPill status={job.status} /></div>
      <h3 className="mt-7 text-xl font-semibold leading-[1.2] tracking-[-.035em] transition-colors duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:text-[#668c16] sm:text-2xl">{job.title}</h3>
      <div className="mt-4 flex flex-wrap gap-2">{job.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--ink)]/[.045] px-3 py-1.5 text-[10px] font-medium text-[var(--muted)]">{tag}</span>)}</div>
      <div className="mt-8 flex items-end justify-between border-t border-black/[.07] pt-5"><div><p className="text-lg font-semibold tracking-[-.03em]">{job.budget}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{job.type} · {job.posted}</p></div><div className="flex items-center gap-2"><span className="text-right"><span className="block text-[10px] font-bold text-[#587814]">{fit.score}% match</span><span className="mt-0.5 block text-[8px] text-[var(--muted)]">{fit.verdict}</span></span><span className="grid size-9 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)] group-hover:rotate-12"><ArrowUpRight size={14} weight="light" /></span></div></div>
    </article>
  </Link>
}
