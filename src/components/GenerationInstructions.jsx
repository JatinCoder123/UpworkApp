import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ListChecks, Robot } from '@phosphor-icons/react'
import { SelectMenu, ToggleChip } from './JobListControls'
import { EditableText } from './PromptManagerDialog'
import { api } from '../services/api'
import { PROMPT_PARTS } from '../lib/prompts'

/*
 * The prompt a generator uses (outr_machine_learning, by record name), one part at a time from the dropdown (system
 * prompt, prompt, output prompt), and its guidelines (outr_guidelines) behind their own button. Each reads first; the
 * pencil edits it and Save writes it to the CRM, so the next generation uses it. `toolbar` goes before the dropdown
 * (AppScript puts its output picker there). Fills its box: the text scrolls on its own.
 */
export default function GenerationInstructions({ promptName, guidelinesName, what = 'this', toolbar = null }) {
  const [part, setPart] = useState(PROMPT_PARTS[0][0])
  const [guidelines, setGuidelines] = useState(false)
  const query = useQuery({ queryKey: ['generation-instructions', promptName, guidelinesName], queryFn: () => api.getGenerationInstructions(promptName, guidelinesName), staleTime: 60_000 })
  const { prompt, guidelines: guide } = query.data || {}
  const [, title] = PROMPT_PARTS.find(([key]) => key === part)
  // After a save: these instructions, wherever they show, and Prompt management.
  const refreshKeys = [['generation-instructions'], ['prompt-management']]
  const missing = (text) => <p className="rounded-xl bg-[var(--surface)] p-4 text-xs text-[var(--muted)] ring-1 ring-[var(--line)]/70">There {text} for {what} in the CRM yet.</p>

  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-3">
      {toolbar}
      <SelectMenu label="Prompt" value={part} options={PROMPT_PARTS.map(([key, text]) => ({ id: key, label: text }))} onChange={(next) => { setPart(next); setGuidelines(false) }} icon={Robot} onPaper />
      <ToggleChip pressed={guidelines} onClick={() => setGuidelines((open) => !open)} icon={ListChecks} onPaper>Guidelines</ToggleChip>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
      {query.isLoading
        ? <span className="block h-40 animate-pulse rounded-xl bg-[var(--line)]/50" />
        : query.isError
          ? <p role="alert" className="text-xs font-semibold text-[var(--danger)]">{query.error?.message || 'They could not be loaded.'} <button type="button" onClick={() => query.refetch()} className="underline">Retry</button></p>
          : guidelines
            ? guide
              ? <EditableText key={`${guidelinesName}-guidelines`} tall title="Guidelines" value={guide.text} onSave={(text) => api.saveGuidelines(guide.id, text)} refreshKeys={refreshKeys} />
              : missing('are no guidelines')
            : prompt
              ? <EditableText key={`${promptName}-${part}`} tall title={title} value={prompt[part]} onSave={(text) => api.savePromptPart(prompt.id, part, text)} refreshKeys={refreshKeys} />
              : missing('is no prompt')}
    </div>
  </div>
}
