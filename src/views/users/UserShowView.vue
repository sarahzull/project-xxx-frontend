<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  UserIcon, EditIcon, ChevronLeftIcon, AlertIcon,
} from '../../components/icons/index.js'
import usersApi from '../../api/users'
import basesApi from '../../api/bases'
import { useAuthStore } from '../../stores/auth'
import { useToast } from '../../composables/useToast'
import StatusBadge from '../../components/common/StatusBadge.vue'
import ModalSheet  from '../../components/common/ModalSheet.vue'

const props = defineProps({
  id: { type: [String, Number], required: true },
})

const router = useRouter()
const auth   = useAuthStore()
const toast  = useToast()

const loading = ref(true)
const user    = ref(null)
const bases   = ref([])

const baseLabel = computed(() => {
  if (!user.value?.base) return ''
  const b = bases.value.find(x => x.code === user.value.base)
  return b ? `${b.code} — ${b.label}` : user.value.base
})

const roleLabel = computed(() =>
  user.value?.roles?.map(r => r.name).join(', ') || '—',
)

const isSelf = computed(() => user.value?.id === auth.user?.id)

function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).split('-')
  return d ? `${d}/${m}/${y}` : iso
}

async function loadUser() {
  loading.value = true
  try {
    const { data } = await usersApi.get(props.id)
    // Backend may wrap in { data: ... } (Laravel Resource) or return the model directly.
    user.value = data?.data ?? data ?? null
    if (!user.value || !user.value.id) {
      console.warn('[UserShowView] empty user response', data)
      toast.error('User not found.', { title: 'Load Failed' })
      router.replace({ name: 'users' })
    }
  } catch (err) {
    console.error('[UserShowView] loadUser failed', err)
    toast.error(err?.response?.data?.message || 'Failed to load user.', { title: 'Load Failed' })
    router.replace({ name: 'users' })
  } finally {
    loading.value = false
  }
}

async function loadBases() {
  try {
    const { data } = await basesApi.list()
    bases.value = data.data || []
  } catch { /* silent */ }
}

onMounted(() => { loadUser(); loadBases() })

function back()   { router.push({ name: 'users' }) }
function goEdit() { router.push({ name: 'user-edit', params: { id: props.id } }) }

const showConfirm  = ref(false)
const togglingActive = ref(false)

function askToggleActive() {
  if (isSelf.value) return
  showConfirm.value = true
}
async function confirmToggleActive() {
  if (!user.value) return
  togglingActive.value = true
  const next = !user.value.is_active
  try {
    await usersApi.update(user.value.id, { is_active: next })
    user.value.is_active = next
    showConfirm.value = false
    toast.success(
      next ? `${user.value.name} reactivated.` : `${user.value.name} deactivated.`,
      { title: next ? 'Account Active' : 'Account Deactivated' },
    )
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to update account status.', {
      title: 'Action Failed',
    })
  } finally {
    togglingActive.value = false
  }
}
</script>

