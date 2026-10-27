import { useMemo, useState } from 'react'
import { CaretDown, CircleNotch, Lightbulb, ListChecks, PaperPlaneTilt, Robot, SlidersHorizontal, WarningCircle } from '@phosphor-icons/react'
import { ToggleChip } from '../JobListControls'
import PlaygroundInstructions from './PlaygroundInstructions'
import { ACTION_INFO, card, fieldLabel, helpText, inputClass } from './playgroundUi'
import { useAuth } from '../../contexts/AuthContext'
import { PLAYGROUND_ACTIONS, usePlaygroundExamples, usePlaygroundOptions, useRunTest } from '../../lib/playground'
import { asArray, asText } from '../../lib/safe'

/*
 * A new test, top to bottom: the type, what is needed, the prompt and guideline (Default when unsure; each can be
 * read before running), and, folded, the extras that apply to this test only (a name, an extra instruction, own
 * instructions or guidelines). `onRun` gets the test once the CRM has it.
 */

const EMPTY = { action: 'custom', text: '', title: '', promptId: '', guidelineId: '', suggestion: '', promptText: '', guidelinesText: '' }

// An example body (GET &action=example) as the form: an object requirement as "name: value" lines; placeholders such
// as "<id from options>" left out.
function fromExample(action, example) {
  const real = (value) => (typeof value === 'string' && !/^<.*>$/.test(value.trim()) ? value : '')
  const requirement = example?.requirement
  const text = requirement && typeof requirement === 'object'
    ? Object.entries(requirement).map(([name, value]) => `${name.replace(/_/g, ' ')}: ${asText(value)}`).join('\n')
    : asText(requirement)
  return { ...EMPTY, action, text, title: real(example?.title), promptId: real(example?.prompt_id), guidelineId: real(example?.guideline_id), suggestion: real(example?.suggestion), promptText: real(example?.prompt_text), guidelinesText: real(example?.guidelines_text) }
}

function FormStep({ number, title, aside, children }) {
  return <section className="border-t border-[var(--line)]/60 px-5 py-5 first:border-t-0 sm:px-6">
    <div className="flex items-center gap-2.5">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--text)] text-[11px] font-bold text-[var(--paper)]">{number}</span>
      <h2 className="min-w-0 flex-1 text-sm font-semibold text-[var(--ink)]">{title}</h2>
      {aside}
    </div>
    <div className="mt-3.5">{children}</div>
  </section>
}

