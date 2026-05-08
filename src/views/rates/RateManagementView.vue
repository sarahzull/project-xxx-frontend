<script setup>
import { ref, computed, onMounted } from 'vue'
import ratesApi from '../../api/rates'
import { useToast } from '../../composables/useToast'
import DatePicker from '../../components/common/DatePicker.vue'
import SelectInput from '../../components/common/SelectInput.vue'

const SCOPE_OPTIONS = [
  { value: 'all',     label: 'Everyone (no restriction)' },
  { value: 'bases',   label: 'Specific bases' },
  { value: 'drivers', label: 'Specific drivers only' },
  { value: 'mixed',   label: 'Bases + driver overrides' },
]
import {
  RatesIcon, EditIcon, CheckIcon, CloseIcon, TrashIcon, AddIcon, InfoIcon, BatchIcon,
} from '../../components/icons/index.js'

const toast = useToast()
const specialRates = ref([])
const loading      = ref(true)
const saving       = ref(false)

// ── 2-D matrix ────────────────────────────────────────────────────────────────
// matrix[li][ki] = { id, rate_per_trip, km_min, km_max, load_size_min, load_size_max }
const matrix     = ref([])
const kmRanges   = ref([])   // [{ min, max }]
const loadRanges = ref([])   // [{ min, max }]

// ── Edit state ────────────────────────────────────────────────────────────────
const editingRowIndex  = ref(null)
const editRowBackup    = ref(null)
const isNewRow         = ref(false)
const editingKmHeaders = ref(false)
const kmHeadersBackup  = ref(null)
const editingNoteIndex = ref(null)
const editNoteBackup   = ref(null)

// ── Targeting options ────────────────────────────────────────────────────────
const optionDrivers = ref([]) // [{ id, driver_id, name, base }]
const optionBases   = ref([]) // string[] (distinct bases currently in use)

// ── Load data ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const [tRes, sRes, oRes] = await Promise.all([
      ratesApi.getTripRates(),
      ratesApi.getSpecialNoteRates(),
      ratesApi.getSpecialNoteOptions(),
    ])
    specialRates.value = (sRes.data.data || []).map(normalizeSpecialRate)
    optionDrivers.value = oRes.data.data?.drivers || []
    optionBases.value   = oRes.data.data?.bases   || []
    buildMatrix(tRes.data.data)
  } finally {
    loading.value = false
  }
})

function normalizeSpecialRate(r) {
  return {
    ...r,
    starts_at: r.starts_at || '',
    ends_at:   r.ends_at   || '',
    scope:     r.scope     || 'all',
    bases:     Array.isArray(r.bases) ? [...r.bases] : [],
    driver_targets: Array.isArray(r.driver_targets)
      ? r.driver_targets.map(d => ({ ...d }))
      : [],
  }
}

function buildMatrix(flat) {
  const kmMap   = {}
  const loadMap = {}
  flat.forEach(r => {
    kmMap[r.km_min]          ??= { min: r.km_min,        max: r.km_max        }
    loadMap[r.load_size_min] ??= { min: r.load_size_min, max: r.load_size_max }
  })
  kmRanges.value   = Object.values(kmMap).sort((a, b) => a.min - b.min)
  loadRanges.value = Object.values(loadMap).sort((a, b) => a.min - b.min)
  matrix.value = loadRanges.value.map(lr =>
    kmRanges.value.map(kr => {
      const c = flat.find(r => r.load_size_min === lr.min && r.km_min === kr.min)
      return c ? { ...c } : { id: null, rate_per_trip: 0, km_min: kr.min, km_max: kr.max, load_size_min: lr.min, load_size_max: lr.max }
    })
  )
}

// ── Sync helpers ──────────────────────────────────────────────────────────────
function syncLoadRange(li) {
  const { min, max } = loadRanges.value[li]
  matrix.value[li].forEach(c => { c.load_size_min = min; c.load_size_max = max })
}
function syncKmRange(ki) {
  const { min, max } = kmRanges.value[ki]
  matrix.value.forEach(row => { row[ki].km_min = min; row[ki].km_max = max })
}

// ── Row: add / edit / save / delete ──────────────────────────────────────────
function addRow() {
  if (editingRowIndex.value !== null || editingKmHeaders.value) return
  const last   = loadRanges.value[loadRanges.value.length - 1]
  const newMin = last ? last.max + 1     : 0
  const newMax = last ? last.max + 10920 : 10919
  loadRanges.value.push({ min: newMin, max: newMax })
  matrix.value.push(
    kmRanges.value.map(kr => ({
      id: null, rate_per_trip: 0,
      km_min: kr.min, km_max: kr.max,
      load_size_min: newMin, load_size_max: newMax,
    }))
  )
  editingRowIndex.value = loadRanges.value.length - 1
  editRowBackup.value   = null
  isNewRow.value        = true
}

function startEditRow(li) {
  if (editingKmHeaders.value) return
  editRowBackup.value = {
    loadRange: { ...loadRanges.value[li] },
    cells:     matrix.value[li].map(c => ({ ...c })),
  }
  editingRowIndex.value = li
  isNewRow.value        = false
}

function cancelEditRow() {
  const li = editingRowIndex.value
  if (isNewRow.value) {
    loadRanges.value.splice(li, 1)
    matrix.value.splice(li, 1)
  } else if (editRowBackup.value) {
    loadRanges.value[li] = { ...editRowBackup.value.loadRange }
    matrix.value[li]     = editRowBackup.value.cells.map(c => ({ ...c }))
  }
  editingRowIndex.value = null
  editRowBackup.value   = null
  isNewRow.value        = false
}

async function saveEditRow(li) {
  saving.value = true
  try {
    syncLoadRange(li)
    const cells    = matrix.value[li]
    const toCreate = cells.filter(c => !c.id)
    const toUpdate = cells.filter(c =>  c.id)
    if (toCreate.length) {
      const res = await ratesApi.createTripRates(toCreate.map(c => ({
        rate_per_trip: c.rate_per_trip, km_min: c.km_min, km_max: c.km_max,
        load_size_min: c.load_size_min, load_size_max: c.load_size_max,
      })))
      ;(res.data.data || []).forEach((d, i) => { if (toCreate[i]) toCreate[i].id = d.id })
    }
    if (toUpdate.length) {
      await ratesApi.updateTripRates(toUpdate.map(c => ({
        id: c.id, rate_per_trip: c.rate_per_trip,
        km_min: c.km_min, km_max: c.km_max,
        load_size_min: c.load_size_min, load_size_max: c.load_size_max,
      })))
    }
    editingRowIndex.value = null
    editRowBackup.value   = null
    isNewRow.value        = false
    toast.success('Row saved successfully.', { title: 'Row Saved' })
  } catch {
    toast.error('Failed to save the row.', { title: 'Save Failed' })
  } finally {
    saving.value = false
  }
}

