import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Clock, PaperPlaneTilt, PlusCircle, Prohibit, ShieldCheck } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import Shell from '../components/Shell'
import { api } from '../mockApi'

const eventIcon = (text) => text.includes('Applied') || text.includes('application') ? PaperPlaneTilt : text.includes('Rejected') || text.includes('Reason') ? Prohibit : text.includes('Duplicate') ? ShieldCheck : PlusCircle

export default function Activity() {
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: api.getJobs })
  const events = jobs.flatMap((job) => job.activity.map((text, index) => ({ job, text, index }))).sort((a, b) => a.index - b.index)
  return <Shell><main className="mx-auto w-full max-w-[1200px] px-4 pb-24 pt-14 sm:px-6 md:pt-20"><div className="grid items-end gap-8 md:grid-cols-[1fr_auto]"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Workspace timeline</p><h1 className="mt-5 text-[clamp(3.5rem,7vw,7rem)] font-semibold leading-[.86] tracking-[-.08em]">Every move,<br /><span className="font-serif italic">on record.</span></h1></div><div className="flex items-center gap-2 pb-2 text-xs text-[var(--muted)]"><Clock size={16} /><span>{events.length} logged events</span></div></div>
    <section className="mt-16 rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5"><div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-4 sm:p-8">{isLoading ? <p className="py-16 text-center text-sm text-[var(--muted)]">Loading the timeline…</p> : <div className="divide-y divide-black/[.07]">{events.map(({ job, text, index }, eventIndex) => { const Icon = eventIcon(text); return <Link to={`/jobs/${job.id}`} key={`${job.id}-${text}-${index}`} className="group grid gap-4 py-5 first:pt-1 last:pb-1 sm:grid-cols-[3rem_1fr_auto] sm:items-center"><div className={`grid size-11 place-items-center rounded-2xl ${eventIndex < 2 ? 'bg-[var(--lime)]/60' : 'bg-[var(--paper)]'}`}><Icon size={18} weight="light" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{text}</p><span className="rounded-full bg-black/[.045] px-2 py-1 text-[9px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">{job.status}</span></div><p className="mt-1 text-xs text-[var(--muted)]">{job.company} · {job.title}</p></div><div className="flex items-center gap-3 text-[10px] text-[var(--muted)]"><span>{index === 0 ? 'Most recent' : `${index + 1} events ago`}</span><span className="grid size-8 place-items-center rounded-full bg-black/5 transition-transform duration-500 group-hover:rotate-12"><ArrowUpRight size={13} /></span></div></Link> })}</div>}</div></section></main></Shell>
}
