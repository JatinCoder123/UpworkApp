import { useEffect, useRef, useState } from 'react'
import { WarningCircle, X } from '@phosphor-icons/react'

const AUTO_DISMISS_MS = 8000
const MAX_TOASTS = 3

// Noise that is not the app's fault or needs no user action.
const IGNORED_MESSAGES = /ResizeObserver loop|Request cancelled|AbortError|The user aborted|canceled/i

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
 * Error boundaries only catch errors while rendering. This shows the rest (click handlers, timers,
 * unhandled promise rejections) as a small toast instead of failing silently.
 */
export default function GlobalErrorToast() {
  const [toasts, setToasts] = useState([])
  const lastShown = useRef({ message: '', at: 0 })

  useEffect(() => {
    const push = (reason, filename) => {
      if (shouldIgnore(reason, filename)) return
      const message = describe(reason)
      const now = Date.now()
      // The same error firing repeatedly (e.g. in a loop) shows once.
      if (lastShown.current.message === message && now - lastShown.current.at < 4000) return
      lastShown.current = { message, at: now }
      const id = `${now}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((current) => [...current, { id, message }].slice(-MAX_TOASTS))
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), AUTO_DISMISS_MS)
    }
    const onError = (event) => push(event.error || event.message, event.filename)
    const onRejection = (event) => push(event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!toasts.length) return null
  return <div aria-live="assertive" className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2.5 sm:bottom-6 sm:right-6">
    {toasts.map((toast) => <div key={toast.id} role="alert" className="pointer-events-auto rounded-[1.4rem] bg-black/5 p-1.5 shadow-[0_24px_70px_rgba(30,32,25,.2)] ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
      <div className="flex items-start gap-3 rounded-[calc(1.4rem-.375rem)] bg-[var(--surface)] p-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--bad-bg)] text-[var(--bad)]"><WarningCircle size={16} weight="fill" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Something went wrong</p>
          <p className="mt-0.5 line-clamp-3 break-words text-[11px] leading-4 text-[var(--muted)]">{toast.message}</p>
        </div>
        <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Dismiss error" className="grid size-6 shrink-0 place-items-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--paper)] hover:text-[var(--ink)]"><X size={12} weight="bold" /></button>
      </div>
    </div>)}
  </div>
}
