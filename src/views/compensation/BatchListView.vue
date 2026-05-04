<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import compensationApi from '../../api/compensation'
import { useToast } from '../../composables/useToast'
import StatusBadge  from '../../components/common/StatusBadge.vue'
import SearchInput  from '../../components/common/SearchInput.vue'
import ActionBtn    from '../../components/common/ActionBtn.vue'
import AppPagination from '../../components/common/AppPagination.vue'
import { PayIcon, AddIcon, FilterIcon, DriversIcon, ViewIcon, CalendarIcon, CloseIcon } from '../../components/icons/index.js'

const router  = useRouter()
const toast   = useToast()
const batches = ref([])
const loading = ref(true)
const statusFilter = ref('')
const yearFilter   = ref('')
const search       = ref('')

// ── Sub-tab state (Batches | Summary) ────────────────────────────────────────
const activeTab = ref('batches')

// ── Pagination state ──────────────────────────────────────────────────────────
const page  = ref(1)
const meta  = ref({})
const stats = ref({})

const availableYears = computed(() => stats.value.years ?? [])
const hasFilter = computed(() => statusFilter.value || yearFilter.value || search.value)

// Create modal
const showCreate = ref(false)
const creating   = ref(false)
const createErr  = ref('')
const createForm = ref({
  period_month: new Date().getMonth() + 1,
  period_year:  new Date().getFullYear(),
  notes: '',
})

// ── Computed stats (sourced from backend aggregate counts) ────────────────────
const totalBatches   = computed(() => stats.value.total     ?? 0)
const draftCount     = computed(() => stats.value.draft     ?? 0)
const confirmedCount = computed(() => stats.value.confirmed ?? 0)
const exportedCount  = computed(() => stats.value.exported  ?? 0)

const columns = [
  { key: 'batch_number',  label: 'Batch #' },
  { key: 'period',        label: 'Period' },
  { key: 'status',        label: 'Status' },
  { key: 'records_count', label: 'Drivers' },
  { key: 'confirmed_at',  label: 'Confirmed' },
  { key: 'exported_at',   label: 'Exported' },
  { key: 'actions',       label: '' },
]

// ── Summary aggregation (sub-tab) ────────────────────────────────────────────
// Groups loaded batches by year so admin gets a quick yearly breakdown without
// drilling into each batch. When a backend `/compensation/summary` endpoint is
// available, replace this client-side aggregation with the API response.
const summaryByYear = computed(() => {
  const groups = new Map()
  for (const b of batches.value) {
    const y = b.period_year
    if (!groups.has(y)) {
      groups.set(y, { year: y, total: 0, draft: 0, confirmed: 0, exported: 0, drivers: 0 })
    }
    const g = groups.get(y)
    g.total += 1
    if (b.status === 'draft')     g.draft     += 1
    if (b.status === 'confirmed') g.confirmed += 1
    if (b.status === 'exported')  g.exported  += 1
    g.drivers += Number(b.records_count) || 0
  }
  return [...groups.values()].sort((a, b) => b.year - a.year)
})

async function fetchBatches() {
  loading.value = true
  try {
    const { data } = await compensationApi.listBatches({
      status:      statusFilter.value || undefined,
      period_year: yearFilter.value   || undefined,
      q:           search.value.trim() || undefined,
      page:        page.value,
    })
    batches.value = (data.data || []).map(b => ({
      ...b,
      period:       `${String(b.period_month).padStart(2, '0')}/${b.period_year}`,
      confirmed_at: b.confirmed_at ? new Date(b.confirmed_at).toLocaleDateString('en-GB') : '—',
      exported_at:  b.exported_at  ? new Date(b.exported_at).toLocaleDateString('en-GB')  : '—',
    }))
    meta.value  = data.meta  || {}
    stats.value = data.stats || {}
  } finally {
    loading.value = false
  }
}

watch([statusFilter, yearFilter], () => { page.value = 1; fetchBatches() })

// Debounce server-side search so we don't hammer the API on every keystroke
let searchDebounce = null
watch(search, () => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    fetchBatches()
  }, 300)
})

function clearFilters() {
  statusFilter.value = ''
  yearFilter.value   = ''
  search.value       = ''
  page.value         = 1
}

