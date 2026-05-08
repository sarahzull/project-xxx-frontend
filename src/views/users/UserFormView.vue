<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  UserIcon, AlertIcon, ChevronLeftIcon,
} from '../../components/icons/index.js'
import usersApi from '../../api/users'
import rolesApi from '../../api/roles'
import basesApi from '../../api/bases'
import tripsApi from '../../api/trips'
import { useToast } from '../../composables/useToast'
import SelectInput from '../../components/common/SelectInput.vue'
import DatePicker  from '../../components/common/DatePicker.vue'

const props = defineProps({
  id: { type: [String, Number], default: null },
})

const router = useRouter()
const toast  = useToast()

const isEdit = computed(() => props.id != null && props.id !== '')

const roles = ref([])
const bases = ref([])

const loading     = ref(true)
const saving      = ref(false)
const formError   = ref('')
const editingUser = ref(null)

const showBlockConfirm = ref(false)

function blankForm() {
  return {
    name: '', email: '', password: '', dob: '', phone: '',
    role_id: '', driver_id: '', photo: '',
    license_no: '', license_date: '', date_joined: '',
    license_type: '', license_expiry: '', gdl_expiry: '',
    ranking: '', oil_company: '',
    base: 'MA',
    is_active: true,
  }
}

const form = ref(blankForm())
const photoPreview = ref('')
const fieldErrors  = ref({ email: '', phone: '' })
const fieldTouched = ref({ email: false, phone: false })

const roleOptions = computed(() =>
  roles.value.map(r => ({ value: r.id, label: r.name })),
)
const baseOptions = computed(() =>
  bases.value.map(b => ({ value: b.code, label: `${b.code} — ${b.label}` })),
)

const passwordStrength = computed(() => {
  const pw = form.value.password
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
})

const pwLabel = computed(() => {
  if (!form.value.password) return ''
  return passwordStrength.value <= 1 ? 'Weak' : passwordStrength.value <= 3 ? 'Fair' : 'Strong'
})
const pwClass = computed(() => {
  if (!form.value.password) return ''
  return passwordStrength.value <= 1 ? 'pw-weak' : passwordStrength.value <= 3 ? 'pw-fair' : 'pw-strong'
})

const monthlyTripsCount   = ref(null)
const monthlyTripsLoading = ref(false)

const computedRanking = computed(() => {
  if (monthlyTripsCount.value === null) return null
  if (monthlyTripsCount.value >= 30) return 'A'
  if (monthlyTripsCount.value >= 15) return 'B'
  return 'C'
})

const rankingLabel = computed(() => {
  if (monthlyTripsLoading.value) return 'Calculating from trips…'
  if (monthlyTripsCount.value === null) {
    return form.value.driver_id
      ? 'No trips yet — will recalculate next month'
      : 'Assign a Driver ID to calculate'
  }
  const trips = monthlyTripsCount.value
  const tag = trips === 1 ? 'trip' : 'trips'
  switch (computedRanking.value) {
    case 'A': return `A · High performer (${trips} ${tag} last month)`
    case 'B': return `B · Regular (${trips} ${tag} last month)`
    case 'C': return `C · Entry (${trips} ${tag} last month)`
    default:  return `${trips} ${tag} last month`
  }
})

async function loadMonthlyTrips(driverId) {
  if (!driverId) {
    monthlyTripsCount.value = null
    return
  }
  monthlyTripsLoading.value = true
  try {
    const now  = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const y = prev.getFullYear()
    const m = String(prev.getMonth() + 1).padStart(2, '0')
    const last = String(new Date(y, prev.getMonth() + 1, 0).getDate()).padStart(2, '0')
    const { data } = await tripsApi.list({
      driver_id: driverId,
      from: `${y}-${m}-01`,
      to:   `${y}-${m}-${last}`,
    })
    const monthPrefix = `${y}-${m}`
    monthlyTripsCount.value = (data.data || []).filter(t => (t.date || '').startsWith(monthPrefix)).length
  } catch {
    monthlyTripsCount.value = null
  } finally {
    monthlyTripsLoading.value = false
  }
}

watch(() => form.value.driver_id, (id) => loadMonthlyTrips(id))

