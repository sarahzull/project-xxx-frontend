<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import driversApi from '../../api/drivers'
import reportsApi from '../../api/reports'
import DataTable      from '../../components/common/DataTable.vue'
import SearchInput    from '../../components/common/SearchInput.vue'
import StatusBadge    from '../../components/common/StatusBadge.vue'
import StatCard       from '../../components/common/StatCard.vue'
import ActionBtn      from '../../components/common/ActionBtn.vue'
import AppPagination  from '../../components/common/AppPagination.vue'
import { DriverIcon, FilterIcon, CloseIcon, ViewIcon } from '../../components/icons/index.js'

const router = useRouter()

// ── Data ──────────────────────────────────────────────────────────────────────
const drivers      = ref([])
const loading      = ref(true)
const search       = ref('')
const statusFilter = ref('')   // '' | 'active' | 'blocked'
const rankFilter   = ref('')   // '' | 'A' | 'B' | 'C'
const sortKey      = ref('')
const sortDir      = ref('asc')

const driverStats  = ref(null)
const statsLoading = ref(true)

// ── Table columns ─────────────────────────────────────────────────────────────
const columns = [
  { key: 'name',           label: 'Driver',           sortable: true },
  { key: 'base',           label: 'Base',             sortable: true },
  { key: 'road_tanker_id', label: 'Road Tanker' },
  { key: 'license_type',   label: 'License' },
  { key: 'license_expiry', label: 'License Expiry',   sortable: true },
  { key: 'ranking',        label: 'Ranking',          sortable: true },
  { key: 'status',         label: 'Status',           sortable: true },
  { key: 'actions',        label: '' },
]

const SORT_LABELS = {
  name:           'Name',
  license_expiry: 'License Expiry',
  ranking:        'Ranking',
  status:         'Status',
}

// ── Computed ──────────────────────────────────────────────────────────────────
const filteredDrivers = computed(() => {
  let list = drivers.value
  if (statusFilter.value) list = list.filter(d => d.status === statusFilter.value)
  if (rankFilter.value)   list = list.filter(d => d.ranking === rankFilter.value)
  return list
})

