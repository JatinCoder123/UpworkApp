import { Mark } from './ui'

export default function SessionLoader() {
  return <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[var(--paper)] px-6">
    <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--lime)]/10 blur-[100px]" />
    <div role="status" aria-live="polite" className="relative flex flex-col items-center text-center">
      <div className="session-loader-stage" aria-hidden="true">
        <span className="session-loader-orbit"><i /></span>
        <span className="session-loader-ring" />
        <span className="relative z-10 grid size-16 place-items-center rounded-[1.35rem] bg-[var(--surface)] shadow-[0_18px_60px_rgba(30,32,25,.12)] ring-1 ring-black/5">
          <Mark />
        </span>
      </div>
      <p className="mt-8 text-[10px] font-bold uppercase tracking-[.24em] text-[var(--muted)]">UpWorkApp</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-.045em] text-[var(--text)]">Opening your workspace</h1>
      <div className="mt-5 h-1 w-36 overflow-hidden rounded-full bg-[var(--line)]/70" aria-hidden="true">
        <span className="session-loader-progress block h-full w-1/2 rounded-full bg-[var(--lime-dark)]" />
      </div>
      <span className="sr-only">Verifying your secure session</span>
    </div>
  </main>
}
