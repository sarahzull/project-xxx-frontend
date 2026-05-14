<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  UserManagementIcon, AddIcon, ViewIcon, FilterIcon, CloseIcon,
} from '../../components/icons/index.js'
import ActionBtn from '../../components/common/ActionBtn.vue'
import usersApi from '../../api/users'
import rolesApi from '../../api/roles'
import basesApi from '../../api/bases'
import DataTable from '../../components/common/DataTable.vue'
import StatusBadge from '../../components/common/StatusBadge.vue'
import SearchInput from '../../components/common/SearchInput.vue'
import AppPagination from '../../components/common/AppPagination.vue'
import { useToast } from '../../composables/useToast'

const router = useRouter()

const toast   = useToast()
const users   = ref([])
const roles   = ref([])
const bases   = ref([])
const loading      = ref(true)
const search       = ref('')
const filterStatus = ref('')   // '' | 'active' | 'blocked'
const filterRole   = ref('')   // '' | 'admin'  | 'driver'

// ── Pagination state ──────────────────────────────────────────────────────────
const page  = ref(1)
const meta  = ref({})
const stats = ref({})

const hasFilter = computed(() => search.value || filterStatus.value || filterRole.value)

const baseLabelByCode = computed(() => {
  const map = {}
  bases.value.forEach((b) => { map[b.code] = b.label })
  return map
})

function resetFilters() {
  search.value       = ''
  filterStatus.value = ''
  filterRole.value   = ''
  page.value         = 1
  fetchUsers()
}

// ── Computed stats (sourced from backend aggregate counts) ────────────────────
const totalUsers  = computed(() => stats.value.total   ?? 0)
const activeUsers = computed(() => stats.value.active  ?? 0)
const adminCount  = computed(() => stats.value.admins  ?? 0)
const driverCount = computed(() => stats.value.drivers ?? 0)

const columns = [
  { key: 'name',       label: 'Name' },
  { key: 'email',      label: 'Email' },
  { key: 'roles',      label: 'Role' },
  { key: 'base',       label: 'Base', tooltip: 'BASE: operating base / depot code (hover a code to see the full name)' },
  { key: 'is_active',  label: 'Status' },
  { key: 'created_at', label: 'Created' },
  { key: 'actions',    label: '' },
]

async function fetchUsers() {
  loading.value = true
  try {
    const { data } = await usersApi.list({
      search: search.value || undefined,
      status: filterStatus.value || undefined,
      role:   filterRole.value   || undefined,
      page:   page.value,
    })
    users.value = (data.data || []).map(u => ({
      ...u,
      created_at: u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—',
    }))
    meta.value  = data.meta  || {}
    stats.value = data.stats || {}
  } finally {
    loading.value = false
  }
}

// Reset to page 1 and refetch when filters change
watch([filterStatus, filterRole], () => { page.value = 1; fetchUsers() })

// Debounced search watch
let searchTimer = null
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; fetchUsers() }, 300)
})

async function fetchRoles() {
  try {
    const { data } = await rolesApi.list()
    roles.value = data.data || []
  } catch { /* silent */ }
}

async function fetchBases() {
  try {
    const { data } = await basesApi.list()
    bases.value = data.data || []
  } catch { /* silent */ }
}

onMounted(() => { fetchUsers(); fetchRoles(); fetchBases() })

function openCreate()   { router.push({ name: 'user-create' }) }
function openShow(user) { router.push({ name: 'user-show', params: { id: user.id } }) }
</script>

