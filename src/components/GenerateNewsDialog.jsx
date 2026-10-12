import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ArrowRight,
  Check,
  CheckCircle,
  FilePlus,
  FileText,
  LinkSimple,
  MagicWand,
  PencilSimple,
} from '@phosphor-icons/react'
import { DialogHeader, Modal } from './ui'

const GENERATION_STEPS = [
  'Reading the selected news story',
  'Building the document structure',
  'Writing the news draft',
  'Polishing the final document',
]

export default function GenerateNewsDialog({ storyTitle, onClose }) {
  const [mode, setMode] = useState('update')
  const [title, setTitle] = useState(storyTitle || '')
  const [documentUrl, setDocumentUrl] = useState('')
  const [changes, setChanges] = useState('')
  const [status, setStatus] = useState('idle')
  const [activeStep, setActiveStep] = useState(0)
  const contentRef = useRef(null)

  const canGenerate = title.trim().length > 2 && (
    mode === 'new' || (documentUrl.trim().length > 5 && changes.trim().length > 4)
  )

  useEffect(() => {
    if (status !== 'generating') return undefined
    const timers = GENERATION_STEPS.map((_, index) => (
      setTimeout(() => setActiveStep(index), index * 800)
    ))
    timers.push(setTimeout(() => setStatus('complete'), GENERATION_STEPS.length * 800 + 300))
    return () => timers.forEach(clearTimeout)
  }, [status])

  useEffect(() => {
    if (!contentRef.current) return undefined
    const animation = gsap.fromTo(contentRef.current, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .42, ease: 'power3.out' })
    return () => animation.kill()
  }, [mode, status])

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setStatus('idle')
    setActiveStep(0)
  }

  const generate = () => {
    if (!canGenerate) return
    setActiveStep(0)
    setStatus('generating')
  }

  const startOver = () => {
    setStatus('idle')
    setActiveStep(0)
  }

  return (
    <Modal onClose={onClose} wide>
      <DialogHeader eyebrow="Generate Doc" title="Turn this story into a doc" onClose={onClose} />

      {status === 'idle' && (
        <div className="mt-7 grid grid-cols-2 rounded-2xl bg-[var(--paper)] p-1.5 ring-1 ring-black/5 dark:ring-white/10">
          <button type="button" aria-pressed={mode === 'update'} onClick={() => switchMode('update')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold transition-all duration-300 active:scale-[.98] ${mode === 'update' ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            <LinkSimple size={16} /> Update existing doc
          </button>
          <button type="button" aria-pressed={mode === 'new'} onClick={() => switchMode('new')} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-bold transition-all duration-300 active:scale-[.98] ${mode === 'new' ? 'bg-[var(--ink)] text-white shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            <FilePlus size={16} /> Create new
          </button>
        </div>
      )}

      <div ref={contentRef} className="mt-6">
        {status === 'idle' && (
          <div>
            <Field label="Document title" hint="Filled from this news story, but you can edit it">
              <div className="flex items-center gap-3 rounded-2xl bg-[var(--paper)] px-4 ring-1 ring-[var(--line)] transition focus-within:ring-2 focus-within:ring-[var(--lime-dark)]">
                <FileText size={17} className="shrink-0 text-[var(--accent-strong)]" />
                <input value={title} onChange={(event) => setTitle(event.target.value)} type="text" className="w-full bg-transparent py-3.5 text-sm font-semibold outline-none placeholder:text-[var(--muted)]/70" placeholder="Document title" />
              </div>
            </Field>

            {mode === 'update' ? (
              <div className="mt-5 space-y-5">
                <Field label="Existing document link" hint="Google Docs, Notion, Dropbox, or another shared URL">
                  <div className="flex items-center gap-3 rounded-2xl bg-[var(--paper)] px-4 ring-1 ring-[var(--line)] transition focus-within:ring-2 focus-within:ring-[var(--lime-dark)]">
                    <LinkSimple size={17} className="shrink-0 text-[var(--muted)]" />
                    <input value={documentUrl} onChange={(event) => setDocumentUrl(event.target.value)} type="url" placeholder="https://docs.google.com/..." className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-[var(--muted)]/70" />
                  </div>
                </Field>
                <Field label="Extra changes" hint="Explain what should be added, removed, or rewritten">
                  <textarea value={changes} onChange={(event) => setChanges(event.target.value)} rows={4} placeholder="Add the latest announcement, rewrite the introduction, and include the key takeaways..." className="w-full resize-none rounded-2xl bg-[var(--paper)] px-4 py-3.5 text-sm leading-6 outline-none ring-1 ring-[var(--line)] transition placeholder:text-[var(--muted)]/70 focus:ring-2 focus:ring-[var(--lime-dark)]" />
                </Field>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[var(--ink)] p-5 text-white">
                <div className="flex items-start gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--lime)] text-[var(--ink)]"><FilePlus size={19} weight="bold" /></span>
                  <div><h3 className="text-sm font-bold">Ready to create a new document</h3><p className="mt-1.5 text-xs leading-5 text-white/60">The draft will use the selected news story as its source. Edit the title above if needed, then generate it.</p></div>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[var(--line)] pt-5 sm:flex-row sm:items-center">
              <p className="text-[11px] text-[var(--muted)]">This demo shows sample progress and does not publish changes.</p>
              <button type="button" disabled={!canGenerate} onClick={generate} className="inline-flex items-center justify-center gap-3 rounded-full bg-[var(--lime)] py-3 pl-5 pr-3 text-sm font-bold text-[#26320b] transition-all duration-300 hover:-translate-y-0.5 active:scale-[.98] disabled:pointer-events-none disabled:opacity-40">
                Generate <span className="grid size-7 place-items-center rounded-full bg-[var(--ink)] text-white"><ArrowRight size={14} /></span>
              </button>
            </div>
          </div>
        )}

        {status === 'generating' && (
          <div className="grid min-h-80 place-items-center py-6 text-center" aria-live="polite">
            <div className="w-full max-w-md">
              <div className="relative mx-auto grid size-20 place-items-center rounded-full bg-[var(--ink)] text-[var(--lime)]">
                <MagicWand size={28} weight="fill" className="animate-pulse" />
                <span className="absolute inset-[-8px] rounded-full border border-[var(--lime-dark)]/40 animate-ping" />
              </div>
              <h3 className="mt-7 text-2xl font-semibold tracking-[-.04em]">{mode === 'update' ? 'Updating your document' : 'Creating your document'}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">This is sample progress until the document API is connected.</p>
              <div className="mt-7 space-y-2 text-left">
                {GENERATION_STEPS.map((step, index) => {
                  const complete = index < activeStep
                  const active = index === activeStep
                  return <div key={step} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition-all duration-500 ${active ? 'translate-x-1 bg-[var(--lime)] text-[#26320b]' : complete ? 'text-[var(--ink)]' : 'text-[var(--muted)]/45'}`}>
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full ${active ? 'bg-[var(--ink)] text-white' : complete ? 'bg-[var(--ink)] text-[var(--lime)]' : 'bg-black/5 dark:bg-white/5'}`}>{complete ? <Check size={13} weight="bold" /> : index + 1}</span>
                    {step}
                  </div>
                })}
              </div>
            </div>
          </div>
        )}

        {status === 'complete' && (
          <div aria-live="polite">
            <div className="flex items-center gap-3 text-sm font-bold text-[var(--accent-strong)]"><CheckCircle size={22} weight="fill" /> {mode === 'update' ? 'Document update ready' : 'New document ready'}</div>
            <article className="mt-5 rounded-2xl bg-[var(--paper)] p-6 ring-1 ring-[var(--line)] sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent-strong)]">{mode === 'update' ? 'Updated news document' : 'New news document'}</p>
              <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-[-.04em]">{title}</h3>
              <p className="mt-4 text-sm leading-6 text-[var(--muted)]">A structured document draft has been prepared from this news story. This placeholder feedback will be replaced by the generated content when the API is connected.</p>
              {mode === 'update' && <p className="mt-5 rounded-xl bg-[var(--surface)] p-4 text-xs leading-5 text-[var(--muted)]"><strong className="text-[var(--ink)]">Requested changes:</strong> {changes}</p>}
            </article>
            <div className="mt-5 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button type="button" onClick={startOver} className="rounded-full px-5 py-3 text-xs font-bold text-[var(--muted)] ring-1 ring-[var(--line)] transition hover:text-[var(--ink)] active:scale-[.98]">Adjust details</button>
              <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 py-3 text-xs font-bold text-white transition hover:-translate-y-0.5 active:scale-[.98]"><PencilSimple size={15} /> Finish preview</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, hint, children }) {
  return <label className="block"><span className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><span className="text-xs font-bold">{label}</span><span className="text-[10px] text-[var(--muted)]">{hint}</span></span><span className="mt-2 block">{children}</span></label>
}
