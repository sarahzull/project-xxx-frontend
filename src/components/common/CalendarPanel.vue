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

// Re-read current date on each call so long-lived mounts don't keep a stale "today".
function getToday() { return new Date() }

const initial = props.modelValue || props.from || toISO(getToday())
const viewYear  = ref(parseYear(initial))
const viewMonth = ref(parseMonth(initial))

function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function parseYear(iso)  { return iso ? Number(iso.slice(0, 4))  : getToday().getFullYear() }
function parseMonth(iso) { return iso ? Number(iso.slice(5, 7)) - 1 : getToday().getMonth() }

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']
const WEEKDAYS    = ['Su','Mo','Tu','We','Th','Fr','Sa']

const cells = computed(() => {
  const nowISO = toISO(getToday())
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const startOffset = first.getDay()
  const gridStart = new Date(first)
  gridStart.setDate(1 - startOffset)

  const result = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    const iso = toISO(d)

    const disabled = Boolean(
      (props.min && iso < props.min) ||
      (props.max && iso > props.max)
    )

    const singleOn = props.mode === 'single' && iso === props.modelValue

    let rangeOn  = false
    let rangeEnd = false
    if (props.mode === 'range') {
      // While the user is actively re-selecting (pendingStart set), prefer the
      // in-progress visualization over the previously committed range — otherwise
      // the first click of a new selection appears to do nothing because the
      // stale from/to keeps painting the old range.
      if (pendingStart.value) {
        rangeOn  = hoverISO.value ? inRange(iso, pendingStart.value, hoverISO.value) : false
        rangeEnd = iso === pendingStart.value || iso === hoverISO.value
      } else if (props.from && props.to) {
        rangeOn  = inRange(iso, props.from, props.to)
        rangeEnd = isEnd(iso, props.from, props.to)
      }
    }

    result.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth.value,
      isToday: iso === nowISO,
      isSelected: singleOn || rangeEnd,
      inRange: rangeOn,
      disabled,
    })
  }
  return result
})

const pendingStart = ref('')
const hoverISO     = ref('')

function inRange(iso, a, b) {
  if (!a || !b) return false
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  return iso > lo && iso < hi
}
function isEnd(iso, a, b) {
  return iso === a || iso === b
}

const viewMode = ref('days') // 'days' | 'months'

function prevStep() {
  if (viewMode.value === 'months') { viewYear.value-- }
  else if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else { viewMonth.value-- }
}
function nextStep() {
  if (viewMode.value === 'months') { viewYear.value++ }
  else if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else { viewMonth.value++ }
}
function toggleHeader() {
  viewMode.value = viewMode.value === 'days' ? 'months' : 'days'
}
function pickMonth(mIdx) {
  viewMonth.value = mIdx
  viewMode.value = 'days'
}

const headerLabel = computed(() =>
  viewMode.value === 'months'
    ? String(viewYear.value)
    : `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`
)

function selectDay(cell) {
  if (cell.disabled) return
  if (!cell.inMonth) {
    viewYear.value  = parseYear(cell.iso)
    viewMonth.value = parseMonth(cell.iso)
  }

  if (props.mode === 'single') {
    emit('select', cell.iso)
    return
  }

  if (!pendingStart.value) {
    pendingStart.value = cell.iso
    return
  }
  const a = pendingStart.value
  const b = cell.iso
  const [from, to] = a <= b ? [a, b] : [b, a]
  pendingStart.value = ''
  hoverISO.value = ''
  emit('select', { from, to })
}

function onDayHover(cell) {
  if (cell.disabled) return
  if (props.mode !== 'range' || !pendingStart.value) return
  hoverISO.value = cell.iso
}

function pickToday() {
  const iso = toISO(getToday())
  viewYear.value  = parseYear(iso)
  viewMonth.value = parseMonth(iso)
  emit('today')
  if (props.mode === 'single') {
    emit('select', iso)
  } else {
    if (pendingStart.value) {
      const [from, to] = pendingStart.value <= iso
        ? [pendingStart.value, iso]
        : [iso, pendingStart.value]
      pendingStart.value = ''
      hoverISO.value = ''
      emit('select', { from, to })
    } else {
      emit('select', { from: iso, to: iso })
    }
  }
}

function pickClear() {
  pendingStart.value = ''
  hoverISO.value = ''
  emit('clear')
  if (props.mode === 'single') emit('select', '')
  else                         emit('select', { from: '', to: '' })
}

watch(() => props.modelValue, (v) => {
  if (v) {
    viewYear.value  = parseYear(v)
    viewMonth.value = parseMonth(v)
  }
})

// Clear pending range state when the parent resets both bounds (e.g. Clear Filters).
watch(() => [props.from, props.to], ([f, t]) => {
  if (!f && !t) {
    pendingStart.value = ''
    hoverISO.value = ''
  }
})

