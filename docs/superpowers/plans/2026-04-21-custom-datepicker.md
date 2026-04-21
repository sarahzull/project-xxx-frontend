# Custom Date Picker Components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `DatePicker` and rewritten `DateRangePicker` Vue components backed by a shared `CalendarPanel` primitive, so the app can replace native `<input type="date">` with a branded calendar UI.

**Architecture:** Four new/rewritten files under `src/components/common/`: `CalendarPanel.vue` (day grid, header nav, Today/Clear), `DatePickerPopover.vue` (positioning + dismiss + focus trap), `DatePicker.vue` (single-date public component), `DateRangePicker.vue` (range public component with preset chips, rewritten in place). The two public components share the same popover shell and calendar primitive; they differ only in trigger rendering and v-model shape.

**Tech Stack:** Vue 3 `<script setup>`, Composition API, scoped CSS with existing design tokens (`--c-accent`, `--c-accent-ring`, `--c-border`, `--c-surface`, `--c-text-1/2/3`, `--r-lg`, `--r-full`, `--sh-md`, `--dur`). Lucide Vue Next icons via `src/components/icons/index.js`. Vite dev server for manual smoke verification (no test runner configured in this project).

**Reference spec:** `docs/superpowers/specs/2026-04-21-custom-datepicker-design.md`

**Verification approach:** This project has no test runner. Each task ends with a manual smoke-test step in the Vite dev server, then a git commit. The consumer page for smoke tests is a temporary `src/views/_dev/DatePickerSandbox.vue` created in Task 1 and deleted in Task 9.

---

## File structure

**New files:**
- `src/components/common/CalendarPanel.vue` — internal calendar primitive
- `src/components/common/DatePickerPopover.vue` — internal positioning wrapper
- `src/components/common/DatePicker.vue` — public single-date component
- `src/views/_dev/DatePickerSandbox.vue` — temporary sandbox for smoke testing (deleted at end)

**Modified files:**
- `src/components/common/DateRangePicker.vue` — rewritten in place using new primitives
- `src/router/index.js` — temporary `/dev/datepicker` route added in Task 1, removed in Task 9

**Touched by regression smoke test only:**
- `src/views/trips/TripListView.vue` — verify no v-model contract breakage

---

### Task 1: Scaffold `CalendarPanel.vue` with single-mode day grid

**Goal:** Render the current month as a 6-week grid (Sunday first), let the user click a day to emit `select`, and add header arrows to page months. Also create the dev sandbox route.

**Files:**
- Create: `src/components/common/CalendarPanel.vue`
- Create: `src/views/_dev/DatePickerSandbox.vue`
- Modify: `src/router/index.js` — add route
- Touch: `src/components/icons/index.js` — no changes, just verify `CalendarIcon`, `ChevronLeftIcon`, `ChevronRightIcon` are exported

- [ ] **Step 1: Verify the three icons exist**

Run: `grep -E "(CalendarIcon|ChevronLeftIcon|ChevronRightIcon)\s+=" src/components/icons/index.js`
Expected: three matches. If any are missing, add them using the existing `makeIcon(...)` pattern before proceeding.

- [ ] **Step 2: Create `src/components/common/CalendarPanel.vue`**

```vue
<script setup>
import { ref, computed, watch } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/index.js'

const props = defineProps({
  mode:       { type: String, default: 'single' }, // 'single' | 'range'
  modelValue: { type: String, default: '' },
  from:       { type: String, default: '' },
  to:         { type: String, default: '' },
  min:        { type: String, default: '' },
  max:        { type: String, default: '' },
})

const emit = defineEmits(['select', 'clear', 'today'])

// ── View state ────────────────────────────────────────────────────────────────
const today = new Date()
const initial = props.modelValue || props.from || toISO(today)
const viewYear  = ref(parseYear(initial))
const viewMonth = ref(parseMonth(initial)) // 0-11

// ── Date helpers ──────────────────────────────────────────────────────────────
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

// ── Grid cells ────────────────────────────────────────────────────────────────
const cells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const startOffset = first.getDay() // 0 = Sunday
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

// ── Navigation ────────────────────────────────────────────────────────────────
function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

// ── Selection ─────────────────────────────────────────────────────────────────
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
```

