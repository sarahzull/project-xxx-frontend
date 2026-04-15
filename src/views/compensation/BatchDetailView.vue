<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import compensationApi from '../../api/compensation'
import { useToast } from '../../composables/useToast'
import StatusBadge from '../../components/common/StatusBadge.vue'
import ActionBtn   from '../../components/common/ActionBtn.vue'
import {
  ChevronLeftIcon, BatchIcon, CheckIcon, ExportIcon, CloseIcon, EditIcon,
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

// ── Computed totals ───────────────────────────────────────────────────────────
const totalDrivers      = computed(() => records.value.length)
const totalTrips        = computed(() => records.value.reduce((s, r) => s + (Number(r.total_trips) || 0), 0))
const totalKm           = computed(() => records.value.reduce((s, r) => s + (Number(r.total_km_driven) || 0), 0))
const totalCompensation = computed(() => records.value.reduce((s, r) => s + (Number(r.total_compensation) || 0), 0))

const columns = [
  { key: 'driver_id',              label: 'Driver ID' },
  { key: 'driver_name',            label: 'Name' },
  { key: 'total_trips',            label: 'Trips' },
  { key: 'total_km_driven',        label: 'KM' },
  { key: 'base_trip_compensation', label: 'Base (RM)' },
  { key: 'diversion_allowance',    label: 'Div. (RM)' },
  { key: 'ron97_allowance',        label: 'Ron97 (RM)' },
  { key: 'others_allowance',       label: 'Others (RM)' },
  { key: 'hardship_allowance',     label: 'Hardship (RM)' },
  { key: 'total_compensation',     label: 'Total (RM)' },
  { key: 'actions',                label: '' },
]

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
      <!-- ── Records table ──────────────────────────────────── -->
      <div class="bd-table-card">
        <div class="bd-table-hd">
          <p class="bd-table-title">Driver Compensation Records</p>
          <p class="bd-table-sub">{{ records.length }} driver{{ records.length !== 1 ? 's' : '' }}</p>
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
              <tr v-if="records.length === 0">
                <td :colspan="columns.length" class="bd-empty">No records in this batch.</td>
              </tr>
              <tr v-for="row in records" :key="row.id">
                <td class="bd-cell-id">{{ row.driver_id }}</td>
                <td class="bd-cell-name">{{ row.driver_name }}</td>
                <td class="bd-cell-num">{{ row.total_trips }}</td>
                <td class="bd-cell-num">{{ Number(row.total_km_driven).toLocaleString() }}</td>
                <td class="bd-cell-rm">{{ Number(row.base_trip_compensation).toFixed(2) }}</td>
                <td class="bd-cell-rm">{{ Number(row.diversion_allowance).toFixed(2) }}</td>
                <td class="bd-cell-rm">{{ Number(row.ron97_allowance).toFixed(2) }}</td>
                <td class="bd-cell-rm">{{ Number(row.others_allowance).toFixed(2) }}</td>
                <td class="bd-cell-hardship">
                  <input
                    v-if="editingRecord === row.id"
                    v-model.number="editForm.hardship_allowance"
                    type="number" step="0.01" min="0"
                    class="bd-edit-input"
                    @click.stop
                  />
                  <span v-else>{{ Number(row.hardship_allowance).toFixed(2) }}</span>
                </td>
                <td class="bd-cell-total">{{ Number(row.total_compensation).toFixed(2) }}</td>
                <td>
                  <template v-if="batch.status === 'draft'">
                    <div v-if="editingRecord === row.id" class="bd-act-group">
                      <ActionBtn tooltip="Save" variant="save" @click="saveEdit(row.id)">
                        <CheckIcon :size="14" :stroke-width="2.5" />
                      </ActionBtn>
                      <ActionBtn tooltip="Cancel" variant="cancel" @click="editingRecord = null">
                        <CloseIcon :size="14" :stroke-width="2.5" />
                      </ActionBtn>
                    </div>
                    <ActionBtn v-else tooltip="Edit Hardship" variant="edit" @click="startEdit(row)">
                      <EditIcon :size="14" />
                    </ActionBtn>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="bd-rec-cards">
          <div v-if="records.length === 0" class="bd-empty">No records in this batch.</div>
          <div v-for="row in records" :key="row.id" class="bd-rec-card">
            <div class="bd-rec-top">
              <span class="bd-rec-name">{{ row.driver_name }}</span>
              <span class="bd-rec-total">RM {{ Number(row.total_compensation).toFixed(2) }}</span>
            </div>
            <div class="bd-rec-id">{{ row.driver_id }}</div>
            <div class="bd-rec-grid">
              <span><span class="bd-rk">Trips</span>{{ row.total_trips }}</span>
              <span><span class="bd-rk">KM</span>{{ Number(row.total_km_driven).toLocaleString() }}</span>
              <span><span class="bd-rk">Base</span>RM {{ Number(row.base_trip_compensation).toFixed(2) }}</span>
              <span><span class="bd-rk">Hardship</span>RM {{ Number(row.hardship_allowance).toFixed(2) }}</span>
            </div>
            <div v-if="batch.status === 'draft'" class="bd-rec-actions">
              <template v-if="editingRecord === row.id">
                <input v-model.number="editForm.hardship_allowance" type="number" step="0.01" min="0" class="bd-edit-input" placeholder="Hardship amount" />
                <button class="bd-save-btn" @click="saveEdit(row.id)">Save</button>
                <button class="bd-cancel-btn" @click="editingRecord = null">Cancel</button>
              </template>
              <button v-else class="bd-edit-btn" @click="startEdit(row)">Edit Hardship</button>
            </div>
          </div>
        </div>

      </div>
    </template>

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
  background: var(--c-green-tint); border: 1.5px solid rgba(5,150,105,0.15);
  display: flex; align-items: center; justify-content: center; color: var(--c-green); margin-top: 2px;
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
.bd-stat-lbl { font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-3); }
.bd-stat--blue   .bd-stat-val { color: var(--c-accent); }
.bd-stat--purple .bd-stat-val { color: var(--c-purple); }
.bd-stat--green  .bd-stat-val { color: var(--c-green);  font-size: 1.125rem; }

/* ── Table card ──────────────────────────────────────────────── */
.bd-table-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm); overflow: hidden;
}
.bd-table-hd { padding: 14px 20px; border-bottom: 1px solid var(--c-border-light); }
.bd-table-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); }
.bd-table-sub { font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px; }

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

.bd-cell-id   { font-weight: 500; color: var(--c-text-2); }
.bd-cell-name { font-weight: 600; color: var(--c-text-1); }
.bd-cell-num  { font-variant-numeric: tabular-nums; color: var(--c-text-2); }
.bd-cell-rm   { font-variant-numeric: tabular-nums; color: var(--c-text-2); }
.bd-cell-hardship { font-variant-numeric: tabular-nums; }
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
.bd-edit-btn { font-size: 0.8125rem; font-weight: 500; color: var(--c-accent); background: var(--c-accent-tint); border: 1px solid rgba(37,99,235,0.2); border-radius: 6px; padding: 5px 12px; cursor: pointer; }
.bd-save-btn { font-size: 0.8125rem; font-weight: 600; color: #fff; background: var(--c-green); border: none; border-radius: 6px; padding: 5px 12px; cursor: pointer; }
.bd-cancel-btn { font-size: 0.8125rem; font-weight: 500; color: var(--c-text-2); background: transparent; border: 1px solid var(--c-border); border-radius: 6px; padding: 5px 12px; cursor: pointer; }
</style>
