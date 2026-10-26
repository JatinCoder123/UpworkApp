import { useState } from 'react'
import { ArrowLeft, ArrowRight, Article, CaretDown, Check, CircleNotch, FileText, FloppyDisk, Hammer, Image, Plus, Rows, ShieldCheck, Sparkle, Timer, Trash, VideoCamera, WarningCircle, X } from '@phosphor-icons/react'
import { Modal, iconButton, primaryButton } from './ui'
import { sectionLabel } from './SectionControls'
import { useFeedDefinition, useFeedOptions, useSaveFeed } from '../lib/feeds'
import { describeSchedule } from '../lib/prompts'
import { asArray, asObject, asText } from '../lib/safe'

/*
 * "+ New feed" / "Edit feed": the feed is defined here and saved in the CRM (Auto Feed). Five parts, picked on the
 * left (a row of chips on a phone): the feed (label, module name, context), its fields, the documents it generates
 * (each with an optional prompt and guidelines; empty ones are written by Claude from the context), the roles that see
 * it and the scheduler prompt that fills it. "Save draft" keeps it; "Save & build" also makes the CRM module. Either
 * way the feed's page opens (onSaved), where the build is followed.
 */

const fieldLabel = 'text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]'
const inputClass = 'mt-1.5 w-full rounded-xl bg-[var(--paper)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--lime-dark)] read-only:opacity-70'
const hintClass = 'mt-1.5 text-[11px] leading-4 text-[var(--muted)]'

const TYPE_LABELS = { varchar: 'Short text', text: 'Long text', int: 'Whole number', decimal: 'Decimal', bool: 'Yes / No', date: 'Date', datetime: 'Date & time', url: 'Link', enum: 'Dropdown', multienum: 'Multi-select' }
const hasOptions = (type) => type === 'enum' || type === 'multienum'
const ACTIONS = {
  doc: ['Document', 'A written document for each record', FileText],
  blog: ['Blog post', 'A blog article from each record', Article],
  video: ['Video', 'A video script for each record', VideoCamera],
  image: ['Image', 'An image for each record', Image],
}
const ACCESS = { full: ['Full access', 'See, add, edit and delete'], no_delete: ['All except delete', 'See, add and edit'], read_only: ['Read only', 'Only see the records'] }
const SCHEDULES = [['0 6 * * *', 'Daily 06:00'], ['0 9 * * *', 'Daily 09:00'], ['0 9 * * 1-5', 'Weekdays 09:00'], ['0 9 * * 1', 'Mondays 09:00']]
const STEPS = [['feed', 'Feed', 'Name and what it is for', Sparkle], ['fields', 'Fields', 'What each record holds', Rows], ['actions', 'Generation', 'Documents it can make', Hammer], ['access', 'Access', 'Roles that see it', ShieldCheck], ['scheduler', 'Scheduler', 'When it fills itself', Timer]]

const MODULE_NAME = /^outr_[a-z0-9_]+$/
const FIELD_NAME = /^[a-z][a-z0-9_]*$/
// "Client Name" -> "client_name"
const snake = (text, max = 40) => asText(text).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, max)
let nextKey = 0
const newField = (field = {}) => {
  const options = field.options
  return {
    key: nextKey++,
    name: asText(field.name),
    label: asText(field.label),
    type: asText(field.type) || 'varchar',
    // A saved field's options come back as ["A", "B"] or { key: "Label" }: edited as "A, B".
    options: Array.isArray(options) ? options.join(', ') : typeof options === 'object' && options ? Object.values(options).join(', ') : asText(options),
    help: asText(field.help),
    required: Boolean(field.required),
    // A typed name is kept; until then it follows the label.
    named: Boolean(field.name),
  }
}

