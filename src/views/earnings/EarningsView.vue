<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import {
  EarningsIcon, TruckIcon, RouteIcon, PayIcon,
  CalendarIcon, CloseIcon, FilterIcon,
} from '../../components/icons/index.js'
import driverMeApi from '../../api/driverMe'

// ── State ─────────────────────────────────────────────────────────────────────
const earnings = ref([])
const loading  = ref(true)
const error    = ref('')

function currentMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const selectedMonth = ref(currentMonthStr())

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

function formatRM(v) {
  return `RM ${(v || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function monthLabel(str) {
  if (!str) return ''
  const [y, m] = str.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

// Build list of last 12 months for the month picker
const monthOptions = computed(() => {
  const opts = []
  const d = new Date()
  for (let i = 0; i < 12; i++) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    opts.push({ value: `${y}-${m}`, label: monthLabel(`${y}-${m}`) })
    d.setMonth(d.getMonth() - 1)
  }
  return opts
})

// ── Computed ──────────────────────────────────────────────────────────────────
const totalEarnings = computed(() =>
  earnings.value.reduce((s, t) => s + (t.total || 0), 0)
)
const totalTrips = computed(() => earnings.value.length)
const totalKm    = computed(() =>
  earnings.value.reduce((s, t) => s + (t.km_driven || 0), 0)
)

// Group trips by date, newest first
const byDate = computed(() => {
  const groups = {}
  for (const t of earnings.value) {
    const d = t.date || 'Unknown'
    if (!groups[d]) groups[d] = { date: d, trips: [], subtotal: 0 }
    groups[d].trips.push(t)
    groups[d].subtotal += t.total || 0
  }
  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date))
})

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchEarnings() {
  loading.value = true
  error.value   = ''
  try {
    const res = await driverMeApi.earnings({ month: selectedMonth.value })
    earnings.value = res.data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load earnings.'
  } finally {
    loading.value = false
  }
}

watch(selectedMonth, fetchEarnings)
onMounted(fetchEarnings)
</script>

<template>
  <div class="earn">

    <!-- ── Page header ─────────────────────────────────────────────────────── -->
    <div class="earn-hdr">
      <div class="earn-hdr-left">
        <div class="earn-hdr-icon">
          <EarningsIcon :size="20" />
        </div>
        <div>
          <h1 class="earn-title">My Earnings</h1>
          <p class="earn-sub">Daily trip earnings based on trip rate matrix</p>
        </div>
      </div>

      <!-- Month selector -->
      <div class="earn-month-wrap">
        <CalendarIcon :size="15" class="earn-month-icon" />
        <select v-model="selectedMonth" class="earn-month-select">
          <option v-for="o in monthOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
    </div>

    <!-- ── Error ───────────────────────────────────────────────────────────── -->
    <div v-if="error" class="earn-error">
      <CloseIcon :size="16" />
      {{ error }}
    </div>

    <!-- ── Loading ─────────────────────────────────────────────────────────── -->
    <div v-else-if="loading" class="earn-loading">
      <div class="earn-spinner" />
      <span>Loading earnings…</span>
    </div>

    <template v-else>

      <!-- ── Summary cards ─────────────────────────────────────────────────── -->
      <div class="earn-stats">
        <div class="earn-stat earn-stat--green">
          <div class="earn-stat-icon"><PayIcon :size="20" /></div>
          <div class="earn-stat-body">
            <div class="earn-stat-val">{{ formatRM(totalEarnings) }}</div>
            <div class="earn-stat-lbl">Total Earned · {{ monthLabel(selectedMonth) }}</div>
          </div>
        </div>
        <div class="earn-stat earn-stat--blue">
          <div class="earn-stat-icon"><TruckIcon :size="20" /></div>
          <div class="earn-stat-body">
            <div class="earn-stat-val">{{ totalTrips }}</div>
            <div class="earn-stat-lbl">Trips Completed</div>
          </div>
        </div>
        <div class="earn-stat earn-stat--purple">
          <div class="earn-stat-icon"><RouteIcon :size="20" /></div>
          <div class="earn-stat-body">
            <div class="earn-stat-val">{{ totalKm.toLocaleString() }} km</div>
            <div class="earn-stat-lbl">Total KM Driven</div>
          </div>
        </div>
      </div>

      <!-- ── Empty state ───────────────────────────────────────────────────── -->
      <div v-if="!byDate.length" class="earn-empty">
        <EarningsIcon :size="36" :stroke-width="1.2" />
        <p>No trips recorded for {{ monthLabel(selectedMonth) }}</p>
      </div>

      <!-- ── Daily groups ──────────────────────────────────────────────────── -->
      <template v-else>
        <div v-for="group in byDate" :key="group.date" class="earn-day-group">

          <!-- Day header -->
          <div class="earn-day-hdr">
            <div class="earn-day-date">
              <CalendarIcon :size="13" />
              {{ formatDate(group.date) }}
            </div>
            <div class="earn-day-sub">
              {{ group.trips.length }} trip{{ group.trips.length !== 1 ? 's' : '' }}
            </div>
            <div class="earn-day-total">{{ formatRM(group.subtotal) }}</div>
          </div>

          <!-- Desktop table -->
          <div class="earn-tbl-wrap">
            <table class="earn-tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Oil Company</th>
                  <th>KM</th>
                  <th>Load (kg)</th>
                  <th>Notes</th>
                  <th class="num">Base Rate</th>
                  <th class="num">Notes Rate</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(t, i) in group.trips" :key="i">
                  <td>
                    <span :class="['earn-type', `earn-type--${(t.type||'').toLowerCase()}`]">
                      {{ t.type || '—' }}
                    </span>
                  </td>
                  <td>{{ t.oil_company || '—' }}</td>
                  <td class="mono">{{ (t.km_driven || 0).toLocaleString() }}</td>
                  <td class="mono">{{ (t.load_size || 0).toLocaleString() }}</td>
                  <td>
                    <span v-if="t.notes" class="earn-notes">{{ t.notes }}</span>
                    <span v-else class="tc-2">—</span>
                  </td>
                  <td class="num mono">{{ formatRM(t.base_rate) }}</td>
                  <td class="num mono">
                    <span v-if="t.notes_rate" class="earn-notes-rate">+ {{ formatRM(t.notes_rate) }}</span>
                    <span v-else class="tc-2">—</span>
                  </td>
                  <td class="num mono earn-total-cell">{{ formatRM(t.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="earn-cards">
            <div v-for="(t, i) in group.trips" :key="i" class="earn-card">
              <div class="earn-card-top">
                <span :class="['earn-type', `earn-type--${(t.type||'').toLowerCase()}`]">{{ t.type || '—' }}</span>
                <span class="earn-card-company">{{ t.oil_company || '—' }}</span>
                <span class="earn-card-total mono">{{ formatRM(t.total) }}</span>
              </div>
              <div class="earn-card-meta">
                <span><span class="mk">KM</span><span class="mono">{{ (t.km_driven||0).toLocaleString() }}</span></span>
                <span><span class="mk">Load</span><span class="mono">{{ (t.load_size||0).toLocaleString() }} kg</span></span>
                <span><span class="mk">Base</span><span class="mono">{{ formatRM(t.base_rate) }}</span></span>
                <span v-if="t.notes_rate"><span class="mk">Notes+</span><span class="mono earn-notes-rate">{{ formatRM(t.notes_rate) }}</span></span>
                <span v-if="t.notes"><span class="mk">Notes</span>{{ t.notes }}</span>
              </div>
            </div>
          </div>

        </div>
      </template>

    </template>
  </div>
</template>

<style scoped>
.earn { display: flex; flex-direction: column; gap: 1rem; }

/* ── Header ─────────────────────────────────────────────────────────────────── */
.earn-hdr {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.75rem;
}
.earn-hdr-left { display: flex; align-items: center; gap: 0.875rem; }
.earn-hdr-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: rgba(5,150,105,0.1); color: #059669;
  display: grid; place-items: center; flex-shrink: 0;
}
.earn-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text); margin: 0 0 2px; }
.earn-sub   { font-size: 0.78rem; color: var(--c-text-2); margin: 0; }

/* Month select */
.earn-month-wrap {
  display: flex; align-items: center; gap: 0.4rem;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 10px; padding: 0.35rem 0.75rem;
}
.earn-month-icon { color: var(--c-text-2); flex-shrink: 0; }
.earn-month-select {
  background: transparent; border: none; outline: none;
  font-size: 0.84rem; color: var(--c-text); font-weight: 500; cursor: pointer;
}

/* ── Loading / Error ─────────────────────────────────────────────────────────── */
.earn-loading {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 3rem; color: var(--c-text-2);
}
.earn-spinner {
  width: 18px; height: 18px; border: 2px solid var(--c-border);
  border-top-color: #059669; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.earn-error {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.875rem 1rem; border-radius: 10px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #EF4444; font-size: 0.875rem;
}

/* ── Stat cards ─────────────────────────────────────────────────────────────── */
.earn-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
.earn-stat {
  display: flex; align-items: center; gap: 1rem;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; padding: 1rem 1.25rem;
}
.earn-stat-icon {
  width: 44px; height: 44px; border-radius: 11px;
  display: grid; place-items: center; flex-shrink: 0;
}
.earn-stat--green .earn-stat-icon { background: rgba(5,150,105,0.12);  color: #059669; }
.earn-stat--blue  .earn-stat-icon { background: rgba(37,99,235,0.12);   color: #2563EB; }
.earn-stat--purple .earn-stat-icon{ background: rgba(124,58,237,0.12);  color: #7C3AED; }
.earn-stat-val { font-size: 1.25rem; font-weight: 700; color: var(--c-text); margin-bottom: 3px; }
.earn-stat-lbl { font-size: 0.76rem; color: var(--c-text-2); font-weight: 500; }

/* ── Empty ─────────────────────────────────────────────────────────────────── */
.earn-empty {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 3rem; color: var(--c-text-2); font-size: 0.875rem;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
}
.earn-empty svg { opacity: 0.35; }

/* ── Day group ──────────────────────────────────────────────────────────────── */
.earn-day-group {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; overflow: hidden;
}
.earn-day-hdr {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1.1rem; background: var(--c-bg);
  border-bottom: 1px solid var(--c-border);
}
.earn-day-date {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.84rem; font-weight: 600; color: var(--c-text); flex: 1;
}
.earn-day-date svg { color: var(--c-text-2); }
.earn-day-sub { font-size: 0.76rem; color: var(--c-text-2); }
.earn-day-total {
  font-size: 0.9rem; font-weight: 700; color: #059669;
  font-family: 'JetBrains Mono', monospace;
}

/* Table */
.earn-tbl-wrap { overflow-x: auto; }
.earn-tbl { width: 100%; border-collapse: collapse; }
.earn-tbl thead th {
  padding: 0.6rem 1rem; text-align: left;
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--c-text-2); white-space: nowrap;
  border-bottom: 1px solid var(--c-border);
}
.earn-tbl thead th.num { text-align: right; }
.earn-tbl tbody td {
  padding: 0.75rem 1rem; font-size: 0.84rem; color: var(--c-text);
  border-bottom: 1px solid var(--c-border); white-space: nowrap;
}
.earn-tbl tbody tr:last-child td { border-bottom: none; }
.earn-tbl tbody tr:hover { background: var(--c-hover); }
.earn-tbl td.num { text-align: right; }
.earn-total-cell { font-weight: 700; color: #059669; }

/* Type badges */
.earn-type {
  display: inline-block; padding: 0.15rem 0.5rem; border-radius: 6px;
  font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
}
.earn-type--petrol { background: rgba(37,99,235,0.1);  color: #2563EB; }
.earn-type--diesel { background: rgba(217,119,6,0.1);  color: #D97706; }
.earn-type--lpg    { background: rgba(5,150,105,0.1);  color: #059669; }
.earn-type--cng    { background: rgba(124,58,237,0.1); color: #7C3AED; }

.earn-notes {
  display: inline-block; padding: 0.12rem 0.45rem; border-radius: 5px;
  background: rgba(100,116,139,0.1); color: var(--c-text-2);
  font-size: 0.74rem; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.earn-notes-rate { color: #059669; font-weight: 600; }

/* Mobile cards */
.earn-cards { display: none; }
.earn-card {
  padding: 0.875rem 1.1rem; border-bottom: 1px solid var(--c-border);
}
.earn-card:last-child { border-bottom: none; }
.earn-card-top {
  display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; flex-wrap: wrap;
}
.earn-card-company { font-size: 0.84rem; color: var(--c-text); flex: 1; }
.earn-card-total   { font-size: 0.9rem; font-weight: 700; color: #059669; }
.earn-card-meta {
  display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; font-size: 0.8rem; color: var(--c-text);
}
.mk {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  color: var(--c-text-2); margin-right: 3px;
}

/* Helpers */
.tc-2  { color: var(--c-text-2); }
.mono  { font-family: 'JetBrains Mono', 'Fira Code', monospace; }

/* ── Responsive ─────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .earn-stats { grid-template-columns: 1fr 1fr; }
  .earn-stats .earn-stat:last-child { grid-column: span 2; }
}
@media (max-width: 640px) {
  .earn-hdr { flex-direction: column; align-items: flex-start; }
  .earn-stats { grid-template-columns: 1fr; }
  .earn-stats .earn-stat:last-child { grid-column: unset; }
  .earn-tbl-wrap { display: none; }
  .earn-cards    { display: block; }
}
</style>