const sortedDrivers = computed(() => {
  const list = [...filteredDrivers.value]
  if (!sortKey.value) return list
  return list.sort((a, b) => {
    let va = a[sortKey.value] ?? ''
    let vb = b[sortKey.value] ?? ''
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (va < vb) return sortDir.value === 'asc' ? -1 : 1
    if (va > vb) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
})

const rankCounts  = computed(() => driverStats.value?.drivers_by_ranking || {})
const sortLabel   = computed(() => SORT_LABELS[sortKey.value] || '')
const hasFilter   = computed(() => statusFilter.value || rankFilter.value || search.value)

// ── Client-side pagination ────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 15
const page = ref(1)

const pagedDrivers = computed(() => {
  const start = (page.value - 1) * ITEMS_PER_PAGE
  return sortedDrivers.value.slice(start, start + ITEMS_PER_PAGE)
})

const lastPage = computed(() => Math.max(1, Math.ceil(sortedDrivers.value.length / ITEMS_PER_PAGE)))
const pageFrom = computed(() => sortedDrivers.value.length === 0 ? 0 : (page.value - 1) * ITEMS_PER_PAGE + 1)
const pageTo   = computed(() => Math.min(page.value * ITEMS_PER_PAGE, sortedDrivers.value.length))

// Reset to page 1 whenever the filtered/sorted list changes
watch(sortedDrivers, () => { page.value = 1 })

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

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchDrivers() {
  loading.value = true
  try {
    const { data } = await driversApi.list({ search: search.value })
    drivers.value = data.data
  } finally {
    loading.value = false
  }
}
async function fetchStats() {
  statsLoading.value = true
  try {
    const { data } = await reportsApi.driverSummary()
    driverStats.value = data.data
  } finally {
    statsLoading.value = false
  }
}
onMounted(() => { fetchStats(); fetchDrivers() })
watch(search, fetchDrivers)

// ── Actions ───────────────────────────────────────────────────────────────────
function toggleStatus(s) { statusFilter.value = statusFilter.value === s ? '' : s }
function toggleRank(r)   { rankFilter.value   = rankFilter.value   === r ? '' : r }
function clearFilters()  { statusFilter.value = ''; rankFilter.value = ''; search.value = '' }
function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}
function viewDriver(d)   { router.push({ name: 'driver-detail', params: { id: d.driver_id } }) }
</script>

<template>
  <div class="dv">

    <!-- ── Page header ─────────────────────────────────────────── -->
    <div class="dv-banner">
      <div class="dv-banner-left">
        <div class="dv-banner-icon" aria-hidden="true">
          <DriverIcon :size="20" />
        </div>
        <div>
          <h1 class="dv-banner-title">Drivers</h1>
          <p class="dv-banner-sub">Fleet Driver Management</p>
        </div>
      </div>
      <div v-if="!statsLoading && driverStats" class="dv-banner-stats">
        <div class="dv-bstat">
          <span class="dv-bstat-val">{{ driverStats.total_drivers }}</span>
          <span class="dv-bstat-lbl">Total</span>
        </div>
        <div class="dv-bstat dv-bstat-green">
          <span class="dv-bstat-val">{{ driverStats.active_drivers }}</span>
          <span class="dv-bstat-lbl">Active</span>
        </div>
        <div class="dv-bstat dv-bstat-red">
          <span class="dv-bstat-val">{{ driverStats.blocked_drivers }}</span>
          <span class="dv-bstat-lbl">Blocked</span>
        </div>
        <div v-if="driverStats.license_expiring_soon" class="dv-bstat dv-bstat-amber">
          <span class="dv-bstat-val">{{ driverStats.license_expiring_soon }}</span>
          <span class="dv-bstat-lbl">Expiring</span>
        </div>
      </div>
    </div>

    <!-- ── Fleet Overview stats ────────────────────────────────── -->
    <p class="dv-section-label">Fleet Overview</p>
    <div class="dv-stats-grid mb-section">
      <template v-if="statsLoading">
        <div v-for="n in 4" :key="n" class="stat-skeleton" />
      </template>
      <template v-else>
        <StatCard title="Total Drivers"         :value="driverStats?.total_drivers || 0"         color="blue"   />
        <StatCard title="Active Drivers"        :value="driverStats?.active_drivers || 0"        color="green"  />
        <StatCard title="Blocked Drivers"       :value="driverStats?.blocked_drivers || 0"       color="red"    />
        <StatCard title="License Expiring Soon" :value="driverStats?.license_expiring_soon || 0" color="yellow" subtitle="within 3 months" />
      </template>
    </div>

    <!-- ── Controls + Table card ───────────────────────────────── -->
    <div class="dv-table-card">

      <!-- Card header -->
      <div class="dv-card-hd">
        <div class="dv-card-hd-left">
          <p class="dv-card-title">Driver Directory</p>
          <p class="dv-card-sub">
            <span>{{ loading ? '…' : sortedDrivers.length }} driver{{ sortedDrivers.length !== 1 ? 's' : '' }}</span>
            <span v-if="hasFilter" class="chip chip--filter">filtered</span>
            <span v-if="sortKey" class="chip chip--sort">
              {{ sortLabel }} {{ sortDir === 'asc' ? '↑' : '↓' }}
            </span>
          </p>
        </div>
        <div class="dv-card-search">
          <SearchInput v-model="search" placeholder="Search name or ID…" />
        </div>
      </div>

      <!-- Filter bar -->
      <div class="dv-filter-bar">

        <!-- Filter icon + label -->
        <div class="dv-filter-label" aria-hidden="true">
          <FilterIcon :size="12" />
          <span>Filter</span>
        </div>

        <!-- Status segmented control -->
        <div class="dv-seg" role="group" aria-label="Filter by status">
          <button
            v-for="s in [{ key: '', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'blocked', label: 'Blocked' }]"
            :key="s.key"
            :class="['dv-seg-btn', statusFilter === s.key && `dv-seg-btn--${s.key || 'all'}`]"
            @click="toggleStatus(s.key)"
          >
            <span v-if="s.key === 'active'" class="dv-seg-dot dv-seg-dot--green" />
            <span v-else-if="s.key === 'blocked'" class="dv-seg-dot dv-seg-dot--red" />
            {{ s.label }}
          </button>
        </div>

        <div class="dv-filter-sep" />

        <!-- Rank badges -->
        <div class="dv-rank-group" role="group" aria-label="Filter by rank">
          <button
            v-for="r in ['A', 'B', 'C']"
            :key="r"
            :class="['dv-rank-btn', `dv-rank-btn--${r.toLowerCase()}`, rankFilter === r && 'dv-rank-btn--active']"
            :title="r === 'A' ? 'Rank A — Top performer. Best compliance and safety record.' : r === 'B' ? 'Rank B — Good standing. Some areas for improvement.' : 'Rank C — Needs attention. Performance or compliance issues flagged.'"
            @click="toggleRank(r)"
          >
            <span class="dv-rank-letter">{{ r }}</span>
            <span class="dv-rank-label">Rank</span>
            <span v-if="rankCounts[r]" class="dv-rank-badge">{{ rankCounts[r] }}</span>
          </button>
        </div>

        <!-- Clear filters -->
        <Transition name="clear-fade">
          <button v-if="hasFilter" class="dv-clear-btn" @click="clearFilters">
            <CloseIcon :size="10" :stroke-width="2.5" />
            Reset
          </button>
        </Transition>

        <!-- Mobile search -->
        <div class="dv-mobile-search">
          <SearchInput v-model="search" placeholder="Search name or ID…" />
        </div>
      </div>

      <!-- Rank legend -->
      <div class="dv-rank-legend">
        <span class="dv-rl-item dv-rl--a"><span class="dv-rl-dot"></span>Rank A — Top performer</span>
        <span class="dv-rl-sep">·</span>
        <span class="dv-rl-item dv-rl--b"><span class="dv-rl-dot"></span>Rank B — Good standing</span>
        <span class="dv-rl-sep">·</span>
        <span class="dv-rl-item dv-rl--c"><span class="dv-rl-dot"></span>Rank C — Needs attention</span>
      </div>

      <!-- Flat table (card chrome comes from dv-table-card) -->
      <DataTable
        :columns="columns"
        :rows="pagedDrivers"
        :loading="loading"
        :flat="true"
        :has-filter="hasFilter"
        :sort-key="sortKey"
        :sort-dir="sortDir"
        empty-message="No drivers found."
        @sort="toggleSort"
      >
        <template #cell-name="{ row }">
          <button class="dv-driver-cell" @click="viewDriver(row)">
            <span class="dv-driver-name">{{ row.name }}</span>
            <span class="dv-driver-id">{{ row.driver_id }}</span>
          </button>
        </template>
        <template #cell-status="{ value }">
          <StatusBadge :status="value" />
        </template>
        <template #cell-ranking="{ value }">
          <span
            :class="['dv-rank-chip', value === 'A' ? 'dv-chip-a' : value === 'B' ? 'dv-chip-b' : 'dv-chip-c']"
            :title="value === 'A' ? 'Rank A — Top performer' : value === 'B' ? 'Rank B — Good standing' : value === 'C' ? 'Rank C — Needs attention' : ''"
          >{{ value }}</span>
        </template>
        <template #cell-license_expiry="{ value }">
          <span :class="isExpiringSoon(value) ? 'dv-expiry-warn' : ''">{{ formatDate(value) }}</span>
        </template>
        <template #cell-actions="{ row }">
          <ActionBtn tooltip="View Driver" variant="view" @click="viewDriver(row)">
            <ViewIcon :size="16" />
          </ActionBtn>
        </template>
      </DataTable>

      <AppPagination
        v-if="lastPage > 1"
        :current-page="page"
        :last-page="lastPage"
        :total="sortedDrivers.length"
        :from="pageFrom"
        :to="pageTo"
        @change="p => { page = p }"
      />

    </div>

  </div>
</template>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────── */
.dv { min-width: 0; overflow: hidden; }

/* Combined Driver column (name + driver_id stacked) */
.dv-driver-cell {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  text-align: left;
}
.dv-driver-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--c-accent);
}
.dv-driver-cell:hover .dv-driver-name { text-decoration: underline; }
.dv-driver-id {
  font-size: 0.75rem;
  color: var(--c-text-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.01em;
}
.mb-section { margin-bottom: 20px; }
@media (min-width: 640px) { .mb-section { margin-bottom: 24px; } }

/* ── Rank legend ──────────────────────────────────────────────── */
.dv-rank-legend {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.25rem 0.5rem;
  padding: 0.5rem 1.1rem;
  font-size: 0.7rem; color: var(--c-text-3);
}
.dv-rl-item { display: inline-flex; align-items: center; gap: 5px; font-weight: 500; }
.dv-rl-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dv-rl--a .dv-rl-dot { background: #16A34A; }
.dv-rl--b .dv-rl-dot { background: #1D4ED8; }
.dv-rl--c .dv-rl-dot { background: #D97706; }
.dv-rl--a { color: #16A34A; }
.dv-rl--b { color: #1D4ED8; }
.dv-rl--c { color: #D97706; }
.dv-rl-sep { color: var(--c-border); font-size: 0.75rem; }

/* ── Section label ────────────────────────────────────────────── */
.dv-section-label {
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--c-text-3);
  margin-bottom: 10px;
}

/* ── Page header ──────────────────────────────────────────────── */
.dv-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-sm);
  padding: 16px 20px;
  margin-bottom: 20px;
  position: relative;
  overflow: hidden;
}
.dv-banner::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--c-accent);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .dv-banner { padding: 18px 24px; margin-bottom: 24px; } }

.dv-banner-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dv-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg);
  background: var(--c-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.dv-banner-icon svg { width: 20px; height: 20px; }
.dv-banner-title {
  font-size: 1.125rem; font-weight: 700; color: var(--c-text-1);
  letter-spacing: -0.02em; margin-bottom: 1px;
}
@media (min-width: 640px) { .dv-banner-title { font-size: 1.25rem; } }
.dv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.dv-banner-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.dv-bstat {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 14px; border-radius: var(--r-lg);
  background: var(--c-bg); border: 1px solid var(--c-border-light);
  min-width: 52px;
}
.dv-bstat-val {
  font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em;
  line-height: 1; color: var(--c-text-1);
}
.dv-bstat-lbl {
  font-size: 0.5625rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--c-text-3); margin-top: 3px;
}
.dv-bstat-green .dv-bstat-val { color: var(--c-green); }
.dv-bstat-red   .dv-bstat-val { color: var(--c-red); }
.dv-bstat-amber .dv-bstat-val { color: var(--c-amber); }

/* ── Stats grid ───────────────────────────────────────────────── */
.dv-stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px; min-width: 0;
}
@media (min-width: 1024px) { .dv-stats-grid { grid-template-columns: repeat(4, 1fr); gap: 14px; } }

