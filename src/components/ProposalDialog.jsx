import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowSquareOut, CaretDown, CheckCircle, CircleNotch, Coins, FilePdf, PaperPlaneTilt, Plus, ShieldCheck, Trash, WarningCircle } from '@phosphor-icons/react'
import { DialogHeader, Modal, primaryButton } from './ui'
import { DURATIONS, RATE_INCREASE_MONTHS, fetchProposalForm, filledMilestones, filledProjects, markProposalApplied, proposalBody, sendProposal } from '../services/proposalApi'
import { refreshJobStatus } from '../lib/jobStatus'
import { useAuth } from '../contexts/AuthContext'
import { asArray, asObject, asText } from '../lib/safe'

const fieldLabel = 'mb-1.5 block text-[10px] font-bold uppercase tracking-[.14em] text-[var(--muted)]'
// index.css gives inputs, textareas and buttons `font: inherit` outside Tailwind's layers, which outranks text-* and
// font-* classes on them: fields inherit 16px (so selects use it too, and phones do not zoom into a field) and buttons
// mark their size with "!".
const inputClass = 'w-full min-w-0 rounded-xl bg-[var(--paper)] px-3.5 py-2.5 text-base text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--lime-dark)]'
const selectClass = `${inputClass} cursor-pointer appearance-none pr-9`
const addButton = 'inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-2 !text-xs !font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]'
const removeButton = 'grid size-10 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--bad-bg)] hover:text-[var(--bad)]'

let lastRowKey = 0
const rowKey = () => `row-${(lastRowKey += 1)}`
const emptyMilestone = () => ({ key: rowKey(), description: '', amount: '', dueDate: '' })
const today = () => new Date().toISOString().slice(0, 10)
const money = (value) => `$${Number(value).toLocaleString()}`

// The dialog's editable copy of the endpoint's form. The app's cover letter comes first: it is the one shown (and
// edited) on the job page.
function draftFrom({ job, form }, crmJob) {
  const rate = asObject(form.rate_increase)
  const questions = asArray(form.answers).length ? asArray(form.answers) : asArray(job.screening_questions)
  const milestones = asArray(form.milestones).map((row) => ({ ...emptyMilestone(), description: asText(row?.description), amount: asText(row?.amount), dueDate: asText(row?.due_date) }))
  return {
    job: asText(form.job || job.id || crmJob.url),
    recordId: asText(form.record_id),
    hourly: job.type ? job.type === 'hourly' : !('payment_type' in form),
    coverLetter: crmJob.coverLetter || asText(form.cover_letter),
    paymentType: form.payment_type === 'milestone' ? 'milestone' : 'project',
    amount: asText(form.amount),
    milestones: milestones.length ? milestones : [emptyMilestone()],
    duration: asText(form.estimated_duration),
    rateIncrease: { percent: asText(rate.percent), everyMonths: asText(rate.every_months) },
    answers: questions.map((item) => ({ question: typeof item === 'string' ? item : asText(item?.question), answer: typeof item === 'string' ? '' : asText(item?.answer) })),
    boost: asText(form.boost ?? 0),
    projects: [],
  }
}

// What still needs filling in before the proposal can be checked; the endpoint checks it all again.
function problemsOf(draft) {
  const problems = []
  const positive = (value) => Number(asText(value).trim()) > 0
  if (!draft.coverLetter.trim()) problems.push('Write a cover letter.')
  if (draft.hourly || draft.paymentType === 'project') {
    if (!positive(draft.amount)) problems.push(draft.hourly ? 'Enter your hourly rate.' : 'Enter your bid for the whole project.')
  } else {
    const rows = filledMilestones(draft)
    if (!rows.length) problems.push('Add at least one milestone.')
    else if (rows.some((row) => !row.description.trim() || !positive(row.amount) || !row.dueDate)) problems.push('Give every milestone a description, an amount and a due date.')
  }
  if (draft.hourly) {
    const percent = asText(draft.rateIncrease.percent).trim()
    if (Boolean(percent) !== Boolean(draft.rateIncrease.everyMonths)) problems.push('Fill in both parts of the rate increase, or leave both empty.')
    else if (percent && !(Number(percent) >= 1 && Number(percent) <= 100)) problems.push('The rate increase must be between 1% and 100%.')
  }
  if (draft.answers.some((item) => !item.answer.trim())) problems.push('Answer every screening question.')
  if (filledProjects(draft).some((row) => !row.title.trim())) problems.push('Give every project a title.')
  const boost = asText(draft.boost).trim()
  if (boost && !(Number.isInteger(Number(boost)) && Number(boost) >= 0)) problems.push('Boost must be a whole number of Connects (0 for none).')
  return problems
}