// Seed focus from active selection so keyboard users land on a cell visible in the rendered grid.
const focusedISO = ref(props.modelValue || props.from || toISO(getToday()))
const WEEKDAY_LABELS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}
function dayAriaLabel(cell) {
  const d = new Date(cell.iso + 'T00:00:00')
  return `${WEEKDAY_LABELS[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// Clamp an ISO date to [props.min, props.max] so arrow keys can't land on disabled cells.
function clampISO(iso) {
  if (props.min && iso < props.min) return props.min
  if (props.max && iso > props.max) return props.max
  return iso
}

// Re-anchor focus to the same day-of-month when paging months via PageUp/PageDown.
function focusSameDayInView() {
  const day = Number(focusedISO.value.slice(8, 10))
  const last = new Date(viewYear.value, viewMonth.value + 1, 0).getDate()
  const d = new Date(viewYear.value, viewMonth.value, Math.min(day, last))
  focusedISO.value = clampISO(toISO(d))
}

function onGridKeydown(e) {
  let delta = 0
  switch (e.key) {
    case 'ArrowLeft':  delta = -1; break
    case 'ArrowRight': delta =  1; break
    case 'ArrowUp':    delta = -7; break
    case 'ArrowDown':  delta =  7; break
    case 'PageUp':     prevStep(); focusSameDayInView(); e.preventDefault(); return
    case 'PageDown':   nextStep(); focusSameDayInView(); e.preventDefault(); return
    case 'Home':       focusedISO.value = clampISO(toISO(new Date(viewYear.value, viewMonth.value, 1))); e.preventDefault(); return
    case 'End': {
      const last = new Date(viewYear.value, viewMonth.value + 1, 0)
      focusedISO.value = clampISO(toISO(last)); e.preventDefault(); return
    }
    case 'Enter':
    case ' ': {
      const cell = cells.value.find(c => c.iso === focusedISO.value)
      if (cell) selectDay(cell)
      e.preventDefault()
      return
    }
    default: return
  }
  e.preventDefault()
  const next = clampISO(addDays(focusedISO.value, delta))
  focusedISO.value = next
  viewYear.value  = parseYear(next)
  viewMonth.value = parseMonth(next)
}
</script>

<template>
  <div class="cal">
    <div class="cal-hdr">
      <button
        type="button"
        class="cal-nav"
        :aria-label="viewMode === 'months' ? 'Previous year' : 'Previous month'"
        @click="prevStep"
      >
        <ChevronLeftIcon :size="16" />
      </button>
      <button
        type="button"
        class="cal-hdr-label"
        :aria-label="viewMode === 'months' ? 'Switch to day view' : 'Switch to month view'"
        @click="toggleHeader"
      >{{ headerLabel }}</button>
      <button
        type="button"
        class="cal-nav"
        :aria-label="viewMode === 'months' ? 'Next year' : 'Next month'"
        @click="nextStep"
      >
        <ChevronRightIcon :size="16" />
      </button>
    </div>

    <div v-if="viewMode === 'days'" class="cal-wkrow">
      <span v-for="w in WEEKDAYS" :key="w" class="cal-wk">{{ w }}</span>
    </div>

    <div
      v-if="viewMode === 'days'"
      class="cal-grid"
      role="grid"
      :aria-label="headerLabel"
      @mouseleave="hoverISO = ''"
      @keydown="onGridKeydown"
    >
      <button
        v-for="cell in cells"
        :key="cell.iso"
        type="button"
        role="gridcell"
        :aria-selected="cell.isSelected || cell.inRange"
        :aria-disabled="cell.disabled || undefined"
        :aria-label="dayAriaLabel(cell)"
        :tabindex="cell.iso === focusedISO ? 0 : -1"
        :disabled="cell.disabled"
        :class="[
          'cal-day',
          !cell.inMonth   && 'cal-day--other',
          cell.isToday    && 'cal-day--today',
          cell.isSelected && 'cal-day--on',
          cell.inRange    && 'cal-day--in-range',
          cell.disabled   && 'cal-day--disabled',
        ]"
        @click="selectDay(cell)"
        @mouseenter="onDayHover(cell)"
        @focus="focusedISO = cell.iso"
      >{{ cell.day }}</button>
    </div>

    <div v-else class="cal-months" role="grid" :aria-label="`Select month, ${viewYear}`">
      <button
        v-for="(name, i) in MONTH_NAMES"
        :key="name"
        type="button"
        role="gridcell"
        :aria-selected="i === viewMonth"
        :class="['cal-month', i === viewMonth && 'cal-month--on']"
        @click="pickMonth(i)"
      >{{ name.slice(0, 3) }}</button>
    </div>

    <!-- Footer only in single-date mode; range mode relies on the preset rail + parent Reset -->
    <div v-if="mode === 'single'" class="cal-ftr">
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
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 0.875rem;
  background: transparent;
  border: none;
  color: var(--c-text-1);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background var(--dur);
}
.cal-hdr-label:hover { background: var(--c-bg); }
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
.cal-day--in-range {
  background: var(--c-accent-ring);
  border-radius: 0;
  color: var(--c-text-1);
}
.cal-day--in-range:hover { background: var(--c-accent-ring); }
.cal-day--on {
  background: var(--c-accent);
  color: #fff;
  font-weight: 600;
}

.cal-months {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 8px 0;
  min-height: calc(32px * 6 + 2px * 5 + 6px * 2);
}
.cal-month {
  padding: 10px 0;
  background: transparent;
  border: none;
  border-radius: var(--r-md);
  font-size: 0.8125rem;
  color: var(--c-text-1);
  cursor: pointer;
  transition: background var(--dur), color var(--dur);
}
.cal-month:hover:not(.cal-month--on) { background: var(--c-bg); }
.cal-month--on {
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

.cal-day--disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
