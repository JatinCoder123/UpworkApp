import { useState, useEffect } from 'react';
import { subscribeDocStatus, getDocInProgress } from './docSocket.js';
import { getDocumentViewUrl } from './api.js';
import { asArray } from '../lib/safe.js';

const STORAGE_KEY = 'upworkapp_doc_notifications';
const MAX_NOTIFICATIONS = 40;

function loadStoredNotifications() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? asArray(JSON.parse(raw)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveStoredNotifications(list) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_NOTIFICATIONS)));
  } catch (e) {
    console.warn('[DocNotifications] Failed to save notifications:', e);
  }
}

// Only docs this user started are kept; notifications saved before ownership was tracked are dropped.
let memoryNotifications = loadStoredNotifications().filter((n) => n.mine);
const listeners = new Set();
// Socket events that belong to one of this user's docs, each with the notification it updated, so the toast can show
// only those (with the notification's title and page).
const ownEvents = new WeakMap();

const isFinal = (status) => status === 'completed' || status === 'failed';

// AppScript outputs (script, blog, video) share their idea's id, so an event also names its output: the
// notification's docType must match the event's type ("type" in the socket payload). The generator calls the
// Apps Script code "appscript".
const OUTPUT_TYPES = { appscript: 'script', script: 'script', blog: 'blog', video: 'video' };
export const outputTypeOf = (event) => OUTPUT_TYPES[String(event?.raw?.type || '').trim().toLowerCase()] || '';
const typeOf = (event) => String(event.docType || outputTypeOf(event) || event.raw?.type || '');

// The user's own notification this event updates. The socket broadcasts every user's docs, so an event
// counts only when it matches a doc this user started: same note, or the same content (and output) while
// that generation is still running and its note id is not known on one side yet.
function findOwnIndex(event) {
  const type = typeOf(event);
  return memoryNotifications.findIndex((n) => n.mine && (!n.docType || !type || n.docType === type) && (
    (event.noteId && n.noteId === event.noteId) ||
    (event.contentId && n.contentId === event.contentId && (!event.noteId || !n.noteId) && !isFinal(n.status))
  ));
}

export function isOwnDocEvent(event) {
  return Boolean(event && typeof event === 'object' && ownEvents.has(event));
}

// The notification an own event updated (title, page to open, output type), or null.
export function notificationOfEvent(event) {
  return (event && typeof event === 'object' && ownEvents.get(event)) || null;
}

// What an AppScript output's notification says at each status.
export const OUTPUT_STATUS_TEXT = {
  queued: 'Waiting for the generator to start…',
  processing: 'Generating…',
  completed: 'Ready to view or download.',
  failed: 'It could not be made. Regenerate it from AppScript.',
};

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener(memoryNotifications);
    } catch (err) {
      console.error('[DocNotifications] Listener error:', err);
    }
  });
}

/**
 * Add or update a notification. `mine: true` marks a doc this user just started;
 * socket events only update those and are ignored for other users' docs.
 * Optional on a new one: `docType` (an AppScript output: script, blog, video) and `path` (the page it opens,
 * Site Content by default). Returns the notification's id (null when the event is not the user's).
 */
