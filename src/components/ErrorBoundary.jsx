import { Component } from 'react'
import { Link } from 'react-router-dom'
import { ArrowClockwise, ArrowUpRight, Bug, CaretDown, WarningCircle } from '@phosphor-icons/react'
import ErrorFrame from './ErrorFrame'
import { DialogHeader, Mark, Modal, primaryButton } from './ui'
import { useAuth } from '../contexts/AuthContext'
import { homePath } from '../lib/permissions'

/**
 * Catches render errors below it and shows `fallback` instead of a blank screen.
 * `resetKey` clears the error when it changes (e.g. the route or the job id); `name` labels the console log.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, componentStack: '' }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[ErrorBoundary:${this.props.name || 'app'}]`, error, info?.componentStack)
    this.setState({ componentStack: info?.componentStack || '' })
  }

  componentDidUpdate(previous) {
    if (this.state.error && !Object.is(previous.resetKey, this.props.resetKey)) this.reset()
  }

  reset = () => this.setState({ error: null, componentStack: '' })

  render() {
    if (!this.state.error) return this.props.children
    const Fallback = this.props.fallback || SectionError
    return <Fallback error={this.state.error} componentStack={this.state.componentStack} onReset={this.reset} {...this.props.fallbackProps} />
  }
}

const secondaryButton = 'inline-flex items-center gap-2 rounded-full bg-[var(--paper)] px-5 py-2.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-black/10 transition-all hover:bg-black/5 dark:ring-white/10 dark:hover:bg-white/5'

const errorMessage = (error) => (error?.message ? String(error.message) : 'An unexpected error occurred.')

// A page's code could not be downloaded: the portal was updated since this tab opened, or the connection dropped.
// React keeps that failure for the page, so Try again fails the same way; only a reload fetches the files again.
const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|error loading dynamically imported/i
const isChunkError = (error) => CHUNK_ERROR.test(errorMessage(error))

// Message always; the component stack only in development, where it helps and is not noise.
function ErrorDetails({ error, componentStack }) {
  const stack = import.meta.env.DEV ? (componentStack || error?.stack || '').trim() : ''
  return <details className="group mt-6 w-full rounded-2xl bg-[var(--paper)] text-left ring-1 ring-[var(--line)]/70">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)] [&::-webkit-details-marker]:hidden">
      <Bug size={13} weight="bold" />Technical details<CaretDown size={11} weight="bold" className="ml-auto transition-transform duration-300 group-open:rotate-180" />
    </summary>
    <div className="border-t border-[var(--line)]/70 px-4 py-3">
      <p className="break-words font-mono text-[11px] leading-5 text-[var(--bad)]">{error?.name ? `${error.name}: ` : ''}{errorMessage(error)}</p>
      {stack && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-[var(--muted)] [scrollbar-width:thin]">{stack}</pre>}
    </div>
  </details>
}

function ErrorIcon({ size = 'size-14', iconSize = 26 }) {
  return <span className={`grid ${size} shrink-0 place-items-center rounded-2xl bg-[var(--bad-bg)] text-[var(--bad)] ring-1 ring-[var(--bad)]/15`}><WarningCircle size={iconSize} weight="duotone" /></span>
}

/** Centered error card with the project's double-bezel frame; used by the page and app fallbacks. */
function ErrorCard({ eyebrow, title, description, error, componentStack, actions }) {
  return <section className="w-full max-w-xl rounded-[2rem] bg-black/[.045] p-1.5 ring-1 ring-black/5 dark:bg-white/[.04] dark:ring-white/5">
    <div className="flex flex-col items-center rounded-[calc(2rem-.375rem)] bg-[var(--surface)] px-6 py-10 text-center sm:px-10 sm:py-12">
      <ErrorIcon />
      <span className="mt-6 text-[10px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">{eyebrow}</span>
      <h1 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--ink)] sm:text-3xl">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{description}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{actions}</div>
      <ErrorDetails error={error} componentStack={componentStack} />
    </div>
  </section>
}

/** Last line of defence around the whole app. No Shell or router links, since either may be what failed. */
export function AppError({ error, componentStack }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-[var(--paper)] px-4 py-10">
    <div className="flex w-full max-w-xl flex-col items-center">
      <div className="mb-6 flex items-center gap-2.5 text-sm font-bold tracking-[-.02em]"><Mark />Outright Feed Portal</div>
      <ErrorCard
        eyebrow="Unexpected error"
        title="Something went wrong."
        description="The portal hit a problem it could not recover from. Reloading usually fixes it; your saved filters and preferences are kept."
        error={error}
        componentStack={componentStack}
        actions={<>
          <button type="button" onClick={() => window.location.reload()} className={primaryButton}><span>Reload page</span><span className="grid size-7 place-items-center rounded-full bg-white/15"><ArrowClockwise size={13} /></span></button>
          {/* Outside the router and auth: "/" sends a signed-in user on to their own workspace. */}
          <button type="button" onClick={() => window.location.assign('/')} className={secondaryButton}>Go to my workspace</button>
        </>}
      />
    </div>
  </main>
}