function validateEmail() {
  if (!fieldTouched.value.email) return
  const v = form.value.email
  fieldErrors.value.email = v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    ? 'Enter a valid email address'
    : ''
}
function validatePhone() {
  if (!fieldTouched.value.phone) return
  const v = (form.value.phone || '').replace(/[\s-]/g, '')
  fieldErrors.value.phone = v && !/^(\+?60|0)\d{7,11}$/.test(v)
    ? 'Enter a valid phone number (e.g. 012-3456789)'
    : ''
}

function onPhotoChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    photoPreview.value = ev.target.result
    form.value.photo   = ev.target.result
  }
  reader.readAsDataURL(file)
}
function removePhoto() {
  photoPreview.value = ''
  form.value.photo   = ''
}

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

async function loadUser() {
  try {
    const { data } = await usersApi.get(props.id)
    // Laravel `show` returns the resource directly; `index` wraps in { data: [...] }.
    const u = data?.data ?? data ?? null
    if (!u || !u.id) {
      console.warn('[UserFormView] empty user response', data)
      toast.error('User not found.', { title: 'Load Failed' })
      router.replace({ name: 'users' })
      return
    }
    editingUser.value = u
    form.value = {
      name:           u.name,
      email:          u.email,
      password:       '',
      dob:            u.dob || '',
      phone:          u.phone || '',
      role_id:        u.roles?.[0]?.id || '',
      driver_id:      u.driver_id || '',
      photo:          u.photo || '',
      license_no:     u.license_no || '',
      license_date:   u.license_date || '',
      date_joined:    u.date_joined || '',
      license_type:   u.license_type || '',
      license_expiry: u.license_expiry || '',
      gdl_expiry:     u.gdl_expiry || '',
      ranking:        u.ranking || '',
      oil_company:    u.oil_company || '',
      base:           u.base || 'MA',
      is_active:      u.is_active,
    }
    photoPreview.value = u.photo || ''
    if (form.value.driver_id) loadMonthlyTrips(form.value.driver_id)
  } catch (err) {
    toast.error(err?.response?.data?.message || 'Failed to load user.', { title: 'Load Failed' })
    router.replace({ name: 'users' })
  }
}

onMounted(async () => {
  await Promise.all([fetchRoles(), fetchBases()])
  if (isEdit.value) {
    await loadUser()
  } else {
    form.value.role_id = roles.value[0]?.id || ''
  }
  loading.value = false
})

