import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CaretRight, CircleNotch, Clock, FloppyDisk, ListChecks, MagnifyingGlass, PencilSimple, Robot } from '@phosphor-icons/react'
import { DialogHeader, Modal } from './ui'
import { sectionLabel as label } from './SectionControls'
import { api } from '../services/api'
import { asArray } from '../lib/safe'
import { DESCRIPTION_PART, PROMPT_PARTS, describeSchedule } from '../lib/prompts'

/*
 * Prompt management (header): nearly full screen, three tabs, each a list beside the open item (the first one until
 * another is picked; on a phone, one at a time). Prompts: outr_machine_learning (system prompt, prompt, output prompt).
 * Guidelines: outr_guidelines. Prompt scheduler: outr_scheduler_prompts, the prompts the scheduler runs on their own
 * (prompt, description, on / off). Every text reads first; the pencil edits it and Save writes it to the CRM.
 */

const KEY = 'prompt-management'
const known = (value) => value && value !== '0'

const SECTIONS = [
  {
    id: 'prompts', label: 'Prompts', icon: Robot, noun: 'prompt',
    about: 'What the AI generators are told: each prompt has a system prompt, the prompt and the output prompt.',
    listKey: [KEY, 'prompts'], list: () => api.getPromptList(),
    detailKey: (id) => [KEY, 'prompt', id], get: (id) => api.getPrompt(id),
    meta: (item) => [item.type, item.stage, item.motive].filter(known).join(' · ') || 'No type',
    search: (item) => `${item.name} ${item.motive} ${item.type} ${item.stage}`,
    // Chips: the prompt types.
    chips: (items) => [...new Set(items.map((item) => item.type).filter(known))].sort(),
    chipOf: (item) => item.type,
    parts: (record) => [...PROMPT_PARTS, ...(record.description ? [DESCRIPTION_PART] : [])],
    save: (id, field, text) => api.savePromptPart(id, field, text),
  },
  {
    id: 'guidelines', label: 'Guidelines', icon: ListChecks, noun: 'guideline',
    about: 'The writing and coding rules the generators follow for each kind of content.',
    listKey: [KEY, 'guidelines'], list: () => api.getGuidelineList(),
    detailKey: (id) => [KEY, 'guideline', id], get: (id) => api.getGuideline(id),
    meta: (item) => (item.modifiedAt ? `Updated ${item.modifiedAt}` : ''),
    search: (item) => item.name,
    parts: () => [['text', 'Guidelines']],
    save: (id, field, text) => api.saveGuidelines(id, text),
  },
  {
    id: 'scheduler', label: 'Prompt scheduler', icon: Clock, noun: 'scheduled prompt',
    about: 'The prompts that run on their own every day to fill the feeds. Switch one off to pause it.',
    listKey: [KEY, 'scheduler'], list: () => api.getSchedulerPromptList(),
    detailKey: (id) => [KEY, 'scheduled', id], get: (id) => api.getSchedulerPrompt(id),
    meta: (item) => [describeSchedule(item.schedule), item.active ? 'Active' : 'Paused'].join(' · '),
    search: (item) => `${item.name} ${item.schedule}`,
    chips: () => ['Active', 'Paused'],
    chipOf: (item) => (item.active ? 'Active' : 'Paused'),
    parts: () => [['prompt', 'Prompt'], ['description', 'Description']],
    save: (id, field, text) => api.saveSchedulerPrompt(id, field, text),
  },
]

