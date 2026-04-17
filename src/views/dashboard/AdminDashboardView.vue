<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import reportsApi   from '../../api/reports'
import dashboardApi  from '../../api/dashboard'
import { useThemeStore } from '../../stores/theme'
import StatCard        from '../../components/common/StatCard.vue'
import ChartCard       from '../../components/common/ChartCard.vue'
import ModalSheet      from '../../components/common/ModalSheet.vue'
import AlertsWidget    from '../../components/dashboard/AlertsWidget.vue'
import ActivityFeed    from '../../components/dashboard/ActivityFeed.vue'
import RiskDrivers     from '../../components/dashboard/RiskDrivers.vue'
import BirthdayCard    from '../../components/dashboard/BirthdayCard.vue'
import { DashboardIcon, AlertIcon, CheckCircleIcon } from '../../components/icons/index.js'

const router = useRouter()
const theme  = useThemeStore()

// ── State ─────────────────────────────────────────────────────────────────────
const driverStats  = ref(null)
const tripStats    = ref(null)
const monthlyTrips = ref([])
const expiringList = ref([])
const loading      = ref(true)

const showBlockedModal = ref(false)
const blockedDrivers   = ref([])
const loadingBlocked   = ref(false)

// ── New dashboard widget state ─────────────────────────────────────────────
const alertsData         = ref(null)
const alertsLoading      = ref(true)
const tripsToday         = ref(null)
const tripsTodayLoading  = ref(true)
const driverAvail        = ref(null)
const driverAvailLoading = ref(true)
const activities         = ref([])
const activitiesLoading  = ref(true)
const riskDrivers        = ref([])
const riskLoading        = ref(true)
const birthdays          = ref([])
const birthdaysLoading   = ref(true)

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
const bgColor = computed(() => isDark.value ? '#1A1D27' : '#FFFFFF')

// ── Monthly Trips bar chart ───────────────────────────────────────────────────
const heroSeries = computed(() => [{
  name: 'Trips',
  data: monthlyTrips.value.map(m => m.trips),
}])

const heroOptions = computed(() => ({
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
    bar: { borderRadius: 5, columnWidth: '55%', borderRadiusApplication: 'end' },
  },
  dataLabels: { enabled: false },
  colors: ['#1D4ED8'],
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
  states: {
    hover: { filter: { type: 'lighten', value: 0.05 } },
  },
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
  colors: ['#16A34A', '#EF4444', '#94A3B8'],
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
const palette = ['#1D4ED8','#7C3AED','#16A34A','#D97706','#EF4444','#0891B2','#BE185D','#65A30D']

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
  colors: oilEntries.value.map((_, i) => palette[i % palette.length]),
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
const rankMap = { A: '#16A34A', B: '#1D4ED8', C: '#D97706' }

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
    bar: { borderRadius: 4, columnWidth: '50%', borderRadiusApplication: 'end' },
  },
  dataLabels: { enabled: false },
  colors: rankEntries.value.map(([r]) => rankMap[r] || '#94A3B8'),
  xaxis: {
    categories: rankEntries.value.map(([r]) => `Rank ${r}`),
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
    y: { formatter: v => `${v} drivers` },
  },
}))

