import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import safetyApi from '../api/safety'

/**
 * Safety badge store — tiny counter store for the sidebar nav badge.
 *
 * Mirrors the notifications-store pattern: fetch once on app shell mount,
 * surface a single `total` that the layout binds to.
 *
 * The endpoint returns role-aware counts:
 *   - admins  → pending_review (events awaiting review)
 *   - drivers → unread_coachings (notes you haven't acknowledged yet)
 */
export const useSafetyStore = defineStore('safety', () => {
  const pendingReview   = ref(0)
  const unreadCoachings = ref(0)
  const total           = ref(0)
  const initialized     = ref(false)
  const loading         = ref(false)

  const hasBadge = computed(() => total.value > 0)

  async function fetchBadge() {
    loading.value = true
    try {
      const { data } = await safetyApi.badge()
      const d = data?.data || {}
      pendingReview.value   = Number(d.pending_review)   || 0
      unreadCoachings.value = Number(d.unread_coachings) || 0
      total.value           = Number(d.total)            || 0
    } catch {
      // Stay quiet — sidebar should never fail loudly because of a badge fetch
      pendingReview.value = 0
      unreadCoachings.value = 0
      total.value = 0
    } finally {
      loading.value     = false
      initialized.value = true
    }
  }

  /** Optimistic mutators for callers (e.g. driver acks a note in the page). */
  function decrementCoaching(by = 1) {
    unreadCoachings.value = Math.max(0, unreadCoachings.value - by)
    total.value           = Math.max(0, total.value - by)
  }
  function decrementReview(by = 1) {
    pendingReview.value = Math.max(0, pendingReview.value - by)
    total.value         = Math.max(0, total.value - by)
  }

  return {
    pendingReview, unreadCoachings, total, initialized, loading,
    hasBadge,
    fetchBadge, decrementCoaching, decrementReview,
  }
})
