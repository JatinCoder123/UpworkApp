import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { asObject } from './safe'

const STORAGE_KEY = 'outright-live-crm-saved'

// Live job id -> CRM job id, so a saved job still shows "Saved to CRM" after a reload.
function readSaved() {
  try { return asObject(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) } catch { return {} }
}

/**
 * Saves live Upwork jobs to the CRM jobs module, where they show in the Jobs section.
 * The Jobs list, tab counts and skill counts refresh after each save.
 */
export function useSaveToCrm() {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState(readSaved)
  const mutation = useMutation({
    mutationFn: (job) => api.saveLiveJobToCrm(job),
    onSuccess: (result, job) => {
      setSaved((current) => {
        const next = { ...current, [job.id]: result.id || true }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage unavailable: keep it for this session */ }
        return next
      })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['job-stats'] })
      queryClient.invalidateQueries({ queryKey: ['skill-counts'] })
    },
  })
  const jobId = mutation.variables?.id

  return {
    save: (job) => { if (!saved[job.id] && !mutation.isPending) mutation.mutate(job) },
    isSaved: (id) => Boolean(saved[id]),
    pendingId: mutation.isPending ? jobId : null,
    errorId: mutation.isError ? jobId : null,
    error: mutation.error,
  }
}
