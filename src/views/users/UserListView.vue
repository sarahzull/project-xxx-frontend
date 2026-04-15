<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  UserManagementIcon, AddIcon, EditIcon, TrashIcon, UserIcon, FilterIcon, CloseIcon,
} from '../../components/icons/index.js'
import ActionBtn from '../../components/common/ActionBtn.vue'
import usersApi from '../../api/users'
import rolesApi from '../../api/roles'
import { useAuthStore } from '../../stores/auth'
import DataTable from '../../components/common/DataTable.vue'
import StatusBadge from '../../components/common/StatusBadge.vue'
import SearchInput from '../../components/common/SearchInput.vue'
import ConfirmDeleteModal from '../../components/common/ConfirmDeleteModal.vue'
import { useToast } from '../../composables/useToast'

const auth    = useAuthStore()
const toast   = useToast()
const users   = ref([])
const roles   = ref([])
const loading      = ref(true)
const search       = ref('')
const filterStatus = ref('')   // '' | 'active' | 'blocked'
const filterRole   = ref('')   // '' | 'admin'  | 'driver'

const hasFilter = computed(() => search.value || filterStatus.value || filterRole.value)

function resetFilters() {
  search.value       = ''
  filterStatus.value = ''
  filterRole.value   = ''
  fetchUsers()
}

// ── Filtered rows ─────────────────────────────────────────────────────────────
const filteredUsers = computed(() => {
  return users.value.filter(u => {
    if (filterStatus.value === 'active'  && !u.is_active) return false
    if (filterStatus.value === 'blocked' &&  u.is_active) return false
    if (filterRole.value && !u.roles?.some(r => r.slug === filterRole.value)) return false
    return true
  })
})

// ── Computed stats ────────────────────────────────────────────────────────────
const totalUsers  = computed(() => users.value.length)
const activeUsers = computed(() => users.value.filter(u => u.is_active).length)
const adminCount  = computed(() => users.value.filter(u => u.roles?.some(r => r.slug === 'admin')).length)
const driverCount = computed(() => users.value.filter(u => u.roles?.some(r => r.slug === 'driver')).length)

// ── Modal state ───────────────────────────────────────────────────────────────
const showModal   = ref(false)
const editingUser = ref(null)
const saving      = ref(false)
const formError   = ref('')
const showDeleteModal = ref(false)
const deletingUser    = ref(null)
const deleting        = ref(false)
const deleteError     = ref('')
const form        = ref({
  name: '', email: '', password: '', dob: '', phone: '',
  role_id: '', driver_id: '', photo: '', license_no: '', license_date: '', date_joined: '',
  license_type: '', license_expiry: '', gdl_expiry: '', ranking: '', oil_company: '',
  is_active: true,
})
const photoPreview = ref('')

function onPhotoChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => { photoPreview.value = ev.target.result; form.value.photo = ev.target.result }
  reader.readAsDataURL(file)
}
function removePhoto() { photoPreview.value = ''; form.value.photo = '' }

const columns = [
  { key: 'name',       label: 'Name' },
  { key: 'email',      label: 'Email' },
  { key: 'roles',      label: 'Role' },
  { key: 'is_active',  label: 'Status' },
  { key: 'created_at', label: 'Created' },
  { key: 'actions',    label: '' },
]

async function fetchUsers() {
  loading.value = true
  try {
    const { data } = await usersApi.list({ search: search.value })
    users.value = (data.data || []).map(u => ({
      ...u,
      created_at: u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—',
    }))
  } finally {
    loading.value = false
  }
}

async function fetchRoles() {
  try {
    const { data } = await rolesApi.list()
    roles.value = data.data || []
  } catch { /* silent */ }
}

onMounted(() => { fetchUsers(); fetchRoles() })

function openCreate() {
  editingUser.value = null
  form.value = {
    name: '', email: '', password: '', dob: '', phone: '',
    role_id: roles.value[0]?.id || '', driver_id: '', photo: '',
    license_no: '', license_date: '', date_joined: '',
    license_type: '', license_expiry: '', gdl_expiry: '', ranking: '', oil_company: '',
    is_active: true,
  }
  photoPreview.value = ''
  formError.value = ''
  showModal.value = true
}