async function createBatch() {
  createErr.value = ''
  creating.value = true
  try {
    await compensationApi.createBatch(createForm.value)
    showCreate.value = false
    await fetchBatches()
    toast.success('Payroll batch created successfully.', { title: 'Batch Created' })
  } catch (e) {
    createErr.value = e.response?.data?.message || 'Failed to create batch.'
    toast.error(createErr.value, { title: 'Create Failed' })
  } finally {
    creating.value = false
  }
}

function openCreate() {
  createForm.value = { period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear(), notes: '' }
  createErr.value = ''
  showCreate.value = true
}

function viewBatch(row) {
  router.push({ name: 'batch-detail', params: { id: row.id } })
}

onMounted(fetchBatches)
</script>

<template>
  <div class="bv">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="bv-banner">
      <div class="bv-banner-left">
        <div class="bv-banner-icon">
          <PayIcon :size="20" />
        </div>
        <div>
          <h1 class="bv-banner-title">Payroll</h1>
          <p class="bv-banner-sub">Driver Payroll Batches</p>
        </div>
      </div>
      <div class="bv-banner-stats">
        <div class="bv-bstat">
          <span class="bv-bstat-val">{{ loading ? '—' : totalBatches }}</span>
          <span class="bv-bstat-lbl">Total</span>
        </div>
        <div class="bv-bstat bv-bstat--amber">
          <span class="bv-bstat-val">{{ loading ? '—' : draftCount }}</span>
          <span class="bv-bstat-lbl">Draft</span>
        </div>
        <div class="bv-bstat bv-bstat--green">
          <span class="bv-bstat-val">{{ loading ? '—' : confirmedCount }}</span>
          <span class="bv-bstat-lbl">Confirmed</span>
        </div>
        <div class="bv-bstat bv-bstat--blue">
          <span class="bv-bstat-val">{{ loading ? '—' : exportedCount }}</span>
          <span class="bv-bstat-lbl">Exported</span>
        </div>
      </div>
    </div>

    <!-- ── Sub-tab nav ───────────────────────────────────────── -->
    <div class="bv-sec-nav">
      <button
        v-for="t in [
          { key: 'batches', label: 'Batches' },
          { key: 'summary', label: 'Payroll Summary' },
        ]" :key="t.key"
        :class="['bv-sec-btn', activeTab === t.key && 'bv-sec-btn--on']"
        @click="activeTab = t.key"
      >{{ t.label }}</button>
    </div>

    <!-- ── Table card ─────────────────────────────────────────── -->
    <div v-show="activeTab === 'batches'" class="bv-table-card">

      <!-- Card header -->
      <div class="bv-card-hd">
        <div>
          <p class="bv-card-title">Payroll Batches</p>
          <p class="bv-card-sub">
            <span>{{ loading ? '…' : (meta.total ?? batches.length) }} batch{{ (meta.total ?? batches.length) !== 1 ? 'es' : '' }}</span>
            <span v-if="hasFilter" class="chip chip--filter">filtered</span>
          </p>
        </div>
        <div class="bv-card-actions">
          <div class="bv-card-search">
            <SearchInput v-model="search" placeholder="Search batch # or notes…" />
          </div>
          <button class="bv-new-btn" @click="openCreate">
            <AddIcon :size="16" :stroke-width="2.5" />
            New Batch
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="bv-filter-bar">
        <span class="bv-filter-lbl">
          <FilterIcon :size="12" aria-hidden="true" />
          Filter
        </span>
        <div class="bv-seg" role="group" aria-label="Filter by status">
          <button :class="['bv-seg-btn', statusFilter === '' && 'bv-seg-btn--on']"            @click="statusFilter = ''">All</button>
          <button :class="['bv-seg-btn', statusFilter === 'draft' && 'bv-seg-btn--on']"       @click="statusFilter = 'draft'">Draft</button>
          <button :class="['bv-seg-btn', statusFilter === 'confirmed' && 'bv-seg-btn--on']"   @click="statusFilter = 'confirmed'">Confirmed</button>
          <button :class="['bv-seg-btn', statusFilter === 'exported' && 'bv-seg-btn--on']"    @click="statusFilter = 'exported'">Exported</button>
        </div>

        <div v-if="availableYears.length" class="bv-sep" />

        <div v-if="availableYears.length" class="bv-seg" role="group" aria-label="Filter by year">
          <button :class="['bv-seg-btn', yearFilter === '' && 'bv-seg-btn--on']" @click="yearFilter = ''">All Years</button>
          <button
            v-for="y in availableYears" :key="y"
            :class="['bv-seg-btn', String(yearFilter) === String(y) && 'bv-seg-btn--on']"
            @click="yearFilter = y"
          >{{ y }}</button>
        </div>

        <div class="bv-mobile-search">
          <SearchInput v-model="search" placeholder="Search batch # or notes…" />
        </div>

        <Transition name="bv-fade">
          <button v-if="hasFilter" class="bv-reset-btn" @click="clearFilters">
            <CloseIcon :size="10" :stroke-width="2.5" />
            Reset
          </button>
        </Transition>
      </div>

      <!-- Table -->
      <div class="bv-table-wrap">
        <table class="bv-tbl">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading"><td :colspan="columns.length" class="bv-empty">Loading…</td></tr>
            <tr v-else-if="batches.length === 0"><td :colspan="columns.length" class="bv-empty">No payroll batches yet.</td></tr>
            <tr v-for="row in batches" :key="row.id" class="bv-row" @click="viewBatch(row)">
              <td><span class="bv-batch-num">{{ row.batch_number }}</span></td>
              <td><span class="bv-period">{{ row.period }}</span></td>
              <td><StatusBadge :status="row.status" /></td>
              <td>
                <span class="bv-drivers-count">
                  <DriversIcon :size="14" />
                  {{ row.records_count ?? '—' }}
                </span>
              </td>
              <td class="tc-muted">{{ row.confirmed_at }}</td>
              <td class="tc-muted">{{ row.exported_at }}</td>
              <td>
                <ActionBtn tooltip="View Batch" variant="view" @click.stop="viewBatch(row)">
                  <ViewIcon :size="16" />
                </ActionBtn>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <AppPagination
        v-if="!loading && batches.length"
        :current-page="meta.current_page ?? 1"
        :last-page="meta.last_page ?? 1"
        :total="meta.total ?? 0"
        :from="meta.from ?? 0"
        :to="meta.to ?? 0"
        always
        @change="p => { page = p; fetchBatches() }"
      />

      <!-- Mobile cards -->
      <div class="bv-cards">
        <div v-if="loading" class="bv-empty">Loading…</div>
        <div v-else-if="batches.length === 0" class="bv-empty">No payroll batches yet.</div>
        <div
          v-for="row in batches" :key="row.id"
          class="bv-card" @click="viewBatch(row)"
        >
          <div class="bv-card-top">
            <span class="bv-batch-num">{{ row.batch_number }}</span>
            <StatusBadge :status="row.status" />
          </div>
          <div class="bv-card-meta">
            <span><span class="bv-m-key">Period</span>{{ row.period }}</span>
            <span><span class="bv-m-key">Drivers</span>{{ row.records_count ?? '—' }}</span>
            <span v-if="row.confirmed_at !== '—'"><span class="bv-m-key">Confirmed</span>{{ row.confirmed_at }}</span>
            <span v-if="row.exported_at !== '—'"><span class="bv-m-key">Exported</span>{{ row.exported_at }}</span>
          </div>
        </div>
      </div>

    </div>

    <!-- ── Summary tab ────────────────────────────────────────── -->
    <div v-show="activeTab === 'summary'" class="bv-table-card">
      <div class="bv-card-hd">
        <div>
          <p class="bv-card-title">Payroll Summary</p>
          <p class="bv-card-sub">
            <span>Yearly aggregation across {{ batches.length }} loaded batch{{ batches.length !== 1 ? 'es' : '' }}</span>
          </p>
        </div>
      </div>

      <div v-if="loading" class="bv-empty">Loading…</div>
      <div v-else-if="summaryByYear.length === 0" class="bv-empty">No batches to summarise yet.</div>

      <div v-else class="bv-table-wrap">
        <table class="bv-tbl">
          <thead>
            <tr>
              <th>Year</th>
              <th>Total Batches</th>
              <th>Draft</th>
              <th>Confirmed</th>
              <th>Exported</th>
              <th>Driver Records</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryByYear" :key="row.year">
              <td><span class="bv-period">{{ row.year }}</span></td>
              <td>{{ row.total }}</td>
              <td><span class="bv-sum-pill bv-sum-pill--amber">{{ row.draft }}</span></td>
              <td><span class="bv-sum-pill bv-sum-pill--green">{{ row.confirmed }}</span></td>
              <td><span class="bv-sum-pill bv-sum-pill--blue">{{ row.exported }}</span></td>
              <td>
                <span class="bv-drivers-count">
                  <DriversIcon :size="14" />
                  {{ row.drivers }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div v-if="!loading && summaryByYear.length" class="bv-cards">
        <div v-for="row in summaryByYear" :key="row.year" class="bv-card">
          <div class="bv-card-top">
            <span class="bv-period">{{ row.year }}</span>
            <span class="bv-drivers-count">
              <DriversIcon :size="14" />
              {{ row.drivers }}
            </span>
          </div>
          <div class="bv-card-meta">
            <span><span class="bv-m-key">Total</span>{{ row.total }}</span>
            <span><span class="bv-m-key">Draft</span>{{ row.draft }}</span>
            <span><span class="bv-m-key">Confirmed</span>{{ row.confirmed }}</span>
            <span><span class="bv-m-key">Exported</span>{{ row.exported }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Create Modal ────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showCreate" class="bv-overlay" @click.self="showCreate = false">
        <div class="bv-modal">
          <div class="bv-modal-hd">
            <div class="bv-modal-icon">
              <CalendarIcon :size="20" />
            </div>
            <div>
              <h2 class="bv-modal-title">New Payroll Batch</h2>
              <p class="bv-modal-sub">Generate compensation records for a period</p>
            </div>
            <button class="bv-modal-close" @click="showCreate = false">✕</button>
          </div>
          <form class="bv-modal-body" @submit.prevent="createBatch">
            <p class="bv-field-hint">Select the payroll period this batch covers. One batch per month.</p>
            <div class="bv-fields-row">
              <div class="bv-field">
                <label class="bv-label">Month</label>
                <select v-model.number="createForm.period_month" class="bv-input">
                  <option v-for="m in 12" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
                </select>
              </div>
              <div class="bv-field">
                <label class="bv-label">Year</label>
                <input v-model.number="createForm.period_year" type="number" min="2020" max="2099" class="bv-input" />
              </div>
            </div>
            <div class="bv-field">
              <label class="bv-label">Notes <span class="bv-optional">(optional)</span></label>
              <textarea v-model="createForm.notes" rows="2" class="bv-textarea" placeholder="Any remarks for this batch…" />
            </div>
            <p v-if="createErr" class="bv-form-err">{{ createErr }}</p>
            <div class="bv-modal-foot">
              <button type="button" class="bv-btn-ghost" @click="showCreate = false">Cancel</button>
              <button type="submit" class="bv-btn-primary" :disabled="creating">
                {{ creating ? 'Generating…' : 'Generate Batch' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.bv { min-width: 0; overflow: hidden; }

/* ── Banner ──────────────────────────────────────────────────── */
.bv-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 20px;
  position: relative; overflow: hidden;
}
.bv-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--c-green); border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .bv-banner { padding: 18px 24px; margin-bottom: 24px; } }

.bv-banner-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.bv-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-green); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.bv-banner-icon svg { width: 20px; height: 20px; }
.bv-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.02em; margin-bottom: 1px; }
@media (min-width: 640px) { .bv-banner-title { font-size: 1.25rem; } }
.bv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.bv-banner-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bv-bstat {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 14px; border-radius: var(--r-lg); min-width: 52px;
  background: var(--c-bg); border: 1px solid var(--c-border-light);
}
.bv-bstat-val { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--c-text-1); }
.bv-bstat-lbl { font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-3); margin-top: 3px; }
.bv-bstat--amber .bv-bstat-val { color: var(--c-amber); }
.bv-bstat--green .bv-bstat-val { color: var(--c-green); }
.bv-bstat--blue  .bv-bstat-val { color: var(--c-accent); }

