# Driver Dashboard Date Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a date period filter to `DriverDashboardView.vue` so all performance data (stat cards, monthly chart, trips table) reflects only the selected date range.

**Architecture:** Fetch all trips once on mount and store in `allTrips`. Remove the separate `kmSummary` API call. All stats (totalTrips, totalKm, avgKm, monthly breakdown) are recomputed client-side from a `filteredTrips` computed property that reacts to the active date preset. A filter chip strip sits between the quick-links row and the stat cards.

**Tech Stack:** Vue 3 (Composition API), `ref`, `computed`, native `<input type="date">`, existing CSS variables

---

## File Map

| File | Change |
|------|--------|
| `src/views/dashboard/DriverDashboardView.vue` | All changes — new state, computed props, interaction handlers, filter UI, updated labels, CSS |
| `src/api/driverMe.js` | No changes |
| Backend | No changes |

---

## Task 1: Replace state refs and update `onMounted`

**File:** `src/views/dashboard/DriverDashboardView.vue`

- [ ] **Step 1: Replace `kmSummary` and `recentTrips` refs with new state**

In the `// ── State ──` block, replace:
```js
const kmSummary = ref(null)
const recentTrips = ref([])
```
with:
```js
const allTrips     = ref([])
const activePreset = ref('this-month')
const customFrom   = ref(null)   // YYYY-MM-DD string or null
const customTo     = ref(null)   // YYYY-MM-DD string or null
```

- [ ] **Step 2: Add `PRESETS` constant and `toDateStr` helper after the date helpers block**

After the existing `formatDate` and `daysUntil` functions, add:
```js
const PRESETS = [
  { value: 'this-month',    label: 'This Month' },
  { value: 'last-month',    label: 'Last Month' },
  { value: 'last-3-months', label: 'Last 3 Months' },
  { value: 'this-year',     label: 'This Year' },
  { value: 'all-time',      label: 'All Time' },
  { value: 'custom',        label: 'Custom…' },
]

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 3: Update `onMounted` to remove `kmSummary` call**

Replace the entire `onMounted` block:
```js
onMounted(async () => {
  try {
    const [pRes, kRes, tRes] = await Promise.all([
      driverMeApi.profile(),
      driverMeApi.kmSummary(),
      driverMeApi.trips(),
    ])
    profile.value    = pRes.data.data
    kmSummary.value  = kRes.data.data
    recentTrips.value = (tRes.data.data || []).slice(0, 10)
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load your dashboard.'
  } finally {
    loading.value = false
  }
})
```
with:
```js
onMounted(async () => {
  try {
    const [pRes, tRes] = await Promise.all([
      driverMeApi.profile(),
      driverMeApi.trips(),
    ])
    profile.value  = pRes.data.data
    allTrips.value = tRes.data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load your dashboard.'
  } finally {
    loading.value = false
  }
})
```

- [ ] **Step 4: Verify the app still loads without console errors**

Run `npm run dev` (if not already running). Open the driver dashboard. Stats will show 0 at this point — that's expected since computed props still reference old refs. No console errors expected.

- [ ] **Step 5: Commit**
```bash
git add src/views/dashboard/DriverDashboardView.vue
git commit -m "refactor: replace kmSummary ref with allTrips, update onMounted"
```

---

## Task 2: Add filtering computed properties

**File:** `src/views/dashboard/DriverDashboardView.vue`

- [ ] **Step 1: Replace the `// ── Computed ──` block with new computed properties**

