<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import compensationApi from '../../api/compensation'
import tripsApi        from '../../api/trips'
import { useToast } from '../../composables/useToast'
import StatusBadge     from '../../components/common/StatusBadge.vue'
import ActionBtn       from '../../components/common/ActionBtn.vue'
import SearchInput     from '../../components/common/SearchInput.vue'
import AppPagination   from '../../components/common/AppPagination.vue'
import DateRangePicker from '../../components/common/DateRangePicker.vue'
import {
  ChevronLeftIcon, BatchIcon, CheckIcon, ExportIcon, CloseIcon, EditIcon,
  CalendarIcon,
} from '../../components/icons/index.js'

const props  = defineProps({ id: { type: [String, Number], required: true } })
const router = useRouter()
const toast  = useToast()

const batch         = ref(null)
const records       = ref([])
const loading       = ref(true)
const actionLoading = ref(false)
const editingRecord = ref(null)
const editForm      = ref({ hardship_allowance: 0, remarks: '' })

// ── Edit-window timeline state ───────────────────────────────────────────────
// Admin can configure a date range (edit_window_start..edit_window_end) during
// which a draft batch may still be modified. Outside that window the batch is
// effectively locked even if its status is still 'draft'.
const editingWindow = ref(false)
const windowSaving  = ref(false)
const windowForm    = ref({ edit_window_start: '', edit_window_end: '' })

const todayISO = computed(() => new Date().toISOString().slice(0, 10))

const isWithinEditWindow = computed(() => {
  const s = batch.value?.edit_window_start
  const e = batch.value?.edit_window_end
  // No window configured → fall back to draft-status gating only.
  if (!s && !e) return true
  const t = todayISO.value
  if (s && t < s) return false
  if (e && t > e) return false
  return true
})

const canEdit = computed(() =>
  batch.value?.status === 'draft' && isWithinEditWindow.value
)

const windowProgress = computed(() => {
  const s = batch.value?.edit_window_start
  const e = batch.value?.edit_window_end
  if (!s || !e) return 0
  const start = new Date(s).getTime()
  const end   = new Date(e).getTime()
  const today = new Date(todayISO.value).getTime()
  if (end <= start) return 100
  if (today <= start) return 0
  if (today >= end)   return 100
  return Math.round(((today - start) / (end - start)) * 100)
})

const windowStatusLabel = computed(() => {
  const s = batch.value?.edit_window_start
  const e = batch.value?.edit_window_end
  if (!s && !e) return 'No edit window set'
  const t = todayISO.value
  if (s && t < s) {
    const days = Math.ceil((new Date(s) - new Date(t)) / 86400000)
    return `Opens in ${days} day${days !== 1 ? 's' : ''}`
  }
  if (e && t > e) return 'Edit window closed'
  if (e) {
    const days = Math.ceil((new Date(e) - new Date(t)) / 86400000)
    return `${days} day${days !== 1 ? 's' : ''} remaining`
  }
  return 'Open for edits'
})

function formatWindowDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

function startEditWindow() {
  windowForm.value = {
    edit_window_start: batch.value?.edit_window_start || '',
    edit_window_end:   batch.value?.edit_window_end   || '',
  }
  editingWindow.value = true
}

function cancelEditWindow() {
  editingWindow.value = false
}

async function saveEditWindow() {
  if (windowForm.value.edit_window_start && windowForm.value.edit_window_end &&
      windowForm.value.edit_window_end < windowForm.value.edit_window_start) {
    toast.error('End date must be on or after start date.', { title: 'Invalid Range' })
    return
  }
  windowSaving.value = true
  try {
    await compensationApi.updateBatch(props.id, windowForm.value)
    await fetchData()
    editingWindow.value = false
    toast.success('Edit window updated.', { title: 'Window Saved' })
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to update edit window.', { title: 'Save Failed' })
  } finally {
    windowSaving.value = false
  }
}

// Allowance breakdown drives the dedicated Allowance column + modal. Adding a
// new allowance type later means appending a row here.
const ALLOWANCE_FIELDS = [
  { key: 'diversion_allowance', label: 'Diversion' },
  { key: 'ron97_allowance',     label: 'RON97' },
  { key: 'others_allowance',    label: 'Others' },
  { key: 'hardship_allowance',  label: 'Hardship' },
]

function allowanceTotal(record) {
  return ALLOWANCE_FIELDS.reduce((s, f) => s + (Number(record?.[f.key]) || 0), 0)
}
function allowanceItems(record) {
  return ALLOWANCE_FIELDS.map(f => ({
    label:    f.label,
    key:      f.key,
    amount:   Number(record?.[f.key]) || 0,
    editable: f.key === 'hardship_allowance',
  }))
}

// ── Computed totals ───────────────────────────────────────────────────────────
const totalDrivers      = computed(() => records.value.length)
const totalTrips        = computed(() => records.value.reduce((s, r) => s + (Number(r.total_trips) || 0), 0))
const totalKm           = computed(() => records.value.reduce((s, r) => s + (Number(r.total_km_driven) || 0), 0))
const totalCompensation = computed(() => records.value.reduce((s, r) => s + (Number(r.total_compensation) || 0), 0))

const columns = [
  { key: 'driver',                 label: 'Driver' },
  { key: 'total_trips',            label: 'Trips' },
  { key: 'total_km_driven',        label: 'KM' },
  { key: 'base_trip_compensation', label: 'Base (RM)' },
  { key: 'allowance',              label: 'Allowance (RM)' },
  { key: 'total_compensation',     label: 'Total (RM)' },
  { key: 'remarks',                label: 'Remark' },
  { key: 'actions',                label: '' },
]

// ── Search + pagination on the records table ─────────────────────────────────
const recordSearch = ref('')
const recordPage   = ref(1)
const PER_PAGE     = 15