async function deleteRow(li) {
  const ids = matrix.value[li].map(c => c.id).filter(Boolean)
  if (ids.length) {
    try { await ratesApi.deleteTripRates(ids) }
    catch { toast.error('Failed to delete the row.', { title: 'Delete Failed' }); return }
  }
  loadRanges.value.splice(li, 1)
  matrix.value.splice(li, 1)
  if (editingRowIndex.value === li) { editingRowIndex.value = null; isNewRow.value = false }
  toast.success('Load range row deleted.', { title: 'Row Deleted' })
}

// ── Column: add / edit / save / delete ───────────────────────────────────────
function startEditKm() {
  if (editingRowIndex.value !== null) return
  kmHeadersBackup.value  = kmRanges.value.map(r => ({ ...r }))
  editingKmHeaders.value = true
}

function addColumn() {
  const last   = kmRanges.value[kmRanges.value.length - 1]
  const newMin = last ? last.max + 1  : 0
  const newMax = last ? last.max + 40 : 40
  kmRanges.value.push({ min: newMin, max: newMax })
  matrix.value.forEach((row, li) => row.push({
    id: null, rate_per_trip: 0,
    km_min: newMin, km_max: newMax,
    load_size_min: loadRanges.value[li].min,
    load_size_max: loadRanges.value[li].max,
  }))
}

function cancelEditKm() {
  const backup = kmHeadersBackup.value || []
  const extra  = kmRanges.value.length - backup.length
  if (extra > 0) {
    kmRanges.value.splice(backup.length, extra)
    matrix.value.forEach(row => row.splice(backup.length, extra))
  }
  backup.forEach((r, ki) => { kmRanges.value[ki] = { ...r } })
  kmRanges.value.forEach((_, ki) => syncKmRange(ki))
  editingKmHeaders.value = false
  kmHeadersBackup.value  = null
}

async function saveEditKm() {
  saving.value = true
  try {
    kmRanges.value.forEach((_, ki) => syncKmRange(ki))
    const allCells = matrix.value.flat()
    const toCreate = allCells.filter(c => !c.id)
    const toUpdate = allCells.filter(c =>  c.id)
    if (toCreate.length) {
      const res = await ratesApi.createTripRates(toCreate.map(c => ({
        rate_per_trip: c.rate_per_trip, km_min: c.km_min, km_max: c.km_max,
        load_size_min: c.load_size_min, load_size_max: c.load_size_max,
      })))
      ;(res.data.data || []).forEach((d, i) => { if (toCreate[i]) toCreate[i].id = d.id })
    }
    if (toUpdate.length) {
      await ratesApi.updateTripRates(toUpdate.map(c => ({
        id: c.id, rate_per_trip: c.rate_per_trip,
        km_min: c.km_min, km_max: c.km_max,
        load_size_min: c.load_size_min, load_size_max: c.load_size_max,
      })))
    }
    editingKmHeaders.value = false
    kmHeadersBackup.value  = null
    toast.success('KM columns saved.', { title: 'Columns Saved' })
  } catch {
    toast.error('Failed to save KM columns.', { title: 'Save Failed' })
  } finally {
    saving.value = false
  }
}

async function deleteColumn(ki) {
  const ids = matrix.value.map(row => row[ki]?.id).filter(Boolean)
  if (ids.length) {
    try { await ratesApi.deleteTripRates(ids) }
    catch { toast.error('Failed to delete the column.', { title: 'Delete Failed' }); return }
  }
  if (kmHeadersBackup.value && ki < kmHeadersBackup.value.length) {
    kmHeadersBackup.value.splice(ki, 1)
  }
  kmRanges.value.splice(ki, 1)
  matrix.value.forEach(row => row.splice(ki, 1))
  toast.success('KM column deleted.', { title: 'Column Deleted' })
}

// ── Special note helpers ──────────────────────────────────────────────────────
function blankNote() {
  return {
    id: null, note_key: '', label: '', allowance: 0,
    starts_at: '', ends_at: '', scope: 'all',
    bases: [], driver_targets: [],
    _new: true,
  }
}

function addNote() {
  const idx = specialRates.value.length
  specialRates.value.push(blankNote())
  editNoteBackup.value   = null
  editingNoteIndex.value = idx
}

function startEditNote(index) {
  // Deep-clone so cancel can restore exactly what was on screen.
  editNoteBackup.value = JSON.parse(JSON.stringify(specialRates.value[index]))
  editingNoteIndex.value = index
}

function cancelEditNote() {
  const i = editingNoteIndex.value
  if (editNoteBackup.value) {
    specialRates.value[i] = editNoteBackup.value
  } else {
    specialRates.value.splice(i, 1)
  }
  editingNoteIndex.value = null
  editNoteBackup.value   = null
}

function buildPayload(rate) {
  const derivedKey = (rate.note_key || rate.label || '').trim().toLowerCase().replace(/\s+/g, '_')
  return {
    note_key:  derivedKey,
    label:     rate.label.trim(),
    allowance: Number(rate.allowance) || 0,
    starts_at: rate.starts_at || null,
    ends_at:   rate.ends_at   || null,
    scope:     rate.scope     || 'all',
    bases:     [...(rate.bases || [])],
    driver_targets: (rate.driver_targets || []).map(d => ({
      driver_user_id: d.driver_user_id,
      effect:         d.effect || 'include',
    })),
  }
}

async function saveEditNote(index) {
  const rate = specialRates.value[index]
  if (!rate.label?.trim()) {
    toast.warning('Please enter a note label before saving.', { title: 'Missing Label' })
    return
  }
  if (rate.starts_at && rate.ends_at && rate.ends_at < rate.starts_at) {
    toast.warning('End date must be on or after the start date.', { title: 'Invalid Window' })
    return
  }
  if ((rate.scope === 'bases' || rate.scope === 'mixed') && !(rate.bases?.length)) {
    toast.warning('Pick at least one base for this scope, or switch scope back to "Everyone".', { title: 'Missing Bases' })
    return
  }
  saving.value = true
  try {
    const payload = buildPayload(rate)
    if (!rate.id) {
      const res = await ratesApi.createSpecialNote(payload)
      Object.assign(rate, normalizeSpecialRate(res.data.data))
      rate._new = false
    } else {
      await ratesApi.updateSpecialNoteRates([{ id: rate.id, ...payload }])
      Object.assign(rate, normalizeSpecialRate({ ...rate, ...payload }))
    }
    editingNoteIndex.value = null
    editNoteBackup.value   = null
    toast.success('Special note rate saved successfully.', { title: 'Note Saved' })
  } catch (err) {
    const msg = err?.response?.data?.message || 'Failed to save the special note rate.'
    toast.error(msg, { title: 'Save Failed' })
  } finally {
    saving.value = false
  }
}