/* ── Sub-tab nav ─────────────────────────────────────────────── */
.bv-sec-nav {
  display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 16px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); padding: 6px; box-shadow: var(--sh-xs);
}
.bv-sec-btn {
  padding: 6px 16px; border-radius: var(--r-lg); font-size: 0.875rem; font-weight: 500;
  color: var(--c-text-3); background: transparent; border: none; cursor: pointer;
  transition: all var(--dur); white-space: nowrap;
}
.bv-sec-btn:hover:not(.bv-sec-btn--on) { color: var(--c-text-1); background: var(--c-bg); }
.bv-sec-btn--on { background: var(--c-green-tint); color: var(--c-green); font-weight: 600; }

/* Summary pills */
.bv-sum-pill {
  display: inline-flex; padding: 2px 10px; border-radius: var(--r-full);
  font-size: 0.75rem; font-weight: 600; font-variant-numeric: tabular-nums;
}
.bv-sum-pill--amber { background: var(--c-amber-tint);  color: var(--c-amber);  }
.bv-sum-pill--green { background: var(--c-green-tint);  color: var(--c-green);  }
.bv-sum-pill--blue  { background: var(--c-accent-tint); color: var(--c-accent); }

/* ── Table card ──────────────────────────────────────────────── */
.bv-table-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm); overflow: hidden;
}
.bv-card-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 20px; border-bottom: 1px solid var(--c-border-light);
}
@media (max-width: 767px) { .bv-card-hd { padding: 12px 14px; } }
.bv-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); letter-spacing: -0.01em; }
.bv-card-sub { font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px; display: flex; align-items: center; gap: 5px; }

