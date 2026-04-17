<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { AlertIcon } from '../icons/index.js'

const props = defineProps({
  open:           { type: Boolean, default: false },
  title:          { type: String,  default: 'Delete item?' },
  message:        { type: String,  default: 'Are you sure you want to delete' },
  itemName:       { type: String,  default: '' },
  loading:        { type: Boolean, default: false },
  error:          { type: String,  default: '' },
  overlayClosable:{ type: Boolean, default: false },
})

const emit = defineEmits(['update:open', 'cancel', 'confirm'])

const descriptionPrefix = computed(() => props.message.trim().replace(/[?.!]+$/, ''))

function requestClose(source = 'manual') {
  if (props.loading) return
  if (source === 'overlay' && !props.overlayClosable) return

  emit('cancel')
  emit('update:open', false)
}

function handleConfirm() {
  if (props.loading) return
  emit('confirm')
}

function handleKeydown(event) {
  if (!props.open || props.loading) return
  if (event.key === 'Escape') requestClose('escape')
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) window.addEventListener('keydown', handleKeydown)
    else window.removeEventListener('keydown', handleKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="cdm">
      <div
        v-if="open"
        class="cdm-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-busy="loading ? 'true' : 'false'"
        @click.self="requestClose('overlay')"
      >
        <div class="cdm-panel">
          <div class="cdm-icon-wrap">
            <div class="cdm-icon-box">
              <AlertIcon :size="20" :stroke-width="2" />
            </div>
          </div>

          <div class="cdm-copy">
            <h2 class="cdm-title">{{ title }}</h2>
            <p class="cdm-message">
              {{ descriptionPrefix }}
              <strong v-if="itemName" class="cdm-item">{{ itemName }}</strong><span v-if="itemName">?</span>
              <span v-else>.</span>
              <span class="cdm-warning">This action cannot be undone.</span>
            </p>
          </div>

          <p v-if="error" class="cdm-error">{{ error }}</p>

          <div class="cdm-actions">
            <button
              type="button"
              class="cdm-btn cdm-btn--cancel"
              :disabled="loading"
              @click="requestClose()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="cdm-btn cdm-btn--danger"
              :disabled="loading"
              @click="handleConfirm"
            >
              {{ loading ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cdm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 240;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(4px);
}

.cdm-panel {
  width: min(100%, 440px);
  padding: 24px;
  background: var(--c-surface);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.14), 0 8px 18px rgba(15, 23, 42, 0.08);
}

.cdm-icon-wrap {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
}

.cdm-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(220, 38, 38, 0.14);
  background: linear-gradient(180deg, #fff, #fff8f8);
  color: #c24141;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.06);
}

.cdm-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cdm-title {
  font-size: 1.5rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--c-text-1);
}

.cdm-message {
  font-size: 1rem;
  line-height: 1.65;
  color: var(--c-text-2);
}

.cdm-item {
  font-weight: 700;
  color: var(--c-text-1);
  margin-left: 0.2rem;
}

.cdm-warning {
  display: inline;
  margin-left: 0.35rem;
  font-weight: 600;
  color: #9f1239;
}

.cdm-error {
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(220, 38, 38, 0.16);
  border-radius: 12px;
  background: var(--c-red-tint);
  color: #b91c1c;
  font-size: 0.875rem;
  line-height: 1.45;
}

.cdm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 22px;
}

.cdm-btn {
  min-height: 46px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9375rem;
  font-weight: 600;
  transition: background var(--dur), border-color var(--dur), color var(--dur), opacity var(--dur), box-shadow var(--dur);
}

.cdm-btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.cdm-btn--cancel {
  background: var(--c-surface);
  border-color: var(--c-border);
  color: var(--c-text-2);
  box-shadow: var(--sh-xs);
}

.cdm-btn--cancel:hover:not(:disabled) {
  border-color: var(--c-border);
  background: var(--c-bg);
  color: var(--c-text-1);
}

.cdm-btn--danger {
  background: #cf3f3f;
  border-color: #cf3f3f;
  color: #fff;
  box-shadow: 0 10px 18px rgba(207, 63, 63, 0.22);
}

.cdm-btn--danger:hover:not(:disabled) {
  background: #b93838;
  border-color: #b93838;
}

.cdm-enter-active,
.cdm-leave-active {
  transition: opacity 180ms ease;
}

.cdm-enter-from,
.cdm-leave-to {
  opacity: 0;
}

.cdm-enter-active .cdm-panel,
.cdm-leave-active .cdm-panel {
  transition: transform 200ms ease, opacity 180ms ease;
}

.cdm-enter-from .cdm-panel,
.cdm-leave-to .cdm-panel {
  transform: translateY(6px) scale(0.98);
  opacity: 0;
}

@media (max-width: 520px) {
  .cdm-panel {
    padding: 20px;
    border-radius: 16px;
  }

  .cdm-title {
    font-size: 1.28rem;
  }

  .cdm-message {
    font-size: 0.95rem;
  }
}
</style>