Replace the entire existing computed block:
```js
const totalTrips = computed(() => kmSummary.value?.total_trips     || 0)
const totalKm    = computed(() => kmSummary.value?.total_km_driven || 0)
const avgKm      = computed(() => kmSummary.value?.avg_km_per_trip || 0)
const monthly    = computed(() => kmSummary.value?.monthly         || [])
```
with:
```js
// ── Date filter ───────────────────────────────────────────────────────────────
const dateRange = computed(() => {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth() // 0-indexed

  switch (activePreset.value) {
    case 'this-month':
      return { from: toDateStr(new Date(y, m, 1)), to: toDateStr(now) }
    case 'last-month': {
      const first = new Date(y, m - 1, 1)
      const last  = new Date(y, m, 0)
      return { from: toDateStr(first), to: toDateStr(last) }
    }
    case 'last-3-months':
      return { from: toDateStr(new Date(y, m - 3, 1)), to: toDateStr(now) }
    case 'this-year':
      return { from: `${y}-01-01`, to: toDateStr(now) }
    case 'all-time':
      return null
    case 'custom':
      return (customFrom.value && customTo.value)
        ? { from: customFrom.value, to: customTo.value }
        : null
    default:
      return null
  }
})

const filteredTrips = computed(() => {
  const range = dateRange.value
  if (!range) return allTrips.value
  return allTrips.value.filter(t => {
    if (!t.date) return false
    return t.date >= range.from && t.date <= range.to
  })
})

// ── Stats (derived from filteredTrips) ────────────────────────────────────────
const totalTrips = computed(() => filteredTrips.value.length)
const totalKm    = computed(() => filteredTrips.value.reduce((s, t) => s + (t.km_driven || 0), 0))
const avgKm      = computed(() => totalTrips.value > 0
  ? Math.round((totalKm.value / totalTrips.value) * 10) / 10
  : 0
)

const monthly = computed(() => {
  const groups = {}
  for (const t of filteredTrips.value) {
    const key = (t.date || '').slice(0, 7)
    if (!key) continue
    if (!groups[key]) groups[key] = { month: key, trips: 0, km: 0 }
    groups[key].trips++
    groups[key].km += (t.km_driven || 0)
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, g]) => ({
      ...g,
      label: new Date(g.month + '-01').toLocaleDateString('en-MY', { month: 'short', year: 'numeric' }),
    }))
})

const periodLabel = computed(() => {
  const now = new Date()
  const y   = now.getFullYear()
  const m   = now.getMonth()
  switch (activePreset.value) {
    case 'this-month':    return `${MONTHS[m]} ${y}`
    case 'last-month': {
      const d = new Date(y, m - 1, 1)
      return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    }
    case 'last-3-months': return 'Last 3 Months'
    case 'this-year':     return String(y)
    case 'all-time':      return 'All Time'
    case 'custom':
      return (customFrom.value && customTo.value)
        ? `${formatDate(customFrom.value)} – ${formatDate(customTo.value)}`
        : 'Custom'
    default: return ''
  }
})

const displayedTrips = computed(() => filteredTrips.value.slice(0, 50))
```

- [ ] **Step 2: Verify stats update in the browser**

Reload the driver dashboard. Stat cards should show real numbers filtered to this month. The monthly chart should render. No console errors.

- [ ] **Step 3: Commit**
```bash
git add src/views/dashboard/DriverDashboardView.vue
git commit -m "feat: add dateRange, filteredTrips, periodLabel computed props"
```

---

## Task 3: Add interaction handlers

**File:** `src/views/dashboard/DriverDashboardView.vue`

- [ ] **Step 1: Add `setPreset` and `applyCustomRange` functions**

After the `daysUntil` function (before the `// ── Date filter ──` computed block), add:
```js
// ── Filter actions ────────────────────────────────────────────────────────────
function setPreset(preset) {
  activePreset.value = preset
}

function applyCustomRange() {
  if (!customFrom.value || !customTo.value) return
  activePreset.value = 'custom'
}
```

- [ ] **Step 2: Commit**
```bash
git add src/views/dashboard/DriverDashboardView.vue
git commit -m "feat: add setPreset and applyCustomRange handlers"
```

---

## Task 4: Update the template

**File:** `src/views/dashboard/DriverDashboardView.vue`

- [ ] **Step 1: Add the filter strip between quick-links and the error/loading block**

Find the closing `</div>` of the `ddash-quicklinks` div. Insert this block immediately after it:
```html
<!-- ── Date filter strip ─────────────────────────────── -->
<div class="ddash-filter-strip">
  <div class="ddash-filter-chips">
    <button
      v-for="p in PRESETS"
      :key="p.value"
      :class="['ddash-filter-chip', activePreset === p.value && 'ddash-filter-chip--active']"
      @click="setPreset(p.value)"
    >{{ p.label }}</button>
  </div>
  <div v-if="activePreset === 'custom'" class="ddash-custom-range">
    <span class="ddash-cr-label">From</span>
    <input v-model="customFrom" type="date" class="ddash-cr-input" />
    <span class="ddash-cr-label">To</span>
    <input v-model="customTo" type="date" class="ddash-cr-input" />
    <button
      class="ddash-cr-apply"
      :disabled="!customFrom || !customTo"
      @click="applyCustomRange"
    >Apply</button>
  </div>
</div>
```

- [ ] **Step 2: Update the "My Performance" section label**

