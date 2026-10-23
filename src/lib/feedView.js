import { useEffect, useState } from 'react'

/*
 * Helpers shared by the feed sections (WordPress, LLM): the universal filter's values and the left index.
 */

/** How many choices are picked across the universal filter's sections ({ key: [values] }). */
export const countFilters = (filters) => Object.values(filters).reduce((total, list) => total + (list?.length || 0), 0)

/** True when `value` (or, for a list like tags, any of its values) is one of the picked choices, or nothing is picked. */
export const picked = (list, value) => !list?.length || (Array.isArray(value) ? value.some((entry) => list.includes(entry)) : list.includes(value))

/** Dropdown key -> its CRM label (the key itself when the list does not have it). `options` is { field: [{ value, label }] }. */
export const labeller = (options) => (field, value) => options[field]?.find((option) => option.value === value)?.label || value

/**
 * The left index: which card is in the middle of the screen (cards carry `data-feed-card={id}`), and a jump that
 * scrolls a card (`id="feed-{id}"`) into view. Re-observes when `items` change.
 */
export function useFeedIndex(items) {
  const [activeId, setActiveId] = useState(null)
  useEffect(() => {
    const cards = document.querySelectorAll('[data-feed-card]')
    if (!cards.length || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.find((entry) => entry.isIntersecting)
      if (visible) setActiveId(visible.target.dataset.feedCard)
    }, { rootMargin: '-35% 0px -60% 0px' })
    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [items])
  const jumpTo = (id) => {
    setActiveId(id)
    document.getElementById(`feed-${id}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  return { activeId, jumpTo }
}