function formOf(definition) {
  const feed = asObject(definition)
  const prompts = asObject(feed.prompts)
  const guidelines = asObject(feed.guidelines)
  const actions = asArray(feed.actions).map(asText)
  return {
    id: asText(feed.id),
    built: feed.build_status === 'built',
    module_label: asText(feed.module_label),
    module_name: asText(feed.module_name),
    name: asText(feed.name),
    context: asText(feed.context),
    fields: feed.id ? asArray(feed.fields).map(newField) : [newField({ name: 'name', label: 'Title' }), newField()],
    actions,
    prompts: Object.fromEntries(Object.keys(ACTIONS).map((action) => {
      const prompt = asObject(prompts[action])
      return [action, { role_prompt: asText(prompt.role_prompt), prompt: asText(prompt.prompt), output_format: asText(prompt.output_format), guidelines: asText(guidelines[action]) }]
    })),
    roles: asArray(feed.roles).map(asText),
    role_access: asText(feed.role_access) || 'full',
    crm_instance: feed.id ? asText(feed.crm_instance) : 'upwork',
    schedule: asText(feed.schedule),
    create_scheduler_prompt: feed.id ? Boolean(feed.create_scheduler_prompt) : true,
    scheduler_guidelines: asText(guidelines.scheduler),
    // The module and feed names follow the label until typed.
    namedModule: Boolean(feed.module_name),
    namedFeed: Boolean(feed.name),
  }
}

// The entry point's JSON spec.
function specOf(form, build) {
  const fields = form.fields.filter((field) => field.name.trim() || field.label.trim())
  const guidelines = {}
  for (const action of form.actions) if (form.prompts[action].guidelines.trim()) guidelines[action] = form.prompts[action].guidelines
  if (form.scheduler_guidelines.trim()) guidelines.scheduler = form.scheduler_guidelines
  return {
    id: form.id,
    name: form.name.trim(),
    module_name: form.module_name.trim(),
    module_label: form.module_label.trim(),
    context: form.context,
    fields: fields.map(({ name, label, type, options, help, required }) => ({ name: name.trim(), label: label.trim(), type, options: hasOptions(type) ? options : '', help, required })),
    actions: form.actions,
    prompts: Object.fromEntries(form.actions.map((action) => {
      const { role_prompt, prompt, output_format } = form.prompts[action]
      return [action, { role_prompt, prompt, output_format }]
    })),
    guidelines,
    roles: form.roles,
    role_access: form.role_access,
    crm_instance: form.crm_instance.trim(),
    schedule: form.schedule.trim(),
    create_scheduler_prompt: form.create_scheduler_prompt,
    build,
  }
}

// What must be fixed before saving, per step: { feed: [...], fields: [...] }.
function problemsOf(form) {
  const problems = { feed: [], fields: [] }
  if (!form.module_label.trim()) problems.feed.push('Give the feed a label.')
  if (!MODULE_NAME.test(form.module_name.trim()) || form.module_name.trim().length > 40) problems.feed.push('The module name is lowercase, starts with outr_ and has only a-z, 0-9 and _ (up to 40 characters).')
  if (!form.name.trim()) problems.feed.push('Give the feed a name.')
  const fields = form.fields.filter((field) => field.name.trim() || field.label.trim())
  if (!fields.length) problems.fields.push('Add at least one field.')
  const seen = new Set()
  fields.forEach((field, index) => {
    const name = field.name.trim()
    const which = field.label.trim() || `Field ${index + 1}`
    if (!field.label.trim()) problems.fields.push(`Field ${index + 1} needs a label.`)
    if (!FIELD_NAME.test(name)) problems.fields.push(`${which}: the name is lowercase, starts with a letter and has only a-z, 0-9 and _.`)
    else if (seen.has(name)) problems.fields.push(`${which}: another field already has the name "${name}".`)
    seen.add(name)
    if (hasOptions(field.type) && !field.options.trim()) problems.fields.push(`${which}: a ${TYPE_LABELS[field.type].toLowerCase()} needs its options.`)
  })
  return problems
}

export default function NewFeedDialog({ feedId = '', onClose, onSaved }) {
  const definition = useFeedDefinition(feedId)
  const options = useFeedOptions()
  const ready = (!feedId || definition.isSuccess) && options.isSuccess
  const failed = definition.error || options.error

  return <Modal onClose={onClose} full contained>
    {ready
      ? <FeedBuilder key={feedId || 'new'} definition={feedId ? definition.data : null} options={options.data} onClose={onClose} onSaved={onSaved} />
      : <div className="flex h-full flex-col">
        <Header title={feedId ? 'Edit feed' : 'Create a new feed'} onClose={onClose} />
        {failed
          ? <p role="alert" className="mt-6 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">{failed.message || 'The feed could not be loaded.'} <button type="button" onClick={() => { definition.refetch(); options.refetch() }} className="ml-1 underline">Try again</button></p>
          : <div className="mt-6 grid flex-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]"><span className="hidden animate-pulse rounded-2xl bg-[var(--line)]/50 lg:block" /><span className="animate-pulse rounded-2xl bg-[var(--line)]/50" /></div>}
      </div>}
  </Modal>
}