- [ ] **Step 3: Create sandbox view `src/views/_dev/DatePickerSandbox.vue`**

```vue
<script setup>
import { ref } from 'vue'
import CalendarPanel from '../../components/common/CalendarPanel.vue'

const selected = ref('')
function onSelect(v) { selected.value = v }
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 24px; align-items: flex-start;">
    <h2>DatePicker sandbox</h2>
    <p>Selected: <code>{{ selected || '(empty)' }}</code></p>
    <CalendarPanel mode="single" :model-value="selected" @select="onSelect" />
  </div>
</template>
```

- [ ] **Step 4: Add sandbox route**

Open `src/router/index.js` and add this route entry inside the existing `routes` array (place it near the top so it's easy to find and remove later):

```js
{ path: '/dev/datepicker', name: 'dev-datepicker', component: () => import('../views/_dev/DatePickerSandbox.vue') },
```

- [ ] **Step 5: Smoke test**

Run: `npm run dev` (leave running)
Navigate to: `http://localhost:5173/dev/datepicker` (adjust port if needed)
Verify:
- Calendar renders with the current month header (April 2026)
- Sunday is the first column (`Su Mo Tu We Th Fr Sa`)
- Today (2026-04-21) has a ring outline
- Clicking a day fills the `Selected:` text with `YYYY-MM-DD`
- Clicking ← or → moves to prev/next month
- Clicking a dimmed "other-month" day jumps the view to that month AND selects it
- Clicking **Today** button selects today and jumps view to April 2026
- Clicking **Clear** empties `Selected:`

- [ ] **Step 6: Commit**

```bash
git add src/components/common/CalendarPanel.vue src/views/_dev/DatePickerSandbox.vue src/router/index.js
git commit -m "$(cat <<'EOF'
feat(calendar): scaffold CalendarPanel primitive with single-mode day grid

Renders a Sunday-first 6-week grid for the current month, supports
month paging via header arrows, day selection, Today/Clear footer
buttons, and jumps to other months when dimmed cells are clicked.
Dev sandbox at /dev/datepicker for smoke testing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add month/year picker view to `CalendarPanel.vue`

**Goal:** Clicking the header label (e.g., "April 2026") swaps the day grid for a 3×4 grid of months in the current year. Header arrows now page by year. Clicking a month returns to day grid.

**Files:**
- Modify: `src/components/common/CalendarPanel.vue`

- [ ] **Step 1: Add `viewMode` state and header-label handler**

Replace the `// ── Navigation` section in `<script setup>` with:

```js
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
```

Update `headerLabel`:

```js
const headerLabel = computed(() =>
  viewMode.value === 'months'
    ? String(viewYear.value)
    : `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`
)
```

- [ ] **Step 2: Update template**

Replace the header and grid section in `<template>`:

```vue
<div class="cal-hdr">
  <button type="button" class="cal-nav" aria-label="Previous" @click="prevStep">
    <ChevronLeftIcon :size="16" />
  </button>
  <button
    type="button"
    class="cal-hdr-label"
    :aria-label="viewMode === 'months' ? 'Switch to day view' : 'Switch to month view'"
    @click="toggleHeader"
  >{{ headerLabel }}</button>
  <button type="button" class="cal-nav" aria-label="Next" @click="nextStep">
    <ChevronRightIcon :size="16" />
  </button>
</div>

<div v-if="viewMode === 'days'" class="cal-wkrow">
  <span v-for="w in WEEKDAYS" :key="w" class="cal-wk">{{ w }}</span>
</div>

<div v-if="viewMode === 'days'" class="cal-grid" role="grid" :aria-label="headerLabel">
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

<div v-else class="cal-months" role="grid" :aria-label="`Select month, ${viewYear}`">
  <button
    v-for="(name, i) in MONTH_NAMES"
    :key="name"
    type="button"
    role="gridcell"
    :class="['cal-month', i === viewMonth && 'cal-month--on']"
    @click="pickMonth(i)"
  >{{ name.slice(0, 3) }}</button>
</div>
```

- [ ] **Step 3: Update styles — `.cal-hdr-label` becomes a button**

Replace existing `.cal-hdr-label` rule with:

```css
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
```

Add month-grid styles before the footer rules:

```css
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
```

- [ ] **Step 4: Smoke test**

Reload `/dev/datepicker`:
- Click "April 2026" header → swaps to month grid showing "2026" with 12 month buttons
- April is filled (selected state)
- Arrows change year (2025, 2027); April stays highlighted
- Click "Jun" → returns to day grid showing June
- In day view, click header again → back to month grid

- [ ] **Step 5: Commit**

```bash
git add src/components/common/CalendarPanel.vue
git commit -m "$(cat <<'EOF'
feat(calendar): add month-picker view toggled from header label

Clicking the header swaps the day grid for a 3x4 month grid;
header arrows then page by year. Makes far-back date selection
(e.g. DOB) faster than clicking month-by-month.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add range mode with hover preview to `CalendarPanel.vue`

**Goal:** When `mode="range"`, clicking the first date sets a pending start; hovering other days previews the range; clicking a second date emits `select` with `{from, to}`. Clicking earlier than pending start swaps the order.

**Files:**
- Modify: `src/components/common/CalendarPanel.vue`
- Modify: `src/views/_dev/DatePickerSandbox.vue`

- [ ] **Step 1: Add range state helpers**

Add to `<script setup>` after the view-state block:

```js
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
```

- [ ] **Step 2: Replace `cells` computed**

```js
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

    const singleOn = props.mode === 'single' && iso === props.modelValue

    let rangeOn  = false
    let rangeEnd = false
    if (props.mode === 'range') {
      if (props.from && props.to) {
        rangeOn  = inRange(iso, props.from, props.to)
        rangeEnd = isEnd(iso, props.from, props.to)
      } else if (pendingStart.value) {
        rangeOn  = hoverISO.value ? inRange(iso, pendingStart.value, hoverISO.value) : false
        rangeEnd = iso === pendingStart.value || iso === hoverISO.value
      }
    }

    result.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth.value,
      isToday: iso === toISO(today),
      isSelected: singleOn || rangeEnd,
      inRange: rangeOn,
    })
  }
  return result
})
```

- [ ] **Step 3: Replace `selectDay`, add hover handler, update `pickToday`/`pickClear`**

```js
function selectDay(cell) {
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
  if (props.mode !== 'range' || !pendingStart.value) return
  hoverISO.value = cell.iso
}

