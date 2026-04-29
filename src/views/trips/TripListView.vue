<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import tripsApi      from '../../api/trips'
import DataTable        from '../../components/common/DataTable.vue'
import SearchInput      from '../../components/common/SearchInput.vue'
import AppPagination    from '../../components/common/AppPagination.vue'
import DateRangePicker  from '../../components/common/DateRangePicker.vue'
import { useAuthStore } from '../../stores/auth'
import {
  TruckIcon, FilterIcon, FuelIcon, ChevronDownIcon, SearchIcon, CheckIcon, CloseIcon,
} from '../../components/icons/index.js'

const auth = useAuthStore()
const isAdmin = computed(() => auth.hasRole('admin'))

const trips   = ref([])
const loading = ref(true)

// In production builds, default the date range to today so deployed users land
// on fresh data. Local dev keeps it open so seeded historical mock data is visible.
const todayISO = new Date().toISOString().slice(0, 10)
const defaultDate = import.meta.env.PROD ? todayISO : ''

// ── Filter state ──────────────────────────────────────────────────────────────
const search     = ref('')
const typeFilter = ref('')
const oilFilter  = ref('')
const dateFrom   = ref(defaultDate)
const dateTo     = ref(defaultDate)

// ── Oil dropdown state ────────────────────────────────────────────────────────
const showOilDrop  = ref(false)
const oilSearch    = ref('')
const oilDropRef   = ref(null)

// ── Sort state ────────────────────────────────────────────────────────────────
const sortKey = ref('date')
const sortDir = ref('desc')

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

// ── Computed stats ────────────────────────────────────────────────────────────
// Banner stats reflect the currently filtered list so the headline numbers
// stay in sync with the filter bar. `uniqueTypes` stays on the unfiltered
// list because it powers the type filter pills themselves.
const totalKm       = computed(() => filteredTrips.value.reduce((s, t) => s + (Number(t.km_driven) || 0), 0))
const uniqueDrivers = computed(() => new Set(filteredTrips.value.map(t => t.driver_id)).size)
const filteredOilCos = computed(() => {
  const seen = new Map()
  filteredTrips.value.forEach(t => {
    if (t.oil_company) {
      const key = t.oil_company.toLowerCase()
      if (!seen.has(key)) seen.set(key, capitalize(t.oil_company))
    }
  })
  return [...seen.values()]
})
const uniqueTypes  = computed(() => [...new Set(trips.value.map(t => t.type).filter(Boolean))].sort())

// Deduplicate by normalizing casing
const uniqueOilCos = computed(() => {
  const seen = new Map()
  trips.value.forEach(t => {
    if (t.oil_company) {
      const key = t.oil_company.toLowerCase()
      if (!seen.has(key)) seen.set(key, capitalize(t.oil_company))
    }
  })
  return [...seen.values()].sort()
})

// Oil options filtered by search input inside dropdown
const filteredOilOptions = computed(() => {
  const q = oilSearch.value.toLowerCase()
  return q ? uniqueOilCos.value.filter(o => o.toLowerCase().includes(q)) : uniqueOilCos.value
})

// ── Filtered + sorted trips ───────────────────────────────────────────────────
const filteredTrips = computed(() => {
  let list = trips.value

  if (typeFilter.value)
    list = list.filter(t => t.type === typeFilter.value)

  if (oilFilter.value)
    list = list.filter(t => (t.oil_company || '').toLowerCase() === oilFilter.value.toLowerCase())

  if (dateFrom.value)
    list = list.filter(t => t.date && t.date >= dateFrom.value)

  if (dateTo.value)
    list = list.filter(t => t.date && t.date <= dateTo.value)

  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter(t =>
      String(t.driver_id || '').toLowerCase().includes(q)          ||
      String(t.driver_name || '').toLowerCase().includes(q)        ||
      String(t.delivery_note || '').toLowerCase().includes(q)      ||
      String(t.ship_to_party_name || '').toLowerCase().includes(q) ||
      String(t.location || '').toLowerCase().includes(q)
    )
  }

  if (sortKey.value) {
    list = [...list].sort((a, b) => {
      let av = a[sortKey.value]
      let bv = b[sortKey.value]
      if (sortKey.value === 'date') {
        av = av ? new Date(av).getTime() : 0
        bv = bv ? new Date(bv).getTime() : 0
      } else {
        av = Number(av) || 0
        bv = Number(bv) || 0
      }
      return sortDir.value === 'asc' ? av - bv : bv - av
    })
  }

  return list
})

