<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import reportsApi   from '../../api/reports'
import dashboardApi  from '../../api/dashboard'
import { useThemeStore } from '../../stores/theme'
import StatCard        from '../../components/common/StatCard.vue'
import ChartCard       from '../../components/common/ChartCard.vue'
import ModalSheet      from '../../components/common/ModalSheet.vue'
import DateRangePicker from '../../components/common/DateRangePicker.vue'
import AlertsWidget    from '../../components/dashboard/AlertsWidget.vue'
import ActivityFeed    from '../../components/dashboard/ActivityFeed.vue'
import RiskDrivers     from '../../components/dashboard/RiskDrivers.vue'
import BirthdayCard    from '../../components/dashboard/BirthdayCard.vue'
import { AlertIcon, CheckCircleIcon, CalendarIcon } from '../../components/icons/index.js'

const router = useRouter()
const theme  = useThemeStore()

// ── State ─────────────────────────────────────────────────────────────────────
// Each primary section has its own loading flag so the page renders progressively:
// the shell + banner paint instantly, and each widget becomes interactive the
// moment *its* request resolves — independent of siblings.
const driverStats          = ref(null)
const driverStatsLoading   = ref(true)
const driverStatsError     = ref(false)
const tripStats            = ref(null)
const tripStatsLoading     = ref(true)
const tripStatsError       = ref(false)
const monthlyTrips         = ref([])
const monthlyTripsLoading  = ref(true)
const monthlyTripsError    = ref(false)
const expiringList         = ref([])
const expiringListLoading  = ref(true)
const expiringListError    = ref(false)

const showBlockedModal = ref(false)
const blockedDrivers   = ref([])
const loadingBlocked   = ref(false)

// ── New dashboard widget state ─────────────────────────────────────────────
const alertsData         = ref(null)
const alertsLoading      = ref(true)
const alertsError        = ref(false)
const tripsToday         = ref(null)
const tripsTodayLoading  = ref(true)
const tripsTodayError    = ref(false)
const driverAvail        = ref(null)
const driverAvailLoading = ref(true)
const driverAvailError   = ref(false)
const activities         = ref([])
const activitiesLoading  = ref(true)
const activitiesError    = ref(false)
const riskDrivers        = ref([])
const riskLoading        = ref(true)
const riskError          = ref(false)
const birthdays          = ref([])
const birthdaysLoading   = ref(true)
const birthdaysError     = ref(false)

// ── Date range filter (drives Operations stats) ─────────────────────────────
function _toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
const _todayISO = _toISO(new Date())
const dateFrom = ref(_todayISO)
const dateTo   = ref(_todayISO)

