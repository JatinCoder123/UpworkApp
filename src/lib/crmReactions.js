import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { asArray } from './safe'

const EMPTY = { liked: [], favorites: [] }
// Which engagement flag and total each reaction changes on a job.
const ENGAGEMENT = { liked: ['liked', 'likesCount'], favorites: ['saved', 'savesCount'] }

/**
 * Likes and favorites on CRM jobs, stored per user in the CRM (outr_likes / outr_saves),
 * so they follow the user to any browser.
 * A job fetched with engagement carries the user's own liked/saved flags, which win for that job;
 * the full id lists (for the Favorites / Liked filters and counts) come from the user's records.
 * Toggles show at once and roll back if the CRM rejects them.
 */
export function useCrmReactions(user) {
  const queryClient = useQueryClient()
  const queryKey = ['job-reactions', user?.email]
  const { data = EMPTY, error: loadError } = useQuery({
    queryKey,
    queryFn: () => api.getJobReactions(user),
    enabled: Boolean(user?.email),
    staleTime: 60_000,
  })
  const liked = asArray(data.liked)
  const favorites = asArray(data.favorites)

  const mutation = useMutation({
    mutationFn: ({ kind, id, on }) => api.setJobReaction(user, kind, id, on),
    onMutate: async ({ kind, id, on }) => {
      await Promise.all([queryClient.cancelQueries({ queryKey }), queryClient.cancelQueries({ queryKey: ['job', id] })])
      const previous = { lists: queryClient.getQueryData(queryKey), jobs: queryClient.getQueriesData({ queryKey: ['jobs'] }), job: queryClient.getQueryData(['job', id]) }
      queryClient.setQueryData(queryKey, (current = EMPTY) => {
        const list = asArray(current[kind]).filter((item) => item !== id)
        return { ...current, [kind]: on ? [id, ...list] : list }
      })
      // Keep the job's own engagement in step, in the list pages and in its detail query.
      const [flag, total] = ENGAGEMENT[kind]
      const patch = (job) => (job?.id === id && job.engagement && job.engagement[flag] !== on
        ? { ...job, engagement: { ...job.engagement, [flag]: on, [total]: Math.max(0, (job.engagement[total] || 0) + (on ? 1 : -1)) } }
        : job)
      queryClient.setQueriesData({ queryKey: ['jobs'] }, (pages) => (asArray(pages?.pages).length ? { ...pages, pages: pages.pages.map((page) => ({ ...page, records: asArray(page?.records).map(patch) })) } : pages))
      queryClient.setQueryData(['job', id], (job) => (job ? patch(job) : job))
      return { previous }
    },
    onError: (_error, { id }, context) => {
      if (!context) return
      queryClient.setQueryData(queryKey, context.previous.lists)
      context.previous.jobs.forEach(([key, pages]) => queryClient.setQueryData(key, pages))
      queryClient.setQueryData(['job', id], context.previous.job)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  })

  // The job's engagement flag when it has one, otherwise the user's id list.
  const has = (kind, id, job) => {
    const flag = ENGAGEMENT[kind][0]
    if (job?.id === id && typeof job.engagement?.[flag] === 'boolean') return job.engagement[flag]
    return (kind === 'liked' ? liked : favorites).includes(id)
  }
  const toggle = (kind, id, job) => {
    if (!id || !user?.email) return
    mutation.mutate({ kind, id, on: !has(kind, id, job) })
  }

  return {
    liked,
    favorites,
    isLiked: (id, job) => has('liked', id, job),
    isFavorite: (id, job) => has('favorites', id, job),
    toggleLike: (id, job) => toggle('liked', id, job),
    toggleFavorite: (id, job) => toggle('favorites', id, job),
    error: mutation.error || loadError,
  }
}