const hasFilter = computed(() => typeFilter.value || oilFilter.value || dateFrom.value || dateTo.value || search.value)

// ── Pagination ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 15
const page = ref(1)
const pagedTrips = computed(() => {
  const start = (page.value - 1) * ITEMS_PER_PAGE
  return filteredTrips.value.slice(start, start + ITEMS_PER_PAGE)
})
const lastPage = computed(() => Math.max(1, Math.ceil(filteredTrips.value.length / ITEMS_PER_PAGE)))
const pageFrom = computed(() => filteredTrips.value.length === 0 ? 0 : (page.value - 1) * ITEMS_PER_PAGE + 1)
const pageTo   = computed(() => Math.min(page.value * ITEMS_PER_PAGE, filteredTrips.value.length))
watch([search, typeFilter, oilFilter, dateFrom, dateTo], () => { page.value = 1 })

// ── Columns ───────────────────────────────────────────────────────────────────
// Driver column is admin-only; drivers viewing their own trips don't need it.
const columns = computed(() => [
  ...(isAdmin.value
    ? [{ key: 'driver_id', label: 'Driver', sortable: true }]
    : []),
  { key: 'date',               label: 'Date',        sortable: true  },
  { key: 'road_tanker_id',     label: 'Tanker',      sortable: false },
  { key: 'delivery_note',      label: 'D/Note',      sortable: false },
  { key: 'type',               label: 'Type',        sortable: false },
  { key: 'ship_to_party_name', label: 'Ship To',     sortable: false },
  { key: 'location',           label: 'Location',    sortable: false },
  { key: 'material',           label: 'Material',    sortable: false },
  { key: 'oil_company',        label: 'Oil Co.',     sortable: false },
  { key: 'load_size',          label: 'Load (Ltr)',  sortable: true  },
  { key: 'km_driven',          label: 'KM',          sortable: true  },
  { key: 'special_notes',      label: 'Notes',       sortable: false },
])

// ── Handlers ──────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const params = {}
    if (!auth.hasRole('admin') && auth.user?.driver_id) {
      params.driver_id = auth.user.driver_id
    }
    const { data } = await tripsApi.list(params)
    trips.value = data.data || []
  } finally {
    loading.value = false
  }
  document.addEventListener('mousedown', onDocClick)
})
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

function onDocClick(e) {
  if (oilDropRef.value && !oilDropRef.value.contains(e.target)) {
    showOilDrop.value = false
  }
}

function toggleType(t)  { typeFilter.value = typeFilter.value === t ? '' : t }

function selectOil(co) {
  oilFilter.value   = oilFilter.value === co ? '' : co
  showOilDrop.value = false
  oilSearch.value   = ''
}

function handleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'date' ? 'desc' : 'asc'
  }
}

function clearFilters() {
  typeFilter.value = ''
  oilFilter.value  = ''
  dateFrom.value   = ''
  dateTo.value     = ''
  search.value     = ''
  oilSearch.value  = ''
  page.value       = 1
}
</script>

