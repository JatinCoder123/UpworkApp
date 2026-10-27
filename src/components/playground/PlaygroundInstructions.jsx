import { useState } from 'react'
import { CircleNotch } from '@phosphor-icons/react'
import { SelectMenu } from '../JobListControls'
import { PROMPT_PARTS } from '../../lib/prompts'
import { usePlaygroundInstructions } from '../../lib/playground'
import { asText } from '../../lib/safe'

/*
 * The saved prompt or guideline a test will use, read only: the prompt one part at a time from its dropdown (system
 * prompt, prompt, output prompt; a question only uses the system prompt), the guideline as its text. Changing them
 * for one test is done in "Customize this test"; for good, in Prompt manager.
 */
export default function PlaygroundInstructions({ show, promptName, guidelineName, isCustom }) {
  const [part, setPart] = useState(PROMPT_PARTS[0][0])
  const texts = usePlaygroundInstructions(show === 'prompt' ? promptName : '', show === 'guidelines' ? guidelineName : '')
  const parts = isCustom ? PROMPT_PARTS.slice(0, 1) : PROMPT_PARTS
  const name = show === 'prompt' ? promptName : guidelineName
  const text = show === 'prompt' ? asText(texts.data?.prompt?.[part]) : asText(texts.data?.guidelines?.text)
  const missing = show === 'prompt' ? !texts.data?.prompt : !texts.data?.guidelines

  return <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--paper)] ring-1 ring-[var(--line)]/70">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)]/60 px-4 py-2.5">
      <p className="min-w-0 truncate font-mono text-[11px] font-semibold text-[var(--ink)]">{name}</p>
      {show === 'prompt' && parts.length > 1 && <SelectMenu label="Prompt part" value={part} options={parts.map(([key, label]) => ({ id: key, label }))} onChange={setPart} align="right" onPaper />}
      {show === 'prompt' && parts.length === 1 && <span className="text-[11px] font-semibold text-[var(--muted)]">System prompt</span>}
    </div>
    <div className="max-h-72 overflow-y-auto px-4 py-3">
      {texts.isLoading
        ? <p className="flex items-center gap-2 text-xs text-[var(--muted)]"><CircleNotch size={14} className="animate-spin" />Loading…</p>
        : texts.error
          ? <p role="alert" className="text-xs font-semibold text-[var(--bad)]">It could not be loaded: {texts.error.message} <button type="button" onClick={() => texts.refetch()} className="underline">Try again</button></p>
          : missing
            ? <p className="text-xs text-[var(--muted)]">{show === 'prompt' ? 'This prompt is not in the CRM.' : 'There is no guideline with this name, so none is added.'}</p>
            : text.trim()
              ? <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--ink)] [overflow-wrap:anywhere]">{text}</p>
              : <p className="text-xs text-[var(--muted)]">This part is empty.</p>}
    </div>
    <p className="border-t border-[var(--line)]/60 px-4 py-2 text-[11px] text-[var(--muted)]">Read only. To try a different text for one test, use “Customize this test” below.</p>
  </div>
}
