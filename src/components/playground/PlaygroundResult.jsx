import { useState } from 'react'
import { ArrowClockwise, ArrowSquareOut, BracketsCurly, CaretDown, Check, CircleNotch, Copy, Eye, WarningCircle, X } from '@phosphor-icons/react'
import DownloadButton from '../DownloadButton'
import { ActionIcon, ClaudeText, JsonView, StatusChip } from './PlaygroundParts'
import { actionName, card, smallButton } from './playgroundUi'
import { isRunning, usePlaygroundTest, useRerunTest } from '../../lib/playground'

/*
 * One test's result, followed while it runs: Claude's reply (copyable), or Open / Download for a generated file, or
 * what went wrong. The technical side (what was sent, the prompt and guideline used, run again, the CRM record, the
 * JSON) is folded under "Details".
 */

/** Before any test is open: what happens here. */
export function ResultPlaceholder() {
  return <section className={`${card} px-6 py-12 text-center`}>
    <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-(--lime)/25 text-[#26320b] ring-1 ring-[var(--lime-dark)]/30 dark:text-[#c0df78]"><BracketsCurly size={24} weight="bold" /></span>
    <p className="mt-3 text-sm font-semibold text-[var(--ink)]">Your result shows here</p>
    <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[var(--muted)]">Fill in the form and run it. A question is answered in seconds; documents and other files take a minute or two.</p>
  </section>
}

function useCopy() {
  const [copied, setCopied] = useState('')
  const copy = async (key, text) => {
    try {
      await navigator.clipboard?.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(''), 1600)
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }
  return [copied, copy]
}

export default function PlaygroundResult({ summary, onClose }) {
  const result = usePlaygroundTest(summary)
  const rerun = useRerunTest(summary.id)
  const [details, setDetails] = useState(false)
  const [copied, copy] = useCopy()
  const test = result.data || summary
  const running = isRunning(test)
  const failed = test.status === 'failed' || Boolean(test.error)
  const hasFile = test.action !== 'custom' && (test.viewUrl || test.downloadUrl)

  return <section aria-label="Result" className={card}>
    <header className="flex items-start gap-3 border-b border-[var(--line)]/60 px-5 py-4 sm:px-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--paper)] text-[var(--accent-strong)] ring-1 ring-[var(--line)]/70"><ActionIcon action={test.action} size={18} weight="bold" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[var(--muted)]">{actionName(test.action)}</p>
        <h2 className="truncate text-base font-semibold text-[var(--ink)]">{test.title || actionName(test.action)}</h2>
      </div>
      <StatusChip status={test.status} />
      <button type="button" onClick={onClose} aria-label="Close the result" className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"><X size={16} weight="bold" /></button>
    </header>

    <div className="px-5 py-5 sm:px-6">
      {running
        ? <div className="flex items-center gap-3 rounded-2xl bg-[var(--warn-bg)]/50 p-4 text-sm text-[var(--ink)]">
          <CircleNotch size={20} weight="bold" className="shrink-0 animate-spin text-[var(--warn)]" />
          <span>{test.status === 'queued' ? 'Waiting for its turn…' : 'Claude is working on it…'} This updates by itself, usually within a minute or two.</span>
        </div>
        : failed
          ? <div role="alert" className="flex items-start gap-3 rounded-2xl bg-[var(--bad-bg)] p-4 text-sm text-[var(--bad)]">
            <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap font-semibold">{test.error || 'This test failed.'}</span>
          </div>
          : <>
            <div className="relative">
              <div className="max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-2xl bg-[var(--paper)] p-4 pr-12 text-sm leading-7 text-[var(--ink)] ring-1 ring-[var(--line)]/60 [overflow-wrap:anywhere]"><ClaudeText text={test.response || 'No reply.'} /></div>
              {test.response && <button type="button" onClick={() => copy('reply', test.response)} aria-label="Copy the reply" title="Copy the reply" className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-lg bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--line)]/60 hover:text-[var(--ink)]">
                {copied === 'reply' ? <Check size={14} weight="bold" className="text-[var(--ok)]" /> : <Copy size={14} />}
              </button>}
            </div>
            {hasFile && <div className="mt-3 flex flex-wrap gap-2">
              {test.viewUrl && <a href={test.viewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-5 py-2.5 text-xs font-bold text-[var(--paper)] transition-transform hover:-translate-y-0.5"><Eye size={14} weight="bold" />Open</a>}
              {test.downloadUrl && <span className="text-xs font-bold"><DownloadButton url={test.downloadUrl} iconSize={14} className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-5 py-2.5 text-[var(--ink)] ring-1 ring-[var(--line)] hover:ring-[var(--lime-dark)] disabled:opacity-70" /></span>}
            </div>}
          </>}
      {result.error && <p className="mt-2 text-[11px] font-semibold text-[var(--bad)]">The latest status could not be read: {result.error.message}</p>}
    </div>

    <div className="border-t border-[var(--line)]/60 px-5 py-3 sm:px-6">
      <span className="text-xs font-semibold"><button type="button" aria-expanded={details} onClick={() => setDetails(!details)} className="inline-flex items-center gap-1.5 text-[var(--muted)] hover:text-[var(--ink)]">
        <CaretDown size={11} weight="bold" className={`transition-transform ${details ? 'rotate-180' : ''}`} />Details
      </button></span>
      {details && <div className="mt-3 space-y-3 pb-2">
        {test.requirement && <div>
          <p className="text-[11px] font-semibold text-[var(--muted)]">What was sent</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-[var(--paper)] p-3 font-mono text-[11px] leading-5 text-[var(--ink)] [overflow-wrap:anywhere]">{test.requirement}</p>
        </div>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-[var(--muted)]">Prompt</dt><dd className="truncate font-mono text-[var(--ink)]">{test.prompt?.name || 'none'}</dd>
          <dt className="text-[var(--muted)]">Guideline</dt><dd className="truncate font-mono text-[var(--ink)]">{test.guideline?.name || 'none'}</dd>
        </dl>
        {rerun.error && <p role="alert" className="whitespace-pre-line text-[11px] font-semibold text-[var(--bad)]">It could not run again: {rerun.error.message}</p>}
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <button type="button" onClick={() => rerun.mutate()} disabled={running || rerun.isPending} title={running ? 'It can run again once this run ends' : 'Run the same test again'} className={smallButton}><ArrowClockwise size={12} weight="bold" className={rerun.isPending ? 'animate-spin' : ''} />Run again</button>
          {test.recordUrl && <a href={test.recordUrl} target="_blank" rel="noreferrer" className={smallButton}><ArrowSquareOut size={12} weight="bold" />Open in CRM</a>}
          <button type="button" onClick={() => copy('json', JSON.stringify(test.raw, null, 2))} className={smallButton}>{copied === 'json' ? <Check size={12} weight="bold" className="text-[var(--ok)]" /> : <Copy size={12} />}{copied === 'json' ? 'Copied' : 'Copy JSON'}</button>
        </div>
        <details className="overflow-hidden rounded-xl bg-[var(--paper)] ring-1 ring-[var(--line)]/70">
          <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 font-mono text-[11px] font-bold text-[var(--ink)]"><BracketsCurly size={13} weight="bold" />Full JSON response</summary>
          <div className="border-t border-[var(--line)]/50 bg-[var(--surface)]"><JsonView json={test.raw} /></div>
        </details>
      </div>}
    </div>
  </section>
}