/** One page failed. Standalone like the 404 page (no sidebar, which may be what failed): Try again or go back. */
export function PageError({ error, componentStack, onReset }) {
  const { user } = useAuth()
  const outdated = isChunkError(error)
  return <ErrorFrame>
    <main className="mx-auto grid w-full max-w-[1200px] place-items-center px-4 pb-24 pt-14 sm:px-6 md:pt-20">
      <ErrorCard
        eyebrow={outdated ? 'This page needs a reload' : 'This page could not load'}
        title={outdated ? 'Reload to open this page.' : 'Something went wrong here.'}
        description={outdated
          ? 'Its files could not be downloaded: the portal may have been updated since this tab was opened, or the connection dropped. Reloading fixes it; your saved filters and preferences are kept.'
          : 'An error stopped this page from rendering. Try again, or head back to your workspace while we sort it out.'}
        error={error}
        componentStack={componentStack}
        actions={<>
          {outdated
            ? <button type="button" onClick={() => window.location.reload()} className={primaryButton}><span>Reload page</span><span className="grid size-7 place-items-center rounded-full bg-white/15"><ArrowClockwise size={13} /></span></button>
            : <button type="button" onClick={onReset} className={primaryButton}><span>Try again</span><span className="grid size-7 place-items-center rounded-full bg-white/15"><ArrowClockwise size={13} /></span></button>}
          <Link to={homePath(user)} onClick={onReset} className={secondaryButton}>Back to your workspace<ArrowUpRight size={13} /></Link>
        </>}
      />
    </main>
  </ErrorFrame>
}

/** A panel or the preview drawer failed; the rest of the page keeps working. */
export function SectionError({ error, componentStack, onReset, title = 'This section could not load', className = '' }) {
  return <div role="alert" className={`rounded-[1.6rem] bg-[var(--surface)] p-5 ring-1 ring-[var(--line)]/70 ${className}`}>
    <div className="flex items-start gap-3">
      <ErrorIcon size="size-9" iconSize={17} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">Something went wrong while showing it. The rest of the page still works.</p>
      </div>
      <button type="button" onClick={onReset} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><ArrowClockwise size={12} weight="bold" />Retry</button>
    </div>
    <ErrorDetails error={error} componentStack={componentStack} />
  </div>
}

/** One card in a list failed; the other cards still render. `what` names it ("job", "item", "post"). */
export function CardError({ onReset, error, what = 'job' }) {
  return <div role="alert" title={errorMessage(error)} className="flex items-center gap-3 rounded-[1.6rem] bg-[var(--frame)] p-1 ring-1 ring-[var(--line)]/60">
    <div className="flex flex-1 items-center gap-3 rounded-[calc(1.6rem-.25rem)] bg-[var(--surface)] p-4">
      <ErrorIcon size="size-8" iconSize={15} />
      <p className="min-w-0 flex-1 text-xs text-[var(--muted)]"><span className="font-semibold text-[var(--text)]">This {what} could not be displayed.</span> Its data may be incomplete.</p>
      <button type="button" onClick={onReset} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><ArrowClockwise size={12} weight="bold" />Retry</button>
    </div>
  </div>
}

/** A dialog failed while showing: it stays open with the error, Retry, and its close button; the page keeps working. */
export function DialogError({ error, componentStack, onReset, onClose, title = 'This could not be shown' }) {
  return <Modal onClose={onClose}>
    <DialogHeader eyebrow="Something went wrong" title={title} onClose={onClose} />
    <div role="alert" className="mt-5 flex items-start gap-3">
      <ErrorIcon size="size-9" iconSize={17} />
      <p className="min-w-0 flex-1 text-sm leading-6 text-[var(--muted)]">Its data may be incomplete. The rest of the page still works.</p>
      <button type="button" onClick={onReset} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--paper)] px-3 text-[11px] font-bold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"><ArrowClockwise size={12} weight="bold" />Retry</button>
    </div>
    <ErrorDetails error={error} componentStack={componentStack} />
  </Modal>
}