const filteredRecords = computed(() => {
  const q = recordSearch.value.trim().toLowerCase()
  if (!q) return records.value
  return records.value.filter(r =>
    String(r.driver_id || '').toLowerCase().includes(q) ||
    String(r.driver_name || '').toLowerCase().includes(q)
  )
})
const lastPage = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / PER_PAGE)))
const pagedRecords = computed(() => {
  const start = (recordPage.value - 1) * PER_PAGE
  return filteredRecords.value.slice(start, start + PER_PAGE)
})
const pageFrom = computed(() => filteredRecords.value.length === 0 ? 0 : (recordPage.value - 1) * PER_PAGE + 1)
const pageTo   = computed(() => Math.min(recordPage.value * PER_PAGE, filteredRecords.value.length))
watch(recordSearch, () => { recordPage.value = 1 })

// ── Trips modal (driver × payroll month) ────────────────────────────────────
const tripsModalRecord  = ref(null)
const tripsModalTrips   = ref([])
const tripsModalLoading = ref(false)
const tripsModalSearch  = ref('')
const tripsModalPage    = ref(1)
const TRIPS_MODAL_PER_PAGE = 10

const tripsModalPeriod = computed(() => {
  if (!batch.value) return ''
  return `${String(batch.value.period_month).padStart(2, '0')}/${batch.value.period_year}`
})

const tripsModalFiltered = computed(() => {
  const q = tripsModalSearch.value.trim().toLowerCase()
  if (!q) return tripsModalTrips.value
  return tripsModalTrips.value.filter(t =>
    String(t.delivery_note || '').toLowerCase().includes(q) ||
    String(t.road_tanker_id || '').toLowerCase().includes(q) ||
    String(t.location || '').toLowerCase().includes(q) ||
    String(t.ship_to_party_name || '').toLowerCase().includes(q) ||
    String(t.material || '').toLowerCase().includes(q) ||
    String(t.oil_company || '').toLowerCase().includes(q)
  )
})
const tripsModalLastPage = computed(() => Math.max(1, Math.ceil(tripsModalFiltered.value.length / TRIPS_MODAL_PER_PAGE)))
const tripsModalPaged = computed(() => {
  const start = (tripsModalPage.value - 1) * TRIPS_MODAL_PER_PAGE
  return tripsModalFiltered.value.slice(start, start + TRIPS_MODAL_PER_PAGE)
})
const tripsModalFrom = computed(() =>
  tripsModalFiltered.value.length === 0 ? 0 : (tripsModalPage.value - 1) * TRIPS_MODAL_PER_PAGE + 1
)
const tripsModalTo = computed(() =>
  Math.min(tripsModalPage.value * TRIPS_MODAL_PER_PAGE, tripsModalFiltered.value.length)
)
watch(tripsModalSearch, () => { tripsModalPage.value = 1 })

function formatTripDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s
}

async function openTripsModal(record) {
  if (!batch.value) return
  tripsModalRecord.value  = record
  tripsModalSearch.value  = ''
  tripsModalPage.value    = 1
  tripsModalTrips.value   = []
  tripsModalLoading.value = true
  try {
    const y = batch.value.period_year
    const m = String(batch.value.period_month).padStart(2, '0')
    const last = String(new Date(y, batch.value.period_month, 0).getDate()).padStart(2, '0')
    const { data } = await tripsApi.list({
      driver_id: record.driver_id,
      from:      `${y}-${m}-01`,
      to:        `${y}-${m}-${last}`,
    })
    // Backend may not enforce date range yet; clip client-side as a safety net.
    const monthPrefix = `${y}-${m}`
    tripsModalTrips.value = (data.data || []).filter(t => (t.date || '').startsWith(monthPrefix))
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to load trips for this driver.', { title: 'Load Failed' })
  } finally {
    tripsModalLoading.value = false
  }
}
function closeTripsModal() {
  tripsModalRecord.value = null
  tripsModalTrips.value  = []
}

// ── Allowance breakdown modal ────────────────────────────────────────────────
const allowanceModalRecord = ref(null)
function openAllowanceModal(record) { allowanceModalRecord.value = record }
function closeAllowanceModal() {
  allowanceModalRecord.value = null
  editingRecord.value = null
}

async function saveModalEdit() {
  const id = allowanceModalRecord.value?.id
  if (!id) return
  await saveEdit(id)
  // Re-resolve modal record from the refreshed list so the displayed total
  // updates without closing the modal.
  allowanceModalRecord.value = records.value.find(r => r.id === id) || null
  editingRecord.value = null
}

async function fetchData() {
  loading.value = true
  try {
    const { data } = await compensationApi.getBatch(props.id)
    batch.value   = data.data || data
    records.value = batch.value.records || []
  } finally {
    loading.value = false
  }
}

function startEdit(record) {
  editingRecord.value = record.id
  editForm.value = { hardship_allowance: record.hardship_allowance, remarks: record.remarks || '' }
}

async function saveEdit(recordId) {
  try {
    await compensationApi.updateRecord(recordId, editForm.value)
    editingRecord.value = null
    await fetchData()
    toast.success('Compensation record updated successfully.', { title: 'Record Updated' })
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to update record.', { title: 'Update Failed' })
  }
}

async function confirmBatch() {
  if (!confirm('Confirm this payroll batch? Records will be locked.')) return
  actionLoading.value = true
  try {
    await compensationApi.confirmBatch(props.id)
    await fetchData()
    toast.success('Payroll batch confirmed successfully.', { title: 'Batch Confirmed' })
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to confirm the payroll batch.', { title: 'Confirmation Failed' })
  } finally {
    actionLoading.value = false
  }
}

