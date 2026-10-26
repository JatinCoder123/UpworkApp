import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ArrowClockwise, BookOpenText, CheckCircle, CircleNotch, DownloadSimple, Eye, Hourglass, Quotes, Sparkle, WarningCircle, X } from '@phosphor-icons/react'
import LoginUrlPill from './LoginUrlPill'
import { FeedIndex } from './FeedParts'
import { sectionLabel as label } from './SectionControls'
import { isRunning, stageOf } from '../lib/generation'

/*
 * What AppScript and the feeds made with "+ New feed" share: an output's status chip, its row in the details
 * (Generate / Regenerate with a suggestion, View, Download), the steps while it is made, and the drawer an item opens
 * in (from the right, the page's items listed down its left).
 */

// Each stage's label, colours and icon (the spinner turns while the output is being made).
const STAGE_LOOK = {
  queued: ['Queued', 'bg-[#f6e8b8] text-[#655419] ring-[#e8d48a] dark:bg-[#383017] dark:text-[#e8c867] dark:ring-[#56491f]', Hourglass],
  processing: ['Generating', 'bg-(--lime)/40 text-[var(--ink)] ring-[var(--lime-dark)]/40', CircleNotch],
  completed: ['Ready', 'bg-[#dcf3e3] text-[#137333] ring-[#b7e1c3] dark:bg-[#163323] dark:text-[#81c995] dark:ring-[#2a5a3c]', CheckCircle],
  failed: ['Failed', 'bg-[#fde2e1] text-[#b42318] ring-[#f7c1bd] dark:bg-[#3d1a18] dark:text-[#fca5a0] dark:ring-[#6b2a25]', WarningCircle],
}
// The steps shown while an output is made.
const STEPS = [['queued', 'Queued'], ['processing', 'Generating'], ['completed', 'Ready']]

/** A stage as a small coloured chip (a card's line of outputs and each output's header in the details). */
export function StageChip({ icon: Icon, name, stage }) {
  const [text, tone, StageIcon] = STAGE_LOOK[stage]
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}>
    {Icon && <Icon size={11} weight="bold" />}{name ? `${name} · ${text}` : text}
    <StageIcon size={11} weight={stage === 'processing' ? 'bold' : 'fill'} className={stage === 'processing' ? 'animate-spin' : stage === 'queued' ? 'animate-pulse' : ''} />
  </span>
}

/**
 * One output in the details, on one line: name and status, then Prompt & guidelines, View and Download (when ready)
 * and Generate (Regenerate once it has a status). Generate opens the suggestion box, prefilled with the last
 * suggestion; Start saves it (`generate`, a useGenerateOutput mutation) and the output shows its steps while it is made.
 * `published`: a ready output is published on the sites, so their login is offered too.
 */
