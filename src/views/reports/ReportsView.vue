<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { ReportsIcon, CheckCircleIcon, ExportIcon } from '../../components/icons/index.js'
import reportsApi from '../../api/reports'
import StatCard from '../../components/common/StatCard.vue'
import DateRangePicker from '../../components/common/DateRangePicker.vue'

const driverSummary   = ref(null)
const tripSummary     = ref(null)
const expiringDrivers = ref([])
const loading         = ref(true)
const activeSection   = ref('all')   // 'all' | 'drivers' | 'trips' | 'expiry'

// ── Date filter (this-month start → today) ───────────────────────────────────
function _toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const _now = new Date()
const dateFrom = ref(_toISO(new Date(_now.getFullYear(), _now.getMonth(), 1)))
const dateTo   = ref(_toISO(_now))

const printing = ref(false)
const generatedAt = computed(() => new Date().toLocaleString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
}))
const rangeLabel = computed(() => {
  if (dateFrom.value === dateTo.value) return formatDate(dateFrom.value)
  return `${formatDate(dateFrom.value)} – ${formatDate(dateTo.value)}`
})
const sectionLabel = computed(() => ({
  all: 'Overview', drivers: 'Drivers', trips: 'Trips', expiry: 'License Expiry',
}[activeSection.value] || 'Overview'))

async function loadTrips() {
  const tRes = await reportsApi.tripSummary({ from: dateFrom.value, to: dateTo.value })
  tripSummary.value = tRes.data.data
}

function exportPdf() {
  if (printing.value) return
  printing.value = true
  // Allow the print container a tick to settle before the dialog opens.
  setTimeout(() => {
    window.print()
    printing.value = false
  }, 80)
}

watch([dateFrom, dateTo], loadTrips)

function formatDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

function daysUntil(s) {
  if (!s) return 999
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(s) - now) / 86400000)
}

const urgencyKey   = d => d <= 30 ? 'critical' : d <= 60 ? 'warning' : 'notice'
const urgencyLabel = d => d <= 30 ? 'Critical'  : d <= 60 ? 'Warning'  : 'Notice'

const sortedExpiry = computed(() =>
  [...expiringDrivers.value].sort((a, b) => daysUntil(a.license_expiry) - daysUntil(b.license_expiry))
)

