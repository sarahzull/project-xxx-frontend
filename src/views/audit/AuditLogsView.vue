<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import auditLogsApi    from '../../api/auditLogs'
import SearchInput     from '../../components/common/SearchInput.vue'
import DateRangePicker from '../../components/common/DateRangePicker.vue'
import AppPagination   from '../../components/common/AppPagination.vue'
import {
  AuditLogIcon, FilterIcon, CloseIcon, SearchIcon, CheckIcon,
  ChevronDownIcon,
} from '../../components/icons/index.js'

// ── State ──────────────────────────────────────────────────────────────────────
const logs    = ref([])
const meta    = ref({})
const stats   = ref({})
const loading = ref(true)
const error   = ref('')

// Default the date range to today, per spec.
function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const initialFrom = todayISO()
const initialTo   = todayISO()

const tableFilter  = ref('')
const actionFilter = ref('')
const userFilter   = ref('')
const dateFrom     = ref(initialFrom)
const dateTo       = ref(initialTo)
const search       = ref('')
const page         = ref(1)

// Action enum is fixed — show all four even before any of those types
// have actually been recorded, so admins can pre-filter.
const ALL_ACTIONS = ['INSERT', 'UPDATE', 'DELETE', 'EXPORT']

const availableTables  = computed(() => stats.value.tables ?? [])
const availableUsers   = computed(() => stats.value.users  ?? [])

// ── Searchable dropdowns (pattern matches Trips → Oil Company filter) ────────
const showTableDrop  = ref(false)
const showActionDrop = ref(false)
const showUserDrop   = ref(false)
const tableSearch    = ref('')
const userSearch     = ref('')
const tableDropRef   = ref(null)
const actionDropRef  = ref(null)
const userDropRef    = ref(null)

const filteredTableOptions = computed(() => {
  const q = tableSearch.value.toLowerCase()
  if (!q) return availableTables.value
  return availableTables.value.filter(t =>
    t.toLowerCase().includes(q) || tableLabel(t).toLowerCase().includes(q)
  )
})

const filteredUserOptions = computed(() => {
  const q = userSearch.value.toLowerCase()
  if (!q) return availableUsers.value
  return availableUsers.value.filter(u =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  )
})

const selectedUser = computed(() =>
  availableUsers.value.find(u => String(u.id) === String(userFilter.value))
)

function selectTable(value) {
  tableFilter.value = value
  showTableDrop.value = false
  tableSearch.value = ''
}
function selectAction(value) {
  actionFilter.value = value
  showActionDrop.value = false
}
function selectUser(value) {
  userFilter.value = value
  showUserDrop.value = false
  userSearch.value = ''
}

function onDocClick(e) {
  if (showTableDrop.value && tableDropRef.value && !tableDropRef.value.contains(e.target)) {
    showTableDrop.value = false
  }
  if (showActionDrop.value && actionDropRef.value && !actionDropRef.value.contains(e.target)) {
    showActionDrop.value = false
  }
  if (showUserDrop.value && userDropRef.value && !userDropRef.value.contains(e.target)) {
    showUserDrop.value = false
  }
}

const hasFilter = computed(() =>
  tableFilter.value || actionFilter.value || userFilter.value ||
  search.value ||
  dateFrom.value !== initialFrom || dateTo.value !== initialTo
)