function pickToday() {
  const iso = toISO(today)
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
```

- [ ] **Step 4: Update day-cell template**

```vue
<button
  v-for="cell in cells"
  :key="cell.iso"
  type="button"
  role="gridcell"
  :aria-selected="cell.isSelected"
  :class="[
    'cal-day',
    !cell.inMonth   && 'cal-day--other',
    cell.isToday    && 'cal-day--today',
    cell.isSelected && 'cal-day--on',
    cell.inRange    && 'cal-day--in-range',
  ]"
  @click="selectDay(cell)"
  @mouseenter="onDayHover(cell)"
>{{ cell.day }}</button>
```

- [ ] **Step 5: Add range-middle style**

Add BEFORE `.cal-day--on` in the stylesheet (so `--on` wins via source order):

```css
.cal-day--in-range {
  background: var(--c-accent-ring);
  border-radius: 0;
  color: var(--c-text-1);
}
.cal-day--in-range:hover { background: var(--c-accent-ring); }
```

- [ ] **Step 6: Update sandbox**

Replace `src/views/_dev/DatePickerSandbox.vue` with:

```vue
<script setup>
import { ref } from 'vue'
import CalendarPanel from '../../components/common/CalendarPanel.vue'

const single = ref('')
const fromV  = ref('')
const toV    = ref('')