.bv-new-btn {
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
  background: var(--c-green); color: #fff; border: none; border-radius: 8px;
  padding: 8px 14px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: opacity var(--dur); white-space: nowrap;
}
.bv-new-btn svg { width: 14px; height: 14px; }
.bv-new-btn:hover { opacity: 0.88; }

.bv-card-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.bv-card-search  { width: 220px; }
@media (max-width: 767px) { .bv-card-search { display: none; } }

.bv-mobile-search { display: none; }
@media (max-width: 767px) {
  .bv-mobile-search { display: block; width: 100%; margin-top: 4px; }
}

.bv-sep { width: 1px; height: 24px; background: var(--c-border); flex-shrink: 0; margin: 0 2px; }
@media (max-width: 640px) { .bv-sep { display: none; } }

/* Filter bar */
.bv-filter-bar {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 10px 20px; border-bottom: 1px solid var(--c-border-light);
}
@media (max-width: 767px) { .bv-filter-bar { padding: 10px 14px; } }
/* FILTER label always on its own row — baseline for the whole system */
.bv-filter-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c-text-3);
  width: 100%; margin-bottom: 4px;
}
.bv-filter-lbl svg { width: 12px; height: 12px; }
.bv-seg {
  display: inline-flex; background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-full); padding: 3px; gap: 2px;
}
.bv-seg-btn {
  padding: 4px 12px; border-radius: var(--r-full); font-size: 0.8125rem; font-weight: 500;
  color: var(--c-text-3); background: transparent; border: none; cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.bv-seg-btn:hover:not(.bv-seg-btn--on) { background: var(--c-surface); color: var(--c-text-1); }
.bv-seg-btn--on { background: var(--c-surface); color: var(--c-accent); font-weight: 600; box-shadow: var(--sh-xs); }

.bv-reset-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur); flex-shrink: 0;
}
.bv-reset-btn svg { width: 10px; height: 10px; }
.bv-reset-btn:hover { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }

