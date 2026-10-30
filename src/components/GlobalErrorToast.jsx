import { useEffect, useRef, useState } from 'react'
import { Info, WarningCircle, X } from '@phosphor-icons/react'
import { onNotify } from '../lib/notify'

const AUTO_DISMISS_MS = 8000
const MAX_TOASTS = 3

// Noise that is not the app's fault or needs no user action ("canceled" alone is axios's cancelled request).
const IGNORED_MESSAGES = /ResizeObserver loop|Request cancelled|AbortError|The user aborted|^canceled$/i

// error: something failed; info: something the user should know (a link to a record that is gone).
const TONES = {
  error: ['bg-[var(--bad-bg)] text-[var(--bad)]', WarningCircle, 'alert'],
  info: ['bg-info-bg text-info-icon', Info, 'status'],
}

function describe(reason) {
  if (!reason) return 'Something went wrong.'
  if (typeof reason === 'string') return reason
  return reason.message || String(reason)
}

function shouldIgnore(reason, filename = '') {
  if (reason?.code === 'ABORTED' || reason?.name === 'AbortError' || reason?.name === 'CanceledError') return true
  // Errors thrown by browser extensions or other origins are not ours to report.
  if (filename && !filename.startsWith(window.location.origin)) return true
  return IGNORED_MESSAGES.test(describe(reason))
}

/**
 * Error boundaries only catch errors while rendering. This shows the rest (click handlers, timers, unhandled promise
 * rejections) as a small toast instead of failing silently, and the notices the app sends with notify() (lib/notify).
 */
export default function GlobalErrorToast() {
  const [toasts, setToasts] = useState([])
  const lastShown = useRef({ key: '', at: 0 })

  useEffect(() => {
    const timers = new Set()
    const push = ({ tone = 'error', title = 'Something went wrong', message = '' }) => {
      const key = `${title}\n${message}`
      const now = Date.now()
      // The same toast firing repeatedly (e.g. in a loop) shows once.
      if (lastShown.current.key === key && now - lastShown.current.at < 4000) return
      lastShown.current = { key, at: now }
      const id = `${now}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((current) => [...current, { id, tone: TONES[tone] ? tone : 'error', title, message }].slice(-MAX_TOASTS))
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        setToasts((current) => current.filter((toast) => toast.id !== id))
      }, AUTO_DISMISS_MS)
      timers.add(timer)
    }
    const pushError = (reason, filename) => { if (!shouldIgnore(reason, filename)) push({ message: describe(reason) }) }
    const onError = (event) => pushError(event.error || event.message, event.filename)
    const onRejection = (event) => pushError(event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    const stopNotices = onNotify(push)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      stopNotices()
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  if (!toasts.length) return null
  return <div aria-live="assertive" className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2.5 sm:bottom-6 sm:right-6">
    {toasts.map((toast) => {
      const [look, Icon, role] = TONES[toast.tone]
      return <div key={toast.id} role={role} className="pointer-events-auto rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgb(var(--shadow-rgb)/.2)] ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
        <div className="flex items-start gap-3 rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-3.5">
          <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${look}`}><Icon size={16} weight="fill" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">{toast.title}</p>
            {toast.message && <p className="mt-0.5 line-clamp-3 break-words text-[11px] leading-4 text-[var(--muted)]">{toast.message}</p>}
          </div>
          <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss" className="grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"><X size={12} weight="bold" /></button>
        </div>
      </div>
    })}
  </div>
}
