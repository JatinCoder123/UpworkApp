import { CheckCircle, CircleNotch, NotePencil, WarningCircle } from '@phosphor-icons/react'

// A feed's build status (outr_auto_feed build_status): label, look and icon.
const LOOK = {
  draft: ['Draft', 'bg-[var(--paper)] text-[var(--muted)] ring-[var(--line)]', NotePencil],
  queued: ['Queued', 'bg-[var(--warn-bg)] text-[var(--warn)] ring-[var(--warn)]/25', CircleNotch],
  building: ['Building', 'bg-[var(--warn-bg)] text-[var(--warn)] ring-[var(--warn)]/25', CircleNotch],
  built: ['Built', 'bg-(--lime)/35 text-[var(--accent-strong)] ring-[var(--lime-dark)]/40', CheckCircle],
  failed: ['Failed', 'bg-[var(--bad-bg)] text-[var(--bad)] ring-[var(--bad)]/25', WarningCircle],
}

export default function FeedBuildStatus({ status }) {
  const [text, look, Icon] = LOOK[status] || LOOK.draft
  const spinning = status === 'queued' || status === 'building'
  return <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] ring-1 ${look}`}>
    <Icon size={11} weight="bold" className={spinning ? 'animate-spin' : ''} />{text}
  </span>
}
