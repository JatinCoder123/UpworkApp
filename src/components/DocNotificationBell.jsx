import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  CheckCircle,
  WarningCircle,
  Sparkle,
  HourglassMedium,
  DownloadSimple,
  ArrowSquareOut,
  X,
  Trash,
  Check,
  FileDoc,
} from '@phosphor-icons/react'
import { useDocNotifications } from '../services/docNotifications'
import { getDocumentViewUrl } from '../services/api'
import { iconButton } from './ui'

function formatTimeAgo(timestamp) {
  if (!timestamp) return ''
  const diffSec = Math.floor((Date.now() - timestamp) / 1000)
  if (diffSec < 45) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const STATUS_BADGES = {
  queued: {
    label: 'Queued',
    bg: 'bg-[var(--paper)]',
    text: 'text-[var(--ink)]',
    border: 'border-[var(--line)]',
    Icon: HourglassMedium,
    animate: false,
  },
  processing: {
    label: 'Processing',
    bg: 'bg-[var(--lime)]/15',
    text: 'text-[var(--lime-dark)]',
    border: 'border-[var(--lime-dark)]/30',
    Icon: Sparkle,
    animate: true,
  },
  compiling: {
    label: 'Compiling',
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/30',
    Icon: Sparkle,
    animate: true,
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    Icon: CheckCircle,
    animate: false,
  },
  failed: {
    label: 'Failed',
    bg: 'bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-500/30',
    Icon: WarningCircle,
    animate: false,
  },
}

export default function DocNotificationBell() {
  const [open, setOpen] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
  } = useDocNotifications()

  // Dismiss dropdown on outside click or Esc
  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }

    if (open) {
      document.addEventListener('pointerdown', handlePointerDown)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Handle file download
  const handleDownload = async (notif, e) => {
    e.stopPropagation()
    const viewUrl = notif.viewUrl || (notif.noteId ? getDocumentViewUrl(notif.noteId) : '')
    if (!viewUrl) return

    const baseName = (notif.title || 'document').slice(0, 48).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const downloadFilename = `${baseName}.doc`

    setDownloadingId(notif.id)
    try {
      const fetchUrl = import.meta.env?.DEV && notif.noteId
        ? `/crm-entrypoint/index.php?entryPoint=viewdoc&id=${encodeURIComponent(notif.noteId)}`
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
        setDownloadingId(null)
        markAsRead(notif.id)
        return
      }
    } catch (err) {
      console.warn('Doc download failed, opening in new tab:', err)
    }

    setDownloadingId(null)
    window.open(viewUrl, '_blank')
    markAsRead(notif.id)
  }

  // Handle open site content
  const handleOpenItem = (notif) => {
    markAsRead(notif.id)
    setOpen(false)
    navigate('/site-content')
  }

  const hasActiveJob = notifications.some(
    (n) => ['queued', 'processing', 'compiling'].includes(n.status)
  )

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          if (!open && unreadCount > 0) {
            // Optional: User clicked to open, keep unread pills or clear on demand
          }
        }}
        aria-label="Document generation notifications"
        aria-expanded={open}
        className={`${iconButton} relative size-9`}
      >
        <Bell size={17} weight={unreadCount > 0 ? 'fill' : 'light'} />

        {/* Unread badge count or active generating pulse */}
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--lime-dark)] text-[9px] font-black text-white ring-2 ring-[var(--surface)] shadow-xs animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : hasActiveJob ? (
          <span className="absolute top-1 right-1 flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--lime)] opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-[var(--lime-dark)]" />
          </span>
        ) : null}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Document notifications panel"
          className="absolute right-0 top-12 z-50 w-[min(92vw,22rem)] sm:w-[24rem] rounded-[1.5rem] bg-black/5 p-1.5 ring-1 ring-black/5 shadow-[0_24px_70px_rgba(30,32,25,.18)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex max-h-[80vh] flex-col rounded-[calc(1.5rem-.375rem)] bg-[var(--surface)] p-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]/60 pb-2.5 px-1">
              <div className="flex items-center gap-2">
                <FileDoc size={18} weight="duotone" className="text-[var(--ink)]" />
                <h3 className="text-xs font-bold tracking-tight text-[var(--ink)]">
                  Document Updates
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[var(--lime)] px-1.5 py-0.5 text-[9px] font-bold text-[#26320b] ring-1 ring-[var(--lime-dark)]/25">
                    {unreadCount} new
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    title="Mark all as read"
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--ink)] dark:hover:bg-white/[.04]"
                  >
                    <Check size={12} weight="bold" />
                    <span>Read all</span>
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAll()}
                    title="Clear history"
                    className="rounded-lg p-1 text-[var(--muted)] hover:bg-black/[.04] hover:text-rose-600 dark:hover:bg-white/[.04]"
                  >
                    <Trash size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="mt-1 flex-1 overflow-y-auto pr-0.5 divide-y divide-[var(--line)]/40">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto grid size-10 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)]">
                    <Bell size={18} weight="light" />
                  </div>
                  <p className="mt-3 text-xs font-bold text-[var(--ink)]">No notifications yet</p>
                  <p className="mt-1 px-4 text-[11px] text-[var(--muted)]">
                    Generate articles in Site Content to view real-time document progress and download links here.
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const cfg = STATUS_BADGES[notif.status] || STATUS_BADGES.processing
                  const IconComponent = cfg.Icon
                  const isCompleted = notif.status === 'completed'
                  const isDownloading = downloadingId === notif.id

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleOpenItem(notif)}
                      className={`group relative cursor-pointer px-2 py-3 transition-colors duration-150 hover:bg-black/[.025] dark:hover:bg-white/[.025] rounded-xl ${
                        !notif.read ? 'bg-[var(--lime)]/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border ${cfg.bg} ${cfg.text} ${cfg.border}`}
                        >
                          <IconComponent
                            size={14}
                            weight={isCompleted || notif.status === 'failed' ? 'fill' : 'bold'}
                            className={cfg.animate ? 'animate-spin' : ''}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`rounded-full border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border}`}
                            >
                              {cfg.label}
                            </span>
                            <span className="text-[10px] text-[var(--muted)]">
                              {formatTimeAgo(notif.timestamp)}
                            </span>
                          </div>

                          <h4 className="mt-1 line-clamp-2 text-xs font-semibold text-[var(--ink)] leading-snug">
                            {notif.title}
                          </h4>

                          {/* Action footer */}
                          <div className="mt-2 flex items-center gap-2">
                            {isCompleted && (
                              <button
                                type="button"
                                disabled={isDownloading}
                                onClick={(e) => handleDownload(notif, e)}
                                className="inline-flex items-center gap-1 rounded-md bg-[var(--lime)] px-2 py-1 text-[10px] font-bold text-[#26320b] ring-1 ring-[var(--lime-dark)]/30 hover:bg-[var(--lime)]/90 transition-colors"
                              >
                                {isDownloading ? (
                                  <Sparkle size={11} className="animate-spin" />
                                ) : (
                                  <DownloadSimple size={11} weight="bold" />
                                )}
                                <span>{isDownloading ? 'Downloading...' : 'Download .doc'}</span>
                              </button>
                            )}

                            {notif.viewUrl && (
                              <a
                                href={notif.viewUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded-md bg-[var(--paper)] px-2 py-1 text-[10px] font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface)] transition-colors"
                              >
                                <ArrowSquareOut size={11} />
                                <span>View</span>
                              </a>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeNotification(notif.id)
                              }}
                              title="Dismiss"
                              className="ml-auto opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-rose-600 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