// ── Targeting helpers (used by template) ─────────────────────────────────────
function toggleBase(rate, base) {
  const i = rate.bases.indexOf(base)
  if (i === -1) rate.bases.push(base)
  else          rate.bases.splice(i, 1)
}

function isBaseSelected(rate, base) { return rate.bases.includes(base) }

function findDriverTargetIndex(rate, userId) {
  return rate.driver_targets.findIndex(d => d.driver_user_id === userId)
}

function setDriverTarget(rate, userId, effect) {
  // effect: 'include' | 'exclude' | null (null = remove)
  const i = findDriverTargetIndex(rate, userId)
  if (effect === null) {
    if (i !== -1) rate.driver_targets.splice(i, 1)
    return
  }
  const drv = optionDrivers.value.find(d => d.id === userId)
  const row = { driver_user_id: userId, effect, name: drv?.name, driver_id: drv?.driver_id }
  if (i === -1) rate.driver_targets.push(row)
  else          rate.driver_targets[i] = row
}

function driverEffect(rate, userId) {
  const t = rate.driver_targets.find(d => d.driver_user_id === userId)
  return t?.effect || null
}

const driverPickerQuery = ref('')
const filteredOptionDrivers = computed(() => {
  const q = driverPickerQuery.value.trim().toLowerCase()
  if (!q) return optionDrivers.value
  return optionDrivers.value.filter(d =>
    (d.name || '').toLowerCase().includes(q) ||
    (d.driver_id || '').toLowerCase().includes(q)
  )
})

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function scopeLabel(s) {
  return ({ all: 'Everyone', bases: 'Specific bases', drivers: 'Specific drivers', mixed: 'Bases + driver overrides' })[s] || 'Everyone'
}

async function deleteNote(index) {
  const rate = specialRates.value[index]
  if (rate.id) {
    try { await ratesApi.deleteSpecialNote(rate.id) }
    catch { toast.error('Failed to delete the special note rate.', { title: 'Delete Failed' }); return }
  }
  specialRates.value.splice(index, 1)
  if (editingNoteIndex.value === index) { editingNoteIndex.value = null; editNoteBackup.value = null }
  toast.success('Special note type removed.', { title: 'Note Deleted' })
}

const NOTE_COLORS = ['amber','green','orange','blue','purple','teal','red','indigo']
function noteColor(i) { return NOTE_COLORS[i % NOTE_COLORS.length] }

const activeTab = ref('trip-rates') // 'trip-rates' | 'special-notes'
</script>

