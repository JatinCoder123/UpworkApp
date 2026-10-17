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

let memoryNotifications = loadStoredNotifications();
const listeners = new Set();

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
 * Add or update notification from a doc-status event
 */
export function recordDocNotification(event) {
  if (!event || !event.status) return;

  const docKey = event.contentId || event.noteId;
  if (!docKey) return;

  const now = Date.now();
  const savedRecord = getDocInProgress(event.contentId, event.noteId);
  const title = event.title || savedRecord?.title || 'Technical Content Document';
  const userName = event.userName || savedRecord?.userName || '';
  const noteId = event.noteId || savedRecord?.noteId || '';
  const viewUrl = event.viewUrl || (noteId ? getDocumentViewUrl(noteId) : '');
  const documentUrl = event.documentUrl || '';

  const existingIndex = memoryNotifications.findIndex(
    (n) => (event.contentId && n.contentId === event.contentId) || (event.noteId && n.noteId === event.noteId)
  );

  if (existingIndex >= 0) {
    const existing = memoryNotifications[existingIndex];
    const isNowFinal = event.status === 'completed' || event.status === 'failed';
    const wasFinal = existing.status === 'completed' || existing.status === 'failed';

    const updated = {
      ...existing,
      status: event.status,
      noteId: noteId || existing.noteId,
      contentId: event.contentId || existing.contentId,
      title: title || existing.title,
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
  } else {
    const newNotif = {
      id: `${docKey}-${now}`,
      contentId: event.contentId || '',
      noteId,
      title,
      userName: userName || '',
      status: event.status,
      viewUrl,
      documentUrl,
      timestamp: now,
      read: false,
    };
    memoryNotifications = [newNotif, ...memoryNotifications];
  }

  saveStoredNotifications(memoryNotifications);
  emitChange();
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
