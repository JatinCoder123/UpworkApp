import { Link } from 'react-router-dom'
import { Briefcase, CheckCircle, Clock, Database, Hourglass, Lightning, MapPin, SealCheck, Sparkle, Users } from '@phosphor-icons/react'
import { JobCardActions, JobCardAside } from './JobCard'
import { previewClick } from '../lib/jobSignals'
import { timeAgo } from '../lib/time'
import { competition, isEarlyBird, minutesSince } from '../lib/liveJobs'
import { asArray, asObject, asText } from '../lib/safe'

// The left edge fades from lime to amber as a job ages across the scan window.
export function freshnessTone(minutes, windowMinutes) {
  const ratio = Math.min(1, minutes / Math.max(windowMinutes, 1))
  if (ratio < .34) return 'var(--lime-dark)'
  if (ratio < .67) return '#d9a53a'
  return 'var(--orange)'
}

export function CompetitionMeter({ applicants, compact = false }) {
  const level = competition(applicants)
  return <div>
    <div className="flex items-center justify-between text-[11px] font-bold"><span className="flex items-center gap-1 text-[var(--muted)]"><Users size={12} weight="bold" />{applicants} applicant{applicants === 1 ? '' : 's'}</span>{!compact && <span style={{ color: level.tone }}>{level.label}</span>}</div>
    <div className="live-meter mt-1.5 flex gap-1" style={{ '--meter': level.tone }} aria-label={`${level.label}: ${applicants} applicants`}>{[1, 2, 3, 4].map((step) => <span key={step} data-on={step <= level.level} />)}</div>
    {compact && <p className="mt-1.5 text-[11px] font-semibold" style={{ color: level.tone }}>{level.label}</p>}
  </div>
}

function Fact({ icon: Icon, children }) {
  if (!children) return null
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]"><Icon size={13} weight="bold" className="shrink-0 opacity-70" />{children}</span>
}

// `onSaveToCrm` adds a Save to CRM button; `crmSaved` swaps it for a "Saved to CRM" badge.
export default function LiveJobCard({ job, index, now, windowMinutes, justIn, applied, dismissed, onOpen, onSaveToCrm, crmSaved = false, crmSaving = false, crmError = '' }) {
  const minutes = minutesSince(job.postedAt, now)
  const tone = freshnessTone(minutes, windowMinutes)
  const matched = new Set(asArray(job.matchedSkills).map((skill) => asText(skill).toLowerCase()))
  const skills = [...asArray(job.skills)].sort((a, b) => matched.has(asText(b).toLowerCase()) - matched.has(asText(a).toLowerCase()))
  const visibleSkills = skills.slice(0, 6)
  const client = asObject(job.clientStats), tags = asArray(job.tags)
  const earlyBird = isEarlyBird(job, now)

  return <article id={`live-${job.id}`} data-card data-job-id={job.id} style={{ '--fresh': tone }} className={`live-card group scroll-mt-[calc(var(--shell-h)+1rem)] rounded-[1.6rem] bg-[var(--frame)] p-1 ring-1 ring-[var(--line)]/60 transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(30,40,25,.1)] ${justIn ? 'live-just-in' : ''}`}>
    <span aria-hidden="true" className="absolute inset-y-6 left-0 z-10 w-1 rounded-r-full" style={{ background: tone }} />
    <div className="relative grid overflow-hidden rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] md:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="relative min-w-0">
      <Link to={`/live-jobs/${job.id}`} onClick={previewClick(onOpen)} className="block min-w-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pr-20">
          {index != null && <span className="font-mono text-[11px] font-bold text-[var(--muted)]">{String(index + 1).padStart(2, '0')}</span>}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[#c8e875]"><span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#c8e875] opacity-70" /><span className="relative size-1.5 rounded-full bg-[#c8e875]" /></span>Live</span>
          {justIn && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lime)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#26320b]"><Sparkle size={11} weight="fill" />Just in</span>}
          {earlyBird && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--warn)]"><Lightning size={11} weight="fill" />Early bird</span>}
          {job.renewedAt && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Renewed</span>}
          <time dateTime={job.postedAt} className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: tone }}><Clock size={12} weight="bold" />{timeAgo(job.postedAt, now)}</time>
          {tags[1] && <span className="truncate text-[11px] font-medium text-[var(--muted)]">{tags[1]}</span>}
        </div>
        <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-.025em] transition-colors duration-300 group-hover:text-[var(--accent-strong)] sm:text-[1.2rem]">{job.title}</h3>
        <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-6 text-[var(--muted)]">{job.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <Fact icon={MapPin}>{client.country || 'Location not shared'}</Fact>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${client.paymentVerified ? 'bg-[var(--ok-bg)] text-[var(--ok)]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}><SealCheck size={11} weight="fill" />{client.paymentVerified ? 'Payment verified' : 'Payment unverified'}</span>
          <Fact icon={Briefcase}>{[client.jobsPosted != null && `${client.jobsPosted} jobs posted`, client.hires != null && `${client.hires} hires`].filter(Boolean).join(' · ') || 'New to Upwork'}</Fact>
          <Fact icon={Hourglass}>{job.workload}</Fact>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => <span key={skill} aria-pressed={matched.has(asText(skill).toLowerCase())} title={matched.has(asText(skill).toLowerCase()) ? 'Matched your search' : undefined} className="skill-tag max-w-44 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold">{skill}</span>)}
          {skills.length > visibleSkills.length && <span className="rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">+{skills.length - visibleSkills.length}</span>}
        </div>
        <div className="mt-4 max-w-md"><CompetitionMeter applicants={job.applicants} /></div>
      </Link>
      <JobCardActions job={job} />
      </div>

      <JobCardAside job={job} extra={<>
        {(applied || dismissed) && <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ${applied ? 'bg-[var(--lime)]/45 text-[#26320b]' : 'bg-[var(--bad-bg)] text-[var(--bad)]'}`}>{applied ? 'Applied' : 'Not a fit'}</span>}
        {onSaveToCrm && <div>
          {crmSaved
            ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ok-bg)] px-3 py-1.5 text-[11px] font-bold text-[var(--ok)] ring-1 ring-[var(--ok)]/30"><CheckCircle size={13} weight="fill" />Saved to CRM</span>
            : <button type="button" onClick={onSaveToCrm} disabled={crmSaving} title="Save this job to the CRM so it shows in the Jobs section" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)] disabled:opacity-60">
              {crmSaving ? <span className="size-3 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" /> : <Database size={13} weight="bold" />}
              {crmSaving ? 'Saving…' : 'Save to CRM'}
            </button>}
          {crmError && <p role="alert" className="mt-1.5 text-[11px] font-semibold text-[var(--bad)]">{crmError}</p>}
        </div>}
      </>} />
    </div>
  </article>
}