<template>
  <div class="rm">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="rm-banner">
      <div class="rm-banner-left">
        <div class="rm-banner-icon">
          <RatesIcon :size="20" />
        </div>
        <div>
          <h1 class="rm-banner-title">Rate Management</h1>
          <p class="rm-banner-sub">Configure Trip &amp; Special Note Rates</p>
        </div>
      </div>
    </div>
    <!-- ── Tab bar ───────────────────────────────────────────── -->
    <div class="rm-tabs" role="tablist">
      <button
        role="tab"
        :aria-selected="activeTab === 'trip-rates'"
        :class="['rm-tab', activeTab === 'trip-rates' && 'rm-tab--active']"
        @click="activeTab = 'trip-rates'"
      >
        Trip Rates
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'special-notes'"
        :class="['rm-tab', activeTab === 'special-notes' && 'rm-tab--active']"
        @click="activeTab = 'special-notes'"
      >
        Special Note Rates
        <span v-if="!loading && specialRates.length" class="rm-tab-count">{{ specialRates.length }}</span>
      </button>
    </div>

    <!-- ── Loading ────────────────────────────────────────────── -->
    <div v-if="loading" class="rm-loading">
      <div class="rm-spinner" /><span>Loading rates…</span>
    </div>

    <template v-else>

      <!-- ════════════════════════════════════════════════════════
           TRIP RATE MATRIX
      ════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'trip-rates'" class="rm-card">
        <div class="rm-card-hd">
          <div>
            <p class="rm-card-title">Trip Rate Matrix</p>
            <p class="rm-card-sub">
              Rate per trip in RM — click
              <span class="rm-inline-icon" aria-hidden="true">
                <EditIcon :size="14" />
              </span>
              on any row to edit
            </p>
          </div>
        </div>

        <div class="rm-matrix-wrap">
          <table class="rm-matrix">
            <thead>
              <tr>

                <!-- Corner: KM header controls -->
                <th class="rm-th-corner">
                  <div class="rm-corner-inner">
                    <span class="rm-corner-label">Load (ltr) \ KM</span>
                    <!-- View mode -->
                    <div v-if="!editingKmHeaders" class="rm-corner-actions">
                      <button
                        class="rm-icon-btn rm-icon-btn--ghost"
                        title="Edit KM column ranges"
                        :disabled="editingRowIndex !== null"
                        @click="startEditKm"
                      >
                        <EditIcon :size="14" />
                        <span>Edit KM</span>
                      </button>
                    </div>
                    <!-- KM edit mode -->
                    <div v-else class="rm-corner-actions">
                      <button class="rm-icon-btn rm-icon-btn--add" :disabled="saving" title="Add a KM column" @click="addColumn">
                        <AddIcon :size="13" />
                        <span>Add Col</span>
                      </button>
                      <button class="rm-icon-btn rm-icon-btn--save" :disabled="saving" title="Save KM ranges" @click="saveEditKm">
                        <CheckIcon :size="14" :stroke-width="2.5" />
                        <span>Save</span>
                      </button>
                      <button class="rm-icon-btn rm-icon-btn--cancel" :disabled="saving" title="Cancel" @click="cancelEditKm">
                        <CloseIcon :size="14" :stroke-width="2.5" />
                      </button>
                    </div>
                  </div>
                </th>

                <!-- KM column headers -->
                <th v-for="(range, ki) in kmRanges" :key="ki" class="rm-th-km">
                  <!-- View -->
                  <template v-if="!editingKmHeaders">
                    <span class="rm-km-label">{{ range.min.toLocaleString() }}–{{ range.max.toLocaleString() }}</span>
                  </template>
                  <!-- Edit -->
                  <template v-else>
                    <div class="rm-km-edit-wrap">
                      <div class="rm-range-hd">
                        <input v-model.number="range.min" type="number" min="0" class="rm-range-input" @change="syncKmRange(ki)" />
                        <span class="rm-range-sep">–</span>
                        <input v-model.number="range.max" type="number" min="0" class="rm-range-input" @change="syncKmRange(ki)" />
                      </div>
                      <button class="rm-col-del-btn" :disabled="saving" title="Delete this column" @click="deleteColumn(ki)">
                        <TrashIcon :size="11" />
                      </button>
                    </div>
                  </template>
                </th>

                <!-- Actions column header -->
                <th class="rm-th-actions"></th>
              </tr>
            </thead>

            <tbody>
              <tr
                v-for="(loadRange, li) in loadRanges"
                :key="li"
                :class="['rm-tr', editingRowIndex === li && 'rm-tr--editing']"
              >
                <!-- Load range cell -->
                <td class="rm-td-load">
                  <span v-if="editingRowIndex !== li" class="rm-load-label">
                    {{ loadRange.min.toLocaleString() }} – {{ loadRange.max.toLocaleString() }}
                  </span>
                  <div v-else class="rm-range-hd rm-range-hd--row">
                    <input v-model.number="loadRange.min" type="number" min="0" class="rm-range-input rm-range-input--load" @change="syncLoadRange(li)" />
                    <span class="rm-range-sep">–</span>
                    <input v-model.number="loadRange.max" type="number" min="0" class="rm-range-input rm-range-input--load" @change="syncLoadRange(li)" />
                  </div>
                </td>

                <!-- Rate cells -->
                <td v-for="(_, ki) in kmRanges" :key="ki" class="rm-td-cell">
                  <template v-if="matrix[li]?.[ki]">
                    <span v-if="editingRowIndex !== li" class="rm-rate-val">
                      {{ Number(matrix[li][ki].rate_per_trip).toFixed(2) }}
                    </span>
                    <input
                      v-else
                      v-model.number="matrix[li][ki].rate_per_trip"
                      type="number" min="0" step="1"
                      class="rm-rate-input"
                    />
                  </template>
                </td>

                <!-- Row actions -->
                <td class="rm-td-row-actions">
                  <template v-if="editingRowIndex !== li">
                    <div class="rm-row-actions-wrap">
                      <button
                        class="rm-icon-btn rm-icon-btn--ghost rm-row-hover-btn"
                        title="Edit this row"
                        :disabled="editingRowIndex !== null || editingKmHeaders"
                        @click="startEditRow(li)"
                      >
                        <EditIcon :size="14" />
                      </button>
                      <button
                        class="rm-icon-btn rm-icon-btn--del rm-row-hover-btn"
                        title="Delete this row"
                        :disabled="editingRowIndex !== null || editingKmHeaders"
                        @click="deleteRow(li)"
                      >
                        <TrashIcon :size="14" />
                      </button>
                    </div>
                  </template>
                  <template v-else>
                    <div class="rm-row-edit-actions">
                      <button class="rm-icon-btn rm-icon-btn--save" :disabled="saving" title="Save row" @click="saveEditRow(li)">
                        <CheckIcon :size="14" :stroke-width="2.5" />
                      </button>
                      <button class="rm-icon-btn rm-icon-btn--cancel" title="Cancel" @click="cancelEditRow">
                        <CloseIcon :size="14" :stroke-width="2.5" />
                      </button>
                    </div>
                  </template>
                </td>
              </tr>
            </tbody>

            <!-- Add Row -->
            <tfoot>
              <tr>
                <td :colspan="kmRanges.length + 2" class="rm-add-row-td">
                  <button
                    class="rm-add-row-btn"
                    :disabled="editingRowIndex !== null || editingKmHeaders"
                    @click="addRow"
                  >
                    <AddIcon :size="14" :stroke-width="2.5" />
                    Add Load Range
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p class="rm-matrix-hint">
          <InfoIcon :size="15" />
          Click <span class="rm-inline-icon" aria-hidden="true"><EditIcon :size="14" /></span> to edit row rates ·
          Click "Edit KM" to add/remove/rename KM columns ·
          Click "Add Load Range" to add a new row
        </p>
      </div>

      <!-- ════════════════════════════════════════════════════════
           SPECIAL NOTE RATES
      ════════════════════════════════════════════════════════ -->
      <div v-if="activeTab === 'special-notes'" class="rm-card">
        <div class="rm-card-hd">
          <div>
            <p class="rm-card-title">Special Note Rates</p>
            <p class="rm-card-sub">Additional allowance per trip in RM</p>
          </div>
          <button class="rm-add-btn" @click="addNote">
            <AddIcon :size="16" :stroke-width="2.5" />
            Add Note Type
          </button>
        </div>

        <!-- Column labels -->
        <div v-if="specialRates.length" class="rm-sn-col-labels">
          <span>Note Type</span>
          <span>Allowance (RM)</span>
          <span></span>
        </div>

        <!-- Rows -->
        <div class="rm-special-list">
          <div
            v-for="(rate, index) in specialRates"
            :key="index"
            :class="['rm-special-row', editingNoteIndex === index && 'rm-special-row--editing']"
          >

            <!-- ── VIEW mode ────────────────────────────────── -->
            <template v-if="editingNoteIndex !== index">
              <div class="rm-sn-type-view">
                <span :class="['rm-color-dot', `rm-dot--${noteColor(index)}`]"></span>
                <div class="rm-sn-type-stack">
                  <span class="rm-sn-type-text">{{ rate.label || rate.note_key || '—' }}</span>
                  <div class="rm-sn-meta">
                    <span v-if="rate.starts_at || rate.ends_at" class="rm-meta-chip rm-meta-chip--date">
                      {{ rate.starts_at ? fmtDate(rate.starts_at) : '…' }} → {{ rate.ends_at ? fmtDate(rate.ends_at) : '…' }}
                    </span>
                    <span class="rm-meta-chip rm-meta-chip--scope">
                      Apply to: {{ scopeLabel(rate.scope) }}
                    </span>
                    <span v-if="rate.bases?.length" class="rm-meta-chip rm-meta-chip--bases">
                      Bases: {{ rate.bases.join(' · ') }}
                    </span>
                    <span v-if="rate.driver_targets?.length" class="rm-meta-chip">
                      {{ rate.driver_targets.filter(d => d.effect === 'include').length }} incl ·
                      {{ rate.driver_targets.filter(d => d.effect === 'exclude').length }} excl
                    </span>
                  </div>
                </div>
              </div>
              <div class="rm-sn-rate-view">
                <span class="rm-sn-rate-rm">RM</span>
                <span class="rm-sn-rate-val">{{ Number(rate.allowance).toFixed(2) }}</span>
              </div>
              <div class="rm-sn-view-actions">
                <button
                  class="rm-icon-btn rm-icon-btn--ghost"
                  title="Edit"
                  :disabled="editingNoteIndex !== null"
                  @click="startEditNote(index)"
                >
                  <EditIcon :size="14" />
                </button>
                <button
                  class="rm-icon-btn rm-icon-btn--del"
                  title="Delete"
                  :disabled="editingNoteIndex !== null"
                  @click="deleteNote(index)"
                >
                  <TrashIcon :size="14" />
                </button>
              </div>
            </template>

            <!-- ── EDIT mode ────────────────────────────────── -->
            <template v-else>
              <div class="rm-sn-type-edit">
                <span :class="['rm-color-dot', `rm-dot--${noteColor(index)}`]"></span>
                <input
                  v-model="rate.label"
                  type="text"
                  class="rm-sn-type-input"
                  placeholder="e.g. Hari Raya Allowance"
                  maxlength="120"
                  autofocus
                />
              </div>
              <div class="rm-sn-rate-edit">
                <span class="rm-rm-prefix">RM</span>
                <input
                  v-model.number="rate.allowance"
                  type="number" step="0.01" min="0"
                  class="rm-special-input"
                />
              </div>
              <div class="rm-sn-edit-actions">
                <button class="rm-icon-btn rm-icon-btn--save" :disabled="saving" title="Save" @click="saveEditNote(index)">
                  <CheckIcon :size="14" :stroke-width="2.5" />
                </button>
                <button class="rm-icon-btn rm-icon-btn--cancel" title="Cancel" @click="cancelEditNote">
                  <CloseIcon :size="14" :stroke-width="2.5" />
                </button>
              </div>

              <!-- ── Advanced: date window + scope + targets ─── -->
              <div class="rm-sn-adv">
                <!-- Effective window -->
                <div class="rm-sn-adv-row">
                  <label class="rm-sn-adv-label">
                    <InfoIcon :size="13" /> Effective window
                  </label>
                  <div class="rm-sn-adv-ctrl rm-window">
                    <DatePicker
                      v-model="rate.starts_at"
                      placeholder="Starts (optional)"
                      aria-label="Allowance start date"
                    />
                    <span class="rm-window-sep">→</span>
                    <DatePicker
                      v-model="rate.ends_at"
                      placeholder="Ends (optional)"
                      :min="rate.starts_at || ''"
                      aria-label="Allowance end date"
                    />
                    <button
                      v-if="rate.starts_at || rate.ends_at"
                      type="button"
                      class="rm-link-btn"
                      @click="rate.starts_at = ''; rate.ends_at = ''"
                    >Clear</button>
                  </div>
                </div>

                <!-- Scope + targets: 2-column on desktop (Apply To | Bases/Drivers) -->
                <div class="rm-sn-scope-group">

                  <!-- Col 1: Apply To -->
                  <div class="rm-sn-adv-row">
                    <label class="rm-sn-adv-label">
                      <InfoIcon :size="13" /> Apply to
                    </label>
                    <div class="rm-sn-adv-ctrl">
                      <SelectInput
                        v-model="rate.scope"
                        :options="SCOPE_OPTIONS"
                        :clearable="false"
                        placeholder="Select scope"
                      />
                    </div>
                  </div>

                  <!-- Col 2: Bases / Driver overrides (conditional) -->
                  <div class="rm-sn-scope-targets">

                    <!-- Bases -->
                    <div v-if="rate.scope === 'bases' || rate.scope === 'mixed'" class="rm-sn-adv-row">
                      <label class="rm-sn-adv-label">Bases</label>
                      <div class="rm-sn-adv-ctrl rm-chips">
                        <template v-if="optionBases.length">
                          <button
                            v-for="b in optionBases"
                            :key="b.code"
                            type="button"
                            :class="['rm-chip', isBaseSelected(rate, b.code) && 'rm-chip--on']"
                            :title="b.label"
                            @click="toggleBase(rate, b.code)"
                          >{{ b.code }}</button>
                        </template>
                        <span v-else class="rm-empty-hint">
                          No bases set on any driver yet — add a "base" value to drivers first.
                        </span>
                      </div>
                    </div>

                    <!-- Drivers -->
                    <div v-if="rate.scope === 'drivers' || rate.scope === 'mixed'" class="rm-sn-adv-row">
                      <label class="rm-sn-adv-label">
                        {{ rate.scope === 'mixed' ? 'Driver overrides' : 'Drivers' }}
                      </label>
                      <div class="rm-sn-adv-ctrl rm-driver-block">
                        <input
                          v-model="driverPickerQuery"
                          type="text"
                          class="rm-driver-search"
                          placeholder="Search drivers by name or ID…"
                        />
                        <div class="rm-driver-list">
                          <div
                            v-for="d in filteredOptionDrivers"
                            :key="d.id"
                            class="rm-driver-row"
                          >
                            <div class="rm-driver-info">
                              <span class="rm-driver-name">{{ d.name }}</span>
                              <span class="rm-driver-meta">{{ d.driver_id }}<span v-if="d.base"> · {{ d.base }}</span></span>
                            </div>
                            <div class="rm-driver-actions">
                              <button
                                type="button"
                                :class="['rm-driver-btn', driverEffect(rate, d.id) === 'include' && 'rm-driver-btn--on-incl']"
                                title="Include this driver"
                                @click="setDriverTarget(rate, d.id, driverEffect(rate, d.id) === 'include' ? null : 'include')"
                              >+ Include</button>
                              <button
                                type="button"
                                :class="['rm-driver-btn', driverEffect(rate, d.id) === 'exclude' && 'rm-driver-btn--on-excl']"
                                title="Exclude this driver from the allowance"
                                @click="setDriverTarget(rate, d.id, driverEffect(rate, d.id) === 'exclude' ? null : 'exclude')"
                              >– Exclude</button>
                            </div>
                          </div>
                          <div v-if="!filteredOptionDrivers.length" class="rm-empty-hint">
                            No matching drivers.
                          </div>
                        </div>
                        <p v-if="rate.scope === 'mixed'" class="rm-driver-help">
                          Tip: Driver-level <strong>Exclude</strong> overrides base-level inclusion.
                          Use <strong>Include</strong> to add a driver outside their base.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </template>

          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!specialRates.length" class="rm-sn-empty">
          <BatchIcon :size="22" :stroke-width="1.5" />
          <p>No special note types yet — click <strong>Add Note Type</strong> to create one</p>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