const byOilCompany = computed(() => {
  const map = tripSummary.value?.by_oil_company || {}
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

const topOilMax = computed(() => byOilCompany.value[0]?.[1] || 1)

const rankEntries = computed(() => {
  const r = driverSummary.value?.drivers_by_ranking || {}
  return Object.entries(r).sort((a, b) => a[0].localeCompare(b[0]))
})

const expiryColumns = [
  { key: 'driver_id',      label: 'Driver ID' },
  { key: 'name',           label: 'Name' },
  { key: 'license_type',   label: 'Type' },
  { key: 'license_expiry', label: 'License Expiry' },
  { key: 'gdl_expiry',     label: 'GDL Expiry' },
  { key: 'ranking',        label: 'Rank' },
]

onMounted(async () => {
  try {
    const [dRes, tRes, lRes] = await Promise.all([
      reportsApi.driverSummary(),
      reportsApi.tripSummary({ from: dateFrom.value, to: dateTo.value }),
      reportsApi.licenseExpiry(),
    ])
    driverSummary.value   = dRes.data.data
    tripSummary.value     = tRes.data.data
    expiringDrivers.value = lRes.data.data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="rv">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="rv-banner">
      <div class="rv-banner-left">
        <div class="rv-banner-icon">
          <ReportsIcon :size="20" />
        </div>
        <div>
          <h1 class="rv-banner-title">Reports</h1>
          <p class="rv-banner-sub">Fleet Analytics &amp; Insights</p>
        </div>
      </div>
      <div v-if="!loading" class="rv-banner-stats">
        <div class="rv-bstat">
          <span class="rv-bstat-val">{{ driverSummary?.total_drivers ?? '—' }}</span>
          <span class="rv-bstat-lbl">Drivers</span>
        </div>
        <div class="rv-bstat rv-bstat--purple">
          <span class="rv-bstat-val">{{ tripSummary?.total_trips ?? '—' }}</span>
          <span class="rv-bstat-lbl">Trips</span>
        </div>
        <div class="rv-bstat rv-bstat--amber">
          <span class="rv-bstat-val">{{ expiringDrivers.length }}</span>
          <span class="rv-bstat-lbl">Expiring</span>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="rv-loading">
      <div class="rv-spinner" />
      <span>Loading reports…</span>
    </div>

    <template v-else>

      <!-- ── Section nav ─────────────────────────────────────── -->
      <div class="rv-sec-row">
        <div class="rv-sec-nav">
          <button v-for="s in [
            { key: 'all',     label: 'Overview' },
            { key: 'drivers', label: 'Drivers' },
            { key: 'trips',   label: 'Trips' },
            { key: 'expiry',  label: 'License Expiry' },
          ]" :key="s.key"
            :class="['rv-sec-btn', activeSection === s.key && 'rv-sec-btn--on']"
            @click="activeSection = s.key"
          >{{ s.label }}</button>
        </div>

        <div class="rv-toolbar">
          <DateRangePicker v-model:from="dateFrom" v-model:to="dateTo" />
          <button
            class="rv-export-btn"
            :disabled="printing"
            @click="exportPdf"
          >
            <ExportIcon :size="16" />
            <span>{{ printing ? 'Preparing…' : 'Export PDF' }}</span>
          </button>
        </div>
      </div>

      <!-- ── Driver summary ──────────────────────────────────── -->
      <section v-show="activeSection === 'all' || activeSection === 'drivers'">
        <div class="rv-sec-label">Driver Summary</div>
        <div class="rv-stats-grid">
          <StatCard title="Total Drivers"    :value="driverSummary?.total_drivers || 0"         color="blue" />
          <StatCard title="Active"           :value="driverSummary?.active_drivers || 0"        color="green" />
          <StatCard title="Blocked"          :value="driverSummary?.blocked_drivers || 0"       color="red" />
          <StatCard title="License Expiring" :value="driverSummary?.license_expiring_soon || 0" color="yellow" subtitle="within 3 months" />
        </div>

        <!-- Ranking breakdown -->
        <div v-if="rankEntries.length" class="rv-card rv-rank-card">
          <p class="rv-card-title">Drivers by Ranking</p>
          <div class="rv-rank-list">
            <div v-for="[rank, count] in rankEntries" :key="rank" class="rv-rank-row">
              <span :class="['rv-rank-chip', `rv-rank-${rank.toLowerCase()}`]">{{ rank }}</span>
              <div class="rv-rank-bar-wrap">
                <div
                  class="rv-rank-bar"
                  :class="`rv-rank-bar-${rank.toLowerCase()}`"
                  :style="{ transform: `scaleX(${count / (driverSummary?.total_drivers || 1)})` }"
                />
              </div>
              <span class="rv-rank-count">{{ count }} driver{{ count !== 1 ? 's' : '' }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Trip summary ────────────────────────────────────── -->
      <section v-show="activeSection === 'all' || activeSection === 'trips'">
        <div class="rv-sec-label">Trip Summary</div>
        <div class="rv-stats-grid-3">
          <StatCard title="Total Trips"    :value="tripSummary?.total_trips || 0"                         color="purple" />
          <StatCard title="Total KM"       :value="(tripSummary?.total_km_driven || 0).toLocaleString()"  color="blue" />
          <StatCard title="Active Drivers" :value="Object.keys(tripSummary?.by_driver || {}).length"       color="green" />
        </div>

        <!-- Oil company breakdown -->
        <div v-if="byOilCompany.length" class="rv-card">
          <p class="rv-card-title">Trips by Oil Company</p>
          <div class="rv-oil-list">
            <div v-for="([co, count]) in byOilCompany" :key="co" class="rv-oil-row">
              <span class="rv-oil-name">{{ co }}</span>
              <div class="rv-oil-bar-wrap">
                <div class="rv-oil-bar" :style="{ transform: `scaleX(${count / topOilMax})` }" />
              </div>
              <span class="rv-oil-count">{{ count }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── License expiry ──────────────────────────────────── -->
      <section v-show="activeSection === 'all' || activeSection === 'expiry'">
        <div class="rv-sec-label">License Expiry <span class="rv-sec-sub">(within 3 months)</span></div>

        <div v-if="sortedExpiry.length === 0" class="rv-card rv-empty-card">
          <CheckCircleIcon :size="22" :stroke-width="1.5" />
          <p>No licenses expiring within 3 months</p>
        </div>

        <div v-else class="rv-card rv-no-pad">
          <!-- Desktop table -->
          <div class="rv-tbl-wrap">
            <table class="rv-tbl">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Type</th>
                  <th>License Expiry</th>
                  <th>GDL Expiry</th>
                  <th>Rank</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="d in sortedExpiry" :key="d.driver_id"
                  :class="['rv-exp-row', `rv-urg-row-${urgencyKey(daysUntil(d.license_expiry))}`]"
                >
                  <td class="rv-driver-cell">
                    <span class="rv-driver-name">{{ d.name }}</span>
                    <span class="rv-driver-id">{{ d.driver_id }}</span>
                  </td>
                  <td>{{ d.license_type }}</td>
                  <td class="mono">{{ formatDate(d.license_expiry) }}</td>
                  <td class="mono">{{ formatDate(d.gdl_expiry) }}</td>
                  <td>
                    <span
                      :class="['rv-rank-chip', `rv-rank-${(d.ranking||'').toLowerCase()}`]"
                      :title="d.ranking === 'A' ? 'Rank A — Top performer' : d.ranking === 'B' ? 'Rank B — Good standing' : d.ranking === 'C' ? 'Rank C — Needs attention' : ''"
                    >{{ d.ranking || '—' }}</span>
                  </td>
                  <td>
                    <span :class="['rv-urg-badge', `rv-urg-${urgencyKey(daysUntil(d.license_expiry))}`]">
                      {{ urgencyLabel(daysUntil(d.license_expiry)) }} · {{ daysUntil(d.license_expiry) }}d
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile expiry cards -->
          <div class="rv-exp-cards">
            <div
              v-for="d in sortedExpiry" :key="d.driver_id"
              :class="['rv-exp-card', `rv-urg-row-${urgencyKey(daysUntil(d.license_expiry))}`]"
            >
              <div class="rv-exp-card-top">
                <div class="rv-driver-cell">
                  <span class="rv-driver-name">{{ d.name }}</span>
                  <span class="rv-driver-id">{{ d.driver_id }}</span>
                </div>
                <span :class="['rv-urg-badge', `rv-urg-${urgencyKey(daysUntil(d.license_expiry))}`]">
                  {{ urgencyLabel(daysUntil(d.license_expiry)) }} · {{ daysUntil(d.license_expiry) }}d
                </span>
              </div>
              <div class="rv-exp-card-meta">
                <span><span class="rv-mk">Type</span>{{ d.license_type }}</span>
                <span><span class="rv-mk">Expiry</span>{{ formatDate(d.license_expiry) }}</span>
                <span><span class="rv-mk">GDL</span>{{ formatDate(d.gdl_expiry) }}</span>
                <span><span class="rv-mk">Rank</span>
                  <span
                    :class="['rv-rank-chip', `rv-rank-${(d.ranking||'').toLowerCase()}`]"
                    :title="d.ranking === 'A' ? 'Rank A — Top performer' : d.ranking === 'B' ? 'Rank B — Good standing' : d.ranking === 'C' ? 'Rank C — Needs attention' : ''"
                  >{{ d.ranking || '—' }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

    </template>

    <!-- ── PDF print template (hidden on screen, shown only during print) ── -->
    <div class="rv-print" aria-hidden="true">
      <header class="rvp-header">
        <div class="rvp-brand">
          <span class="rvp-brand-dot"></span>
          <span class="rvp-brand-name">BE-X</span>
          <span class="rvp-brand-tag">Fleet Operations</span>
        </div>
        <div class="rvp-meta">
          <p class="rvp-meta-title">{{ sectionLabel }} Report</p>
          <p class="rvp-meta-sub">
            <strong>Period:</strong> {{ rangeLabel }}
            <span class="rvp-sep">·</span>
            <strong>Generated:</strong> {{ generatedAt }}
          </p>
        </div>
      </header>

      <hr class="rvp-rule" />

      <!-- Driver Summary -->
      <section v-if="activeSection === 'all' || activeSection === 'drivers'" class="rvp-section">
        <h2 class="rvp-h2">Driver Summary</h2>
        <table class="rvp-kv">
          <tbody>
            <tr><th>Total Drivers</th><td>{{ driverSummary?.total_drivers ?? 0 }}</td></tr>
            <tr><th>Active</th><td>{{ driverSummary?.active_drivers ?? 0 }}</td></tr>
            <tr><th>Blocked</th><td>{{ driverSummary?.blocked_drivers ?? 0 }}</td></tr>
            <tr><th>License Expiring (within 3 months)</th><td>{{ driverSummary?.license_expiring_soon ?? 0 }}</td></tr>
          </tbody>
        </table>

        <h3 class="rvp-h3">Drivers by Ranking</h3>
        <table class="rvp-tbl">
          <thead><tr><th>Rank</th><th>Drivers</th><th>Share</th></tr></thead>
          <tbody>
            <tr v-for="[rank, count] in rankEntries" :key="rank">
              <td>{{ rank }}</td>
              <td>{{ count }}</td>
              <td>{{ Math.round((count / (driverSummary?.total_drivers || 1)) * 100) }}%</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Trip Summary -->
      <section v-if="activeSection === 'all' || activeSection === 'trips'" class="rvp-section">
        <h2 class="rvp-h2">Trip Summary</h2>
        <table class="rvp-kv">
          <tbody>
            <tr><th>Total Trips</th><td>{{ tripSummary?.total_trips ?? 0 }}</td></tr>
            <tr><th>Total KM Driven</th><td>{{ (tripSummary?.total_km_driven ?? 0).toLocaleString() }}</td></tr>
            <tr><th>Active Drivers</th><td>{{ Object.keys(tripSummary?.by_driver || {}).length }}</td></tr>
          </tbody>
        </table>

        <h3 v-if="byOilCompany.length" class="rvp-h3">Trips by Oil Company</h3>
        <table v-if="byOilCompany.length" class="rvp-tbl">
          <thead><tr><th>Oil Company</th><th>Trips</th></tr></thead>
          <tbody>
            <tr v-for="[co, count] in byOilCompany" :key="co">
              <td style="text-transform: capitalize;">{{ co }}</td>
              <td>{{ count }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- License Expiry -->
      <section v-if="activeSection === 'all' || activeSection === 'expiry'" class="rvp-section">
        <h2 class="rvp-h2">License Expiry <span class="rvp-h2-sub">(within 3 months)</span></h2>
        <p v-if="!sortedExpiry.length" class="rvp-empty">No licenses expiring within 3 months.</p>
        <table v-else class="rvp-tbl">
          <thead>
            <tr>
              <th>Driver ID</th><th>Name</th><th>Type</th>
              <th>License Expiry</th><th>GDL Expiry</th>
              <th>Rank</th><th>Days Left</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in sortedExpiry" :key="d.driver_id">
              <td>{{ d.driver_id }}</td>
              <td>{{ d.name }}</td>
              <td>{{ d.license_type || '—' }}</td>
              <td>{{ formatDate(d.license_expiry) }}</td>
              <td>{{ formatDate(d.gdl_expiry) }}</td>
              <td>{{ d.ranking || '—' }}</td>
              <td>{{ daysUntil(d.license_expiry) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer class="rvp-footer">
        Fleet Operations Report · BE-X · Confidential
      </footer>
    </div>

  </div>
</template>

<style scoped>
.rv { min-width: 0; overflow: hidden; }

/* ── Banner ──────────────────────────────────────────────────── */
.rv-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 20px;
  position: relative; overflow: hidden;
}
.rv-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--c-purple); border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .rv-banner { padding: 18px 24px; margin-bottom: 24px; } }

.rv-banner-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.rv-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-purple); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.rv-banner-icon svg { width: 20px; height: 20px; }
.rv-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.02em; margin-bottom: 1px; }
@media (min-width: 640px) { .rv-banner-title { font-size: 1.25rem; } }
.rv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.rv-banner-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rv-bstat {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 14px; border-radius: var(--r-lg); min-width: 52px;
  background: var(--c-bg); border: 1px solid var(--c-border-light);
}
.rv-bstat-val { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--c-text-1); }
.rv-bstat-lbl { font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-3); margin-top: 3px; }
.rv-bstat--purple .rv-bstat-val { color: var(--c-purple); }
.rv-bstat--amber  .rv-bstat-val { color: var(--c-amber);  }

/* Loading */
.rv-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--c-text-3); }
.rv-spinner { width: 20px; height: 20px; border: 2px solid var(--c-border); border-top-color: var(--c-purple); border-radius: 50%; animation: rv-spin 0.7s linear infinite; }
@keyframes rv-spin { to { transform: rotate(360deg); } }

/* Section nav */
.rv-sec-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
}
.rv-sec-nav {
  display: flex; gap: 4px; flex-wrap: wrap; flex: 1; min-width: 0;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); padding: 6px; box-shadow: var(--sh-xs);
}