.bv-fade-enter-active, .bv-fade-leave-active { transition: opacity 150ms, transform 150ms; }
.bv-fade-enter-from, .bv-fade-leave-to { opacity: 0; transform: scale(0.85); }

/* Table (desktop) */
.bv-table-wrap { overflow-x: auto; }
@media (max-width: 767px) { .bv-table-wrap { display: none; } }
.bv-tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.bv-tbl thead tr { border-bottom: 1px solid var(--c-border); }
.bv-tbl th {
  padding: 10px 16px; text-align: left;
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-text-3);
  white-space: nowrap; background: var(--c-bg);
}
.bv-tbl td { padding: 12px 16px; border-bottom: 1px solid var(--c-border-light); vertical-align: middle; }
.bv-row { cursor: pointer; transition: background var(--dur); }
.bv-row:hover td { background: var(--c-bg); }
.bv-row:last-child td { border-bottom: none; }
.bv-empty { padding: 40px 16px; text-align: center; color: var(--c-text-3); font-size: 0.875rem; }
.bv-batch-num { font-weight: 600; color: var(--c-accent); font-size: 0.875rem; }
.bv-period { font-variant-numeric: tabular-nums; font-weight: 500; color: var(--c-text-1); }
.bv-drivers-count {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 0.875rem; font-weight: 500; color: var(--c-text-2);
}
.bv-drivers-count svg { width: 14px; height: 14px; color: var(--c-text-3); }
.tc-muted { color: var(--c-text-3); font-size: 0.8125rem; }