/* ── No spinner arrows ───────────────────────────────────────────────────── */
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
input[type=number] { -moz-appearance: textfield; appearance: textfield; }

/* ── Root ────────────────────────────────────────────────────────────────── */
.rm { min-width: 0; }

/* ── Banner ──────────────────────────────────────────────────────────────── */
.rm-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 20px;
  position: relative; overflow: hidden;
}
.rm-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--c-amber); border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .rm-banner { padding: 18px 24px; margin-bottom: 24px; } }
.rm-banner-left { display: flex; align-items: center; gap: 12px; }
.rm-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-amber); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.rm-banner-icon svg { width: 20px; height: 20px; }
.rm-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -.02em; margin-bottom: 1px; }
@media (min-width: 640px) { .rm-banner-title { font-size: 1.25rem; } }
.rm-banner-sub { font-size: .8125rem; color: var(--c-text-3); }

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.rm-tabs {
  display: flex; gap: 4px; margin-bottom: 16px;
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: 10px; padding: 4px;
}
.rm-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 7px; border: none; background: transparent;
  font-size: 0.84rem; font-weight: 600; color: var(--c-text-2);
  cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.rm-tab:hover { color: var(--c-text-1); }
.rm-tab--active {
  background: var(--c-surface); color: var(--c-text-1);
  box-shadow: var(--sh-sm);
}
.rm-tab-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 4px;
  border-radius: var(--r-full); background: var(--c-amber-tint);
  color: var(--c-amber); font-size: 0.65rem; font-weight: 700;
}
@media (min-width: 640px) { .rm-tabs { margin-bottom: 20px; } }

