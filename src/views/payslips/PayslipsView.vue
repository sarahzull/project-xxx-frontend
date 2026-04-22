<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  PayslipIcon, PayIcon, TruckIcon, RouteIcon,
  CloseIcon, ViewIcon, CheckCircleIcon, ClockIcon, ExportIcon,
  FilterIcon,
} from '../../components/icons/index.js'
import driverMeApi from '../../api/driverMe'
import ModalSheet from '../../components/common/ModalSheet.vue'
import MonthYearPicker from '../../components/common/MonthYearPicker.vue'

// ── State ─────────────────────────────────────────────────────────────────────
const payslips = ref([])
const loading  = ref(true)
const error    = ref('')

// Filter: single month+year, 'YYYY-MM' or '' for all
const filterPeriod = ref('')

// Detail modal
const showDetail = ref(false)
const detail     = ref(null)
const detailLoading = ref(false)

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRM(v) {
  return `RM ${(v || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function periodLabel(p) {
  if (!p) return '—'
  const [y, m] = String(p).split('-')
  if (!m) return p
  const names = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December']
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

// ── Computed ──────────────────────────────────────────────────────────────────
// Derive a 'YYYY-MM' key for a payslip — falls back to the period_year/period_month composite.
function payslipPeriod(p) {
  if (p.batch_period) return String(p.batch_period).slice(0, 7)
  if (p.period_year && p.period_month) {
    return `${p.period_year}-${String(p.period_month).padStart(2, '0')}`
  }
  return ''
}

const filteredPayslips = computed(() => {
  if (!filterPeriod.value) return payslips.value
  return payslips.value.filter(p => payslipPeriod(p) === filterPeriod.value)
})

const totalPaid = computed(() =>
  filteredPayslips.value
    .filter(p => p.status !== 'draft')
    .reduce((s, p) => s + (p.total_amount || 0), 0)
)

// ── Fetch ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = await driverMeApi.payslips()
    payslips.value = res.data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load payslips.'
  } finally {
    loading.value = false
  }
})

async function openDetail(p) {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    const res = await driverMeApi.payslip(p.id)
    detail.value = res.data.data
  } catch {
    detail.value = p   // fallback to list data
  } finally {
    detailLoading.value = false
  }
}
</script>

<template>
  <div class="ps">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="ps-hdr">
      <div class="ps-hdr-icon"><PayslipIcon :size="20" /></div>
      <div>
        <h1 class="ps-title">My Payslips</h1>
        <p class="ps-sub">Monthly compensation statements</p>
      </div>
    </div>

    <!-- ── Error ──────────────────────────────────────────────────────────── -->
    <div v-if="error" class="ps-error">
      <CloseIcon :size="16" />{{ error }}
    </div>

    <!-- ── Loading ────────────────────────────────────────────────────────── -->
    <div v-else-if="loading" class="ps-loading">
      <div class="ps-spinner" /><span>Loading payslips…</span>
    </div>

    <template v-else>

      <!-- Summary banner -->
      <div v-if="payslips.length" class="ps-banner">
        <div class="ps-banner-item">
          <span class="ps-banner-lbl">Total Payslips</span>
          <span class="ps-banner-val">{{ filteredPayslips.length }}</span>
        </div>
        <div class="ps-banner-item">
          <span class="ps-banner-lbl">Total Paid (confirmed)</span>
          <span class="ps-banner-val green">{{ formatRM(totalPaid) }}</span>
        </div>
      </div>

      <!-- Filter bar — mirrors the Communications filter bar pattern -->
      <div v-if="payslips.length" class="ps-filter-bar">
        <span class="ps-filter-lbl">
          <FilterIcon :size="12" aria-hidden="true" />
          Filter
        </span>
        <MonthYearPicker v-model="filterPeriod" aria-label="Filter payslips by period" />
        <Transition name="ps-fade">
          <button v-if="filterPeriod" class="ps-clear-btn" @click="filterPeriod = ''">
            <CloseIcon :size="10" :stroke-width="2.5" />
            Reset
          </button>
        </Transition>
      </div>

      <!-- ── Empty ──────────────────────────────────────────────────────── -->
      <div v-if="!payslips.length" class="ps-empty">
        <PayslipIcon :size="36" :stroke-width="1.2" />
        <p>No payslips available yet</p>
      </div>
      <div v-else-if="!filteredPayslips.length" class="ps-empty">
        <PayslipIcon :size="36" :stroke-width="1.2" />
        <p>No payslips for this period</p>
      </div>

      <!-- ── Payslip cards ──────────────────────────────────────────────── -->
      <div v-else class="ps-list">
        <div
          v-for="p in filteredPayslips"
          :key="p.id"
          class="ps-card"
          @click="openDetail(p)"
        >
          <!-- Card header -->
          <div class="ps-card-hd">
            <div class="ps-card-period">
              <PayslipIcon :size="16" class="ps-card-period-icon" />
              <span>{{ periodLabel(p.batch_period || `${p.period_year}-${String(p.period_month).padStart(2,'0')}`) }}</span>
            </div>
            <div :class="['ps-badge', `ps-badge--${p.status}`]">
              <CheckCircleIcon v-if="p.status === 'exported'" :size="12" />
              <CheckCircleIcon v-else-if="p.status === 'confirmed'" :size="12" />
              <ClockIcon v-else :size="12" />
              {{ p.status }}
            </div>
          </div>

          <!-- Card stats row -->
          <div class="ps-card-stats">
            <div class="ps-cs">
              <TruckIcon :size="13" />
              <span class="ps-cs-val">{{ p.total_trips || 0 }}</span>
              <span class="ps-cs-lbl">trips</span>
            </div>
            <div class="ps-cs">
              <RouteIcon :size="13" />
              <span class="ps-cs-val">{{ (p.total_km || 0).toLocaleString() }}</span>
              <span class="ps-cs-lbl">km</span>
            </div>
            <div class="ps-cs ps-cs--right">
              <PayIcon :size="13" />
              <span class="ps-cs-total">{{ formatRM(p.total_amount) }}</span>
            </div>
          </div>

          <!-- Breakdown row -->
          <div class="ps-card-breakdown">
            <div class="ps-bk">
              <span class="ps-bk-lbl">Base pay</span>
              <span class="ps-bk-val mono">{{ formatRM(p.base_amount) }}</span>
            </div>
            <div v-if="p.special_notes_amount" class="ps-bk">
              <span class="ps-bk-lbl">Special notes</span>
              <span class="ps-bk-val mono green">+ {{ formatRM(p.special_notes_amount) }}</span>
            </div>
            <div v-if="p.hardship_amount" class="ps-bk">
              <span class="ps-bk-lbl">Hardship</span>
              <span class="ps-bk-val mono green">+ {{ formatRM(p.hardship_amount) }}</span>
            </div>
          </div>

          <!-- View hint -->
          <div class="ps-card-foot">
            <ViewIcon :size="13" />
            View details
          </div>
        </div>
      </div>

    </template>

    <!-- ── Detail modal ───────────────────────────────────────────────────── -->
    <ModalSheet
      v-model="showDetail"
      :title="detail ? periodLabel(detail.batch_period || `${detail.period_year}-${String(detail.period_month).padStart(2,'0')}`) : 'Payslip'"
      subtitle="Compensation statement"
      max-width="520px"
    >
      <template #icon>
        <div class="ms-icon"><PayslipIcon :size="18" /></div>
      </template>

      <div class="ps-detail">
        <div v-if="detailLoading" class="ps-detail-loading">
          <div class="ps-spinner" />
        </div>

        <template v-else-if="detail">
          <!-- Status -->
          <div class="ps-detail-status">
            <div :class="['ps-badge', `ps-badge--${detail.status}`]">
              <CheckCircleIcon v-if="detail.status !== 'draft'" :size="13" />
              <ClockIcon v-else :size="13" />
              {{ detail.status }}
            </div>
          </div>

          <!-- Performance -->
          <p class="ps-detail-section">Performance</p>
          <div class="ps-detail-grid">
            <div class="ps-dg">
              <span class="ps-dg-lbl">Total Trips</span>
              <span class="ps-dg-val mono">{{ detail.total_trips || 0 }}</span>
            </div>
            <div class="ps-dg">
              <span class="ps-dg-lbl">Total KM</span>
              <span class="ps-dg-val mono">{{ (detail.total_km || 0).toLocaleString() }} km</span>
            </div>
          </div>

          <!-- Earnings breakdown -->
          <p class="ps-detail-section">Earnings Breakdown</p>
          <div class="ps-detail-rows">
            <div class="ps-dr">
              <span class="ps-dr-lbl">Base Pay</span>
              <span class="ps-dr-val mono">{{ formatRM(detail.base_amount) }}</span>
            </div>
            <div v-if="detail.special_notes_amount" class="ps-dr">
              <span class="ps-dr-lbl">Special Notes Allowance</span>
              <span class="ps-dr-val mono green">+ {{ formatRM(detail.special_notes_amount) }}</span>
            </div>
            <div v-if="detail.hardship_amount" class="ps-dr">
              <span class="ps-dr-lbl">Hardship Allowance</span>
              <span class="ps-dr-val mono green">+ {{ formatRM(detail.hardship_amount) }}</span>
            </div>
            <div class="ps-dr ps-dr--total">
              <span class="ps-dr-lbl">Total</span>
              <span class="ps-dr-val mono">{{ formatRM(detail.total_amount) }}</span>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="detail.notes" class="ps-detail-notes">
            <p class="ps-detail-notes-lbl">Notes</p>
            <p class="ps-detail-notes-val">{{ detail.notes }}</p>
          </div>
        </template>
      </div>
    </ModalSheet>

  </div>
</template>

<style scoped>
.ps { display: flex; flex-direction: column; gap: 1rem; }

/* Header */
.ps-hdr { display: flex; align-items: center; gap: 0.875rem; }
.ps-hdr-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: #1D4ED8; color: #fff;
  display: grid; place-items: center; flex-shrink: 0;
}
.ps-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text); margin: 0 0 2px; }
.ps-sub   { font-size: 0.78rem; color: var(--c-text-2); margin: 0; }

/* Loading / Error */
.ps-loading {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 3rem; color: var(--c-text-2);
}
.ps-spinner {
  width: 18px; height: 18px; border: 2px solid var(--c-border);
  border-top-color: #1D4ED8; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.ps-error {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.875rem 1rem; border-radius: 10px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #EF4444; font-size: 0.875rem;
}

/* Banner */
.ps-banner {
  display: flex; gap: 1.5rem; align-items: center;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px; padding: 0.875rem 1.25rem;
}
.ps-banner-item { display: flex; flex-direction: column; gap: 2px; }
.ps-banner-lbl  { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--c-text-2); }
.ps-banner-val  { font-size: 1.1rem; font-weight: 700; color: var(--c-text); }
.ps-banner-val.green { color: #16A34A; }

/* Filter bar — matches the Communications filter bar pattern for consistency */
.ps-filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 12px;
}
.ps-filter-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--c-text-3);
  width: 100%;
  margin-bottom: 4px;
}
.ps-clear-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: 999px;
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur); flex-shrink: 0;
}
.ps-clear-btn:hover {
  border-color: var(--c-red, #EF4444);
  color: var(--c-red, #EF4444);
}
.ps-fade-enter-active, .ps-fade-leave-active { transition: opacity var(--dur); }
.ps-fade-enter-from, .ps-fade-leave-to { opacity: 0; }

/* Empty */
.ps-empty {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 3rem; color: var(--c-text-2); font-size: 0.875rem;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
}
.ps-empty svg { opacity: 0.35; }

/* Payslip list */
.ps-list { display: flex; flex-direction: column; gap: 0.75rem; }

/* Payslip card */
.ps-card {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
  overflow: hidden; cursor: pointer;
  transition: box-shadow 0.2s, border-color 0.2s, transform 0.15s;
}
.ps-card:hover {
  box-shadow: 0 4px 18px rgba(0,0,0,0.09);
  border-color: rgba(29,78,216,0.35);
  transform: translateY(-1px);
}

.ps-card-hd {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1.1rem; border-bottom: 1px solid var(--c-border);
}
.ps-card-period {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.95rem; font-weight: 700; color: var(--c-text);
}
.ps-card-period-icon { color: #1D4ED8; }

/* Status badges */
.ps-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.6rem; border-radius: 20px;
  font-size: 0.72rem; font-weight: 700; text-transform: capitalize;
}
.ps-badge--draft     { background: rgba(100,116,139,0.12); color: var(--c-text-2); }
.ps-badge--confirmed { background: rgba(29,78,216,0.1);    color: #1D4ED8; }
.ps-badge--exported  { background: rgba(22,163,74,0.1);    color: #16A34A; }

/* Card stats */
.ps-card-stats {
  display: flex; align-items: center; gap: 1.25rem;
  padding: 0.75rem 1.1rem; border-bottom: 1px solid var(--c-border);
}
.ps-cs {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.84rem; color: var(--c-text-2);
}
.ps-cs svg { color: var(--c-text-2); flex-shrink: 0; }
.ps-cs-val { font-weight: 600; color: var(--c-text); font-family: monospace; }
.ps-cs-lbl { font-size: 0.74rem; }
.ps-cs--right { margin-left: auto; }
.ps-cs-total { font-size: 1rem; font-weight: 700; color: #16A34A; font-family: monospace; }

/* Breakdown */
.ps-card-breakdown {
  display: flex; flex-wrap: wrap; gap: 0.4rem 1.5rem;
  padding: 0.65rem 1.1rem; border-bottom: 1px solid var(--c-border);
}
.ps-bk { display: flex; align-items: center; gap: 0.4rem; }
.ps-bk-lbl { font-size: 0.72rem; color: var(--c-text-2); }
.ps-bk-val { font-size: 0.78rem; font-weight: 600; color: var(--c-text); }
.ps-bk-val.green { color: #16A34A; }

/* Card footer */
.ps-card-foot {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.5rem 1.1rem; font-size: 0.74rem; color: var(--c-text-2);
}
.ps-card-foot svg { flex-shrink: 0; }

/* ── Detail modal ─────────────────────────────────────────────────────────────── */
.ms-icon {
  width: 34px; height: 34px; border-radius: 9px;
  background: #1D4ED8; color: #fff;
  display: grid; place-items: center; flex-shrink: 0;
}
.ps-detail { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
.ps-detail-loading {
  display: flex; justify-content: center; padding: 2rem;
}
.ps-detail-status { display: flex; }
.ps-detail-section {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: var(--c-text-2); margin: 0.75rem 0 0.4rem;
}
.ps-detail-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;
  background: var(--c-bg); border-radius: 10px; padding: 0.75rem 1rem;
}
.ps-dg { display: flex; flex-direction: column; gap: 3px; }
.ps-dg-lbl { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--c-text-2); }
.ps-dg-val { font-size: 0.875rem; font-weight: 600; color: var(--c-text); }

.ps-detail-rows {
  background: var(--c-bg); border-radius: 10px; overflow: hidden;
  border: 1px solid var(--c-border);
}
.ps-dr {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 1rem; border-bottom: 1px solid var(--c-border);
}
.ps-dr:last-child { border-bottom: none; }
.ps-dr--total { background: var(--c-surface); }
.ps-dr--total .ps-dr-lbl { font-weight: 700; color: var(--c-text); }
.ps-dr--total .ps-dr-val { font-size: 1rem; font-weight: 700; color: #16A34A; }
.ps-dr-lbl { font-size: 0.84rem; color: var(--c-text-2); }
.ps-dr-val { font-size: 0.875rem; font-weight: 600; color: var(--c-text); }
.ps-dr-val.green { color: #16A34A; }

.ps-detail-notes {
  background: var(--c-bg); border-radius: 10px; padding: 0.75rem 1rem;
  border: 1px solid var(--c-border);
}
.ps-detail-notes-lbl { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--c-text-2); margin: 0 0 4px; }
.ps-detail-notes-val { font-size: 0.875rem; color: var(--c-text); margin: 0; }

/* Helpers */
.mono  { font-family: 'JetBrains Mono', monospace; }
.green { color: #16A34A; }

@media (max-width: 640px) {
  .ps-card-breakdown { flex-direction: column; gap: 0.3rem; }
}
@media (max-width: 360px) {
  .ps-detail-grid {
    grid-template-columns: 1fr;
  }

  .ps-dr {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>
