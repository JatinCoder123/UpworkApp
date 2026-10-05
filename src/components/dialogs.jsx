import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, CalendarBlank, CheckCircle, Copy, LinkSimple, PaperPlaneTilt, X } from '@phosphor-icons/react'
import { api } from '../mockApi'
import { coverLetterTemplate } from '../data'
import { DialogHeader, Modal, primaryButton } from './ui'

export function AddJobDialog({ onClose }) {
  const [url, setUrl] = useState('https://upwork.com/jobs/~01nora-ai-product?utm_source=email&utm_campaign=digest')
  const duplicate = useMutation({ mutationFn: api.checkDuplicate })
  return <Modal onClose={onClose}><DialogHeader eyebrow="Quick capture" title="Add an opportunity" onClose={onClose} /><p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">Paste an Upwork job URL. Tracking parameters are removed before the unique URL check.</p><label className="mt-8 block text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Job URL</label><div className="mt-2 flex rounded-2xl bg-[var(--paper)] p-2 ring-1 ring-black/5"><span className="grid size-10 place-items-center text-[var(--muted)]"><LinkSimple size={18} weight="light" /></span><input value={url} onChange={(event) => { setUrl(event.target.value); duplicate.reset() }} className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none" /></div>{duplicate.data && <div className={`mt-4 rounded-2xl p-4 text-xs ${duplicate.data.exists ? 'bg-[#f5d6cf] text-[#7f3025]' : 'bg-[var(--lime)]/45 text-[#34440e]'}`}><div className="flex items-center gap-2 font-bold">{duplicate.data.exists ? <Copy size={16} /> : <CheckCircle size={16} />} {duplicate.data.exists ? 'This opportunity already exists' : 'Unique URL — ready to import'}</div><p className="mt-2 break-all opacity-70">Cleaned: {duplicate.data.cleaned}</p></div>}<button onClick={() => duplicate.mutate(url)} disabled={!url || duplicate.isPending} className={`${primaryButton} mt-7 w-full`}><span>{duplicate.isPending ? 'Checking…' : 'Clean URL & check'}</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-white/10"><ArrowUpRight size={15} /></span></button></Modal>
}

export function ActionDialog({ type, job, onClose }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [reason, setReason] = useState('')
  const [letter, setLetter] = useState(coverLetterTemplate.replace('{company}', job.company))
  const apply = type === 'apply'
  const mutation = useMutation({ mutationFn: api.updateStatus, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['jobs'] }); queryClient.invalidateQueries({ queryKey: ['job', job.id] }); onClose(); navigate('/jobs') } })
  return <Modal onClose={onClose} wide={apply}><DialogHeader eyebrow={apply ? 'Final review' : 'Archive opportunity'} title={apply ? 'Ready to make your move?' : 'Why isn’t this a fit?'} onClose={onClose} /><div className="mt-7 rounded-2xl bg-[var(--paper)] p-4"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">{job.company}</p><p className="mt-1 text-sm font-semibold">{job.title}</p></div>{apply ? <><div className="mt-6 flex items-center justify-between"><label className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Cover letter</label><button onClick={() => navigator.clipboard?.writeText(letter)} className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]"><Copy size={13} />Copy</button></div><textarea value={letter} onChange={(event) => setLetter(event.target.value)} rows={12} className="mt-2 w-full resize-none rounded-2xl bg-[var(--paper)] p-5 text-sm leading-6 outline-none ring-1 ring-black/5 focus:ring-[var(--lime-dark)]" /></> : <><label className="mt-7 block text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">Rejection reason · required</label><textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={5} placeholder="e.g. Budget is below our project minimum…" className="mt-2 w-full resize-none rounded-2xl bg-[var(--paper)] p-4 text-sm outline-none ring-1 ring-black/5 focus:ring-[var(--danger)]" /><p className="mt-2 text-[10px] text-[var(--muted)]">This note is stored in the opportunity activity log.</p></>}
    <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={onClose} className="rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)]">Keep reviewing</button><button disabled={mutation.isPending || (!apply && !reason.trim())} onClick={() => mutation.mutate({ id: job.id, status: apply ? 'Applied' : 'Rejected', reason: reason.trim(), coverLetter: apply ? letter : undefined })} className={`${primaryButton} ${apply ? 'bg-[var(--lime)] text-[var(--ink)]' : 'bg-[var(--danger)]'}`}><span>{mutation.isPending ? 'Updating…' : apply ? 'Mark as applied' : 'Reject opportunity'}</span><span className="grid size-8 place-items-center rounded-full bg-black/10">{apply ? <PaperPlaneTilt size={15} /> : <X size={15} />}</span></button></div>
  </Modal>
}

