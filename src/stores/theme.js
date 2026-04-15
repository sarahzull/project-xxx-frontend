import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(localStorage.getItem('theme') === 'dark')

  function apply(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }

  function toggle() {
    isDark.value = !isDark.value
  }

  // Apply immediately on store creation + whenever it changes
  watch(isDark, (val) => {
    apply(val)
    localStorage.setItem('theme', val ? 'dark' : 'light')
  }, { immediate: true })

  return { isDark, toggle }
})
