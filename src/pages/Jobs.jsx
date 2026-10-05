import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import gsap from 'gsap'
import { Briefcase, Funnel, MagnifyingGlass, Plus } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import JobCard from '../components/JobCard'
import { AddJobDialog, DateFilterDialog } from '../components/dialogs'
import { iconButton, primaryButton } from '../components/ui'
import { api } from '../mockApi'

const dateLabels = { all: 'Any time', today: 'Today', yesterday: 'Yesterday', '7days': 'Last 7 days', '30days': 'Last 30 days', lastMonth: 'Last month', custom: 'Custom time' }

function isInsideDateFilter(postedAt, filter) {
  if (filter.preset === 'all') return true
  const posted = new Date(postedAt), now = new Date()
  let start, end = now
  if (filter.preset === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (filter.preset === 'yesterday') { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1); end = new Date(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - 1) }
  if (filter.preset === '7days') start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (filter.preset === '30days') start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  if (filter.preset === 'lastMonth') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 1) }
  if (filter.preset === 'custom') { start = new Date(filter.from); end = new Date(filter.to) }
  return posted >= start && posted <= end
}

export default function Jobs() {
  const { data: jobs = [], isLoading } = useQuery({ queryKey: ['jobs'], queryFn: api.getJobs })
  const [tab, setTab] = useState('New'), [search, setSearch] = useState(''), [adding, setAdding] = useState(false), [skills, setSkills] = useState([]), [dateDialog, setDateDialog] = useState(false), [dateFilter, setDateFilter] = useState({ preset: 'all', from: '', to: '' })
  const root = useRef(null)
  const skillOptions = useMemo(() => [...new Set(jobs.flatMap((job) => job.tags))].sort(), [jobs])
  const quickSkills = useMemo(() => {
    const preferred = ['QA', 'SEO', 'React', 'Figma', 'Product design']
    const initial = preferred.filter((skill) => skillOptions.includes(skill))
    return [...new Set([...initial, ...skills.filter((skill) => !initial.includes(skill))])]
  }, [skillOptions, skills])
  const filtered = useMemo(() => jobs.filter((job) => job.status === tab && `${job.title} ${job.company} ${job.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()) && (!skills.length || skills.some((skill) => job.tags.includes(skill))) && isInsideDateFilter(job.postedAt, dateFilter)), [jobs, tab, search, skills, dateFilter])
  const toggleSkill = (skill) => setSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill])
  useEffect(() => { if (!isLoading) { const ctx = gsap.context(() => gsap.fromTo('[data-card]', { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .75, stagger: .08, ease: 'power3.out' }), root); return () => ctx.revert() } }, [tab, search, skills, dateFilter, isLoading])
  return <Shell><main ref={root} className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-14 sm:px-6 md:pt-20"><section className="grid items-end gap-8 lg:grid-cols-[1fr_auto]"><div><div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]"><span className="h-px w-7 bg-[var(--ink)]/25" />Opportunity desk</div><h1 className="max-w-4xl text-[clamp(3.5rem,7vw,7.5rem)] font-semibold leading-[.82] tracking-[-.085em]">The right work,<br /><span className="font-serif font-medium italic">in focus.</span></h1></div><div className="lg:pb-2"><p className="max-w-xs text-sm leading-6 text-[var(--muted)]">A quiet place to qualify the signal, write with care, and move at the right moment.</p><button onClick={() => setAdding(true)} className={`${primaryButton} mt-5`}><span>Add opportunity</span><span className="grid size-8 place-items-center rounded-full bg-white/10"><Plus size={15} /></span></button></div></section>
    <section className="mt-16 rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5"><div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] px-4 py-4 sm:px-6"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div className="flex gap-1 overflow-x-auto rounded-full bg-[var(--paper)] p-1">{['New', 'Applied', 'Rejected'].map((item) => <button key={item} onClick={() => setTab(item)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${tab === item ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)]'}`}>{item}<span className={`rounded-full px-2 py-0.5 text-[9px] ${tab === item ? 'bg-white/12' : 'bg-black/5'}`}>{jobs.filter((job) => job.status === item).length}</span></button>)}</div><div className="flex items-center gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[var(--paper)] px-4 py-2.5 md:w-64"><MagnifyingGlass size={15} className="text-[var(--muted)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search opportunities" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label><button onClick={() => setDateDialog(true)} aria-label="Open all filters" className={`${iconButton} ${dateFilter.preset !== 'all' || skills.length ? 'bg-[var(--lime)] !text-[#26320b] ring-2 ring-[var(--lime-dark)]/25' : ''}`}><Funnel size={16} /></button></div></div><div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[.06] pt-4"><span className="shrink-0 text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Skills</span><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">{quickSkills.map((skill) => <button key={skill} onClick={() => toggleSkill(skill)} aria-pressed={skills.includes(skill)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${skills.includes(skill) ? 'bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/30' : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>{skill}</button>)}<button onClick={() => setDateDialog(true)} className="shrink-0 rounded-full bg-transparent px-3 py-1.5 text-[10px] font-bold text-[var(--muted)] ring-1 ring-black/10 hover:text-[var(--ink)]">+ More skills</button></div>{dateFilter.preset !== 'all' && <button onClick={() => setDateDialog(true)} className="shrink-0 rounded-full bg-[#e1efbd] px-3 py-1.5 text-[10px] font-bold text-[#34420f]">{dateLabels[dateFilter.preset]}</button>}{(skills.length > 0 || dateFilter.preset !== 'all') && <button onClick={() => { setSkills([]); setDateFilter({ preset: 'all', from: '', to: '' }) }} className="shrink-0 text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear all</button>}</div></div></section>
    {isLoading ? <div className="py-24 text-center text-sm text-[var(--muted)]">Curating opportunities…</div> : filtered.length ? <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((job) => <JobCard key={job.id} job={job} />)}</section> : <section className="py-24 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--ink)]/5"><Briefcase size={22} /></div><h3 className="mt-5 text-xl font-semibold">No matching opportunities</h3><p className="mt-2 text-sm text-[var(--muted)]">Try another skill, time window, or search term.</p></section>}{adding && <AddJobDialog onClose={() => setAdding(false)} />}{dateDialog && <DateFilterDialog value={dateFilter} skills={skills} skillOptions={skillOptions} onClose={() => setDateDialog(false)} onApply={({ date, skills: nextSkills }) => { setDateFilter(date); setSkills(nextSkills); setDateDialog(false) }} />}</main></Shell>
}
