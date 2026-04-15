<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  DriverIcon, TruckIcon, RouteIcon, ReportsIcon, IdCardIcon, CloseIcon,
} from '../../components/icons/index.js'
import driverMeApi from '../../api/driverMe'
import { useThemeStore } from '../../stores/theme'
import { useAuthStore } from '../../stores/auth'

const theme = useThemeStore()
const auth  = useAuthStore()

// ── State ─────────────────────────────────────────────────────────────────────
const profile   = ref(null)
const kmSummary = ref(null)
const recentTrips = ref([])
const loading   = ref(true)
const error     = ref('')

// ── Date helpers ──────────────────────────────────────────────────────────────
const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const _now   = new Date()
const todayFormatted = `${DAYS[_now.getDay()]}, ${_now.getDate()} ${MONTHS[_now.getMonth()]} ${_now.getFullYear()}`

function formatDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

function daysUntil(s) {
  if (!s) return 9999
  const now = new Date(); now.setHours(0,0,0,0)
  return Math.ceil((new Date(s) - now) / 86400000)
}

// ── Computed ──────────────────────────────────────────────────────────────────
const totalTrips = computed(() => kmSummary.value?.total_trips     || 0)
const totalKm    = computed(() => kmSummary.value?.total_km_driven || 0)
const avgKm      = computed(() => kmSummary.value?.avg_km_per_trip || 0)
const monthly    = computed(() => kmSummary.value?.monthly         || [])

const licenseExpiry  = computed(() => profile.value?.license_expiry || null)
const licenseCountdown = computed(() => daysUntil(licenseExpiry.value))