Find:
```html
<p class="ddash-section-lbl">My Performance</p>
```
Replace with:
```html
<p class="ddash-section-lbl">My Performance · {{ periodLabel }}</p>
```

- [ ] **Step 3: Update the "Recent Trips" section label**

Find:
```html
<p class="ddash-section-lbl">Recent Trips</p>
```
Replace with:
```html
<p class="ddash-section-lbl">Trips · {{ periodLabel }}</p>
```

- [ ] **Step 4: Update the trips card header**

Find:
```html
<div class="ddash-trips-hd">
  <p class="ddash-trips-title">Last 10 Trips</p>
  <span class="ddash-trips-count">{{ recentTrips.length }} records</span>
</div>
```
Replace with:
```html
<div class="ddash-trips-hd">
  <p class="ddash-trips-title">Trips · {{ periodLabel }}</p>
  <span class="ddash-trips-count">{{ displayedTrips.length }} records</span>
</div>
```

- [ ] **Step 5: Replace `recentTrips` with `displayedTrips` in the trips wrapper, table, and mobile cards**

Find:
```html
<div v-if="recentTrips.length" class="ddash-trips-wrap">
```
Replace with:
```html
<div v-if="displayedTrips.length" class="ddash-trips-wrap">
```

Find:
```html
<tr v-for="(t, i) in recentTrips" :key="i">
```
Replace with:
```html
<tr v-for="(t, i) in displayedTrips" :key="i">
```

Find:
```html
<div v-for="(t, i) in recentTrips" :key="i" class="ddash-trip-m-card">
```
Replace with:
```html
<div v-for="(t, i) in displayedTrips" :key="i" class="ddash-trip-m-card">
```

- [ ] **Step 6: Verify filter chips appear and work**

In the browser: the filter strip should be visible between quick-links and the stats. Clicking "Last Month" should update stat cards and trip list. Clicking "Custom…" should reveal from/to inputs. Apply should be disabled until both fields are filled.

- [ ] **Step 7: Commit**
```bash
git add src/views/dashboard/DriverDashboardView.vue
git commit -m "feat: add filter strip UI and update section labels and trips table"
```

---

## Task 5: Add CSS for the filter strip

**File:** `src/views/dashboard/DriverDashboardView.vue`

- [ ] **Step 1: Add filter strip styles**

In the `<style scoped>` block, add after the `/* ── Quick links row ──` section:
```css
/* ── Date filter strip ───────────────────────────────────────────────────────── */
.ddash-filter-strip {
  display: flex; flex-direction: column; gap: 0.5rem;
  padding: 0.25rem 0 0.75rem;
}
.ddash-filter-chips {
  display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;
}
.ddash-filter-chip {
  padding: 5px 13px; border-radius: 20px;
  font-size: 0.78rem; font-weight: 600; cursor: pointer;
  border: 1px solid var(--c-border); background: var(--c-surface);
  color: var(--c-text-2);
  transition: background var(--dur), color var(--dur), border-color var(--dur);
  white-space: nowrap;
}
.ddash-filter-chip:hover { background: var(--c-hover); color: var(--c-text); }
.ddash-filter-chip--active {
  background: var(--c-accent); color: #fff; border-color: var(--c-accent);
}
.ddash-custom-range {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
}
.ddash-cr-label { font-size: 0.78rem; color: var(--c-text-2); }
.ddash-cr-input {
  border: 1px solid var(--c-border); border-radius: 8px;
  padding: 4px 10px; font-size: 0.78rem; color: var(--c-text);
  background: var(--c-surface); font-family: inherit;
}
.ddash-cr-apply {
  padding: 5px 14px; border-radius: 8px;
  font-size: 0.78rem; font-weight: 600;
  background: var(--c-accent); color: #fff; border: none; cursor: pointer;
  transition: opacity var(--dur);
}
.ddash-cr-apply:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 2: Add responsive rule for mobile**

Inside the existing `@media (max-width: 640px)` block, add:
```css
.ddash-custom-range { flex-direction: column; align-items: flex-start; }
```

- [ ] **Step 3: Verify visual appearance**

In the browser, confirm:
- Chips are pill-shaped; active chip is green
- "This Month" is green on load
- Switching preset instantly updates cards, chart, and trips
- On mobile width (≤ 640px): chips wrap, custom inputs stack vertically
- Dark mode: chips use CSS variable colours correctly

- [ ] **Step 4: Final commit**
```bash
git add src/views/dashboard/DriverDashboardView.vue
git commit -m "feat: driver dashboard date filter complete"
```