/* Export menu */
.rv-export { position: relative; flex-shrink: 0; }
.rv-export-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: var(--r-lg);
  background: var(--c-purple); color: #fff; border: none; cursor: pointer;
  font-size: 0.875rem; font-weight: 600;
  box-shadow: var(--sh-xs); transition: background var(--dur), transform var(--dur);
}
.rv-export-btn:hover:not(:disabled) { background: var(--c-purple-hover, #4f46e5); }
.rv-export-btn:active:not(:disabled) { transform: translateY(1px); }
.rv-export-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.rv-export-chev { transition: transform var(--dur); }
.rv-export-chev--on { transform: rotate(180deg); }

.rv-export-menu {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 20;
  min-width: 240px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-lg); box-shadow: var(--sh-md, 0 8px 24px rgba(0,0,0,0.08));
  padding: 6px; display: flex; flex-direction: column; gap: 2px;
}
.rv-export-item {
  display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
  padding: 10px 12px; border-radius: var(--r-md, 8px);
  background: transparent; border: none; cursor: pointer; text-align: left;
  transition: background var(--dur);
}
.rv-export-item:hover { background: var(--c-bg); }
.rv-export-item-title { font-size: 0.875rem; font-weight: 600; color: var(--c-text-1); }
.rv-export-item-sub   { font-size: 0.75rem; color: var(--c-text-3); }

@media (max-width: 480px) {
  .rv-sec-row { flex-direction: column; align-items: stretch; }
  .rv-export, .rv-export-btn { width: 100%; justify-content: center; }
  .rv-export-menu { left: 0; right: 0; }
}
.rv-sec-btn {
  padding: 6px 16px; border-radius: var(--r-lg); font-size: 0.875rem; font-weight: 500;
  color: var(--c-text-3); background: transparent; border: none; cursor: pointer;
  transition: all var(--dur); white-space: nowrap;
}
.rv-sec-btn:hover:not(.rv-sec-btn--on) { color: var(--c-text-1); background: var(--c-bg); }
.rv-sec-btn--on { background: var(--c-purple-tint); color: var(--c-purple); font-weight: 600; }

/* Section label */
.rv-sec-label {
  font-size: 0.625rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--c-text-3); margin-bottom: 10px; margin-top: 6px;
}
.rv-sec-sub { font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 0.75rem; }