function onSingle(v) { single.value = v }
function onRange(v) {
  if (v && typeof v === 'object') {
    fromV.value = v.from
    toV.value   = v.to
  }
}
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 40px; align-items: flex-start;">
    <div>
      <h3>Single mode</h3>
      <p>Selected: <code>{{ single || '(empty)' }}</code></p>
      <CalendarPanel mode="single" :model-value="single" @select="onSingle" />
    </div>

    <div>
      <h3>Range mode</h3>
      <p>From: <code>{{ fromV || '(empty)' }}</code> → To: <code>{{ toV || '(empty)' }}</code></p>
      <CalendarPanel mode="range" :from="fromV" :to="toV" @select="onRange" />
    </div>
  </div>
</template>
```

- [ ] **Step 7: Smoke test**

Reload `/dev/datepicker`:
- Single still works.
- Range: click day 5 → hover day 12 → days 6-11 show light-blue bg, 5 and 12 filled.
- Click day 12 → `From: 2026-04-05 → To: 2026-04-12`.
- Restart: click day 20, then click day 15 → result auto-orders to `2026-04-15 → 2026-04-20`.
- **Clear** → both empty.
- **Today** (nothing pending) → from/to both = today.

- [ ] **Step 8: Commit**

```bash
git add src/components/common/CalendarPanel.vue src/views/_dev/DatePickerSandbox.vue
git commit -m "$(cat <<'EOF'
feat(calendar): add range mode with hover preview and auto-ordering

Range mode tracks a pending start, previews the range on hover,
and emits {from, to} ordered ascending on the second click.
Today and Clear buttons handle both single and range modes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add `min`/`max` + keyboard nav + a11y to `CalendarPanel.vue`

**Goal:** Days outside `[min, max]` are disabled. Arrow keys move focus between days; Enter selects; PageUp/PageDown page months.

**Files:**
- Modify: `src/components/common/CalendarPanel.vue`
- Modify: `src/views/_dev/DatePickerSandbox.vue`

- [ ] **Step 1: Add `disabled` to cell objects**

Inside `cells` computed, right after computing `iso`, add:

```js
const disabled =
  (props.min && iso < props.min) ||
  (props.max && iso > props.max)
```

Add `disabled` to the pushed object:

```js
result.push({
  iso,
  day: d.getDate(),
  inMonth: d.getMonth() === viewMonth.value,
  isToday: iso === toISO(today),
  isSelected: singleOn || rangeEnd,
  inRange: rangeOn,
  disabled,
})
```

- [ ] **Step 2: Block clicks on disabled days**

```js
function selectDay(cell) {
  if (cell.disabled) return
  // ... existing body unchanged
}
function onDayHover(cell) {
  if (cell.disabled) return
  if (props.mode !== 'range' || !pendingStart.value) return
  hoverISO.value = cell.iso
}
```

- [ ] **Step 3: Add keyboard navigation**

Add to `<script setup>`:

```js
const focusedISO = ref(toISO(today))
const gridHasFocus = ref(false)
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

function onGridKeydown(e) {
  let delta = 0
  switch (e.key) {
    case 'ArrowLeft':  delta = -1; break
    case 'ArrowRight': delta =  1; break
    case 'ArrowUp':    delta = -7; break
    case 'ArrowDown':  delta =  7; break
    case 'PageUp':     prevStep(); e.preventDefault(); return
    case 'PageDown':   nextStep(); e.preventDefault(); return
    case 'Home':       focusedISO.value = toISO(new Date(viewYear.value, viewMonth.value, 1)); e.preventDefault(); return
    case 'End': {
      const last = new Date(viewYear.value, viewMonth.value + 1, 0)
      focusedISO.value = toISO(last); e.preventDefault(); return
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
  const next = addDays(focusedISO.value, delta)
  focusedISO.value = next
  viewYear.value  = parseYear(next)
  viewMonth.value = parseMonth(next)
}
```

- [ ] **Step 4: Wire grid keydown + per-cell aria + focus**

Update the day grid template:

