import { Link } from 'react-router-dom'
import { ArrowUpRight, X } from '@phosphor-icons/react'
import { StatusPill } from './ui'
import { scoreJob } from '../lib/scoring'

export default function JobCard({ job, onStatusChange }) {
  const fit = scoreJob(job)
  return <article data-card className="group overflow-hidden rounded-[1.8rem] bg-black/[.045] p-1.5 ring-1 ring-black/5 transition-all duration-700 ease-[cubic-bezier(.32,.72,0,1)] hover:-translate-y-1 hover:bg-black/[.07]">
    <div className="relative overflow-hidden rounded-[calc(1.8rem-.375rem)] bg-[var(--surface)] shadow-[inset_0_1px_1px_rgba(255,255,255,.9)]">
      <Link to={`/jobs/${job.id}`} className="block p-5 pb-4 sm:p-6 sm:pb-4">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="relative size-11 overflow-hidden rounded-2xl bg-[var(--ink)] text-white"><img src={job.image} className="size-full object-cover opacity-75 transition-transform duration-700 ease-[cubic-bezier(.32,.72,0,1)] group-hover:scale-110" alt="" /><span className="absolute inset-0 grid place-items-center text-xs font-bold">{job.client}</span></div><div><p className="text-xs font-bold">{job.company}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{job.location}</p></div></div><StatusPill status={job.status} /></div>
        <h3 className="mt-7 text-xl font-semibold leading-[1.2] tracking-[-.035em] transition-colors duration-500 group-hover:text-[#668c16] sm:text-2xl">{job.title}</h3>
        <div className="mt-4 flex flex-wrap gap-2">{job.tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--ink)]/[.045] px-3 py-1.5 text-[10px] font-medium text-[var(--muted)]">{tag}</span>)}</div>
        <div className="mt-8 flex items-end justify-between border-t border-black/[.07] pt-5"><div><p className="text-lg font-semibold tracking-[-.03em]">{job.budget}</p><p className="mt-1 text-[10px] text-[var(--muted)]">{job.type} · {job.posted}</p></div><div className="flex items-center gap-2"><span className="text-right"><span className="block text-[10px] font-bold text-[#587814]">{fit.score}% match</span><span className="mt-0.5 block text-[8px] text-[var(--muted)]">{fit.verdict}</span></span><span className="grid size-9 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform duration-500 group-hover:rotate-12"><ArrowUpRight size={14} weight="light" /></span></div></div>
      </Link>
      {!['Applied', 'Rejected'].includes(job.status) && <div className="absolute bottom-3 right-3 z-20 flex gap-2 rounded-full bg-[var(--surface)]/92 p-1.5 shadow-[0_10px_30px_rgba(30,32,25,.16)] ring-1 ring-black/5 backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] sm:translate-y-3 sm:opacity-0 sm:pointer-events-none sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100 sm:group-focus-within:pointer-events-auto">
        <button type="button" onClick={() => onStatusChange(job, 'Rejected')} className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[9px] font-bold text-[var(--danger)] ring-1 ring-[var(--danger)]/20 transition-all hover:bg-[#f5d6cf]/65 hover:ring-[var(--danger)]/30"><X size={12} weight="bold" />Reject</button>
      </div>}
    </div>
  </article>
}