function Header({ title, eyebrow = 'Feeds', onClose, children }) {
  return <header className="flex items-start gap-3">
    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--lime)] text-[#26320b]"><Rows size={20} weight="bold" /></span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">{eyebrow}</p>
      <h2 className="mt-1 truncate text-2xl font-semibold tracking-[-.04em]">{title}</h2>
    </div>
    {children}
    <button type="button" aria-label="Close dialog" onClick={onClose} className={iconButton}><X size={16} /></button>
  </header>
}

function FeedBuilder({ definition, options, onClose, onSaved }) {
  const [form, setForm] = useState(() => formOf(definition))
  const [step, setStep] = useState(STEPS[0][0])
  // Problems show once a save was tried, and then update as they are fixed.
  const [tried, setTried] = useState(false)
  const save = useSaveFeed()
  const update = (patch) => setForm((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }))
  const problems = problemsOf(form)
  const stepIndex = STEPS.findIndex(([key]) => key === step)
  const close = save.isPending ? () => {} : onClose

  const submit = (build) => {
    setTried(true)
    const first = STEPS.find(([key]) => problems[key]?.length)
    if (first) { setStep(first[0]); return }
    save.mutate(specOf(form, build), { onSuccess: ({ id }) => onSaved?.(id || form.id) })
  }

  const serverErrors = save.error ? (save.error.errors?.length ? save.error.errors : [save.error.message || 'The feed could not be saved.']) : []
  const shown = tried ? problems[step] || [] : []

  return <div className="flex h-full min-h-0 flex-col">
    <Header title={form.id ? form.module_label || 'Edit feed' : 'Create a new feed'} eyebrow={form.id ? 'Edit feed' : 'New feed'} onClose={close} />

    <div className="mt-5 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-1">
      <nav aria-label="Feed parts" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {STEPS.map(([key, text, about, Icon], index) => {
          const active = key === step
          const wrong = tried && problems[key]?.length > 0
          return <button key={key} type="button" onClick={() => setStep(key)} aria-current={active ? 'step' : undefined} className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition-colors lg:py-3 ${active ? 'bg-(--lime)/30 ring-[var(--lime-dark)]/45' : 'bg-[var(--paper)] ring-[var(--line)]/70 hover:ring-[var(--lime-dark)]/50'}`}>
            <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${active ? 'bg-[var(--lime)] text-[#26320b]' : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--line)]/70'}`}><Icon size={15} weight="bold" /></span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[var(--ink)]"><span className="hidden font-mono text-[10px] text-[var(--muted)] lg:inline">{index + 1}</span>{text}{wrong && <WarningCircle size={13} weight="fill" className="text-[var(--bad)]" aria-label="needs a fix" />}</span>
              <span className="hidden text-[11px] leading-4 text-[var(--muted)] lg:block">{stepSummary(key, form) || about}</span>
            </span>
          </button>
        })}
      </nav>

      <div className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          <div className="max-w-4xl pb-2">
            {shown.length > 0 && <ul role="alert" className="mb-4 space-y-1 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">{shown.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
            {step === 'feed' && <FeedStep form={form} update={update} />}
            {step === 'fields' && <FieldsStep form={form} update={update} types={options.fieldTypes} />}
            {step === 'actions' && <ActionsStep form={form} update={update} actions={options.actions} />}
            {step === 'access' && <AccessStep form={form} update={update} roles={options.roles} access={options.roleAccess} />}
            {step === 'scheduler' && <SchedulerStep form={form} update={update} />}
          </div>
        </div>

        <footer className="mt-3 border-t border-[var(--line)] pt-3">
          {serverErrors.length > 0 && <div role="alert" className="mb-3 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]"><p>The CRM did not save the feed:</p><ul className="mt-1 list-disc space-y-0.5 pl-4">{serverErrors.map((error) => <li key={error} className="whitespace-pre-wrap">{error}</li>)}</ul></div>}
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button type="button" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1][0])} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[var(--muted)] ring-1 ring-[var(--line)] transition-colors hover:text-[var(--ink)] disabled:opacity-40"><ArrowLeft size={13} weight="bold" />Back</button>
            {stepIndex < STEPS.length - 1 && <button type="button" onClick={() => setStep(STEPS[stepIndex + 1][0])} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><span>Next<span className="hidden sm:inline">: {STEPS[stepIndex + 1][1]}</span></span><ArrowRight size={13} weight="bold" /></button>}
            <span className="flex-1" />
            <button type="button" disabled={save.isPending} onClick={() => submit(false)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-4 py-2 text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)] disabled:opacity-50">{save.isPending && !save.variables?.build ? <CircleNotch size={13} className="animate-spin" /> : <FloppyDisk size={13} weight="bold" />}Save draft</button>
            <button type="button" disabled={save.isPending} onClick={() => submit(true)} className={primaryButton}>
              <span>{save.isPending && save.variables?.build ? 'Saving…' : form.built ? 'Save & rebuild' : 'Save & build'}</span>
              <span className="grid size-8 place-items-center rounded-full bg-white/10">{save.isPending && save.variables?.build ? <CircleNotch size={14} className="animate-spin" /> : <Hammer size={14} weight="bold" />}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  </div>
}

