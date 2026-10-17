import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  FileDoc,
  Sparkle,
  CheckCircle,
  WarningCircle,
  X,
  ArrowSquareOut,
  ArrowsClockwise,
  HourglassMedium,
  DownloadSimple,
} from '@phosphor-icons/react'
import { subscribeDocStatus } from '../services/docSocket'
// Importing it also subscribes the notification store first, so it has judged each event before the toast sees it.
import { isOwnDocEvent } from '../services/docNotifications'
import { getDocumentViewUrl } from '../services/api'
import { asText } from '../lib/safe'

// Plays a gentle subtle audio chime via Web Audio API on completion
function playSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14) // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.42)
  } catch {
    // AudioContext blocked by browser autoplay policy or unsupported
  }
}

// Sends an OS desktop notification if permission was previously granted
function sendDesktopNotification(title, body) {
  try {
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' })
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' })
          }
        })
      }
    }
  } catch {
    // Notifications not available
  }
}

const STATUS_CONFIG = {
  queued: {
    label: 'Document Queued',
    sub: 'Registered in AI pipeline...',
    color: 'var(--ink)',
    bg: 'var(--paper)',
    ring: 'var(--line)',
    Icon: HourglassMedium,
    animate: false,
    autoClose: 5000,
  },
  processing: {
    label: 'Processing Article',
    sub: 'Synthesizing sources & AI drafting...',
    color: 'var(--lime-dark)',
    bg: 'var(--lime)/15',
    ring: 'var(--lime-dark)/30',
    Icon: Sparkle,
    animate: true,
    autoClose: 6000,
  },
  compiling: {
    label: 'Compiling DOCX',
    sub: 'Formatting typography & packaging file...',
    color: 'var(--orange)',
    bg: 'var(--warn-bg)/40',
    ring: 'var(--orange)/30',
    Icon: ArrowsClockwise,
    animate: true,
    autoClose: 7000,
  },
  completed: {
    label: '🎉 Document Generated!',
    sub: 'Word document is compiled & ready to view or download.',
    color: 'var(--ok)',
    bg: 'var(--ok-bg)',
    ring: 'var(--ok)/45',
    Icon: CheckCircle,
    animate: false,
    autoClose: 15000,
  },
  failed: {
    label: 'Generation Failed',
    sub: 'AI document process encountered an issue.',
    color: 'var(--bad)',
    bg: 'var(--bad-bg)',
    ring: 'var(--bad)/35',
    Icon: WarningCircle,
    animate: false,
    autoClose: 10000,
  },
}