.stat-skeleton {
  background: var(--c-surface);
  border-radius: var(--r-xl); height: 96px;
  animation: dv-pulse 1.5s ease-in-out infinite;
}
@keyframes dv-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.45 } }

/* ── Controls + Table card ────────────────────────────────────── */
.dv-table-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-sm);
  overflow: hidden;
}

/* Card header */
.dv-card-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--c-border-light);
}
.dv-card-hd-left { min-width: 0; }
.dv-card-title {
  font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1);
  letter-spacing: -0.01em;
}
.dv-card-sub {
  font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px;
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
}
.dv-card-search { flex-shrink: 0; width: 220px; }

/* On mobile, the card header is simpler (search is in filter row) */
@media (max-width: 767px) {
  .dv-card-hd { padding: 12px 14px; }
  .dv-card-search { display: none; }
}


/* ── Filter bar ───────────────────────────────────────────────── */
.dv-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--c-border-light);
  background: var(--c-surface);
}
@media (max-width: 767px) { .dv-filter-bar { padding: 10px 14px; gap: 6px; } }

/* FILTER label always on its own row (matches Compensation/Payroll Batches standard) */
.dv-filter-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--c-text-3);
  width: 100%; margin-bottom: 4px;
}
.dv-filter-label svg { width: 12px; height: 12px; }