export default function PromptManagerDialog({ onClose }) {
  const [tab, setTab] = useState('prompts')
  const section = SECTIONS.find((entry) => entry.id === tab)
  const tabClass = (active) => `inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors ${active ? 'bg-[var(--ink)] text-white dark:bg-(--lime) dark:text-[#26320b]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`
  return <Modal onClose={onClose} full contained>
    <div className="flex h-full min-h-0 flex-col">
      <DialogHeader eyebrow="Prompt management" title={section.label} onClose={onClose} />
      <p className="mt-1.5 text-sm text-[var(--muted)]">{section.about}</p>
      <nav aria-label="Prompt management sections" className="mt-4 flex w-fit flex-wrap gap-1 rounded-full bg-[var(--paper)] p-1 text-xs font-semibold ring-1 ring-[var(--line)]/70">
        {SECTIONS.map(({ id, label: text, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} className={tabClass(tab === id)}><Icon size={14} weight="bold" />{text}</button>)}
      </nav>
      <ManagerSection key={tab} section={section} />
    </div>
  </Modal>
}

// One tab: search and chips over the list; the open item beside it (on a phone, instead of it).
function ManagerSection({ section }) {
  const [search, setSearch] = useState('')
  const [chip, setChip] = useState('')
  const [openId, setOpenId] = useState(null)
  const list = useQuery({ queryKey: section.listKey, queryFn: section.list, staleTime: 60_000 })
  const items = asArray(list.data)
  const chips = section.chips ? section.chips(items) : []
  const term = search.trim().toLowerCase()
  const shown = items.filter((item) => (!chip || section.chipOf(item) === chip) && (!term || section.search(item).toLowerCase().includes(term)))
  // Wide screens: the picked item, or the first one shown. Phones: the list until one is picked.
  const activeId = openId ?? shown[0]?.id ?? null
  const chipClass = (active) => `rounded-full px-3 py-1.5 ring-1 transition-colors ${active ? 'bg-[var(--ink)] text-white ring-transparent dark:bg-(--lime) dark:text-[#26320b]' : 'bg-[var(--surface)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)]'}`

  return <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
    <div className={`min-h-0 flex-col ${openId ? 'hidden lg:flex' : 'flex'}`}>
      <label className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--paper)] px-3.5 ring-1 ring-[var(--line)] focus-within:ring-[var(--lime-dark)]">
        <MagnifyingGlass size={15} className="shrink-0 text-[var(--muted)]" />
        <span className="flex-1 text-sm"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${section.label.toLowerCase()}`} aria-label={`Search ${section.label.toLowerCase()}`} className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]" /></span>
      </label>
      {chips.length > 0 && <div className="mt-2.5 flex shrink-0 flex-wrap gap-1.5 text-xs font-semibold">
        <button type="button" onClick={() => setChip('')} aria-pressed={!chip} className={chipClass(!chip)}>All {list.data ? items.length : ''}</button>
        {chips.map((value) => <button key={value} type="button" onClick={() => setChip(value)} aria-pressed={chip === value} className={chipClass(chip === value)}>{value} {items.filter((item) => section.chipOf(item) === value).length}</button>)}
      </div>}
      <ul className="mt-2.5 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain pb-1 pr-1">
        {list.isLoading
          ? [0, 1, 2, 3, 4].map((index) => <li key={index}><span className="block h-14 animate-pulse rounded-xl bg-[var(--line)]/50" /></li>)
          : list.isError
            ? <li role="alert" className="py-8 text-center text-sm font-semibold text-[var(--danger)]">{list.error?.message || 'They could not be loaded.'} <span className="text-xs"><button type="button" onClick={() => list.refetch()} className="underline">Retry</button></span></li>
            : shown.length
              ? shown.map((item) => <li key={item.id}>
                <button type="button" onClick={() => setOpenId(item.id)} aria-current={activeId === item.id} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors ${activeId === item.id ? 'bg-(--lime)/25 ring-[var(--lime-dark)]/40' : 'bg-[var(--surface)] ring-[var(--line)]/70 hover:ring-[var(--lime-dark)]'}`}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--lime)/30 text-[var(--accent-strong)]"><section.icon size={15} weight="bold" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{item.name}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{section.meta(item)}</span>
                  </span>
                  <CaretRight size={13} weight="bold" className="shrink-0 text-[var(--muted)]" />
                </button>
              </li>)
              : <li className="py-8 text-center text-sm text-[var(--muted)]">Nothing matches.</li>}
      </ul>
    </div>

    <div className={`min-h-0 overflow-y-auto overscroll-contain rounded-2xl bg-[var(--paper)]/60 ring-1 ring-[var(--line)]/70 ${openId ? 'block' : 'hidden lg:block'}`}>
      {activeId
        ? <ManagerDetail key={activeId} section={section} id={activeId} onBack={() => setOpenId(null)} />
        : <p className="grid h-full place-items-center p-8 text-center text-sm text-[var(--muted)]">{list.isLoading ? 'Loading…' : `No ${section.noun} to show.`}</p>}
    </div>
  </div>
}

function ManagerDetail({ section, id, onBack }) {
  const query = useQuery({ queryKey: section.detailKey(id), queryFn: () => section.get(id) })
  const record = query.data
  // After a save: this item, its list, and the prompts the AppScript section shows.
  const refreshKeys = [section.detailKey(id), section.listKey, ['generation-instructions']]
  return <div className="p-4 sm:p-5">
    <span className="text-xs font-bold lg:hidden"><button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"><ArrowLeft size={13} weight="bold" />All {section.label.toLowerCase()}</button></span>
    {query.isLoading
      ? <div className="grid gap-2">{[0, 1, 2].map((index) => <span key={index} className="block h-24 animate-pulse rounded-xl bg-[var(--line)]/50" />)}</div>
      : query.isError
        ? <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{query.error?.message || 'It could not be loaded.'} <span className="text-xs"><button type="button" onClick={() => query.refetch()} className="underline">Retry</button></span></p>
        : <>
          <h3 className="text-lg font-semibold tracking-[-.02em]">{record.name}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{section.meta(record)}</p>
          {section.id === 'scheduler' && <ScheduleStatus record={record} refreshKeys={refreshKeys} />}
          <div className="mt-3 grid gap-2">
            {section.parts(record).map(([field, title, hint]) => <EditableText key={field} title={title} hint={hint} value={record[field]} onSave={(text) => section.save(record.id, field, text)} refreshKeys={refreshKeys} tall />)}
          </div>
        </>}
  </div>
}