function openEdit(user) {
  editingUser.value = user
  form.value = {
    name:         user.name,
    email:        user.email,
    password:     '',
    dob:          user.dob || '',
    phone:        user.phone || '',
    role_id:      user.roles?.[0]?.id || '',
    driver_id:      user.driver_id || '',
    photo:          user.photo || '',
    license_no:     user.license_no || '',
    license_date:   user.license_date || '',
    date_joined:    user.date_joined || '',
    license_type:   user.license_type || '',
    license_expiry: user.license_expiry || '',
    gdl_expiry:     user.gdl_expiry || '',
    ranking:        user.ranking || '',
    oil_company:    user.oil_company || '',
    is_active:      user.is_active,
  }
  photoPreview.value = user.photo || ''
  formError.value = ''
  showModal.value = true
}

async function saveUser() {
  formError.value = ''
  saving.value = true
  const isEditing = Boolean(editingUser.value)
  try {
    const payload = {
      name:           form.value.name,
      email:          form.value.email,
      roles:          form.value.role_id ? [form.value.role_id] : [],
      driver_id:      form.value.driver_id      || null,
      phone:          form.value.phone           || null,
      dob:            form.value.dob             || null,
      photo:          form.value.photo           || null,
      license_no:     form.value.license_no      || null,
      license_date:   form.value.license_date    || null,
      date_joined:    form.value.date_joined     || null,
      license_type:   form.value.license_type    || null,
      license_expiry: form.value.license_expiry  || null,
      gdl_expiry:     form.value.gdl_expiry      || null,
      ranking:        form.value.ranking         || null,
      oil_company:    form.value.oil_company     || null,
    }
    if (!editingUser.value) {
      payload.password              = form.value.password
      payload.password_confirmation = form.value.password
    } else {
      payload.is_active = form.value.is_active
      if (form.value.password) {
        payload.password              = form.value.password
        payload.password_confirmation = form.value.password
      }
    }
    if (editingUser.value) {
      await usersApi.update(editingUser.value.id, payload)
    } else {
      await usersApi.create(payload)
    }
    showModal.value = false
    await fetchUsers()
    toast.success(isEditing ? 'User updated successfully.' : 'User created successfully.', {
      title: isEditing ? 'User Updated' : 'User Created',
    })
  } catch (e) {
    const errors = e.response?.data?.errors
    formError.value = errors
      ? Object.values(errors).flat().join(' ')
      : (e.response?.data?.message || 'An error occurred.')
    if (!errors) {
      toast.error(formError.value, {
        title: isEditing ? 'Update Failed' : 'Create Failed',
      })
    }
  } finally {
    saving.value = false
  }
}

async function deleteUser(user) {
  if (user.id === auth.user?.id) return
  deletingUser.value = user
  deleteError.value = ''
  showDeleteModal.value = true
}

function closeDeleteModal() {
  if (deleting.value) return
  showDeleteModal.value = false
  deletingUser.value = null
  deleteError.value = ''
}