function budgetText(budget) {
  const { fixed_amount: fixed, hourly_min: min, hourly_max: max } = asObject(budget)
  if (fixed > 0) return `Client budget ${money(fixed)}`
  if (min > 0 && max > 0) return `Client range ${money(min)}–${money(max)}/hr`
  if (min > 0 || max > 0) return `Client rate ${money(max || min)}/hr`
  return 'No budget given'
}

// The first text under a key matching `pattern`, anywhere in `value`. The dry run's would_send carries the final cover
// letter (with the projects added) somewhere inside Upwork's request.
function findText(value, pattern, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 6) return ''
  for (const [key, item] of Object.entries(value)) {
    if (pattern.test(key) && typeof item === 'string' && item.trim()) return item
    const found = findText(item, pattern, depth + 1)
    if (found) return found
  }
  return ''
}

/**
 * Sends a proposal for a CRM job to Upwork from the app (see services/proposalApi). The form comes pre-filled from the
 * endpoint. "Check proposal" sends it as a dry run; only a form that passed that check, unchanged since, can then be
 * submitted for real, after a confirmation, because a real submit spends Connects. The job then becomes Applied.
 */
export default function ProposalDialog({ job, onClose }) {
  const [busy, setBusy] = useState(false)
  const form = useQuery({ queryKey: ['proposal-form', job.id], queryFn: () => fetchProposalForm(job), retry: false, refetchOnWindowFocus: false })
  // A proposal being submitted cannot be closed half-way.
  const close = busy ? () => {} : onClose

  return <Modal onClose={close} wide contained>
    <DialogHeader eyebrow="Send proposal" title="Apply from here" onClose={close} />
    {form.data
      ? <ProposalForm data={form.data} job={job} onBusy={setBusy} onClose={onClose} />
      : form.isError
        ? <>
          <p className="mt-6 text-sm leading-6 text-[var(--muted)]">This job could not be loaded from Upwork. It may be closed or removed.</p>
          <ErrorNote error={form.error} />
          <button type="button" onClick={() => form.refetch()} className={`${addButton} mt-4`}>Try again</button>
        </>
        : <p className="mt-8 flex items-center gap-2 text-sm text-[var(--muted)]"><CircleNotch size={16} className="animate-spin" />Loading the job from Upwork…</p>}
  </Modal>
}

