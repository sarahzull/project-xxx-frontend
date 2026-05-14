import { defineStore } from 'pinia'
import basesApi from '../api/bases'

// Single source of truth for base/depot lookup. Loads `/bases` once per
// session and exposes label/tooltip helpers so any view can decorate a base
// code (e.g. "KL", "JB") with its full depot name for new admin/management
// users who haven't memorised the shortforms yet.
export const useBasesStore = defineStore('bases', {
  state: () => ({
    items: [],          // [{ code, label }]
    loaded: false,
    loading: false,
  }),
  getters: {
    labelByCode: (s) => {
      const map = {}
      s.items.forEach((b) => { if (b && b.code) map[b.code] = b.label })
      return map
    },
  },
  actions: {
    async ensureLoaded() {
      if (this.loaded || this.loading) return
      this.loading = true
      try {
        const { data } = await basesApi.list()
        this.items = data?.data || data || []
        this.loaded = true
      } catch {
        this.items = []
      } finally {
        this.loading = false
      }
    },
    labelOf(code) {
      if (!code) return ''
      return this.labelByCode[code] || code
    },
    tooltipOf(code) {
      if (!code) return 'No base assigned'
      const full = this.labelByCode[code]
      return full && full !== code
        ? `BASE ${code} · ${full}`
        : `BASE ${code}`
    },
  },
})
