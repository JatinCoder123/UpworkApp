import { useEffect, useMemo, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { initDocSocket, subscribeDocStatus } from '../services/docSocket'
import { fillOutputNotificationLinks, outputTypeOf, recordDocNotification, removeNotification } from '../services/docNotifications'
import { patchFeedItem } from './gatewayFeed'
import { asObject } from './safe'

/*
 * Outputs generated from a feed item (AppScript's script / blog / video, a "+ New feed" feed's doc / blog / video /
 * image). Each output has the same CRM fields: generate_<type>, <type>_suggestion, <type>_status (set by the generator),
 * <type>_view_url, <type>_download_url and <type>_doc_id; an item's `generation` is { [type]: { requested, status,
 * suggestion, viewUrl, downloadUrl, docId } }.
 */

// Where an output stands. The generator sets the status; a ticked box with no status yet is waiting to start.
export const STAGES = ['queued', 'processing', 'completed', 'failed']
export const stageOf = (output) => (STAGES.includes(output?.status) ? output.status : output?.requested ? 'queued' : 'idle')
export const isRunning = (stage) => stage === 'queued' || stage === 'processing'
// After a socket event, if the item reads the same as before (the CRM not saved yet), it is read once more this later.
const RECHECK_MS = 3000

const generateKey = (feed) => [`${feed}-generate`]

/**
 * Starts making one output (suggestion, generate box and "queued" saved in the CRM by `save(suggestion)`), showing it as
 * queued straight away. It is also the user's own notification (bell and toast, as for Site Content documents): the
 * socket events move it on while the user is on any page, and it opens `path`.
 */
export function useGenerateOutput({ feed, item, type, title, path, save }) {
  const queryClient = useQueryClient()
  const isFeed = (query) => String(query.queryKey[0]).startsWith(`${feed}-`)
  return useMutation({
    mutationKey: generateKey(feed),
    mutationFn: save,
    onMutate: async (suggestion) => {
      // A read already on its way would bring back the old status.
      await queryClient.cancelQueries({ predicate: isFeed })
      const before = item.generation
      patchFeedItem(queryClient, feed, item.id, { generation: { ...before, [type]: { ...before[type], requested: true, status: 'queued', suggestion: suggestion.trim() } } })
      // Before the save: the socket can report "queued" the moment the CRM saves it.
      const notificationId = recordDocNotification({ mine: true, contentId: item.id, docType: type, path, status: 'queued', title })
      return { before, notificationId }
    },
    onError: (_, __, context) => {
      if (context?.before) patchFeedItem(queryClient, feed, item.id, { generation: context.before })
      if (context?.notificationId) removeNotification(context.notificationId)
    },
    onSettled: () => queryClient.invalidateQueries({ predicate: isFeed }),
  })
}

/**
 * While an output is queued or being made, the page does not ask the CRM on a timer: it listens to the backend's
 * WebSocket (the doc-status events Site Content uses for its documents). When an event names one of these items or one
 * of their documents, that item's generation fields are read once (`read(ids)` -> { [id]: generation }), so the cards
 * and the details follow each step. It is also read once when the watch starts (opening or coming back to the page,
 * where the list can be a minute old) and whenever the socket (re)connects, for any change missed meanwhile.
 */
export function useGenerationWatch({ feed, items, types, read: readGeneration }) {
  const queryClient = useQueryClient()
  const watched = useMemo(() => items.filter((item) => types.some((type) => isRunning(stageOf(item.generation[type])))), [items, types])
  const watchedRef = useRef(watched)
  useEffect(() => { watchedRef.current = watched }, [watched])
  const readRef = useRef(readGeneration)
  useEffect(() => { readRef.current = readGeneration }, [readGeneration])
  const typesRef = useRef(types)
  useEffect(() => { typesRef.current = types }, [types])
  const watching = watched.length > 0
  useEffect(() => {
    if (!watching) return undefined
    const timers = new Set()
    // `event`: the socket event that asked for this read (none for the first read and on reconnect).
    const read = async (ids, event) => {
      if (!ids.length) return
      const outputs = typesRef.current
      const before = JSON.stringify(watchedRef.current.filter((item) => ids.includes(item.id)).map((item) => item.generation))
      try {
        const data = await readRef.current(ids)
        Object.entries(data).forEach(([id, generation]) => {
          patchFeedItem(queryClient, feed, id, { generation })
          // A finished output's links for the user's notification, when the socket event had none.
          outputs.forEach((type) => { if (generation[type]?.status === 'completed') fillOutputNotificationLinks(id, type, { viewUrl: generation[type].viewUrl, documentUrl: generation[type].downloadUrl }) })
        })
        // The event can come just before the CRM is saved: if the CRM does not show it yet, one more read a moment
        // later. An event names its output (raw.type), so that output's status tells; otherwise any change does.
        const type = outputTypeOf(event)
        const shown = outputs.includes(type)
          ? ids.every((id) => data[id]?.[type]?.status === event.status)
          : JSON.stringify(ids.map((id) => data[id]).filter(Boolean)) !== before
        if (event && !shown) {
          const timer = setTimeout(() => { timers.delete(timer); read(ids) }, RECHECK_MS)
          timers.add(timer)
        }
      } catch { /* the next event or reconnect reads it again */ }
    }
    const names = (event, item) => {
      const values = [event.contentId, event.noteId, ...Object.values(asObject(event.raw))].map((value) => String(value ?? ''))
      return values.includes(item.id) || typesRef.current.some((type) => item.generation[type]?.docId && values.includes(item.generation[type].docId))
    }
    const unsubscribe = subscribeDocStatus((event) => read(watchedRef.current.filter((item) => names(event, item)).map((item) => item.id), event))
    const socket = initDocSocket()
    const catchUp = () => read(watchedRef.current.map((item) => item.id))
    socket.on('connect', catchUp)
    // The first read; not while Generate is saving (it could bring back the old status: the save refreshes the list).
    if (!queryClient.isMutating({ mutationKey: generateKey(feed) })) catchUp()
    return () => {
      unsubscribe()
      socket.off('connect', catchUp)
      timers.forEach(clearTimeout)
    }
  }, [watching, queryClient, feed])
}
