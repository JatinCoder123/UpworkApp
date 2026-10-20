import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  Sparkle,
  ArrowClockwise,
  Copy,
  Check,
  Plus,
  Play,
  Square,
  PaperPlaneTilt,
  Key,
  WarningCircle,
  BracketsCurly,
  CaretDown,
  CheckCircle,
  XCircle,
  Circle,
} from '@phosphor-icons/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Shell from '../components/Shell'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { userInitials } from '../lib/auth'
import { asArray, asText } from '../lib/safe'
import CredentialsDropdown from '../components/CredentialsDropdown'
import CreateCredentialModal from '../components/CreateCredentialModal'

/*
 * API Playground: ask the CRM's MCP agent (entryPoint=mcp, the same agent as the CRM's mcp_ui page) to test
 * a saved API credential and show the full JSON reply, including every tool step the agent ran.
 * The selected credential is named in the message (name + CRM record id) so the agent tests that one;
 * its secret tokens are never sent from the browser.
 */

const userStorageKey = (email) => `feed_portal_api_playground_${String(email || 'guest').toLowerCase()}`
const MAX_STEPS = 60
const MAX_SAVED_ENTRIES = 50
const now = () => Date.now()
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Prompts for a selected credential; read-only unless the user writes otherwise.
const CREDENTIAL_PROMPTS = [
  { label: 'Test this credential', prompt: 'Test this credential and tell me whether its token is valid. Read only: do not change, create or delete anything.' },
  { label: 'Show its setup', prompt: 'Describe how this credential is configured (API type, endpoint, status) without showing any secret values.' },
  { label: 'Explain recent errors', prompt: 'Check recent errors related to this credential and explain the likely cause. Read only.' },
]

// "Test <API>" when no credential is selected: names every saved credential of that API (name + record id, never a token).
const apiTestPrompt = (group) => `Test the ${group.label} API using these saved credentials:\n${group.credentials.map((credential) => `- "${credential.name}" (outr_credentials record ${credential.id})`).join('\n')}\nFor each one, call the API with its token and tell me whether it works. Read only: do not change, create or delete anything.`

// Tells the agent which saved credential the question is about (by name and record id, never by token).
const withCredential = (question, credential) =>
  credential
    ? `Saved credential: "${credential.name}" (outr_credentials record ${credential.id}).\n${question}`
    : question