<template>
  <div class="tv">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="tv-banner">
      <div class="tv-banner-left">
        <div class="tv-banner-icon">
          <TruckIcon :size="20" />
        </div>
        <div>
          <h1 class="tv-banner-title">Trips</h1>
          <p class="tv-banner-sub">Fleet Trip Records</p>
        </div>
      </div>
      <div class="tv-banner-stats">
        <div class="tv-bstat">
          <span class="tv-bstat-val">{{ loading ? '—' : filteredTrips.length }}</span>
          <span class="tv-bstat-lbl">Total</span>
        </div>
        <div class="tv-bstat tv-bstat--blue">
          <span class="tv-bstat-val">{{ loading ? '—' : totalKm.toLocaleString() }}</span>
          <span class="tv-bstat-lbl">KM</span>
        </div>
        <div v-if="isAdmin" class="tv-bstat tv-bstat--green">
          <span class="tv-bstat-val">{{ loading ? '—' : uniqueDrivers }}</span>
          <span class="tv-bstat-lbl">Drivers</span>
        </div>
        <div class="tv-bstat tv-bstat--purple">
          <span class="tv-bstat-val">{{ loading ? '—' : filteredOilCos.length }}</span>
          <span class="tv-bstat-lbl">Oil Cos.</span>
        </div>
      </div>
    </div>

    <!-- ── Table card ─────────────────────────────────────────── -->
    <div class="tv-table-card">

      <!-- Card header -->
      <div class="tv-card-hd">
        <div>
          <p class="tv-card-title">Trip Records</p>
          <p class="tv-card-sub">
            <span>{{ loading ? '…' : filteredTrips.length }} trip{{ filteredTrips.length !== 1 ? 's' : '' }}</span>
            <span v-if="hasFilter" class="chip chip--filter">filtered</span>
            <span class="chip chip--sort">
              {{ columns.find(c => c.key === sortKey)?.label || sortKey }}
              {{ sortDir === 'asc' ? '↑' : '↓' }}
            </span>
            <span v-if="dateFrom || dateTo" class="chip chip--filter">
              {{ dateFrom && dateTo && dateFrom === dateTo ? formatDate(dateFrom) :
                 `${dateFrom ? formatDate(dateFrom) : '…'} – ${dateTo ? formatDate(dateTo) : '…'}` }}
            </span>
          </p>
        </div>
        <div class="tv-card-search">
          <SearchInput v-model="search" placeholder="Search driver, delivery note…" />
        </div>
      </div>

      <!-- Filter bar -->
      <div class="tv-filter-bar">
        <span class="tv-filter-lbl">
          <FilterIcon :size="12" aria-hidden="true" />
          Filter
        </span>

        <!-- Trip type -->
        <div v-if="!loading && uniqueTypes.length" class="tv-seg" role="group" aria-label="Filter by type">
          <button :class="['tv-seg-btn', typeFilter === '' && 'tv-seg-btn--on']" @click="toggleType('')">All</button>
          <button
            v-for="t in uniqueTypes" :key="t"
            :class="['tv-seg-btn', typeFilter === t && 'tv-seg-btn--on']"
            @click="toggleType(t)"
          >{{ t }}</button>
        </div>

        <div class="tv-sep" />

        <!-- Oil company searchable dropdown -->
        <div v-if="!loading" ref="oilDropRef" class="tv-drop-wrap">
          <button
            :class="['tv-drop-trigger', oilFilter && 'tv-drop-trigger--on']"
            @click="showOilDrop = !showOilDrop"
            type="button"
          >
            <FuelIcon :size="16" class="tv-drop-icon" />
            <span>{{ oilFilter || 'Oil Company' }}</span>
            <ChevronDownIcon :size="12" :stroke-width="1.5" class="tv-drop-caret" :class="showOilDrop && 'tv-drop-caret--open'" />
          </button>

          <Transition name="tv-drop">
            <div v-if="showOilDrop" class="tv-drop-panel">
              <!-- Search input -->
              <div class="tv-drop-search-wrap">
                <SearchIcon :size="14" class="tv-drop-search-icon" />
                <input
                  v-model="oilSearch"
                  class="tv-drop-search"
                  placeholder="Search company…"
                  type="text"
                  autocomplete="off"
                />
              </div>
              <!-- Options -->
              <div class="tv-drop-list">
                <button
                  class="tv-drop-opt"
                  :class="oilFilter === '' && 'tv-drop-opt--on'"
                  @click="selectOil('')"
                  type="button"
                >
                  <span class="tv-drop-opt-check">
                    <CheckIcon v-if="oilFilter === ''" :size="12" />
                  </span>
                  All Companies
                </button>
                <button
                  v-for="co in filteredOilOptions" :key="co"
                  :class="['tv-drop-opt', oilFilter === co && 'tv-drop-opt--on']"
                  @click="selectOil(co)"
                  type="button"
                >
                  <span class="tv-drop-opt-check">
                    <CheckIcon v-if="oilFilter === co" :size="12" />
                  </span>
                  {{ co }}
                </button>
                <p v-if="filteredOilOptions.length === 0" class="tv-drop-empty">No match</p>
              </div>
            </div>
          </Transition>
        </div>

        <div class="tv-sep" />

        <!-- Date range -->
        <DateRangePicker v-model:from="dateFrom" v-model:to="dateTo" />

        <Transition name="tv-fade">
          <button v-if="hasFilter" class="tv-clear-btn" @click="clearFilters">
            <CloseIcon :size="10" :stroke-width="2.5" />
            Reset
          </button>
        </Transition>

        <div class="tv-mobile-search">
          <SearchInput v-model="search" placeholder="Search…" />
        </div>
      </div>

      <!-- Table + Pagination in a separate overflow:hidden wrapper so the filter
           dropdown above can escape the card boundary without being clipped -->
      <div class="tv-table-body">
        <DataTable
          :columns="columns"
          :rows="pagedTrips"
          :loading="loading"
          :flat="true"
          :has-filter="hasFilter"
          :sort-key="sortKey"
          :sort-dir="sortDir"
          empty-message="No trips found."
          @sort="handleSort"
        >
          <template #cell-driver_id="{ row, value }">
            <div class="tv-driver-cell">
              <span v-if="row.driver_name" class="tv-driver-name">{{ row.driver_name }}</span>
              <span class="tv-driver-id">{{ value || '—' }}</span>
            </div>
          </template>
          <template #cell-date="{ value }">
            <span class="mono">{{ formatDate(value) }}</span>
          </template>
          <template #cell-type="{ value }">
            <span :class="['type-tag', value === 'RE' ? 'type-tag--re' : 'type-tag--cb']">{{ value || '—' }}</span>
          </template>
          <template #cell-oil_company="{ value }">
            <span class="oil-text">{{ value ? capitalize(value) : '—' }}</span>
          </template>
          <template #cell-load_size="{ value }">
            <span class="mono">{{ Number(value).toLocaleString() }}</span>
          </template>
          <template #cell-km_driven="{ value }">
            <span class="mono">{{ value }}</span>
          </template>
          <template #cell-special_notes="{ value }">
            <span v-if="value && value.length" class="notes-row">
              <span
                v-for="(note, i) in value" :key="i"
                :class="['note-tag', `note-tag--${note}`]"
              >{{ note }}</span>
            </span>
            <span v-else class="tc-3">—</span>
          </template>
        </DataTable>

        <AppPagination
          v-if="!loading && filteredTrips.length"
          :current-page="page"
          :last-page="lastPage"
          :total="filteredTrips.length"
          :from="pageFrom"
          :to="pageTo"
          always
          @change="p => { page = p }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tv { min-width: 0; overflow: hidden; }

