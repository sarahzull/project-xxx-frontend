<script setup>
import { ref, computed, onMounted } from 'vue'
import { ChevronLeftIcon, TruckIcon, AlertIcon, CloseIcon } from '../../components/icons/index.js'
import { useRouter } from 'vue-router'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement,
} from 'chart.js'
import driversApi from '../../api/drivers'
import { useThemeStore } from '../../stores/theme'
import DataTable from '../../components/common/DataTable.vue'
import SearchInput from '../../components/common/SearchInput.vue'
import StatusBadge from '../../components/common/StatusBadge.vue'
import StatCard from '../../components/common/StatCard.vue'
import ChartCard from '../../components/common/ChartCard.vue'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const props = defineProps({ id: { type: String, required: true } })
const router = useRouter()
const theme  = useThemeStore()

// ── State ─────────────────────────────────────────────────────────────────────
const driver    = ref(null)
const trips     = ref([])
const kmSummary = ref(null)
const loading   = ref(true)
const tripSearch = ref('')
const tripSortKey = ref('')
const tripSortDir = ref('asc')

// ── Columns ───────────────────────────────────────────────────────────────────
const tripColumns = [
  { key: 'date',               label: 'Date',          sortable: true },
  { key: 'delivery_note',      label: 'Delivery Note' },
  { key: 'type',               label: 'Type',          sortable: true },
  { key: 'ship_to_party_name', label: 'Ship To' },
  { key: 'location',           label: 'Location' },
  { key: 'material',           label: 'Material' },
  { key: 'oil_company',        label: 'Oil Co.',        sortable: true },
  { key: 'load_size',          label: 'Load (ltr)',     sortable: true },
  { key: 'km_driven',          label: 'KM Driven',     sortable: true },
  { key: 'special_notes',      label: 'Notes' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysUntil(s) {
  if (!s) return 999
  const now = new Date(); now.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(s) - now) / 86400000)
}
function isExpiringSoon(dateStr) { return daysUntil(dateStr) <= 90 }
function formatDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

// ── Computed: driver stats ────────────────────────────────────────────────────
const avgKm = computed(() => {
  if (!kmSummary.value?.total_trips) return '—'
  return Math.round(kmSummary.value.total_km_driven / kmSummary.value.total_trips).toLocaleString()
})

const licenseUrgency = computed(() => {
  if (!driver.value) return null
  const daysLic = daysUntil(driver.value.license_expiry)
  const daysGdl = daysUntil(driver.value.gdl_expiry)
  const days    = Math.min(daysLic, daysGdl)
  if (days > 90) return null
  const key   = days <= 30 ? 'critical' : days <= 60 ? 'warning' : 'notice'
  const field = daysLic <= daysGdl ? 'License' : 'GDL'
  return { days, key, field }
})

// ── Computed: trip filtering + sorting ───────────────────────────────────────
const filteredTrips = computed(() => {
  if (!tripSearch.value) return trips.value
  const q = tripSearch.value.toLowerCase()
  return trips.value.filter(t =>
    (t.delivery_note      || '').toLowerCase().includes(q) ||
    (t.ship_to_party_name || '').toLowerCase().includes(q) ||
    (t.location           || '').toLowerCase().includes(q) ||
    (t.material           || '').toLowerCase().includes(q) ||
    (t.oil_company        || '').toLowerCase().includes(q) ||
    (t.type               || '').toLowerCase().includes(q)
  )
})