function loadHistory(storageKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// JSON with coloured keys, strings, numbers and booleans. Built from React elements, so nothing is injected as HTML.
const JSON_TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g
function JsonSyntaxView({ json }) {
  const parts = useMemo(() => {
    let text
    try {
      text = typeof json === 'string' ? JSON.stringify(JSON.parse(json), null, 2) : JSON.stringify(json, null, 2)
    } catch {
      text = String(json)
    }
    const out = []
    let last = 0
    for (const match of text.matchAll(JSON_TOKEN)) {
      if (match.index > last) out.push(text.slice(last, match.index))
      const token = match[0]
      const cls = token.startsWith('"')
        ? (/:\s*$/.test(token) ? 'font-bold text-[var(--accent-strong)] dark:text-(--lime)' : 'text-amber-700 dark:text-amber-300')
        : /^(true|false)$/.test(token) ? 'font-bold text-emerald-600 dark:text-emerald-400'
          : token === 'null' ? 'font-bold text-rose-500'
            : 'font-medium text-blue-600 dark:text-sky-300'
      out.push(<span key={match.index} className={cls}>{token}</span>)
      last = match.index + token.length
    }
    if (last < text.length) out.push(text.slice(last))
    return out
  }, [json])
  return <pre className="max-h-[28rem] overflow-auto whitespace-pre p-4 font-mono text-xs leading-relaxed text-[var(--ink)] selection:bg-(--lime) selection:text-[#26320b]">{parts}</pre>
}

// The agent writes **bold** in its answers; show it as bold instead of asterisks.
function AgentText({ text }) {
  return <>{asText(text).split(/(\*\*[^*]+\*\*)/g).map((part, index) => (/^\*\*[^*]+\*\*$/.test(part) ? <strong key={index}>{part.slice(2, -2)}</strong> : part))}</>
}

const ACTION_STYLES = {
  completed: { icon: CheckCircle, cls: 'text-[var(--ok)]', label: 'Passed' },
  failed_or_unverified: { icon: XCircle, cls: 'text-[var(--bad)]', label: 'Failed or not verified' },
}

// The tool steps the agent ran (for a credential test: the request it sent and what the API answered).
function AgentActions({ actions }) {
  const list = asArray(actions)
  if (!list.length) return null
  return <ul className="mb-3 space-y-1.5">
    {list.map((action, index) => {
      const style = ACTION_STYLES[action?.status] || { icon: Circle, cls: 'text-[var(--muted)]', label: asText(action?.status) || 'Step' }
      const Icon = style.icon
      return <li key={`${action?.id || 'step'}-${index}`} className="flex items-start gap-2.5 rounded-xl bg-[var(--surface)] px-3 py-2 text-xs ring-1 ring-[var(--line)]/50">
        <Icon size={15} weight="fill" className={`mt-0.5 shrink-0 ${style.cls}`} aria-label={style.label} />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-[var(--ink)]">{asText(action?.action) || asText(action?.step) || 'Tool step'}</span>
          {action?.detail && <span className="mt-0.5 block text-[11px] leading-5 text-[var(--muted)]">{asText(action.detail)}</span>}
        </span>
        <span className={`shrink-0 text-[10px] font-bold ${style.cls}`}>{style.label}</span>
      </li>
    })}
  </ul>
}

export default function ApiPlayground() {
  const { user } = useAuth()
  // History is per signed-in user; a new key starts a fresh playground state.
  const storageKey = userStorageKey(user?.email)
  return <Playground key={storageKey} storageKey={storageKey} user={user} />
}

function Playground({ storageKey, user }) {
  const queryClient = useQueryClient()
  const [selectedCredential, setSelectedCredential] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [inputQuestion, setInputQuestion] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [copiedId, setCopiedId] = useState(null)
  const [openJsonId, setOpenJsonId] = useState(null)
  const [historyMap, setHistoryMap] = useState(() => loadHistory(storageKey))

  const textareaRef = useRef(null)
  const threadEndRef = useRef(null)
  const abortControllerRef = useRef(null)

  // Credentials saved in the CRM (outr_credentials), through the smart gateway.
  const { data: credData, isLoading: credsLoading, isError: credsFailed, error: credsError, refetch: refetchCreds } = useQuery({
    // Only credentials ticked "API Playground" in the CRM, picked by the gateway.
    queryKey: ['suitecrm-credentials', 'playground'],
    queryFn: () => api.getPlaygroundCredentials(),
    staleTime: 60_000,
  })
  const credentials = credData?.records || []

  // Each credential keeps its own thread.
  const currentCredKey = selectedCredential?.id || 'default'
  const currentEntries = useMemo(() => asArray(historyMap[currentCredKey]), [historyMap, currentCredKey])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(historyMap))
    } catch {
      /* storage full or blocked: the thread still works for this visit */
    }
  }, [historyMap, storageKey])

  const scrollToBottom = useCallback((smooth = true) => {
    threadEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'nearest' })
  }, [])

  useEffect(() => {
    scrollToBottom(false)
  }, [currentEntries.length, scrollToBottom])

  // Abort a running request when leaving the page.
  useEffect(() => () => abortControllerRef.current?.abort(), [])

  const updateEntry = (credKey, entryId, patch) => setHistoryMap((prev) => ({
    ...prev,
    [credKey]: asArray(prev[credKey]).map((item) => (item.id === entryId ? { ...item, ...(typeof patch === 'function' ? patch(item) : patch) } : item)),
  }))

  const handleInput = (e) => {
    setInputQuestion(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }

  const stopRunning = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsRunning(false)
  }, [])

  const clearCurrentThread = () => {
    stopRunning()
    setHistoryMap((prev) => ({ ...prev, [currentCredKey]: [] }))
    setInputQuestion('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.focus()
    }
  }

  // Follows an agent job step by step until it is done, updating the entry as steps arrive.
  // On failure the job id is kept, so "Continue" can resume it (completed steps stay recorded on the server).
  const runJob = async (credKey, entryId, firstBody) => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsRunning(true)
    const crmUserName = firstBody.user
    let body = firstBody
    let steps = 0
    let jobId = firstBody.job_id || null

    try {
      let data
      while (true) {
        data = await api.runMcpAgentStep(body, { signal: controller.signal })
        jobId = data.job_id || jobId
        updateEntry(credKey, entryId, {
          jobId,
          actions: asArray(data.actions),
          progress: `Step ${steps + 1} · ${Number(data.tool_count) || 0} tool call${Number(data.tool_count) === 1 ? '' : 's'}`,
        })
        if (!data.has_more) break
        if (++steps >= MAX_STEPS) throw Object.assign(new Error(`Paused after ${MAX_STEPS} steps. The job is still saved on the server; continue it if the work should go on.`), { jobId })
        body = { job_id: data.job_id, user: crmUserName }
        // Same as the CRM's mcp_ui: give a step that is still running a moment to finish.
        if (/another step is currently running/i.test(data.message || '')) await wait(800)
      }

      updateEntry(credKey, entryId, (item) => ({
        pending: false,
        error: null,
        responseMessage: typeof data.message === 'string' ? data.message : '',
        jsonPayload: data,
        actions: asArray(data.actions),
        agentStatus: asText(data.status),
        elapsed: now() - item.timestamp,
      }))
    } catch (err) {
      const aborted = err?.name === 'AbortError'
      updateEntry(credKey, entryId, (item) => ({
        pending: false,
        elapsed: now() - item.timestamp,
        jsonPayload: err?.data || null,
        jobId: err?.jobId || jobId,
        error: aborted ? 'Request cancelled. Steps already finished are kept on the server; Continue picks up from there.' : err?.message || 'The request could not be completed.',
      }))
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
      setIsRunning(false)
      scrollToBottom()
    }
  }

  const crmUserName = user?.name || user?.email?.split('@')[0] || 'User'

  // Sends the question, naming the selected credential, as a new entry in this credential's thread.
  const handleAskQuestion = (questionText) => {
    const question = (questionText ?? inputQuestion).trim()
    if (!question || isRunning) return

    const credKey = currentCredKey
    const credential = selectedCredential
    const started = now()
    const entryId = `qr-${started}`
    setHistoryMap((prev) => ({
      ...prev,
      [credKey]: [...asArray(prev[credKey]), {
        id: entryId,
        question,
        credentialName: credential?.name || '',
        responseMessage: '',
        jsonPayload: null,
        actions: [],
        agentStatus: '',
        progress: '',
        jobId: null,
        timestamp: started,
        elapsed: null,
        pending: true,
        error: null,
      }].slice(-MAX_SAVED_ENTRIES),
    }))
    setInputQuestion('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    runJob(credKey, entryId, { message: withCredential(question, credential), user: crmUserName })
  }

  // Resumes a failed or stopped job from where it stopped.
  const continueJob = (entry) => {
    if (!entry.jobId || isRunning) return
    updateEntry(currentCredKey, entry.id, { pending: true, error: null, progress: 'Continuing…' })
    runJob(currentCredKey, entry.id, { job_id: entry.jobId, user: crmUserName })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAskQuestion()
    } else if (e.key === 'Escape' && isRunning) {
      stopRunning()
    }
  }

  const copyJsonPayload = async (json, id) => {
    try {
      await navigator.clipboard?.writeText(typeof json === 'string' ? json : JSON.stringify(json, null, 2))
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1600)
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  const time = (value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <Shell>
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 md:pt-8">
        <section className="rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5 dark:bg-white/[.045] dark:ring-white/5">
          <div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(30,32,25,.08)] sm:p-7">
            {/* Title, credential picker and create action */}
            <div className="flex flex-col gap-4 border-b border-[var(--line)]/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="flex items-baseline gap-2 text-2xl font-semibold tracking-[-.04em] text-[var(--ink)]">
                  API <span className="font-serif italic text-[var(--lime-dark)] dark:text-(--lime)">Playground</span>
                </h1>
                <p className="mt-1 text-xs text-[var(--muted)]">Pick a saved credential, ask the CRM agent to test it, and inspect every step and the full JSON response.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CredentialsDropdown
                  credentials={credentials}
                  selectedCredential={selectedCredential}
                  onSelect={(cred) => setSelectedCredential(cred)}
                  onCreateNew={() => setShowCreateModal(true)}
                  isLoading={credsLoading}
                />
                <button type="button" onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-1.5 rounded-full bg-(--lime) px-3.5 py-2 text-xs font-bold text-[#26320b] shadow-xs transition-all hover:brightness-105 active:scale-95">
                  <Plus size={13} weight="bold" />
                  <span>Create Credential</span>
                </button>
                {currentEntries.length > 0 && (
                  <button type="button" onClick={clearCurrentThread} title="Clear this thread" className="inline-flex items-center gap-1 rounded-full bg-[var(--paper)] px-3 py-2 text-xs font-semibold text-[var(--muted)] ring-1 ring-[var(--line)] transition-all hover:text-[var(--ink)] active:scale-95">
                    <ArrowClockwise size={13} weight="bold" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {credsFailed && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-2xl bg-[var(--bad-bg)] px-4 py-3 text-xs font-semibold text-[var(--bad)]">
                <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0" />
                <span className="flex-1">Saved credentials could not be loaded: {credsError?.message || 'unknown error'}.</span>
                <button type="button" onClick={() => refetchCreds()} className="underline underline-offset-4">Retry</button>
              </p>
            )}

            {/* Selected credential */}
            {selectedCredential && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[var(--paper)] p-3 text-xs ring-1 ring-[var(--line)]/70">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-(--lime)/30 text-[var(--accent-strong)]"><Key size={14} weight="bold" /></span>
                  <span className="truncate font-bold text-[var(--ink)]">{selectedCredential.name}</span>
                  <span className={`size-2 shrink-0 rounded-full ${/^active$/i.test(selectedCredential.status) ? 'bg-[var(--ok)]' : 'bg-gray-400'}`} title={selectedCredential.status} />
                  {selectedCredential.productionEndpoint && <span className="hidden truncate font-mono text-[10px] text-[var(--muted)] md:inline">{selectedCredential.productionEndpoint}</span>}
                </div>
                <button type="button" onClick={() => setSelectedCredential(null)} className="shrink-0 text-[11px] font-bold text-[var(--muted)] underline hover:text-[var(--ink)]">Reset</button>
              </div>
            )}

            {/* Questions and responses */}
            <div className="mt-5 max-h-[640px] min-h-[380px] space-y-6 overflow-y-auto pr-1">
              {currentEntries.length === 0 ? (
                <div className="mx-auto max-w-xl py-12 text-center">
                  <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-(--lime)/25 text-[#26320b] ring-1 ring-[var(--lime-dark)]/30 dark:text-[#c0df78]"><BracketsCurly size={24} weight="bold" /></span>
                  <h2 className="text-lg font-bold text-[var(--ink)]">{selectedCredential ? `Test "${selectedCredential.name}"` : 'Ask the CRM agent'}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
                    {selectedCredential
                      ? 'The agent checks this saved credential against its API and shows each step it ran, plus the full JSON response.'
                      : 'Pick a credential above to test it, or start with one of these.'}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                    {selectedCredential
                      ? CREDENTIAL_PROMPTS.map((item) => (
                        <button key={item.label} type="button" onClick={() => handleAskQuestion(item.prompt)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] shadow-xs ring-1 ring-[var(--line)] transition-all hover:bg-[var(--surface)] hover:ring-[var(--lime-dark)] active:scale-95">
                          <Play size={11} weight="fill" className="text-[var(--lime-dark)]" />
                          <span>{item.label}</span>
                        </button>
                      ))
                      // One "Test <API>" per API; disabled until one of its credentials is ticked "API Playground" in the CRM.
                      : (credData?.groups || []).map((group) => {
                        const ready = group.credentials.length > 0
                        return <button key={group.key} type="button" disabled={!ready} onClick={() => handleAskQuestion(apiTestPrompt(group))} title={ready ? `Tests ${group.credentials.length} saved ${group.label} ${group.credentials.length === 1 ? 'credential' : 'credentials'}` : `No ${group.label} credential has "API Playground" ticked in the CRM`} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-2 text-xs font-semibold text-[var(--ink)] shadow-xs ring-1 ring-[var(--line)] transition-all hover:bg-[var(--surface)] hover:ring-[var(--lime-dark)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:ring-[var(--line)]">
                          <Play size={11} weight="fill" className="text-[var(--lime-dark)]" />
                          <span>Test {group.label} API</span>
                          {ready ? <span className="rounded-full bg-[var(--surface)] px-1.5 text-[10px] tabular-nums text-[var(--muted)]">{group.credentials.length}</span> : <span className="text-[10px] font-medium text-[var(--muted)]">· not enabled</span>}
                        </button>
                      })}
                  </div>
                </div>
              ) : (
                currentEntries.map((entry) => {
                  const needsReview = entry.agentStatus === 'needs_review'
                  const badge = entry.pending ? null : entry.error ? ['Error', 'bg-[var(--bad-bg)] text-[var(--bad)]'] : needsReview ? ['Needs review', 'bg-[var(--warn-bg)] text-[var(--warn)]'] : ['Done', 'bg-[var(--ok-bg)] text-[var(--ok)]']
                  return <div key={entry.id} className="space-y-3">
                    {/* Question */}
                    <div className="flex items-start justify-end gap-3">
                      <div className="max-w-2xl rounded-2xl bg-[var(--ink)] px-5 py-3 text-white shadow-xs">
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-white/60">
                          <span className="font-semibold text-white/90">{user?.name || 'You'}</span>
                          <span>{time(entry.timestamp)}</span>
                        </div>
                        <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed sm:text-sm">{entry.question}</p>
                      </div>
                      <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-xs font-bold text-white ring-2 ring-[var(--surface)]">{userInitials(user?.name)}</div>
                    </div>

                    {/* Response */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-(--lime) text-[#26320b] shadow-xs"><BracketsCurly size={18} weight="bold" /></div>
                      <div className="max-w-3xl flex-1 rounded-[1.6rem] bg-[var(--paper)] p-4 ring-1 ring-[var(--line)]/70 sm:p-5">
                        <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--line)]/50 pb-2.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-xs font-bold text-[var(--ink)]">Agent response</span>
                            {entry.credentialName && <span className="truncate rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)] ring-1 ring-[var(--line)]/60">{entry.credentialName}</span>}
                            {badge && <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${badge[1]}`}>{badge[0]}</span>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-[10px] text-[var(--muted)] sm:text-[11px]">
                            {entry.elapsed != null && <span className="font-mono">{(entry.elapsed / 1000).toFixed(1)}s</span>}
                            <span>{time(entry.timestamp)}</span>
                          </div>
                        </div>

                        {entry.pending ? (
                          <div>
                            <AgentActions actions={entry.actions} />
                            <div className="flex items-center gap-2.5 py-2 text-xs font-medium text-[var(--muted)]">
                              <Sparkle size={16} className="animate-spin text-[var(--lime-dark)]" />
                              <span>{entry.progress ? `Working… ${entry.progress}` : 'Sending the request…'}</span>
                            </div>
                          </div>
                        ) : entry.error ? (
                          <div className="rounded-xl bg-[var(--bad-bg)] p-3 text-xs text-[var(--bad)] ring-1 ring-[var(--bad)]/30">
                            <div className="flex items-center gap-2 font-bold"><WarningCircle size={15} weight="fill" /><span>Request failed</span></div>
                            <p className="mt-1 font-mono text-[11px]">{entry.error}</p>
                            <div className="mt-2 flex gap-2">
                              {entry.jobId && <button type="button" onClick={() => continueJob(entry)} disabled={isRunning} title="Resume this job from the step that stopped" className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50">Continue</button>}
                              <button type="button" onClick={() => handleAskQuestion(entry.question)} disabled={isRunning} title="Ask again as a new request" className="rounded-lg bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] disabled:opacity-50">Retry</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <AgentActions actions={entry.actions} />
                            {entry.responseMessage && (
                              <div className="mb-3 whitespace-pre-wrap rounded-xl bg-[var(--surface)] p-3 text-xs leading-relaxed text-[var(--ink)] ring-1 ring-[var(--line)]/50 sm:text-[13px]"><AgentText text={entry.responseMessage} /></div>
                            )}
                          </div>
                        )}

                        {/* Full JSON reply, folded by default */}
                        {!entry.pending && entry.jsonPayload && (
                          <div className="overflow-hidden rounded-xl bg-[var(--surface)] ring-1 ring-[var(--line)]/70">
                            <div className="flex items-center justify-between bg-[var(--paper)]/60 px-3 py-1.5 font-mono text-[11px] text-[var(--muted)]">
                              <button type="button" aria-expanded={openJsonId === entry.id} onClick={() => setOpenJsonId(openJsonId === entry.id ? null : entry.id)} className="flex items-center gap-1 font-bold text-[var(--ink)]">
                                <BracketsCurly size={13} weight="bold" />
                                <span>JSON response</span>
                                <CaretDown size={11} weight="bold" className={`transition-transform ${openJsonId === entry.id ? 'rotate-180' : ''}`} />
                              </button>
                              <button type="button" onClick={() => copyJsonPayload(entry.jsonPayload, entry.id)} className="inline-flex items-center gap-1 rounded-md bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)]/60 hover:brightness-105">
                                {copiedId === entry.id ? <Check size={11} weight="bold" className="text-[var(--ok)]" /> : <Copy size={11} />}
                                <span>{copiedId === entry.id ? 'Copied' : 'Copy JSON'}</span>
                              </button>
                            </div>
                            {openJsonId === entry.id && <div className="border-t border-[var(--line)]/50"><JsonSyntaxView json={entry.jsonPayload} /></div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                })
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Composer */}
            <div className="mt-5 border-t border-[var(--line)]/60 pt-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (isRunning) stopRunning()
                  else handleAskQuestion()
                }}
                className="relative flex items-end gap-2 rounded-2xl bg-[var(--paper)] p-2.5 ring-1 ring-[var(--line)] transition-all focus-within:ring-2 focus-within:ring-[var(--lime-dark)]"
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputQuestion}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  aria-label="Question for the CRM agent"
                  placeholder={selectedCredential ? `Ask about "${selectedCredential.name}", e.g. test this credential…` : 'Ask the CRM agent, or pick a credential to test…'}
                  className="max-h-44 w-full resize-none bg-transparent px-2.5 py-1.5 font-mono text-xs leading-relaxed text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none sm:text-sm"
                />
                {isRunning ? (
                  <button type="button" onClick={stopRunning} title="Stop (Esc)" className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-600 text-white shadow-xs transition-all hover:bg-rose-700 active:scale-95">
                    <Square size={14} weight="fill" />
                  </button>
                ) : (
                  <button type="submit" disabled={!inputQuestion.trim()} title="Send (Enter)" className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-white shadow-xs transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40">
                    <PaperPlaneTilt size={16} weight="bold" />
                  </button>
                )}
              </form>
              <div className="mt-2 flex items-center justify-between px-1 text-[10px] text-[var(--muted)]">
                <span>Enter to send, Shift + Enter for a new line</span>
                {selectedCredential && <span className="font-semibold text-[var(--accent-strong)]">Testing: {selectedCredential.name}</span>}
              </div>
            </div>
          </div>
        </section>

        <CreateCredentialModal
          options={credData?.options}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newCred) => {
            queryClient.invalidateQueries({ queryKey: ['suitecrm-credentials'] })
            setSelectedCredential(newCred)
          }}
        />
      </main>
    </Shell>
  )
}