<template>
  <div class="us">

    <div class="us-topbar">
      <button type="button" class="us-back" @click="back">
        <ChevronLeftIcon :size="16" />
        <span>Users</span>
      </button>
      <div v-if="user" class="us-topbar-actions">
        <button class="us-btn us-btn--ghost" @click="goEdit">
          <EditIcon :size="14" />
          Edit
        </button>
        <button
          v-if="user.is_active"
          class="us-btn us-btn--warn"
          :disabled="isSelf"
          :title="isSelf ? 'You cannot deactivate your own account' : 'Block sign-in for this user'"
          @click="askToggleActive"
        >
          Deactivate
        </button>
        <button
          v-else
          class="us-btn us-btn--success"
          @click="askToggleActive"
        >
          Reactivate
        </button>
      </div>
    </div>

    <div v-if="loading" class="us-loading">
      <div class="us-spinner" /><span>Loading…</span>
    </div>

    <template v-else-if="user">
      <div class="us-header us-card">
        <div class="us-avatar">
          <img v-if="user.photo" :src="user.photo" :alt="user.name" />
          <UserIcon v-else :size="36" :stroke-width="1.5" />
        </div>
        <div class="us-header-text">
          <h1 class="us-name">{{ user.name }}</h1>
          <p class="us-email">{{ user.email }}</p>
          <div class="us-tags">
            <span class="us-pill us-pill--role">{{ roleLabel }}</span>
            <span v-if="user.base" class="us-pill us-pill--base">{{ user.base }}</span>
            <StatusBadge :status="user.is_active ? 'active' : 'blocked'" />
          </div>
        </div>
      </div>

      <div class="us-card">
        <p class="us-card-title">Account</p>
        <dl class="us-grid">
          <div class="us-row">
            <dt>Phone</dt><dd>{{ user.phone || '—' }}</dd>
          </div>
          <div class="us-row">
            <dt>Date of Birth</dt><dd>{{ fmtDate(user.dob) }}</dd>
          </div>
          <div class="us-row">
            <dt>Role</dt><dd>{{ roleLabel }}</dd>
          </div>
          <div class="us-row">
            <dt>Base</dt><dd>{{ baseLabel || '—' }}</dd>
          </div>
        </dl>
      </div>

      <div class="us-card">
        <p class="us-card-title">Driver profile</p>
        <dl class="us-grid">
          <div class="us-row">
            <dt>Driver ID</dt><dd class="us-mono">{{ user.driver_id || '—' }}</dd>
          </div>
          <div class="us-row">
            <dt>Ranking</dt><dd>{{ user.ranking || '—' }}</dd>
          </div>
          <div class="us-row">
            <dt>License No.</dt><dd class="us-mono">{{ user.license_no || '—' }}</dd>
          </div>
          <div class="us-row">
            <dt>License Type</dt><dd class="us-mono">{{ user.license_type || '—' }}</dd>
          </div>
          <div class="us-row">
            <dt>License Date</dt><dd>{{ fmtDate(user.license_date) }}</dd>
          </div>
          <div class="us-row">
            <dt>License Expiry</dt><dd>{{ fmtDate(user.license_expiry) }}</dd>
          </div>
          <div class="us-row">
            <dt>GDL Expiry</dt><dd>{{ fmtDate(user.gdl_expiry) }}</dd>
          </div>
          <div class="us-row">
            <dt>Date Joined</dt><dd>{{ fmtDate(user.date_joined) }}</dd>
          </div>
          <div class="us-row">
            <dt>Oil Company</dt><dd>{{ user.oil_company || '—' }}</dd>
          </div>
        </dl>
      </div>
    </template>

    <ModalSheet
      v-model="showConfirm"
      :title="user?.is_active ? 'Deactivate account?' : 'Reactivate account?'"
      :subtitle="user?.name || ''"
      max-width="420px"
    >
      <div class="us-confirm">
        <div :class="['us-confirm-icon', user?.is_active ? 'us-confirm-icon--warn' : 'us-confirm-icon--ok']">
          <AlertIcon :size="18" />
        </div>
        <p v-if="user?.is_active" class="us-confirm-body">
          The user will not be able to sign in until the account is reactivated.
          Their data and history are preserved.
        </p>
        <p v-else class="us-confirm-body">
          The user will be able to sign in again with their existing credentials.
        </p>
      </div>
      <template #footer>
        <div class="us-confirm-actions">
          <button class="us-btn us-btn--ghost" :disabled="togglingActive" @click="showConfirm = false">Cancel</button>
          <button
            :class="['us-btn', user?.is_active ? 'us-btn--warn-solid' : 'us-btn--success-solid']"
            :disabled="togglingActive"
            @click="confirmToggleActive"
          >
            {{ togglingActive ? 'Saving…' : (user?.is_active ? 'Deactivate' : 'Reactivate') }}
          </button>
        </div>
      </template>
    </ModalSheet>
  </div>
</template>

<style scoped>
.us { min-width: 0; max-width: 880px; margin: 0 auto; }