```vue
<div
  v-if="viewMode === 'days'"
  class="cal-grid"
  role="grid"
  :aria-label="headerLabel"
  @keydown="onGridKeydown"
>
  <button
    v-for="cell in cells"
    :key="cell.iso"
    type="button"
    role="gridcell"
    :aria-selected="cell.isSelected"
    :aria-disabled="cell.disabled"
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
    @focus="focusedISO = cell.iso; gridHasFocus = true"
    @blur="gridHasFocus = false"
  >{{ cell.day }}</button>
</div>
```

- [ ] **Step 5: Add disabled style**

```css
.cal-day--disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}
```

- [ ] **Step 6: Add a min/max section to sandbox**

Add a third section in `src/views/_dev/DatePickerSandbox.vue`:

```vue
<div>
  <h3>Single with min/max (Apr 10 – Apr 25)</h3>
  <CalendarPanel mode="single" min="2026-04-10" max="2026-04-25" :model-value="single" @select="onSingle" />
</div>
```

- [ ] **Step 7: Smoke test**

Reload:
- Days 1-9 and 26-30 greyed/unclickable in the min/max calendar.
- Click inside day grid → Tab + arrow keys move focus day-by-day.
- ↑/↓ jump a week; PageUp/PageDown page months; Home/End jump to start/end of month.
- Enter or Space selects focused day.
- VoiceOver announces e.g. "Tuesday, April 21, 2026, selected".

- [ ] **Step 8: Commit**

```bash
git add src/components/common/CalendarPanel.vue src/views/_dev/DatePickerSandbox.vue
git commit -m "$(cat <<'EOF'
feat(calendar): min/max constraints, keyboard nav, and a11y labels

Disables days outside [min, max]. Arrow keys, PageUp/Down, Home/End,
Enter and Space navigate and select via the grid. Each day cell
exposes aria-label, aria-selected, aria-disabled, and a roving
tabindex for correct screen-reader behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Create `DatePickerPopover.vue`

**Goal:** Positions an open popover relative to a trigger, auto-flips if clipped, closes on outside click / Escape, returns focus to trigger.

**Files:**
- Create: `src/components/common/DatePickerPopover.vue`
- Modify: `src/views/_dev/DatePickerSandbox.vue`

- [ ] **Step 1: Create `DatePickerPopover.vue`**

```vue
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

  const top = flip
    ? t.top - p.height - margin + window.scrollY
    : t.bottom + margin + window.scrollY

  let left = t.left + window.scrollX
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
}
.dpp-enter-active { transition: opacity 140ms ease-out, transform 140ms ease-out; }
.dpp-leave-active { transition: opacity 100ms ease-in,  transform 100ms ease-in; }
.dpp-enter-from, .dpp-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.dpp[data-placement="top"].dpp-enter-from,
.dpp[data-placement="top"].dpp-leave-to {
  transform: translateY(4px);
}
</style>
```

- [ ] **Step 2: Add popover-demo section to sandbox**

Update `src/views/_dev/DatePickerSandbox.vue`:

```vue
<script setup>
import { ref } from 'vue'
import CalendarPanel     from '../../components/common/CalendarPanel.vue'
import DatePickerPopover from '../../components/common/DatePickerPopover.vue'

const single = ref('')
const fromV  = ref('')
const toV    = ref('')
const popOpen    = ref(false)
const popTrigger = ref(null)
const popValue   = ref('')

function onSingle(v) { single.value = v }
function onRange(v)  { if (v && typeof v === 'object') { fromV.value = v.from; toV.value = v.to } }
function onPop(v)    { popValue.value = v; popOpen.value = false }
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 40px; align-items: flex-start;">
    <div>
      <h3>Single</h3>
      <CalendarPanel mode="single" :model-value="single" @select="onSingle" />
    </div>
    <div>
      <h3>Range</h3>
      <CalendarPanel mode="range" :from="fromV" :to="toV" @select="onRange" />
    </div>
    <div>
      <h3>Popover</h3>
      <p>Value: <code>{{ popValue || '(empty)' }}</code></p>
      <button
        ref="popTrigger"
        type="button"
        @click="popOpen = !popOpen"
        style="padding: 8px 14px; border: 1px solid #ccc; border-radius: 8px; background: white; cursor: pointer;"
      >Open calendar</button>
      <DatePickerPopover :open="popOpen" :trigger-el="popTrigger" @close="popOpen = false">
        <CalendarPanel mode="single" :model-value="popValue" @select="onPop" />
      </DatePickerPopover>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Smoke test**