/* Stats grids */
.rv-stats-grid   { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; }
.rv-stats-grid-3 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; }
@media (min-width: 768px)  { .rv-stats-grid   { grid-template-columns: repeat(4, 1fr); gap: 14px; } }
@media (min-width: 640px)  { .rv-stats-grid-3 { grid-template-columns: repeat(3, 1fr); gap: 14px; } }

/* Card base */
.rv-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 18px 20px; margin-bottom: 14px;
}
.rv-no-pad { padding: 0; overflow: hidden; }
.rv-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); margin-bottom: 16px; }

/* Ranking */
.rv-rank-card { margin-bottom: 20px; }
.rv-rank-list { display: flex; flex-direction: column; gap: 12px; }
.rv-rank-row { display: flex; align-items: center; gap: 12px; }
.rv-rank-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--r-sm);
  font-size: 0.875rem; font-weight: 800; flex-shrink: 0;
}
.rv-rank-a { background: var(--c-green-bg); color: #047857; }
.rv-rank-b { background: #DBEAFE;            color: #1D4ED8; }
.rv-rank-c { background: #FEF3C7;            color: #D97706; }
.rv-rank-bar-wrap { flex: 1; height: 8px; background: var(--c-bg); border-radius: var(--r-full); overflow: hidden; }
.rv-rank-bar { height: 100%; transform-origin: left center; transform: scaleX(0); transition: transform 0.5s ease; }
.rv-rank-bar-a { background: var(--c-green); }
.rv-rank-bar-b { background: #1D4ED8; }
.rv-rank-bar-c { background: #D97706; }
.rv-rank-count { font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2); white-space: nowrap; min-width: 72px; text-align: right; }

/* Oil company */
.rv-oil-list { display: flex; flex-direction: column; gap: 10px; }
.rv-oil-row { display: flex; align-items: center; gap: 12px; }
.rv-oil-name { font-size: 0.875rem; font-weight: 500; color: var(--c-text-2); text-transform: capitalize; min-width: 80px; }
.rv-oil-bar-wrap { flex: 1; height: 8px; background: var(--c-bg); border-radius: var(--r-full); overflow: hidden; }
.rv-oil-bar { height: 100%; background: var(--c-purple); transform-origin: left center; transform: scaleX(0); transition: transform 0.5s ease; }
.rv-oil-count { font-size: 0.875rem; font-weight: 700; color: var(--c-purple); min-width: 28px; text-align: right; }

/* Expiry table */
.rv-tbl-wrap { overflow-x: auto; }
@media (max-width: 767px) { .rv-tbl-wrap { display: none; } }
.rv-tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.rv-tbl thead tr { border-bottom: 1px solid var(--c-border); }
.rv-tbl th { padding: 10px 16px; text-align: left; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--c-text-3); white-space: nowrap; }
.rv-tbl td { padding: 12px 16px; border-bottom: 1px solid var(--c-border-light); vertical-align: middle; }
.rv-tbl tbody tr:last-child td { border-bottom: none; }
.rv-exp-row { transition: background var(--dur); }
.rv-exp-row:hover td { background: var(--c-bg); }

.rv-urg-row-critical { background: rgba(220,38,38,0.04); }
.rv-urg-row-warning  { background: rgba(217,119,6,0.04); }
.rv-urg-row-notice   { background: transparent; }

.rv-driver-cell { display: flex; flex-direction: column; gap: 1px; }
.rv-driver-name { font-weight: 600; color: var(--c-text-1); }
.rv-driver-id   { font-size: 0.75rem; color: var(--c-text-3); }
.mono { font-variant-numeric: tabular-nums; }

.rv-urg-badge {
  display: inline-flex; padding: 3px 9px; border-radius: var(--r-full);
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.03em;
}
.rv-urg-critical { background: var(--c-red-tint);   color: var(--c-red);   }
.rv-urg-warning  { background: var(--c-amber-tint); color: var(--c-amber); }
.rv-urg-notice   { background: var(--c-accent-tint); color: var(--c-accent); }

/* Mobile expiry cards */
.rv-exp-cards { display: none; flex-direction: column; gap: 10px; padding: 12px; }
@media (max-width: 767px) { .rv-exp-cards { display: flex; } }
.rv-exp-card {
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-lg); padding: 14px;
}
.rv-urg-row-critical.rv-exp-card { border-color: var(--c-red-bg);   background: rgba(220,38,38,0.04); }
.rv-urg-row-warning.rv-exp-card  { border-color: var(--c-amber-bg); background: rgba(217,119,6,0.04); }
.rv-urg-row-notice.rv-exp-card   { background: transparent; }
.rv-exp-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px; }
.rv-exp-card-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 0.8125rem; color: var(--c-text-2); }
.rv-mk { font-size: 0.75rem; font-weight: 600; text-transform: none; letter-spacing: 0; color: var(--c-text-3); margin-right: 4px; }

