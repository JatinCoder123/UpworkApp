import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { asArray } from './safe'

/*
 * API Playground (CRM entryPoint=apiPlayground): a test sends a requirement to Claude, as a question ("custom", the
 * reply comes back at once) or to make a doc, blog, app script, video or image (queued, then run by the CRM's worker).
 * Every test is a record in the CRM's Playground module; the list and an opened test are read again every few
 * seconds while a test is waiting or working.
 */

export const PLAYGROUND_ACTIONS = ['custom', 'doc', 'blog', 'appscript', 'video', 'image']
const DONE = ['completed', 'failed']
const RECHECK_MS = 4000

/** True while a test is waiting or working (anything but completed or failed). */
export const isRunning = (test) => !DONE.includes(test?.status)

/** A test's `updated` ("2026-10-27 07:43:55", written by the CRM in UTC) as an ISO time. */
export const testTime = (updated) => (updated ? `${updated.replace(' ', 'T')}Z` : '')

/** Actions, default prompt names, prompts and guidelines a test can use. */
export function usePlaygroundOptions() {
  return useQuery({ queryKey: ['playground', 'options'], queryFn: () => api.getPlaygroundOptions(), staleTime: 10 * 60_000 })
}

/** Ready-made request bodies, by action. */
export function usePlaygroundExamples() {
  return useQuery({ queryKey: ['playground', 'examples'], queryFn: () => api.getPlaygroundExamples(), staleTime: 30 * 60_000 })
}

/** The latest 50 tests, newest first. */
export function usePlaygroundTests() {
  return useQuery({
    queryKey: ['playground', 'tests'],
    queryFn: () => api.getPlaygroundTests(),
    refetchInterval: (query) => (asArray(query.state.data).some(isRunning) ? RECHECK_MS : false),
  })
}

/** One test with its generated result, starting from what the list knows (`summary`). */
export function usePlaygroundTest(summary) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ['playground', 'test', summary.id],
    queryFn: async () => {
      const test = await api.getPlaygroundTest(summary.id)
      // Finished: the list shows the new state too.
      if (!isRunning(test) && isRunning(summary)) queryClient.invalidateQueries({ queryKey: ['playground', 'tests'] })
      return test
    },
    placeholderData: summary,
    refetchInterval: (query) => (isRunning(query.state.data) ? RECHECK_MS : false),
  })
}

/** Runs a new test; resolves with it (a question comes back completed, the others queued). */
export function useRunTest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.runPlaygroundTest(body),
    onSuccess: (test) => {
      queryClient.setQueryData(['playground', 'tests'], (list) => [test, ...asArray(list).filter((item) => item.id !== test.id)])
      queryClient.setQueryData(['playground', 'test', test.id], test)
      queryClient.invalidateQueries({ queryKey: ['playground', 'tests'] })
    },
  })
}

/** Runs a saved test again; the test and the list are read again and follow the new run. */
export function useRerunTest(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.rerunPlaygroundTest(id),
    onSuccess: () => queryClient.invalidateQueries({ predicate: ({ queryKey }) => queryKey[0] === 'playground' && (queryKey[1] === 'tests' || queryKey[2] === id) }),
  })
}

/** A prompt's texts and a guideline's text, by name, read only. */
export function usePlaygroundInstructions(promptName, guidelineName) {
  return useQuery({
    queryKey: ['playground', 'instructions', promptName, guidelineName],
    queryFn: () => api.getGenerationInstructions(promptName, guidelineName),
    enabled: Boolean(promptName || guidelineName),
    staleTime: 60_000,
  })
}