async function confirmDeleteUser() {
  if (!deletingUser.value) return
  const userId = deletingUser.value.id
  deleting.value = true
  deleteError.value = ''
  try {
    await usersApi.delete(userId)
    showDeleteModal.value = false
    deletingUser.value = null
    deleteError.value = ''
    await fetchUsers()
    toast.success('User deleted successfully.', { title: 'User Deleted' })
  } catch (e) {
    deleteError.value = e.response?.data?.message || 'Failed to delete user.'
    toast.error(deleteError.value, { title: 'Delete Failed' })
  } finally {
    deleting.value = false
  }
}
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
            <span v-else-if="filteredUsers.length === users.length">
              {{ users.length }} user{{ users.length !== 1 ? 's' : '' }}
            </span>
            <span v-else>
              {{ filteredUsers.length }} of {{ users.length }} users
            </span>
          </p>
        </div>
        <div class="uv-card-right">
          <!-- Filters -->
          <div class="uv-filters">
            <div class="uv-filter-wrap">
              <FilterIcon :size="13" class="uv-filter-ico" />
              <select v-model="filterStatus" class="uv-filter-select">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
            <div class="uv-filter-wrap">
              <FilterIcon :size="13" class="uv-filter-ico" />
              <select v-model="filterRole" class="uv-filter-select">
                <option value="">All Roles</option>
                <option value="admin">Admin</option>
                <option value="driver">Driver</option>
              </select>
            </div>
            <Transition name="uv-fade">
              <button v-if="hasFilter" class="uv-reset-btn" @click="resetFilters">
                <CloseIcon :size="10" :stroke-width="2.5" />
                Reset
              </button>
            </Transition>
          </div>
          <div class="uv-card-search">
            <SearchInput v-model="search" placeholder="Search users…" @update:model-value="fetchUsers" />
          </div>
          <button class="uv-new-btn" @click="openCreate">
            <AddIcon :size="16" :stroke-width="2.5" />
            New User
          </button>
        </div>
      </div>

      <!-- Table -->
      <DataTable :columns="columns" :rows="filteredUsers" :loading="loading" :flat="true" empty-message="No users found.">
        <template #cell-roles="{ row }">
          <span v-if="row.roles && row.roles.length" class="uv-roles-row">
            <span
              v-for="role in row.roles" :key="role.id"
              :class="['uv-role-pill', role.slug === 'admin' ? 'uv-role--admin' : 'uv-role--driver']"
            >{{ role.name }}</span>
          </span>
          <span v-else class="tc-3">—</span>
        </template>
        <template #cell-is_active="{ value }">
          <StatusBadge :status="value ? 'active' : 'blocked'" />
        </template>
        <template #cell-actions="{ row }">
          <div class="uv-row-actions">
            <ActionBtn tooltip="Edit user" variant="edit" @click="openEdit(row)">
              <EditIcon :size="15" />
            </ActionBtn>
            <ActionBtn
              :tooltip="row.id === auth.user?.id ? 'Cannot delete own account' : 'Delete user'"
              variant="delete"
              :disabled="row.id === auth.user?.id"
              @click="deleteUser(row)"
            >
              <TrashIcon :size="15" />
            </ActionBtn>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- ── Modal ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showModal" class="uv-overlay" @click.self="showModal = false">
        <div class="uv-modal">
          <div class="uv-modal-hd">
            <div class="uv-modal-icon">
              <UserIcon :size="20" />
            </div>
            <div>
              <h2 class="uv-modal-title">{{ editingUser ? 'Edit User' : 'New User' }}</h2>
              <p class="uv-modal-sub">{{ editingUser ? 'Update account details' : 'Create a new system account' }}</p>
            </div>
            <button class="uv-modal-close" @click="showModal = false" aria-label="Close">✕</button>
          </div>

          <form class="uv-modal-body" @submit.prevent="saveUser">

            <!-- Full Name -->
            <div class="uv-field">
              <label class="uv-label">Full Name</label>
              <input v-model="form.name" class="uv-input" type="text" required placeholder="e.g. Ahmad Razak" />
            </div>

            <!-- Email -->
            <div class="uv-field">
              <label class="uv-label">Email Address</label>
              <input v-model="form.email" class="uv-input" type="email" required placeholder="user@example.com" />
            </div>

            <!-- Password -->
            <div class="uv-field">
              <label class="uv-label">
                Password
                <span v-if="editingUser" class="uv-optional"> — leave blank to keep current</span>
              </label>
              <input
                v-model="form.password"
                class="uv-input"
                type="password"
                :required="!editingUser"
                placeholder="Min. 8 characters"
                autocomplete="new-password"
              />
            </div>

            <!-- DOB + Phone — side by side -->
            <div class="uv-field-row">
              <div class="uv-field">
                <label class="uv-label">Date of Birth</label>
                <input v-model="form.dob" class="uv-input" type="date" />
              </div>
              <div class="uv-field">
                <label class="uv-label">Phone No.</label>
                <input v-model="form.phone" class="uv-input" type="tel" placeholder="e.g. 012-3456789" />
              </div>
            </div>

            <!-- Role -->
            <div class="uv-field">
              <label class="uv-label">Role</label>
              <select v-model="form.role_id" class="uv-input" required>
                <option value="" disabled>Select a role…</option>
                <option v-for="role in roles" :key="role.id" :value="role.id">{{ role.name }}</option>
              </select>
            </div>

            <!-- Driver ID -->
            <div class="uv-field">
              <label class="uv-label">
                Driver ID
                <span class="uv-optional"> — links account to SWAT driver record</span>
              </label>
              <input
                v-model="form.driver_id"
                class="uv-input uv-input--mono"
                type="text"
                placeholder="e.g. RS 345"
                maxlength="50"
              />
            </div>

            <!-- Photo -->
            <div class="uv-field">
              <label class="uv-label">Photo</label>
              <div class="uv-photo-row">
                <div class="uv-photo-thumb">
                  <img v-if="photoPreview" :src="photoPreview" alt="preview" />
                  <UserIcon v-else :size="24" :stroke-width="1.5" />
                </div>
                <div class="uv-photo-btns">
                  <label class="uv-btn-upload" :for="`uv-photo-${editingUser?.id ?? 'new'}`">
                    {{ photoPreview ? 'Change' : 'Upload' }}
                  </label>
                  <input :id="`uv-photo-${editingUser?.id ?? 'new'}`" type="file" accept="image/*" class="uv-file-hidden" @change="onPhotoChange" />
                  <button v-if="photoPreview" type="button" class="uv-btn-rm-photo" @click="removePhoto">Remove</button>
                </div>
              </div>
            </div>

            <!-- License No + License Date — side by side -->
            <div class="uv-field-row">
              <div class="uv-field">
                <label class="uv-label">License No.</label>
                <input v-model="form.license_no" class="uv-input uv-input--mono" type="text" placeholder="e.g. D12345678" />
              </div>
              <div class="uv-field">
                <label class="uv-label">License Date</label>
                <input v-model="form.license_date" class="uv-input" type="date" />
              </div>
            </div>

            <!-- Date Joined Company -->
            <div class="uv-field">
              <label class="uv-label">Date Joined Company</label>
              <input v-model="form.date_joined" class="uv-input" type="date" />
            </div>

            <!-- License Type + Ranking — side by side -->
            <div class="uv-field-row">
              <div class="uv-field">
                <label class="uv-label">License Type</label>
                <input v-model="form.license_type" class="uv-input uv-input--mono" type="text" placeholder="e.g. D or E" maxlength="10" />
              </div>
              <div class="uv-field">
                <label class="uv-label">Ranking</label>
                <select v-model="form.ranking" class="uv-input">
                  <option value="">— None —</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
              </div>
            </div>

            <!-- License Expiry + GDL Expiry — side by side -->
            <div class="uv-field-row">
              <div class="uv-field">
                <label class="uv-label">License Expiry</label>
                <input v-model="form.license_expiry" class="uv-input" type="date" />
              </div>
              <div class="uv-field">
                <label class="uv-label">GDL Expiry</label>
                <input v-model="form.gdl_expiry" class="uv-input" type="date" />
              </div>
            </div>

            <!-- Oil Company -->
            <div class="uv-field">
              <label class="uv-label">Oil Company</label>
              <input v-model="form.oil_company" class="uv-input" type="text" placeholder="e.g. Petronas, Shell" maxlength="100" />
            </div>

            <!-- Active toggle (edit only) -->
            <div v-if="editingUser" class="uv-field uv-field--row">
              <label class="uv-label">Account Active</label>
              <label class="uv-toggle">
                <input v-model="form.is_active" type="checkbox" />
                <span class="uv-toggle-track" />
              </label>
            </div>

            <p v-if="formError" class="uv-form-err">{{ formError }}</p>

            <div class="uv-modal-foot">
              <button type="button" class="uv-btn-ghost" @click="showModal = false">Cancel</button>
              <button type="submit" class="uv-btn-primary" :disabled="saving">
                {{ saving ? 'Saving…' : (editingUser ? 'Save Changes' : 'Create User') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <ConfirmDeleteModal
      :open="showDeleteModal"
      title="Delete User?"
      message="Are you sure you want to delete"
      :item-name="deletingUser?.name || ''"
      :loading="deleting"
      :error="deleteError"
      @update:open="showDeleteModal = $event"
      @cancel="closeDeleteModal"
      @confirm="confirmDeleteUser"
    />

  </div>
</template>

<style scoped>
.uv { min-width: 0; overflow: hidden; }

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
.uv-card-sub { font-size: 0.75rem; color: var(--c-text-3); margin-top: 2px; }
.uv-card-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
.uv-card-search { width: 200px; }
@media (max-width: 640px) { .uv-card-search { display: none; } }

/* ── Filters ─────────────────────────────────────────────────── */
.uv-filters { display: flex; align-items: center; gap: 6px; }
.uv-filter-wrap {
  position: relative; display: inline-flex; align-items: center;
}
.uv-filter-ico {
  position: absolute; left: 8px; pointer-events: none;
  color: var(--c-text-3); flex-shrink: 0;
}
.uv-filter-select {
  appearance: none; padding: 6px 10px 6px 26px;
  border: 1px solid var(--c-border); border-radius: 8px;
  background: var(--c-bg); color: var(--c-text-2);
  font-size: 0.8125rem; font-weight: 500; cursor: pointer;
  transition: border-color var(--dur); white-space: nowrap;
}
.uv-filter-select:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-ring); }
.uv-filter-select:hover { border-color: var(--c-text-3); }
@media (max-width: 640px) { .uv-filters { display: none; } }

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

