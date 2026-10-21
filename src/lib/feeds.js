import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asArray } from './safe'
import { isAdminUser } from './permissions'
import { api } from '../services/api'

/*
 * Custom feeds: sections any signed-in user adds to the nav ("Feeds" menu) with just a name and a description, saved in
 * the CRM (outr_feeds) through the smart gateway; no developer needed. Every user sees every feed; the creator and
 * admins can delete one. A feed opens at /feeds/:id and shows a Coming Soon page with its description until it is
 * connected to an endpoint, which will take the description as its prompt and return the feed's content.
 */

export const feedPath = (feed) => `/feeds/${feed.id}`

/** True when this user may delete the feed: its creator or an admin. */
export const canDeleteFeed = (user, feed) => isAdminUser(user) || Boolean(feed?.userId && feed.userId === user?.crmUserId)

/** Every custom feed from the CRM, oldest first. Returns the query ({ data: feeds, isLoading, error, ... }). */
export function useFeeds(user) {
  return useQuery({
    queryKey: ['feeds'],
    queryFn: () => api.getFeeds(),
    enabled: Boolean(user?.email),
    staleTime: 60_000,
    select: asArray,
  })
}

/** Creates a feed for the signed-in user; resolves with the new feed's id. The menu refreshes afterwards. */
export function useCreateFeed(user) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (feed) => api.createFeed(user?.email, feed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feeds'] }),
  })
}

export function useDeleteFeed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.deleteFeed(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feeds'] }),
  })
}