// ── Fetch ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  // ── Primary data (controls main loading state) ─────────────────────────
  try {
    const [dRes, tRes, mRes, lRes] = await Promise.all([
      reportsApi.driverSummary(),
      reportsApi.tripSummary(),
      reportsApi.monthlyTrips(),
      reportsApi.licenseExpiry(),
    ])
    driverStats.value  = dRes.data.data
    tripStats.value    = tRes.data.data
    monthlyTrips.value = mRes.data.data
    expiringList.value = lRes.data.data
  } finally {
    loading.value = false
  }

  // ── New widget data (each loads independently, non-blocking) ───────────
  dashboardApi.getAlerts()
    .then(r  => { alertsData.value       = r.data.data })
    .catch(() => { alertsData.value       = { license_expiring: 0, blocked_assigned: 0, incomplete_trips: 0 } })
    .finally(() => { alertsLoading.value  = false })

  dashboardApi.getTripsToday()
    .then(r  => { tripsToday.value        = r.data.data })
    .catch(() => { tripsToday.value        = null })
    .finally(() => { tripsTodayLoading.value = false })

  dashboardApi.getDriverAvailability()
    .then(r  => { driverAvail.value       = r.data.data })
    .catch(() => { driverAvail.value       = null })
    .finally(() => { driverAvailLoading.value = false })

  dashboardApi.getRecentActivity()
    .then(r  => { activities.value        = r.data.data })
    .catch(() => { activities.value        = [] })
    .finally(() => { activitiesLoading.value = false })

  dashboardApi.getRiskDrivers()
    .then(r  => { riskDrivers.value       = r.data.data })
    .catch(() => { riskDrivers.value       = [] })
    .finally(() => { riskLoading.value     = false })

  dashboardApi.getBirthdays()
    .then(r  => { birthdays.value         = r.data.data })
    .catch(() => { birthdays.value         = [] })
    .finally(() => { birthdaysLoading.value = false })
})
</script>

<template>
  <div class="adash">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="adash-banner">
      <div>
        <h1 class="adash-banner-title">Fleet Dashboard</h1>
        <p class="adash-banner-sub">Fleet Management Overview</p>
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
      <div class="adash-banner-date">
        <span class="adash-date-label">Today</span>
        <span class="adash-date-value">{{ todayFormatted }}</span>
      </div>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="loading" class="adash-loading">
      <div class="adash-spinner"></div>
      <span>Loading dashboard…</span>
    </div>

    <template v-else>

      <!-- ── Alerts ────────────────────────────────────────── -->
      <AlertsWidget :data="alertsData" :loading="alertsLoading" />

      <!-- ── Command Center: Today's Operations ────────────── -->
      <div class="adash-ops-zone">
        <p class="adash-section-lbl adash-section-lbl--ops">Today's Operations</p>
        <div v-if="tripsTodayLoading" class="adash-stats-grid adash-skel-grid">
          <div v-for="i in 4" :key="i" class="adash-skel-card"></div>
        </div>
        <div v-else class="adash-stats-grid">
          <StatCard title="Total Trips Today" :value="tripsToday?.total     || 0" color="blue"   />
          <StatCard title="Completed"         :value="tripsToday?.completed || 0" color="green"  />
          <StatCard title="Ongoing"           :value="tripsToday?.ongoing   || 0" color="yellow" />
          <StatCard title="Cancelled"         :value="tripsToday?.cancelled || 0" color="red"    />
        </div>
        <!-- Completion rate bar -->
        <div v-if="!tripsTodayLoading && tripsToday?.total > 0" class="adash-completion-wrap">
          <div class="adash-completion-meta">
            <span class="adash-completion-lbl">Trip completion rate</span>
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

      <!-- ── Driver Availability ───────────────────────────── -->
      <p class="adash-section-lbl">Driver Availability</p>
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
      <p class="adash-section-lbl">Fleet Headcount</p>
      <div class="adash-headcount">
        <div class="adash-headcount-stats">
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
          <apexchart
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
      <ChartCard
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
        <apexchart
          type="bar"
          :options="heroOptions"
          :series="heroSeries"
          height="230"
          width="100%"
        />
      </ChartCard>

      <!-- ── Analytics row ──────────────────────────────────── -->
      <p class="adash-section-lbl">Analytics</p>
      <div class="adash-charts-grid adash-charts-grid--2">
        <ChartCard title="Trips by Oil Company" subtitle="Distribution across clients" height="220px">
          <apexchart
            type="bar"
            :options="oilOptions"
            :series="oilSeries"
            height="200"
            width="100%"
          />
        </ChartCard>
        <ChartCard title="Drivers by Ranking" subtitle="A · B · C performance tiers" height="220px">
          <apexchart
            type="bar"
            :options="rankOptions"
            :series="rankSeries"
            height="200"
            width="100%"
          />
        </ChartCard>
      </div>

      <!-- ── Trip stat cards ────────────────────────────────── -->
      <p class="adash-section-lbl">Trip Overview</p>
      <div class="adash-trip-grid">
        <StatCard title="Total Trips"        :value="tripStats?.total_trips || 0"                         color="purple" />
        <StatCard title="Total KM Driven"    :value="(tripStats?.total_km_driven || 0).toLocaleString()" color="blue"   subtitle="km" />
        <StatCard title="Drivers with Trips" :value="Object.keys(tripStats?.by_driver || {}).length"      color="green"  subtitle="unique drivers" />
      </div>

      <!-- ── Risk & Activity ───────────────────────────────── -->
      <p class="adash-section-lbl">Risk &amp; Activity</p>
      <div class="adash-intel-grid">
        <RiskDrivers :drivers="riskDrivers" :loading="riskLoading" />
        <ActivityFeed :items="activities"   :loading="activitiesLoading" />
      </div>

      <!-- ── Upcoming Birthdays ────────────────────────────── -->
      <BirthdayCard :birthdays="birthdays" :loading="birthdaysLoading" />

      <!-- ── License Alerts ─────────────────────────────────── -->
      <p class="adash-section-lbl">License Alerts</p>

      <div v-if="sortedExpiry.length" class="adash-expiry-card">
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

      <div v-else class="adash-expiry-empty">
        <CheckCircleIcon :size="22" />
        <p>All licenses are valid for more than 3 months</p>
      </div>

    </template>

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
  font-size: 1.875rem; font-weight: 800; margin: 0 0 0.15rem;
  letter-spacing: -0.04em; color: var(--c-text-1); line-height: 1.05;
}
.adash-banner-sub   { font-size: 0.8125rem; color: var(--c-text-3); margin: 0 0 0.75rem; font-weight: 500; }
.adash-banner-date  { display: flex; flex-direction: column; align-items: flex-end; }
.adash-date-label { font-size: 0.6875rem; text-transform: uppercase; letter-spacing: .08em; color: var(--c-text-3); }
.adash-date-value { font-size: 0.875rem; font-weight: 600; margin-top: 2px; color: var(--c-text-2); }

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