// Dynamic label for the Operations zone — mirrors the active range
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function _fmtShort(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${SHORT_MONTHS[m - 1]} ${y}`
}
const opsRangeLabel = computed(() => {
  const f = dateFrom.value
  const t = dateTo.value
  if (!f || !t) return "Today's Operations"

  if (f === t && f === _todayISO) return "Today's Operations"
  if (f === t) return `Operations · ${_fmtShort(f)}`

  // Compare against this-week / this-month / last-30 presets
  const now = new Date()
  const startOfWeek = new Date(now)
  const day = startOfWeek.getDay()
  startOfWeek.setDate(startOfWeek.getDate() - (day === 0 ? 6 : day - 1))
  if (f === _toISO(startOfWeek) && t === _todayISO) return "This Week's Operations"

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  if (f === _toISO(startOfMonth) && t === _todayISO) return "This Month's Operations"

  const last30 = new Date(now); last30.setDate(last30.getDate() - 29)
  if (f === _toISO(last30) && t === _todayISO) return 'Last 30 Days · Operations'

  return `Operations · ${_fmtShort(f)} – ${_fmtShort(t)}`
})

const totalTripsLabel = computed(() =>
  (dateFrom.value === _todayISO && dateTo.value === _todayISO) ? 'Total Trips Today' : 'Total Trips'
)

// ── Date display ──────────────────────────────────────────────────────────────
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const _now   = new Date()
const todayFormatted = `${DAYS[_now.getDay()]}, ${_now.getDate()} ${MONTHS[_now.getMonth()]} ${_now.getFullYear()}`

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}
function daysUntil(s) {
  if (!s) return 999
  const now = new Date(); now.setHours(0,0,0,0)
  return Math.ceil((new Date(s) - now) / 86400000)
}
function urgencyLabel(d) { return d <= 30 ? 'Critical' : d <= 60 ? 'Warning' : 'Notice' }
function urgencyKey(d)   { return d <= 30 ? 'critical' : d <= 60 ? 'warning'  : 'notice' }

const sortedExpiry = computed(() =>
  [...expiringList.value].sort((a, b) => daysUntil(a.license_expiry) - daysUntil(b.license_expiry))
)

// ── Blocked modal ─────────────────────────────────────────────────────────────
async function openBlockedModal() {
  showBlockedModal.value = true
  if (blockedDrivers.value.length) return
  loadingBlocked.value = true
  try {
    const res = await reportsApi.blockedDrivers()
    blockedDrivers.value = res.data.data
  } finally {
    loadingBlocked.value = false
  }
}
function goToDriver(id) {
  showBlockedModal.value = false
  router.push({ name: 'driver-detail', params: { id } })
}

// ── ApexCharts theme helpers ──────────────────────────────────────────────────
const isDark = computed(() => theme.isDark)
const apexTheme = computed(() => isDark.value ? 'dark' : 'light')
const gridColor = computed(() => isDark.value ? '#2A2D3A' : '#F1F5F9')
const labelColor = computed(() => isDark.value ? '#94A3B8' : '#475569')
const bgColor = computed(() => isDark.value ? '#1A1D27' : '#F8FAFC')

// ── Monthly Trips bar chart ───────────────────────────────────────────────────
const heroSeries = computed(() => [{
  name: 'Trips',
  data: monthlyTrips.value.map(m => m.trips),
}])

const heroOptions = computed(() => ({
  chart: {
    type: 'area',
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif',
    redrawOnParentResize: true,
    parentHeightOffset: 0,
    sparkline: { enabled: false },
  },
  theme: { mode: apexTheme.value },
  stroke: { curve: 'smooth', width: 2.5 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.4,
      opacityTo: 0.05,
      stops: [0, 90, 100],
    },
  },
  dataLabels: { enabled: false },
  colors: [isDark.value ? '#60A5FA' : '#1D4ED8'],
  xaxis: {
    categories: monthlyTrips.value.map(m => m.label),
    labels: { style: { colors: labelColor.value, fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: { style: { colors: labelColor.value, fontSize: '11px' } },
  },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  tooltip: {
    theme: apexTheme.value,
    y: { formatter: v => `${v} trips` },
  },
  markers: { size: 3, strokeWidth: 0, hover: { size: 6 } },
}))

// ── Driver Status donut chart ─────────────────────────────────────────────────
const statusSeries = computed(() => {
  const active  = driverStats.value?.active_drivers  || 0
  const blocked = driverStats.value?.blocked_drivers || 0
  const other   = Math.max(0, (driverStats.value?.total_drivers || 0) - active - blocked)
  return [active, blocked, other]
})

const statusOptions = computed(() => ({
  chart: {
    type: 'donut',
    background: 'transparent',
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif',
    redrawOnParentResize: true,
    parentHeightOffset: 0,
  },
  theme: { mode: apexTheme.value },
  labels: ['Active', 'Blocked', 'Inactive'],
  colors: [isDark.value ? '#4ADE80' : '#16A34A', isDark.value ? '#F87171' : '#EF4444', '#94A3B8'],
  plotOptions: {
    pie: {
      donut: {
        size: '68%',
        labels: {
          show: true,
          total: {
            show: true,
            label: 'Total',
            fontSize: '13px',
            color: labelColor.value,
            formatter: () => driverStats.value?.total_drivers || 0,
          },
        },
      },
    },
  },
  dataLabels: { enabled: false },
  legend: {
    position: 'bottom',
    fontSize: '12px',
    labels: { colors: labelColor.value },
    markers: { width: 10, height: 10, radius: 5 },
  },
  tooltip: {
    theme: apexTheme.value,
    y: { formatter: v => `${v} drivers` },
  },
}))

// ── Oil Company bar chart ─────────────────────────────────────────────────────
// Token-aware palette: light values / dark values mirror CSS design tokens
const palette = computed(() => isDark.value
  ? ['#60A5FA','#A78BFA','#4ADE80','#FBBF24','#F87171','#22D3EE','#F472B6','#A3E635']
  : ['#1D4ED8','#7C3AED','#16A34A','#D97706','#EF4444','#0891B2','#BE185D','#65A30D']
)

const oilEntries = computed(() => {
  const obj = tripStats.value?.by_oil_company || {}
  return Object.entries(obj).sort((a, b) => b[1] - a[1])
})

const oilSeries = computed(() => [{
  name: 'Trips',
  data: oilEntries.value.map(([, v]) => v),
}])

const oilOptions = computed(() => ({
  chart: {
    type: 'bar',
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif',
    redrawOnParentResize: true,
    parentHeightOffset: 0,
  },
  theme: { mode: apexTheme.value },
  plotOptions: {
    bar: { borderRadius: 4, columnWidth: '55%', borderRadiusApplication: 'end' },
  },
  dataLabels: { enabled: false },
  colors: oilEntries.value.map((_, i) => palette.value[i % palette.value.length]),
  xaxis: {
    categories: oilEntries.value.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)),
    labels: { style: { colors: labelColor.value, fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: { style: { colors: labelColor.value, fontSize: '11px' } },
  },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  legend: { show: false },
  tooltip: {
    theme: apexTheme.value,
    y: { formatter: v => `${v} trips` },
  },
}))

// ── Rankings bar chart ────────────────────────────────────────────────────────
const rankMap = computed(() => isDark.value
  ? { A: '#4ADE80', B: '#60A5FA', C: '#FBBF24' }
  : { A: '#16A34A', B: '#1D4ED8', C: '#D97706' }
)

const rankEntries = computed(() => {
  const obj = driverStats.value?.drivers_by_ranking || {}
  return Object.entries(obj)
})

const rankSeries = computed(() => [{
  name: 'Drivers',
  data: rankEntries.value.map(([, v]) => v),
}])

const rankOptions = computed(() => ({
  chart: {
    type: 'bar',
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: 'Hanken Grotesk, system-ui, sans-serif',
    redrawOnParentResize: true,
    parentHeightOffset: 0,
  },
  theme: { mode: apexTheme.value },
  plotOptions: {
    bar: { borderRadius: 6, horizontal: true, barHeight: '55%', borderRadiusApplication: 'end' },
  },
  dataLabels: { enabled: true, style: { fontSize: '12px', fontWeight: 700 } },
  colors: rankEntries.value.map(([r]) => rankMap.value[r] || '#94A3B8'),
  xaxis: {
    labels: { style: { colors: labelColor.value, fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    categories: rankEntries.value.map(([r]) => `Rank ${r}`),
    labels: { style: { colors: labelColor.value, fontSize: '12px', fontWeight: 600 } },
  },
  grid: { borderColor: gridColor.value, strokeDashArray: 3, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
  legend: { show: false },
  tooltip: {
    theme: apexTheme.value,
    y: { formatter: v => `${v} drivers` },
  },
}))

// ── Fetch ─────────────────────────────────────────────────────────────────────
// Fire every section's request in parallel with no await — the page shell
// renders immediately and each widget populates as its own response arrives.
onMounted(() => {
  // Primary sections — now independent loaders (same pattern as widgets below)
  loadDriverStats()
  loadTripStats()
  loadMonthlyTrips()
  loadExpiringList()

  // Widget sections
  loadAlerts()
  loadTripsToday()
  loadDriverAvail()
  loadActivities()
  loadRiskDrivers()
  loadBirthdays()
})

function loadDriverStats() {
  driverStatsLoading.value = true; driverStatsError.value = false
  reportsApi.driverSummary()
    .then(r  => { driverStats.value         = r.data.data })
    .catch(() => { driverStatsError.value   = true })
    .finally(() => { driverStatsLoading.value = false })
}
function loadTripStats() {
  tripStatsLoading.value = true; tripStatsError.value = false
  reportsApi.tripSummary()
    .then(r  => { tripStats.value           = r.data.data })
    .catch(() => { tripStatsError.value     = true })
    .finally(() => { tripStatsLoading.value = false })
}
function loadMonthlyTrips() {
  monthlyTripsLoading.value = true; monthlyTripsError.value = false
  reportsApi.monthlyTrips()
    .then(r  => { monthlyTrips.value          = r.data.data })
    .catch(() => { monthlyTripsError.value    = true })
    .finally(() => { monthlyTripsLoading.value = false })
}
function loadExpiringList() {
  expiringListLoading.value = true; expiringListError.value = false
  reportsApi.licenseExpiry()
    .then(r  => { expiringList.value          = r.data.data })
    .catch(() => { expiringListError.value    = true })
    .finally(() => { expiringListLoading.value = false })
}

function loadAlerts() {
  alertsLoading.value = true; alertsError.value = false
  dashboardApi.getAlerts()
    .then(r  => { alertsData.value      = r.data.data })
    .catch(() => { alertsError.value    = true })
    .finally(() => { alertsLoading.value = false })
}
function loadTripsToday() {
  tripsTodayLoading.value = true; tripsTodayError.value = false
  dashboardApi.getTripsToday({ from: dateFrom.value, to: dateTo.value })
    .then(r  => { tripsToday.value         = r.data.data })
    .catch(() => { tripsTodayError.value   = true })
    .finally(() => { tripsTodayLoading.value = false })
}

// Re-fetch trip aggregates whenever the date range changes
watch([dateFrom, dateTo], () => { loadTripsToday() })
function loadDriverAvail() {
  driverAvailLoading.value = true; driverAvailError.value = false
  dashboardApi.getDriverAvailability()
    .then(r  => { driverAvail.value         = r.data.data })
    .catch(() => { driverAvailError.value   = true })
    .finally(() => { driverAvailLoading.value = false })
}
function loadActivities() {
  activitiesLoading.value = true; activitiesError.value = false
  dashboardApi.getRecentActivity()
    .then(r  => { activities.value         = r.data.data })
    .catch(() => { activitiesError.value   = true })
    .finally(() => { activitiesLoading.value = false })
}
function loadRiskDrivers() {
  riskLoading.value = true; riskError.value = false
  dashboardApi.getRiskDrivers()
    .then(r  => { riskDrivers.value       = r.data.data })
    .catch(() => { riskError.value        = true })
    .finally(() => { riskLoading.value    = false })
}
function loadBirthdays() {
  birthdaysLoading.value = true; birthdaysError.value = false
  dashboardApi.getBirthdays()
    .then(r  => { birthdays.value          = r.data.data })
    .catch(() => { birthdaysError.value    = true })
    .finally(() => { birthdaysLoading.value = false })
}
</script>

<template>
  <div class="adash">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="adash-banner">
      <div>
        <h1 class="adash-banner-title">Fleet Dashboard</h1>
        <!-- Live status chips -->
        <div class="adash-banner-chips">
          <span class="adash-chip adash-chip--blue">
            <span class="adash-chip-dot"></span>
            {{ driverAvail?.on_trip || '0' }} on trip
          </span>
          <span class="adash-chip adash-chip--green">
            <span class="adash-chip-dot"></span>
            {{ tripsToday?.total || '0' }} trips today
          </span>
          <span v-if="alertsData && (alertsData.license_expiring + alertsData.blocked_assigned + alertsData.incomplete_trips) > 0"
            class="adash-chip adash-chip--red">
            <span class="adash-chip-dot"></span>
            {{ alertsData.license_expiring + alertsData.blocked_assigned + alertsData.incomplete_trips }} alert{{ (alertsData.license_expiring + alertsData.blocked_assigned + alertsData.incomplete_trips) !== 1 ? 's' : '' }}
          </span>
        </div>
      </div>
      <div class="adash-banner-right">
        <span class="adash-today-pill" :title="todayFormatted">
          <CalendarIcon :size="14" aria-hidden="true" />
          <span class="adash-today-pill-text">{{ todayFormatted }}</span>
        </span>
        <DateRangePicker v-model:from="dateFrom" v-model:to="dateTo" />
      </div>
    </div>

    <!-- Sections render immediately with per-widget loading states
         (progressive rendering — no page-level loading gate) -->

      <!-- ── Alerts ────────────────────────────────────────── -->
      <div v-if="alertsError" class="adash-widget-err">
        Failed to load alerts.
        <button class="adash-retry-btn" @click="loadAlerts">Retry</button>
      </div>
      <AlertsWidget v-else :data="alertsData" :loading="alertsLoading" />

      <!-- ── Operations (full-width) ─────────────────────────── -->
      <div class="adash-ops-zone">
        <p class="adash-section-lbl adash-section-lbl--ops">{{ opsRangeLabel }}</p>
        <div v-if="tripsTodayLoading" class="adash-stats-grid adash-skel-grid">
          <div v-for="i in 4" :key="i" class="adash-skel-card"></div>
        </div>
        <div v-else class="adash-stats-grid">
          <StatCard :title="totalTripsLabel"  :value="tripsToday?.total     || 0" color="blue"   />
          <StatCard title="Completed"         :value="tripsToday?.completed || 0" color="green"  />
          <StatCard title="Ongoing"           :value="tripsToday?.ongoing   || 0" color="yellow" />
          <StatCard title="Cancelled"         :value="tripsToday?.cancelled || 0" color="red"    />
        </div>
        <!-- Completion rate bar -->
        <div v-if="!tripsTodayLoading && tripsToday?.total > 0" class="adash-completion-wrap">
          <div class="adash-completion-meta">
            <span class="adash-completion-lbl">Completion rate</span>
            <span class="adash-completion-pct">{{ Math.round((tripsToday?.completed || 0) / (tripsToday?.total || 1) * 100) }}%</span>
          </div>
          <div class="adash-completion-track">
            <div
              class="adash-completion-fill"
              :style="{ transform: `scaleX(${(tripsToday?.completed || 0) / (tripsToday?.total || 1)})` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- ── Driver Availability + Fleet Headcount (merged) ──── -->
      <p class="adash-section-lbl">
        Driver Availability
        <span v-if="dateFrom !== _todayISO || dateTo !== _todayISO" class="adash-section-hint">· live, as of today</span>
      </p>
      <div v-if="driverAvailLoading" class="adash-avail-grid adash-skel-grid">
        <div v-for="i in 3" :key="i" class="adash-skel-card"></div>
      </div>
      <template v-else>
        <div class="adash-avail-grid">
          <StatCard title="Available"  :value="driverAvail?.available || 0" color="green"  />
          <StatCard title="On Trip"    :value="driverAvail?.on_trip   || 0" color="blue"   />
          <StatCard title="Off Duty"   :value="driverAvail?.off_duty  || 0" color="purple" />
        </div>
        <!-- Distribution bar -->
        <div v-if="(driverAvail?.available || 0) + (driverAvail?.on_trip || 0) + (driverAvail?.off_duty || 0) > 0" class="adash-distrib-wrap">
          <div class="adash-distrib-track">
            <div
              v-if="driverAvail?.available"
              class="adash-distrib-seg adash-distrib-seg--green"
              :style="{ flex: driverAvail.available }"
              :title="`Available: ${driverAvail.available}`"
            ></div>
            <div
              v-if="driverAvail?.on_trip"
              class="adash-distrib-seg adash-distrib-seg--blue"
              :style="{ flex: driverAvail.on_trip }"
              :title="`On Trip: ${driverAvail.on_trip}`"
            ></div>
            <div
              v-if="driverAvail?.off_duty"
              class="adash-distrib-seg adash-distrib-seg--purple"
              :style="{ flex: driverAvail.off_duty }"
              :title="`Off Duty: ${driverAvail.off_duty}`"
            ></div>
          </div>
          <div class="adash-distrib-legend">
            <span><span class="adash-distrib-dot" style="background:#16A34A"></span>Available {{ driverAvail?.available || 0 }}</span>
            <span><span class="adash-distrib-dot" style="background:#1D4ED8"></span>On Trip {{ driverAvail?.on_trip || 0 }}</span>
            <span><span class="adash-distrib-dot" style="background:#7C3AED"></span>Off Duty {{ driverAvail?.off_duty || 0 }}</span>
          </div>
        </div>
      </template>

      <!-- ── Fleet Headcount ──────────────────────────────── -->
      <p class="adash-section-lbl">
        Fleet Headcount
        <span v-if="dateFrom !== _todayISO || dateTo !== _todayISO" class="adash-section-hint">· live, as of today</span>
      </p>
      <div v-if="driverStatsError" class="adash-widget-err">
        Failed to load fleet headcount.
        <button class="adash-retry-btn" @click="loadDriverStats">Retry</button>
      </div>
      <div v-else class="adash-headcount">
        <div v-if="driverStatsLoading" class="adash-headcount-stats adash-skel-grid">
          <div v-for="i in 4" :key="i" class="adash-skel-card"></div>
        </div>
        <div v-else class="adash-headcount-stats">
          <StatCard title="Total Drivers"         :value="driverStats?.total_drivers || 0"         color="blue"   />
          <StatCard title="Active Drivers"        :value="driverStats?.active_drivers || 0"        color="green"  />
          <StatCard
            title="Blocked Drivers"
            :value="driverStats?.blocked_drivers || 0"
            color="red"
            :clickable="true"
            hint="tap to view list"
            @click="openBlockedModal"
          />
          <StatCard title="License Expiring Soon" :value="driverStats?.license_expiring_soon || 0" color="yellow" subtitle="within 3 months" />
        </div>
        <ChartCard title="Driver Status" subtitle="Active · Blocked · Inactive" :fill="true">
          <div v-if="driverStatsLoading" class="adash-skel-chart"></div>
          <apexchart
            v-else
            type="donut"
            :options="statusOptions"
            :series="statusSeries"
            height="100%"
            width="100%"
          />
        </ChartCard>
      </div>

      <!-- ── Monthly Trips Trend ────────────────────────────── -->
      <p class="adash-section-lbl">Monthly Trips Trend</p>
      <div v-if="monthlyTripsError" class="adash-widget-err">
        Failed to load monthly trips.
        <button class="adash-retry-btn" @click="loadMonthlyTrips">Retry</button>
      </div>
      <ChartCard
        v-else
        title="Monthly Trips"
        subtitle="Total trips recorded per month over the last 12 months"
        height="260px"
        class="adash-hero-card"
      >
        <template #actions>
          <div class="adash-legend">
            <span class="adash-legend-dot" style="background:#1D4ED8"></span>
            <span class="adash-legend-text">Trips</span>
          </div>
        </template>
        <div v-if="monthlyTripsLoading" class="adash-skel-chart adash-skel-chart--tall"></div>
        <apexchart
          v-else
          type="area"
          :options="heroOptions"
          :series="heroSeries"
          height="230"
          width="100%"
        />
      </ChartCard>

      <!-- ── Risk & Activity (actionable — elevated) ────────── -->
      <p class="adash-section-lbl">Attention Required</p>
      <div class="adash-intel-grid">
        <div v-if="riskError" class="adash-widget-err">
          Failed to load risk data.
          <button class="adash-retry-btn" @click="loadRiskDrivers">Retry</button>
        </div>
        <RiskDrivers v-else :drivers="riskDrivers" :loading="riskLoading" />
        <div v-if="activitiesError" class="adash-widget-err">
          Failed to load activity.
          <button class="adash-retry-btn" @click="loadActivities">Retry</button>
        </div>
        <ActivityFeed v-else :items="activities" :loading="activitiesLoading" />
      </div>

      <!-- ── Analytics (collapsed section) ──────────────────── -->
      <p class="adash-section-lbl">Analytics</p>
      <div class="adash-analytics-zone">
        <!-- Trip summary strip -->
        <div v-if="tripStatsError" class="adash-widget-err">
          Failed to load analytics.
          <button class="adash-retry-btn" @click="loadTripStats">Retry</button>
        </div>
        <div v-else-if="tripStatsLoading" class="adash-trip-strip adash-skel-grid">
          <div v-for="i in 3" :key="i" class="adash-skel-card adash-skel-card--slim"></div>
        </div>
        <div v-else class="adash-trip-strip">
          <div class="adash-trip-strip-item">
            <span class="adash-trip-strip-val tc-purple">{{ tripStats?.total_trips || 0 }}</span>
            <span class="adash-trip-strip-lbl">Total Trips</span>
          </div>
          <div class="adash-trip-strip-item">
            <span class="adash-trip-strip-val tc-accent">{{ (tripStats?.total_km_driven || 0).toLocaleString() }}</span>
            <span class="adash-trip-strip-lbl">KM Driven</span>
          </div>
          <div class="adash-trip-strip-item">
            <span class="adash-trip-strip-val tc-green">{{ Object.keys(tripStats?.by_driver || {}).length }}</span>
            <span class="adash-trip-strip-lbl">Active Drivers</span>
          </div>
        </div>
        <!-- Charts -->
        <div class="adash-charts-grid adash-charts-grid--2">
          <ChartCard title="Trips by Oil Company" subtitle="Distribution across clients" height="220px">
            <div v-if="tripStatsLoading" class="adash-skel-chart"></div>
            <apexchart
              v-else
              type="bar"
              :options="oilOptions"
              :series="oilSeries"
              height="200"
              width="100%"
            />
          </ChartCard>
          <ChartCard title="Drivers by Ranking" subtitle="A · B · C performance tiers" height="220px">
            <div v-if="driverStatsLoading" class="adash-skel-chart"></div>
            <apexchart
              v-else
              type="bar"
              :options="rankOptions"
              :series="rankSeries"
              height="200"
              width="100%"
            />
          </ChartCard>
        </div>
      </div>

      <!-- ── Upcoming Birthdays ────────────────────────────── -->
      <div v-if="birthdaysError" class="adash-widget-err">
        Failed to load birthdays.
        <button class="adash-retry-btn" @click="loadBirthdays">Retry</button>
      </div>
      <BirthdayCard v-else :birthdays="birthdays" :loading="birthdaysLoading" />

      <!-- ── License Alerts ─────────────────────────────────── -->
      <p class="adash-section-lbl">License Alerts</p>

      <div v-if="expiringListError" class="adash-widget-err">
        Failed to load license alerts.
        <button class="adash-retry-btn" @click="loadExpiringList">Retry</button>
      </div>
      <div v-else-if="expiringListLoading" class="adash-expiry-card">
        <div class="adash-skel-chart adash-skel-chart--tall"></div>
      </div>
      <div v-else-if="sortedExpiry.length" class="adash-expiry-card">
        <div class="adash-expiry-hd">
          <div class="adash-expiry-hd-left">
            <div class="adash-expiry-icon" aria-hidden="true">
              <AlertIcon :size="20" />
            </div>
            <div>
              <p class="adash-expiry-hd-title">Licenses Expiring Within 3 Months</p>
              <p class="adash-expiry-hd-sub">
                {{ sortedExpiry.length }} driver{{ sortedExpiry.length !== 1 ? 's' : '' }} require attention —
                click a name to view their profile
              </p>
            </div>
          </div>
          <span class="adash-expiry-pill">{{ sortedExpiry.length }}</span>
        </div>

        <!-- Desktop table -->
        <div class="adash-expiry-tbl-wrap">
          <table class="adash-expiry-tbl">
            <thead>
              <tr>
                <th>Driver</th>
                <th>License Type</th>
                <th>License Expiry</th>
                <th>GDL Expiry</th>
                <th>Rank</th>
                <th>Urgency</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="d in sortedExpiry"
                :key="d.driver_id"
                :class="['adash-expiry-row', `adash-urgency-row-${urgencyKey(daysUntil(d.license_expiry))}`]"
              >
                <td class="adash-expiry-td">
                  <button class="adash-driver-link" @click="router.push({ name: 'driver-detail', params: { id: d.driver_id } })">
                    <span class="adash-driver-link-name">{{ d.name }}</span>
                    <span class="adash-driver-link-id">{{ d.driver_id }}</span>
                  </button>
                </td>
                <td class="adash-expiry-td">{{ d.license_type }}</td>
                <td class="adash-expiry-td mono">{{ formatDate(d.license_expiry) }}</td>
                <td class="adash-expiry-td mono">{{ formatDate(d.gdl_expiry) }}</td>
                <td class="adash-expiry-td">
                  <span
                    :class="['adash-rank-badge', `adash-rank-${(d.ranking||'').toLowerCase()}`]"
                    :title="d.ranking === 'A' ? 'Rank A — Top performer' : d.ranking === 'B' ? 'Rank B — Good standing' : d.ranking === 'C' ? 'Rank C — Needs attention' : ''"
                  >{{ d.ranking || '—' }}</span>
                </td>
                <td class="adash-expiry-td">
                  <span :class="['adash-urgency-badge', `adash-urgency-${urgencyKey(daysUntil(d.license_expiry))}`]">
                    {{ urgencyLabel(daysUntil(d.license_expiry)) }} · {{ daysUntil(d.license_expiry) }}d
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="adash-expiry-cards">
          <div
            v-for="d in sortedExpiry"
            :key="d.driver_id"
            :class="['adash-expiry-m-card', `adash-urgency-row-${urgencyKey(daysUntil(d.license_expiry))}`]"
          >
            <div class="adash-expiry-m-top">
              <button class="adash-driver-link" @click="router.push({ name: 'driver-detail', params: { id: d.driver_id } })">
                <span class="adash-driver-link-name">{{ d.name }}</span>
                <span class="adash-driver-link-id">{{ d.driver_id }}</span>
              </button>
              <span :class="['adash-urgency-badge', `adash-urgency-${urgencyKey(daysUntil(d.license_expiry))}`]">
                {{ urgencyLabel(daysUntil(d.license_expiry)) }} · {{ daysUntil(d.license_expiry) }}d
              </span>
            </div>
            <div class="adash-expiry-m-meta">
              <span><span class="adash-m-key">Type</span>{{ d.license_type }}</span>
              <span><span class="adash-m-key">Expiry</span><span class="mono">{{ formatDate(d.license_expiry) }}</span></span>
              <span><span class="adash-m-key">GDL</span><span class="mono">{{ formatDate(d.gdl_expiry) }}</span></span>
              <span>
                <span class="adash-m-key">Rank</span>
                <span
                  :class="['adash-rank-badge', `adash-rank-${(d.ranking||'').toLowerCase()}`]"
                  :title="d.ranking === 'A' ? 'Rank A — Top performer' : d.ranking === 'B' ? 'Rank B — Good standing' : d.ranking === 'C' ? 'Rank C — Needs attention' : ''"
                >{{ d.ranking || '—' }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!expiringListLoading && !expiringListError" class="adash-expiry-empty">
        <CheckCircleIcon :size="22" />
        <p>All licenses are valid for more than 3 months</p>
      </div>

    <!-- ── Blocked Drivers Modal ──────────────────────────── -->
    <ModalSheet v-model="showBlockedModal" title="Blocked Drivers">
        <div v-if="loadingBlocked" class="adash-modal-loading">Loading…</div>
        <div v-else-if="!blockedDrivers.length" class="adash-modal-empty">No blocked drivers found.</div>
        <ul v-else class="adash-blocked-list">
          <li
            v-for="d in blockedDrivers"
            :key="d.driver_id"
            class="adash-blocked-item"
            @click="goToDriver(d.driver_id)"
          >
            <div class="adash-blocked-name">{{ d.name }}</div>
            <div class="adash-blocked-meta">{{ d.driver_id }} · {{ d.license_type }}</div>
          </li>
        </ul>
      </ModalSheet>

  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────────── */
.adash { display: flex; flex-direction: column; gap: 0.75rem; }

/* ── Banner ─────────────────────────────────────────────────────────────────── */
.adash-banner {
  display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
  padding: 0.25rem 0 1.25rem;
  margin-bottom: 0.5rem;
}
.adash-banner-title {
  font-size: 1.875rem; font-weight: 800; margin: 0 0 0.5rem;
  letter-spacing: -0.04em; color: var(--c-text-1); line-height: 1.05;
}
.adash-banner-right {
  display: flex; align-items: center; gap: 0.625rem;
}

/* "Today is" pill — pops out the current date next to the date-range picker */
.adash-today-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px;
  background: linear-gradient(135deg, rgba(29,78,216,0.08), rgba(124,58,237,0.08));
  border: 1px solid color-mix(in srgb, var(--c-accent) 22%, transparent);
  border-radius: var(--r-full);
  color: var(--c-accent);
  font-size: 0.8125rem; font-weight: 600;
  line-height: 1; white-space: nowrap;
  box-shadow: var(--sh-xs);
}
.adash-today-pill svg { flex-shrink: 0; }
.adash-today-pill-text { letter-spacing: -0.01em; }

/* Force the date-range chip to use the white surface (instead of the page bg
   color which blends into the dashboard background). */
.adash-banner-right :deep(.drp-chip) {
  background: var(--c-surface);
}

/* Section label hint (e.g. "live · as of today") */
.adash-section-hint {
  margin-left: 0.4rem;
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: normal;
  color: var(--c-text-3);
  opacity: 0.85;
}

/* Live status chips in banner */
.adash-banner-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.adash-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
}
.adash-chip-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
  animation: chip-pulse 2s ease-in-out infinite;
}
@keyframes chip-pulse { 0%,100% { opacity:1; } 50% { opacity: 0.45; } }
.adash-chip--blue   { background: rgba(29,78,216,0.09);  color: #1D4ED8; }
.adash-chip--blue   .adash-chip-dot { background: #1D4ED8; }
.adash-chip--green  { background: rgba(22,163,74,0.09);  color: #16A34A; }
.adash-chip--green  .adash-chip-dot { background: #16A34A; }
.adash-chip--red    { background: rgba(239,68,68,0.09);  color: #EF4444; }
.adash-chip--red    .adash-chip-dot { background: #EF4444; }

/* Completion rate bar */
.adash-completion-wrap { margin-top: 1rem; padding-top: 0.875rem; border-top: 1px solid var(--c-border); }
.adash-completion-meta { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.adash-completion-lbl  { font-size: 0.75rem; font-weight: 600; color: var(--c-text-2); }
.adash-completion-pct  { font-size: 0.875rem; font-weight: 800; color: #16A34A; letter-spacing: -0.02em; }
.adash-completion-track {
  height: 6px; background: var(--c-border); border-radius: 3px; overflow: hidden;
}
.adash-completion-fill {
  height: 100%; width: 100%; background: #16A34A; border-radius: 3px;
  transform-origin: left; transform: scaleX(0);
  transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ── Analytics zone ────────────────────────────────────────────────────────── */
.adash-analytics-zone {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;
}
.adash-trip-strip {
  display: flex; gap: 2rem; padding: 0.75rem 0; border-bottom: 1px solid var(--c-border);
}
.adash-trip-strip-item { display: flex; flex-direction: column; gap: 2px; }
.adash-trip-strip-val  { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.adash-trip-strip-lbl  { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--c-text-3); }

/* Driver availability distribution bar */
.adash-distrib-wrap { margin-top: 0.625rem; }
.adash-distrib-track {
  display: flex; height: 8px; border-radius: 4px; overflow: hidden; gap: 2px;
}
.adash-distrib-seg { min-width: 4px; border-radius: 2px; transition: flex 0.6s ease; cursor: default; }
.adash-distrib-seg--green  { background: #16A34A; }
.adash-distrib-seg--blue   { background: #1D4ED8; }
.adash-distrib-seg--purple { background: #7C3AED; }
.adash-distrib-legend {
  display: flex; gap: 1.25rem; margin-top: 0.5rem; flex-wrap: wrap;
  font-size: 0.75rem; color: var(--c-text-2); font-weight: 500;
}
.adash-distrib-legend span { display: inline-flex; align-items: center; gap: 5px; }
.adash-distrib-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

/* ── Command Center zone ─────────────────────────────────────────────────────── */
.adash-ops-zone {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 14px;
  padding: 1rem 1rem 1.25rem;
  box-shadow: var(--sh-sm);
}
.adash-ops-zone .adash-section-lbl { margin-top: 0; }
.adash-section-lbl--ops {
  color: var(--c-accent);
  letter-spacing: .06em;
}

/* ── Loading ─────────────────────────────────────────────────────────────────── */
.adash-loading {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 3rem; color: var(--c-text-2);
}
.adash-spinner {
  width: 20px; height: 20px; border: 2px solid var(--c-border);
  border-top-color: #1D4ED8; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Section label ───────────────────────────────────────────────────────────── */
.adash-section-lbl {
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .1em; color: var(--c-text-3); margin: 2rem 0 0.75rem;
}

/* ── Grids ───────────────────────────────────────────────────────────────────── */
.adash-stats-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 0.25rem;
}
.adash-avail-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 0.25rem;
}
.adash-trip-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 0.25rem;
}
.adash-headcount {
  display: grid; grid-template-columns: 1fr 260px; gap: 1rem; align-items: stretch; margin-bottom: 0.25rem;
}
.adash-headcount-stats {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
}
.adash-charts-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 0.25rem;
}
.adash-charts-grid--2 {
  grid-template-columns: repeat(2, 1fr);
}
.adash-intel-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 0.25rem;
}
.adash-charts-grid > *,
.adash-stats-grid > *,
.adash-avail-grid > *,
.adash-trip-grid > *,
.adash-intel-grid > * { min-width: 0; }
.adash-hero-card { margin-bottom: 0.25rem; }

/* ── Skeleton stat cards & chart placeholders ────────────────────────────────── */
.adash-skel-grid { pointer-events: none; }
.adash-skel-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; height: 90px;
  animation: adash-pulse 1.4s ease-in-out infinite;
}
.adash-skel-card--slim { height: 56px; }
.adash-skel-chart {
  width: 100%; height: 200px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px;
  animation: adash-pulse 1.4s ease-in-out infinite;
}
.adash-skel-chart--tall { height: 230px; }
@keyframes adash-pulse { 0%,100% { opacity:1; } 50% { opacity:.45; } }

/* ── Legend ──────────────────────────────────────────────────────────────────── */
.adash-legend      { display: flex; align-items: center; gap: 6px; }
.adash-legend-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.adash-legend-text { font-size: 0.8rem; color: var(--c-text-2); }

/* ── Expiry card ─────────────────────────────────────────────────────────────── */
.adash-expiry-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; overflow: hidden;
}
.adash-expiry-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--c-border); gap: 1rem; flex-wrap: wrap;
}
.adash-expiry-hd-left { display: flex; align-items: center; gap: 0.875rem; }
.adash-expiry-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(245,158,11,0.12); display: grid; place-items: center; color: #D97706; flex-shrink: 0;
}
.adash-expiry-icon svg { width: 20px; height: 20px; }
.adash-expiry-hd-title { font-size: 0.9rem; font-weight: 600; color: var(--c-text); margin: 0 0 2px; }
.adash-expiry-hd-sub   { font-size: 0.8rem; color: var(--c-text-2); margin: 0; }
.adash-expiry-pill {
  background: #D97706; color: #fff; font-size: 0.75rem; font-weight: 700;
  padding: 0.2rem 0.6rem; border-radius: 999px; flex-shrink: 0;
}

/* Desktop table */
.adash-expiry-tbl-wrap { overflow-x: auto; }
.adash-expiry-tbl { width: 100%; border-collapse: collapse; }
.adash-expiry-tbl thead th {
  padding: 0.7rem 1.25rem; text-align: left; font-size: 0.72rem;
  font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--c-text-2); border-bottom: 1px solid var(--c-border);
  background: var(--c-bg); white-space: nowrap;
}
.adash-expiry-td { padding: 0.875rem 1.25rem; font-size: 0.85rem; color: var(--c-text); border-bottom: 1px solid var(--c-border); white-space: nowrap; }
.adash-expiry-row:last-child .adash-expiry-td { border-bottom: none; }
.adash-urgency-row-critical { background: rgba(239,68,68,0.04); }
.adash-urgency-row-warning  { background: rgba(245,158,11,0.04); }
.adash-urgency-row-notice   { background: transparent; }
.adash-expiry-tbl tbody tr:hover { background: var(--c-hover); }

/* Driver link button */
.adash-driver-link {
  background: none; border: none; cursor: pointer; padding: 0;
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;
}
.adash-driver-link-name { font-size: 0.875rem; font-weight: 600; color: #1D4ED8; }
.adash-driver-link-id   { font-size: 0.75rem; color: var(--c-text-2); font-family: monospace; }
.adash-driver-link:hover .adash-driver-link-name { text-decoration: underline; }

/* Rank badge */
.adash-rank-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  border-radius: var(--r-sm); font-size: 0.8125rem; font-weight: 700;
}
.adash-rank-a { background: #16A34A; color: #fff; }
.adash-rank-b { background: #1D4ED8; color: #fff; }
.adash-rank-c { background: #D97706; color: #fff; }

/* Urgency badge */
.adash-urgency-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 0.2rem 0.6rem; border-radius: 999px;
  font-size: 0.75rem; font-weight: 600; white-space: nowrap;
}
.adash-urgency-critical { background: rgba(239,68,68,0.12);  color: #EF4444; }
.adash-urgency-warning  { background: rgba(245,158,11,0.12); color: #D97706; }
.adash-urgency-notice   { background: rgba(59,130,246,0.12); color: #3B82F6; }

/* Mobile expiry cards */
.adash-expiry-cards { display: none; }
.adash-expiry-m-card {
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--c-border);
}
.adash-expiry-m-card:last-child { border-bottom: none; }
.adash-expiry-m-top  { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
.adash-expiry-m-meta { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; font-size: 0.8rem; color: var(--c-text); }
.adash-m-key { font-size: 0.75rem; font-weight: 600; text-transform: none; color: var(--c-text-3); margin-right: 4px; }

/* Empty expiry */
.adash-expiry-empty {
  display: flex; align-items: center; gap: 0.75rem; padding: 1.5rem;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
  color: #16A34A; font-size: 0.875rem; font-weight: 500;
}
.adash-expiry-empty svg { width: 22px; height: 22px; flex-shrink: 0; }

/* ── Modal ───────────────────────────────────────────────────────────────────── */
.adash-modal-loading,
.adash-modal-empty { padding: 2rem; text-align: center; color: var(--c-text-2); font-size: 0.9rem; }
.adash-blocked-list { list-style: none; margin: 0; padding: 0; }
.adash-blocked-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--c-border);
  cursor: pointer; transition: background 0.15s;
}
.adash-blocked-item:last-child { border-bottom: none; }
.adash-blocked-item:hover { background: var(--c-hover); }
.adash-blocked-name { font-size: 0.9rem; font-weight: 600; color: var(--c-text); }
.adash-blocked-meta { font-size: 0.8rem; color: var(--c-text-2); }

/* ── Responsive ──────────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .adash-charts-grid     { grid-template-columns: 1fr 1fr; }
  .adash-headcount       { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .adash-banner          { flex-direction: column; align-items: stretch; padding: 0 0 1rem; }
  .adash-banner-title    { font-size: 1.5rem; }
  .adash-banner-right    { flex-direction: row; align-items: center; justify-content: space-between; }
  .adash-stats-grid      { grid-template-columns: 1fr 1fr; }
  .adash-headcount-stats { grid-template-columns: 1fr 1fr; }
  .adash-avail-grid      { grid-template-columns: 1fr 1fr 1fr; }
  .adash-trip-strip      { gap: 1.25rem; }
  .adash-trip-strip-val  { font-size: 1.25rem; }
  .adash-charts-grid     { grid-template-columns: 1fr; }
  .adash-charts-grid--2  { grid-template-columns: 1fr; }
  .adash-intel-grid      { grid-template-columns: 1fr; }
  .adash-analytics-zone  { padding: 1rem; }
}
@media (max-width: 640px) {
  .adash-expiry-tbl-wrap { display: none; }
  .adash-expiry-cards    { display: block; }
  .adash-stats-grid      { grid-template-columns: 1fr 1fr; }
  .adash-headcount-stats { grid-template-columns: 1fr 1fr; }
  .adash-avail-grid      { grid-template-columns: 1fr 1fr 1fr; }
  .adash-banner-date     { display: none; }
  .adash-trip-strip      { flex-wrap: wrap; gap: 0.75rem 1.5rem; }
  .adash-section-lbl     { margin: 1.5rem 0 0.6rem; }
}
@media (max-width: 360px) {
  .adash-headcount-stats,
  .adash-avail-grid {
    grid-template-columns: 1fr 1fr;
  }
  .adash-trip-strip-val  { font-size: 1.1rem; }
  .adash-banner-chips    { gap: 0.35rem; }
  .adash-chip            { padding: 4px 8px; font-size: 0.72rem; }
}

/* ── Widget error states ──────────────────────────────────────────────────── */
.adash-widget-err {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 12px 16px;
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-lg); font-size: 0.8125rem; color: var(--c-text-3);
}
.adash-retry-btn {
  font-size: 0.75rem; font-weight: 600; color: var(--c-accent);
  background: none; border: 1px solid var(--c-accent);
  border-radius: 6px; padding: 4px 10px; cursor: pointer;
  transition: background var(--dur), color var(--dur);
  white-space: nowrap; flex-shrink: 0;
}
.adash-retry-btn:hover { background: var(--c-accent); color: #fff; }
</style>
