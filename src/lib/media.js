import { useSyncExternalStore } from 'react'

// Wide screens (lg, 1024px+) show an item's details beside its list; smaller ones open them in a dialog.
const WIDE_SCREEN = '(min-width: 1024px)'
const watchWideScreen = (onChange) => {
  const query = window.matchMedia(WIDE_SCREEN)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
export const useWideScreen = () => useSyncExternalStore(watchWideScreen, () => window.matchMedia(WIDE_SCREEN).matches)