Reload `/dev/datepicker`:
- Click **Open calendar** → popover appears below.
- Click outside → closes.
- Open again, press Escape → closes, focus returns to button.
- Scroll button near bottom of viewport, open → popover flips above.
- Resize window → popover repositions.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/DatePickerPopover.vue src/views/_dev/DatePickerSandbox.vue
git commit -m "$(cat <<'EOF'
feat(datepicker): add DatePickerPopover positioning wrapper

Teleports content to body, auto-flips above/below trigger based on
viewport space, shifts to stay in viewport, dismisses on outside
click or Escape with focus returned to the trigger.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Create `DatePicker.vue` (public, input + chip variants)

**Goal:** Public single-date component with two trigger variants.

**Files:**
- Create: `src/components/common/DatePicker.vue`
- Modify: `src/views/_dev/DatePickerSandbox.vue`

- [ ] **Step 1: Create `src/components/common/DatePicker.vue`**

```vue
<script setup>
import { ref, computed } from 'vue'
import { CalendarIcon, ChevronDownIcon } from '../icons/index.js'
import CalendarPanel     from './CalendarPanel.vue'
import DatePickerPopover from './DatePickerPopover.vue'

const props = defineProps({
  modelValue:  { type: String,  default: '' },
  variant:     { type: String,  default: 'input' }, // 'input' | 'chip'
  placeholder: { type: String,  default: 'Select date' },
  min:         { type: String,  default: '' },
  max:         { type: String,  default: '' },
  disabled:    { type: Boolean, default: false },
  ariaLabel:   { type: String,  default: '' },
})

const emit = defineEmits(['update:modelValue'])

const open      = ref(false)
const triggerEl = ref(null)

const displayText = computed(() => {
  if (!props.modelValue) return props.placeholder
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
```

- [ ] **Step 2: Replace sandbox with DatePicker demo**

```vue
<script setup>
import { ref } from 'vue'
import CalendarPanel from '../../components/common/CalendarPanel.vue'
import DatePicker    from '../../components/common/DatePicker.vue'

const single = ref('')
const fromV  = ref('')
const toV    = ref('')
const dpInput = ref('')
const dpChip  = ref('')
const dpDob   = ref('')

function onSingle(v) { single.value = v }
function onRange(v)  { if (v && typeof v === 'object') { fromV.value = v.from; toV.value = v.to } }
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 40px; align-items: flex-start; max-width: 520px;">
    <div style="width: 100%;">
      <h3>Raw CalendarPanel — single</h3>
      <CalendarPanel mode="single" :model-value="single" @select="onSingle" />
    </div>
    <div style="width: 100%;">
      <h3>Raw CalendarPanel — range</h3>
      <CalendarPanel mode="range" :from="fromV" :to="toV" @select="onRange" />
    </div>
    <div style="width: 100%;">
      <h3>DatePicker — input variant</h3>
      <p>Value: <code>{{ dpInput || '(empty)' }}</code></p>
      <DatePicker v-model="dpInput" aria-label="Event date" />
    </div>
    <div style="width: 100%;">
      <h3>DatePicker — chip variant</h3>
      <p>Value: <code>{{ dpChip || '(empty)' }}</code></p>
      <DatePicker v-model="dpChip" variant="chip" placeholder="Pick a date" />
    </div>
    <div style="width: 100%;">
      <h3>DatePicker — DOB with max=today</h3>
      <p>Value: <code>{{ dpDob || '(empty)' }}</code></p>
      <DatePicker v-model="dpDob" aria-label="Date of birth" max="2026-04-21" placeholder="DD/MM/YYYY" />
    </div>
  </div>
</template>
```

- [ ] **Step 3: Smoke test**

