<script setup>
import AlertToast from './AlertToast.vue'
import { useToast } from '../../composables/useToast'

const { toasts, dismissToast } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="tc-wrap" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="tc">
        <AlertToast
          v-for="toast in toasts"
          :key="toast.id"
          :type="toast.type"
          :title="toast.title"
          :message="toast.message"
          :open="toast.open"
          :auto-close="toast.autoClose"
          :duration="toast.duration"
          @close="dismissToast(toast.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.tc-wrap {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 320;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(calc(100vw - 24px), 400px);
  pointer-events: none;
}

.tc-enter-active,
.tc-leave-active,
.tc-move {
  transition: opacity 200ms ease, transform 220ms ease;
}

.tc-enter-from,
.tc-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

@media (max-width: 640px) {
  .tc-wrap {
    top: 12px;
    right: 12px;
    left: 12px;
    width: auto;
  }
}
</style>