<template>
  <div class="uv">

    <!-- ── Banner ─────────────────────────────────────────────── -->
    <div class="uv-banner">
      <div class="uv-banner-left">
        <div class="uv-banner-icon">
          <UserManagementIcon :size="20" />
        </div>
        <div>
          <h1 class="uv-banner-title">User Management</h1>
          <p class="uv-banner-sub">System Accounts &amp; Roles</p>
        </div>
      </div>
      <div class="uv-banner-stats">
        <div class="uv-bstat">
          <span class="uv-bstat-val">{{ loading ? '—' : totalUsers }}</span>
          <span class="uv-bstat-lbl">Total</span>
        </div>
        <div class="uv-bstat uv-bstat--green">
          <span class="uv-bstat-val">{{ loading ? '—' : activeUsers }}</span>
          <span class="uv-bstat-lbl">Active</span>
        </div>
        <div class="uv-bstat uv-bstat--blue">
          <span class="uv-bstat-val">{{ loading ? '—' : adminCount }}</span>
          <span class="uv-bstat-lbl">Admins</span>
        </div>
        <div class="uv-bstat uv-bstat--emerald">
          <span class="uv-bstat-val">{{ loading ? '—' : driverCount }}</span>
          <span class="uv-bstat-lbl">Drivers</span>
        </div>
      </div>
    </div>

    <!-- ── Table card ─────────────────────────────────────────── -->
    <div class="uv-table-card">

      <!-- Card header -->
      <div class="uv-card-hd">
        <div>
          <p class="uv-card-title">User Accounts</p>
          <p class="uv-card-sub">
            <span v-if="loading">…</span>
            <span v-else>
              {{ meta.total ?? users.length }} user{{ (meta.total ?? users.length) !== 1 ? 's' : '' }}
            </span>
            <span v-if="hasFilter" class="chip chip--filter">filtered</span>
          </p>
        </div>
        <div class="uv-card-right">
          <div class="uv-card-search">
            <SearchInput v-model="search" placeholder="Search users…" />
          </div>
          <button class="uv-new-btn" @click="openCreate">
            <AddIcon :size="16" :stroke-width="2.5" />
            New User
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="uv-filter-bar">
        <span class="uv-filter-lbl">
          <FilterIcon :size="12" aria-hidden="true" />
          Filter
        </span>
        <div class="uv-seg" role="group" aria-label="Filter by status">
          <button :class="['uv-seg-btn', filterStatus === '' && 'uv-seg-btn--on']" @click="filterStatus = ''">All</button>
          <button :class="['uv-seg-btn', filterStatus === 'active'  && 'uv-seg-btn--on uv-seg-btn--active']"  @click="filterStatus = 'active'">Active</button>
          <button :class="['uv-seg-btn', filterStatus === 'blocked' && 'uv-seg-btn--on uv-seg-btn--blocked']" @click="filterStatus = 'blocked'">Blocked</button>
        </div>
        <div class="uv-seg" role="group" aria-label="Filter by role">
          <button :class="['uv-seg-btn', filterRole === '' && 'uv-seg-btn--on']" @click="filterRole = ''">All Roles</button>
          <button :class="['uv-seg-btn', filterRole === 'admin'  && 'uv-seg-btn--on']" @click="filterRole = 'admin'">Admin</button>
          <button :class="['uv-seg-btn', filterRole === 'driver' && 'uv-seg-btn--on']" @click="filterRole = 'driver'">Driver</button>
        </div>
        <Transition name="uv-fade">
          <button v-if="hasFilter" class="uv-reset-btn" @click="resetFilters">
            <CloseIcon :size="10" :stroke-width="2.5" />
            Reset
          </button>
        </Transition>
      </div>

      <!-- Table -->
      <DataTable :columns="columns" :rows="users" :loading="loading" :flat="true" :has-filter="hasFilter" empty-message="No users found.">
        <template #cell-roles="{ row }">
          <span v-if="row.roles && row.roles.length" class="uv-roles-row">
            <span
              v-for="role in row.roles" :key="role.id"
              :class="['uv-role-pill', role.slug === 'admin' ? 'uv-role--admin' : 'uv-role--driver']"
            >{{ role.name }}</span>
          </span>
          <span v-else class="tc-3">—</span>
        </template>
        <template #cell-base="{ row }">
          <span v-if="row.base" v-tooltip="baseLabelByCode[row.base] || row.base" class="uv-base-pill">
            {{ row.base }}
          </span>
          <span v-else class="tc-3">—</span>
        </template>
        <template #cell-is_active="{ value }">
          <StatusBadge :status="value ? 'active' : 'blocked'" />
        </template>
        <template #cell-actions="{ row }">
          <div class="uv-row-actions">
            <ActionBtn tooltip="View user" variant="view" @click="openShow(row)">
              <ViewIcon :size="15" />
            </ActionBtn>
          </div>
        </template>
      </DataTable>

      <AppPagination
        v-if="meta.last_page > 1"
        :current-page="meta.current_page ?? 1"
        :last-page="meta.last_page ?? 1"
        :total="meta.total ?? 0"
        :from="meta.from ?? 0"
        :to="meta.to ?? 0"
        @change="p => { page = p; fetchUsers() }"
      />
    </div>

  </div>
</template>

<style scoped>
.uv { min-width: 0; }