/* Mobile cards */
.bv-cards { display: none; padding: 12px; gap: 10px; flex-direction: column; }
@media (max-width: 767px) { .bv-cards { display: flex; } }
.bv-card {
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-lg); padding: 14px; cursor: pointer; transition: box-shadow var(--dur);
}
.bv-card:hover { box-shadow: var(--sh-sm); }
.bv-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.bv-card-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 0.8125rem; color: var(--c-text-2); }
.bv-m-key { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-3); margin-right: 5px; }

/* ── Modal ───────────────────────────────────────────────────── */
.bv-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.bv-modal {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 18px; width: 100%; max-width: 460px;
  box-shadow: var(--sh-xl); overflow: hidden;
}
.bv-modal-hd {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 20px 20px 16px; border-bottom: 1px solid var(--c-border-light);
}
.bv-modal-icon {
  width: 38px; height: 38px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-green-tint); border: 1.5px solid rgba(22,163,74,0.15);
  display: flex; align-items: center; justify-content: center; color: var(--c-green);
}
.bv-modal-icon svg { width: 18px; height: 18px; }
.bv-modal-title { font-size: 1rem; font-weight: 700; color: var(--c-text-1); }
.bv-modal-sub { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 1px; }
.bv-modal-close { margin-left: auto; flex-shrink: 0; background: none; border: none; cursor: pointer; color: var(--c-text-3); font-size: 1rem; padding: 4px; transition: color var(--dur); }
.bv-modal-close:hover { color: var(--c-text-1); }
.bv-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; }
.bv-modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

.bv-fields-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.bv-field { display: flex; flex-direction: column; gap: 5px; }
.bv-label { font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2); }
.bv-optional { font-weight: 400; color: var(--c-text-3); }
.bv-input, .bv-textarea {
  width: 100%; padding: 8px 12px; border: 1px solid var(--c-border);
  border-radius: 8px; background: var(--c-bg); color: var(--c-text-1);
  font-size: 0.875rem; transition: border-color var(--dur); box-sizing: border-box;
}
.bv-input:focus, .bv-textarea:focus { outline: none; border-color: var(--c-green); box-shadow: 0 0 0 3px rgba(22,163,74,0.12); }
.bv-textarea { resize: vertical; font-family: inherit; }
.bv-field-hint { font-size: 0.75rem; color: var(--c-text-3); }
.bv-form-err { font-size: 0.8125rem; color: var(--c-red); background: var(--c-red-tint); padding: 8px 12px; border-radius: 8px; }

.bv-btn-primary {
  background: var(--c-green); color: #fff; border: none; border-radius: 8px;
  padding: 8px 18px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: opacity var(--dur);
}
.bv-btn-primary:hover:not(:disabled) { opacity: 0.88; }
.bv-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.bv-btn-ghost {
  background: transparent; color: var(--c-text-2); border: 1px solid var(--c-border);
  border-radius: 8px; padding: 8px 16px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all var(--dur);
}
.bv-btn-ghost:hover { border-color: var(--c-text-2); color: var(--c-text-1); }
</style>