/* ── Loading ─────────────────────────────────────────────────────────────── */
.rm-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--c-text-3); }
.rm-spinner { width: 20px; height: 20px; border: 2px solid var(--c-border); border-top-color: var(--c-amber); border-radius: 50%; animation: rm-spin .7s linear infinite; }
@keyframes rm-spin { to { transform: rotate(360deg); } }

/* ── Card ────────────────────────────────────────────────────────────────── */
.rm-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 18px 20px; margin-bottom: 16px; overflow: hidden;
}
@media (min-width: 640px) { .rm-card { padding: 20px 24px; } }
.rm-card-hd {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 14px; flex-wrap: wrap;
}
.rm-card-title { font-size: .9375rem; font-weight: 600; color: var(--c-text-1); letter-spacing: -.01em; }
.rm-card-sub   { font-size: .8125rem; color: var(--c-text-3); margin-top: 2px; display: flex; align-items: center; flex-wrap: wrap; gap: 3px; }
.rm-card-sub strong { color: var(--c-text-2); }
.rm-inline-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 5px; flex-shrink: 0;
  border: 1.5px solid var(--c-border); background: var(--c-bg); color: var(--c-text-2);
  vertical-align: middle;
}
.rm-inline-icon svg { width: 11px; height: 11px; }

/* ── Shared icon button ──────────────────────────────────────────────────── */
.rm-icon-btn {
  display: inline-flex; align-items: center; gap: 5px; flex-shrink: 0;
  height: 30px; padding: 0 10px; border-radius: 7px; border: 1.5px solid var(--c-border);
  background: transparent; font-size: .75rem; font-weight: 600; cursor: pointer;
  transition: all var(--dur); white-space: nowrap;
}
.rm-icon-btn svg { width: 13px; height: 13px; }
.rm-icon-btn:disabled { opacity: .4; cursor: not-allowed; }

.rm-icon-btn--ghost  { color: var(--c-text-2); }
.rm-icon-btn--ghost:hover:not(:disabled)  { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-accent-tint); }
.rm-icon-btn--save   { border-color: #16A34A; color: #16A34A; background: rgba(22,163,74,.06); }
.rm-icon-btn--save:hover:not(:disabled)   { background: rgba(22,163,74,.14); }
.rm-icon-btn--cancel { border-color: var(--c-border); color: var(--c-text-3); }
.rm-icon-btn--cancel:hover:not(:disabled) { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }
.rm-icon-btn--del    { border-color: var(--c-border); color: var(--c-text-3); padding: 0 8px; }
.rm-icon-btn--del:hover:not(:disabled)    { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }

/* Add button */
.rm-add-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border: 1.5px dashed var(--c-border);
  border-radius: 8px; background: transparent; color: var(--c-text-2);
  font-size: .8125rem; font-weight: 600; cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.rm-add-btn svg { width: 13px; height: 13px; }
.rm-add-btn:hover { border-color: var(--c-amber); color: var(--c-amber); background: var(--c-amber-tint); }

/* ── Matrix ──────────────────────────────────────────────────────────────── */
.rm-matrix-wrap { overflow-x: auto; border-radius: var(--r-lg); border: 1px solid var(--c-border); margin-bottom: 10px; }
.rm-matrix { width: 100%; border-collapse: collapse; font-size: .8125rem; min-width: 740px; }

/* Corner */
.rm-th-corner {
  padding: 10px 12px; background: var(--c-bg);
  border-bottom: 1px solid var(--c-border); border-right: 1px solid var(--c-border);
  min-width: 210px; vertical-align: middle;
}
.rm-corner-inner { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.rm-corner-label { font-size: .6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--c-text-3); white-space: nowrap; }
.rm-corner-actions { display: flex; align-items: center; gap: 4px; }

/* KM column headers */
.rm-th-km {
  padding: 8px 8px; background: var(--c-bg); text-align: center;
  border-bottom: 1px solid var(--c-border); border-right: 1px solid var(--c-border-light);
  min-width: 108px;
}
.rm-th-km:last-of-type { border-right: none; }
.rm-km-label { font-size: .72rem; font-weight: 600; color: var(--c-text-2); white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Actions column header */
.rm-th-actions { width: 76px; background: var(--c-bg); border-bottom: 1px solid var(--c-border); }

/* Add-column button */
.rm-icon-btn--add { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-accent-tint); }
.rm-icon-btn--add:hover:not(:disabled) { background: rgba(29,78,216,.14); }

/* Range inputs (shared by KM header + load row header) */
.rm-range-hd { display: flex; align-items: center; gap: 2px; justify-content: center; }
.rm-range-hd--row { justify-content: flex-start; }
.rm-range-input {
  width: 50px; padding: 4px 5px; border: 1.5px solid var(--c-border); border-radius: 6px;
  font-size: .72rem; text-align: center; background: var(--c-surface); color: var(--c-text-1);
  font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums;
  transition: border-color var(--dur);
}
.rm-range-input--load { width: 62px; }
.rm-range-input:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 2px var(--c-accent-ring); }
.rm-range-sep { font-size: .8rem; color: var(--c-text-3); flex-shrink: 0; padding: 0 1px; }