async function saveUser() {
  formError.value = ''
  if (editingUser.value?.is_active === true && form.value.is_active === false && !showBlockConfirm.value) {
    showBlockConfirm.value = true
    return
  }
  showBlockConfirm.value = false

  saving.value = true
  try {
    const payload = {
      name:           form.value.name,
      email:          form.value.email,
      roles:          form.value.role_id ? [form.value.role_id] : [],
      driver_id:      form.value.driver_id      || null,
      phone:          form.value.phone          || null,
      dob:            form.value.dob            || null,
      photo:          form.value.photo          || null,
      license_no:     form.value.license_no     || null,
      license_date:   form.value.license_date   || null,
      date_joined:    form.value.date_joined    || null,
      license_type:   form.value.license_type   || null,
      license_expiry: form.value.license_expiry || null,
      gdl_expiry:     form.value.gdl_expiry     || null,
      ranking:        computedRanking.value     || null,
      oil_company:    form.value.oil_company    || null,
      base:           form.value.base,
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
    toast.success(isEdit.value ? 'User updated successfully.' : 'User created successfully.', {
      title: isEdit.value ? 'User Updated' : 'User Created',
    })
    router.push({ name: 'users' })
  } catch (e) {
    const errors = e.response?.data?.errors
    formError.value = errors
      ? Object.values(errors).flat().join(' ')
      : (e.response?.data?.message || 'An error occurred.')
    if (!errors) {
      toast.error(formError.value, {
        title: isEdit.value ? 'Update Failed' : 'Create Failed',
      })
    }
  } finally {
    saving.value = false
  }
}

function cancel() {
  router.push({ name: 'users' })
}
</script>

<template>
  <div class="uf">

    <div class="uf-topbar">
      <button type="button" class="uf-back" @click="cancel">
        <ChevronLeftIcon :size="16" />
        <span>Users</span>
      </button>
      <div class="uf-title-block">
        <h1 class="uf-title">{{ isEdit ? 'Edit User' : 'New User' }}</h1>
        <p class="uf-sub">{{ isEdit ? 'Update account details' : 'Create a new system account' }}</p>
      </div>
    </div>

    <div v-if="loading" class="uf-loading">
      <div class="uf-spinner" /><span>Loading…</span>
    </div>

    <form v-else class="uf-form" @submit.prevent="saveUser">

      <div class="uf-card">
        <div class="uf-card-hd">
          <div class="uf-card-icon"><UserIcon :size="18" /></div>
          <div>
            <p class="uf-card-title">Account</p>
            <p class="uf-card-sub">Identity, contact and credentials</p>
          </div>
        </div>

        <div class="uf-grid">
          <div class="uv-field uf-field--full">
            <label class="uv-label">Full Name</label>
            <input v-model="form.name" class="uv-input" type="text" required placeholder="e.g. Ahmad Razak" />
          </div>

          <div class="uv-field uf-field--full">
            <label class="uv-label">Email Address</label>
            <input
              v-model="form.email"
              :class="['uv-input', fieldErrors.email ? 'uv-input--error' : (fieldTouched.email && form.email && !fieldErrors.email ? 'uv-input--valid' : '')]"
              type="email" required placeholder="user@example.com"
              @blur="fieldTouched.email = true; validateEmail()"
              @input="fieldTouched.email && validateEmail()"
            />
            <p v-if="fieldErrors.email" class="uv-field-err">{{ fieldErrors.email }}</p>
          </div>

          <div class="uv-field uf-field--full">
            <label class="uv-label">
              Password
              <span v-if="isEdit" class="uv-optional"> — leave blank to keep current</span>
            </label>
            <input
              v-model="form.password"
              class="uv-input"
              type="password"
              :required="!isEdit"
              placeholder="Min. 8 characters"
              autocomplete="new-password"
            />
            <div v-if="form.password" class="uv-pw-strength">
              <div class="uv-pw-bars">
                <div v-for="i in 4" :key="i" :class="['uv-pw-bar', i <= Math.ceil(passwordStrength * 4 / 5) ? pwClass : '']" />
              </div>
              <span :class="['uv-pw-label', pwClass]">{{ pwLabel }}</span>
            </div>
          </div>

          <div class="uv-field">
            <label class="uv-label">Date of Birth</label>
            <DatePicker v-model="form.dob" placeholder="Select date" aria-label="Date of birth" />
          </div>
          <div class="uv-field">
            <label class="uv-label">Phone No.</label>
            <input
              v-model="form.phone"
              :class="['uv-input', fieldErrors.phone ? 'uv-input--error' : '']"
              type="tel" placeholder="e.g. 012-3456789"
              @blur="fieldTouched.phone = true; validatePhone()"
              @input="fieldTouched.phone && validatePhone()"
            />
            <p v-if="fieldErrors.phone" class="uv-field-err">{{ fieldErrors.phone }}</p>
          </div>

          <div class="uv-field">
            <label class="uv-label">Role</label>
            <SelectInput
              v-model="form.role_id"
              :options="roleOptions"
              placeholder="Select a role…"
              :clearable="false"
            />
          </div>
          <div class="uv-field">
            <label class="uv-label">Base</label>
            <SelectInput
              v-model="form.base"
              :options="baseOptions"
              placeholder="Select a base…"
              :clearable="false"
            />
          </div>
        </div>
      </div>

      <div class="uf-card">
        <div class="uf-card-hd">
          <div class="uf-card-icon"><UserIcon :size="18" /></div>
          <div>
            <p class="uf-card-title">Driver profile</p>
            <p class="uf-card-sub">SWAT linkage, license and ranking</p>
          </div>
        </div>

        <div class="uf-grid">
          <div class="uv-field uf-field--full">
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

          <div class="uv-field uf-field--full">
            <label class="uv-label">Photo</label>
            <div class="uv-photo-row">
              <div class="uv-photo-thumb">
                <img v-if="photoPreview" :src="photoPreview" alt="preview" />
                <UserIcon v-else :size="24" :stroke-width="1.5" />
              </div>
              <div class="uv-photo-btns">
                <label class="uv-btn-upload" :for="`uf-photo-${editingUser?.id ?? 'new'}`">
                  {{ photoPreview ? 'Change' : 'Upload' }}
                </label>
                <input :id="`uf-photo-${editingUser?.id ?? 'new'}`" type="file" accept="image/*" class="uv-file-hidden" @change="onPhotoChange" />
                <button v-if="photoPreview" type="button" class="uv-btn-rm-photo" @click="removePhoto">Remove</button>
              </div>
            </div>
          </div>

          <div class="uv-field">
            <label class="uv-label">License No.</label>
            <input v-model="form.license_no" class="uv-input uv-input--mono" type="text" placeholder="e.g. D12345678" />
          </div>
          <div class="uv-field">
            <label class="uv-label">License Date</label>
            <DatePicker v-model="form.license_date" placeholder="Select date" aria-label="License date" />
          </div>

          <div class="uv-field uf-field--full">
            <label class="uv-label">Date Joined Company</label>
            <DatePicker v-model="form.date_joined" placeholder="Select date" aria-label="Date joined company" />
          </div>

          <div class="uv-field">
            <label class="uv-label">License Type</label>
            <input v-model="form.license_type" class="uv-input uv-input--mono" type="text" placeholder="e.g. D or E" maxlength="10" />
          </div>
          <div class="uv-field">
            <label class="uv-label">
              Ranking
              <span class="uv-label-hint">auto</span>
            </label>
            <div class="uv-ranking-display" :class="computedRanking && `uv-ranking-display--${computedRanking.toLowerCase()}`">
              <span v-if="computedRanking" class="uv-ranking-badge">{{ computedRanking }}</span>
              <span class="uv-ranking-text">{{ rankingLabel }}</span>
            </div>
          </div>

          <div class="uv-field">
            <label class="uv-label">License Expiry</label>
            <DatePicker v-model="form.license_expiry" placeholder="Select date" aria-label="License expiry" />
          </div>
          <div class="uv-field">
            <label class="uv-label">GDL Expiry</label>
            <DatePicker v-model="form.gdl_expiry" placeholder="Select date" aria-label="GDL expiry" />
          </div>

          <div class="uv-field uf-field--full">
            <label class="uv-label">Oil Company</label>
            <input v-model="form.oil_company" class="uv-input" type="text" placeholder="e.g. Petronas, Shell" maxlength="100" />
          </div>

          <div v-if="isEdit" class="uv-field uf-field--full uv-field--row">
            <label class="uv-label">Account Active</label>
            <label class="uv-toggle">
              <input v-model="form.is_active" type="checkbox" @change="showBlockConfirm = false" />
              <span class="uv-toggle-track" />
            </label>
          </div>
        </div>
      </div>

      <div v-if="showBlockConfirm" class="uv-block-confirm">
        <AlertIcon :size="16" class="uv-block-confirm-icon" />
        <div>
          <p class="uv-block-confirm-title">Block this account?</p>
          <p class="uv-block-confirm-body">This user will not be able to log in until their account is reactivated.</p>
        </div>
      </div>

      <p v-if="formError" class="uv-form-err">{{ formError }}</p>

      <div class="uf-foot">
        <button type="button" class="uv-btn-ghost" @click="cancel">Cancel</button>
        <button type="submit" :class="['uv-btn-primary', showBlockConfirm && 'uv-btn-danger']" :disabled="saving">
          {{ saving ? 'Saving…' : showBlockConfirm ? 'Confirm Block' : (isEdit ? 'Save Changes' : 'Create User') }}
        </button>
      </div>
    </form>

  </div>
</template>

<style scoped>
.uf { min-width: 0; max-width: 880px; margin: 0 auto; }

.uf-topbar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-bottom: 18px;
}
.uf-back {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-md); padding: 7px 11px;
  font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2);
  cursor: pointer; transition: all var(--dur);
}
.uf-back:hover { border-color: var(--c-text-2); color: var(--c-text-1); }
.uf-back svg { width: 14px; height: 14px; }
.uf-title-block { min-width: 0; }
.uf-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -.02em; }
@media (min-width: 640px) { .uf-title { font-size: 1.25rem; } }
.uf-sub { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 1px; }