/* ── Banner ──────────────────────────────────────────────────── */
.tv-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 20px;
  position: relative; overflow: hidden;
}
.tv-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--c-accent); border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .tv-banner { padding: 18px 24px; margin-bottom: 24px; } }

.tv-banner-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.tv-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.tv-banner-icon svg { width: 20px; height: 20px; }
.tv-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.02em; margin-bottom: 1px; }
@media (min-width: 640px) { .tv-banner-title { font-size: 1.25rem; } }
.tv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.tv-banner-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.tv-bstat {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 14px; border-radius: var(--r-lg); min-width: 52px;
  background: var(--c-bg); border: 1px solid var(--c-border-light);
}
.tv-bstat-val { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--c-text-1); }
.tv-bstat-lbl { font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-3); margin-top: 3px; }
.tv-bstat--blue   .tv-bstat-val { color: var(--c-accent); }
.tv-bstat--green  .tv-bstat-val { color: var(--c-green); }
.tv-bstat--purple .tv-bstat-val { color: var(--c-purple); }

/* ── Table card ──────────────────────────────────────────────── */
.tv-table-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  /* no overflow:hidden here — the filter dropdown needs to escape the card boundary */
}
/* Only the table+pagination section clips to the card's rounded bottom corners */
.tv-table-body {
  overflow: hidden;
  border-radius: 0 0 var(--r-xl) var(--r-xl);
}
.tv-card-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 20px; border-bottom: 1px solid var(--c-border-light);
}
.tv-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); letter-spacing: -0.01em; }
.tv-card-sub {
  font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px;
  display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
}
.tv-card-search { flex-shrink: 0; width: 220px; }
@media (max-width: 767px) { .tv-card-hd { padding: 12px 14px; } .tv-card-search { display: none; } }

.tv-driver-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.tv-driver-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--c-accent);
}
.tv-driver-id {
  font-size: 0.75rem;
  color: var(--c-text-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.01em;
}


/* ── Filter bar ──────────────────────────────────────────────── */
.tv-filter-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 10px 20px; border-bottom: 1px solid var(--c-border-light);
}
@media (max-width: 767px) { .tv-filter-bar { padding: 10px 14px; gap: 6px; } }

/* FILTER label always on its own row (matches Compensation/Payroll Batches standard) */
.tv-filter-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--c-text-3);
  width: 100%; margin-bottom: 4px;
}
.tv-filter-lbl svg { width: 12px; height: 12px; }

.tv-sep { width: 1px; height: 24px; background: var(--c-border); flex-shrink: 0; margin: 0 2px; }
@media (max-width: 640px) { .tv-sep { display: none; } }