const sortedTrips = computed(() => {
  const list = [...filteredTrips.value]
  if (!tripSortKey.value) return list
  return list.sort((a, b) => {
    let va = a[tripSortKey.value] ?? ''
    let vb = b[tripSortKey.value] ?? ''
    // Numeric sort for load_size and km_driven
    if (tripSortKey.value === 'load_size' || tripSortKey.value === 'km_driven') {
      va = Number(va) || 0
      vb = Number(vb) || 0
    } else {
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
    }
    if (va < vb) return tripSortDir.value === 'asc' ? -1 : 1
    if (va > vb) return tripSortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

function toggleTripSort(key) {
  if (tripSortKey.value === key) {
    tripSortDir.value = tripSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    tripSortKey.value = key
    tripSortDir.value = 'asc'
  }
}

// ── Computed: chart colour tokens ─────────────────────────────────────────────
const cc = computed(() => ({
  grid:  theme.isDark ? '#2A2D3A' : '#F1F5F9',
  tick:  theme.isDark ? '#4B5563' : '#94A3B8',
  label: theme.isDark ? '#94A3B8' : '#475569',
}))

// ── Computed: monthly trips chart ─────────────────────────────────────────────
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const monthlyChartData = computed(() => {
  const counts = {}
  trips.value.forEach(t => {
    if (!t.date) return
    const d = new Date(t.date)
    if (isNaN(d)) return
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts[key] = (counts[key] || 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))
  return {
    labels: sorted.map(([key]) => {
      const [y, m] = key.split('-')
      return `${MONTHS_SHORT[+m - 1]} '${y.slice(2)}`
    }),
    datasets: [{
      label: 'Trips',
      data: sorted.map(([, v]) => v),
      backgroundColor: theme.isDark ? 'rgba(59,130,246,0.85)' : 'rgba(29,78,216,0.85)',
      hoverBackgroundColor: theme.isDark ? '#60A5FA' : '#1D4ED8',
      borderRadius: 5,
      borderSkipped: false,
    }],
  }
})

// ── Computed: oil company doughnut ────────────────────────────────────────────
const palette = ['#1D4ED8','#7C3AED','#16A34A','#D97706','#EF4444','#0891B2','#BE185D','#65A30D']

const oilChartData = computed(() => {
  const counts = {}
  trips.value.forEach(t => {
    if (!t.oil_company) return
    const name = (t.oil_company.charAt(0).toUpperCase() + t.oil_company.slice(1)).trim()
    counts[name] = (counts[name] || 0) + 1
  })
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return {
    labels: entries.map(([k]) => k),
    datasets: [{
      data: entries.map(([, v]) => v),
      backgroundColor: entries.map((_, i) => palette[i % palette.length]),
      hoverBackgroundColor: entries.map((_, i) => palette[i % palette.length]),
      borderWidth: 3,
      borderColor: theme.isDark ? '#1A1D27' : '#FFFFFF',
    }],
  }
})

// ── Chart options ─────────────────────────────────────────────────────────────
const barOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: theme.isDark ? '#1A1D27' : '#0F172A',
      titleColor: theme.isDark ? '#F1F5F9' : '#FFFFFF',
      bodyColor:  theme.isDark ? '#94A3B8'  : '#CBD5E1',
      borderColor: theme.isDark ? '#2A2D3A' : 'transparent',
      borderWidth: 1,
      padding: 10,
      callbacks: { label: ctx => ` ${ctx.raw} trip${ctx.raw !== 1 ? 's' : ''}` },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: cc.value.grid },
      ticks: { color: cc.value.tick, font: { size: 11 }, precision: 0 },
      border: { display: false },
    },
    x: {
      grid: { display: false },
      ticks: { color: cc.value.label, font: { size: 10 } },
      border: { display: false },
    },
  },
}))

const doughnutOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: { padding: 14, font: { size: 11, family: 'Inter' }, color: cc.value.label },
    },
    tooltip: {
      callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} trip${ctx.raw !== 1 ? 's' : ''}` },
    },
  },
}))

// ── Fetch ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [dRes, tRes, kRes] = await Promise.all([
      driversApi.get(props.id),
      driversApi.trips(props.id),
      driversApi.kmSummary(props.id),
    ])
    driver.value    = dRes.data.data
    trips.value     = tRes.data.data
    kmSummary.value = kRes.data.data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="dd">

    <!-- Back link -->
    <button class="back-link" @click="router.back()">
      <ChevronLeftIcon :size="16" />
      Back to Drivers
    </button>

    <div v-if="loading" class="loading-state">Loading driver profile…</div>

    <template v-else-if="driver">

      <!-- ── Profile header ──────────────────────────────────────── -->
      <div class="dd-banner mb-section" :class="`dd-banner-${driver.status}`">
        <div class="dd-banner-left">
          <div class="dd-avatar" :class="`dd-avatar-${driver.status}`">
            {{ (driver.name || '?').charAt(0).toUpperCase() }}
          </div>
          <div class="dd-banner-info">
            <h1 class="dd-banner-name">{{ driver.name }}</h1>
            <p class="dd-banner-id">
              {{ driver.driver_id }}
              <span v-if="driver.license_type"> · {{ driver.license_type }}</span>
            </p>
          </div>
        </div>
        <div class="dd-banner-badges">
          <StatusBadge :status="driver.status" />
          <span :class="['dd-rank-badge', `dd-rank-${(driver.ranking || '').toLowerCase()}`]">
            Rank {{ driver.ranking }}
          </span>
          <span v-if="driver.road_tanker_id" class="dd-tanker-chip">
            <TruckIcon :size="14" />
            {{ driver.road_tanker_id }}
          </span>
        </div>
      </div>

      <!-- ── License Alert ──────────────────────────────────────── -->
      <div
        v-if="licenseUrgency"
        :class="['dd-license-alert', `dd-alert-${licenseUrgency.key}`, 'mb-section']"
      >
        <div class="dd-alert-icon">
          <AlertIcon :size="18" />
        </div>
        <div>
          <p class="dd-alert-title">
            {{ licenseUrgency.field }} Expiring in {{ licenseUrgency.days }} day{{ licenseUrgency.days !== 1 ? 's' : '' }}
            <span v-if="licenseUrgency.key === 'critical'">&nbsp;— Action Required</span>
          </p>
          <p class="dd-alert-sub">Immediate renewal required to maintain driver assignment eligibility</p>
        </div>
      </div>

      <!-- ── Performance Stats ──────────────────────────────────── -->
      <p class="dd-section-label">Performance Summary</p>
      <div class="dd-stats-grid mb-section">
        <StatCard
          title="Total Trips"
          :value="kmSummary?.total_trips || 0"
          color="blue"
        />
        <StatCard
          title="Total KM Driven"
          :value="(kmSummary?.total_km_driven || 0).toLocaleString()"
          color="green"
          subtitle="km"
        />
        <StatCard
          title="Avg KM / Trip"
          :value="avgKm"
          color="purple"
          subtitle="km average"
        />
      </div>

      <!-- ── Driver Profile ──────────────────────────────────────── -->
      <p class="dd-section-label">Driver Profile</p>
      <div class="card mb-section">
        <div class="detail-meta-grid">
          <div>
            <p class="meta-label">Date of Birth</p>
            <p class="meta-value">{{ formatDate(driver.dob) }}</p>
          </div>
          <div>
            <p class="meta-label">License Type</p>
            <p class="meta-value">{{ driver.license_type || '—' }}</p>
          </div>
          <div>
            <p class="meta-label">License Expiry</p>
            <p :class="['meta-value', isExpiringSoon(driver.license_expiry) ? 'tc-amber' : '']">
              {{ formatDate(driver.license_expiry) }}
            </p>
          </div>
          <div>
            <p class="meta-label">GDL Expiry</p>
            <p :class="['meta-value', isExpiringSoon(driver.gdl_expiry) ? 'tc-amber' : '']">
              {{ formatDate(driver.gdl_expiry) }}
            </p>
          </div>
          <div>
            <p class="meta-label">Ranking</p>
            <p :class="['meta-value', driver.ranking === 'A' ? 'rank-a' : driver.ranking === 'B' ? 'rank-b' : 'rank-c']">
              {{ driver.ranking || '—' }}
            </p>
          </div>
          <div>
            <p class="meta-label">Road Tanker</p>
            <p class="meta-value">{{ driver.road_tanker_id || '—' }}</p>
          </div>
        </div>
      </div>

      <!-- ── Analytics Charts ───────────────────────────────────── -->
      <template v-if="trips.length > 0">
        <p class="dd-section-label">Analytics</p>
        <div class="dd-charts-grid mb-section">
          <ChartCard
            title="Monthly Trips"
            subtitle="Trip count per month — all time"
            height="200px"
          >
            <template #actions>
              <div class="dd-legend">
                <span class="dd-legend-dot" style="background:#1D4ED8"></span>
                <span class="dd-legend-text">Trips</span>
              </div>
            </template>
            <Bar :data="monthlyChartData" :options="barOptions" />
          </ChartCard>

          <ChartCard
            title="Trips by Oil Company"
            subtitle="Distribution across clients"
            height="200px"
          >
            <Doughnut :data="oilChartData" :options="doughnutOptions" />
          </ChartCard>
        </div>
      </template>

      <!-- ── Trip History ───────────────────────────────────────── -->
      <div class="dd-history-hd mb-3">
        <div class="dd-history-hd-left">
          <p class="dd-section-label" style="margin-bottom:0">Trip History</p>
          <p class="dd-history-count">
            {{ sortedTrips.length }} trip{{ sortedTrips.length !== 1 ? 's' : '' }}
            <span v-if="tripSearch" class="chip chip--filter">matching search</span>
            <span v-if="tripSortKey" class="chip chip--sort">
              {{ tripSortDir === 'asc' ? '↑' : '↓' }} {{ tripSortKey.replace('_', ' ') }}
            </span>
          </p>
        </div>
        <div class="dd-history-right">
          <Transition name="dd-fade">
            <button v-if="tripSearch" class="dd-clear-btn" @click="tripSearch = ''">
              <CloseIcon :size="10" :stroke-width="2.5" />
              Reset
            </button>
          </Transition>
          <div class="dd-history-search">
            <SearchInput v-model="tripSearch" placeholder="Search trips…" />
          </div>
        </div>
      </div>

      <DataTable
        :columns="tripColumns"
        :rows="sortedTrips"
        :sort-key="tripSortKey"
        :sort-dir="tripSortDir"
        empty-message="No trips found."
        @sort="toggleTripSort"
      >
        <template #cell-date="{ value }">{{ formatDate(value) }}</template>
        <template #cell-load_size="{ value }">{{ Number(value).toLocaleString() }}</template>
        <template #cell-special_notes="{ value }">
          <span v-if="value && value.length" class="flex gap-1 flex-wrap">
            <span v-for="(note, i) in value" :key="i" class="note-tag">{{ note }}</span>
          </span>
          <span v-else class="tc-3">—</span>
        </template>
      </DataTable>

    </template>
  </div>
</template>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */
.dd { min-width: 0; overflow: hidden; }
.mb-section { margin-bottom: 20px; }
@media (min-width: 640px) { .mb-section { margin-bottom: 24px; } }

/* ── Section label ────────────────────────────────────────────── */
.dd-section-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--c-text-3);
  margin-bottom: 10px;
}

/* ── Profile header ───────────────────────────────────────────── */
.dd-banner {
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-left: 4px solid var(--c-border);   /* overridden by status below */
  border-radius: var(--r-xl);
  box-shadow: var(--sh-sm);
  padding: 18px 20px;
}
@media (min-width: 640px) {
  .dd-banner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
  }
}
/* Status-coloured left bar */
.dd-banner-active  { border-left-color: var(--c-green); }
.dd-banner-blocked { border-left-color: var(--c-red); }

.dd-banner-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.dd-banner-info { min-width: 0; }

.dd-avatar {
  width: 48px; height: 48px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.125rem; font-weight: 700; flex-shrink: 0;
}
.dd-avatar-active  { background: var(--c-green-bg);   color: var(--c-green); }
.dd-avatar-blocked { background: var(--c-red-bg);     color: var(--c-red); }

.dd-banner-name {
  font-size: 1.125rem; font-weight: 700; color: var(--c-text-1);
  letter-spacing: -0.02em; line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
@media (min-width: 640px) { .dd-banner-name { font-size: 1.375rem; } }
.dd-banner-id { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 3px; }

.dd-banner-badges { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }

/* Rank badge */
.dd-rank-badge {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: var(--r-full);
  font-size: 0.75rem; font-weight: 700; white-space: nowrap;
  border: 1.5px solid transparent;
}
.dd-rank-a { background: #16A34A; color: #fff; border-color: #16A34A; }  /* green  */
.dd-rank-b { background: #1D4ED8; color: #fff; border-color: #1D4ED8; }  /* blue   */
.dd-rank-c { background: #F97316; color: #fff; border-color: #F97316; }  /* orange */

/* Tanker chip */
.dd-tanker-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; border-radius: var(--r-full);
  font-size: 0.75rem; font-weight: 500; white-space: nowrap;
  background: var(--c-bg); color: var(--c-text-2);
  border: 1.5px solid var(--c-border);
}
.dd-tanker-chip svg { width: 13px; height: 13px; flex-shrink: 0; }

/* ── License Alert ────────────────────────────────────────────── */
.dd-license-alert {
  display: flex; align-items: flex-start; gap: 12px;
  border-radius: var(--r-lg);
  padding: 14px 16px;
}
.dd-alert-critical { background: var(--c-red-tint);   border: 1px solid var(--c-red-bg); }
.dd-alert-warning  { background: var(--c-amber-tint); border: 1px solid var(--c-amber-bg); }
.dd-alert-notice   { background: var(--c-amber-tint); border: 1px solid #FDE68A; }

.dd-alert-icon {
  width: 32px; height: 32px; border-radius: var(--r-md);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.dd-alert-critical .dd-alert-icon { background: var(--c-red-bg);   color: var(--c-red); }
.dd-alert-warning  .dd-alert-icon { background: var(--c-amber-bg); color: var(--c-amber); }
.dd-alert-notice   .dd-alert-icon { background: var(--c-amber-bg); color: var(--c-amber); }
.dd-alert-icon svg { width: 16px; height: 16px; }

.dd-alert-title {
  font-size: 0.875rem; font-weight: 600; margin-bottom: 2px;
}
.dd-alert-critical .dd-alert-title { color: var(--c-red); }
.dd-alert-warning  .dd-alert-title { color: var(--c-amber); }
.dd-alert-notice   .dd-alert-title { color: #92400E; }
.dd-alert-sub { font-size: 0.8125rem; color: var(--c-text-2); }

/* ── Stats grid ───────────────────────────────────────────────── */
.dd-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  min-width: 0;
}
@media (min-width: 640px) { .dd-stats-grid { gap: 14px; } }

/* ── Charts grid ──────────────────────────────────────────────── */
.dd-charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  min-width: 0;
}
@media (min-width: 640px) { .dd-charts-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; } }

/* Chart legend chip */
.dd-legend {
  display: flex; align-items: center; gap: 6px;
  font-size: 0.75rem; color: var(--c-text-3);
}
.dd-legend-dot  { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.dd-legend-text { white-space: nowrap; }

/* ── Trip history header ──────────────────────────────────────── */
.dd-history-hd {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.dd-history-hd-left { min-width: 0; }
.dd-history-count {
  font-size: 0.8125rem; color: var(--c-text-2); font-weight: 500;
  margin-top: 2px; display: flex; align-items: center; gap: 6px;
}
/* Rank text colours in profile meta grid */
.rank-a { color: #16A34A; font-weight: 700; }  /* green  */
.rank-b { color: #1D4ED8; font-weight: 700; }  /* blue   */
.rank-c { color: #F97316; font-weight: 700; }  /* orange */

.dd-history-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.dd-history-search { flex-shrink: 0; width: 200px; min-width: 0; }
@media (max-width: 480px) { .dd-history-right { width: 100%; } .dd-history-search { width: 100%; } }

.dd-clear-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur); flex-shrink: 0; white-space: nowrap;
}
.dd-clear-btn svg { width: 10px; height: 10px; }
.dd-clear-btn:hover { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }

.dd-fade-enter-active, .dd-fade-leave-active { transition: opacity 150ms, transform 150ms; }
.dd-fade-enter-from, .dd-fade-leave-to { opacity: 0; transform: scale(0.85); }
</style>
