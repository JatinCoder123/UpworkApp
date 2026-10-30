import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

/**
 * Horizontal list without a visible scrollbar. Arrow buttons appear on the side
 * that has hidden items. `fade` is the colour behind the list, used for the edge fade.
 */
export default function HScroll({ children, className = '', innerClassName = 'gap-1', fade = 'var(--surface)', label = 'items', ...rest }) {
  const ref = useRef(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const update = useCallback(() => {
    const element = ref.current
    if (!element) return
    const left = element.scrollLeft > 2
    const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 2
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }))
  }, [])

  // Children can change width on any render (counts, selection), so re-measure after each one.
  useLayoutEffect(update)
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [update])

  const scroll = (direction) => {
    const element = ref.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element?.scrollBy({ left: direction * element.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' })
  }

  const arrow = (direction) => <button
    type="button"
    onClick={() => scroll(direction)}
    aria-label={`Scroll ${label} ${direction < 0 ? 'left' : 'right'}`}
    style={{ background: `linear-gradient(${direction < 0 ? 'to right' : 'to left'}, ${fade} 55%, transparent)` }}
    className={`absolute inset-y-0 z-10 flex w-12 items-center ${direction < 0 ? 'left-0 justify-start' : 'right-0 justify-end'}`}
  >
    <span className="grid size-7 place-items-center rounded-full bg-[var(--raised)] text-[var(--ink)] shadow-[0_4px_14px_rgb(var(--shadow-rgb)/.14)] ring-1 ring-[var(--line)] transition-transform hover:scale-110 active:scale-95">{direction < 0 ? <CaretLeft size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}</span>
  </button>

  return <div {...rest} className={`relative min-w-0 ${className}`}>
    <div ref={ref} onScroll={update} className={`no-scrollbar flex overflow-x-auto overscroll-x-contain ${innerClassName}`}>{children}</div>
    {edges.left && arrow(-1)}
    {edges.right && arrow(1)}
  </div>
}
