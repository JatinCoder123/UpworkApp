import { useEffect, useRef, useState } from 'react'
import { ArrowSquareOut } from '@phosphor-icons/react'
import Shell from '../components/Shell'
import { SectionPanel } from '../components/SectionControls'
import PlaygroundForm from '../components/playground/PlaygroundForm'
import PlaygroundResult, { ResultPlaceholder } from '../components/playground/PlaygroundResult'
import PlaygroundHistory from '../components/playground/PlaygroundHistory'
import { usePlaygroundTests } from '../lib/playground'
import { PLAYGROUND_MODULE_URL } from '../services/api'

/*
 * API Playground (CRM entryPoint=apiPlayground): try a requirement with Claude. The form is on the left; on the right
 * the result of the test just run (or of one picked from Recent tests), followed until it is done, and the recent
 * tests. On a phone they stack, and running a test scrolls to its result.
 */
export default function ApiPlayground() {
  const tests = usePlaygroundTests()
  const [openId, setOpenId] = useState('')
  const resultRef = useRef(null)
  const open = tests.data?.find((test) => test.id === openId)

  // Bring the result into view when one opens (on a phone it is below the form).
  useEffect(() => {
    if (openId) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [openId])

  return <Shell>
    <main className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
      <SectionPanel>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-[-.04em]">API Playground</h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Try Claude: ask a question or have it make a document, blog post, script, video or image. Every test is saved.</p>
          </div>
          <a href={PLAYGROUND_MODULE_URL} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-xs font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><ArrowSquareOut size={13} weight="bold" />Playground in CRM</a>
        </div>
      </SectionPanel>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <PlaygroundForm onRun={(test) => setOpenId(test.id)} />
        <div className="space-y-5">
          <div ref={resultRef} className="scroll-mt-24">
            {open ? <PlaygroundResult key={open.id} summary={open} onClose={() => setOpenId('')} /> : <ResultPlaceholder />}
          </div>
          <PlaygroundHistory activeId={openId} onOpen={setOpenId} />
        </div>
      </div>
    </main>
  </Shell>
}