// A scheduled prompt's schedule and last run, and its on / off switch (saved in the CRM at once).
function ScheduleStatus({ record, refreshKeys }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: (active) => api.saveSchedulerPrompt(record.id, 'is_active', active),
    onSuccess: () => Promise.all(refreshKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
  const active = toggle.isPending ? toggle.variables : record.active
  return <div className="mt-3 rounded-xl bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold"><Clock size={14} weight="bold" className="text-[var(--accent-strong)]" />{describeSchedule(record.schedule)}</span>
      <span className="text-[var(--muted)]">Last run: {record.lastRunAgo || record.lastRunAt || 'not yet'}</span>
      {record.instance && <span className="text-[var(--muted)]">CRM: {record.instance}</span>}
      <span className="ml-auto text-xs font-bold"><button type="button" role="switch" aria-checked={active} disabled={toggle.isPending} onClick={() => toggle.mutate(!record.active)} className="inline-flex items-center gap-2 rounded-full px-1 py-1 disabled:opacity-60">
        <span className={`relative h-5 w-9 rounded-full transition-colors ${active ? 'bg-[var(--lime-dark)]' : 'bg-[var(--line)]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-all ${active ? 'left-[1.125rem]' : 'left-0.5'}`} /></span>
        {active ? 'Active' : 'Paused'}
      </button></span>
    </div>
    {toggle.isError && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger)]">{toggle.error?.message || 'It could not be saved.'}</p>}
  </div>
}

// One text from the CRM (a prompt part, guidelines, a schedule): shown as it is; the pencil opens it for editing and
// Save writes it, then the queries in refreshKeys read it again. `tall`: shown in full (in a pane that scrolls);
// `mono`: in the code font (JSON); `labelled`: the pencil reads "Edit".
export function EditableText({ title, hint = '', value, onSave, refreshKeys = [], tall = false, mono = false, labelled = false }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(null)
  const save = useMutation({
    mutationFn: (text) => onSave(text),
    onSuccess: async () => {
      await Promise.all(refreshKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      setDraft(null)
    },
  })
  return <section className="rounded-xl bg-[var(--paper)] p-3 ring-1 ring-[var(--line)]/70">
    <div className="flex items-center justify-between gap-2">
      <p className={label}>{title}</p>
      {draft === null && <span className="shrink-0 text-xs font-bold"><button type="button" onClick={() => { save.reset(); setDraft(value) }} aria-label={`Edit the ${title.toLowerCase()}`} title={`Edit the ${title.toLowerCase()}`} className={labelled ? 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]' : 'grid size-7 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-black/5 hover:text-[var(--ink)] dark:hover:bg-white/10'}><PencilSimple size={labelled ? 13 : 14} weight="bold" />{labelled && 'Edit'}</button></span>}
    </div>
    {hint && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</p>}
    {draft === null
      ? <p className={`mt-1 whitespace-pre-wrap text-[var(--ink)] [overflow-wrap:anywhere] ${mono ? 'font-mono text-xs leading-5' : 'text-[13px] leading-6'} ${tall ? '' : 'max-h-56 overflow-y-auto'}`}>{value || <span className="text-[var(--muted)]">Empty</span>}</p>
      : <form onSubmit={(event) => { event.preventDefault(); save.mutate(draft) }}>
        <div className="font-mono text-xs leading-5"><textarea autoFocus rows={tall ? 18 : 10} value={draft} onChange={(event) => setDraft(event.target.value)} aria-label={title} className="mt-1.5 w-full resize-y rounded-xl bg-[var(--surface)] px-3 py-2 text-[var(--ink)] outline-none ring-1 ring-[var(--line)] focus:ring-[var(--lime-dark)]" /></div>
        <div className="mt-2 flex items-center justify-end gap-2 text-xs font-bold">
          <button type="button" onClick={() => setDraft(null)} disabled={save.isPending} className="rounded-full px-3 py-1.5 text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          <button type="submit" disabled={save.isPending || draft === value} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--text)] px-3.5 py-1.5 text-[var(--paper)] transition-transform hover:-translate-y-0.5 disabled:opacity-50">
            {save.isPending ? <CircleNotch size={12} weight="bold" className="animate-spin" /> : <FloppyDisk size={12} weight="bold" />}{save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>}
    {save.isError && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger)]">{save.error?.message || 'It could not be saved.'}</p>}
  </section>
}