/* ── Skeleton stat cards ──────────────────────────────────────────────────────── */
.adash-skel-grid { pointer-events: none; }
.adash-skel-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; height: 90px;
  animation: adash-pulse 1.4s ease-in-out infinite;
}
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
  .adash-banner          { padding: 0 0 1rem; }
  .adash-banner-title    { font-size: 1.5rem; }
  .adash-stats-grid      { grid-template-columns: 1fr 1fr; }
  .adash-headcount-stats { grid-template-columns: 1fr 1fr; }
  .adash-avail-grid      { grid-template-columns: 1fr 1fr 1fr; }
  .adash-trip-grid       { grid-template-columns: 1fr 1fr; }
  .adash-charts-grid     { grid-template-columns: 1fr; }
  .adash-charts-grid--2  { grid-template-columns: 1fr; }
  .adash-intel-grid      { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .adash-expiry-tbl-wrap { display: none; }
  .adash-expiry-cards    { display: block; }
  .adash-stats-grid      { grid-template-columns: 1fr 1fr; }
  .adash-headcount-stats { grid-template-columns: 1fr 1fr; }
  .adash-avail-grid      { grid-template-columns: 1fr 1fr 1fr; }
  .adash-trip-grid       { grid-template-columns: 1fr; }
  .adash-banner-date     { display: none; }
}
@media (max-width: 360px) {
  .adash-headcount-stats,
  .adash-avail-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