export function DateFilterDialog({ value, skills, skillOptions, onApply, onClose }) {
  const [preset, setPreset] = useState(value.preset || 'all')
  const [from, setFrom] = useState(value.from || '')
  const [to, setTo] = useState(value.to || '')
  const [selectedSkills, setSelectedSkills] = useState(skills)
  const options = [
    ['all', 'Any time', 'Show the complete opportunity history'],
    ['today', 'Today', 'From midnight until now'],
    ['yesterday', 'Yesterday', 'The previous calendar day'],
    ['7days', 'Last 7 days', 'A rolling seven-day window'],
    ['30days', 'Last 30 days', 'A rolling thirty-day window'],
    ['lastMonth', 'Last month', 'The previous calendar month'],
    ['custom', 'Custom time', 'Choose exact start and end times'],
  ]
  const submit = () => { if (preset !== 'custom' || (from && to)) onApply({ date: { preset, from, to }, skills: selectedSkills }) }
  const toggleSkill = (skill) => setSelectedSkills((current) => current.includes(skill) ? current.filter((item) => item !== skill) : [...current, skill])
  return <Modal onClose={onClose} wide><DialogHeader eyebrow="Refine opportunities" title="Filter your job list" onClose={onClose} /><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Choose one or more skills and narrow results by the original posting time.</p><div className="mt-7 rounded-2xl bg-[var(--paper)] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">All skills</p>{selectedSkills.length > 0 && <button onClick={() => setSelectedSkills([])} className="text-[10px] font-bold text-[var(--muted)] hover:text-[var(--ink)]">Clear skills</button>}</div><div className="mt-3 flex flex-wrap gap-2">{skillOptions.map((skill) => <button key={skill} onClick={() => toggleSkill(skill)} className={`rounded-full px-3 py-2 text-[10px] font-semibold transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${selectedSkills.includes(skill) ? 'bg-[var(--lime)] !text-[#26320b] ring-1 ring-[var(--lime-dark)]/30' : 'bg-white text-[var(--muted)] ring-1 ring-black/5 hover:text-[var(--ink)]'}`}>{skill}</button>)}</div></div><p className="mt-7 text-[10px] font-bold uppercase tracking-[.17em] text-[var(--muted)]">Posted time</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{options.map(([id, label, note]) => <button key={id} onClick={() => setPreset(id)} className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 transition-all duration-500 ease-[cubic-bezier(.32,.72,0,1)] ${preset === id ? 'bg-[var(--lime)] !text-[#26320b] ring-[var(--lime-dark)]/50' : 'bg-[var(--paper)] text-[var(--ink)] ring-black/5 hover:ring-black/15'}`}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${preset === id ? 'bg-black/10' : 'bg-white'}`}><CalendarBlank size={16} weight="light" /></span><span><span className="block text-xs font-bold">{label}</span><span className={`mt-0.5 block text-[9px] ${preset === id ? 'text-[#536520]' : 'text-[var(--muted)]'}`}>{note}</span></span>{preset === id && <CheckCircle size={16} weight="fill" className="ml-auto" />}</button>)}</div>
    {preset === 'custom' && <div className="mt-5 grid gap-3 rounded-2xl bg-[var(--paper)] p-4 sm:grid-cols-2"><label className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">From<input type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-2 block w-full rounded-xl bg-white px-3 py-3 text-xs font-medium normal-case tracking-normal text-[var(--ink)] outline-none ring-1 ring-black/5 focus:ring-[var(--lime-dark)]" /></label><label className="text-[9px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">To<input type="datetime-local" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-2 block w-full rounded-xl bg-white px-3 py-3 text-xs font-medium normal-case tracking-normal text-[var(--ink)] outline-none ring-1 ring-black/5 focus:ring-[var(--lime-dark)]" /></label></div>}
    <button disabled={preset === 'custom' && (!from || !to)} onClick={submit} className={`${primaryButton} mt-7 w-full`}><span>Apply time filter</span><span className="ml-auto grid size-8 place-items-center rounded-full bg-white/10"><ArrowUpRight size={15} /></span></button>
  </Modal>
}
