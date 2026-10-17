import { io } from 'socket.io-client';
import { asObject } from '../lib/safe.js';

export const BACKEND_SOCKET_URL = (
  import.meta.env?.VITE_DOC_SOCKET_URL ||
  import.meta.env?.VITE_BACKEND_URL ||
  import.meta.env?.VITE_AUTH_BASE_URL ||
  'https://upworkapp.backend.outrightcrm.in'
).replace(/\/$/, '');

const DOC_START_TIMES_KEY = 'upworkapp_doc_start_times';
const DOC_IN_PROGRESS_KEY = 'upworkapp_doc_in_progress';
const MAX_IN_PROGRESS_AGE_MS = 25 * 60 * 1000; // 25-minute safety threshold

function loadStorage(key) {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(key);
    return raw ? asObject(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

function saveStorage(key, data) {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`[DocSocket] Failed to persist ${key}:`, e);
  }
}

let startTimesMap = loadStorage(DOC_START_TIMES_KEY);
let inProgressMap = loadStorage(DOC_IN_PROGRESS_KEY);

function cleanupExpired() {
  const now = Date.now();
  let changed = false;
  for (const [id, record] of Object.entries(inProgressMap)) {
    if (record && record.startTime && now - record.startTime > MAX_IN_PROGRESS_AGE_MS) {
      delete inProgressMap[id];
      delete startTimesMap[id];
      changed = true;
    }
  }
  if (changed) {
    saveStorage(DOC_IN_PROGRESS_KEY, inProgressMap);
    saveStorage(DOC_START_TIMES_KEY, startTimesMap);
  }
}
cleanupExpired();

export function recordDocStartTime(contentId, noteId, customTime = Date.now()) {
  const timestamp = Number(customTime) || Date.now();
  let changed = false;

  if (contentId && !startTimesMap[contentId]) {
    startTimesMap[contentId] = timestamp;
    changed = true;
  }
  if (noteId && !startTimesMap[noteId]) {
    startTimesMap[noteId] = timestamp;
    changed = true;
  }
  if (contentId && noteId) {
    const existing = startTimesMap[contentId] || startTimesMap[noteId];
    if (existing) {
      startTimesMap[contentId] = existing;
      startTimesMap[noteId] = existing;
      changed = true;
    }
  }

  if (changed) {
    saveStorage(DOC_START_TIMES_KEY, startTimesMap);
  }
  return timestamp;
}

export function resetDocStartTime(contentId, noteId, newTime = Date.now()) {
  const timestamp = Number(newTime) || Date.now();
  if (contentId) startTimesMap[contentId] = timestamp;
  if (noteId) startTimesMap[noteId] = timestamp;
  saveStorage(DOC_START_TIMES_KEY, startTimesMap);
  return timestamp;
}

export function getDocStartTime(contentId, noteId) {
  if (contentId && startTimesMap[contentId]) return startTimesMap[contentId];
  if (noteId && startTimesMap[noteId]) return startTimesMap[noteId];

  startTimesMap = loadStorage(DOC_START_TIMES_KEY);
  if (contentId && startTimesMap[contentId]) return startTimesMap[contentId];
  if (noteId && startTimesMap[noteId]) return startTimesMap[noteId];

  return null;
}

export function clearDocStartTime(contentId, noteId) {
  let changed = false;
  if (contentId && startTimesMap[contentId]) {
    delete startTimesMap[contentId];
    changed = true;
  }
  if (noteId && startTimesMap[noteId]) {
    delete startTimesMap[noteId];
    changed = true;
  }
  if (changed) {
    saveStorage(DOC_START_TIMES_KEY, startTimesMap);
  }
}

export function saveDocInProgress(contentId, { noteId, status, startTime, title, userName }) {
  if (!contentId && !noteId) return;
  const now = Date.now();
  const st = startTime || getDocStartTime(contentId, noteId) || now;
  const prevRecord = getDocInProgress(contentId, noteId);
  const resolvedUserName = userName || prevRecord?.userName || '';
  const record = {
    contentId: contentId || '',
    noteId: noteId || '',
    status: normalizeDocStatus(status) || 'processing',
    startTime: st,
    title: title || prevRecord?.title || '',
    userName: resolvedUserName,
    updatedAt: now,
  };

  if (contentId) inProgressMap[contentId] = record;
  if (noteId) inProgressMap[noteId] = record;
  saveStorage(DOC_IN_PROGRESS_KEY, inProgressMap);

  recordDocStartTime(contentId, noteId, st);
}

export function getDocInProgress(contentId, noteId) {
  const now = Date.now();
  let record = (contentId && inProgressMap[contentId]) || (noteId && inProgressMap[noteId]);
  if (!record) {
    inProgressMap = loadStorage(DOC_IN_PROGRESS_KEY);
    record = (contentId && inProgressMap[contentId]) || (noteId && inProgressMap[noteId]);
  }

  if (!record) return null;

  if (now - (record.startTime || record.updatedAt || 0) > MAX_IN_PROGRESS_AGE_MS) {
    clearDocInProgress(contentId, noteId);
    return null;
  }
  return record;
}