export function recordDocNotification(event) {
  if (!event || !event.status) return null;

  const docKey = event.contentId || event.noteId;
  if (!docKey) return null;

  const ownIndex = findOwnIndex(event);
  if (!event.mine && ownIndex < 0) return null;

  const now = Date.now();
  const savedRecord = getDocInProgress(event.contentId, event.noteId);
  // An event without a title keeps the notification's own title.
  const title = event.title || savedRecord?.title || '';
  const userName = event.userName || savedRecord?.userName || '';
  // A new generation has no note yet; the saved record may still hold the previous note's id.
  const noteId = event.noteId || (event.mine ? '' : savedRecord?.noteId) || '';
  const viewUrl = event.viewUrl || (noteId ? getDocumentViewUrl(noteId) : '');
  const documentUrl = event.documentUrl || '';

  const existingIndex = ownIndex;

  if (existingIndex >= 0) {
    const existing = memoryNotifications[existingIndex];
    const isNowFinal = event.status === 'completed' || event.status === 'failed';
    const wasFinal = existing.status === 'completed' || existing.status === 'failed';

    const updated = {
      ...existing,
      status: event.status,
      noteId: noteId || existing.noteId,
      contentId: event.contentId || existing.contentId,
      title: title || existing.title || 'Technical Content Document',
      userName: userName || existing.userName || '',
      viewUrl: viewUrl || existing.viewUrl,
      documentUrl: documentUrl || existing.documentUrl,
      timestamp: now,
      // If status changed to a final state (completed/failed), mark unread to alert the user!
      read: isNowFinal && !wasFinal ? false : existing.read,
    };

    memoryNotifications = [
      updated,
      ...memoryNotifications.filter((_, idx) => idx !== existingIndex),
    ];
    if (typeof event === 'object') ownEvents.set(event, updated);
  } else {
    const newNotif = {
      id: `${event.docType || 'doc'}-${docKey}-${now}`,
      mine: true,
      contentId: event.contentId || '',
      noteId,
      docType: event.docType || '',
      path: event.path || '',
      title: title || 'Technical Content Document',
      userName: userName || '',
      status: event.status,
      viewUrl,
      documentUrl,
      timestamp: now,
      read: false,
    };
    memoryNotifications = [newNotif, ...memoryNotifications];
    if (typeof event === 'object') ownEvents.set(event, newNotif);
  }

  saveStoredNotifications(memoryNotifications);
  emitChange();
  return memoryNotifications[0].id;
}

/**
 * A finished AppScript output's links, read from the CRM, for the user's notification of it when the socket
 * event did not carry them.
 */
export function fillOutputNotificationLinks(contentId, docType, { viewUrl = '', documentUrl = '' } = {}) {
  if (!contentId || !docType || (!viewUrl && !documentUrl)) return;
  let changed = false;
  memoryNotifications = memoryNotifications.map((n) => {
    if (!n.mine || n.contentId !== contentId || n.docType !== docType || n.status !== 'completed' || n.viewUrl || n.documentUrl) return n;
    changed = true;
    return { ...n, viewUrl, documentUrl };
  });
  if (changed) {
    saveStoredNotifications(memoryNotifications);
    emitChange();
  }
}

/**
 * Mark a specific notification as read
 */
export function markNotificationRead(id) {
  let changed = false;
  memoryNotifications = memoryNotifications.map((n) => {
    if (n.id === id && !n.read) {
      changed = true;
      return { ...n, read: true };
    }
    return n;
  });
  if (changed) {
    saveStoredNotifications(memoryNotifications);
    emitChange();
  }
}

/**
 * Mark all notifications as read
 */
export function markAllNotificationsAsRead() {
  let changed = false;
  memoryNotifications = memoryNotifications.map((n) => {
    if (!n.read) {
      changed = true;
      return { ...n, read: true };
    }
    return n;
  });
  if (changed) {
    saveStoredNotifications(memoryNotifications);
    emitChange();
  }
}

/**
 * Delete a specific notification
 */
export function removeNotification(id) {
  memoryNotifications = memoryNotifications.filter((n) => n.id !== id);
  saveStoredNotifications(memoryNotifications);
  emitChange();
}

/**
 * Clear all notifications
 */
export function clearAllNotifications() {
  memoryNotifications = [];
  saveStoredNotifications(memoryNotifications);
  emitChange();
}

/**
 * Get count of unread notifications
 */
export function getUnreadCount() {
  return memoryNotifications.filter((n) => !n.read).length;
}

/**
 * Subscribe to notification list changes
 */
export function subscribeNotifications(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

// Automatically subscribe to incoming WebSocket doc-status events
if (typeof window !== 'undefined') {
  subscribeDocStatus((event) => {
    recordDocNotification(event);
  });
}

/**
 * React hook for consuming notifications in components
 */
export function useDocNotifications() {
  const [notifications, setNotifications] = useState(memoryNotifications);

  useEffect(() => {
    const unsub = subscribeNotifications((updated) => {
      setNotifications([...updated]);
    });
    return unsub;
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    markAsRead: markNotificationRead,
    markAllAsRead: markAllNotificationsAsRead,
    removeNotification,
    clearAll: clearAllNotifications,
  };
}
