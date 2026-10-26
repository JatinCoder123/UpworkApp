import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BookOpenText, BracketsCurly, ListChecks, Robot, Target, X } from '@phosphor-icons/react'
import { Modal, iconButton } from './ui'
import { sectionLabel as label } from './SectionControls'
import { EditableText } from './PromptManagerDialog'
import { api } from '../services/api'

/*
 * A generator's prompt and guidelines in their own window (Site Content's writer: notes_blog and
 * notes_blog_guidelines). The parts are listed on the left, each with what it is for; the one picked reads on the
 * right at a comfortable width, with Edit to change it in the CRM. On a phone the parts are a row of chips on top.
 */
const PARTS = [
  ['role_prompt', 'System prompt', 'Who the writer is and the rules it always keeps', Robot],
  ['overwrite_prompt', 'Prompt', 'The task: what to write for each idea', Target],
  ['output_format', 'Output prompt', 'The exact shape of the answer it returns', BracketsCurly],
  ['guidelines', 'Guidelines', 'The team’s writing rules it follows', ListChecks],
]

export default function InstructionsDialog({ title, promptName, guidelinesName, onClose }) {
  const [part, setPart] = useState(PARTS[0][0])
  const query = useQuery({ queryKey: ['generation-instructions', promptName, guidelinesName], queryFn: () => api.getGenerationInstructions(promptName, guidelinesName), staleTime: 60_000 })
  const { prompt, guidelines } = query.data || {}
  const textOf = (key) => (key === 'guidelines' ? guidelines?.text : prompt?.[key]) || ''
  const record = part === 'guidelines' ? guidelines : prompt
  const [, partTitle, hint] = PARTS.find(([key]) => key === part)
  // After a save: these instructions wherever they show, and Prompt management.
  const refreshKeys = [['generation-instructions'], ['prompt-management']]
  const save = (text) => (part === 'guidelines' ? api.saveGuidelines(guidelines.id, text) : api.savePromptPart(prompt.id, part, text))

  return <Modal onClose={onClose} full contained>
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--lime)] text-[#26320b]"><BookOpenText size={20} weight="bold" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">Prompt &amp; guidelines</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-.04em]">{title}</h2>
        </div>
        <button type="button" aria-label="Close dialog" onClick={onClose} className={iconButton}><X size={16} /></button>
      </header>

      <div className="mt-5 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-1">
        <nav aria-label="Prompt and guidelines parts" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {PARTS.map(([key, text, about, Icon], index) => {
            const active = key === part
            const empty = query.isSuccess && !textOf(key)
            return <div key={key} className="contents">
              {index === 3 && <p className={`${label} hidden px-1 pt-2 lg:block`}>Guidelines</p>}
              {index === 0 && <p className={`${label} hidden px-1 lg:block`}>Prompt</p>}
              <button type="button" onClick={() => setPart(key)} aria-current={active ? 'true' : undefined} className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left ring-1 transition-colors lg:py-3 ${active ? 'bg-(--lime)/30 ring-[var(--lime-dark)]/45' : 'bg-[var(--paper)] ring-[var(--line)]/70 hover:ring-[var(--lime-dark)]/50'}`}>
                <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${active ? 'bg-[var(--lime)] text-[#26320b]' : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--line)]/70'}`}><Icon size={15} weight="bold" /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[var(--ink)]">{text}{empty && <span className="rounded-full bg-[var(--surface)] px-1.5 py-px text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]">Empty</span>}</span>
                  <span className="hidden text-[11px] leading-4 text-[var(--muted)] lg:block">{about}</span>
                </span>
              </button>
            </div>
          })}
        </nav>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          <div className="max-w-5xl">
            {query.isLoading
              ? <span className="block h-64 animate-pulse rounded-2xl bg-[var(--line)]/50" />
              : query.isError
                ? <p role="alert" className="text-sm font-semibold text-[var(--danger)]">{query.error?.message || 'They could not be loaded.'} <span className="text-xs"><button type="button" onClick={() => query.refetch()} className="underline">Retry</button></span></p>
                : record
                  ? <EditableText key={part} tall labelled mono={part === 'output_format'} title={partTitle} hint={hint} value={textOf(part)} onSave={save} refreshKeys={refreshKeys} />
                  : <p className="rounded-2xl bg-[var(--paper)] p-5 text-sm text-[var(--muted)] ring-1 ring-[var(--line)]/70">There {part === 'guidelines' ? 'are no guidelines' : 'is no prompt'} for {title} in the CRM yet.</p>}
          </div>
        </div>
      </div>
    </div>
  </Modal>
}