export function clearDocInProgress(contentId, noteId) {
  let changed = false;
  if (contentId && inProgressMap[contentId]) {
    delete inProgressMap[contentId];
    changed = true;
  }
  if (noteId && inProgressMap[noteId]) {
    delete inProgressMap[noteId];
    changed = true;
  }
  if (changed) {
    saveStorage(DOC_IN_PROGRESS_KEY, inProgressMap);
  }
  clearDocStartTime(contentId, noteId);
}

let socket = null;
const listeners = new Set();
const lastStatusByNoteId = new Map();
const lastStatusByContentId = new Map();

/**
 * Normalizes status strings from backend payloads.
 * Handles 'compiliing', 'compiling', 'queued', 'processing', 'completed', 'failed'.
 */
export function normalizeDocStatus(rawStatus) {
  if (!rawStatus) return '';
  const s = String(rawStatus).toLowerCase().trim();
  if (s === 'compiliing' || s === 'compiling') return 'compiling';
  if (s === 'queued') return 'queued';
  if (s === 'processing' || s === 'process' || s === 'in_progress') return 'processing';
  if (s === 'completed' || s === 'complete' || s === 'ready' || s === 'done') return 'completed';
  if (s === 'failed' || s === 'error') return 'failed';
  return s;
}

/**
 * Singleton Socket.io client instance connected to backend websocket
 */
export function initDocSocket() {
  if (socket) return socket;

  socket = io(BACKEND_SOCKET_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    console.log('[DocSocket] Connected to backend socket:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[DocSocket] Disconnected from backend socket:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[DocSocket] Connection error:', err.message);
  });

  // Listen for the requested 'doc-status' WebSocket event
  socket.on('doc-status', (rawData) => {
    try {
      let data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      if (Array.isArray(data)) data = data[0];
      const noteId =
        data?.['note id'] ||
        data?.note_id ||
        data?.noteId ||
        data?.notes_id ||
        data?.id ||
        '';
      const contentId =
        data?.['content id'] ||
        data?.content_id ||
        data?.contentId ||
        data?.parent_id ||
        data?.query_id ||
        '';
      const status = normalizeDocStatus(data?.status || data?.stage);
      const savedRecord = getDocInProgress(contentId, noteId);
      const title = data?.title || data?.filename || data?.name || data?.headline || savedRecord?.title || '';
      const rawUserName =
        data?.user_name ||
        data?.['user name'] ||
        data?.userName ||
        data?.username ||
        data?.user ||
        data?.generated_by ||
        data?.['generated by'] ||
        '';
      const userName = rawUserName || savedRecord?.userName || '';
      const message = data?.message || data?.description || '';
      const documentUrl =
        data?.download_url ||
        data?.downloadUrl ||
        data?.document_url ||
        data?.documentUrl ||
        '';
      const viewUrl = data?.view_url || data?.viewUrl || '';

      const event = {
        noteId,
        contentId,
        status,
        title,
        userName,
        message,
        documentUrl,
        viewUrl,
        filename: data?.filename || '',
        timestamp: Date.now(),
        raw: data,
      };

      if (noteId) lastStatusByNoteId.set(noteId, event);
      if (contentId) lastStatusByContentId.set(contentId, event);

      // Persist active generation stages across refreshes and route switches
      if (['queued', 'processing', 'compiling'].includes(status)) {
        saveDocInProgress(contentId, { noteId, status, title, userName });
      } else if (status === 'completed' || status === 'failed') {
        clearDocInProgress(contentId, noteId);
      }

      // Notify all active subscribers
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (err) {
          console.error('[DocSocket] Listener execution error:', err);
        }
      });
    } catch (err) {
      console.error('[DocSocket] Failed to parse doc-status payload:', err, rawData);
    }
  });

  return socket;
}

/**
 * Subscribe to real-time doc-status events from the WebSocket.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeDocStatus(callback) {
  listeners.add(callback);
  initDocSocket();
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Retrieve cached status for a given note_id or content_id.
 * Falls back to localStorage across browser page refreshes!
 */
export function getCachedDocStatus(noteId, contentId) {
  if (noteId && lastStatusByNoteId.has(noteId)) return lastStatusByNoteId.get(noteId);
  if (contentId && lastStatusByContentId.has(contentId)) return lastStatusByContentId.get(contentId);

  // Fallback to persisted in-progress storage across browser refreshes
  const inProg = getDocInProgress(contentId, noteId);
  if (inProg) {
    return {
      noteId: inProg.noteId || noteId || '',
      contentId: inProg.contentId || contentId || '',
      status: inProg.status,
      title: inProg.title || '',
      userName: inProg.userName || '',
      startTime: inProg.startTime,
      timestamp: inProg.updatedAt || inProg.startTime,
    };
  }

  return null;
}