function ProposalForm({ data, job, onBusy, onClose }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [draft, setDraft] = useState(() => draftFrom(data, job))
  const [tried, setTried] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const fields = asObject(data.fields)
  const durations = asArray(asObject(fields.estimated_duration).choices).length ? fields.estimated_duration.choices : DURATIONS
  const everyMonths = asArray(asObject(asObject(fields.rate_increase).choices).every_months).length ? fields.rate_increase.choices.every_months : RATE_INCREASE_MONTHS
  const pdfUrl = asText(job.pdfGeneration?.viewUrl)
  const problems = problemsOf(draft)

  const check = useMutation({ mutationFn: (body) => sendProposal(body) })
  const submit = useMutation({
    mutationFn: async (body) => {
      const result = await sendProposal(body)
      // The proposal is on Upwork now, so a failure to mark the job Applied here is shown with the result, not thrown.
      const marked = await markProposalApplied(job, user?.email).then((updated) => ({ updated }), (error) => ({ markError: error }))
      return { ...result, ...marked }
    },
    onMutate: () => onBusy(true),
    onSettled: () => { onBusy(false); setConfirming(false) },
    onSuccess: ({ updated }) => {
      if (updated) refreshJobStatus(queryClient, job.id, updated)
      else queryClient.invalidateQueries({ queryKey: ['job', job.id] })
    },
  })
  // A check counts only for the exact form it checked; any change asks for a new one.
  const checked = check.isSuccess && JSON.stringify(check.variables) === JSON.stringify(proposalBody(draft))

  const edit = (change) => setDraft((current) => ({ ...current, ...change }))
  const editRow = (list, key, change) => setDraft((current) => ({ ...current, [list]: current[list].map((row) => (row.key === key ? { ...row, ...change } : row)) }))
  const addRow = (list, row) => setDraft((current) => ({ ...current, [list]: [...current[list], row] }))
  const removeRow = (list, key) => setDraft((current) => ({ ...current, [list]: current[list].filter((row) => row.key !== key) }))
  const runCheck = () => {
    setTried(true)
    if (!problems.length) check.mutate(proposalBody(draft))
  }

  if (submit.isSuccess) return <Sent result={submit.data} job={job} onClose={onClose} />

  const milestoneTotal = filledMilestones(draft).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const finalLetter = checked ? findText(check.data?.wouldSend, /cover_?letter/i) : ''

  return <>
    <div className="mt-6 rounded-2xl bg-[var(--paper)] p-4 ring-1 ring-[var(--line)]">
      <p className="text-[10px] font-bold uppercase tracking-[.15em] text-[var(--muted)]">{draft.hourly ? 'Hourly job' : 'Fixed-price job'} · {budgetText(data.job.budget)}</p>
      <p className="mt-1 text-sm font-semibold">{asText(data.job.title) || job.title}</p>
    </div>
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-bg px-3.5 py-2.5 text-xs font-semibold leading-5 text-warning ring-1 ring-warning-line"><Coins size={15} weight="fill" className="mt-0.5 shrink-0 text-warning-icon" />Nothing goes to Upwork until you check the proposal and then submit it. Submitting sends it to the client and spends Connects.</p>

    <label className="mt-6 block"><span className={fieldLabel}>Cover letter</span>
      <textarea value={draft.coverLetter} onChange={(event) => edit({ coverLetter: event.target.value })} rows={10} className={`${inputClass} resize-y leading-6`} />
    </label>
    <p className="mt-1 text-[11px] text-[var(--muted)]">Taken from the job&apos;s cover letter. Changes here are sent with this proposal only.</p>

    {draft.hourly
      ? <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block"><span className={fieldLabel}>Your hourly rate (USD)</span>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.amount} onChange={(event) => edit({ amount: event.target.value })} className={inputClass} />
        </label>
        <div><span className={fieldLabel}>Rate increase · optional</span>
          <div className="flex gap-2">
            <label className="relative block w-24 shrink-0"><input type="number" min="1" max="100" step="1" inputMode="numeric" aria-label="Rate increase percent" placeholder="10" value={draft.rateIncrease.percent} onChange={(event) => edit({ rateIncrease: { ...draft.rateIncrease, percent: event.target.value } })} className={`${inputClass} pr-7`} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--muted)]">%</span></label>
            <Select label="Rate increase every" value={draft.rateIncrease.everyMonths} onChange={(value) => edit({ rateIncrease: { ...draft.rateIncrease, everyMonths: value } })}>
              <option value="">No increase</option>
              {everyMonths.map((months) => <option key={months} value={String(months)}>Every {months} months</option>)}
            </Select>
          </div>
        </div>
      </div>
      : <fieldset className="mt-6"><legend className={fieldLabel}>How do you want to be paid?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[['project', 'By project', 'One payment for the whole project'], ['milestone', 'By milestone', 'Split the project into parts']].map(([value, label, note]) => <button key={value} type="button" aria-pressed={draft.paymentType === value} onClick={() => edit({ paymentType: value })} className={`rounded-2xl p-3 text-left ring-1 transition-colors ${draft.paymentType === value ? 'bg-[var(--lime)] text-[var(--on-lime)] ring-[var(--lime-dark)]/50' : 'bg-[var(--paper)] text-[var(--ink)] ring-[var(--line)] hover:ring-[var(--lime-dark)]/60'}`}><span className="block text-xs font-bold">{label}</span><span className="mt-0.5 block text-[11px] opacity-75">{note}</span></button>)}
        </div>
        {draft.paymentType === 'project'
          ? <label className="mt-4 block sm:w-1/2"><span className={fieldLabel}>Your bid for the whole project (USD)</span>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={draft.amount} onChange={(event) => edit({ amount: event.target.value })} className={inputClass} />
          </label>
          : <div className="mt-4 space-y-2">
            {draft.milestones.map((row, index) => <div key={row.key} className="grid gap-2 rounded-2xl bg-[var(--paper)] p-2 ring-1 ring-[var(--line)] sm:grid-cols-[minmax(0,1fr)_7rem_10rem_auto] sm:items-center sm:bg-transparent sm:p-0 sm:ring-0">
              <input aria-label={`Milestone ${index + 1} description`} placeholder={`Milestone ${index + 1}, e.g. Diagnose the issue`} value={row.description} onChange={(event) => editRow('milestones', row.key, { description: event.target.value })} className={inputClass} />
              <span className="relative block"><span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-semibold text-[var(--muted)]">$</span><input type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Milestone ${index + 1} amount (USD)`} placeholder="Amount" value={row.amount} onChange={(event) => editRow('milestones', row.key, { amount: event.target.value })} className={`${inputClass} pl-7`} /></span>
              <input type="date" min={today()} aria-label={`Milestone ${index + 1} due date`} value={row.dueDate} onChange={(event) => editRow('milestones', row.key, { dueDate: event.target.value })} className={inputClass} />
              {/* A single milestone has no remove button, so it leaves no empty space on a phone. */}
              {draft.milestones.length > 1 && <button type="button" onClick={() => removeRow('milestones', row.key)} aria-label={`Remove milestone ${index + 1}`} className={`${removeButton} justify-self-end`}><Trash size={14} /></button>}
            </div>)}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => addRow('milestones', emptyMilestone())} className={addButton}><Plus size={12} weight="bold" />Add milestone</button>
              <p className="text-xs font-semibold text-[var(--muted)]">Total <b className="font-mono text-sm text-[var(--ink)]">{money(milestoneTotal)}</b></p>
            </div>
          </div>}
      </fieldset>}

    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <div><span className={fieldLabel}>How long will this project take?</span>
        <Select label="Estimated duration" value={draft.duration} onChange={(value) => edit({ duration: value })}>
          <option value="">Not set</option>
          {durations.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
        </Select>
      </div>
      <label className="block"><span className={fieldLabel}>Boost · extra Connects, optional</span>
        <input type="number" min="0" step="1" inputMode="numeric" value={draft.boost} onChange={(event) => edit({ boost: event.target.value })} className={inputClass} />
      </label>
    </div>

    {draft.answers.length > 0 && <div className="mt-6 space-y-4">
      <p className={fieldLabel}>Screening questions from the client</p>
      {draft.answers.map((item, index) => <label key={item.question || index} className="block">
        <span className="mb-1.5 block text-sm font-semibold">{index + 1}. {item.question}</span>
        <textarea rows={3} value={item.answer} onChange={(event) => edit({ answers: draft.answers.map((answer, at) => (at === index ? { ...answer, answer: event.target.value } : answer)) })} className={`${inputClass} resize-y leading-6`} />
      </label>)}
    </div>}

    <div className="mt-6">
      <p className={fieldLabel}>Relevant projects · optional</p>
      <p className="-mt-0.5 mb-2 text-[11px] text-[var(--muted)]">Added to the end of the cover letter, before the &quot;PS:&quot; line. Files cannot be attached yet, so share the PDF as a link here.</p>
      <div className="space-y-2">
        {draft.projects.map((row, index) => <div key={row.key} className="grid gap-2 rounded-2xl bg-[var(--paper)] p-2 ring-1 ring-[var(--line)] sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start">
          <input aria-label={`Project ${index + 1} title`} placeholder="Title" value={row.title} onChange={(event) => editRow('projects', row.key, { title: event.target.value })} className={`${inputClass} bg-[var(--surface)]`} />
          <div className="grid gap-2">
            <input type="url" aria-label={`Project ${index + 1} link`} placeholder="https://…" value={row.url} onChange={(event) => editRow('projects', row.key, { url: event.target.value })} className={`${inputClass} bg-[var(--surface)]`} />
            <input aria-label={`Project ${index + 1} description`} placeholder="One line on what it shows (optional)" value={row.description} onChange={(event) => editRow('projects', row.key, { description: event.target.value })} className={`${inputClass} bg-[var(--surface)]`} />
          </div>
          <button type="button" onClick={() => removeRow('projects', row.key)} aria-label={`Remove project ${index + 1}`} className={`${removeButton} justify-self-end`}><Trash size={14} /></button>
        </div>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => addRow('projects', { key: rowKey(), title: '', url: '', description: '' })} className={addButton}><Plus size={12} weight="bold" />Add project</button>
        {pdfUrl && !draft.projects.some((row) => row.url === pdfUrl) && <button type="button" onClick={() => addRow('projects', { key: rowKey(), title: 'Proposal PDF', url: pdfUrl, description: '' })} className={addButton}><FilePdf size={13} weight="bold" />Add this job&apos;s PDF link</button>}
      </div>
    </div>

    {tried && problems.length > 0 && <ul role="alert" className="mt-6 space-y-1 rounded-xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--bad)]">
      {problems.map((problem) => <li key={problem} className="flex gap-2"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{problem}</li>)}
    </ul>}
    {check.isError && !check.isPending && <ErrorNote error={check.error} />}
    {submit.isError && !submit.isPending && <ErrorNote error={submit.error} real />}

    {checked && <div className="mt-6 rounded-2xl bg-[var(--lime-tint)]/45 p-4 text-[var(--lime-ink)] ring-1 ring-[var(--lime-dark)]/25">
      <p className="flex items-center gap-2 text-xs font-bold"><CheckCircle size={16} weight="fill" />Checked: nothing is missing. Nothing has been sent yet.</p>
      {finalLetter && <details className="mt-3 text-xs"><summary className="cursor-pointer font-bold">The cover letter as the client will see it</summary><p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[var(--surface)] p-3 leading-5 text-[var(--ink)]">{finalLetter}</p></details>}
      <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold">Exactly what will be sent to Upwork</summary><pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[var(--surface)] p-3 font-mono text-[11px] leading-5 text-[var(--ink)]">{JSON.stringify(check.data?.wouldSend, null, 2)}</pre></details>
    </div>}

    {confirming && checked && <p role="alert" className="mt-6 rounded-2xl bg-warning-bg p-4 text-xs font-semibold leading-5 text-warning ring-1 ring-warning-line">
      Submit this proposal for real? It goes to the client on Upwork and spends Connects{Number(draft.boost) > 0 ? `, plus ${draft.boost} for the boost` : ''}. This cannot be undone.
    </p>}

    <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      <button type="button" onClick={confirming && checked ? () => setConfirming(false) : onClose} disabled={submit.isPending} className="rounded-full px-5 py-3 !text-xs !font-bold text-[var(--muted)] disabled:opacity-50">{confirming && checked ? 'Not yet' : 'Cancel'}</button>
      {!checked
        ? <button type="button" onClick={runCheck} disabled={check.isPending} className={primaryButton}>
          <span>{check.isPending ? 'Checking…' : 'Check proposal'}</span>
          <span className="grid size-8 place-items-center rounded-full bg-white/10">{check.isPending ? <CircleNotch size={14} className="animate-spin" /> : <ShieldCheck size={15} />}</span>
        </button>
        : <button type="button" onClick={() => (confirming ? submit.mutate(proposalBody(draft, { dryRun: false })) : setConfirming(true))} disabled={submit.isPending} className={`${primaryButton} bg-[var(--lime)] text-[var(--on-lime)]`}>
          <span>{submit.isPending ? 'Submitting…' : confirming ? 'Yes, submit it' : 'Submit proposal'}</span>
          <span className="grid size-8 place-items-center rounded-full bg-black/10">{submit.isPending ? <CircleNotch size={14} className="animate-spin" /> : <PaperPlaneTilt size={15} />}</span>
        </button>}
    </div>
  </>
}

function Select({ label, value, onChange, children }) {
  return <span className="relative block min-w-0 flex-1">
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>{children}</select>
    <CaretDown size={12} weight="bold" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
  </span>
}

// The endpoint's errors, one per line, with its hint. A real submit that got no answer may still have reached Upwork.
function ErrorNote({ error, real = false }) {
  const lines = asArray(error?.errors).length ? error.errors : [error?.message || 'Something went wrong. Please try again.']
  return <div role="alert" className="mt-5 space-y-1 rounded-xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--bad)]">
    {lines.map((line, index) => <p key={index} className="flex gap-2"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{line}</p>)}
    {error?.hint && <p className="font-medium opacity-80">{error.hint}</p>}
    {real && error?.code === 'PROPOSAL_UNREACHABLE' && <p className="font-medium opacity-80">The proposal may still have reached Upwork. Look at the job on Upwork before you submit it again.</p>}
  </div>
}

function Sent({ result, job, onClose }) {
  return <div className="mt-6">
    <div className="grid size-12 place-items-center rounded-2xl bg-[var(--lime-tint)]/65 text-[var(--lime-ink)]"><CheckCircle size={23} weight="fill" /></div>
    <h3 className="mt-5 text-2xl font-semibold tracking-[-.04em]">Proposal sent</h3>
    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{result.message || 'Your proposal is on Upwork.'}{result.proposalId && <> Proposal ID <span className="font-mono text-[var(--ink)]">{result.proposalId}</span>.</>}</p>
    {result.markError
      ? <p role="alert" className="mt-4 rounded-xl bg-warning-bg px-3.5 py-2.5 text-xs font-semibold leading-5 text-warning ring-1 ring-warning-line">The job could not be marked Applied in the app ({result.markError.message || 'please try again'}). The proposal itself was sent.</p>
      : <p className="mt-4 rounded-xl bg-[var(--paper)] px-3.5 py-2.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--line)]">The job is now Applied and in your Applied list.</p>}
    <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      {job.url && <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]">Open the job on Upwork<ArrowSquareOut size={13} weight="bold" /></a>}
      <button type="button" onClick={onClose} className={primaryButton}><span>Done</span><span className="grid size-8 place-items-center rounded-full bg-white/10"><CheckCircle size={15} /></span></button>
    </div>
  </div>
}