/* Separator */
.dv-filter-sep {
  width: 1px; height: 24px;
  background: var(--c-border);
  flex-shrink: 0; margin: 0 2px;
}
@media (max-width: 640px) { .dv-filter-sep { display: none; } }

/* ── Segmented control (status) ───────────────────────────────── */
.dv-seg {
  display: inline-flex;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-full);
  padding: 3px;
  gap: 2px;
  flex-shrink: 0;
}
.dv-seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--c-text-3);
  background: transparent;
  border: none;
  transition: background var(--dur), color var(--dur), box-shadow var(--dur);
  white-space: nowrap;
}
.dv-seg-btn:hover:not([class*="dv-seg-btn--"]) {
  background: var(--c-surface);
  color: var(--c-text-1);
}
/* Active states */
.dv-seg-btn--all {
  background: var(--c-surface);
  color: var(--c-accent);
  font-weight: 600;
  box-shadow: var(--sh-xs);
}
.dv-seg-btn--active {
  background: var(--c-surface);
  color: var(--c-green);
  font-weight: 600;
  box-shadow: var(--sh-xs);
}
.dv-seg-btn--blocked {
  background: var(--c-surface);
  color: var(--c-red);
  font-weight: 600;
  box-shadow: var(--sh-xs);
}

/* Status dot inside seg button */
.dv-seg-dot {
  width: 6px; height: 6px;
  border-radius: 50%; flex-shrink: 0;
}
.dv-seg-dot--green { background: var(--c-green); }
.dv-seg-dot--red   { background: var(--c-red); }