// The left list's line under each part, once it has something.
function stepSummary(step, form) {
  const fields = form.fields.filter((field) => field.label.trim()).length
  if (step === 'feed') return form.module_name ? form.module_name : ''
  if (step === 'fields') return fields ? `${fields} field${fields === 1 ? '' : 's'}` : ''
  if (step === 'actions') return form.actions.length ? form.actions.map((action) => ACTIONS[action]?.[0] || action).join(', ') : ''
  if (step === 'access') return form.roles.length ? `${form.roles.length} role${form.roles.length === 1 ? '' : 's'} · ${ACCESS[form.role_access]?.[0] || form.role_access}` : ''
  if (step === 'scheduler') return form.schedule ? describeSchedule(form.schedule) : ''
  return ''
}

function StepTitle({ title, children }) {
  return <div className="mb-5">
    <h3 className="text-lg font-semibold tracking-[-.02em] text-[var(--ink)]">{title}</h3>
    <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted)]">{children}</p>
  </div>
}

function FeedStep({ form, update }) {
  const setLabel = (label) => update((current) => ({
    module_label: label,
    // Built modules keep their name; otherwise it follows the label until typed.
    ...(!current.built && !current.namedModule ? { module_name: label.trim() ? `outr_${snake(label, 30)}` : '' } : {}),
    ...(!current.namedFeed ? { name: label.trim() ? `${label.trim()} feed` : '' } : {}),
  }))
  return <>
    <StepTitle title="The feed">What the feed is called in the CRM and what it is for. The context is what Claude reads to write the feed’s prompts, guidelines and scheduler prompt, so the more it says, the better they are.</StepTitle>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className={fieldLabel}>Label</span>
        <input value={form.module_label} onChange={(event) => setLabel(event.target.value)} autoFocus placeholder="e.g. Client Testimonials" className={inputClass} />
        <p className={hintClass}>The module’s name in the CRM menu and in the Feeds menu here.</p>
      </label>
      <label className="block"><span className={fieldLabel}>Module name</span>
        <input value={form.module_name} onChange={(event) => update({ module_name: event.target.value, namedModule: true })} readOnly={form.built} placeholder="outr_testimonials" className={`${inputClass} font-mono`} />
        <p className={hintClass}>{form.built ? 'The module is built, so its name stays.' : 'Lowercase, starts with outr_. It cannot change after the first build.'}</p>
      </label>
      <label className="block sm:col-span-2"><span className={fieldLabel}>Feed name</span>
        <input value={form.name} onChange={(event) => update({ name: event.target.value, namedFeed: true })} placeholder="e.g. Client Testimonials feed" className={inputClass} />
      </label>
      <label className="block sm:col-span-2"><span className={fieldLabel}>Context</span>
        <textarea value={form.context} onChange={(event) => update({ context: event.target.value })} rows={9} placeholder={'Goal: what the feed collects and why.\nEach record is: one …\nSources: where it comes from.\nScoring: how a record is rated (e.g. impact 0-100).'} className={`${inputClass} resize-y leading-6`} />
        <p className={hintClass}>Goal, data sources, what one record is, how it is scored, anything the team should know.</p>
      </label>
    </div>
  </>
}