async function exportBatch() {
  actionLoading.value = true
  try {
    const { data } = await compensationApi.exportBatch(props.id)
    await fetchData()
    toast.info(`Exported ${data.data.length} payroll records.`, { title: 'Export Complete' })
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to export the payroll batch.', { title: 'Export Failed' })
  } finally {
    actionLoading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="bd">

    <!-- Back -->
    <button class="bd-back" @click="router.back()">
      <ChevronLeftIcon :size="16" />
      Back to Batches
    </button>

    <div v-if="loading" class="bd-loading">
      <div class="bd-spinner" />
      <span>Loading batch details…</span>
    </div>

    <template v-else-if="batch">

      <!-- ── Batch header card ───────────────────────────────── -->
      <div class="bd-header-card">
        <div class="bd-header-main">
          <div class="bd-header-left">
            <div class="bd-batch-icon">
              <BatchIcon :size="20" />
            </div>
            <div>
              <h1 class="bd-batch-num">{{ batch.batch_number }}</h1>
              <div class="bd-batch-meta">
                <span class="bd-period-pill">
                  {{ String(batch.period_month).padStart(2, '0') }}/{{ batch.period_year }}
                </span>
                <StatusBadge :status="batch.status" />
              </div>
              <p v-if="batch.notes" class="bd-notes">{{ batch.notes }}</p>
            </div>
          </div>

          <div class="bd-header-actions">
            <button
              v-if="batch.status === 'draft'"
              class="bd-btn-confirm"
              :disabled="actionLoading"
              @click="confirmBatch"
            >
              <CheckIcon :size="16" :stroke-width="2.5" />
              {{ actionLoading ? 'Confirming…' : 'Confirm Batch' }}
            </button>
            <button
              v-if="batch.status === 'confirmed'"
              class="bd-btn-export"
              :disabled="actionLoading"
              @click="exportBatch"
            >
              <ExportIcon :size="16" />
              {{ actionLoading ? 'Exporting…' : 'Export to Payroll' }}
            </button>
          </div>
        </div>

        <!-- Summary stats -->
        <div class="bd-stats-row">
          <div class="bd-stat">
            <span class="bd-stat-val">{{ totalDrivers }}</span>
            <span class="bd-stat-lbl">Drivers</span>
          </div>
          <div class="bd-stat bd-stat--blue">
            <span class="bd-stat-val">{{ totalTrips }}</span>
            <span class="bd-stat-lbl">Trips</span>
          </div>
          <div class="bd-stat bd-stat--purple">
            <span class="bd-stat-val">{{ totalKm.toLocaleString() }}</span>
            <span class="bd-stat-lbl">Total KM</span>
          </div>
          <div class="bd-stat bd-stat--green">
            <span class="bd-stat-val">RM {{ totalCompensation.toFixed(2) }}</span>
            <span class="bd-stat-lbl">Total Payout</span>
          </div>
        </div>
      </div>

      <!-- ── Edit-window timeline card ─────────────────────── -->
      <div class="bd-window-card">
        <div class="bd-window-hd">
          <div class="bd-window-hd-left">
            <div class="bd-window-icon">
              <CalendarIcon :size="16" />
            </div>
            <div>
              <p class="bd-window-title">Edit Window</p>
              <p class="bd-window-sub">{{ windowStatusLabel }}</p>
            </div>
          </div>
          <div class="bd-window-hd-right">
            <button
              v-if="batch.status === 'draft' && !editingWindow"
              class="bd-window-edit-btn"
              type="button"
              @click="startEditWindow"
            >
              <EditIcon :size="13" />
              {{ batch.edit_window_start || batch.edit_window_end ? 'Adjust' : 'Set Window' }}
            </button>
          </div>
        </div>

        <!-- View mode: progress bar + dates -->
        <template v-if="!editingWindow">
          <div class="bd-window-bar-wrap">
            <div class="bd-window-bar-track">
              <div class="bd-window-bar-fill" :style="{ width: windowProgress + '%' }" />
              <div
                v-if="batch.edit_window_start && batch.edit_window_end"
                class="bd-window-bar-marker"
                :style="{ left: windowProgress + '%' }"
              />
            </div>
            <div class="bd-window-bar-labels">
              <span class="bd-window-date">
                <span class="bd-window-date-lbl">Start</span>
                {{ formatWindowDate(batch.edit_window_start) }}
              </span>
              <span v-if="batch.edit_window_start && batch.edit_window_end" class="bd-window-pct">
                {{ windowProgress }}%
              </span>
              <span class="bd-window-date bd-window-date--end">
                <span class="bd-window-date-lbl">End</span>
                {{ formatWindowDate(batch.edit_window_end) }}
              </span>
            </div>
          </div>
          <p v-if="!isWithinEditWindow && batch.status === 'draft'" class="bd-window-warn">
            Edits are currently locked. Adjust the window above to re-open editing.
          </p>
        </template>

        <!-- Edit mode: date range picker -->
        <template v-else>
          <div class="bd-window-form">
            <DateRangePicker
              v-model:from="windowForm.edit_window_start"
              v-model:to="windowForm.edit_window_end"
              variant="input"
              :presets="[]"
              aria-label="Edit window date range"
              class="bd-window-picker"
            />
            <div class="bd-window-actions">
              <button
                type="button"
                class="bd-cancel-btn"
                :disabled="windowSaving"
                @click="cancelEditWindow"
              >Cancel</button>
              <button
                type="button"
                class="bd-save-btn"
                :disabled="windowSaving"
                @click="saveEditWindow"
              >{{ windowSaving ? 'Saving…' : 'Save' }}</button>
            </div>
          </div>
        </template>
      </div>

      <!-- ── Records table ──────────────────────────────────── -->
      <div class="bd-table-card">
        <div class="bd-table-hd">
          <div>
            <p class="bd-table-title">Driver Compensation Records</p>
            <p class="bd-table-sub">
              {{ filteredRecords.length }} driver{{ filteredRecords.length !== 1 ? 's' : '' }}
              <span v-if="recordSearch && filteredRecords.length !== records.length" class="bd-table-meta">
                · {{ records.length }} total
              </span>
            </p>
          </div>
          <div class="bd-table-search">
            <SearchInput v-model="recordSearch" placeholder="Search driver…" />
          </div>
        </div>

        <!-- Desktop table -->
        <div class="bd-tbl-wrap">
          <table class="bd-tbl">
            <thead>
              <tr>
                <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredRecords.length === 0">
                <td :colspan="columns.length" class="bd-empty">
                  {{ recordSearch ? 'No drivers match your search.' : 'No records in this batch.' }}
                </td>
              </tr>
              <tr v-for="row in pagedRecords" :key="row.id">
                <td class="bd-cell-driver">
                  <span class="bd-driver-name">{{ row.driver_name }}</span>
                  <span class="bd-driver-id">{{ row.driver_id }}</span>
                </td>
                <td class="bd-cell-num">
                  <button
                    v-if="Number(row.total_trips) > 0"
                    class="bd-trips-btn"
                    type="button"
                    :title="`View ${row.driver_name}'s ${row.total_trips} trip${row.total_trips !== 1 ? 's' : ''} for ${tripsModalPeriod}`"
                    @click="openTripsModal(row)"
                  >{{ row.total_trips }}</button>
                  <span v-else class="bd-trips-zero">{{ row.total_trips }}</span>
                </td>
                <td class="bd-cell-num">{{ Number(row.total_km_driven).toLocaleString() }}</td>
                <td class="bd-cell-rm">{{ Number(row.base_trip_compensation).toFixed(2) }}</td>
                <td class="bd-cell-allowance">
                  <button
                    class="bd-allowance-btn"
                    :class="allowanceTotal(row) === 0 && 'bd-allowance-btn--zero'"
                    type="button"
                    @click="openAllowanceModal(row)"
                  >
                    {{ allowanceTotal(row).toFixed(2) }}
                  </button>
                </td>
                <td class="bd-cell-total">{{ Number(row.total_compensation).toFixed(2) }}</td>
                <td class="bd-cell-remark">
                  <span v-if="row.remarks" class="bd-remark-text" :title="row.remarks">{{ row.remarks }}</span>
                  <span v-else class="bd-remark-empty">—</span>
                </td>
                <td>
                  <template v-if="canEdit">
                    <ActionBtn tooltip="Edit Allowances &amp; Remark" variant="edit" @click="openAllowanceModal(row)">
                      <EditIcon :size="14" />
                    </ActionBtn>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <AppPagination
          v-if="!loading && filteredRecords.length"
          :current-page="recordPage"
          :last-page="lastPage"
          :total="filteredRecords.length"
          :from="pageFrom"
          :to="pageTo"
          always
          @change="p => { recordPage = p }"
        />

        <!-- Mobile cards -->
        <div class="bd-rec-cards">
          <div v-if="filteredRecords.length === 0" class="bd-empty">
            {{ recordSearch ? 'No drivers match your search.' : 'No records in this batch.' }}
          </div>
          <div v-for="row in pagedRecords" :key="row.id" class="bd-rec-card">
            <div class="bd-rec-top">
              <span class="bd-rec-name">{{ row.driver_name }}</span>
              <span class="bd-rec-total">RM {{ Number(row.total_compensation).toFixed(2) }}</span>
            </div>
            <div class="bd-rec-id">{{ row.driver_id }}</div>
            <div class="bd-rec-grid">
              <span>
                <span class="bd-rk">Trips</span>
                <button
                  v-if="Number(row.total_trips) > 0"
                  class="bd-trips-btn"
                  type="button"
                  @click="openTripsModal(row)"
                >{{ row.total_trips }}</button>
                <span v-else>{{ row.total_trips }}</span>
              </span>
              <span><span class="bd-rk">KM</span>{{ Number(row.total_km_driven).toLocaleString() }}</span>
              <span><span class="bd-rk">Base</span>RM {{ Number(row.base_trip_compensation).toFixed(2) }}</span>
              <span><span class="bd-rk">Allowance</span>RM {{ allowanceTotal(row).toFixed(2) }}</span>
              <span v-if="row.remarks" class="bd-rec-remark">
                <span class="bd-rk">Remark</span>{{ row.remarks }}
              </span>
            </div>
            <div class="bd-rec-actions">
              <button class="bd-edit-btn" @click="openAllowanceModal(row)">
                {{ canEdit ? 'Manage Allowance' : 'View Details' }}
              </button>
            </div>
          </div>
        </div>

      </div>
    </template>

    <!-- ── Trips modal (driver × payroll month) ─────────────── -->
    <Teleport to="body">
      <div v-if="tripsModalRecord" class="bd-overlay" @click.self="closeTripsModal">
        <div class="bd-modal bd-modal--wide">
          <div class="bd-modal-hd">
            <div class="bd-modal-hd-left">
              <h2 class="bd-modal-title">Trip Records</h2>
              <p class="bd-modal-sub">
                {{ tripsModalRecord.driver_name }} · {{ tripsModalRecord.driver_id }} · {{ tripsModalPeriod }}
              </p>
            </div>
            <div class="bd-modal-search">
              <SearchInput v-model="tripsModalSearch" placeholder="Search D/Note, tanker, location…" />
            </div>
            <button class="bd-modal-close" @click="closeTripsModal">✕</button>
          </div>

          <div class="bd-modal-body bd-modal-body--table">
            <div v-if="tripsModalLoading" class="bd-empty">Loading trips…</div>
            <template v-else>
              <div class="bd-trips-tbl-wrap">
                <table class="bd-trips-tbl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Tanker</th>
                      <th>D/Note</th>
                      <th>Type</th>
                      <th>Ship To</th>
                      <th>Location</th>
                      <th>Material</th>
                      <th>Oil Co.</th>
                      <th class="ta-r">Load (Ltr)</th>
                      <th class="ta-r">KM</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="tripsModalFiltered.length === 0">
                      <td colspan="10" class="bd-empty">
                        {{ tripsModalSearch ? 'No trips match your search.' : 'No trips for this driver in this period.' }}
                      </td>
                    </tr>
                    <tr v-for="trip in tripsModalPaged" :key="trip.id">
                      <td class="mono">{{ formatTripDate(trip.date) }}</td>
                      <td>{{ trip.road_tanker_id || '—' }}</td>
                      <td>{{ trip.delivery_note || '—' }}</td>
                      <td>
                        <span :class="['type-tag', trip.type === 'RE' ? 'type-tag--re' : 'type-tag--cb']">
                          {{ trip.type || '—' }}
                        </span>
                      </td>
                      <td>{{ trip.ship_to_party_name || '—' }}</td>
                      <td>{{ trip.location || '—' }}</td>
                      <td>{{ trip.material || '—' }}</td>
                      <td>{{ trip.oil_company ? capitalize(trip.oil_company) : '—' }}</td>
                      <td class="mono ta-r">{{ Number(trip.load_size || 0).toLocaleString() }}</td>
                      <td class="mono ta-r">{{ trip.km_driven ?? '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Mobile stacked cards for narrow screens -->
              <div class="bd-trips-cards">
                <div v-if="tripsModalFiltered.length === 0" class="bd-empty">
                  {{ tripsModalSearch ? 'No trips match your search.' : 'No trips for this driver in this period.' }}
                </div>
                <div v-for="trip in tripsModalPaged" :key="trip.id" class="bd-trips-card">
                  <div class="bd-trips-card-top">
                    <span class="mono">{{ formatTripDate(trip.date) }}</span>
                    <span :class="['type-tag', trip.type === 'RE' ? 'type-tag--re' : 'type-tag--cb']">
                      {{ trip.type || '—' }}
                    </span>
                  </div>
                  <div class="bd-trips-card-grid">
                    <span><span class="bd-rk">Tanker</span>{{ trip.road_tanker_id || '—' }}</span>
                    <span><span class="bd-rk">D/Note</span>{{ trip.delivery_note || '—' }}</span>
                    <span><span class="bd-rk">Ship To</span>{{ trip.ship_to_party_name || '—' }}</span>
                    <span><span class="bd-rk">Location</span>{{ trip.location || '—' }}</span>
                    <span><span class="bd-rk">Material</span>{{ trip.material || '—' }}</span>
                    <span><span class="bd-rk">Oil Co.</span>{{ trip.oil_company ? capitalize(trip.oil_company) : '—' }}</span>
                    <span><span class="bd-rk">Load</span>{{ Number(trip.load_size || 0).toLocaleString() }} L</span>
                    <span><span class="bd-rk">KM</span>{{ trip.km_driven ?? '—' }}</span>
                  </div>
                </div>
              </div>

              <AppPagination
                v-if="tripsModalFiltered.length"
                :current-page="tripsModalPage"
                :last-page="tripsModalLastPage"
                :total="tripsModalFiltered.length"
                :from="tripsModalFrom"
                :to="tripsModalTo"
                always
                @change="p => { tripsModalPage = p }"
              />
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Allowance breakdown / edit modal ─────────────────── -->
    <Teleport to="body">
      <div v-if="allowanceModalRecord" class="bd-overlay" @click.self="closeAllowanceModal">
        <div class="bd-modal">
          <div class="bd-modal-hd">
            <div>
              <h2 class="bd-modal-title">Allowance Breakdown</h2>
              <p class="bd-modal-sub">
                {{ allowanceModalRecord.driver_name }} · {{ allowanceModalRecord.driver_id }}
              </p>
            </div>
            <button class="bd-modal-close" @click="closeAllowanceModal">✕</button>
          </div>
          <div class="bd-modal-body">
            <p v-if="batch && batch.status !== 'draft'" class="bd-modal-locked">
              This batch is {{ batch.status }} — values are read-only.
            </p>
            <p v-else-if="!isWithinEditWindow" class="bd-modal-locked">
              Edit window is closed — values are read-only until the window is reopened.
            </p>
            <ul class="bd-allowance-list">
              <li v-for="item in allowanceItems(allowanceModalRecord)" :key="item.key">
                <span class="bd-allowance-label">{{ item.label }}</span>
                <span v-if="item.editable && canEdit && editingRecord === allowanceModalRecord.id">
                  <input
                    v-model.number="editForm.hardship_allowance"
                    type="number" step="0.01" min="0"
                    class="bd-edit-input"
                  />
                </span>
                <span v-else class="bd-allowance-amt">RM {{ item.amount.toFixed(2) }}</span>
              </li>
              <li class="bd-allowance-total-row">
                <span class="bd-allowance-label">Total</span>
                <span class="bd-allowance-amt bd-allowance-amt--total">
                  RM {{ allowanceTotal(allowanceModalRecord).toFixed(2) }}
                </span>
              </li>
            </ul>

            <!-- Remark field -->
            <div class="bd-remark-block">
              <label class="bd-allowance-label">Remark</label>
              <textarea
                v-if="canEdit && editingRecord === allowanceModalRecord.id"
                v-model="editForm.remarks"
                rows="2"
                class="bd-remark-input"
                placeholder="Add a note for this driver's record…"
              />
              <p v-else class="bd-remark-readonly">
                {{ allowanceModalRecord.remarks || '—' }}
              </p>
            </div>

            <div class="bd-modal-foot">
              <template v-if="canEdit">
                <template v-if="editingRecord === allowanceModalRecord.id">
                  <button class="bd-cancel-btn" @click="editingRecord = null">Cancel</button>
                  <button class="bd-save-btn" @click="saveModalEdit">Save</button>
                </template>
                <template v-else>
                  <button class="bd-cancel-btn" @click="closeAllowanceModal">Close</button>
                  <button class="bd-edit-btn bd-edit-btn--solid" @click="startEdit(allowanceModalRecord)">
                    Amend
                  </button>
                </template>
              </template>
              <button v-else class="bd-cancel-btn" @click="closeAllowanceModal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.bd { min-width: 0; overflow: hidden; }

/* ── Back ────────────────────────────────────────────────────── */
.bd-back {
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 18px;
  font-size: 0.875rem; font-weight: 500; color: var(--c-text-3);
  background: none; border: none; cursor: pointer; padding: 0;
  transition: color var(--dur);
}
.bd-back svg { width: 16px; height: 16px; }
.bd-back:hover { color: var(--c-accent); }

/* Loading */
.bd-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--c-text-3); }
.bd-spinner {
  width: 20px; height: 20px; border: 2px solid var(--c-border);
  border-top-color: var(--c-accent); border-radius: 50%;
  animation: bd-spin 0.7s linear infinite;
}
@keyframes bd-spin { to { transform: rotate(360deg); } }

/* ── Header card ─────────────────────────────────────────────── */
.bd-header-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 20px; margin-bottom: 16px; position: relative; overflow: hidden;
}
.bd-header-card::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--c-green); border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .bd-header-card { padding: 24px; } }

