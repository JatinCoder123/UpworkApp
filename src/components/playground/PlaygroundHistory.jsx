import { ArrowClockwise, CircleNotch } from '@phosphor-icons/react'
import { ActionIcon, StatusChip } from './PlaygroundParts'
import { actionName, card } from './playgroundUi'
import { testTime, usePlaygroundTests } from '../../lib/playground'
import { timeAgo, useNow } from '../../lib/time'

/*
 * The latest tests (from the CRM's Playground module), newest first; one opens in the result card. Followed while
 * any test is waiting or working.
 */
export default function PlaygroundHistory({ activeId, onOpen }) {
  const tests = usePlaygroundTests()
  const now = useNow()

  return <section className={card}>
    <header className="flex items-center justify-between gap-3 border-b border-[var(--line)]/60 px-5 py-3.5 sm:px-6">
      <h2 className="text-sm font-semibold text-[var(--ink)]">Recent tests{tests.data?.length ? <span className="ml-1.5 font-mono text-xs font-semibold text-[var(--muted)]">{tests.data.length}</span> : null}</h2>
      <button type="button" onClick={() => tests.refetch()} disabled={tests.isFetching} aria-label="Refresh the tests" title="Refresh" className="grid size-8 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:opacity-60"><ArrowClockwise size={15} weight="bold" className={tests.isFetching ? 'animate-spin' : ''} /></button>
    </header>
    {tests.isLoading
      ? <p className="flex items-center gap-2 px-6 py-8 text-xs text-[var(--muted)]"><CircleNotch size={14} className="animate-spin" />Loading…</p>
      : tests.error
        ? <p role="alert" className="m-4 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">The tests could not be loaded: {tests.error.message} <button type="button" onClick={() => tests.refetch()} className="ml-1 underline">Try again</button></p>
        : !tests.data?.length
          ? <p className="px-6 py-8 text-center text-xs text-[var(--muted)]">No tests yet. Your first one shows up here.</p>
          : <ul className="max-h-[26rem] divide-y divide-[var(--line)]/60 overflow-y-auto [scrollbar-width:thin]">
            {tests.data.map((test) => {
              const when = timeAgo(testTime(test.updated), now)
              return <li key={test.id}>
                <button type="button" onClick={() => onOpen(test.id)} aria-current={test.id === activeId || undefined} className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors sm:px-6 ${test.id === activeId ? 'bg-(--lime)/20' : 'hover:bg-[var(--paper)]'}`}>
                  <ActionIcon action={test.action} size={17} weight="bold" className="shrink-0 text-[var(--muted)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">{test.title || actionName(test.action)}</span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">{actionName(test.action)}{when && ` · ${when}`}</span>
                  </span>
                  <StatusChip status={test.status} />
                </button>
              </li>
            })}
          </ul>}
  </section>
}