function FieldsStep({ form, update, types }) {
  const setField = (key, patch) => update((current) => ({ fields: current.fields.map((field) => (field.key === key ? { ...field, ...patch } : field)) }))
  const setLabel = (field, label) => setField(field.key, { label, ...(!field.named ? { name: snake(label) } : {}) })
  const remove = (key) => update((current) => ({ fields: current.fields.filter((field) => field.key !== key) }))
  const add = () => update((current) => ({ fields: [...current.fields, newField()] }))
  return <>
    <StepTitle title="Fields">What each record of the feed holds. Every module also gets Name, Description and Assigned to; name a field <span className="font-mono">name</span> to relabel the title field.</StepTitle>
    <ol className="space-y-3">
      {form.fields.map((field, index) => <li key={field.key} className="rounded-2xl bg-[var(--paper)] p-3.5 ring-1 ring-[var(--line)]/70">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_10rem_auto] sm:items-start">
          <label className="block"><span className={fieldLabel}><span className="mr-1.5 font-mono">{index + 1}</span>Label</span>
            <input value={field.label} onChange={(event) => setLabel(field, event.target.value)} placeholder="e.g. Client Name" className={`${inputClass} bg-[var(--surface)]`} />
          </label>
          <label className="block"><span className={fieldLabel}>Name</span>
            <input value={field.name} onChange={(event) => setField(field.key, { name: event.target.value, named: true })} placeholder="client_name" className={`${inputClass} bg-[var(--surface)] font-mono`} />
          </label>
          <label className="block"><span className={fieldLabel}>Type</span>
            <span className="relative block">
              <select value={field.type} onChange={(event) => setField(field.key, { type: event.target.value })} className={`${inputClass} cursor-pointer appearance-none bg-[var(--surface)] pr-9`}>
                {types.map((type) => <option key={type} value={type}>{TYPE_LABELS[type] || type}</option>)}
              </select>
              <CaretDown size={13} weight="bold" className="pointer-events-none absolute right-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-[var(--muted)]" />
            </span>
          </label>
          <div className="flex items-center gap-2 text-xs font-bold sm:mt-[1.6rem]">
            <button type="button" role="switch" aria-checked={field.required} onClick={() => setField(field.key, { required: !field.required })} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 ring-1 transition-colors ${field.required ? 'bg-(--lime)/35 text-[var(--accent-strong)] ring-[var(--lime-dark)]/40' : 'text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)]'}`}>{field.required && <Check size={12} weight="bold" />}Required</button>
            <button type="button" onClick={() => remove(field.key)} aria-label={`Remove ${field.label || `field ${index + 1}`}`} className="grid size-9 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--bad-bg)] hover:text-[var(--bad)]"><Trash size={15} /></button>
          </div>
        </div>
        <div className={`mt-3 grid gap-3 ${hasOptions(field.type) ? 'sm:grid-cols-2' : ''}`}>
          {hasOptions(field.type) && <label className="block"><span className={fieldLabel}>Options</span>
            <input value={field.options} onChange={(event) => setField(field.key, { options: event.target.value })} placeholder="e.g. Website, LinkedIn, Upwork" className={`${inputClass} bg-[var(--surface)]`} />
            <p className={hintClass}>Separated by commas.</p>
          </label>}
          <label className="block"><span className={fieldLabel}>Help</span>
            <input value={field.help} onChange={(event) => setField(field.key, { help: event.target.value })} placeholder="e.g. 0-100, or the exact words of the client" className={`${inputClass} bg-[var(--surface)]`} />
          </label>
        </div>
      </li>)}
    </ol>
    <div className="mt-3 text-xs font-bold"><button type="button" onClick={add} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--line)] py-3 text-[var(--ink)] transition-colors hover:border-[var(--lime-dark)] hover:bg-(--lime)/10"><Plus size={14} weight="bold" />Add field</button></div>
  </>
}

function ActionsStep({ form, update, actions }) {
  const [open, setOpen] = useState('')
  const toggle = (action) => update((current) => ({ actions: current.actions.includes(action) ? current.actions.filter((item) => item !== action) : [...current.actions, action] }))
  const setPrompt = (action, patch) => update((current) => ({ prompts: { ...current.prompts, [action]: { ...current.prompts[action], ...patch } } }))
  return <>
    <StepTitle title="Generation">The documents the team can generate from a record. Each one adds a Generate checkbox, a suggestion, View and Download links and a status to every record. Its prompt and guidelines are optional: left empty, Claude writes them from the context.</StepTitle>
    <div className="grid gap-3 sm:grid-cols-2">
      {actions.map((action) => {
        const [text, about, Icon] = ACTIONS[action] || [action, '', Sparkle]
        const on = form.actions.includes(action)
        return <button key={action} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(action)} className={`flex items-center gap-3 rounded-2xl p-3.5 text-left ring-1 transition-colors ${on ? 'bg-(--lime)/25 ring-[var(--lime-dark)]/50' : 'bg-[var(--paper)] ring-[var(--line)]/70 hover:ring-[var(--lime-dark)]/50'}`}>
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${on ? 'bg-[var(--lime)] text-[#26320b]' : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--line)]/70'}`}><Icon size={18} weight="bold" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[var(--ink)]">Generate {text.toLowerCase()}</span><span className="block text-[11px] text-[var(--muted)]">{about}</span></span>
          <span className={`grid size-5 shrink-0 place-items-center rounded-md ring-1 ${on ? 'bg-[var(--ink)] text-[var(--surface)] ring-[var(--ink)]' : 'ring-[var(--line)]'}`}>{on && <Check size={12} weight="bold" />}</span>
        </button>
      })}
    </div>

    {form.actions.length > 0 && <div className="mt-6 space-y-3">
      <p className={sectionLabel}>Prompt &amp; guidelines (optional)</p>
      {form.actions.map((action) => {
        const prompt = form.prompts[action]
        const expanded = open === action
        const filled = ['role_prompt', 'prompt', 'output_format', 'guidelines'].filter((key) => prompt[key].trim()).length
        return <section key={action} className="rounded-2xl bg-[var(--paper)] ring-1 ring-[var(--line)]/70">
          <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? '' : action)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <span className="flex-1 text-[13px] font-semibold text-[var(--ink)]">Generate {(ACTIONS[action]?.[0] || action).toLowerCase()}</span>
            <span className="text-[11px] text-[var(--muted)]">{filled ? `${filled} of 4 written` : 'Claude writes them'}</span>
            <CaretDown size={13} weight="bold" className={`text-[var(--muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          {expanded && <div className="grid gap-3 border-t border-[var(--line)]/70 p-4">
            <PromptText label="System prompt" value={prompt.role_prompt} onChange={(role_prompt) => setPrompt(action, { role_prompt })} placeholder="Who the writer is and the rules it always keeps" />
            <PromptText label="Prompt" value={prompt.prompt} onChange={(text) => setPrompt(action, { prompt: text })} placeholder="The task for each record" hint="Placeholders: {{record}} {{title}} {{suggestion}} {{brand}} {{today}}" />
            <PromptText label="Output prompt" value={prompt.output_format} onChange={(output_format) => setPrompt(action, { output_format })} placeholder={`Empty uses the ${action} template`} mono />
            <PromptText label="Guidelines" value={prompt.guidelines} onChange={(guidelines) => setPrompt(action, { guidelines })} placeholder="The team’s rules for this document" />
          </div>}
        </section>
      })}
    </div>}
  </>
}

function PromptText({ label, value, onChange, placeholder, hint, mono = false }) {
  return <label className="block"><span className={fieldLabel}>{label}</span>
    <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} placeholder={placeholder} className={`${inputClass} resize-y bg-[var(--surface)] ${mono ? 'font-mono text-xs leading-5' : 'leading-6'}`} />
    {hint && <p className={`${hintClass} font-mono`}>{hint}</p>}
  </label>
}

function AccessStep({ form, update, roles, access }) {
  const toggle = (role) => update((current) => ({ roles: current.roles.includes(role) ? current.roles.filter((item) => item !== role) : [...current.roles, role] }))
  return <>
    <StepTitle title="Access">The CRM roles that get the new module, and what they may do with its records.</StepTitle>
    <p className={sectionLabel}>Roles</p>
    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
      {roles.map((role) => {
        const on = form.roles.includes(role)
        return <button key={role} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(role)} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 ring-1 transition-colors ${on ? 'bg-(--lime)/35 text-[var(--ink)] ring-[var(--lime-dark)]/50' : 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)]'}`}>{on && <Check size={12} weight="bold" />}{role}</button>
      })}
    </div>
    <p className={`${sectionLabel} mt-6`}>Access for these roles</p>
    <div role="radiogroup" className="mt-2 grid gap-2 sm:grid-cols-3">
      {access.map((value) => {
        const [text, about] = ACCESS[value] || [value, '']
        const on = form.role_access === value
        return <button key={value} type="button" role="radio" aria-checked={on} onClick={() => update({ role_access: value })} className={`rounded-2xl p-3.5 text-left ring-1 transition-colors ${on ? 'bg-(--lime)/25 ring-[var(--lime-dark)]/50' : 'bg-[var(--paper)] ring-[var(--line)]/70 hover:ring-[var(--lime-dark)]/50'}`}>
          <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]"><span className={`grid size-4 place-items-center rounded-full ring-1 ${on ? 'ring-[var(--ink)]' : 'ring-[var(--line)]'}`}>{on && <span className="size-2 rounded-full bg-[var(--ink)]" />}</span>{text}</span>
          <span className="mt-1 block pl-6 text-[11px] text-[var(--muted)]">{about}</span>
        </button>
      })}
    </div>
  </>
}