.bd-header-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
.bd-header-left { display: flex; align-items: flex-start; gap: 14px; }
.bd-batch-icon {
  width: 44px; height: 44px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-green); color: #fff;
  display: flex; align-items: center; justify-content: center; margin-top: 2px;
}
.bd-batch-icon svg { width: 22px; height: 22px; }
.bd-batch-num { font-size: 1.375rem; font-weight: 800; color: var(--c-text-1); letter-spacing: -0.02em; line-height: 1.2; }
.bd-batch-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
.bd-period-pill {
  display: inline-flex; padding: 2px 10px; border-radius: var(--r-full);
  background: var(--c-bg); border: 1px solid var(--c-border);
  font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2);
  font-variant-numeric: tabular-nums;
}
.bd-notes { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 6px; }

.bd-header-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bd-btn-confirm, .bd-btn-export {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 9px 16px; border: none; border-radius: 9px;
  font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: opacity var(--dur);
}
.bd-btn-confirm svg, .bd-btn-export svg { width: 15px; height: 15px; }
.bd-btn-confirm { background: var(--c-green); color: #fff; }
.bd-btn-export  { background: var(--c-accent); color: #fff; }
.bd-btn-confirm:hover:not(:disabled), .bd-btn-export:hover:not(:disabled) { opacity: 0.88; }
.bd-btn-confirm:disabled, .bd-btn-export:disabled { opacity: 0.5; cursor: not-allowed; }

/* Stats row */
.bd-stats-row {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
  padding-top: 18px; border-top: 1px solid var(--c-border-light);
}
@media (min-width: 640px) { .bd-stats-row { grid-template-columns: repeat(4, 1fr); } }
.bd-stat {
  display: flex; flex-direction: column; align-items: center;
  padding: 12px 8px; border-radius: var(--r-lg);
  background: var(--c-bg); border: 1px solid var(--c-border-light); gap: 3px;
}
.bd-stat-val { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em; color: var(--c-text-1); line-height: 1; }
.bd-stat-lbl { font-size: 0.625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-3); line-height: 1.3; text-align: center; }
.bd-stat--blue   .bd-stat-val { color: var(--c-accent); }
.bd-stat--purple .bd-stat-val { color: var(--c-purple); }
.bd-stat--green  .bd-stat-val { color: var(--c-green);  font-size: 1.125rem; }

/* ── Edit-window card ────────────────────────────────────────── */
.bd-window-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 16px;
}
.bd-window-hd {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.bd-window-hd-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
.bd-window-icon {
  width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px;
  background: var(--c-accent-tint); color: var(--c-accent);
  display: flex; align-items: center; justify-content: center;
}
.bd-window-title { font-size: 0.875rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.01em; }
.bd-window-sub   { font-size: 0.75rem; color: var(--c-text-3); margin-top: 1px; }
.bd-window-edit-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px; font-size: 0.75rem; font-weight: 600;
  color: var(--c-accent); background: var(--c-accent-tint);
  border: 1px solid transparent; border-radius: var(--r-full); cursor: pointer;
  transition: all var(--dur);
}
.bd-window-edit-btn:hover { background: var(--c-accent); color: #fff; }

/* Progress bar */
.bd-window-bar-wrap { margin-top: 14px; }
.bd-window-bar-track {
  position: relative; width: 100%; height: 8px;
  background: var(--c-bg); border: 1px solid var(--c-border-light);
  border-radius: var(--r-full); overflow: hidden;
}
.bd-window-bar-fill {
  position: absolute; inset: 0 auto 0 0; height: 100%;
  background: linear-gradient(90deg, var(--c-accent), var(--c-green));
  transition: width var(--dur);
}
.bd-window-bar-marker {
  position: absolute; top: 50%; width: 12px; height: 12px;
  border-radius: 50%; background: #fff; border: 2px solid var(--c-accent);
  transform: translate(-50%, -50%);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
  transition: left var(--dur);
}
.bd-window-bar-labels {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 8px; font-size: 0.75rem; color: var(--c-text-2);
  font-variant-numeric: tabular-nums;
}
.bd-window-date { display: inline-flex; flex-direction: column; gap: 1px; }
.bd-window-date--end { text-align: right; }
.bd-window-date-lbl {
  font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--c-text-3);
}
.bd-window-pct { font-weight: 700; color: var(--c-accent); }
.bd-window-warn {
  margin-top: 12px; font-size: 0.75rem; padding: 8px 12px;
  color: var(--c-amber); background: var(--c-amber-tint);
  border-radius: 8px;
}

