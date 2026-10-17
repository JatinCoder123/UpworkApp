import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { asArray } from './safe'

const EMPTY = { liked: [], saved: [] }
// Which engagement flag and total each reaction changes on a job.
const ENGAGEMENT = { liked: ['liked', 'likesCount'], saved: ['saved', 'savesCount'] }
const MUTATION_KEY = ['job-reaction']
// The state the user last asked for, per `${kind}:${jobId}`; shared by every hook instance (list and drawer).
const wanted = new Map()

/**
 * Likes and saves on CRM jobs, stored per user in the CRM (outr_likes / outr_saves),
 * so they follow the user to any browser.
 * A job fetched with engagement carries the user's own liked/saved flags, which win for that job;
 * the full id lists (for the Saved / Liked filters and the user's own counts) come from the user's records.
 *
 * Toggles show at once. The CRM writes run one at a time, so an unlike can never reach the CRM before the
 * like it undoes, and a click the user has already reversed is skipped. Only after the last queued write
 * does the job get re-read (for every user's totals) and the id lists refresh.
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
  const saved = asArray(data.saved)

  // Queued or running writes for this job (and reaction, when given).
  const pendingFor = (id, kind) => queryClient.isMutating({ mutationKey: MUTATION_KEY, predicate: (m) => m.state.variables?.id === id && (!kind || m.state.variables?.kind === kind) })
  const updateJob = (id, change) => {
    const apply = (job) => (job?.id === id ? change(job) : job)
    queryClient.setQueriesData({ queryKey: ['jobs'] }, (pages) => (asArray(pages?.pages).length ? { ...pages, pages: pages.pages.map((page) => ({ ...page, records: asArray(page?.records).map(apply) })) } : pages))
    queryClient.setQueryData(['job', id], (job) => (job ? apply(job) : job))
  }
  // Shows `on` for this reaction straight away, in the user's id list and the job's own engagement.
  const show = (kind, id, on) => {
    queryClient.setQueryData(queryKey, (current = EMPTY) => {
      const list = asArray(current[kind]).filter((item) => item !== id)
      return { ...current, [kind]: on ? [id, ...list] : list }
    })
    const [flag, total] = ENGAGEMENT[kind]
    updateJob(id, (job) => (job.engagement && job.engagement[flag] !== on
      ? { ...job, engagement: { ...job.engagement, [flag]: on, [total]: Math.max(0, (job.engagement[total] || 0) + (on ? 1 : -1)) } }
      : job))
  }

  const mutation = useMutation({
    mutationKey: MUTATION_KEY,
    scope: { id: 'job-reactions' },
    // A later click on the same job and reaction already asked for the other state: nothing to send.
    mutationFn: ({ kind, id, on }) => (wanted.get(`${kind}:${id}`) === on ? api.setJobReaction(user, kind, id, on) : Promise.resolve(null)),
    onMutate: async ({ kind, id, on }) => {
      wanted.set(`${kind}:${id}`, on)
      await Promise.all([queryClient.cancelQueries({ queryKey }), queryClient.cancelQueries({ queryKey: ['job', id] })])
      show(kind, id, on)
    },
    onError: (_error, { kind, id, on }) => {
      // Put the reaction back unless the user has clicked it again since.
      if (wanted.get(`${kind}:${id}`) !== on) return
      wanted.set(`${kind}:${id}`, !on)
      show(kind, id, !on)
    },
    // The optimistic count only covers this user's click; once the last write for this job is done,
    // re-read it so the totals include every user's likes and saves.
    onSuccess: async (_result, { id }) => {
      if (pendingFor(id) > 1) return
      const fresh = await api.getJob(id, user?.email).catch(() => null)
      if (!fresh?.engagement || pendingFor(id) > 1) return
      updateJob(id, (job) => ({ ...job, engagement: fresh.engagement }))
    },
    onSettled: (_result, _error, { kind, id }) => {
      if (pendingFor(id, kind) <= 1) wanted.delete(`${kind}:${id}`)
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) <= 1) queryClient.invalidateQueries({ queryKey })
    },
  })

  // While a write is queued, the user's last click; then the job's engagement flag, otherwise the user's id list.
  const has = (kind, id, job) => {
    if (wanted.has(`${kind}:${id}`)) return wanted.get(`${kind}:${id}`)
    const flag = ENGAGEMENT[kind][0]
    if (job?.id === id && typeof job.engagement?.[flag] === 'boolean') return job.engagement[flag]
    return (kind === 'liked' ? liked : saved).includes(id)
  }
  const toggle = (kind, id, job) => {
    if (!id || !user?.email) return
    mutation.mutate({ kind, id, on: !has(kind, id, job) })
  }

  return {
    liked,
    saved,
    isLiked: (id, job) => has('liked', id, job),
    isSaved: (id, job) => has('saved', id, job),
    toggleLike: (id, job) => toggle('liked', id, job),
    toggleSave: (id, job) => toggle('saved', id, job),
    error: mutation.error || loadError,
  }
}
