import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import notificationsApi  from '../api/notifications'
import communicationsApi from '../api/communications'

/**
 * Notifications store — two-tier strategy:
 *
 * Tier 1 (preferred): dedicated /notifications API endpoint
 * Tier 2 (fallback):  derive notifications from /driver/me/letters and
 *                     persist read state in localStorage until the backend
 *                     implements the /notifications endpoints.
 *
 * Components don't need to know which tier is active.
 */

const STORAGE_KEY  = 'drv_notif_read'
const DISMISS_KEY  = 'drv_notif_dismissed'

function getReadMap() {
  try { return new Map(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Map() }
}
function saveReadMap(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...map])) } catch {}
}

// "Dismissed" = clicked Clear in the bell. Hides the row from the bell
// dropdown only; the underlying communication is untouched, so it still
// shows on the Communications page.
function getDismissedSet() {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]')) }
  catch { return new Set() }
}
function saveDismissedSet(set) {
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...set])) } catch {}
}

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref([])
  const loading       = ref(false)
  const initialized   = ref(false)
  const usingFallback = ref(false)  // true = tier-2 mode

  const unreadCount = computed(() =>
    notifications.value.filter(n => !n.read_at).length
  )
  const hasUnread = computed(() => unreadCount.value > 0)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  async function fetchNotifications() {
    loading.value = true
    try {
      // Tier 1: real notifications endpoint
      const res = await notificationsApi.list()
      const all = res.data.data || res.data || []
      const dismissed = getDismissedSet()
      notifications.value = all.filter(n => !dismissed.has(String(n.id)))
      usingFallback.value = false
    } catch {
      // Tier 2: derive from driver's communications list
      await _fetchFromCommunications()
    } finally {
      loading.value     = false
      initialized.value = true
    }
  }

  async function _fetchFromCommunications() {
    usingFallback.value = true
    try {
      const res       = await communicationsApi.myList()
      const letters   = res.data.data || []
      const readMap   = getReadMap()
      const dismissed = getDismissedSet()
      notifications.value = letters
        .filter(l => !dismissed.has(String(l.id)))
        .map(l => ({
        id:                 l.id,
        type:               'communication',
        communication_type: l.type,   // 'reward' | 'warning' | 'announcement'
        title:              l.type === 'reward'
                              ? 'Reward Communication'
                              : l.type === 'announcement'
                                ? 'Announcement'
                                : 'Warning Communication',
        subject:            l.subject,
        communication_id:   l.id,
        read_at:            readMap.get(String(l.id)) || null,
        created_at:         l.created_at || l.date,
      }))
    } catch {
      // Driver might be an admin hitting wrong endpoint — stay silent
      notifications.value = []
    }
  }

  // ── Mark read ──────────────────────────────────────────────────────────────
  async function markRead(id) {
    const n = notifications.value.find(n => n.id === id)
    if (!n || n.read_at) return
    const ts = new Date().toISOString()
    n.read_at = ts  // optimistic

    if (usingFallback.value) {
      // Persist locally until backend supports the endpoint
      const map = getReadMap()
      map.set(String(id), ts)
      saveReadMap(map)
    } else {
      try {
        await notificationsApi.markRead(id)
      } catch {
        n.read_at = null  // revert
      }
    }
  }

  async function markAllRead() {
    const unread = notifications.value.filter(n => !n.read_at)
    if (!unread.length) return
    const ts = new Date().toISOString()
    unread.forEach(n => { n.read_at = ts })  // optimistic

    if (usingFallback.value) {
      const map = getReadMap()
      unread.forEach(n => map.set(String(n.id), ts))
      saveReadMap(map)
    } else {
      try {
        await notificationsApi.markAllRead()
      } catch {
        unread.forEach(n => { n.read_at = null })  // revert
      }
    }
  }

  function addLocal(notification) {
    notifications.value.unshift(notification)
  }

  /**
   * Dismiss every notification currently shown in the bell. This is a
   * LOCAL hide — the underlying driver_communications + driver_notifications
   * rows are untouched, so the Communications page still lists them. The
   * dismissed ids are persisted to localStorage so they stay hidden across
   * polls and reloads on this device.
   */
  function clearAll() {
    if (!notifications.value.length) return
    const dismissed = getDismissedSet()
    notifications.value.forEach(n => dismissed.add(String(n.id)))
    saveDismissedSet(dismissed)
    notifications.value = []
  }

  // ── Polling ────────────────────────────────────────────────────────────────
  // Lightweight near-real-time updates: re-fetch on an interval, but pause
  // while the browser tab is hidden so we don't burn API calls when the user
  // isn't looking. Resuming a hidden tab triggers an immediate refresh.
  let _pollTimer       = null
  let _pollInterval    = 30000
  let _visibilityBound = false

  function _onVisibilityChange() {
    if (document.hidden) {
      _clearTimer()
    } else {
      fetchNotifications()
      _startTimer()
    }
  }
  function _startTimer() {
    _clearTimer()
    _pollTimer = setInterval(() => {
      if (!document.hidden) fetchNotifications()
    }, _pollInterval)
  }
  function _clearTimer() {
    if (_pollTimer) {
      clearInterval(_pollTimer)
      _pollTimer = null
    }
  }

  function startPolling(intervalMs = 30000) {
    _pollInterval = Math.max(5000, intervalMs)
    if (!_visibilityBound) {
      document.addEventListener('visibilitychange', _onVisibilityChange)
      _visibilityBound = true
    }
    _startTimer()
  }

  function stopPolling() {
    _clearTimer()
    if (_visibilityBound) {
      document.removeEventListener('visibilitychange', _onVisibilityChange)
      _visibilityBound = false
    }
  }

  return {
    notifications,
    loading,
    initialized,
    usingFallback,
    unreadCount,
    hasUnread,
    fetchNotifications,
    markRead,
    markAllRead,
    clearAll,
    addLocal,
    startPolling,
    stopPolling,
  }
})