/* Edit form — single flex row, picker grows to fill, buttons hug the right */
.bd-window-form {
  display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
  margin-top: 12px;
}
.bd-window-picker { flex: 1 1 240px; min-width: 0; }
.bd-window-picker :deep(.drp-input) { width: 100%; }
.bd-window-actions {
  display: flex; gap: 6px; flex-shrink: 0;
}
@media (max-width: 640px) {
  .bd-window-picker { flex-basis: 100%; }
  .bd-window-actions { width: 100%; justify-content: flex-end; }
}

/* ── Remark cell ─────────────────────────────────────────────── */
.bd-cell-remark { max-width: 220px; }
.bd-remark-text {
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden;
  font-size: 0.8125rem; color: var(--c-text-2); line-height: 1.35;
}
.bd-remark-empty { color: var(--c-text-3); font-size: 0.875rem; }
.bd-rec-remark { grid-column: 1 / -1; }

/* Remark block in modal */
.bd-remark-block { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.bd-remark-input {
  width: 100%; padding: 8px 12px; border: 1.5px solid var(--c-accent);
  border-radius: 8px; background: var(--c-bg); color: var(--c-text-1);
  font-size: 0.875rem; font-family: inherit; resize: vertical;
  outline: none; box-shadow: 0 0 0 3px var(--c-accent-ring);
  box-sizing: border-box;
}
.bd-remark-readonly {
  padding: 8px 12px; border: 1px solid var(--c-border-light);
  border-radius: 8px; background: var(--c-bg); color: var(--c-text-2);
  font-size: 0.8125rem; line-height: 1.4; min-height: 36px;
}

/* ── Table card ──────────────────────────────────────────────── */
.bd-table-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm); overflow: hidden;
}
.bd-table-hd {
  padding: 14px 20px; border-bottom: 1px solid var(--c-border-light);
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.bd-table-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); }
.bd-table-sub { font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px; }
.bd-table-meta { color: var(--c-text-3); }
.bd-table-search { width: 220px; flex-shrink: 0; }
@media (max-width: 767px) {
  .bd-table-hd { flex-direction: column; align-items: stretch; gap: 8px; padding: 12px 14px; }
  .bd-table-search { width: 100%; }
}

