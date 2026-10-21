import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asArray, asText } from './safe'
import { permissionForPath } from './permissions'
import { api } from '../services/api'

/*
 * User feedback, saved in the CRM (outr_feedback) through the smart gateway: one record per feedback, linked to the
 * user who gave it. Users see their own; admins see everyone's and set the status. Type and status choices come from
 * the module's dropdowns.
 */

// Used until the CRM's own lists have loaded.
const DEFAULT_TYPES = [['improvement', 'Improvement'], ['bug', 'Bug'], ['idea', 'Idea'], ['other', 'Other']]
const DEFAULT_STATUSES = [['new', 'New'], ['in_progress', 'In progress'], ['done', 'Done'], ['wont_do', "Won't do"]]

const label = (list, id, fallback) => asArray(list).find(([value]) => value === id)?.[1] || fallback

// Pages that need no permission, named for the feedback list.
const OPEN_SECTIONS = { '/profile': 'Profile', '/preferences': 'Preferences', '/activity': 'Activity', '/admin': 'Admin panel', '/onboarding': 'Onboarding', '/feeds': 'Custom feed' }

/** The section a page belongs to ("Jobs", "Site Content", ...): its menu permission name, or a plain name. */
export function sectionForPath(pathname) {
  const path = asText(pathname) || '/'
  return permissionForPath(path) || Object.entries(OPEN_SECTIONS).find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`))?.[1] || 'Portal'
}

/**
 * Feedback from the CRM, newest first: the signed-in user's own (`mine`) or everyone's (admin).
 * Returns { entries, types, statuses, typeLabel, statusLabel, isLoading, error, refetch }.
 */
export function useFeedback({ user, mine = false }) {
  const email = asText(user?.email).toLowerCase()
  const query = useQuery({
    queryKey: ['feedback', mine ? email : 'all'],
    queryFn: () => api.getFeedback({ userEmail: email, mine }),
    enabled: Boolean(email),
    staleTime: 30_000,
  })
  const types = query.data?.options?.type?.length ? query.data.options.type : DEFAULT_TYPES
  const statuses = query.data?.options?.status?.length ? query.data.options.status : DEFAULT_STATUSES
  return {
    entries: asArray(query.data?.records),
    types,
    statuses,
    typeLabel: (id) => label(types, id, 'Other'),
    statusLabel: (id) => label(statuses, id, 'New'),
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/** Sends a feedback from the signed-in user; the lists refresh afterwards. */
export function useSendFeedback(user) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry) => api.createFeedback(user?.email, entry),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback'] }),
  })
}

/** Admin: changes a feedback's status (shown at once, saved in the CRM). */
export function useSetFeedbackStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }) => api.setFeedbackStatus(id, status),
    onMutate: ({ id, status }) => {
      queryClient.setQueriesData({ queryKey: ['feedback'] }, (data) => (data?.records ? { ...data, records: data.records.map((entry) => (entry.id === id ? { ...entry, status } : entry)) } : data))
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['feedback'] }),
  })
}
