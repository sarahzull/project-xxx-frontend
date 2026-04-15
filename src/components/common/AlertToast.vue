<script setup>
import { computed } from 'vue'
import {
  CheckCircleIcon, InfoIcon, AlertIcon, CancelIcon, CloseIcon,
} from '../icons/index.js'

const props = defineProps({
  type:      { type: String,  default: 'info' },
  title:     { type: String,  default: '' },
  message:   { type: String,  default: '' },
  open:      { type: Boolean, default: true },
  autoClose: { type: Boolean, default: true },
  duration:  { type: Number,  default: 4000 },
})

const emit = defineEmits(['close'])

const iconComponent = computed(() => {
  if (props.type === 'success') return CheckCircleIcon
  if (props.type === 'warning') return AlertIcon
  if (props.type === 'error') return CancelIcon
  return InfoIcon
})

function handleClose() {
  emit('close')
}
</script>

<template>
  <article
    v-if="open"
    :class="['at', `at--${type}`]"
    role="status"
    :aria-live="type === 'error' ? 'assertive' : 'polite'"
  >
    <div class="at-accent" aria-hidden="true"></div>
    <div class="at-icon">
      <component :is="iconComponent" :size="18" :stroke-width="2.2" />
    </div>
    <div class="at-copy">
      <p class="at-title">{{ title }}</p>
      <p v-if="message" class="at-message">{{ message }}</p>
    </div>
    <button
      type="button"
      class="at-close"
      :aria-label="`Dismiss ${type} notification`"
      @click="handleClose"
    >
      <CloseIcon :size="15" :stroke-width="2.2" />
    </button>
  </article>
</template>

<style scoped>
.at {
  position: relative;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: flex-start;
  gap: 12px;
  width: min(100%, 380px);
  padding: 14px 14px 14px 0;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid var(--c-border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-lg);
  overflow: hidden;
  pointer-events: auto;
}

.at-accent {
  width: 4px;
  align-self: stretch;
  border-radius: 999px;
  margin-left: 10px;
  background: var(--at-accent);
}

.at-icon {
  width: 34px;
  height: 34px;
  margin-top: 1px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--at-bg);
  color: var(--at-accent);
  box-shadow: inset 0 0 0 1px var(--at-ring);
}

.at-copy {
  min-width: 0;
}

.at-title {
  font-size: 0.9375rem;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--at-accent);
}

.at-message {
  margin-top: 4px;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--c-text-2);
}

.at-close {
  width: 30px;
  height: 30px;
  margin-top: -2px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-3);
  transition: background var(--dur), color var(--dur);
}

.at-close:hover {
  background: var(--c-bg);
  color: var(--c-text-1);
}

.at--success {
  --at-accent: #0f8b72;
  --at-bg: #f0fdf8;
  --at-ring: rgba(15, 139, 114, 0.14);
}

.at--info {
  --at-accent: #2563eb;
  --at-bg: #f7faff;
  --at-ring: rgba(37, 99, 235, 0.12);
}

.at--warning {
  --at-accent: #c97a10;
  --at-bg: #fffaf0;
  --at-ring: rgba(201, 122, 16, 0.14);
}

.at--error {
  --at-accent: #c24141;
  --at-bg: #fff7f7;
  --at-ring: rgba(194, 65, 65, 0.13);
}

@media (max-width: 640px) {
  .at {
    width: 100%;
  }
}
</style>