function resetFilters() {
  tableFilter.value  = ''
  actionFilter.value = ''
  userFilter.value   = ''
  search.value       = ''
  dateFrom.value     = initialFrom
  dateTo.value       = initialTo
  page.value         = 1
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const KL_TZ = 'Asia/Kuala_Lumpur'

// Field names we never want to surface in the audit feed — either sensitive
// (credentials/tokens) or already redundant elsewhere on the page.
const SENSITIVE_FIELDS = new Set([
  'password',
  'password_hash',
  'remember_token',
  'api_token',
  'two_factor_secret',
  'two_factor_recovery_codes',
])

function formatDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-GB', {
    timeZone: KL_TZ,
    day: '2-digit', month: 'short', year: 'numeric',
  })
}
function formatTime(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleTimeString('en-GB', {
    timeZone: KL_TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
}
function formatDateTime(s) {
  return `${formatDate(s)} ${formatTime(s)}`.trim()
}

function actionLabel(a) {
  switch (String(a || '').toUpperCase()) {
    case 'INSERT': return 'Created'
    case 'UPDATE': return 'Updated'
    case 'DELETE': return 'Deleted'
    case 'EXPORT': return 'Exported'
    default: return a || '—'
  }
}

function tableLabel(t) {
  const map = {
    users:                 'Users',
    roles:                 'Roles',
    trip_rates:                'Trip rates',
    special_note_rates:        'Special note rates',
    special_note_rate_bases:   'Special note — base targets',
    special_note_rate_drivers: 'Special note — driver targets',
    payroll_batches:           'Payroll batches',
    compensation_records:  'Compensation records',
    driver_communications: 'Driver communications',
    driver_notifications:  'Driver notifications',
  }
  return map[t] || t
}

// After migration 003 each audit row holds ONE column-level change in
// scalar text, so the table can show the diff inline without an expander.
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/

function formatValue(v) {
  if (v === null || v === undefined || v === '') return '—'
  const s = String(v)
  // Detect ISO-ish datetime strings and render as dd/mm/yyyy HH:mm:ss in KL time
  if (ISO_DATETIME_RE.test(s.trim())) {
    const d = new Date(s)
    if (!Number.isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: KL_TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc }, {})
      // en-GB format: dd/mm/yyyy with comma — rebuild as dd/mm/yyyy HH:mm:ss
      return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`
    }
  }
  return s.length > 80 ? s.slice(0, 80) + '…' : s
}

// Field-aware human label so audit entries read like the admin UI.
// e.g. is_active=true → "Active", read_at=null → "—".
const FIELD_VALUE_LABELS = {
  is_active: { true: 'Active', false: 'Blocked', 1: 'Active', 0: 'Blocked' },
  status:    { draft: 'Pending', confirmed: 'Approved', exported: 'Paid' },
}
const BOOLEAN_LIKE = new Set(['true', 'false', '1', '0', 't', 'f'])
function asBoolLabel(v) {
  switch (String(v).toLowerCase()) {
    case 'true':
    case '1':
    case 't':  return 'Yes'
    case 'false':
    case '0':
    case 'f':  return 'No'
    default:   return v
  }
}

function displayValue(field, raw) {
  if (raw === null || raw === undefined || raw === '') return '—'
  const map = FIELD_VALUE_LABELS[String(field || '').toLowerCase()]
  if (map && map[String(raw).toLowerCase()] !== undefined) {
    return map[String(raw).toLowerCase()]
  }
  // Generic boolean translation when no field-specific mapping is defined.
  if (BOOLEAN_LIKE.has(String(raw).toLowerCase())) {
    return asBoolLabel(raw)
  }
  return formatValue(raw)
}

function fieldLabel(name) {
  if (!name) return '—'
  return String(name).replaceAll('_', ' ')
}

// Per-group expansion state for the "show more / show less" toggle.
const expandedGroups = ref(new Set())
function toggleExpand(key) {
  const s = new Set(expandedGroups.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  expandedGroups.value = s
}

// Pick the most "human" field to show first when a group has many changes.
// Falls back to the first change in the group.
const PRIMARY_FIELD_PRIORITY = [
  'name', 'driver_name', 'subject', 'batch_number',
  'email', 'phone', 'status', 'is_active',
]
function primaryChange(group) {
  if (!group.changes.length) return null
  for (const f of PRIMARY_FIELD_PRIORITY) {
    const found = group.changes.find(c => String(c.field || '').toLowerCase() === f)
    if (found) return found
  }
  return group.changes[0]
}
function secondaryChanges(group) {
  const primary = primaryChange(group)
  if (!primary) return []
  return group.changes.filter(c => c !== primary)
}

// Group rows that came from the same record-level write so a single row
// appears in the table even though the trigger emitted one DB row per
// changed column. Grouping key: table + row_id + action + created_at.
const groupedLogs = computed(() => {
  const visible = logs.value.filter(l =>
    !SENSITIVE_FIELDS.has(String(l.changed_fields || '').toLowerCase())
  )
  const map = new Map()
  for (const l of visible) {
    const key = [l.table_name, l.row_id, l.action, l.created_at].join('|')
    if (!map.has(key)) {
      map.set(key, {
        key,
        id:           l.id,
        created_at:   l.created_at,
        user:         l.user,
        action:       l.action,
        table_name:   l.table_name,
        row_id:       l.row_id,
        changes:      [],
      })
    }
    map.get(key).changes.push({
      field:      l.changed_fields,
      old_values: l.old_values,
      new_values: l.new_values,
    })
  }
  return [...map.values()]
})

// ── Fetch ──────────────────────────────────────────────────────────────────────
async function fetchLogs() {
  loading.value = true
  error.value   = ''
  try {
    const { data } = await auditLogsApi.list({
      table:   tableFilter.value  || undefined,
      action:  actionFilter.value || undefined,
      user_id: userFilter.value   || undefined,
      from:    dateFrom.value     || undefined,
      to:      dateTo.value       || undefined,
      q:       search.value.trim() || undefined,
      page:    page.value,
    })
    logs.value  = data.data  || []
    meta.value  = data.meta  || {}
    stats.value = data.stats || {}
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load audit logs.'
  } finally {
    loading.value = false
  }
}

watch([tableFilter, actionFilter, userFilter, dateFrom, dateTo], () => {
  page.value = 1
  fetchLogs()
})

let searchDebounce = null
watch(search, () => {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    fetchLogs()
  }, 300)
})

onMounted(() => {
  fetchLogs()
  document.addEventListener('mousedown', onDocClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
})
</script>

<template>
  <div class="al">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="al-banner">
      <div class="al-banner-left">
        <div class="al-banner-icon">
          <AuditLogIcon :size="20" />
        </div>
        <div>
          <h1 class="al-banner-title">Audit Logs</h1>
          <p class="al-banner-sub">Track every create, update, delete, and export action</p>
        </div>
      </div>
      <div class="al-banner-stats">
        <div class="al-bstat">
          <span class="al-bstat-val">{{ loading ? '—' : (meta.total ?? 0) }}</span>
          <span class="al-bstat-lbl">Showing</span>
        </div>
        <div class="al-bstat al-bstat--muted">
          <span class="al-bstat-val">{{ stats.total ?? '—' }}</span>
          <span class="al-bstat-lbl">All-time</span>
        </div>
      </div>
    </div>

    <!-- ── Error ─────────────────────────────────────────────── -->
    <div v-if="error" class="al-error">
      <CloseIcon :size="14" />{{ error }}
    </div>

    <!-- ── Table card ────────────────────────────────────────── -->
    <div class="al-table-card">

      <!-- Card header -->
      <div class="al-card-hd">
        <div>
          <p class="al-card-title">Activity Log</p>
          <p class="al-card-sub">
            <span>{{ loading ? '…' : (meta.total ?? logs.length) }} record{{ (meta.total ?? logs.length) !== 1 ? 's' : '' }}</span>
            <span v-if="hasFilter" class="chip chip--filter">filtered</span>
          </p>
        </div>
        <div class="al-card-search">
          <SearchInput v-model="search" placeholder="Search table, row id, value…" />
        </div>
      </div>

      <!-- Filter bar -->
      <div class="al-filter-bar">
        <span class="al-filter-lbl">
          <FilterIcon :size="12" aria-hidden="true" />
          Filter
        </span>

        <!-- Table dropdown (searchable) -->
        <div ref="tableDropRef" class="al-drop-wrap">
          <button
            type="button"
            :class="['al-drop-trigger', tableFilter && 'al-drop-trigger--on']"
            @click="showTableDrop = !showTableDrop"
          >
            <span>{{ tableFilter ? tableLabel(tableFilter) : 'Table' }}</span>
            <ChevronDownIcon :size="12" :stroke-width="1.5" :class="['al-drop-caret', showTableDrop && 'al-drop-caret--open']" />
          </button>
          <Transition name="al-drop">
            <div v-if="showTableDrop" class="al-drop-panel">
              <div class="al-drop-search-wrap">
                <SearchIcon :size="14" class="al-drop-search-icon" />
                <input
                  v-model="tableSearch"
                  class="al-drop-search"
                  placeholder="Search table…"
                  type="text"
                  autocomplete="off"
                />
              </div>
              <div class="al-drop-list">
                <button
                  type="button"
                  :class="['al-drop-opt', !tableFilter && 'al-drop-opt--on']"
                  @click="selectTable('')"
                >
                  <span class="al-drop-opt-check">
                    <CheckIcon v-if="!tableFilter" :size="12" />
                  </span>
                  All tables
                </button>
                <button
                  v-for="t in filteredTableOptions" :key="t"
                  type="button"
                  :class="['al-drop-opt', tableFilter === t && 'al-drop-opt--on']"
                  @click="selectTable(t)"
                >
                  <span class="al-drop-opt-check">
                    <CheckIcon v-if="tableFilter === t" :size="12" />
                  </span>
                  {{ tableLabel(t) }}
                </button>
                <p v-if="!filteredTableOptions.length" class="al-drop-empty">No match</p>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Action dropdown (fixed enum) -->
        <div ref="actionDropRef" class="al-drop-wrap">
          <button
            type="button"
            :class="['al-drop-trigger', actionFilter && 'al-drop-trigger--on']"
            @click="showActionDrop = !showActionDrop"
          >
            <span>{{ actionFilter ? actionLabel(actionFilter) : 'Action' }}</span>
            <ChevronDownIcon :size="12" :stroke-width="1.5" :class="['al-drop-caret', showActionDrop && 'al-drop-caret--open']" />
          </button>
          <Transition name="al-drop">
            <div v-if="showActionDrop" class="al-drop-panel al-drop-panel--narrow">
              <div class="al-drop-list">
                <button
                  type="button"
                  :class="['al-drop-opt', !actionFilter && 'al-drop-opt--on']"
                  @click="selectAction('')"
                >
                  <span class="al-drop-opt-check">
                    <CheckIcon v-if="!actionFilter" :size="12" />
                  </span>
                  All actions
                </button>
                <button
                  v-for="a in ALL_ACTIONS" :key="a"
                  type="button"
                  :class="['al-drop-opt', actionFilter === a && 'al-drop-opt--on']"
                  @click="selectAction(a)"
                >
                  <span class="al-drop-opt-check">
                    <CheckIcon v-if="actionFilter === a" :size="12" />
                  </span>
                  {{ actionLabel(a) }}
                </button>
              </div>
            </div>
          </Transition>
        </div>

        <!-- User dropdown (searchable) -->
        <div ref="userDropRef" class="al-drop-wrap">
          <button
            type="button"
            :class="['al-drop-trigger', userFilter && 'al-drop-trigger--on']"
            @click="showUserDrop = !showUserDrop"
          >
            <span>{{ selectedUser ? selectedUser.name : 'User' }}</span>
            <ChevronDownIcon :size="12" :stroke-width="1.5" :class="['al-drop-caret', showUserDrop && 'al-drop-caret--open']" />
          </button>
          <Transition name="al-drop">
            <div v-if="showUserDrop" class="al-drop-panel">
              <div class="al-drop-search-wrap">
                <SearchIcon :size="14" class="al-drop-search-icon" />
                <input
                  v-model="userSearch"
                  class="al-drop-search"
                  placeholder="Search user…"
                  type="text"
                  autocomplete="off"
                />
              </div>
              <div class="al-drop-list">
                <button
                  type="button"
                  :class="['al-drop-opt', !userFilter && 'al-drop-opt--on']"
                  @click="selectUser('')"
                >
                  <span class="al-drop-opt-check">
                    <CheckIcon v-if="!userFilter" :size="12" />
                  </span>
                  All users
                </button>
                <button
                  v-for="u in filteredUserOptions" :key="u.id"
                  type="button"
                  :class="['al-drop-opt al-drop-opt--user', String(userFilter) === String(u.id) && 'al-drop-opt--on']"
                  @click="selectUser(u.id)"
                >
                  <span class="al-drop-opt-check">
                    <CheckIcon v-if="String(userFilter) === String(u.id)" :size="12" />
                  </span>
                  <span class="al-drop-user">
                    <span class="al-drop-user-name">{{ u.name }}</span>
                    <span v-if="u.email" class="al-drop-user-email">{{ u.email }}</span>
                  </span>
                </button>
                <p v-if="!filteredUserOptions.length" class="al-drop-empty">No match</p>
              </div>
            </div>
          </Transition>
        </div>

        <DateRangePicker v-model:from="dateFrom" v-model:to="dateTo" />

        <Transition name="al-fade">
          <button v-if="hasFilter" class="al-clear-btn" @click="resetFilters">
            <CloseIcon :size="10" :stroke-width="2.5" />
            Reset
          </button>
        </Transition>

        <div class="al-mobile-search">
          <SearchInput v-model="search" placeholder="Search…" />
        </div>
      </div>

      <!-- Table + Pagination clipped together so the filter dropdowns above
           can escape the card boundary without being cut off. -->
      <div class="al-table-body">
      <div class="al-tbl-wrap">
        <table class="al-tbl">
          <thead>
            <tr>
              <th class="al-th--time">When</th>
              <th class="al-th--user">User</th>
              <th class="al-th--action">Action</th>
              <th class="al-th--change">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="4" class="al-empty">Loading audit logs…</td>
            </tr>
            <tr v-else-if="!groupedLogs.length">
              <td colspan="4" class="al-empty">
                {{ hasFilter ? 'No audit logs match these filters.' : 'No audit activity recorded for today yet.' }}
              </td>
            </tr>
            <tr v-for="g in groupedLogs" :key="g.key" class="al-row">
              <td class="al-cell-time">
                <div class="al-when">
                  <span class="al-when-date">{{ formatDate(g.created_at) }}</span>
                  <span class="al-when-time mono">{{ formatTime(g.created_at) }}</span>
                </div>
              </td>
              <td class="al-cell-user">
                <span v-if="g.user" class="al-user-name">{{ g.user.name }}</span>
                <span v-else class="al-user-system">System</span>
                <span v-if="g.user?.email" class="al-cell-user-meta">{{ g.user.email }}</span>
              </td>
              <td>
                <span :class="['al-action', `al-action--${String(g.action || '').toLowerCase()}`]">
                  {{ actionLabel(g.action) }}
                </span>
              </td>
              <td class="al-cell-change">
                <ul class="al-change-list">
                  <li v-for="c in (expandedGroups.has(g.key) ? g.changes : [primaryChange(g)])" :key="c.field" class="al-change-row">
                    <span class="al-field-tag">{{ fieldLabel(c.field) }}</span>
                    <template v-if="String(g.action).toUpperCase() === 'INSERT'">
                      <span class="al-val al-val--new">+ {{ displayValue(c.field, c.new_values) }}</span>
                    </template>
                    <template v-else-if="String(g.action).toUpperCase() === 'DELETE'">
                      <span class="al-val al-val--old">− {{ displayValue(c.field, c.old_values) }}</span>
                    </template>
                    <template v-else>
                      <span class="al-val al-val--old">{{ displayValue(c.field, c.old_values) }}</span>
                      <span class="al-arrow">→</span>
                      <span class="al-val al-val--new">{{ displayValue(c.field, c.new_values) }}</span>
                    </template>
                  </li>
                </ul>
                <button
                  v-if="g.changes.length > 1"
                  type="button"
                  class="al-expand-btn"
                  :title="expandedGroups.has(g.key) ? 'Show less' : `Show ${g.changes.length - 1} more`"
                  :aria-label="expandedGroups.has(g.key) ? 'Show less' : `Show ${g.changes.length - 1} more`"
                  :aria-expanded="expandedGroups.has(g.key)"
                  @click="toggleExpand(g.key)"
                >
                  <span v-if="!expandedGroups.has(g.key)" class="al-expand-count">+{{ g.changes.length - 1 }}</span>
                  <ChevronDownIcon
                    :size="14"
                    :stroke-width="2"
                    :class="['al-expand-caret', expandedGroups.has(g.key) && 'al-expand-caret--open']"
                  />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <AppPagination
        v-if="!loading && logs.length"
        :current-page="meta.current_page ?? 1"
        :last-page="meta.last_page ?? 1"
        :total="meta.total ?? 0"
        :from="meta.from ?? 0"
        :to="meta.to ?? 0"
        always
        @change="p => { page = p; fetchLogs() }"
      />
      </div>
    </div>
  </div>
</template>

<style scoped>
.al { min-width: 0; }

/* Banner */
.al-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 20px;
  position: relative; overflow: hidden;
}
.al-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: var(--c-purple); border-radius: var(--r-xl) var(--r-xl) 0 0;
}
.al-banner-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.al-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-purple); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.al-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.02em; margin-bottom: 1px; }
.al-banner-sub   { font-size: 0.8125rem; color: var(--c-text-3); }
.al-banner-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.al-bstat {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 14px; border-radius: var(--r-lg); min-width: 60px;
  background: var(--c-bg); border: 1px solid var(--c-border-light);
}
.al-bstat-val { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--c-purple); }
.al-bstat--muted .al-bstat-val { color: var(--c-text-3); }
.al-bstat-lbl { font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-3); margin-top: 3px; }

/* Error */
.al-error {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 14px; border-radius: 10px; margin-bottom: 12px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #EF4444; font-size: 0.875rem;
}

/* Table card */
.al-table-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  /* No overflow:hidden here — the filter dropdowns need to escape the card. */
}
/* Only the table+pagination region clips to the card's rounded bottom. */
.al-table-body {
  overflow: hidden;
  border-radius: 0 0 var(--r-xl) var(--r-xl);
}
.al-card-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 20px; border-bottom: 1px solid var(--c-border-light);
}
.al-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); }
.al-card-sub   { font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px; display: flex; align-items: center; gap: 5px; }
.al-card-search { width: 240px; flex-shrink: 0; }
@media (max-width: 767px) { .al-card-search { display: none; } }

/* Filter bar */
.al-filter-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 10px 20px; border-bottom: 1px solid var(--c-border-light);
}
.al-filter-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--c-text-3);
  width: 100%; margin-bottom: 4px;
}
/* Searchable filter dropdowns — pattern shared with Trips → Oil Company */
.al-drop-wrap { position: relative; flex-shrink: 0; }
.al-drop-trigger {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px;
  border-radius: var(--r-full);
  border: 1.5px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-2);
  font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; transition: all var(--dur);
  white-space: nowrap;
}
.al-drop-trigger:hover { border-color: var(--c-purple); color: var(--c-purple); }
.al-drop-trigger--on   {
  border-color: var(--c-purple);
  background: rgba(124,58,237,0.08);
  color: var(--c-purple);
  font-weight: 600;
}
.al-drop-caret { transition: transform var(--dur); flex-shrink: 0; }
.al-drop-caret--open { transform: rotate(180deg); }

/* Panel styling mirrors DateRangePicker (.drp-pop): same radius and shadow
   for visual parity with the other filter pickers. */
.al-drop-panel {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 50;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-md);
  width: 240px; overflow: hidden;
  box-sizing: border-box;
}
.al-drop-panel--narrow { width: 200px; }

.al-drop-search-wrap {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 12px;
  background: var(--c-bg);
  border-bottom: 1px solid var(--c-border-light);
}
.al-drop-search-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--c-text-3); }
.al-drop-search {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 0.8125rem; color: var(--c-text-1);
}
.al-drop-search::placeholder { color: var(--c-text-3); }

.al-drop-list { max-height: 280px; overflow-y: auto; padding: 6px; }
.al-drop-opt {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 10px; border-radius: 8px; border: none;
  background: transparent; color: var(--c-text-1);
  font-size: 0.8125rem; line-height: 1.2;
  cursor: pointer; transition: background var(--dur), color var(--dur);
  text-align: left;
}
.al-drop-opt + .al-drop-opt { margin-top: 2px; }
.al-drop-opt:hover  { background: var(--c-bg); }
.al-drop-opt--on    { background: rgba(124,58,237,0.1); color: var(--c-purple); font-weight: 600; }
.al-drop-opt-check  { width: 14px; height: 14px; flex-shrink: 0; color: var(--c-purple); }
.al-drop-opt-check svg { width: 100%; height: 100%; display: block; }

.al-drop-opt--user { align-items: flex-start; padding: 6px 10px; }
.al-drop-user { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.al-drop-user-name  { font-weight: 600; color: inherit; }
.al-drop-user-email {
  font-size: 0.7rem; color: var(--c-text-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.al-drop-empty { padding: 12px; text-align: center; font-size: 0.8125rem; color: var(--c-text-3); margin: 0; }

.al-drop-enter-active, .al-drop-leave-active { transition: opacity 120ms, transform 120ms; }
.al-drop-enter-from, .al-drop-leave-to { opacity: 0; transform: translateY(-6px); }

.al-clear-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur); flex-shrink: 0;
}
.al-clear-btn:hover { border-color: #EF4444; color: #EF4444; background: rgba(239,68,68,0.08); }

.al-mobile-search { display: none; }
@media (max-width: 767px) { .al-mobile-search { display: block; width: 100%; margin-top: 4px; } }

.al-fade-enter-active, .al-fade-leave-active { transition: opacity var(--dur), transform var(--dur); }
.al-fade-enter-from, .al-fade-leave-to { opacity: 0; transform: scale(0.85); }

/* Table */
.al-tbl-wrap { overflow-x: auto; }
.al-tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.al-tbl thead tr { border-bottom: 1px solid var(--c-border); }
.al-tbl th {
  padding: 10px 14px; text-align: left;
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-text-3); white-space: nowrap;
  background: var(--c-bg);
}
.al-tbl td { padding: 12px 14px; border-bottom: 1px solid var(--c-border-light); vertical-align: top; }
.al-row { cursor: pointer; transition: background var(--dur); }
.al-row:hover td { background: var(--c-bg); }
.al-empty { text-align: center; padding: 32px 14px; color: var(--c-text-3); font-size: 0.875rem; }

.al-cell-time   { white-space: nowrap; color: var(--c-text-2); }
.al-cell-user   { white-space: nowrap; }
.al-cell-table  { color: var(--c-text-2); white-space: nowrap; }
.al-cell-row    { color: var(--c-text-3); white-space: nowrap; }
.al-cell-changes { min-width: 220px; }
.al-user-name   { font-weight: 600; color: var(--c-text-1); }
.al-user-system { color: var(--c-text-3); font-style: italic; }
.al-cell-user-meta {
  display: block; margin-top: 2px;
  font-size: 0.7rem; color: var(--c-text-3);
}
.al-cell-user { white-space: normal; }

.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8125rem; }

/* Action chips */
.al-action {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.04em;
  text-transform: uppercase;
}
.al-action--insert { background: rgba(22,163,74,0.1);  color: #16A34A; }
.al-action--update { background: rgba(29,78,216,0.1);  color: #1D4ED8; }
.al-action--delete { background: rgba(239,68,68,0.1);  color: #EF4444; }
.al-action--export { background: rgba(124,58,237,0.1); color: #7C3AED; }

.al-changes-na { color: var(--c-text-3); }

.al-cell-field { white-space: nowrap; }
.al-field-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem; padding: 2px 7px; border-radius: 4px;
  background: var(--c-bg); color: var(--c-text-2);
  border: 1px solid var(--c-border-light);
}

.al-when { display: flex; flex-direction: column; gap: 2px; }
.al-when-date { font-size: 0.8125rem; color: var(--c-text-1); font-weight: 500; }
.al-when-time { font-size: 0.7rem; color: var(--c-text-3); }

.al-cell-change { min-width: 280px; }
.al-change-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.al-change-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.al-expand-btn {
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 8px; padding: 3px 9px;
  background: var(--c-bg);
  border: 1px solid var(--c-border-light);
  border-radius: var(--r-full);
  cursor: pointer;
  font-size: 0.7rem; font-weight: 700; color: var(--c-purple);
  letter-spacing: 0.02em;
  transition: background var(--dur), border-color var(--dur), color var(--dur);
}
.al-expand-btn:hover {
  background: rgba(124,58,237,0.08);
  border-color: rgba(124,58,237,0.3);
  color: #6D28D9;
}
.al-expand-count { font-variant-numeric: tabular-nums; }
.al-expand-caret { transition: transform var(--dur); }
.al-expand-caret--open { transform: rotate(180deg); }
.al-val {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8125rem; line-height: 1.3;
  padding: 2px 7px; border-radius: 4px;
  word-break: break-word; max-width: 100%;
}
.al-val--old { background: rgba(239,68,68,0.08);  color: #B91C1C; text-decoration: line-through; text-decoration-color: rgba(185,28,28,0.4); }
.al-val--new { background: rgba(22,163,74,0.10);  color: #15803D; }
.al-arrow {
  color: var(--c-text-3);
  font-size: 0.875rem;
}
</style>