/* Cell styles */
.uv-roles-row { display: flex; gap: 4px; flex-wrap: wrap; }
.uv-role-pill {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
}
.uv-role--admin  { background: #DBEAFE; color: #1D4ED8; }
.uv-role--driver { background: #D1FAE5; color: #047857; }

.uv-row-actions { display: flex; align-items: center; gap: 4px; }

/* ── Modal ───────────────────────────────────────────────────── */
.uv-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.45); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.uv-modal {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 18px; width: 100%; max-width: 480px;
  box-shadow: var(--sh-xl); overflow: hidden;
  display: flex; flex-direction: column;
  max-height: 92dvh;
}
.uv-modal-hd {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 20px 20px 16px; border-bottom: 1px solid var(--c-border-light);
}
.uv-modal-icon {
  width: 38px; height: 38px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.uv-modal-icon svg { width: 18px; height: 18px; }
.uv-modal-title { font-size: 1rem; font-weight: 700; color: var(--c-text-1); }
.uv-modal-sub { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 1px; }
.uv-modal-close { margin-left: auto; flex-shrink: 0; background: none; border: none; cursor: pointer; color: var(--c-text-3); font-size: 1rem; padding: 4px; transition: color var(--dur); }
.uv-modal-close:hover { color: var(--c-text-1); }
.uv-modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; }
.uv-modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

.uv-field { display: flex; flex-direction: column; gap: 5px; }
.uv-field--row { flex-direction: row; align-items: center; gap: 12px; }
.uv-label { font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2); }
.uv-optional { font-weight: 400; color: var(--c-text-3); }
.uv-input {
  width: 100%; padding: 8px 12px; border: 1px solid var(--c-border); border-radius: 8px;
  background: var(--c-bg); color: var(--c-text-1); font-size: 0.875rem;
  transition: border-color var(--dur); box-sizing: border-box;
}
.uv-input:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-ring); }
.uv-input--mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.875rem; letter-spacing: 0.04em; }

