<script setup>
import { ref, computed, watch } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/index.js'

const props = defineProps({
  mode:       { type: String, default: 'single' },
  modelValue: { type: String, default: '' },
  from:       { type: String, default: '' },
  to:         { type: String, default: '' },
  min:        { type: String, default: '' },
  max:        { type: String, default: '' },
})

const emit = defineEmits(['select', 'clear', 'today'])

const today = new Date()
const initial = props.modelValue || props.from || toISO(today)
const viewYear  = ref(parseYear(initial))
const viewMonth = ref(parseMonth(initial))

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function parseYear(iso)  { return iso ? Number(iso.slice(0, 4))  : today.getFullYear() }
function parseMonth(iso) { return iso ? Number(iso.slice(5, 7)) - 1 : today.getMonth() }
function parseDay(iso)   { return iso ? Number(iso.slice(8, 10)) : today.getDate() }

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']
const WEEKDAYS    = ['Su','Mo','Tu','We','Th','Fr','Sa']

const cells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const startOffset = first.getDay()
  const gridStart = new Date(first)
  gridStart.setDate(1 - startOffset)

  const result = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    const iso = toISO(d)
    result.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth.value,
      isToday: iso === toISO(today),
      isSelected: iso === props.modelValue,
    })
  }
  return result
})

const headerLabel = computed(() => `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`)

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

function selectDay(cell) {
  if (!cell.inMonth) {
    viewYear.value  = parseYear(cell.iso)
    viewMonth.value = parseMonth(cell.iso)
  }
  emit('select', cell.iso)
}

function pickToday() {
  const iso = toISO(today)
  viewYear.value  = parseYear(iso)
  viewMonth.value = parseMonth(iso)
  emit('today')
  emit('select', iso)
}

function pickClear() {
  emit('clear')
  emit('select', '')
}

watch(() => props.modelValue, (v) => {
  if (v) {
    viewYear.value  = parseYear(v)
    viewMonth.value = parseMonth(v)
  }
})
</script>

<template>
  <div class="cal">
    <div class="cal-hdr">
      <button type="button" class="cal-nav" aria-label="Previous month" @click="prevMonth">
        <ChevronLeftIcon :size="16" />
      </button>
      <div class="cal-hdr-label">{{ headerLabel }}</div>
      <button type="button" class="cal-nav" aria-label="Next month" @click="nextMonth">
        <ChevronRightIcon :size="16" />
      </button>
    </div>

    <div class="cal-wkrow">
      <span v-for="w in WEEKDAYS" :key="w" class="cal-wk">{{ w }}</span>
    </div>

    <div class="cal-grid" role="grid" :aria-label="headerLabel">
      <button
        v-for="cell in cells"
        :key="cell.iso"
        type="button"
        role="gridcell"
        :aria-selected="cell.isSelected"
        :class="[
          'cal-day',
          !cell.inMonth && 'cal-day--other',
          cell.isToday  && 'cal-day--today',
          cell.isSelected && 'cal-day--on',
        ]"
        @click="selectDay(cell)"
      >{{ cell.day }}</button>
    </div>

    <div class="cal-ftr">
      <button type="button" class="cal-btn cal-btn--primary" @click="pickToday">Today</button>
      <button type="button" class="cal-btn" @click="pickClear">Clear</button>
    </div>
  </div>
</template>

<style scoped>
.cal {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-md);
  padding: 12px;
  width: 280px;
  font-size: 0.8125rem;
  color: var(--c-text-1);
}

.cal-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cal-hdr-label {
  font-weight: 600;
  font-size: 0.875rem;
}
.cal-nav {
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--c-text-2);
  display: inline-flex;
  transition: background var(--dur);
}
.cal-nav:hover { background: var(--c-bg); color: var(--c-text-1); }

.cal-wkrow {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.cal-wk {
  text-align: center;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--c-text-3);
  padding: 6px 0;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.cal-day {
  aspect-ratio: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  font-size: 0.8125rem;
  color: var(--c-text-1);
  cursor: pointer;
  transition: background var(--dur), color var(--dur);
}
.cal-day:hover:not(.cal-day--on) { background: var(--c-bg); }
.cal-day--other { color: var(--c-text-3); opacity: 0.6; }
.cal-day--today:not(.cal-day--on) {
  box-shadow: inset 0 0 0 1.5px var(--c-accent);
}
.cal-day--on {
  background: var(--c-accent);
  color: #fff;
  font-weight: 600;
}

.cal-ftr {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--c-border);
}
.cal-btn {
  flex: 1;
  padding: 8px 12px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--c-text-1);
  cursor: pointer;
  transition: background var(--dur);
}
.cal-btn:hover { background: var(--c-border-light); }
.cal-btn--primary {
  background: var(--c-accent);
  border-color: var(--c-accent);
  color: #fff;
}
.cal-btn--primary:hover { background: var(--c-accent-h); }
</style>
