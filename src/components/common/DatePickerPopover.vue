<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  open:      { type: Boolean, default: false },
  triggerEl: { type: Object,  default: null },
})

const emit = defineEmits(['close'])

const popoverEl = ref(null)
const placement = ref('bottom')
const style = ref({ top: '0px', left: '0px' })

async function position() {
  await nextTick()
  if (!popoverEl.value || !props.triggerEl) return
  const t = props.triggerEl.getBoundingClientRect()
  const p = popoverEl.value.getBoundingClientRect()
  const margin = 6

  const spaceBelow = window.innerHeight - t.bottom
  const spaceAbove = t.top
  const flip = spaceBelow < p.height + margin && spaceAbove > spaceBelow
  placement.value = flip ? 'top' : 'bottom'

  let top = flip
    ? t.top - p.height - margin + window.scrollY
    : t.bottom + margin + window.scrollY

  // Clamp vertically so the popover never escapes the viewport
  // (otherwise a tall popover flipped upward hides its top rows above the fold).
  const minTop = window.scrollY + 8
  const maxTop = window.scrollY + window.innerHeight - p.height - 8
  if (top < minTop) top = minTop
  if (maxTop >= minTop && top > maxTop) top = maxTop

  // If the trigger sits in the right half of the viewport, right-align the
  // popover with the trigger's right edge so it opens leftward instead of
  // hanging off the page.
  const alignRight = t.right > window.innerWidth / 2
  let left = alignRight
    ? t.right + window.scrollX - p.width
    : t.left + window.scrollX
  const maxLeft = window.scrollX + window.innerWidth - p.width - 8
  if (left > maxLeft) left = maxLeft
  if (left < window.scrollX + 8) left = window.scrollX + 8

  style.value = { top: `${top}px`, left: `${left}px` }
}

function onDocClick(e) {
  if (!props.open) return
  if (popoverEl.value?.contains(e.target)) return
  if (props.triggerEl?.contains(e.target)) return
  emit('close')
}
function onKeydown(e) {
  if (e.key === 'Escape' && props.open) {
    emit('close')
    props.triggerEl?.focus()
  }
}
function onResize() { position() }

watch(() => props.open, (o) => {
  if (o) {
    position()
    document.addEventListener('click', onDocClick, true)
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
  } else {
    document.removeEventListener('click', onDocClick, true)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('scroll', onResize, true)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('scroll', onResize, true)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="dpp">
      <div
        v-if="open"
        ref="popoverEl"
        class="dpp"
        role="dialog"
        aria-label="Choose date"
        :style="style"
        :data-placement="placement"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dpp {
  position: absolute;
  z-index: 50;
  /* Slide down from above on bottom-placement; slide up from below on top-placement. */
  --dpp-enter-offset: -4px;
}
.dpp[data-placement="top"] { --dpp-enter-offset: 4px; }

.dpp-enter-active { transition: opacity 140ms ease-out, transform 140ms ease-out; }
.dpp-leave-active { transition: opacity 100ms ease-in,  transform 100ms ease-in; }
.dpp-enter-from, .dpp-leave-to {
  opacity: 0;
  transform: translateY(var(--dpp-enter-offset));
}
</style>
