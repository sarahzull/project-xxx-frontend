import { watch, onBeforeUnmount } from 'vue'

let lockCount     = 0
let savedOverflow = ''
let savedPadding  = ''

function lock() {
  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow
    savedPadding  = document.body.style.paddingRight
    const sbw = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`
  }
  lockCount++
}

function unlock() {
  if (lockCount === 0) return
  lockCount--
  if (lockCount === 0) {
    document.body.style.overflow     = savedOverflow
    document.body.style.paddingRight = savedPadding
  }
}

export function useBodyScrollLock(source) {
  let isOpen = false
  watch(source, (open) => {
    isOpen = !!open
    if (isOpen) lock()
    else        unlock()
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (isOpen) unlock()
  })
}
