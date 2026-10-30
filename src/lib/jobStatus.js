import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

// Reasons offered when a job is marked Not a fit (plus a custom one).
export const REJECT_REASONS = ["Doesn't match skills", 'Job posted too long ago', 'Budget too low', 'Not in my preferred location']

// Jobs still under review; only these move to Applied / Rejected from the detail view.
const OPEN_STATUSES = ['New', 'Seen']

// After a job's status changed: its own entry gets the updated job, and the lists and tab counts load again.
export function refreshJobStatus(queryClient, id, updatedJob) {
  queryClient.setQueryData(['job', id], (current) => (current ? { ...current, ...updatedJob, coverLetter: current.coverLetter || updatedJob.coverLetter } : updatedJob))
  // Before ['jobs']: the Applied tab's list reads this cache entry.
  queryClient.invalidateQueries({ queryKey: ['my-applied'] })
  queryClient.invalidateQueries({ queryKey: ['preferred-jobs'] })
  queryClient.invalidateQueries({ queryKey: ['jobs'] })
  queryClient.invalidateQueries({ queryKey: ['job-stats'] })
  queryClient.invalidateQueries({ queryKey: ['job-activity', id] })
  queryClient.invalidateQueries({ queryKey: ['reject-reasons'] })
}

/**
 * CRM status changes for a job: Not a fit marks it Rejected, and undo puts an Applied or Rejected job back to Seen.
 * Lists and tab counts refresh afterwards. Only a submitted proposal marks a job Applied (see ProposalDialog);
 * Apply on Upwork just opens Upwork.
 */
export function useJobStatus() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const mutation = useMutation({
    mutationFn: ({ id, status, reason }) => api.updateStatus({ id, status, reason, userEmail: user?.email }),
    onSuccess: (updatedJob, { id }) => refreshJobStatus(queryClient, id, updatedJob),
  })
  // The drawer's job comes from the list and can be older than the job's own query (e.g. New before it was marked Seen).
  const currentStatus = (job) => queryClient.getQueryData(['job', job.id])?.status || job.status
  const change = (job, status, reason = '') => mutation.mutate({ id: job.id, status, reason })
  const jobId = mutation.variables?.id

  return {
    // `reason`: one of REJECT_REASONS or the user's own words; it is kept in the job's activity log.
    markNotFit: (job, reason = '') => { if (OPEN_STATUSES.includes(currentStatus(job))) change(job, 'Rejected', reason) },
    undo: (job) => change(job, 'Seen'),
    pendingId: mutation.isPending ? jobId : null,
    errorId: mutation.isError ? jobId : null,
    error: mutation.error,
  }
}
