import { useState, useRef, useEffect, useMemo } from 'react'
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

const STATUS_THEME = {
  queued: {
    Icon: HourglassMedium,
    iconColor: 'text-[var(--muted)]',
    iconBg: 'bg-[var(--paper)]',
    subtitle: 'Waiting in generation queue...',
    animate: false,
  },
  processing: {
    Icon: Sparkle,
    iconColor: 'text-[var(--lime-dark)]',
    iconBg: 'bg-[var(--lime)]/15',
    subtitle: 'Drafting article & synthesizing sources...',
    animate: true,
  },
  compiling: {
    Icon: Sparkle,
    iconColor: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-amber-500/15',
    subtitle: 'Packaging Word document...',
    animate: true,
  },
  completed: {
    Icon: CheckCircle,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/12',
    subtitle: 'Document is ready to view or download',
    animate: false,
  },
  failed: {
    Icon: WarningCircle,
    iconColor: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-500/12',
    subtitle: 'Generation could not be completed',
    animate: false,
  },
}

export default function DocNotificationBell() {
  const [open, setOpen] = useState(false)
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'unread'
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
      console.warn('Doc download fallback, opening view URL:', err)
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

  const displayedList = useMemo(() => {
    if (filterTab === 'unread') {
      return notifications.filter((n) => !n.read)
    }
    return notifications
  }, [notifications, filterTab])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Document notifications"
        aria-expanded={open}
        className={`${iconButton} relative size-9`}
      >
        <Bell size={17} weight={unreadCount > 0 ? 'fill' : 'light'} />

        {/* Unread badge count or active generation indicator */}
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
          className="absolute right-0 top-12 z-50 w-[min(94vw,23rem)] sm:w-[25rem] rounded-[1.6rem] bg-black/5 p-1.5 ring-1 ring-black/5 shadow-[0_24px_70px_rgba(30,32,25,.18)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <div className="flex max-h-[82vh] flex-col rounded-[calc(1.6rem-.375rem)] bg-[var(--surface)] p-3.5">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)]/50 pb-3 px-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-[var(--ink)]">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-[var(--lime)]/30 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-strong)] ring-1 ring-[var(--lime-dark)]/25">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllAsRead()}
                    title="Mark all as read"
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--ink)] dark:hover:bg-white/[.05] transition-colors"
                  >
                    <Check size={12} weight="bold" />
                    <span>Mark all read</span>
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAll()}
                    title="Clear all notifications"
                    className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/[.04] hover:text-rose-600 dark:hover:bg-white/[.05] transition-colors"
                  >
                    <Trash size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills (All / Unread) */}
            {notifications.length > 0 && unreadCount > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    filterTab === 'all'
                      ? 'bg-[var(--ink)] text-white shadow-xs'
                      : 'text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--ink)]'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('unread')}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    filterTab === 'unread'
                      ? 'bg-[var(--ink)] text-white shadow-xs'
                      : 'text-[var(--muted)] hover:bg-black/[.04] hover:text-[var(--ink)]'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            )}

            {/* Notification List */}
            <div className="mt-2 flex-1 overflow-y-auto pr-0.5 space-y-1.5">
              {displayedList.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)]/60">
                    <CheckCircle size={20} weight="light" />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[var(--ink)]">
                    {filterTab === 'unread' ? 'No unread notifications' : "You're all caught up"}
                  </p>
                  <p className="mt-1 px-6 text-[11px] text-[var(--muted)] leading-relaxed">
                    {filterTab === 'unread'
                      ? 'All current document updates have been marked as read.'
                      : 'Updates will appear here as documents are generated in Site Content.'}
                  </p>
                </div>
              ) : (
                displayedList.map((notif) => {
                  const theme = STATUS_THEME[notif.status] || STATUS_THEME.processing
                  const IconComponent = theme.Icon
                  const isCompleted = notif.status === 'completed'
                  const isDownloading = downloadingId === notif.id

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleOpenItem(notif)}
                      className={`group relative cursor-pointer rounded-2xl p-3 transition-all duration-200 border ${
                        !notif.read
                          ? 'border-[var(--line)] bg-[var(--paper)]/60 hover:bg-[var(--paper)] shadow-xs'
                          : 'border-transparent hover:bg-black/[.03] dark:hover:bg-white/[.03]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Refined status glyph */}
                        <div
                          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${theme.iconBg} ${theme.iconColor}`}
                        >
                          <IconComponent
                            size={16}
                            weight={isCompleted || notif.status === 'failed' ? 'fill' : 'bold'}
                            className={theme.animate ? 'animate-spin' : ''}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Header row: time + unread dot + dismiss */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-medium text-[var(--muted)]">
                              {formatTimeAgo(notif.timestamp)}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {!notif.read && (
                                <span
                                  className="size-1.5 rounded-full bg-[var(--lime-dark)] ring-1 ring-[var(--surface)]"
                                  title="Unread"
                                />
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  removeNotification(notif.id)
                                }}
                                title="Dismiss"
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--muted)] hover:text-rose-600 transition-opacity"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Document Title (headline) */}
                          <h4 className="mt-0.5 line-clamp-2 text-xs font-semibold text-[var(--ink)] leading-snug">
                            {notif.title}
                          </h4>

                          {/* Natural human subtitle (NO TAGS) */}
                          <p className="mt-0.5 text-[11px] text-[var(--muted)] leading-tight">
                            {notif.message || theme.subtitle}
                          </p>

                          {/* Action Buttons for ready documents */}
                          {isCompleted && (
                            <div className="mt-2.5 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isDownloading}
                                onClick={(e) => handleDownload(notif, e)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 active:scale-95 transition-all shadow-xs"
                              >
                                {isDownloading ? (
                                  <Sparkle size={12} className="animate-spin" />
                                ) : (
                                  <DownloadSimple size={12} weight="bold" />
                                )}
                                <span>{isDownloading ? 'Downloading...' : 'Download .doc'}</span>
                              </button>

                              {notif.viewUrl && (
                                <a
                                  href={notif.viewUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 rounded-full bg-[var(--paper)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--surface)] transition-colors"
                                >
                                  <span>View</span>
                                  <ArrowSquareOut size={11} />
                                </a>
                              )}
                            </div>
                          )}
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