.us-topbar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.us-back {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-md); padding: 7px 11px;
  font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2);
  cursor: pointer; transition: all var(--dur);
}
.us-back:hover { border-color: var(--c-text-2); color: var(--c-text-1); }
.us-back svg { width: 14px; height: 14px; }
.us-topbar-actions { display: flex; gap: 8px; margin-left: auto; flex-wrap: wrap; }

.us-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: var(--r-md);
  font-size: 0.8125rem; font-weight: 600;
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur);
}
.us-btn svg { width: 14px; height: 14px; }
.us-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.us-btn--ghost  { color: var(--c-text-2); }
.us-btn--ghost:hover:not(:disabled) {
  border-color: var(--c-accent); color: var(--c-accent); background: var(--c-accent-tint);
}
.us-btn--warn { color: #B45309; border-color: color-mix(in srgb, #D97706 40%, transparent); }
.us-btn--warn:hover:not(:disabled) { background: rgba(217,119,6,0.08); border-color: #D97706; }
.us-btn--warn-solid { background: #D97706; color: #fff; border-color: #D97706; }
.us-btn--warn-solid:hover:not(:disabled) { background: #B45309; border-color: #B45309; }

.us-btn--success { color: #15803D; border-color: color-mix(in srgb, #16A34A 40%, transparent); }
.us-btn--success:hover:not(:disabled) { background: rgba(22,163,74,0.08); border-color: #16A34A; }
.us-btn--success-solid { background: #16A34A; color: #fff; border-color: #16A34A; }
.us-btn--success-solid:hover:not(:disabled) { background: #15803D; border-color: #15803D; }

/* Confirm dialog body */
.us-confirm { display: flex; gap: 12px; padding: 18px 18px 4px; align-items: flex-start; }
.us-confirm-icon {
  width: 32px; height: 32px; border-radius: 999px; flex-shrink: 0;
  display: grid; place-items: center;
}
.us-confirm-icon--warn { background: rgba(217,119,6,0.12); color: #B45309; }
.us-confirm-icon--ok   { background: rgba(22,163,74,0.12); color: #15803D; }
.us-confirm-body { font-size: 0.875rem; color: var(--c-text-2); line-height: 1.5; }
.us-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 6px 4px; }

.us-loading { display: flex; align-items: center; gap: 10px; padding: 40px 0; color: var(--c-text-3); }
.us-spinner { width: 20px; height: 20px; border: 2px solid var(--c-border); border-top-color: var(--c-accent); border-radius: 50%; animation: us-spin .7s linear infinite; }
@keyframes us-spin { to { transform: rotate(360deg); } }

.us-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 18px 20px; margin-bottom: 14px;
}
@media (min-width: 640px) { .us-card { padding: 20px 24px; } }
.us-card-title { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c-text-3); margin-bottom: 12px; }

.us-header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.us-avatar {
  width: 72px; height: 72px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--c-border); overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  background: var(--c-bg); color: var(--c-text-3);
}
.us-avatar img { width: 100%; height: 100%; object-fit: cover; }
.us-avatar svg { width: 36px; height: 36px; }
.us-header-text { min-width: 0; flex: 1; }
.us-name { font-size: 1.25rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -.02em; }
.us-email { font-size: 0.875rem; color: var(--c-text-3); margin-top: 2px; }
.us-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; align-items: center; }
.us-pill {
  display: inline-flex; padding: 2px 8px; border-radius: 4px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
}
.us-pill--role { background: #DBEAFE; color: #1D4ED8; }
.us-pill--base { background: #F3E8FF; color: #6B21A8; font-family: 'JetBrains Mono', 'Fira Code', monospace; }

.us-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px 24px;
}
@media (max-width: 480px) { .us-grid { grid-template-columns: 1fr; } }
.us-row dt {
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--c-text-3);
  margin-bottom: 2px;
}
.us-row dd { font-size: 0.875rem; color: var(--c-text-1); margin: 0; }
.us-mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; letter-spacing: 0.04em; }
</style>