.bd-tbl-wrap { overflow-x: auto; }
@media (max-width: 767px) { .bd-tbl-wrap { display: none; } }
.bd-tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.bd-tbl thead tr { border-bottom: 1px solid var(--c-border); }
.bd-tbl th {
  padding: 10px 12px; text-align: left;
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-text-3); white-space: nowrap;
}
.bd-tbl td { padding: 11px 12px; border-bottom: 1px solid var(--c-border-light); vertical-align: middle; }
.bd-tbl tbody tr:last-child td { border-bottom: none; }
.bd-tbl tbody tr:hover td { background: var(--c-bg); }
.bd-empty { padding: 40px 12px; text-align: center; color: var(--c-text-3); font-size: 0.875rem; }

.bd-cell-driver { display: flex; flex-direction: column; gap: 2px; min-width: 140px; }
.bd-driver-name { font-weight: 600; color: var(--c-text-1); font-size: 0.875rem; }
.bd-driver-id   {
  font-size: 0.75rem; color: var(--c-text-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.01em;
}
.bd-cell-num  { font-variant-numeric: tabular-nums; color: var(--c-text-2); }
.bd-trips-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 32px; padding: 2px 8px; border-radius: var(--r-full);
  background: var(--c-accent-tint); border: 1px solid transparent;
  color: var(--c-accent); font-size: 0.875rem; font-weight: 600;
  font-variant-numeric: tabular-nums; cursor: pointer; transition: all var(--dur);
}
.bd-trips-btn:hover { border-color: var(--c-accent); background: var(--c-accent); color: #fff; }
.bd-trips-zero { color: var(--c-text-3); font-variant-numeric: tabular-nums; }
.bd-cell-rm   { font-variant-numeric: tabular-nums; color: var(--c-text-2); }
.bd-cell-allowance { font-variant-numeric: tabular-nums; }
.bd-allowance-btn {
  display: inline-flex; align-items: center;
  padding: 3px 10px; border-radius: var(--r-full);
  background: var(--c-accent-tint); border: 1px solid transparent;
  color: var(--c-accent); font-size: 0.8125rem; font-weight: 600;
  font-variant-numeric: tabular-nums; cursor: pointer; transition: all var(--dur);
}
.bd-allowance-btn:hover { border-color: var(--c-accent); background: var(--c-accent); color: #fff; }
.bd-allowance-btn--zero {
  background: var(--c-bg); color: var(--c-text-3); font-weight: 500;
}
.bd-allowance-btn--zero:hover { background: var(--c-border-light); color: var(--c-text-2); border-color: var(--c-border); }
.bd-cell-total { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--c-green); }

.bd-edit-input {
  width: 90px; padding: 5px 8px; border: 1.5px solid var(--c-accent);
  border-radius: var(--r-sm); font-size: 0.875rem; background: var(--c-bg);
  color: var(--c-text-1); outline: none; font-variant-numeric: tabular-nums;
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.bd-act-group { display: flex; gap: 4px; }

/* Mobile record cards */
.bd-rec-cards { display: none; flex-direction: column; gap: 10px; padding: 12px; }
@media (max-width: 767px) { .bd-rec-cards { display: flex; } }
.bd-rec-card {
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-lg); padding: 14px;
}
.bd-rec-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.bd-rec-name { font-weight: 700; color: var(--c-text-1); font-size: 0.9375rem; }
.bd-rec-total { font-weight: 700; color: var(--c-green); font-size: 1rem; }
.bd-rec-id { font-size: 0.75rem; color: var(--c-text-3); margin-bottom: 10px; }
.bd-rec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; font-size: 0.8125rem; color: var(--c-text-2); }
.bd-rk { font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); display: block; margin-bottom: 1px; }
.bd-rec-actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--c-border-light); flex-wrap: wrap; }
.bd-edit-btn { font-size: 0.8125rem; font-weight: 500; color: var(--c-accent); background: var(--c-accent-tint); border: 1px solid rgba(29,78,216,0.2); border-radius: 6px; padding: 5px 12px; cursor: pointer; }
.bd-save-btn { font-size: 0.8125rem; font-weight: 600; color: #fff; background: var(--c-green); border: none; border-radius: 6px; padding: 5px 12px; cursor: pointer; }
.bd-cancel-btn { font-size: 0.8125rem; font-weight: 500; color: var(--c-text-2); background: transparent; border: 1px solid var(--c-border); border-radius: 6px; padding: 5px 12px; cursor: pointer; }
@media (max-width: 360px) {
  .bd-rec-top,
  .bd-rec-grid {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: flex-start;
  }

  .bd-rec-actions > * {
    width: 100%;
    min-height: 44px;
  }
}

/* ── Modals (overlay shared between trips + allowance modals) ── */
.bd-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.bd-modal {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 18px; width: 100%; max-width: 420px;
  box-shadow: var(--sh-xl); overflow: hidden;
  display: flex; flex-direction: column;
  max-height: calc(100vh - 32px);
}
.bd-modal--wide {
  max-width: 1100px;
}
@media (max-width: 1180px) {
  .bd-modal--wide { max-width: 95vw; }
}
@media (max-width: 640px) {
  .bd-overlay { padding: 8px; }
  .bd-modal--wide { max-width: 100vw; max-height: calc(100vh - 16px); border-radius: 14px; }
}
.bd-modal-hd {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 18px 20px 14px; border-bottom: 1px solid var(--c-border-light);
}
.bd-modal-title { font-size: 1rem; font-weight: 700; color: var(--c-text-1); }
.bd-modal-sub { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 1px; }
.bd-modal-close {
  margin-left: auto; flex-shrink: 0; background: none; border: none;
  cursor: pointer; color: var(--c-text-3); font-size: 1rem; padding: 4px;
  transition: color var(--dur);
}
.bd-modal-close:hover { color: var(--c-text-1); }
.bd-modal-body { padding: 18px 20px; }
.bd-modal-locked {
  font-size: 0.75rem; color: var(--c-amber); background: var(--c-amber-tint);
  padding: 8px 12px; border-radius: 8px; margin-bottom: 12px;
}
.bd-allowance-list {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.bd-allowance-list li {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; border-radius: 8px;
}
.bd-allowance-list li:nth-child(odd) { background: var(--c-bg); }
.bd-allowance-label { font-size: 0.875rem; color: var(--c-text-2); font-weight: 500; }
.bd-allowance-amt {
  font-variant-numeric: tabular-nums; font-weight: 600;
  color: var(--c-text-1); font-size: 0.875rem;
}
.bd-allowance-total-row {
  margin-top: 6px; border-top: 1px solid var(--c-border-light); padding-top: 12px !important;
  background: transparent !important;
}
.bd-allowance-total-row .bd-allowance-label { font-weight: 700; color: var(--c-text-1); }
.bd-allowance-amt--total { color: var(--c-green); font-weight: 800; font-size: 1rem; }

.bd-modal-foot {
  display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;
}
.bd-edit-btn--solid {
  background: var(--c-accent); color: #fff; border: none;
}
.bd-edit-btn--solid:hover { opacity: 0.88; }

/* ── Trips modal ───────────────────────────────────────────── */
.bd-modal-hd-left { min-width: 0; flex: 1; }
.bd-modal-search { width: 240px; flex-shrink: 0; }
@media (max-width: 767px) {
  .bd-modal-hd { flex-wrap: wrap; }
  .bd-modal-search { order: 3; width: 100%; margin-top: 4px; }
}

.bd-modal-body--table {
  padding: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.bd-trips-tbl-wrap {
  overflow: auto;
  flex: 1;
  min-height: 0;
}
@media (max-width: 767px) { .bd-trips-tbl-wrap { display: none; } }

.bd-trips-tbl { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.bd-trips-tbl thead { position: sticky; top: 0; background: var(--c-surface); z-index: 1; }
.bd-trips-tbl thead tr { border-bottom: 1px solid var(--c-border); }
.bd-trips-tbl th {
  padding: 10px 12px; text-align: left;
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-text-3); white-space: nowrap;
  background: var(--c-bg);
}
.bd-trips-tbl td {
  padding: 10px 12px; border-bottom: 1px solid var(--c-border-light);
  vertical-align: middle; color: var(--c-text-2); white-space: nowrap;
}
.bd-trips-tbl tbody tr:last-child td { border-bottom: none; }
.bd-trips-tbl tbody tr:hover td { background: var(--c-bg); }
.bd-trips-tbl .ta-r { text-align: right; }
.bd-trips-tbl .mono { font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.bd-trips-tbl .type-tag {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em;
}
.bd-trips-tbl .type-tag--re { background: var(--c-accent-tint); color: var(--c-accent); }
.bd-trips-tbl .type-tag--cb { background: var(--c-purple-tint); color: var(--c-purple); }

/* Mobile cards version */
.bd-trips-cards { display: none; padding: 12px; gap: 10px; flex-direction: column; overflow-y: auto; min-height: 0; flex: 1; }
@media (max-width: 767px) { .bd-trips-cards { display: flex; } }
.bd-trips-card {
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-lg); padding: 12px;
}
.bd-trips-card-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.bd-trips-card-top .mono {
  font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600; color: var(--c-text-1);
}
.bd-trips-card-top .type-tag {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em;
}
.bd-trips-card-top .type-tag--re { background: var(--c-accent-tint); color: var(--c-accent); }
.bd-trips-card-top .type-tag--cb { background: var(--c-purple-tint); color: var(--c-purple); }
.bd-trips-card-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
  font-size: 0.8125rem; color: var(--c-text-2);
}
</style>
