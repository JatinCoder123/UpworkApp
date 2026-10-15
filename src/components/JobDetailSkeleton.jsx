function Bone({ className = '' }) {
  return <span className={`skeleton-bone block rounded-full ${className}`} />
}

export function DrawerDetailSkeleton() {
  return <div role="status" aria-live="polite" className="space-y-5 p-4 sm:p-6">
    <span className="sr-only">Loading job details</span>
    <div className="rounded-[1.8rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--line)]/70">
      <div className="flex gap-3"><Bone className="h-6 w-20" /><Bone className="h-6 w-32" /></div>
      <div className="mt-6 space-y-3"><Bone className="h-8 w-[92%] rounded-2xl" /><Bone className="h-8 w-[60%] rounded-2xl" /></div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2"><Bone className="h-16 rounded-2xl" /><Bone className="h-16 rounded-2xl" /><Bone className="h-16 rounded-2xl" /><Bone className="h-16 rounded-2xl" /></div>
    </div>
    <div className="space-y-3 rounded-[1.6rem] bg-[var(--surface)] p-6 ring-1 ring-[var(--line)]/70"><Bone className="h-3 w-24" /><Bone className="h-4 w-full rounded-lg" /><Bone className="h-4 w-[90%] rounded-lg" /><Bone className="h-4 w-[75%] rounded-lg" /></div>
  </div>
}

export default function JobDetailSkeleton() {
  return <main role="status" aria-live="polite" className="mx-auto w-full max-w-[1500px] px-4 pb-20 pt-10 sm:px-6 md:pt-14">
    <span className="sr-only">Loading job details</span>
    <div className="flex items-center gap-3"><Bone className="size-9" /><Bone className="h-3 w-28" /></div>
    <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,.75fr)] xl:gap-16">
      <div>
        <div className="flex gap-3"><Bone className="h-6 w-20" /><Bone className="h-6 w-32" /></div>
        <div className="mt-7 space-y-4"><Bone className="h-12 w-[92%] rounded-2xl sm:h-16" /><Bone className="h-12 w-[68%] rounded-2xl sm:h-16" /></div>
        <div className="mt-8 flex items-center gap-4"><Bone className="size-12 rounded-2xl" /><div className="space-y-2"><Bone className="h-3 w-32" /><Bone className="h-2.5 w-20" /></div></div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-[2rem] bg-[var(--line)]/35 p-1.5 sm:grid-cols-3"><Bone className="h-28 rounded-[1.55rem]" /><Bone className="h-28 rounded-[1.55rem]" /><Bone className="h-28 rounded-[1.55rem]" /></div>
        <div className="mt-16 space-y-4"><Bone className="h-3 w-24" /><Bone className="h-5 w-full rounded-lg" /><Bone className="h-5 w-[94%] rounded-lg" /><Bone className="h-5 w-[82%] rounded-lg" /><Bone className="h-5 w-[89%] rounded-lg" /></div>
      </div>
      <aside className="lg:sticky lg:top-28 lg:self-start"><div className="rounded-[2rem] bg-[var(--ink)]/[.06] p-1.5"><div className="rounded-[calc(2rem-.375rem)] bg-[var(--surface)] p-7"><Bone className="h-3 w-20" /><Bone className="mt-7 h-8 w-[88%] rounded-xl" /><Bone className="mt-3 h-3 w-full" /><Bone className="mt-2 h-3 w-[72%]" /><Bone className="mt-8 h-12 w-full" /></div></div></aside>
    </section>
  </main>
}