/* Trip type pill group */
.tv-seg {
  display: inline-flex; background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-full); padding: 3px; gap: 2px; flex-shrink: 0;
}
.tv-seg-btn {
  padding: 4px 12px; border-radius: var(--r-full); font-size: 0.8125rem; font-weight: 500;
  color: var(--c-text-3); background: transparent; border: none; cursor: pointer;
  transition: all var(--dur); white-space: nowrap;
}
.tv-seg-btn:hover:not(.tv-seg-btn--on) { background: var(--c-surface); color: var(--c-text-1); }
.tv-seg-btn--on { background: var(--c-surface); color: var(--c-accent); font-weight: 600; box-shadow: var(--sh-xs); }

/* ── Oil Company searchable dropdown ─────────────────────────── */
.tv-drop-wrap { position: relative; flex-shrink: 0; }

.tv-drop-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px 5px 10px; border-radius: var(--r-full);
  border: 1.5px solid var(--c-border); background: var(--c-surface);
  color: var(--c-text-2); font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.tv-drop-trigger:hover { border-color: var(--c-accent); color: var(--c-accent); }
.tv-drop-trigger--on   { border-color: var(--c-accent); background: var(--c-accent-tint); color: var(--c-accent); font-weight: 600; }
.tv-drop-icon  { width: 14px; height: 14px; flex-shrink: 0; }
.tv-drop-caret { width: 10px; height: 6px; flex-shrink: 0; transition: transform var(--dur); }
.tv-drop-caret--open { transform: rotate(180deg); }

.tv-drop-panel {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 100;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px; box-shadow: var(--sh-lg);
  width: 220px; overflow: hidden;
}

.tv-drop-search-wrap {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid var(--c-border-light);
}
.tv-drop-search-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--c-text-3); }
.tv-drop-search {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 0.8125rem; color: var(--c-text-1);
}
.tv-drop-search::placeholder { color: var(--c-text-3); }

.tv-drop-list { max-height: 220px; overflow-y: auto; padding: 4px; }

.tv-drop-opt {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 10px; border-radius: 8px; border: none;
  background: transparent; color: var(--c-text-1); font-size: 0.8125rem;
  cursor: pointer; transition: background var(--dur); text-align: left;
}
.tv-drop-opt:hover   { background: var(--c-bg); }
.tv-drop-opt--on     { background: var(--c-accent-tint); color: var(--c-accent); font-weight: 600; }
.tv-drop-opt-check   { width: 16px; height: 16px; flex-shrink: 0; color: var(--c-accent); }
.tv-drop-opt-check svg { width: 100%; height: 100%; display: block; }

.tv-drop-empty { padding: 12px; text-align: center; font-size: 0.8125rem; color: var(--c-text-3); margin: 0; }

/* ── Clear button ────────────────────────────────────────────── */
.tv-clear-btn {
  display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; font-weight: 500;
  color: var(--c-text-3); padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border); background: var(--c-surface); cursor: pointer; transition: all var(--dur);
}
.tv-clear-btn svg { width: 10px; height: 10px; }
.tv-clear-btn:hover { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }

.tv-mobile-search { display: none; }
@media (max-width: 767px) { .tv-mobile-search { display: block; width: 100%; margin-top: 2px; } }

/* Mobile: match Compensation/Payroll Batches compact filter style —
   no min-height overrides, pills stay naturally compact */
@media (max-width: 767px) {
  /* Oil dropdown panel: full-width on mobile so options are readable */
  .tv-drop-panel {
    width: 100%;
  }
}

/* ── Transitions ─────────────────────────────────────────────── */
.tv-fade-enter-active, .tv-fade-leave-active { transition: opacity 150ms, transform 150ms; }
.tv-fade-enter-from, .tv-fade-leave-to { opacity: 0; transform: scale(0.85); }

.tv-drop-enter-active, .tv-drop-leave-active { transition: opacity 120ms, transform 120ms; }
.tv-drop-enter-from, .tv-drop-leave-to { opacity: 0; transform: translateY(-6px); }

/* ── Cell styles ─────────────────────────────────────────────── */
.mono { font-variant-numeric: tabular-nums; }
.type-tag {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em;
}
.type-tag--re { background: var(--c-accent-tint); color: var(--c-accent); }
.type-tag--cb { background: var(--c-purple-tint); color: var(--c-purple); }
.oil-text { font-size: 0.8125rem; color: var(--c-text-2); }
.notes-row { display: flex; gap: 4px; flex-wrap: wrap; }
.note-tag {
  display: inline-flex; padding: 2px 7px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 600; text-transform: capitalize;
}
.note-tag--diversion { background: var(--c-amber-tint);  color: var(--c-amber);  }
.note-tag--ron97     { background: var(--c-green-tint);  color: var(--c-green);  }
.note-tag--others    { background: var(--c-orange-tint); color: var(--c-orange); }
</style>
