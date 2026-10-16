import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

// Jobs still under review; only these move to Applied / Rejected from the detail view.
const OPEN_STATUSES = ['New', 'Seen']

/**
 * CRM status changes for a job: Apply on Upwork marks it Applied, Not a fit marks it Rejected,
 * and undo puts an Applied or Rejected job back to Seen. Lists and tab counts refresh afterwards.
 */
export function useJobStatus() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const mutation = useMutation({
    mutationFn: ({ id, status }) => api.updateStatus({ id, status, userEmail: user?.email }),
    onSuccess: (updatedJob, { id }) => {
      queryClient.setQueryData(['job', id], (current) => (current ? { ...current, ...updatedJob, coverLetter: current.coverLetter || updatedJob.coverLetter } : updatedJob))
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['job-stats'] })
      queryClient.invalidateQueries({ queryKey: ['job-activity', id] })
    },
  })
  // The drawer's job comes from the list and can be older than the job's own query (e.g. New before it was marked Seen).
  const currentStatus = (job) => queryClient.getQueryData(['job', job.id])?.status || job.status
  const change = (job, status) => mutation.mutate({ id: job.id, status })
  const jobId = mutation.variables?.id

  return {
    markApplied: (job) => { if (OPEN_STATUSES.includes(currentStatus(job))) change(job, 'Applied') },
    markNotFit: (job) => { if (OPEN_STATUSES.includes(currentStatus(job))) change(job, 'Rejected') },
    undo: (job) => change(job, 'Seen'),
    pendingId: mutation.isPending ? jobId : null,
    errorId: mutation.isError ? jobId : null,
    error: mutation.error,
  }
}