export function OutputRow({ output, type, icon: Icon, name, short, example, panelOpen, onPanel, generate, published = false }) {
  const stage = stageOf(output)
  const running = isRunning(stage)
  // The suggestion being written; null while the box is closed.
  const [draft, setDraft] = useState(null)
  const start = (event) => {
    event.preventDefault()
    const text = draft
    setDraft(null)
    // If it cannot be saved, the box opens again with what was written.
    generate.mutate(text, { onError: () => setDraft(text) })
  }
  const pill = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors'

  return <div data-output={type} className="rounded-xl bg-[var(--surface)] p-3 ring-1 ring-[var(--line)]/70">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {/* The name never shrinks: when the buttons do not fit beside it, they go to the next line. */}
      <span className="flex min-w-fit flex-1 items-center gap-2.5">
        <Icon size={16} weight="bold" className={`shrink-0 ${stage === 'idle' ? 'text-[var(--muted)]' : 'text-[var(--accent-strong)]'}`} />
        <span className="whitespace-nowrap text-[13px] font-semibold">{name}</span>
        {stage !== 'idle' && <span key={stage} className="shrink-0 animate-[domain-chip-in_.35s_ease-out]"><StageChip stage={stage} /></span>}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
        <button type="button" onClick={onPanel} aria-pressed={panelOpen} title={panelOpen ? 'Close the prompt and guidelines' : 'Open the prompt and guidelines beside the details'} className={`${pill} ring-1 ${panelOpen ? 'bg-(--lime)/35 text-[var(--ink)] ring-[var(--lime-dark)]/40' : 'text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}><BookOpenText size={13} weight="bold" />Prompt &amp; guidelines</button>
        {stage === 'completed' && output.viewUrl && <a href={output.viewUrl} target="_blank" rel="noreferrer" className={`${pill} bg-[var(--lime)] text-[#26320b] hover:-translate-y-0.5`}><Eye size={13} weight="bold" />View</a>}
        {stage === 'completed' && output.downloadUrl && <a href={output.downloadUrl} target="_blank" rel="noreferrer" className={`${pill} bg-[var(--paper)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)]`}><DownloadSimple size={13} weight="bold" />Download</a>}
        {stage === 'completed' && published && <LoginUrlPill />}
        {!running && draft === null && <button type="button" onClick={() => { generate.reset(); setDraft(output?.suggestion || '') }} className={`${pill} ${stage === 'idle' ? 'bg-[var(--text)] text-[var(--paper)] hover:-translate-y-0.5' : 'bg-[var(--paper)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)]'}`}>
          {stage === 'idle' ? <><Sparkle size={12} weight="fill" />Generate</> : <><ArrowClockwise size={12} weight="bold" />Regenerate</>}
        </button>}
      </div>
    </div>

    {running && <GenerateProgress stage={stage} name={short.toLowerCase()} />}
    {stage !== 'idle' && output?.suggestion && draft === null && <p className="mt-2 flex gap-1.5 text-xs leading-5 text-[var(--muted)]"><Quotes size={12} weight="fill" className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{output.suggestion}</span></p>}
    {stage === 'failed' && draft === null && <p className="mt-2 text-xs font-semibold text-[var(--danger)]">It could not be made this time. Regenerate it, maybe with another suggestion.</p>}

    {draft !== null && <form onSubmit={start} className="mt-3">
      <label className="block">
        <span className={label}>Your suggestion (optional)</span>
        <span className="block text-[13px] leading-5"><textarea autoFocus rows={3} maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={example} className="mt-1.5 w-full resize-y rounded-xl bg-[var(--paper)] px-3 py-2 text-[var(--ink)] outline-none ring-1 ring-[var(--line)] placeholder:text-[var(--muted)] focus:ring-[var(--lime-dark)]" /></span>
      </label>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs font-bold">
        <button type="button" onClick={() => setDraft(null)} className="rounded-full px-3 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
        <span className="text-xs font-bold"><button type="submit" className={`${pill} bg-[var(--text)] text-[var(--paper)] hover:-translate-y-0.5`}><Sparkle size={12} weight="fill" />{stage === 'idle' ? 'Start generating' : 'Start regenerating'}</button></span>
      </div>
    </form>}
    {generate.isError && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--danger)]">{generate.error?.message || 'It could not be started. Please try again.'}</p>}
  </div>
}

/** While an output is made: the steps, each a bar (done: full, current: moving) with its name, and what is happening. */
export function GenerateProgress({ stage, name }) {
  const at = STEPS.findIndex(([key]) => key === stage)
  return <div role="status" aria-live="polite" className="mt-2.5">
    <ol className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
      {STEPS.map(([key, text], index) => <li key={key} className={index <= at ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}>
        <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--line)]/70">
          {index < at && <span className="block h-full rounded-full bg-[var(--lime-dark)]" />}
          {index === at && <span className="session-loader-progress block h-full w-1/2 rounded-full bg-[var(--lime-dark)]" />}
        </span>
        <span className="mt-1.5 flex items-center gap-1">
          {index < at ? <CheckCircle size={12} weight="fill" className="shrink-0 text-[var(--lime-dark)]" /> : index === at ? <CircleNotch size={12} weight="bold" className="shrink-0 animate-spin text-[var(--accent-strong)]" /> : <span className="size-1.5 shrink-0 rounded-full bg-[var(--line)]" />}
          {text}
        </span>
      </li>)}
    </ol>
    <p className="mt-2 text-xs text-[var(--muted)]">{stage === 'queued' ? `Waiting for the generator to start the ${name}…` : `Generating the ${name}…`} The status updates here by itself.</p>
  </div>
}