/* ── Rank badge buttons ────────────────────────────────────────── */
.dv-rank-group { display: flex; align-items: center; gap: 6px; }

.dv-rank-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px 5px 8px;
  border-radius: var(--r-lg);
  border: 1.5px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: all var(--dur);
  white-space: nowrap;
}
.dv-rank-btn:hover { border-color: #CBD5E1; box-shadow: var(--sh-xs); color: var(--c-text-1); }

/* Rank letter — the bold initial */
.dv-rank-letter {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: var(--r-sm);
  font-size: 0.8125rem; font-weight: 800;
  flex-shrink: 0;
  transition: background var(--dur), color var(--dur);
}
/* Default (inactive) letter colours */
.dv-rank-btn--a .dv-rank-letter { background: #16A34A; color: #fff; }  /* green  */
.dv-rank-btn--b .dv-rank-letter { background: #1D4ED8; color: #fff; }  /* blue   */
.dv-rank-btn--c .dv-rank-letter { background: #D97706; color: #fff; }  /* amber  */

.dv-rank-label {
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  letter-spacing: 0.02em;
}

.dv-rank-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: var(--r-full);
  font-size: 0.625rem; font-weight: 700;
  background: var(--c-bg);
  color: var(--c-text-3);
  border: 1px solid var(--c-border);
  transition: background var(--dur), color var(--dur), border-color var(--dur);
}

/* Active rank buttons */
.dv-rank-btn--active.dv-rank-btn--a {
  border-color: #16A34A;
  background: #F0FDF4;
  color: #16A34A;
}
.dv-rank-btn--active.dv-rank-btn--a .dv-rank-letter { background: #16A34A; color: #fff; }
.dv-rank-btn--active.dv-rank-btn--a .dv-rank-badge  { background: #DCFCE7; color: #16A34A; border-color: transparent; }
.dv-rank-btn--active.dv-rank-btn--a .dv-rank-label  { color: #16A34A; }

.dv-rank-btn--active.dv-rank-btn--b {
  border-color: #1D4ED8;
  background: #EFF6FF;
  color: #1D4ED8;
}
.dv-rank-btn--active.dv-rank-btn--b .dv-rank-letter { background: #1D4ED8; color: #fff; }
.dv-rank-btn--active.dv-rank-btn--b .dv-rank-badge  { background: #DBEAFE; color: #1D4ED8; border-color: transparent; }
.dv-rank-btn--active.dv-rank-btn--b .dv-rank-label  { color: #1D4ED8; }

.dv-rank-btn--active.dv-rank-btn--c {
  border-color: #D97706;
  background: #FFFBEB;
  color: #D97706;
}
.dv-rank-btn--active.dv-rank-btn--c .dv-rank-letter { background: #D97706; color: #fff; }
.dv-rank-btn--active.dv-rank-btn--c .dv-rank-badge  { background: #FEF3C7; color: #D97706; border-color: transparent; }
.dv-rank-btn--active.dv-rank-btn--c .dv-rank-label  { color: #D97706; }

/* ── Clear button ─────────────────────────────────────────────── */
.dv-clear-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border);
  background: var(--c-surface);
  transition: all var(--dur);
  flex-shrink: 0;
}
.dv-clear-btn svg { width: 10px; height: 10px; }
.dv-clear-btn:hover { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }

/* Clear button transition */
.clear-fade-enter-active, .clear-fade-leave-active { transition: opacity 150ms ease, transform 150ms ease; }
.clear-fade-enter-from, .clear-fade-leave-to { opacity: 0; transform: scale(0.85); }

/* ── Mobile search ────────────────────────────────────────────── */
.dv-mobile-search { display: none; }
@media (max-width: 767px) { .dv-mobile-search { display: block; width: 100%; margin-top: 2px; } }

/* Mobile: filter pills inherit compact desktop style (matches Compensation standard).
   No column stretch, no full-width grid — pills stay as natural inline-flex rows. */

/* ── Table cell styles ────────────────────────────────────────── */
.dv-rank-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  border-radius: var(--r-sm); font-size: 0.8125rem; font-weight: 700;
}
.dv-chip-a { background: #16A34A; color: #fff; }  /* green  */
.dv-chip-b { background: #1D4ED8; color: #fff; }  /* blue   */
.dv-chip-c { background: #D97706; color: #fff; }  /* amber  */

.dv-expiry-warn { color: var(--c-amber); font-weight: 600; }
</style>