.uv-toggle { display: inline-flex; align-items: center; cursor: pointer; }
.uv-toggle input { display: none; }
.uv-toggle-track {
  width: 36px; height: 20px; border-radius: 10px; background: var(--c-border);
  transition: background 0.2s; position: relative;
}
.uv-toggle-track::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 14px; height: 14px; border-radius: 50%;
  background: #fff; transition: transform 0.2s;
}
.uv-toggle input:checked + .uv-toggle-track { background: var(--c-accent); }
.uv-toggle input:checked + .uv-toggle-track::after { transform: translateX(16px); }

.uv-form-err { font-size: 0.8125rem; color: var(--c-red); background: var(--c-red-tint); padding: 8px 12px; border-radius: 8px; }

.uv-btn-primary {
  background: var(--c-accent); color: #fff; border: none; border-radius: 8px;
  padding: 8px 18px; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: opacity var(--dur);
}
.uv-btn-primary:hover:not(:disabled) { opacity: 0.88; }
.uv-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.uv-btn-ghost {
  background: transparent; color: var(--c-text-2); border: 1px solid var(--c-border);
  border-radius: 8px; padding: 8px 16px; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all var(--dur);
}
.uv-btn-ghost:hover { border-color: var(--c-text-2); color: var(--c-text-1); }

/* ── Two-column field row ─────────────────────────────────────── */
.uv-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 400px) { .uv-field-row { grid-template-columns: 1fr; } }

/* ── Photo upload inside modal ───────────────────────────────── */
.uv-photo-row { display: flex; align-items: center; gap: 12px; }
.uv-photo-thumb {
  width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--c-border); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--c-bg); color: var(--c-text-3);
}
.uv-photo-thumb img { width: 100%; height: 100%; object-fit: cover; }
.uv-photo-thumb svg { width: 22px; height: 22px; }
.uv-photo-btns { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.uv-btn-upload {
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: 7px; padding: 5px 12px;
  font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2);
  cursor: pointer; transition: all var(--dur);
}
.uv-btn-upload:hover { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-accent-tint); }
.uv-file-hidden { display: none; }
.uv-btn-rm-photo {
  background: none; border: 1px solid var(--c-border); border-radius: 7px;
  padding: 5px 10px; font-size: 0.8125rem; color: var(--c-red); cursor: pointer; transition: all var(--dur);
}
.uv-btn-rm-photo:hover { border-color: var(--c-red); background: var(--c-red-tint); }
</style>
