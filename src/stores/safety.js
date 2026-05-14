import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import safetyApi from '../api/safety'

/**
 * Safety badge store — counts events that occurred YESTERDAY in KL time.
 *
 *   admins  → eventsYesterday  = fleet-wide event count
 *             driversYesterday = distinct drivers involved
 *   drivers → eventsYesterday  = own event count
 *             driversYesterday = 0 or 1 (echoed from server for symmetry)
 *
 * The count is stable for a given day (yesterday's window doesn't move until
 * KL midnight), so there's no optimistic decrement when an admin reviews
 * or a driver acks a note. The next fetchBadge() call refreshes.
 */
export const useSafetyStore = defineStore('safety', () => {
  const eventsYesterday  = ref(0)
  const driversYesterday = ref(0)
  const total            = ref(0)
  const initialized      = ref(false)
  const loading          = ref(false)

  const hasBadge = computed(() => total.value > 0)

  async function fetchBadge() {
    loading.value = true
    try {
      const { data } = await safetyApi.badge()
      const d = data?.data || {}
      eventsYesterday.value  = Number(d.events_yesterday)  || 0
      driversYesterday.value = Number(d.drivers_yesterday) || 0
      total.value            = Number(d.total)             || 0
    } catch {
      // Stay quiet — sidebar should never fail loudly because of a badge fetch
      eventsYesterday.value  = 0
      driversYesterday.value = 0
      total.value            = 0
    } finally {
      loading.value     = false
      initialized.value = true
    }
  }

  return {
    eventsYesterday,
    driversYesterday,
    total, initialized, loading,
    hasBadge,
    fetchBadge,
  }
})