const licenseStatus = computed(() => {
  const d = licenseCountdown.value
  if (d <= 30)  return { label: 'Critical',  key: 'critical', color: '#EF4444' }
  if (d <= 60)  return { label: 'Expiring',  key: 'warning',  color: '#F59E0B' }
  if (d <= 90)  return { label: 'Notice',    key: 'notice',   color: '#3B82F6' }
  return { label: 'Valid', key: 'valid', color: '#16A34A' }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

// ── ApexCharts config ─────────────────────────────────────────────────────────
const isDark     = computed(() => theme.isDark)
const gridColor  = computed(() => isDark.value ? '#2A2D3A' : '#F1F5F9')
const labelColor = computed(() => isDark.value ? '#94A3B8' : '#475569')
const apexTheme  = computed(() => isDark.value ? 'dark' : 'light')

const areaSeries = computed(() => [
  { name: 'Trips',  data: monthly.value.map(m => m.trips) },
  { name: 'KM ÷ 10', data: monthly.value.map(m => Math.round(m.km / 10)) },
])

const areaOptions = computed(() => ({
  chart: {
    type: 'area',
    toolbar: { show: false },
    background: 'transparent',
    fontFamily: 'Inter, system-ui, sans-serif',
    animations: { enabled: true, easing: 'easeinout', speed: 600 },
  },
  theme: { mode: apexTheme.value },
  stroke: { curve: 'smooth', width: 2 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.35,
      opacityTo: 0.02,
      stops: [0, 100],
    },
  },
  colors: ['#16A34A', '#1D4ED8'],
  xaxis: {
    categories: monthly.value.map(m => m.label),
    labels: { style: { colors: labelColor.value, fontSize: '11px' }, rotate: -30 },
    axisBorder: { show: false },
    axisTicks:  { show: false },
  },
  yaxis: {
    labels: { style: { colors: labelColor.value, fontSize: '11px' } },
  },
  grid: { borderColor: gridColor.value, strokeDashArray: 3 },
  dataLabels: { enabled: false },
  legend: {
    position: 'top',
    horizontalAlign: 'right',
    fontSize: '12px',
    labels: { colors: labelColor.value },
  },
  tooltip: {
    theme: apexTheme.value,
    shared: true,
    y: [
      { formatter: v => `${v} trips` },
      { formatter: v => `${v * 10} km (approx)` },
    ],
  },
}))

// ── Fetch ─────────────────────────────────────────────────────────────────────
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
</script>

<template>
  <div class="ddash">

    <!-- ── Banner ────────────────────────────────────────────── -->
    <div class="ddash-banner">
      <div class="ddash-banner-left">
        <div class="ddash-banner-avatar" aria-hidden="true">
          <DriverIcon :size="26" />
        </div>
        <div class="ddash-banner-text">
          <p class="ddash-greeting">{{ greeting }},</p>
          <h1 class="ddash-banner-title">{{ auth.userName }}</h1>
          <p class="ddash-banner-sub">Dashboard</p>
        </div>
      </div>
      <div class="ddash-banner-date">
        <span class="ddash-date-label">Today</span>
        <span class="ddash-date-value">{{ todayFormatted }}</span>
      </div>
    </div>

    <!-- ── Error ─────────────────────────────────────────────── -->
    <div v-if="error" class="ddash-error">
      <CloseIcon :size="18" />
      {{ error }}
    </div>

    <!-- ── Loading ───────────────────────────────────────────── -->
    <div v-else-if="loading" class="ddash-loading">
      <div class="ddash-spinner"></div>
      <span>Loading your dashboard…</span>
    </div>

    <template v-else>

      <!-- ── Stat cards ──────────────────────────────────────── -->
      <p class="ddash-section-lbl">My Performance</p>
      <div class="ddash-stats-grid">

        <!-- Total Trips -->
        <div class="ddash-stat-card ddash-stat--green">
          <div class="ddash-stat-icon">
            <TruckIcon :size="22" />
          </div>
          <div class="ddash-stat-body">
            <div class="ddash-stat-value">{{ totalTrips.toLocaleString() }}</div>
            <div class="ddash-stat-label">Total Trips</div>
          </div>
        </div>

        <!-- Total KM -->
        <div class="ddash-stat-card ddash-stat--blue">
          <div class="ddash-stat-icon">
            <RouteIcon :size="22" />
          </div>
          <div class="ddash-stat-body">
            <div class="ddash-stat-value">{{ totalKm.toLocaleString() }}</div>
            <div class="ddash-stat-label">Total KM Driven</div>
          </div>
        </div>

        <!-- Avg KM/trip -->
        <div class="ddash-stat-card ddash-stat--purple">
          <div class="ddash-stat-icon">
            <ReportsIcon :size="22" />
          </div>
          <div class="ddash-stat-body">
            <div class="ddash-stat-value">{{ avgKm }}</div>
            <div class="ddash-stat-label">Avg KM / Trip</div>
          </div>
        </div>

        <!-- License status -->
        <div class="ddash-stat-card ddash-license-card" :data-status="licenseStatus.key">
          <div class="ddash-stat-icon">
            <IdCardIcon :size="22" />
          </div>
          <div class="ddash-stat-body">
            <div class="ddash-stat-value" :style="{ color: licenseStatus.color }">
              {{ licenseCountdown > 9000 ? '—' : licenseCountdown + 'd' }}
            </div>
            <div class="ddash-stat-label">
              License · <span :style="{ color: licenseStatus.color }">{{ licenseStatus.label }}</span>
            </div>
            <div class="ddash-license-date">{{ formatDate(licenseExpiry) }}</div>
          </div>
        </div>

      </div>

      <!-- ── Profile details row ─────────────────────────────── -->
      <div v-if="profile" class="ddash-profile-row">
        <div class="ddash-profile-card">
          <div class="ddash-profile-hd">
            <DriverIcon :size="18" />
            <span>My Profile</span>
          </div>
          <div class="ddash-profile-grid">
            <div class="ddash-pi">
              <span class="ddash-pi-key">Driver ID</span>
              <span class="ddash-pi-val mono">{{ profile.driver_id || '—' }}</span>
            </div>
            <div class="ddash-pi">
              <span class="ddash-pi-key">License Type</span>
              <span class="ddash-pi-val">{{ profile.license_type || '—' }}</span>
            </div>
            <div class="ddash-pi">
              <span class="ddash-pi-key">GDL Expiry</span>
              <span class="ddash-pi-val mono">{{ formatDate(profile.gdl_expiry) }}</span>
            </div>
            <div class="ddash-pi">
              <span class="ddash-pi-key">Status</span>
              <span class="ddash-pi-val">
                <span :class="['ddash-status', profile.status === 'active' ? 'ddash-status--active' : 'ddash-status--blocked']">
                  {{ profile.status || '—' }}
                </span>
              </span>
            </div>
            <div class="ddash-pi">
              <span class="ddash-pi-key">Ranking</span>
              <span class="ddash-pi-val">
                <span v-if="profile.ranking" :class="['ddash-rank', `ddash-rank-${(profile.ranking||'').toLowerCase()}`]">
                  {{ profile.ranking }}
                </span>
                <span v-else>—</span>
              </span>
            </div>
            <div class="ddash-pi">
              <span class="ddash-pi-key">Oil Company</span>
              <span class="ddash-pi-val">{{ profile.oil_company || '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Monthly Activity Chart ─────────────────────────── -->
      <p class="ddash-section-lbl">Monthly Activity</p>
      <div class="ddash-chart-card">
        <div class="ddash-chart-hd">
          <div>
            <p class="ddash-chart-title">My Trip & KM Trend</p>
            <p class="ddash-chart-sub">Monthly breakdown of your trips and distance driven</p>
          </div>
        </div>
        <div v-if="monthly.length" class="ddash-chart-body">
          <apexchart
            type="area"
            :options="areaOptions"
            :series="areaSeries"
            height="240"
            width="100%"
          />
        </div>
        <div v-else class="ddash-chart-empty">No trip history available yet.</div>
      </div>

      <!-- ── Recent Trips ───────────────────────────────────── -->
      <p class="ddash-section-lbl">Recent Trips</p>
      <div class="ddash-trips-card">
        <div class="ddash-trips-hd">
          <p class="ddash-trips-title">Last 10 Trips</p>
          <span class="ddash-trips-count">{{ recentTrips.length }} records</span>
        </div>

        <div v-if="recentTrips.length" class="ddash-trips-wrap">
          <!-- Desktop table -->
          <table class="ddash-trips-tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Oil Company</th>
                <th>KM</th>
                <th>Load (kg)</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(t, i) in recentTrips" :key="i">
                <td class="mono">{{ formatDate(t.date) }}</td>
                <td>
                  <span :class="['ddash-type-tag', `ddash-type--${(t.type||'').toLowerCase()}`]">
                    {{ t.type || '—' }}
                  </span>
                </td>
                <td>{{ t.oil_company || '—' }}</td>
                <td class="mono">{{ (t.km_driven || 0).toLocaleString() }}</td>
                <td class="mono">{{ (t.load_size || 0).toLocaleString() }}</td>
                <td>
                  <span v-if="t.notes" class="ddash-notes-tag">{{ t.notes }}</span>
                  <span v-else class="tc-3">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Mobile cards -->
          <div class="ddash-trips-cards">
            <div v-for="(t, i) in recentTrips" :key="i" class="ddash-trip-m-card">
              <div class="ddash-trip-m-top">
                <span class="mono ddash-trip-m-date">{{ formatDate(t.date) }}</span>
                <span :class="['ddash-type-tag', `ddash-type--${(t.type||'').toLowerCase()}`]">
                  {{ t.type || '—' }}
                </span>
              </div>
              <div class="ddash-trip-m-meta">
                <span><span class="ddash-m-key">Company</span>{{ t.oil_company || '—' }}</span>
                <span><span class="ddash-m-key">KM</span>{{ (t.km_driven || 0).toLocaleString() }}</span>
                <span><span class="ddash-m-key">Load</span>{{ (t.load_size || 0).toLocaleString() }} kg</span>
                <span v-if="t.notes"><span class="ddash-m-key">Notes</span>{{ t.notes }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="ddash-trips-empty">
          <TruckIcon :size="22" :stroke-width="1.5" />
          <p>No trips recorded yet</p>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────────── */
.ddash { display: flex; flex-direction: column; gap: 0.75rem; }

/* ── Banner ─────────────────────────────────────────────────────────────────── */
.ddash-banner {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
  background: linear-gradient(135deg, #065F46 0%, #16A34A 55%, #34D399 100%);
  border-radius: 16px; padding: 1.5rem 1.75rem; color: #fff; margin-bottom: 0.5rem;
}
.ddash-banner-left   { display: flex; align-items: center; gap: 1rem; }
.ddash-banner-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: rgba(255,255,255,0.2); display: grid; place-items: center; flex-shrink: 0;
}
.ddash-banner-avatar svg { width: 28px; height: 28px; }
.ddash-greeting     { font-size: 0.8rem; opacity: 0.85; margin: 0 0 2px; font-weight: 500; }
.ddash-banner-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 2px; }
.ddash-banner-sub   { font-size: 0.875rem; opacity: 0.85; margin: 0; }
.ddash-banner-date  {
  display: flex; flex-direction: column; align-items: flex-end;
  /* background: rgba(255,255,255,0.15); border-radius: 10px; padding: 0.5rem 1rem; */
}
.ddash-date-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: .08em; opacity: .8; }
.ddash-date-value { font-size: 0.9rem; font-weight: 600; margin-top: 2px; }

/* ── Loading / Error ────────────────────────────────────────────────────────── */
.ddash-loading {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 3rem; color: var(--c-text-2);
}
.ddash-spinner {
  width: 20px; height: 20px; border: 2px solid var(--c-border);
  border-top-color: #16A34A; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.ddash-error {
  display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25);
  border-radius: 10px; color: #EF4444; font-size: 0.875rem;
}
.ddash-error svg { width: 18px; height: 18px; flex-shrink: 0; }

/* ── Section label ───────────────────────────────────────────────────────────── */
.ddash-section-lbl {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: var(--c-text-2); margin: 1.25rem 0 0.5rem;
}

/* ── Stat cards ──────────────────────────────────────────────────────────────── */
.ddash-stats-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;
}
.ddash-stat-card {
  display: flex; align-items: center; gap: 1rem;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; padding: 1rem 1.25rem;
  transition: box-shadow 0.2s, transform 0.2s;
}
.ddash-stat-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); transform: translateY(-1px); }
.ddash-stat-icon {
  width: 44px; height: 44px; border-radius: 20px;
  display: grid; place-items: center; flex-shrink: 0;
}
.ddash-stat-icon svg { width: 22px; height: 22px; }
.ddash-stat--green .ddash-stat-icon { background: rgba(22,163,74,0.12); color: #16A34A; }
.ddash-stat--blue  .ddash-stat-icon { background: rgba(29,78,216,0.12);  color: #1D4ED8; }
.ddash-stat--purple .ddash-stat-icon{ background: rgba(124,58,237,0.12); color: #7C3AED; }
.ddash-license-card .ddash-stat-icon{ background: rgba(22,163,74,0.08);  color: #16A34A; }
[data-status="critical"] .ddash-stat-icon { background: rgba(239,68,68,0.1);  color: #EF4444; }
[data-status="warning"]  .ddash-stat-icon { background: rgba(245,158,11,0.1); color: #F59E0B; }
[data-status="notice"]   .ddash-stat-icon { background: rgba(59,130,246,0.1); color: #3B82F6; }

.ddash-stat-value { font-size: 1.5rem; font-weight: 700; color: var(--c-text); line-height: 1; margin-bottom: 4px; }
.ddash-stat-label { font-size: 0.78rem; color: var(--c-text-2); font-weight: 500; }
.ddash-license-date { font-size: 0.72rem; color: var(--c-text-2); font-family: monospace; margin-top: 3px; }

/* ── Profile card ────────────────────────────────────────────────────────────── */
.ddash-profile-row { }
.ddash-profile-card {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; padding: 1.25rem;
}
.ddash-profile-hd {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 600; color: var(--c-text);
  margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--c-border);
}
.ddash-profile-hd svg { width: 18px; height: 18px; color: #16A34A; }
.ddash-profile-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem 1.5rem;
}
.ddash-pi       { display: flex; flex-direction: column; gap: 3px; }
.ddash-pi-key   { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--c-text-2); }
.ddash-pi-val   { font-size: 0.875rem; color: var(--c-text); font-weight: 500; }

/* Status & rank in profile */
.ddash-status {
  display: inline-block; padding: 0.15rem 0.5rem; border-radius: 6px;
  font-size: 0.75rem; font-weight: 600; text-transform: capitalize;
}
.ddash-status--active  { background: rgba(22,163,74,0.1);  color: #16A34A; }
.ddash-status--blocked { background: rgba(239,68,68,0.1);  color: #EF4444; }
.ddash-rank {
  display: inline-block; padding: 0.15rem 0.55rem;
  border-radius: 6px; font-size: 0.75rem; font-weight: 700;
}
.ddash-rank-a { background: rgba(22,163,74,0.12);  color: #16A34A; }
.ddash-rank-b { background: rgba(217,119,6,0.12);  color: #D97706; }
.ddash-rank-c { background: rgba(239,68,68,0.12);  color: #EF4444; }

/* ── Chart card ──────────────────────────────────────────────────────────────── */
.ddash-chart-card {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; overflow: hidden;
}
.ddash-chart-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid var(--c-border);
}
.ddash-chart-title { font-size: 0.9rem; font-weight: 600; color: var(--c-text); margin: 0 0 2px; }
.ddash-chart-sub   { font-size: 0.78rem; color: var(--c-text-2); margin: 0; }
.ddash-chart-body  { padding: 0.75rem 0.5rem 0.5rem; }
.ddash-chart-empty {
  padding: 2rem; text-align: center; color: var(--c-text-2); font-size: 0.875rem;
}

/* ── Recent trips card ───────────────────────────────────────────────────────── */
.ddash-trips-card {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; overflow: hidden;
}
.ddash-trips-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--c-border);
}
.ddash-trips-title { font-size: 0.9rem; font-weight: 600; color: var(--c-text); margin: 0; }
.ddash-trips-count { font-size: 0.78rem; color: var(--c-text-2); }
.ddash-trips-wrap  { overflow-x: auto; }
.ddash-trips-tbl   { width: 100%; border-collapse: collapse; }
.ddash-trips-tbl thead th {
  padding: 0.65rem 1.1rem; text-align: left;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--c-text-2); background: var(--c-bg); border-bottom: 1px solid var(--c-border); white-space: nowrap;
}
.ddash-trips-tbl tbody td {
  padding: 0.8rem 1.1rem; font-size: 0.84rem; color: var(--c-text);
  border-bottom: 1px solid var(--c-border); white-space: nowrap;
}
.ddash-trips-tbl tbody tr:last-child td { border-bottom: none; }
.ddash-trips-tbl tbody tr:hover { background: var(--c-hover); }

/* Type tags */
.ddash-type-tag {
  display: inline-block; padding: 0.15rem 0.55rem; border-radius: 6px;
  font-size: 0.74rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em;
}
.ddash-type--petrol { background: rgba(29,78,216,0.1);   color: #1D4ED8; }
.ddash-type--diesel { background: rgba(217,119,6,0.1);   color: #D97706; }
.ddash-type--lpg    { background: rgba(22,163,74,0.1);   color: #16A34A; }
.ddash-type--cng    { background: rgba(124,58,237,0.1);  color: #7C3AED; }

/* Notes tag */
.ddash-notes-tag {
  display: inline-block; padding: 0.15rem 0.5rem; border-radius: 6px;
  background: rgba(100,116,139,0.1); color: var(--c-text-2);
  font-size: 0.76rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Helper */
.tc-3 { color: var(--c-text-2); }
.mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; }

/* Mobile trips cards */
.ddash-trips-cards  { display: none; }
.ddash-trip-m-card  { padding: 0.875rem 1.1rem; border-bottom: 1px solid var(--c-border); }
.ddash-trip-m-card:last-child { border-bottom: none; }
.ddash-trip-m-top   { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.4rem; }
.ddash-trip-m-date  { font-size: 0.84rem; color: var(--c-text); }
.ddash-trip-m-meta  { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; font-size: 0.8rem; color: var(--c-text); }
.ddash-m-key { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; color: var(--c-text-2); margin-right: 3px; }

/* Empty trips */
.ddash-trips-empty {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 2.5rem; color: var(--c-text-2); font-size: 0.875rem;
}
.ddash-trips-empty svg { width: 36px; height: 36px; opacity: 0.4; }

/* ── Responsive ──────────────────────────────────────────────────────────────── */
@media (max-width: 1024px) {
  .ddash-profile-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 768px) {
  .ddash-stats-grid { grid-template-columns: 1fr 1fr; }
  .ddash-profile-grid { grid-template-columns: repeat(2, 1fr); }
  .ddash-banner-title { font-size: 1.25rem; }
}
@media (max-width: 640px) {
  .ddash-banner { padding: 1.25rem; }
  .ddash-banner-date { display: none; }
  .ddash-stats-grid   { grid-template-columns: 1fr 1fr; }
  .ddash-profile-grid { grid-template-columns: 1fr 1fr; }
  .ddash-trips-tbl    { display: none; }
  .ddash-trips-cards  { display: block; }
}
</style>