export default function PlaygroundForm({ onRun }) {
  const { user } = useAuth()
  const options = usePlaygroundOptions()
  const examples = usePlaygroundExamples()
  const run = useRunTest()
  const [form, setForm] = useState(EMPTY)
  const [viewing, setViewing] = useState('')
  const [extras, setExtras] = useState(false)
  const [problem, setProblem] = useState('')
  const update = (patch) => { setProblem(''); setForm((current) => ({ ...current, ...patch })) }

  const actions = useMemo(() => {
    const offered = asArray(options.data?.actions)
    return offered.length ? PLAYGROUND_ACTIONS.filter((action) => offered.includes(action)) : PLAYGROUND_ACTIONS
  }, [options.data])
  const prompts = asArray(options.data?.prompts)
  const guidelines = asArray(options.data?.guidelines)
  const isCustom = form.action === 'custom'
  const [, about, buttonText, placeholder] = ACTION_INFO[form.action] || ACTION_INFO.custom
  // The prompt and guideline this test will use, by name: the ones picked, or the defaults.
  const defaultPrompt = asText(options.data?.defaultPrompts?.[form.action])
  const promptName = prompts.find((prompt) => prompt.id === form.promptId)?.name || (isCustom ? '' : defaultPrompt)
  const defaultGuideline = promptName ? `${promptName}_guidelines` : ''
  const guidelineName = guidelines.find((guideline) => guideline.id === form.guidelineId)?.name || defaultGuideline
  const example = examples.data?.[form.action]
  const extrasSet = [form.title, isCustom ? '' : form.suggestion, form.promptText, form.guidelinesText].filter((value) => asText(value).trim()).length

  const pickAction = (action) => { update({ action, promptId: '', guidelineId: '' }); setViewing('') }
  const fillExample = () => {
    setForm(fromExample(form.action, example))
    setProblem('')
    setViewing('')
    if (example?.suggestion || example?.prompt_text || example?.guidelines_text) setExtras(true)
  }
  const startOver = () => { setForm({ ...EMPTY, action: form.action }); setViewing(''); setProblem(''); run.reset() }

  const submit = (event) => {
    event?.preventDefault()
    if (run.isPending) return
    if (!form.text.trim()) {
      setProblem(isCustom ? 'Write your question first.' : 'Describe what you need first.')
      return
    }
    run.mutate({
      action: form.action,
      requirement: form.text.trim(),
      ...(form.title.trim() && { title: form.title.trim() }),
      ...(form.promptId && { prompt_id: form.promptId }),
      ...(form.guidelineId && { guideline_id: form.guidelineId }),
      ...(!isCustom && form.suggestion.trim() && { suggestion: form.suggestion.trim() }),
      ...(form.promptText.trim() && { prompt_text: form.promptText.trim() }),
      ...(form.guidelinesText.trim() && { guidelines_text: form.guidelinesText.trim() }),
      ...(user?.crmUserId && { user_id: user.crmUserId }),
    }, { onSuccess: onRun })
  }

  return <form onSubmit={submit} className={card}>
    <FormStep number="1" title="Choose what you want">
      <div role="radiogroup" aria-label="Choose what you want" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((action) => {
          const [text, what, , , Icon] = ACTION_INFO[action]
          const on = form.action === action
          return <button key={action} type="button" role="radio" aria-checked={on} onClick={() => pickAction(action)} className={`flex items-start gap-2.5 rounded-2xl p-3 text-left ring-1 transition-colors ${on ? 'bg-(--lime)/30 ring-2 ring-[var(--lime-dark)]' : 'bg-[var(--paper)] ring-[var(--line)]/70 hover:ring-[var(--lime-dark)]/60'}`}>
            <Icon size={18} weight={on ? 'fill' : 'bold'} className={`mt-0.5 shrink-0 ${on ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`} />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-[var(--ink)]">{text}</span>
              <span className="block text-[11px] leading-4 text-[var(--muted)]">{what}</span>
            </span>
          </button>
        })}
      </div>
    </FormStep>

    <FormStep number="2" title={isCustom ? 'Write your question' : 'Describe what you need'}
      aside={example && <span className="shrink-0 text-[11px] font-bold"><button type="button" onClick={fillExample} className="inline-flex items-center gap-1 text-[var(--accent-strong)] hover:underline"><Lightbulb size={13} weight="bold" />Use an example</button></span>}>
      <textarea value={form.text} onChange={(event) => update({ text: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit(event) }}
        rows={5} aria-label={isCustom ? 'Your question' : 'What you need'} placeholder={placeholder} className={`${inputClass} mt-0 resize-y leading-6`} />
      <p className={helpText}>{isCustom ? 'Claude answers in a few seconds.' : `${about}, made in the background; the result opens when it is ready.`} Ctrl + Enter runs it.</p>
    </FormStep>

    <FormStep number="3" title="Prompt and guideline" aside={<span className="text-[11px] font-semibold text-[var(--muted)]">Default is fine</span>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className={fieldLabel}>Prompt</span>
          <span className={helpText}>The saved instructions Claude follows.</span>
          <select value={form.promptId} onChange={(event) => update({ promptId: event.target.value })} disabled={options.isLoading} className={`${inputClass} cursor-pointer`}>
            <option value="">{options.isLoading ? 'Loading…' : isCustom ? 'None (just my question)' : `Default · ${defaultPrompt || 'standard'}`}</option>
            {prompts.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.name}</option>)}
          </select>
        </label>
        <label className="block"><span className={fieldLabel}>Guideline</span>
          <span className={helpText}>Extra rules added on top of the prompt.</span>
          <select value={form.guidelineId} onChange={(event) => update({ guidelineId: event.target.value })} disabled={options.isLoading} className={`${inputClass} cursor-pointer`}>
            <option value="">{options.isLoading ? 'Loading…' : defaultGuideline ? `Default · ${defaultGuideline}` : 'None'}</option>
            {guidelines.map((guideline) => <option key={guideline.id} value={guideline.id}>{guideline.name}</option>)}
          </select>
        </label>
      </div>
      {options.error && <p className="mt-2 text-[11px] font-semibold text-[var(--bad)]">The saved prompts could not be loaded ({options.error.message}); the defaults are used. <button type="button" onClick={() => options.refetch()} className="underline">Try again</button></p>}
      {(promptName || guidelineName) && <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-[var(--muted)]">Read:</span>
        {promptName && <ToggleChip pressed={viewing === 'prompt'} onClick={() => setViewing(viewing === 'prompt' ? '' : 'prompt')} icon={Robot}>Prompt</ToggleChip>}
        {guidelineName && <ToggleChip pressed={viewing === 'guidelines'} onClick={() => setViewing(viewing === 'guidelines' ? '' : 'guidelines')} icon={ListChecks}>Guideline</ToggleChip>}
      </div>}
      {viewing === 'prompt' && promptName && <PlaygroundInstructions key={`prompt-${promptName}`} show="prompt" promptName={promptName} isCustom={isCustom} />}
      {viewing === 'guidelines' && guidelineName && <PlaygroundInstructions key={`guidelines-${guidelineName}`} show="guidelines" guidelineName={guidelineName} />}
    </FormStep>

    <section className="border-t border-[var(--line)]/60 px-5 py-4 sm:px-6">
      <button type="button" aria-expanded={extras} onClick={() => setExtras(!extras)} className="flex w-full items-center gap-2.5 text-left">
        <SlidersHorizontal size={16} weight="bold" className="shrink-0 text-[var(--muted)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--ink)]">Customize this test <span className="font-normal text-[var(--muted)]">(optional)</span></span>
          <span className="block text-[11px] text-[var(--muted)]">A name, {isCustom ? '' : 'an extra instruction, '}or your own instructions. Only for this test; nothing saved changes.</span>
        </span>
        {extrasSet > 0 && <span className="shrink-0 rounded-full bg-(--lime)/40 px-2 py-0.5 text-[10px] font-bold text-[var(--ink)]">{extrasSet} set</span>}
        <CaretDown size={12} weight="bold" className={`shrink-0 text-[var(--muted)] transition-transform ${extras ? 'rotate-180' : ''}`} />
      </button>
      {extras && <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className={fieldLabel}>Test name</span>
            <span className={helpText}>To find it again in Recent tests.</span>
            <input value={form.title} onChange={(event) => update({ title: event.target.value })} placeholder="e.g. Invoice reminder brief" className={inputClass} />
          </label>
          {!isCustom && <label className="block"><span className={fieldLabel}>Extra instruction</span>
            <span className={helpText}>One more wish for this result.</span>
            <input value={form.suggestion} onChange={(event) => update({ suggestion: event.target.value })} placeholder="e.g. Add a short FAQ" className={inputClass} />
          </label>}
        </div>
        <label className="block"><span className={fieldLabel}>Your own instructions</span>
          <span className={helpText}>Replaces the saved prompt's instructions for this test, e.g. “You always reply only in French.”</span>
          <textarea value={form.promptText} onChange={(event) => update({ promptText: event.target.value })} rows={3} className={`${inputClass} resize-y leading-6`} />
        </label>
        <label className="block"><span className={fieldLabel}>Your own guidelines</span>
          <span className={helpText}>Replaces the guideline for this test, e.g. “Keep it under 1,000 words. Use UK English.”</span>
          <textarea value={form.guidelinesText} onChange={(event) => update({ guidelinesText: event.target.value })} rows={3} className={`${inputClass} resize-y leading-6`} />
        </label>
      </div>}
    </section>

    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)]/60 px-5 py-4 sm:px-6">
      {(problem || run.error) && <p role="alert" className="flex w-full items-start gap-2 whitespace-pre-line rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">
        <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />{problem || run.error.message}
      </p>}
      <span className="text-sm font-bold"><button type="submit" disabled={run.isPending} className="inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-6 py-3 text-[var(--paper)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50">
        {run.isPending ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : <PaperPlaneTilt size={16} weight="bold" />}
        {run.isPending ? (isCustom ? 'Asking Claude…' : 'Sending…') : buttonText}
      </button></span>
      {(form.text || extrasSet > 0 || form.promptId || form.guidelineId) && <span className="text-xs font-semibold"><button type="button" onClick={startOver} className="text-[var(--muted)] hover:text-[var(--ink)]">Start over</button></span>}
    </div>
  </form>
}
