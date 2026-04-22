<script setup>
import { ref, computed } from 'vue'
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '../icons/index.js'
import DatePickerPopover from './DatePickerPopover.vue'

const props = defineProps({
  modelValue: { type: String,  default: '' },       // 'YYYY-MM' or ''
  variant:    { type: String,  default: 'chip' },   // 'chip' | 'input'
  minYear:    { type: Number,  default: 2000 },
  maxYear:    { type: Number,  default: new Date().getFullYear() + 5 },
  ariaLabel:  { type: String,  default: '' },
  disabled:   { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const open      = ref(false)
const triggerEl = ref(null)

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']

function parsePeriod(s) {
  if (!s) return { year: null, month: null }
  const [y, m] = s.split('-').map(Number)
  return { year: y, month: m }
}

const parsed = computed(() => parsePeriod(props.modelValue))

const displayText = computed(() => {
  const { year, month } = parsed.value
  if (!year || !month) return 'Period'
  return `${MONTH_NAMES[month - 1]} ${year}`
})

const viewYear = ref(parsed.value.year || new Date().getFullYear())

function toggle() {
  if (props.disabled) return
  if (!open.value) viewYear.value = parsed.value.year || new Date().getFullYear()
  open.value = !open.value
}

function prevYear() { if (viewYear.value > props.minYear) viewYear.value-- }
function nextYear() { if (viewYear.value < props.maxYear) viewYear.value++ }

function selectMonth(monthIdx) {
  const mm = String(monthIdx + 1).padStart(2, '0')
  emit('update:modelValue', `${viewYear.value}-${mm}`)
  open.value = false
}

function clear() {
  emit('update:modelValue', '')
  open.value = false
}

function isActive(monthIdx) {
  return parsed.value.year === viewYear.value && parsed.value.month === monthIdx + 1
}
</script>

<template>
  <div class="myp">
    <button
      v-if="variant === 'chip'"
      ref="triggerEl"
      type="button"
      :class="['myp-chip', open && 'myp-chip--open']"
      :disabled="disabled"
      :aria-haspopup="'dialog'"
      :aria-expanded="open"
      :aria-label="ariaLabel || 'Month and Year'"
      @click="toggle"
    >
      <CalendarIcon :size="14" aria-hidden="true" />
      <span class="myp-chip-text">{{ displayText }}</span>
      <ChevronDownIcon :size="12" :stroke-width="2" :class="['myp-caret', open && 'myp-caret--open']" />
    </button>

    <button
      v-else
      ref="triggerEl"
      type="button"
      :class="['myp-input', !modelValue && 'myp-input--empty', open && 'myp-input--open']"
      :disabled="disabled"
      :aria-haspopup="'dialog'"
      :aria-expanded="open"
      :aria-label="ariaLabel || 'Month and Year'"
      @click="toggle"
    >
      <span class="myp-input-text">{{ displayText }}</span>
      <CalendarIcon :size="16" class="myp-input-icon" aria-hidden="true" />
    </button>

    <DatePickerPopover :open="open" :trigger-el="triggerEl" @close="open = false">
      <div class="myp-pop">
        <div class="myp-year">
          <button type="button" class="myp-year-nav" :disabled="viewYear <= minYear" aria-label="Previous year" @click="prevYear">
            <ChevronLeftIcon :size="16" />
          </button>
          <span class="myp-year-label">{{ viewYear }}</span>
          <button type="button" class="myp-year-nav" :disabled="viewYear >= maxYear" aria-label="Next year" @click="nextYear">
            <ChevronRightIcon :size="16" />
          </button>
        </div>

        <div class="myp-grid" role="grid" :aria-label="`Select month in ${viewYear}`">
          <button
            v-for="(name, i) in MONTH_NAMES"
            :key="name"
            type="button"
            role="gridcell"
            :aria-selected="isActive(i)"
            :class="['myp-month', isActive(i) && 'myp-month--on']"
            @click="selectMonth(i)"
          >{{ name.slice(0, 3) }}</button>
        </div>

        <div class="myp-footer">
          <button type="button" class="myp-clear" @click="clear">Clear</button>
        </div>
      </div>
    </DatePickerPopover>
  </div>
</template>

<style scoped>
.myp { display: inline-block; }

.myp-chip {
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
.myp-chip:hover:not(:disabled) { border-color: var(--c-text-3); }
.myp-chip--open {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.myp-chip-text { white-space: nowrap; }
.myp-caret { transition: transform var(--dur); flex-shrink: 0; }
.myp-caret--open { transform: rotate(180deg); }

.myp-input {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 180px;
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
.myp-input:hover:not(:disabled) { border-color: var(--c-text-3); }
.myp-input--open {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.myp-input--empty .myp-input-text { color: var(--c-text-3); }
.myp-input-icon { color: var(--c-text-3); flex-shrink: 0; }

.myp-pop {
  width: 260px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-md);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.myp-year {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 4px 2px;
}
.myp-year-label {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--c-text-1);
}
.myp-year-nav {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--c-text-2);
  display: inline-flex;
  transition: background var(--dur), color var(--dur);
}
.myp-year-nav:hover:not(:disabled) { background: var(--c-bg); color: var(--c-text-1); }
.myp-year-nav:disabled { opacity: 0.35; cursor: not-allowed; }

.myp-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.myp-month {
  padding: 10px 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--r-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--c-text-1);
  cursor: pointer;
  transition: background var(--dur), color var(--dur), border-color var(--dur);
}
.myp-month:hover:not(.myp-month--on) {
  background: var(--c-accent-tint, rgba(29,78,216,0.08));
  color: var(--c-accent);
  border-color: color-mix(in srgb, var(--c-accent) 25%, transparent);
}
.myp-month--on {
  background: var(--c-accent);
  color: #fff;
  font-weight: 600;
}

.myp-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
  border-top: 1px solid var(--c-border);
}
.myp-clear {
  padding: 6px 12px;
  background: transparent;
  border: 1px solid var(--c-border);
  border-radius: var(--r-full);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--c-text-2);
  cursor: pointer;
  transition: background var(--dur), color var(--dur), border-color var(--dur);
}
.myp-clear:hover { border-color: var(--c-red, #EF4444); color: var(--c-red, #EF4444); }
</style>
