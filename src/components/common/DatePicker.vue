<script setup>
import { ref, computed } from 'vue'
import { CalendarIcon, ChevronDownIcon } from '../icons/index.js'
import CalendarPanel     from './CalendarPanel.vue'
import DatePickerPopover from './DatePickerPopover.vue'

const props = defineProps({
  modelValue:  { type: String,  default: '' },
  variant:     { type: String,  default: 'input' },
  placeholder: { type: String,  default: 'Select date' },
  min:         { type: String,  default: '' },
  max:         { type: String,  default: '' },
  disabled:    { type: Boolean, default: false },
  ariaLabel:   { type: String,  default: '' },
})

const emit = defineEmits(['update:modelValue'])

const open      = ref(false)
const triggerEl = ref(null)

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const displayText = computed(() => {
  if (!props.modelValue || !ISO_RE.test(props.modelValue)) return props.placeholder
  const [y, m, d] = props.modelValue.split('-')
  return `${d}/${m}/${y}`
})

const triggerAria = computed(() => {
  if (props.ariaLabel) {
    return props.modelValue
      ? `${props.ariaLabel}, currently ${displayText.value}`
      : props.ariaLabel
  }
  return props.modelValue ? `Date: ${displayText.value}` : 'Select date'
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}
function onSelect(iso) {
  emit('update:modelValue', iso)
  open.value = false
}
</script>

<template>
  <div class="dp">
    <button
      v-if="variant === 'input'"
      ref="triggerEl"
      type="button"
      :class="['dp-input', !modelValue && 'dp-input--empty', open && 'dp-input--open']"
      :disabled="disabled"
      :aria-haspopup="'dialog'"
      :aria-expanded="open"
      :aria-label="triggerAria"
      @click="toggle"
    >
      <span class="dp-input-text">{{ displayText }}</span>
      <CalendarIcon :size="16" class="dp-input-icon" aria-hidden="true" />
    </button>

    <button
      v-else
      ref="triggerEl"
      type="button"
      :class="['dp-chip', open && 'dp-chip--open']"
      :disabled="disabled"
      :aria-haspopup="'dialog'"
      :aria-expanded="open"
      :aria-label="triggerAria"
      @click="toggle"
    >
      <CalendarIcon :size="14" aria-hidden="true" />
      <span>{{ displayText }}</span>
      <ChevronDownIcon :size="12" :stroke-width="2" :class="['dp-chip-caret', open && 'dp-chip-caret--open']" />
    </button>

    <DatePickerPopover :open="open" :trigger-el="triggerEl" @close="open = false">
      <CalendarPanel
        mode="single"
        :model-value="modelValue"
        :min="min"
        :max="max"
        @select="onSelect"
      />
    </DatePickerPopover>
  </div>
</template>

<style scoped>
.dp { display: inline-block; }

.dp-input {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 160px;
  padding: 8px 10px;
  background: var(--c-surface);
  border: 1.5px solid var(--c-border);
  border-radius: var(--r-md);
  color: var(--c-text-1);
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color var(--dur), box-shadow var(--dur);
  text-align: left;
}
.dp-input:hover:not(:disabled) { border-color: var(--c-text-3); }
.dp-input--open {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.dp-input--empty .dp-input-text { color: var(--c-text-3); }
.dp-input:disabled { opacity: 0.5; cursor: not-allowed; }
.dp-input-icon { color: var(--c-text-3); flex-shrink: 0; }

.dp-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-full);
  color: var(--c-text-1);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dur), box-shadow var(--dur);
  line-height: 1;
}
.dp-chip:hover:not(:disabled) { border-color: var(--c-text-3); }
.dp-chip--open {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.dp-chip:disabled { opacity: 0.5; cursor: not-allowed; }
.dp-chip-caret { transition: transform var(--dur); }
.dp-chip-caret--open { transform: rotate(180deg); }
</style>
