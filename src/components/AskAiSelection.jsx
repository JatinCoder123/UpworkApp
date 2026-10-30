import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { Check, Copy, Sparkle, WarningCircle, X } from '@phosphor-icons/react'
import AiAnswer from './AiAnswer'
import { api } from '../services/api'
import { useCopied } from './JobDetailParts'

const QUICK_PROMPTS = [
  'Explain this in simple words',
  'What does the client want?',
  'What should I ask the client?',
  'Any red flags here?',
]
const MIN_LENGTH = 3
const MAX_TEXT = 50_000

// The selected text inside `root`, with where it sits on screen; null when nothing usable is selected.
function readSelection(root) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.rangeCount) return null
  const text = selection.toString().trim()
  if (text.length < MIN_LENGTH) return null
  const range = selection.getRangeAt(0)
  const node = range.commonAncestorContainer
  const element = node.nodeType === 1 ? node : node.parentElement
  // Text typed in a field (the cover letter editor) is not a job selection.
  if (!root?.contains(element) || element?.closest('input, textarea, [contenteditable="true"]')) return null
  const rect = range.getBoundingClientRect()
  if (!rect.width && !rect.height) return null
  return { text, top: rect.top, left: rect.left + rect.width / 2 }
}

/**
 * Wraps a job's content: selecting text shows an "Ask AI" button above it, which opens a panel
 * to ask about that text (POST /api/ai/ask). A new question or closing the panel cancels the old request.
 */
export default function AskAiSelection({ children, className }) {
  const root = useRef(null)
  const [anchor, setAnchor] = useState(null)
  const [quote, setQuote] = useState('')
  const [prompt, setPrompt] = useState('')
  const [copied, copy] = useCopied()
  const controller = useRef(null)

  const ask = useMutation({
    mutationFn: ({ text, question }) => {
      controller.current?.abort()
      controller.current = new AbortController()
      return api.askAi(text, question, { signal: controller.current.signal })
    },
  })
  const close = () => { controller.current?.abort(); ask.reset(); setQuote(''); setPrompt('') }
  useEffect(() => () => controller.current?.abort(), [])

  useEffect(() => {
    const update = () => setTimeout(() => setAnchor(readSelection(root.current)), 0)
    const clearIfEmpty = () => { if (!window.getSelection()?.toString().trim()) setAnchor(null) }
    const hide = () => setAnchor(null)
    const node = root.current
    node?.addEventListener('mouseup', update)
    node?.addEventListener('touchend', update)
    node?.addEventListener('keyup', update)
    document.addEventListener('selectionchange', clearIfEmpty)
    // The button is placed once; scrolling would leave it behind, so it goes until the next selection.
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      node?.removeEventListener('mouseup', update)
      node?.removeEventListener('touchend', update)
      node?.removeEventListener('keyup', update)
      document.removeEventListener('selectionchange', clearIfEmpty)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [])

  useEffect(() => {
    if (!quote) return undefined
    const onKey = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // close only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote])

  const open = () => {
    if (!anchor) return
    controller.current?.abort()
    ask.reset()
    setQuote(anchor.text.slice(0, MAX_TEXT))
    setPrompt('')
    setAnchor(null)
    window.getSelection()?.removeAllRanges()
  }
  const run = (question) => {
    if (!quote || ask.isPending) return
    setPrompt(question)
    ask.mutate({ text: quote, question: question.trim() })
  }
  const aborted = ask.error?.code === 'ABORTED'

  return <div ref={root} className={className}>
    {children}

    {anchor && !quote && createPortal(
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={open}
        style={{ top: Math.max(8, anchor.top - 44), left: anchor.left }}
        className="fixed z-[70] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--ink)] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_10px_30px_rgb(var(--shadow-rgb)/.28)] ring-1 ring-white/10 transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <Sparkle size={13} weight="fill" className="text-[var(--hero-accent)]" />Ask AI
      </button>,
      document.body,
    )}

    {quote && createPortal(
      <section role="dialog" aria-label="Ask AI about the selected text" className="fixed inset-x-4 bottom-4 z-[70] flex max-h-[min(36rem,calc(100dvh-2rem))] flex-col overflow-hidden rounded-[1.6rem] bg-[var(--surface)] shadow-[0_24px_70px_rgb(var(--shadow-rgb)/.28)] ring-1 ring-[var(--line)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[26rem]">
        <header className="flex items-center gap-2 border-b border-[var(--line)]/70 px-5 py-3.5">
          <span className="grid size-7 place-items-center rounded-full bg-[var(--lime)] text-[var(--on-lime)]"><Sparkle size={14} weight="fill" /></span>
          <p className="flex-1 text-sm font-semibold">Ask AI</p>
          <button type="button" onClick={close} aria-label="Close" className="grid size-8 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"><X size={15} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <blockquote className="line-clamp-4 border-l-2 border-[var(--lime-dark)] pl-3 text-xs leading-5 text-[var(--muted)]">{quote}</blockquote>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((item) => <button key={item} type="button" disabled={ask.isPending} onClick={() => run(item)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 transition-colors disabled:opacity-50 ${prompt === item && (ask.isPending || ask.isSuccess) ? 'bg-[var(--lime-tint)]/30 text-[var(--ink)] ring-[var(--lime-dark)]' : 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)] hover:ring-[var(--lime-dark)]'}`}>{item}</button>)}
          </div>

          {ask.isPending && <div className="flex items-center gap-2.5 rounded-2xl bg-[var(--paper)] px-4 py-3 text-xs font-semibold text-[var(--muted)]"><span className="size-4 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--lime-dark)]" />Thinking… this can take up to 20 seconds.</div>}
          {ask.isError && !aborted && <p role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-[var(--bad)]"><WarningCircle size={14} weight="fill" className="mt-0.5 shrink-0" />{ask.error?.message}</p>}
          {ask.isSuccess && <div className="rounded-2xl bg-[var(--paper)] p-4">
            <AiAnswer text={ask.data} />
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => copy('answer', ask.data)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--ink)]">{copied === 'answer' ? <Check size={13} weight="bold" /> : <Copy size={13} />}{copied === 'answer' ? 'Copied' : 'Copy answer'}</button>
            </div>
          </div>}
        </div>

        <form onSubmit={(event) => { event.preventDefault(); run(prompt) }} className="flex items-center gap-2 border-t border-[var(--line)]/70 px-4 py-3">
          <input value={prompt} onChange={(event) => setPrompt(event.target.value.slice(0, 4000))} disabled={ask.isPending} autoFocus placeholder="Ask anything about this text…" aria-label="Your question" className="min-w-0 flex-1 rounded-full bg-[var(--paper)] px-4 py-2.5 text-xs outline-none ring-1 ring-[var(--line)] focus:ring-[var(--lime-dark)]" />
          <button type="submit" disabled={ask.isPending} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 text-xs font-semibold text-white disabled:opacity-45">{ask.isPending ? <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Sparkle size={12} weight="fill" />}Ask</button>
        </form>
      </section>,
      document.body,
    )}
  </div>
}