/* ── Banner ──────────────────────────────────────────────────── */
.uv-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 20px;
  position: relative; overflow: hidden;
}
.uv-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--c-accent), var(--c-purple));
  border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .uv-banner { padding: 18px 24px; margin-bottom: 24px; } }

.uv-banner-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.uv-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.uv-banner-icon svg { width: 20px; height: 20px; }
.uv-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.02em; margin-bottom: 1px; }
@media (min-width: 640px) { .uv-banner-title { font-size: 1.25rem; } }
.uv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.uv-banner-stats { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.uv-bstat {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 14px; border-radius: var(--r-lg); min-width: 52px;
  background: var(--c-bg); border: 1px solid var(--c-border-light);
}
.uv-bstat-val { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--c-text-1); }
.uv-bstat-lbl { font-size: 0.5625rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-3); margin-top: 3px; }
.uv-bstat--green   .uv-bstat-val { color: var(--c-green); }
.uv-bstat--blue    .uv-bstat-val { color: var(--c-accent); }
.uv-bstat--emerald .uv-bstat-val { color: #16A34A; }

/* ── Table card ──────────────────────────────────────────────── */
.uv-table-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm); overflow: hidden;
}
.uv-card-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 20px; border-bottom: 1px solid var(--c-border-light);
}
@media (max-width: 767px) { .uv-card-hd { padding: 12px 14px; flex-wrap: wrap; } }
.uv-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); letter-spacing: -0.01em; }
.uv-card-sub { font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px; display: flex; align-items: center; gap: 5px; }
.uv-card-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
.uv-card-search { width: 200px; }
@media (max-width: 640px) { .uv-card-search { display: none; } }

/* ── Filter bar ──────────────────────────────────────────────── */
.uv-filter-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 10px 20px; border-bottom: 1px solid var(--c-border-light);
}
@media (max-width: 767px) { .uv-filter-bar { padding: 10px 14px; gap: 6px; } }
/* FILTER label always on its own row (matches Compensation/Payroll Batches standard) */
.uv-filter-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--c-text-3);
  width: 100%; margin-bottom: 4px;
}
.uv-seg {
  display: inline-flex; background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-full); padding: 3px; gap: 2px; flex-shrink: 0;
}
.uv-seg-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: var(--r-full);
  font-size: 0.8125rem; font-weight: 500; color: var(--c-text-3);
  background: transparent; border: none; cursor: pointer;
  transition: all var(--dur); white-space: nowrap;
}
.uv-seg-btn:hover:not(.uv-seg-btn--on) { background: var(--c-surface); color: var(--c-text-1); }
.uv-seg-btn--on        { background: var(--c-surface); color: var(--c-accent); font-weight: 600; box-shadow: var(--sh-xs); }
.uv-seg-btn--on.uv-seg-btn--active  { color: var(--c-green); }
.uv-seg-btn--on.uv-seg-btn--blocked { color: var(--c-red); }

.uv-reset-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur); flex-shrink: 0;
}
.uv-reset-btn svg { width: 10px; height: 10px; }
.uv-reset-btn:hover { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }

.uv-fade-enter-active, .uv-fade-leave-active { transition: opacity 150ms, transform 150ms; }
.uv-fade-enter-from, .uv-fade-leave-to { opacity: 0; transform: scale(0.85); }

.uv-new-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--c-accent); color: #fff; border: none; border-radius: 8px;
  padding: 8px 14px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: opacity var(--dur); white-space: nowrap;
}
.uv-new-btn svg { width: 14px; height: 14px; }
.uv-new-btn:hover { opacity: 0.88; }

/* Mobile: filter pills inherit compact desktop style (matches Compensation standard).
   Only the card-right (search + New User button) stretches full-width when wrapped. */
@media (max-width: 767px) {
  .uv-card-right {
    width: 100%;
  }

  .uv-new-btn {
    min-height: 44px;
    justify-content: center;
  }
}

/* Cell styles */
.uv-roles-row { display: flex; gap: 4px; flex-wrap: wrap; }
.uv-role-pill {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
}
.uv-role--admin  { background: #DBEAFE; color: #1D4ED8; }
.uv-role--driver { background: #D1FAE5; color: #047857; }

.uv-base-pill {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.05em;
  background: #F3E8FF; color: #6B21A8;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.uv-row-actions { display: flex; align-items: center; gap: 4px; }

</style>
