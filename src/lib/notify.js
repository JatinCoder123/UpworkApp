import { useEffect } from 'react'

/*
 * App-wide toasts: notify({ tone, title, message }) from a hook, an effect or an event handler (never while rendering).
 * GlobalErrorToast shows them, with the errors nothing else caught. tone: 'error' (the default) or 'info'.
 */
const listeners = new Set()

export function notify(toast) {
  listeners.forEach((listener) => listener(toast))
}

export function onNotify(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * A list whose refresh failed keeps showing what it had (never an error screen over loaded items); this toast says the
 * refresh failed, once per failure. Takes the TanStack result ({ isRefetchError, error, errorUpdatedAt }).
 */
export function useRefreshFailedNotice({ isRefetchError, error, errorUpdatedAt }, what) {
  useEffect(() => {
    if (isRefetchError) notify({ title: `Could not refresh ${what}`, message: `${error?.message || 'Please try again.'} Showing what was loaded before.` })
  }, [isRefetchError, error, errorUpdatedAt, what])
}
