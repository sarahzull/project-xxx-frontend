<script setup>
import { ref, computed, watch } from 'vue'
import { CalendarIcon, ChevronDownIcon } from '../icons/index.js'
import CalendarPanel     from './CalendarPanel.vue'
import DatePickerPopover from './DatePickerPopover.vue'

const props = defineProps({
  from:      { type: String,  default: '' },
  to:        { type: String,  default: '' },
  variant:   { type: String,  default: 'chip' },
  presets:   { type: Array,   default: () => ['today', 'week', 'month', 'last30'] },
  min:       { type: String,  default: '' },
  max:       { type: String,  default: '' },
  disabled:  { type: Boolean, default: false },
  ariaLabel: { type: String,  default: '' },
})

const emit = defineEmits(['update:from', 'update:to'])

const open         = ref(false)
const triggerEl    = ref(null)
const activePreset = ref(null)

const PRESET_META = {
  today:  { label: 'Today'        },
  week:   { label: 'This Week'    },
  month:  { label: 'This Month'   },
  last30: { label: 'Last 30 Days' },
}

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function getPresetRange(key) {
  const now = new Date()
  const today = toISO(now)
  switch (key) {
    case 'today': return { from: today, to: today }
    case 'week': {
      const d = new Date(now)
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      return { from: toISO(d), to: today }
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: toISO(d), to: today }
    }
    case 'last30': {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      return { from: toISO(d), to: today }
    }
    default: return { from: '', to: '' }
  }
}

function fmt(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const displayText = computed(() => {
  if (activePreset.value && activePreset.value !== 'custom') {
    return PRESET_META[activePreset.value].label
  }
  if (props.from && props.to) {
    if (props.from === props.to) return fmt(props.from)
    return `${fmt(props.from)} – ${fmt(props.to)}`
  }
  return 'Date range'
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function selectPreset(key) {
  if (activePreset.value === key) {
    activePreset.value = null
    emit('update:from', '')
    emit('update:to', '')
    open.value = false
    return
  }
  activePreset.value = key
  const range = getPresetRange(key)
  emit('update:from', range.from)
  emit('update:to',   range.to)
  open.value = false
}

function onCalendarSelect(v) {
  if (v && typeof v === 'object') {
    activePreset.value = 'custom'
    emit('update:from', v.from)
    emit('update:to',   v.to)
    open.value = false
  }
}

function onCalendarClear() {
  activePreset.value = null
  emit('update:from', '')
  emit('update:to', '')
  open.value = false
}

// Clear the active preset label when the parent resets both bounds (e.g. Clear Filters),
// so the trigger doesn't keep showing "This Week" while the range is actually empty.
watch([() => props.from, () => props.to], ([f, t]) => {
  if (!f && !t) activePreset.value = null
})
</script>

<template>
  <div class="drp">
    <button
      v-if="variant === 'chip'"
      ref="triggerEl"
      type="button"
      :class="['drp-chip', open && 'drp-chip--open']"
      :disabled="disabled"
      :aria-haspopup="'dialog'"
      :aria-expanded="open"
      :aria-label="ariaLabel || 'Date range'"
      @click="toggle"
    >
      <CalendarIcon :size="14" aria-hidden="true" />
      <span class="drp-chip-text">{{ displayText }}</span>
      <ChevronDownIcon :size="12" :stroke-width="2" :class="['drp-caret', open && 'drp-caret--open']" />
    </button>

    <button
      v-else
      ref="triggerEl"
      type="button"
      :class="['drp-input', !(from && to) && !activePreset && 'drp-input--empty', open && 'drp-input--open']"
      :disabled="disabled"
      :aria-haspopup="'dialog'"
      :aria-expanded="open"
      :aria-label="ariaLabel || 'Date range'"
      @click="toggle"
    >
      <span class="drp-input-text">{{ displayText }}</span>
      <CalendarIcon :size="16" class="drp-input-icon" aria-hidden="true" />
    </button>

    <DatePickerPopover :open="open" :trigger-el="triggerEl" @close="open = false">
      <div class="drp-pop">
        <div v-if="presets.length" class="drp-presets" role="group" aria-label="Quick ranges">
          <button
            v-for="key in presets"
            :key="key"
            type="button"
            :class="['drp-preset', activePreset === key && 'drp-preset--on']"
            :aria-pressed="activePreset === key"
            @click="selectPreset(key)"
          >{{ PRESET_META[key].label }}</button>
        </div>

        <CalendarPanel
          mode="range"
          :from="from"
          :to="to"
          :min="min"
          :max="max"
          @select="onCalendarSelect"
          @clear="onCalendarClear"
        />
      </div>
    </DatePickerPopover>
  </div>
</template>

<style scoped>
.drp { display: inline-block; }

.drp-chip {
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
.drp-chip:hover:not(:disabled) { border-color: var(--c-text-3); }
.drp-chip--open {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.drp-chip-text { white-space: nowrap; }
.drp-caret { transition: transform var(--dur); flex-shrink: 0; }
.drp-caret--open { transform: rotate(180deg); }

.drp-input {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 220px;
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
.drp-input:hover:not(:disabled) { border-color: var(--c-text-3); }
.drp-input--open {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.drp-input--empty .drp-input-text { color: var(--c-text-3); }
.drp-input-icon { color: var(--c-text-3); flex-shrink: 0; }

.drp-pop {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-md);
}
.drp-pop > :deep(.cal) {
  border: none;
  box-shadow: none;
  padding: 4px;
}

.drp-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px;
  background: var(--c-bg);
  border-radius: var(--r-md);
}
.drp-preset {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--c-text-2);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--dur), color var(--dur);
}
.drp-preset:hover:not(.drp-preset--on) { background: var(--c-surface); color: var(--c-text-1); }
.drp-preset--on {
  background: var(--c-surface);
  color: var(--c-accent);
  font-weight: 600;
  box-shadow: var(--sh-xs);
}
</style>
