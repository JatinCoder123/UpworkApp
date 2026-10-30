import { useEffect } from 'react'
import { isNotFoundError } from '../services/api'

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

/** A record that is not there any more (deleted, expired or a wrong id in the link). `what`: "Job", "Story", "Item". */
export const goneNotice = (what, message = `That ${what.toLowerCase()} no longer exists, has expired or the link is wrong.`) => ({ tone: 'info', title: `${what} not available`, message })

/** A record that could not be read (offline, server down): it may still exist. */
export const failedNotice = (what, error) => ({ title: `Could not open that ${what.toLowerCase()}`, message: error?.message || 'Please try again.' })

/** The toast for an id that did not open a record: gone (nothing came back, or a "not found" error), or not readable now. */
export const openFailedNotice = (what, error) => (!error || isNotFoundError(error) ? goneNotice(what) : failedNotice(what, error))

/**
 * A list whose refresh failed keeps showing what it had (never an error screen over loaded items); this toast says the
 * refresh failed, once per failure. Takes the TanStack result ({ isRefetchError, error, errorUpdatedAt }).
 */
export function useRefreshFailedNotice({ isRefetchError, error, errorUpdatedAt }, what) {
  useEffect(() => {
    if (isRefetchError) notify({ title: `Could not refresh ${what}`, message: `${error?.message || 'Please try again.'} Showing what was loaded before.` })
  }, [isRefetchError, error, errorUpdatedAt, what])
}
