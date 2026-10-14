import { useEffect, useId, useRef, useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'

/**
 * Collapses long content to `collapsedHeight` with a fade and a "View more" toggle.
 * The toggle only appears when the content is actually taller than the collapsed height.
 * `fade` must match the background behind the content.
 */
export default function ExpandableText({ children, collapsedHeight = '7.5rem', fade = 'var(--surface)', className = '' }) {
  const ref = useRef(null)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const [fullHeight, setFullHeight] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const measure = () => {
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const limit = parseFloat(collapsedHeight) * (String(collapsedHeight).endsWith('rem') ? rootSize : 1)
      setFullHeight(element.scrollHeight)
      setOverflowing(element.scrollHeight - limit > 6)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [collapsedHeight, children])

  return <div className={className}>
    <div className="relative">
      <div
        ref={ref}
        id={id}
        style={{ maxHeight: open ? `${fullHeight}px` : collapsedHeight }}
        className="overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(.32,.72,0,1)]"
      >
        {children}
      </div>
      {overflowing && !open && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-16" style={{ background: `linear-gradient(to bottom, transparent, ${fade})` }} />}
    </div>
    {overflowing && <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      aria-controls={id}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--paper)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ink)] ring-1 ring-[var(--line)] transition-colors hover:ring-[var(--lime-dark)]"
    >
      {open ? 'View less' : 'View more'}
      <CaretDown size={12} weight="bold" className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>}
  </div>
}
