<!--
  ModalSheet — reusable bottom-sheet on mobile / centred dialog on desktop.

  Props:
    modelValue  – v-model boolean (show/hide)
    title       – modal heading
    subtitle    – muted subheading
    maxWidth    – max-width of the panel, default "480px"

  Slots:
    icon        – placed left of title (optional decorative icon wrapper)
    default     – main scrollable content
    footer      – sticky footer area (optional)

  Emits:
    update:modelValue
-->
<script setup>
import { CloseIcon } from '../icons/index.js'

defineProps({
  modelValue: { type: Boolean, required: true },
  title:      { type: String,  default: '' },
  subtitle:   { type: String,  default: '' },
  maxWidth:   { type: String,  default: '480px' },
})
const emit = defineEmits(['update:modelValue'])
function close() { emit('update:modelValue', false) }
</script>

<template>
  <Teleport to="body">
    <Transition name="ms">
      <div v-if="modelValue" class="ms-backdrop" @click.self="close" role="dialog" aria-modal="true">
        <div class="ms-panel" :style="{ maxWidth }">

          <!-- Head -->
          <div class="ms-head">
            <div class="ms-head-left">
              <slot name="icon" />
              <div v-if="title || subtitle" class="ms-head-text">
                <p v-if="title"    class="ms-title">{{ title }}</p>
                <p v-if="subtitle" class="ms-sub">{{ subtitle }}</p>
              </div>
            </div>
            <button class="ms-close" @click="close" aria-label="Close">
              <CloseIcon :size="16" :stroke-width="2.2" />
            </button>
          </div>

          <!-- Body -->
          <div class="ms-body">
            <slot />
          </div>

          <!-- Footer (optional) -->
          <div v-if="$slots.footer" class="ms-footer">
            <slot name="footer" />
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ── */
.ms-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
@media (min-width: 640px) {
  .ms-backdrop { align-items: center; padding: 24px; }
}

/* ── Panel ── */
.ms-panel {
  width: 100%;
  background: var(--c-surface);
  border-radius: var(--r-2xl) var(--r-2xl) 0 0;
  box-shadow: var(--sh-xl);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
@media (min-width: 640px) {
  .ms-panel { border-radius: var(--r-2xl); max-height: 80vh; }
}

/* ── Head ── */
.ms-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
}
.ms-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.ms-head-text { min-width: 0; }
.ms-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ms-sub {
  font-size: 0.75rem;
  color: var(--c-text-3);
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Close btn ── */
.ms-close {
  width: 30px; height: 30px;
  border-radius: var(--r-md);
  display: flex; align-items: center; justify-content: center;
  color: var(--c-text-3);
  flex-shrink: 0;
  transition: background var(--dur), color var(--dur);
}
.ms-close:hover { background: var(--c-bg); color: var(--c-text-1); }
.ms-close svg { width: 16px; height: 16px; }

/* ── Body & Footer ── */
.ms-body   { overflow-y: auto; flex: 1; }
.ms-footer {
  padding: 10px 18px;
  font-size: 0.75rem;
  color: var(--c-text-3);
  border-top: 1px solid var(--c-border);
  flex-shrink: 0;
  text-align: center;
}

/* ── Transitions ── */
.ms-enter-active { transition: opacity 180ms ease; }
.ms-leave-active { transition: opacity 160ms ease; }
.ms-enter-from, .ms-leave-to { opacity: 0; }

.ms-enter-active .ms-panel { transition: transform 220ms cubic-bezier(0.34,1.3,0.64,1); }
.ms-leave-active .ms-panel  { transition: transform 180ms ease; }
.ms-enter-from .ms-panel    { transform: translateY(100%); }
.ms-leave-to .ms-panel      { transform: translateY(100%); }

@media (min-width: 640px) {
  .ms-enter-active .ms-panel { transition: transform 200ms cubic-bezier(0.34,1.2,0.64,1), opacity 180ms ease; }
  .ms-leave-active .ms-panel { transition: transform 160ms ease, opacity 140ms ease; }
  .ms-enter-from .ms-panel   { transform: scale(0.95); opacity: 0; }
  .ms-leave-to .ms-panel     { transform: scale(0.95); opacity: 0; }
}
</style>