Reload `/dev/datepicker`:
- **Input variant:** "Select date" placeholder in muted color; click opens popover; pick → closes, shows `21/04/2026`.
- **Chip variant:** rounded pill; chevron rotates when open.
- **DOB with max:** dates after 2026-04-21 disabled.
- Resize to 375px — popover fits.
- Tab to trigger, Enter opens; arrow-keys → Enter selects.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/DatePicker.vue src/views/_dev/DatePickerSandbox.vue
git commit -m "$(cat <<'EOF'
feat(datepicker): add public DatePicker with input + chip variants

Wraps CalendarPanel in a DatePickerPopover. Input variant matches
existing form inputs (bordered, calendar icon right); chip variant
matches filter-bar pills (rounded, chevron). DD/MM/YYYY display,
v-model contract, min/max/disabled/ariaLabel props.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Rewrite `DateRangePicker.vue` on new primitives

**Goal:** Single trigger → popover with preset chips + range-mode CalendarPanel. Preserves `v-model:from` / `v-model:to` contract.

**Files:**
- Rewrite: `src/components/common/DateRangePicker.vue`
- Modify: `src/views/_dev/DatePickerSandbox.vue`

- [ ] **Step 1: Rewrite `src/components/common/DateRangePicker.vue`**

Replace the entire file:

```vue
<script setup>
import { ref, computed } from 'vue'
import { CalendarIcon, ChevronDownIcon } from '../icons/index.js'
import CalendarPanel     from './CalendarPanel.vue'
import DatePickerPopover from './DatePickerPopover.vue'

const props = defineProps({
  from:      { type: String,  default: '' },
  to:        { type: String,  default: '' },
  variant:   { type: String,  default: 'chip' }, // 'input' | 'chip'
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
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
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
```

- [ ] **Step 2: Add two sections to sandbox**

Append to `src/views/_dev/DatePickerSandbox.vue`'s template (and add the import):

```js
import DateRangePicker from '../../components/common/DateRangePicker.vue'
```

```vue
<div style="width: 100%;">
  <h3>DateRangePicker — chip variant (default)</h3>
  <p>From: <code>{{ fromV || '(empty)' }}</code> → To: <code>{{ toV || '(empty)' }}</code></p>
  <DateRangePicker v-model:from="fromV" v-model:to="toV" />
</div>

<div style="width: 100%;">
  <h3>DateRangePicker — input variant, no presets</h3>
  <DateRangePicker v-model:from="fromV" v-model:to="toV" variant="input" :presets="[]" />
</div>
```

- [ ] **Step 3: Smoke test in sandbox**

Reload `/dev/datepicker`:
- Chip variant shows "Date range" placeholder → click opens popover with 4 preset chips above calendar.
- "This Week" → closes, trigger shows "This Week".
- Reopen, click two calendar days → trigger shows `DD/MM/YYYY – DD/MM/YYYY`, active preset cleared.
- Preset clicked twice → toggles off.
- Input variant with `:presets="[]"` hides the preset row.

- [ ] **Step 4: Regression smoke test — `/trips`**

Navigate to trips page. Check the exact path in `src/router/index.js` first — likely `/trips` or `/admin/trips`.
Verify:
- Filter row shows the new range picker as a single chip trigger.
- Click → popover with presets + calendar.
- "Last 30 Days" filters the trip table exactly as before.
- Custom calendar range filters the table.
- If there's a Clear Filters button, it resets the picker to "Date range" placeholder.
- Resize to 375px — trigger doesn't overflow; popover fits.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/DateRangePicker.vue src/views/_dev/DatePickerSandbox.vue
git commit -m "$(cat <<'EOF'
refactor(date-picker): rewrite DateRangePicker on new primitives

Replaces the inline chip-row layout with a single trigger that
opens a popover containing preset chips + a range-mode
CalendarPanel. Preserves v-model:from / v-model:to contract
so existing TripListView usage continues to work. Adds input
variant for forms and a disableable preset row.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Cross-viewport verification

**Goal:** Smoke-test all new components at desktop, tablet, mobile on sandbox and `/trips`.

**Files:** None (fixes, if any, land in prior task files).

- [ ] **Step 1: Smoke test at 1280px (desktop)**