/**
 * An item opens like a job preview: a drawer from the right over the page. Down its left side the items listed on the
 * page, to move between them (the open one marked); beside it the details. Each side scrolls on its own. An output's
 * Prompt & guidelines opens on the right of the details while the list makes room (on a phone, in the details' place).
 * Esc closes the Prompt & guidelines first, then the drawer.
 * `details({ panelType, onPanel })` and `panel({ panelType, onPanel })` draw the two parts; `kind` names the item
 * ("AppScript idea"); `closeLabel` is the close button's name.
 */
export function ItemDrawer({ kind, closeLabel, item, items, indexMeta, indexMark, onSelect, onClose, details, panel: renderPanel }) {
  const drawer = useRef(null)
  const body = useRef(null)
  const [opened, setOpened] = useState(null)
  const panelType = opened?.id === item.id ? opened.type : null
  const onPanel = (type) => setOpened(type ? { id: item.id, type } : null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  const panelRef = useRef(panelType)
  useEffect(() => { panelRef.current = panelType }, [panelType])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tween = reduce ? null : gsap.fromTo(drawer.current, { xPercent: 100 }, { xPercent: 0, duration: .5, ease: 'power4.out' })
    // Not while a dialog or a dropdown is open on top.
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || document.querySelector('[data-modal-panel], [role="listbox"]')) return
      if (panelRef.current) setOpened(null)
      else closeRef.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => { tween?.kill(); document.removeEventListener('keydown', closeOnEscape); document.body.style.overflow = '' }
  }, [])
  // Another item opens at its top.
  useEffect(() => { body.current?.scrollTo({ top: 0 }) }, [item.id])

  return createPortal(
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[90] flex justify-end bg-[var(--ink)]/45">
      <aside ref={drawer} aria-label={`${kind}: ${item.name}`} className="flex h-full w-full max-w-[min(96vw,84rem)] flex-col overflow-hidden bg-[var(--paper)] shadow-[-35px_0_90px_rgba(0,0,0,.22)] ring-1 ring-black/5 sm:rounded-l-[2rem]">
        <header className="flex items-center gap-2 border-b border-[var(--line)]/70 bg-[var(--surface)] px-4 py-3 sm:rounded-tl-[2rem] sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">{kind}</p>
            <p className="truncate text-sm font-semibold" title={item.name}>{item.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-white transition-transform hover:scale-105"><X size={15} weight="bold" /></button>
        </header>
        <div className="flex min-h-0 flex-1">
          {!panelType && <div className="hidden w-72 shrink-0 border-r border-[var(--line)]/70 p-3 lg:block">
            <FeedIndex fill items={items} activeId={item.id} onJump={onSelect} meta={indexMeta} mark={indexMark} />
          </div>}
          <div ref={body} className={`min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 [scrollbar-width:thin] sm:px-8 ${panelType ? 'hidden lg:block' : ''}`}>
            {details({ panelType, onPanel })}
          </div>
          {panelType && <div className="flex min-h-0 w-full flex-col p-3 lg:w-[42%] lg:shrink-0 lg:border-l lg:border-[var(--line)]/70">
            {renderPanel({ panelType, onPanel })}
          </div>}
        </div>
      </aside>
    </div>,
    document.body,
  )
}