@media (max-width: 360px) {
  .rv-rank-row,
  .rv-oil-row,
  .rv-exp-card-top {
    flex-direction: column;
    align-items: flex-start;
  }

  .rv-rank-count,
  .rv-oil-name,
  .rv-oil-count {
    min-width: 0;
    text-align: left;
  }

  .rv-exp-card-meta {
    flex-direction: column;
    gap: 6px;
  }
}

/* Empty */
.rv-empty-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px; color: var(--c-text-3); text-align: center; }
.rv-empty-card svg { width: 40px; height: 40px; }

/* ── Toolbar: date range + export PDF button ─────────────────────────────── */
.rv-toolbar { display: inline-flex; align-items: center; gap: 10px; flex-shrink: 0; }
@media (max-width: 480px) {
  .rv-toolbar { width: 100%; flex-direction: column; align-items: stretch; }
  .rv-toolbar .rv-export-btn { width: 100%; justify-content: center; }
}

/* ── Print template (hidden on screen, revealed via @media print) ─────────── */
.rv-print { display: none; }

@media print {
  /* Hide everything else and reveal only the print template. */
  body * { visibility: hidden !important; }
  .rv-print, .rv-print * { visibility: visible !important; }
  .rv-print {
    display: block !important;
    position: absolute; inset: 0; top: 0; left: 0; right: 0;
    width: 100%; padding: 0; margin: 0;
    color: #0F172A; background: #fff;
    font-family: 'Hanken Grotesk', 'Inter', system-ui, sans-serif;
    font-size: 11pt; line-height: 1.45;
  }
  @page { size: A4 portrait; margin: 18mm 16mm 18mm 16mm; }

  .rvp-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 6mm; }
  .rvp-brand { display: flex; align-items: center; gap: 8px; }
  .rvp-brand-dot { width: 10px; height: 10px; border-radius: 50%; background: #1D4ED8; }
  .rvp-brand-name { font-size: 14pt; font-weight: 800; letter-spacing: -0.02em; color: #0F172A; }
  .rvp-brand-tag  { font-size: 9pt;  color: #64748B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
  .rvp-meta { text-align: right; }
  .rvp-meta-title { font-size: 16pt; font-weight: 800; letter-spacing: -0.02em; color: #0F172A; margin: 0 0 2mm; }
  .rvp-meta-sub   { font-size: 9.5pt; color: #475569; margin: 0; }
  .rvp-meta-sub strong { color: #0F172A; }
  .rvp-sep { margin: 0 6px; color: #CBD5E1; }

  .rvp-rule { border: 0; border-top: 2px solid #0F172A; margin: 4mm 0 6mm; }

  .rvp-section { margin-bottom: 8mm; page-break-inside: avoid; }
  .rvp-h2 {
    font-size: 12pt; font-weight: 800; letter-spacing: -0.01em;
    color: #0F172A; margin: 0 0 3mm;
    padding-bottom: 2mm; border-bottom: 1px solid #E2E8F0;
  }
  .rvp-h2-sub { font-size: 9.5pt; font-weight: 500; color: #64748B; }
  .rvp-h3 {
    font-size: 10pt; font-weight: 700; color: #334155;
    margin: 4mm 0 2mm; text-transform: uppercase; letter-spacing: 0.05em;
  }
  .rvp-empty { font-size: 10pt; color: #64748B; font-style: italic; }

  .rvp-kv, .rvp-tbl {
    width: 100%; border-collapse: collapse;
    font-size: 10pt;
  }
  .rvp-kv th {
    text-align: left; font-weight: 500; color: #475569;
    padding: 1.4mm 0; border-bottom: 1px dotted #E2E8F0; width: 70%;
  }
  .rvp-kv td {
    text-align: right; font-weight: 700; color: #0F172A;
    padding: 1.4mm 0; border-bottom: 1px dotted #E2E8F0;
    font-variant-numeric: tabular-nums;
  }
  .rvp-tbl thead th {
    text-align: left; font-size: 8.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.06em; color: #475569;
    padding: 2mm 3mm; background: #F1F5F9; border-bottom: 1px solid #CBD5E1;
  }
  .rvp-tbl tbody td {
    font-size: 10pt; color: #0F172A;
    padding: 2mm 3mm; border-bottom: 1px solid #E2E8F0;
    font-variant-numeric: tabular-nums;
  }
  .rvp-tbl tbody tr:nth-child(even) td { background: #F8FAFC; }
  .rvp-tbl tbody tr:last-child td { border-bottom: 1px solid #CBD5E1; }

  .rvp-footer {
    margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #E2E8F0;
    font-size: 8.5pt; color: #94A3B8; text-align: center;
    text-transform: uppercase; letter-spacing: 0.08em;
  }
}
</style>
