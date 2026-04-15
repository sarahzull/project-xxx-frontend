import { readonly, reactive } from 'vue'

const DEFAULT_DURATION = 4000
const DEFAULT_TITLES = {
  success: 'Success',
  info: 'Info',
  warning: 'Warning',
  error: 'Error',
}

const state = reactive({
  toasts: [],
})

const timers = new Map()

function clearTimer(id) {
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

function dismissToast(id) {
  clearTimer(id)
  const index = state.toasts.findIndex((toast) => toast.id === id)
  if (index !== -1) state.toasts.splice(index, 1)
}

function showToast(options = {}) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const type = options.type || 'info'
  const toast = {
    id,
    type,
    title: options.title || DEFAULT_TITLES[type] || DEFAULT_TITLES.info,
    message: options.message || '',
    open: true,
    autoClose: options.autoClose !== false,
    duration: Number(options.duration) > 0 ? Number(options.duration) : DEFAULT_DURATION,
  }

  state.toasts.push(toast)

  if (toast.autoClose) {
    const timer = setTimeout(() => dismissToast(id), toast.duration)
    timers.set(id, timer)
  }

  return id
}

export function useToast() {
  return {
    toasts: readonly(state.toasts),
    showToast,
    dismissToast,
    success: (message, options = {}) => showToast({ ...options, type: 'success', message }),
    info: (message, options = {}) => showToast({ ...options, type: 'info', message }),
    warning: (message, options = {}) => showToast({ ...options, type: 'warning', message }),
    error: (message, options = {}) => showToast({ ...options, type: 'error', message }),
  }
}