/* Row */
.rm-tr { transition: background var(--dur); }
.rm-tr:hover .rm-td-cell,
.rm-tr:hover .rm-td-load { background: var(--c-hover); }
.rm-tr--editing .rm-td-cell,
.rm-tr--editing .rm-td-load { background: rgba(29,78,216,.04) !important; }

/* Load range cell (row header) */
.rm-td-load {
  padding: 8px 12px; background: var(--c-bg);
  border-bottom: 1px solid var(--c-border-light); border-right: 1px solid var(--c-border);
  white-space: nowrap;
}
.rm-load-label { font-size: .78rem; font-weight: 600; color: var(--c-text-2); font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
.rm-matrix tbody tr:last-child .rm-td-load { border-bottom: none; }

/* Rate cells */
.rm-td-cell {
  padding: 6px 6px; text-align: center;
  border-bottom: 1px solid var(--c-border-light); border-right: 1px solid var(--c-border-light);
}
.rm-td-cell:last-of-type { border-right: none; }
.rm-matrix tbody tr:last-child .rm-td-cell { border-bottom: none; }

.rm-rate-val {
  display: block; font-size: .8125rem; font-weight: 500; color: var(--c-text-1);
  font-variant-numeric: tabular-nums; text-align: center;
}
.rm-rate-input {
  width: 64px; padding: 5px 6px; border: 1.5px solid var(--c-accent);
  border-radius: 6px; font-size: .8125rem; text-align: center;
  background: var(--c-surface); color: var(--c-text-1);
  font-variant-numeric: tabular-nums; outline: none;
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}

/* KM header edit wrapper */
.rm-km-edit-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; }

/* Column delete button */
.rm-col-del-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 5px;
  border: 1px solid var(--c-border); background: transparent;
  color: var(--c-text-3); cursor: pointer; transition: all var(--dur);
}
.rm-col-del-btn svg { width: 10px; height: 10px; }
.rm-col-del-btn:hover:not(:disabled) { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }
.rm-col-del-btn:disabled { opacity: .4; cursor: not-allowed; }

/* Row actions column */
.rm-td-row-actions {
  padding: 6px 8px; text-align: center; white-space: nowrap;
  border-bottom: 1px solid var(--c-border-light);
}
.rm-matrix tbody tr:last-child .rm-td-row-actions { border-bottom: none; }
.rm-row-actions-wrap { display: flex; align-items: center; gap: 4px; justify-content: center; }
.rm-row-hover-btn { opacity: 0; transition: opacity var(--dur), border-color var(--dur), color var(--dur), background var(--dur); }
.rm-tr:hover .rm-row-hover-btn { opacity: 1; }
.rm-row-edit-actions { display: flex; align-items: center; gap: 4px; justify-content: center; }

/* Add row footer */
.rm-add-row-td { padding: 0; border-top: 1px dashed var(--c-border-light); }
.rm-add-row-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 10px; background: transparent; border: none;
  font-size: .8125rem; font-weight: 600; color: var(--c-text-3);
  cursor: pointer; transition: all var(--dur);
}
.rm-add-row-btn svg { width: 14px; height: 14px; }
.rm-add-row-btn:hover:not(:disabled) { color: var(--c-accent); background: var(--c-accent-tint); }
.rm-add-row-btn:disabled { opacity: .4; cursor: not-allowed; }

.rm-matrix-hint {
  display: flex; align-items: center; gap: 4px;
  font-size: .72rem; color: var(--c-text-3); margin-top: 6px; flex-wrap: wrap;
}
.rm-matrix-hint svg { width: 13px; height: 13px; flex-shrink: 0; }

/* ── Special notes ───────────────────────────────────────────────────────── */
.rm-sn-col-labels {
  display: grid; grid-template-columns: 1fr 180px 76px;
  padding: 0 14px 8px; gap: 12px;
  font-size: .6875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .06em; color: var(--c-text-3);
  border-bottom: 1px solid var(--c-border-light); margin-bottom: 2px;
}
.rm-special-list { display: flex; flex-direction: column; }

.rm-special-row {
  display: grid; grid-template-columns: 1fr 180px 76px;
  align-items: center; gap: 12px;
  padding: 9px 14px; border-radius: var(--r-lg); transition: background var(--dur);
}
.rm-special-row:hover { background: var(--c-bg); }
.rm-special-row--editing { background: rgba(29,78,216,.04) !important; }

/* View cells */
.rm-sn-type-view { display: flex; align-items: center; gap: 10px; }
.rm-sn-type-text { font-size: .875rem; font-weight: 500; color: var(--c-text-1); text-transform: capitalize; }
.rm-sn-rate-view { display: flex; align-items: center; gap: 6px; }
.rm-sn-rate-rm   { font-size: .75rem; font-weight: 600; color: var(--c-text-3); }
.rm-sn-rate-val  { font-size: .9rem; font-weight: 700; color: var(--c-text-1); font-variant-numeric: tabular-nums; min-width: 52px; }
.rm-sn-rate-suffix { font-size: .72rem; color: var(--c-text-3); }
.rm-sn-view-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }

/* Edit cells */
.rm-sn-type-edit { display: flex; align-items: center; gap: 8px; }
.rm-sn-type-input {
  flex: 1; min-width: 0; padding: 6px 10px;
  border: 1.5px solid var(--c-accent); border-radius: var(--r-md);
  font-size: .875rem; background: var(--c-surface); color: var(--c-text-1);
  outline: none; box-shadow: 0 0 0 3px var(--c-accent-ring);
  text-transform: lowercase;
}
.rm-sn-type-input::placeholder { color: var(--c-text-3); text-transform: none; }
.rm-sn-rate-edit { display: flex; align-items: center; gap: 6px; }
.rm-rm-prefix  { font-size: .8125rem; font-weight: 600; color: var(--c-text-3); flex-shrink: 0; }
.rm-sn-suffix  { font-size: .75rem; color: var(--c-text-3); flex-shrink: 0; }
.rm-special-input {
  width: 80px; padding: 6px 8px; border: 1.5px solid var(--c-accent); border-radius: var(--r-md);
  font-size: .875rem; text-align: right; background: var(--c-surface); color: var(--c-text-1);
  outline: none; font-variant-numeric: tabular-nums;
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.rm-sn-edit-actions { display: flex; align-items: center; gap: 4px; justify-content: flex-end; }

/* Color dots */
.rm-color-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
.rm-dot--amber  { background: #D97706; }
.rm-dot--green  { background: #16A34A; }
.rm-dot--orange { background: #EA580C; }
.rm-dot--blue   { background: #1D4ED8; }
.rm-dot--purple { background: #7C3AED; }
.rm-dot--teal   { background: #0891B2; }
.rm-dot--red    { background: #DC2626; }
.rm-dot--indigo { background: #4338CA; }

/* Empty state */
.rm-sn-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 2.5rem 1rem; color: var(--c-text-3); text-align: center;
}
.rm-sn-empty svg { width: 32px; height: 32px; opacity: .35; }
.rm-sn-empty p { font-size: .875rem; max-width: 320px; line-height: 1.5; }
.rm-sn-empty strong { color: var(--c-text-2); }

/* ── Special-note view-mode meta chips ───────────────────────────────────── */
.rm-sn-type-stack { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rm-sn-meta { display: flex; flex-wrap: wrap; gap: 4px; }
.rm-meta-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .68rem; font-weight: 600; color: var(--c-text-3);
  background: var(--c-bg); border: 1px solid var(--c-border-light);
  padding: 1px 7px; border-radius: 999px;
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.rm-meta-chip--date {
  color: var(--c-amber); border-color: var(--c-amber);
  background: var(--c-amber-tint);
}

/* ── Special-note edit-mode advanced section ─────────────────────────────── */
.rm-special-row--editing { align-items: start; }
.rm-sn-adv {
  grid-column: 1 / -1;
  display: flex; flex-direction: column; gap: 10px;
  margin-top: 8px; padding-top: 12px;
  border-top: 1px dashed var(--c-border-light);
}
.rm-sn-adv-row {
  display: grid; grid-template-columns: 1fr; gap: 4px;
  align-items: start;
}
@media (min-width: 480px) {
  .rm-sn-adv-row { grid-template-columns: 130px 1fr; gap: 12px; }
}
.rm-sn-adv-label {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  color: var(--c-text-3); padding-top: 6px;
}
.rm-sn-adv-label svg { width: 12px; height: 12px; }
.rm-sn-adv-ctrl { min-width: 0; }

/* Apply To + Bases/Drivers side-by-side on desktop */
.rm-sn-scope-group {
  display: flex; flex-direction: column; gap: 10px;
}
.rm-sn-scope-targets { display: flex; flex-direction: column; gap: 10px; }
@media (min-width: 640px) {
  .rm-sn-scope-group {
    display: grid; grid-template-columns: 1fr 2fr; gap: 0 20px; align-items: start;
  }
}

.rm-window { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.rm-window-sep { color: var(--c-text-3); font-weight: 600; }
.rm-link-btn {
  background: transparent; border: none; padding: 2px 6px;
  font-size: .75rem; font-weight: 600; color: var(--c-text-3);
  cursor: pointer; border-radius: 5px;
}
.rm-link-btn:hover { color: var(--c-red); background: var(--c-red-tint); }

.rm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.rm-chip {
  padding: 5px 11px; border-radius: 999px;
  border: 1.5px solid var(--c-border); background: var(--c-surface);
  font-size: .78rem; font-weight: 600; color: var(--c-text-2);
  cursor: pointer; transition: all var(--dur);
}
.rm-chip:hover { border-color: var(--c-accent); color: var(--c-accent); }
.rm-chip--on {
  background: var(--c-accent); color: #fff; border-color: var(--c-accent);
}

.rm-empty-hint {
  font-size: .76rem; color: var(--c-text-3); font-style: italic; padding: 6px 2px;
}

.rm-driver-block { display: flex; flex-direction: column; gap: 8px; max-width: 540px; }
.rm-driver-search {
  width: 100%; padding: 6px 10px;
  border: 1.5px solid var(--c-border); border-radius: var(--r-md);
  font-size: .8125rem; background: var(--c-surface); color: var(--c-text-1);
}
.rm-driver-search:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-ring); }

.rm-driver-list {
  display: flex; flex-direction: column;
  max-height: 220px; overflow-y: auto;
  border: 1px solid var(--c-border-light); border-radius: var(--r-md);
  background: var(--c-bg);
}
.rm-driver-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 7px 10px; border-bottom: 1px solid var(--c-border-light);
}
.rm-driver-row:last-child { border-bottom: none; }
.rm-driver-info { display: flex; flex-direction: column; min-width: 0; }
.rm-driver-name { font-size: .82rem; font-weight: 600; color: var(--c-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rm-driver-meta { font-size: .68rem; color: var(--c-text-3); }

.rm-driver-actions { display: flex; gap: 4px; flex-shrink: 0; }
.rm-driver-btn {
  padding: 3px 9px; font-size: .68rem; font-weight: 700;
  border: 1.5px solid var(--c-border); background: transparent; color: var(--c-text-3);
  border-radius: 6px; cursor: pointer; transition: all var(--dur); white-space: nowrap;
}
.rm-driver-btn:hover { border-color: var(--c-text-2); color: var(--c-text-1); }
.rm-driver-btn--on-incl {
  background: rgba(22,163,74,.12); border-color: #16A34A; color: #16A34A;
}
.rm-driver-btn--on-excl {
  background: var(--c-red-tint); border-color: var(--c-red); color: var(--c-red);
}
.rm-driver-help { font-size: .72rem; color: var(--c-text-3); }
.rm-driver-help strong { color: var(--c-text-2); }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .rm-sn-col-labels { grid-template-columns: 1fr 130px 68px; }
  .rm-special-row   { grid-template-columns: 1fr 130px 68px; }
  .rm-special-input { width: 62px; }
  .rm-sn-suffix, .rm-sn-rate-suffix { display: none; }
  .rm-icon-btn span { display: none; }
  .rm-icon-btn { padding: 0 7px; }
  .rm-sn-adv-row { grid-template-columns: 1fr; gap: 4px; }
  .rm-sn-adv-label { padding-top: 0; }
}
</style>