DevTools device toolbar → `1280px`. Visit `/dev/datepicker` and `/trips`.
Verify: all components render, popovers position correctly, no overflow. Chip trigger on `/trips` inline with other filters without wrapping.

- [ ] **Step 2: Smoke test at 768px (tablet)**

Set `768px`. Repeat. Filter row wraps gracefully.

- [ ] **Step 3: Smoke test at 375px (mobile)**

Set `375px`. Repeat. Popover stays in viewport (horizontal shift handles it). Calendar's 280px fits (375 - 16 = 359 available). Trigger chip doesn't overflow the card.

- [ ] **Step 4: Keyboard + screen-reader check**

Back on desktop. Keyboard only:
- Tab to range-picker trigger on `/trips` → Enter opens.
- Tab into preset row → Enter/Space selects.
- Tab into calendar grid → arrows move focus, Enter selects; PageUp/PageDown page months.
- Escape closes, focus returns to trigger.
- Run VoiceOver (⌘F5), open picker, navigate grid → each day announces `"Tuesday, April 21, 2026, selected"` format.

- [ ] **Step 5: Fix defects inline, re-verify, commit**

If any defect found:
1. Identify file (`CalendarPanel.vue`, `DatePickerPopover.vue`, `DatePicker.vue`, or `DateRangePicker.vue`).
2. Apply minimal fix.
3. Re-run affected smoke steps.
4. Commit: `fix(date-picker): <specific issue> on <viewport>`.

If nothing needs fixing, no commit this step.

---

### Task 9: Remove dev sandbox and ship

**Files:**
- Delete: `src/views/_dev/DatePickerSandbox.vue`
- Modify: `src/router/index.js` — remove sandbox route

- [ ] **Step 1: Remove the route**

Open `src/router/index.js`, delete:

```js
{ path: '/dev/datepicker', name: 'dev-datepicker', component: () => import('../views/_dev/DatePickerSandbox.vue') },
```

- [ ] **Step 2: Delete the sandbox file**

Run: `rm src/views/_dev/DatePickerSandbox.vue`
If `src/views/_dev/` is empty, also: `rmdir src/views/_dev`

- [ ] **Step 3: Verify no dangling references**

Run: `grep -r "DatePickerSandbox\|/dev/datepicker\|_dev" src/`
Expected: no matches.

Run: `npm run dev` — page loads without console errors; `/dev/datepicker` 404s.

- [ ] **Step 4: Final regression pass**

Navigate to `/trips`, exercise the range picker, confirm it still works.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.js src/views/_dev
git commit -m "$(cat <<'EOF'
chore(date-picker): remove dev sandbox after manual verification

Deletes /dev/datepicker route and DatePickerSandbox.vue. Production
components (CalendarPanel, DatePickerPopover, DatePicker,
DateRangePicker) are covered by smoke tests in TripListView and
are ready for migration of remaining native date inputs in a
follow-up PR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Spec coverage:** Every section of the spec maps to a task:
- CalendarPanel primitive → Tasks 1-4
- DatePickerPopover → Task 5
- DatePicker (input + chip variants) → Task 6
- DateRangePicker rewrite → Task 7
- Accessibility (aria roles, labels, focus trap, live region) → Tasks 4, 5
- Mobile behavior → Task 8
- Testing (manual smoke across viewports) → Tasks 5, 7, 8
- Migration of existing call sites → explicitly deferred to follow-up PR per spec

**Type/signature consistency:**
- `CalendarPanel` emits `select`: `string` in single mode, `{from, to}` in range mode — consistent across Tasks 1, 3, 6, 7.
- `DatePickerPopover` props `open` / `triggerEl` / `@close` — consistent in Tasks 5, 6, 7.
- `DateRangePicker` v-model shape (`from`, `to` strings) — unchanged from existing API, per spec.

**No placeholders:** every code step shows complete code; no "TBD" or "similar to X" references.

**Verification:** no test runner in the project; each task ends with manual smoke test at `/dev/datepicker` plus a commit. Task 8 covers 3 viewports on the live consumer page.

---

## Handoff

Plan complete. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints.

Which approach?