.uf-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--c-text-3); }
.uf-spinner { width: 20px; height: 20px; border: 2px solid var(--c-border); border-top-color: var(--c-accent); border-radius: 50%; animation: uf-spin .7s linear infinite; }
@keyframes uf-spin { to { transform: rotate(360deg); } }

.uf-form { display: flex; flex-direction: column; gap: 16px; }

.uf-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 18px 20px;
}
@media (min-width: 640px) { .uf-card { padding: 20px 24px; } }

.uf-card-hd { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.uf-card-icon {
  width: 36px; height: 36px; border-radius: var(--r-lg); flex-shrink: 0;
  background: var(--c-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
}
.uf-card-icon svg { width: 16px; height: 16px; }
.uf-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); letter-spacing: -.01em; }
.uf-card-sub   { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 1px; }

.uf-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
}
.uf-field--full { grid-column: 1 / -1; }
@media (max-width: 480px) { .uf-grid { grid-template-columns: 1fr; } }

.uf-foot {
  display: flex; justify-content: flex-end; gap: 8px;
  position: sticky; bottom: 0;
  padding: 12px 0;
  background: linear-gradient(180deg, transparent 0%, var(--c-bg) 30%);
}

/* Shared field styles (kept matching original modal markup) */
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
.uv-input--mono  { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.875rem; letter-spacing: 0.04em; }
.uv-input--error { border-color: var(--c-red) !important; box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }
.uv-input--valid { border-color: #16A34A; }
.uv-field-err { font-size: 0.75rem; color: var(--c-red); margin-top: 1px; }

.uv-label-hint {
  margin-left: 6px; padding: 1px 7px; border-radius: var(--r-full);
  background: var(--c-bg); color: var(--c-text-3);
  font-size: 0.625rem; font-weight: 700; letter-spacing: 0.05em;
  text-transform: uppercase;
}
.uv-ranking-display {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 12px; border: 1px dashed var(--c-border);
  border-radius: 8px; background: var(--c-bg); box-sizing: border-box;
  min-height: 38px;
}
.uv-ranking-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: var(--r-full);
  font-size: 0.8125rem; font-weight: 800;
  background: var(--c-text-3); color: #fff;
}
.uv-ranking-text { font-size: 0.8125rem; color: var(--c-text-2); }
.uv-ranking-display--a .uv-ranking-badge { background: var(--c-green); }
.uv-ranking-display--b .uv-ranking-badge { background: var(--c-accent); }
.uv-ranking-display--c .uv-ranking-badge { background: var(--c-amber); }