function SchedulerStep({ form, update }) {
  return <>
    <StepTitle title="Scheduler">When the scheduled agent fills the feed with new records. Claude writes its prompt from the context and saves it in Prompt scheduler.</StepTitle>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block"><span className={fieldLabel}>Schedule (cron)</span>
        <input value={form.schedule} onChange={(event) => update({ schedule: event.target.value })} placeholder="0 6 * * *" className={`${inputClass} font-mono`} />
        <p className={hintClass}>{describeSchedule(form.schedule)}</p>
      </label>
      <label className="block"><span className={fieldLabel}>CRM instance</span>
        <input value={form.crm_instance} onChange={(event) => update({ crm_instance: event.target.value })} placeholder="upwork" className={inputClass} />
      </label>
    </div>
    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
      {SCHEDULES.map(([cron, text]) => <button key={cron} type="button" onClick={() => update({ schedule: cron })} className={`rounded-full px-3 py-1.5 ring-1 transition-colors ${form.schedule === cron ? 'bg-(--lime)/35 text-[var(--ink)] ring-[var(--lime-dark)]/50' : 'text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)]'}`}>{text}</button>)}
    </div>
    <button type="button" role="switch" aria-checked={form.create_scheduler_prompt} onClick={() => update({ create_scheduler_prompt: !form.create_scheduler_prompt })} className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-[var(--paper)] p-3.5 text-left ring-1 ring-[var(--line)]/70">
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${form.create_scheduler_prompt ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow transition-all ${form.create_scheduler_prompt ? 'left-5' : 'left-1'}`} /></span>
      <span><span className="block text-[13px] font-semibold text-[var(--ink)]">Write the scheduler prompt</span><span className="block text-[11px] text-[var(--muted)]">Claude writes it on the build and saves it in Prompt scheduler</span></span>
    </button>
    <label className="mt-4 block"><span className={fieldLabel}>Scheduler guidelines (optional)</span>
      <textarea value={form.scheduler_guidelines} onChange={(event) => update({ scheduler_guidelines: event.target.value })} rows={4} placeholder="e.g. At most 10 new records per run. Never change a quote’s wording." className={`${inputClass} resize-y leading-6`} />
    </label>
  </>
}