export default function DocNotificationToast() {
  const [toasts, setToasts] = useState([])
  const [downloadingToastId, setDownloadingToastId] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const unsubscribe = subscribeDocStatus((event) => {
      // The socket broadcasts every user's docs; toast, chime and desktop alert are only for the user's own.
      if (!event.status || !isOwnDocEvent(event)) return

      const cfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.processing
      const toastId = `${event.noteId || event.contentId || 'doc'}-${event.status}-${Date.now()}`
      const noteId = event.noteId || ''
      const viewUrl = event.viewUrl || (noteId ? getDocumentViewUrl(noteId) : '')

      // On completed status: trigger pleasant chime and native notification
      if (event.status === 'completed') {
        playSuccessChime()
        sendDesktopNotification(
          '🎉 Document Generated!',
          event.title ? `${event.title} is ready.` : 'Your technical content document is ready.'
        )
      }

      const newToast = {
        id: toastId,
        status: event.status,
        noteId,
        contentId: event.contentId,
        title: event.title || 'Technical Content Idea',
        userName: event.userName || '',
        sub: event.message || cfg.sub,
        viewUrl,
        documentUrl: event.documentUrl,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      // Add to toast list, keeping at most 3 recent notifications
      setToasts((prev) => [newToast, ...prev.slice(0, 2)])

      // Schedule auto-dismiss
      const duration = cfg.autoClose || 6000
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId))
      }, duration)
    })

    return () => unsubscribe()
  }, [])

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const handleOpenSiteContent = (toast) => {
    removeToast(toast.id)
    if (location.pathname !== '/site-content') {
      navigate('/site-content')
    }
  }

  const handleDownloadFromToast = async (toast) => {
    if (!toast.noteId && !toast.viewUrl) return
    const viewUrl = toast.viewUrl || getDocumentViewUrl(toast.noteId)
    const baseName = (asText(toast.title) || 'document').slice(0, 48).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const downloadFilename = `${baseName}.doc`

    setDownloadingToastId(toast.id)
    try {
      const fetchUrl = import.meta.env?.DEV && toast.noteId
        ? `/crm-entrypoint/index.php?entryPoint=viewdoc&id=${encodeURIComponent(toast.noteId)}`
        : viewUrl

      const res = await fetch(fetchUrl)
      if (res.ok) {
        const html = await res.text()
        const blob = new Blob([html], { type: 'application/msword;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = downloadFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setDownloadingToastId(null)
        return
      }
    } catch (e) {
      console.warn('Toast download fallback:', e)
    }

    setDownloadingToastId(null)
    window.open(viewUrl, '_blank')
  }

  if (!toasts.length) return null

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2.5 sm:top-6 sm:right-6"
    >
      {toasts.map((toast) => {
        const cfg = STATUS_CONFIG[toast.status] || STATUS_CONFIG.processing
        const IconComponent = cfg.Icon
        const isCompleted = toast.status === 'completed'
        const isDownloading = downloadingToastId === toast.id

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto overflow-hidden rounded-2xl bg-[var(--surface)] p-3.5 ring-1 transition-all duration-300 hover:shadow-[0_16px_44px_rgba(0,0,0,0.16)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.45)] ${
              isCompleted
                ? 'ring-[var(--ok)]/40 shadow-[0_16px_40px_rgba(46,125,50,0.18)]'
                : 'ring-[var(--line)] shadow-[0_12px_36px_rgba(0,0,0,0.12)]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className="grid size-9 shrink-0 place-items-center rounded-xl ring-1"
                style={{
                  backgroundColor: `color-mix(in srgb, ${cfg.color} 15%, transparent)`,
                  color: cfg.color,
                  borderColor: `color-mix(in srgb, ${cfg.color} 30%, transparent)`,
                }}
              >
                <IconComponent
                  size={18}
                  weight={isCompleted || toast.status === 'failed' ? 'fill' : 'bold'}
                  className={cfg.animate ? 'animate-spin' : ''}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-medium text-[var(--muted)]">{toast.timestamp}</span>

                  <button
                    type="button"
                    onClick={() => removeToast(toast.id)}
                    aria-label="Dismiss notification"
                    className="grid size-6 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)] transition-colors"
                  >
                    <X size={12} weight="bold" />
                  </button>
                </div>

                <p className="mt-1 truncate text-xs font-bold text-[var(--ink)]" title={toast.title}>
                  {toast.title}
                </p>

                {toast.userName && (
                  <p className="mt-0.5 text-[11px] font-medium text-[var(--muted)]">Generated by <span className="font-bold text-[var(--accent-strong)]">{toast.userName}</span></p>
                )}

                <p className="mt-0.5 text-[11px] text-[var(--muted)] line-clamp-1">{toast.sub}</p>

                {/* Action buttons */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {/* View doc button */}
                  {isCompleted && toast.viewUrl && (
                    <a
                      href={toast.viewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--lime)] px-2.5 py-1 text-[10px] font-bold text-[#26320b] hover:brightness-105 active:scale-95 transition-all"
                    >
                      <FileDoc size={11} weight="bold" />
                      <span>View doc</span>
                      <ArrowSquareOut size={10} weight="bold" />
                    </a>
                  )}

                  {/* Direct download button from toast */}
                  {isCompleted && (toast.viewUrl || toast.noteId) && (
                    <button
                      type="button"
                      onClick={() => handleDownloadFromToast(toast)}
                      disabled={isDownloading}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] text-white px-2.5 py-1 text-[10px] font-bold hover:brightness-115 active:scale-95 transition-all disabled:opacity-60"
                      title="Download Word document"
                    >
                      {isDownloading ? (
                        <ArrowsClockwise size={11} weight="bold" className="animate-spin" />
                      ) : (
                        <DownloadSimple size={11} weight="bold" />
                      )}
                      <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
                    </button>
                  )}

                  {/* Open in Site Content button */}
                  <button
                    type="button"
                    onClick={() => handleOpenSiteContent(toast)}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--paper)] px-2.5 py-1 text-[10px] font-bold text-[var(--ink)] hover:bg-[var(--frame)] transition-colors"
                  >
                    <span>Site Content</span>
                    <ArrowSquareOut size={10} weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
