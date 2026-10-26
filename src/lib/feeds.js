import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { asArray } from './safe'
import { api } from '../services/api'

/*
 * Feeds: sections defined in the portal with "+ New feed" (the CRM's Auto Feed entry point). A feed is a CRM module:
 * its fields, the documents it can generate (doc, blog, video, image), the roles that see it and a scheduler prompt
 * that fills it. It is saved as a draft or saved and built; the build makes the module and writes the prompts.
 * Every user sees every feed in the Feeds menu; a feed opens at /feeds/:id.
 */

export const feedPath = (feed) => `/feeds/${feed.id}`

// A build in progress is read again every few seconds until it is built or failed.
export const BUILDING = ['queued', 'building']
const BUILD_RECHECK_MS = 4000

/** Every feed, built or not. Returns the query ({ data: feeds, isLoading, error, ... }). */
export function useFeeds(user) {
  return useQuery({
    queryKey: ['feeds'],
    queryFn: () => api.getAutoFeeds(),
    enabled: Boolean(user?.email),
    staleTime: 60_000,
    select: asArray,
  })
}

/** What a feed can be made of (field types, actions, roles, role access): fixed lists, read once. */
export function useFeedOptions() {
  return useQuery({ queryKey: ['feeds', 'options'], queryFn: () => api.getAutoFeedOptions(), staleTime: 30 * 60_000 })
}

/** One feed's full definition (to show or edit it). */
export function useFeedDefinition(id) {
  return useQuery({ queryKey: ['feeds', 'definition', id], queryFn: () => api.getAutoFeed(id), enabled: Boolean(id), staleTime: 30_000 })
}

/** A feed's build status and log; read again while it is queued or building. */
export function useFeedBuild(id) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['feeds', 'status', id],
    queryFn: async () => {
      const before = queryClient.getQueryData(['feeds', 'status', id])?.status
      const build = await api.getAutoFeedStatus(id)
      // Just built or failed: the menu and the definition show the new state too.
      if (BUILDING.includes(before) && !BUILDING.includes(build.status)) queryClient.invalidateQueries({ predicate: ({ queryKey }) => queryKey[0] === 'feeds' && queryKey[1] !== 'status' })
      return build
    },
    enabled: Boolean(id),
    refetchInterval: (query) => (BUILDING.includes(query.state.data?.status) ? BUILD_RECHECK_MS : false),
  })
}

/** Saves a feed definition (spec.build: true also builds it); resolves with { id, recordUrl }. */
export function useSaveFeed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (spec) => api.saveAutoFeed(spec),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feeds'] }),
  })
}