.uv-pw-strength { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.uv-pw-bars { display: flex; gap: 4px; flex: 1; }
.uv-pw-bar { height: 3px; flex: 1; border-radius: 2px; background: var(--c-border); transition: background 0.2s; }
.pw-weak  .uv-pw-bar, .uv-pw-bar.pw-weak  { background: #EF4444; }
.pw-fair  .uv-pw-bar, .uv-pw-bar.pw-fair  { background: #D97706; }
.pw-strong .uv-pw-bar, .uv-pw-bar.pw-strong { background: #16A34A; }
.uv-pw-label { font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
.uv-pw-label.pw-weak   { color: #EF4444; }
.uv-pw-label.pw-fair   { color: #D97706; }
.uv-pw-label.pw-strong { color: #16A34A; }

.uv-toggle { display: inline-flex; align-items: center; cursor: pointer; }
.uv-toggle input { display: none; }
.uv-toggle-track {
  width: 36px; height: 20px; border-radius: 10px; background: var(--c-border);
  transition: background 0.2s; position: relative;
}
.uv-toggle-track::after {
  content: ''; position: absolute; top: 3px; left: 3px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--c-surface); transition: transform 0.2s;
}
.uv-toggle input:checked + .uv-toggle-track { background: var(--c-accent); }
.uv-toggle input:checked + .uv-toggle-track::after { transform: translateX(16px); }

.uv-form-err { font-size: 0.8125rem; color: var(--c-red); background: var(--c-red-tint); padding: 8px 12px; border-radius: 8px; }

.uv-block-confirm {
  display: flex; align-items: flex-start; gap: 10px;
  background: var(--c-red-tint); border: 1px solid color-mix(in srgb, var(--c-red) 25%, transparent);
  border-radius: 8px; padding: 12px 14px;
}
.uv-block-confirm-icon { color: var(--c-red); flex-shrink: 0; margin-top: 1px; }
.uv-block-confirm-title { font-size: 0.8125rem; font-weight: 600; color: var(--c-red); }
.uv-block-confirm-body  { font-size: 0.75rem; color: var(--c-text-2); margin-top: 2px; }

.uv-btn-danger { background: var(--c-red) !important; color: #fff !important; }
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
