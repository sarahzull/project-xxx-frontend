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

const STORAGE_KEY = 'drv_notif_read'

function getReadMap() {
  try { return new Map(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Map() }
}
function saveReadMap(map) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...map])) } catch {}
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
      notifications.value = res.data.data || res.data || []
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
      const res     = await communicationsApi.myList()
      const letters = res.data.data || []
      const readMap = getReadMap()
      notifications.value = letters.map(l => ({
        id:                 l.id,
        type:               'communication',
        communication_type: l.type,   // 'reward' | 'warning'
        title:              l.type === 'reward'
                              ? 'Reward Communication'
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
    addLocal,
  }
})
