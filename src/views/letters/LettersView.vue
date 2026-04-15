<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  LetterIcon, LetterOpenIcon, SendIcon, AddIcon,
  CloseIcon, DriversIcon, CalendarIcon, CheckCircleIcon, AlertIcon,
  SearchIcon,
} from '../../components/icons/index.js'
import lettersApi from '../../api/letters'
import driversApi  from '../../api/drivers'
import { useAuthStore } from '../../stores/auth'
import { useToast } from '../../composables/useToast'
import ModalSheet from '../../components/common/ModalSheet.vue'

const auth  = useAuthStore()
const toast = useToast()

const isAdmin = computed(() => auth.hasRole('admin'))

// ── State ─────────────────────────────────────────────────────────────────────
const letters  = ref([])
const loading  = ref(true)
const error    = ref('')

// Filter (admin)
const typeFilter = ref('')   // '' | 'reward' | 'warning'

// Detail modal
const showDetail  = ref(false)
const activeLetter = ref(null)

// Compose modal (admin)
const showCompose = ref(false)
const sending     = ref(false)
const composeErr  = ref('')
const form = ref({
  driver_id: '',
  type:      'reward',
  subject:   '',
  content:   '',
  date:      new Date().toISOString().split('T')[0],
})

// Driver search (inside compose modal)
const driverQuery       = ref('')
const driverResults     = ref([])
const driverSearching   = ref(false)
const showDriverDrop    = ref(false)
const selectedDriver    = ref(null)   // { driver_id, name }

let _searchTimer = null
function onDriverInput() {
  selectedDriver.value = null
  form.value.driver_id = ''
  const q = driverQuery.value.trim()
  if (!q) { driverResults.value = []; showDriverDrop.value = false; return }
  clearTimeout(_searchTimer)
  driverSearching.value = true
  showDriverDrop.value  = true
  _searchTimer = setTimeout(async () => {
    try {
      const res = await driversApi.list({ search: q })
      driverResults.value = res.data.data || []
    } catch {
      driverResults.value = []
    } finally {
      driverSearching.value = false
    }
  }, 280)
}

function selectDriver(d) {
  selectedDriver.value = d
  form.value.driver_id = d.driver_id
  driverQuery.value    = ''
  driverResults.value  = []
  showDriverDrop.value = false
}

function clearDriver() {
  selectedDriver.value = null
  form.value.driver_id = ''
  driverQuery.value    = ''
  driverResults.value  = []
  showDriverDrop.value = false
}

// Hide dropdown when focus leaves the search box (delay lets click register first)
function onDriverBlur() {
  setTimeout(() => { showDriverDrop.value = false }, 180)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—'
  const p = (s || '').split('T')[0].split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s
}

// ── Computed ──────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  if (!typeFilter.value) return letters.value
  return letters.value.filter(l => l.type === typeFilter.value)
})

const rewardCount  = computed(() => letters.value.filter(l => l.type === 'reward').length)
const warningCount = computed(() => letters.value.filter(l => l.type === 'warning').length)

// ── Fetch ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const res = isAdmin.value
      ? await lettersApi.list()
      : await lettersApi.myLetters()
    letters.value = res.data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load letters.'
  } finally {
    loading.value = false
  }
})

// ── Open detail ───────────────────────────────────────────────────────────────
function openLetter(l) {
  activeLetter.value = l
  showDetail.value   = true
}

// ── Compose & Send (admin) ────────────────────────────────────────────────────
function openCompose() {
  form.value       = { driver_id: '', type: 'reward', subject: '', content: '', date: new Date().toISOString().split('T')[0] }
  composeErr.value = ''
  clearDriver()
  showCompose.value = true
}

async function sendLetter() {
  if (!form.value.driver_id || !form.value.subject || !form.value.content) {
    composeErr.value = 'Please fill in all required fields.'
    return
  }
  composeErr.value = ''
  sending.value = true
  try {
    await lettersApi.send(form.value)
    showCompose.value = false
    toast.success('Letter sent successfully.', { title: 'Letter Sent' })
    // Refresh list
    const res = await lettersApi.list()
    letters.value = res.data.data || []
  } catch (e) {
    composeErr.value = e.response?.data?.message || 'Failed to send letter.'
    toast.error(composeErr.value, { title: 'Send Failed' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="lv">

    <!-- ── Page header ─────────────────────────────────────────────────────── -->
    <div class="lv-hdr">
      <div class="lv-hdr-left">
        <div class="lv-hdr-icon"><LetterIcon :size="20" /></div>
        <div>
          <h1 class="lv-title">{{ isAdmin ? 'Letters' : 'My Letters' }}</h1>
          <p class="lv-sub">
            {{ isAdmin ? 'Compose and manage reward & warning letters for drivers' : 'Reward and warning letters from management' }}
          </p>
        </div>
      </div>
      <!-- Admin: Compose button -->
      <button v-if="isAdmin" class="lv-compose-btn" @click="openCompose">
        <AddIcon :size="16" />
        Compose Letter
      </button>
    </div>

    <!-- ── Error ───────────────────────────────────────────────────────────── -->
    <div v-if="error" class="lv-error">
      <CloseIcon :size="16" />{{ error }}
    </div>

    <!-- ── Loading ─────────────────────────────────────────────────────────── -->
    <div v-else-if="loading" class="lv-loading">
      <div class="lv-spinner" /><span>Loading letters…</span>
    </div>

    <template v-else>

      <!-- ── Stats row ─────────────────────────────────────────────────────── -->
      <div v-if="letters.length" class="lv-stats">
        <div class="lv-stat lv-stat--total">
          <span class="lv-stat-val">{{ letters.length }}</span>
          <span class="lv-stat-lbl">Total Letters</span>
        </div>
        <div class="lv-stat lv-stat--reward">
          <span class="lv-stat-val">{{ rewardCount }}</span>
          <span class="lv-stat-lbl">Reward</span>
        </div>
        <div class="lv-stat lv-stat--warning">
          <span class="lv-stat-val">{{ warningCount }}</span>
          <span class="lv-stat-lbl">Warning</span>
        </div>
      </div>

      <!-- ── Type filter ───────────────────────────────────────────────────── -->
      <div v-if="letters.length" class="lv-filters">
        <button
          :class="['lv-ftag', !typeFilter && 'lv-ftag--active']"
          @click="typeFilter = ''"
        >All</button>
        <button
          :class="['lv-ftag lv-ftag--reward', typeFilter === 'reward' && 'lv-ftag--active']"
          @click="typeFilter = 'reward'"
        >Reward</button>
        <button
          :class="['lv-ftag lv-ftag--warning', typeFilter === 'warning' && 'lv-ftag--active']"
          @click="typeFilter = 'warning'"
        >Warning</button>
      </div>

      <!-- ── Empty ─────────────────────────────────────────────────────────── -->
      <div v-if="!filtered.length" class="lv-empty">
        <LetterIcon :size="36" :stroke-width="1.2" />
        <p>{{ letters.length ? 'No letters match this filter' : 'No letters yet' }}</p>
      </div>

      <!-- ── Letter list ───────────────────────────────────────────────────── -->
      <div v-else class="lv-list">
        <div
          v-for="l in filtered"
          :key="l.id"
          :class="['lv-item', `lv-item--${l.type}`]"
          @click="openLetter(l)"
        >
          <!-- Icon -->
          <div :class="['lv-item-icon', `lv-item-icon--${l.type}`]">
            <CheckCircleIcon v-if="l.type === 'reward'"  :size="18" />
            <AlertIcon       v-else                      :size="18" />
          </div>

          <!-- Content -->
          <div class="lv-item-body">
            <div class="lv-item-top">
              <span class="lv-item-subject">{{ l.subject || '(No subject)' }}</span>
              <span :class="['lv-type-badge', `lv-type-badge--${l.type}`]">{{ l.type }}</span>
            </div>
            <p class="lv-item-preview">{{ l.content }}</p>
            <div class="lv-item-meta">
              <span v-if="isAdmin && l.driver_name" class="lv-item-driver">
                <DriversIcon :size="11" />{{ l.driver_name }}
              </span>
              <span class="lv-item-date">
                <CalendarIcon :size="11" />{{ formatDate(l.date || l.created_at) }}
              </span>
            </div>
          </div>

          <LetterOpenIcon :size="16" class="lv-item-arrow" />
        </div>
      </div>

    </template>

    <!-- ── Letter detail modal ────────────────────────────────────────────── -->
    <ModalSheet
      v-model="showDetail"
      :title="activeLetter?.subject || 'Letter'"
      :subtitle="activeLetter ? `${activeLetter.type === 'reward' ? 'Reward' : 'Warning'} Letter · ${formatDate(activeLetter.date || activeLetter.created_at)}` : ''"
      max-width="560px"
    >
      <template #icon>
        <div :class="['lv-modal-icon', activeLetter ? `lv-modal-icon--${activeLetter.type}` : '']">
          <CheckCircleIcon v-if="activeLetter?.type === 'reward'" :size="18" />
          <AlertIcon v-else :size="18" />
        </div>
      </template>

      <div v-if="activeLetter" class="lv-detail">
        <!-- Driver name (admin view) -->
        <div v-if="isAdmin && activeLetter.driver_name" class="lv-detail-driver">
          <DriversIcon :size="14" />
          <span>{{ activeLetter.driver_name }}</span>
        </div>

        <div :class="['lv-detail-type', `lv-detail-type--${activeLetter.type}`]">
          <CheckCircleIcon v-if="activeLetter.type === 'reward'" :size="13" />
          <AlertIcon v-else :size="13" />
          {{ activeLetter.type === 'reward' ? 'Reward Letter' : 'Warning Letter' }}
        </div>

        <p class="lv-detail-body">{{ activeLetter.content }}</p>

        <div class="lv-detail-foot">
          <CalendarIcon :size="13" />
          Issued {{ formatDate(activeLetter.date || activeLetter.created_at) }}
        </div>
      </div>
    </ModalSheet>

    <!-- ── Compose modal (admin) ──────────────────────────────────────────── -->
    <ModalSheet
      v-if="isAdmin"
      v-model="showCompose"
      title="Compose Letter"
      subtitle="Send a reward or warning letter to a driver"
      max-width="560px"
    >
      <template #icon>
        <div class="lv-compose-icon"><SendIcon :size="18" /></div>
      </template>

      <div class="lv-compose">

        <div v-if="composeErr" class="lv-compose-err">
          <CloseIcon :size="14" />{{ composeErr }}
        </div>

        <!-- Driver search -->
        <div class="lv-field">
          <label class="lv-label">Driver <span class="req">*</span></label>

          <!-- Selected driver chip -->
          <div v-if="selectedDriver" class="lv-driver-chip">
            <div class="lv-driver-chip-avatar">
              {{ selectedDriver.name.charAt(0).toUpperCase() }}
            </div>
            <div class="lv-driver-chip-info">
              <span class="lv-driver-chip-name">{{ selectedDriver.name }}</span>
              <span class="lv-driver-chip-id">{{ selectedDriver.driver_id }}</span>
            </div>
            <button class="lv-driver-chip-clear" type="button" @click="clearDriver" aria-label="Clear driver">
              <CloseIcon :size="14" :stroke-width="2.2" />
            </button>
          </div>

          <!-- Search input + dropdown -->
          <div v-else class="lv-driver-search">
            <div class="lv-driver-search-wrap">
              <SearchIcon :size="15" class="lv-driver-search-icon" />
              <input
                v-model="driverQuery"
                type="text"
                class="lv-driver-search-input"
                placeholder="Search by name or driver ID…"
                autocomplete="off"
                @input="onDriverInput"
                @focus="driverQuery && (showDriverDrop = true)"
                @blur="onDriverBlur"
              />
              <div v-if="driverSearching" class="lv-driver-searching" />
            </div>

            <!-- Dropdown results -->
            <div v-if="showDriverDrop" class="lv-driver-drop">
              <div v-if="!driverSearching && !driverResults.length" class="lv-driver-drop-empty">
                No drivers found for "{{ driverQuery }}"
              </div>
              <button
                v-for="d in driverResults"
                :key="d.driver_id"
                class="lv-driver-drop-item"
                type="button"
                @mousedown.prevent="selectDriver(d)"
              >
                <div class="lv-driver-drop-avatar">{{ d.name.charAt(0).toUpperCase() }}</div>
                <div class="lv-driver-drop-info">
                  <span class="lv-driver-drop-name">{{ d.name }}</span>
                  <span class="lv-driver-drop-id">{{ d.driver_id }}</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- Letter type -->
        <div class="lv-field">
          <label class="lv-label">Letter Type <span class="req">*</span></label>
          <div class="lv-type-btns">
            <button
              :class="['lv-type-btn', form.type === 'reward' && 'lv-type-btn--reward']"
              @click="form.type = 'reward'"
              type="button"
            >
              <CheckCircleIcon :size="15" />
              Reward Letter
            </button>
            <button
              :class="['lv-type-btn', form.type === 'warning' && 'lv-type-btn--warning']"
              @click="form.type = 'warning'"
              type="button"
            >
              <AlertIcon :size="15" />
              Warning Letter
            </button>
          </div>
        </div>

        <!-- Subject -->
        <div class="lv-field">
          <label class="lv-label">Subject <span class="req">*</span></label>
          <input
            v-model="form.subject"
            type="text"
            class="lv-input"
            placeholder="e.g. Outstanding Performance – Q1 2025"
          />
        </div>

        <!-- Date -->
        <div class="lv-field">
          <label class="lv-label">Date</label>
          <input v-model="form.date" type="date" class="lv-input" />
        </div>

        <!-- Content -->
        <div class="lv-field">
          <label class="lv-label">Letter Content <span class="req">*</span></label>
          <textarea
            v-model="form.content"
            class="lv-textarea"
            rows="7"
            placeholder="Write the letter content here…"
          />
        </div>

      </div>

      <template #footer>
        <div class="lv-compose-actions">
          <button class="lv-btn-cancel" @click="showCompose = false" :disabled="sending">Cancel</button>
          <button class="lv-btn-send" @click="sendLetter" :disabled="sending">
            <SendIcon :size="15" />
            {{ sending ? 'Sending…' : 'Send Letter' }}
          </button>
        </div>
      </template>
    </ModalSheet>

  </div>
</template>

<style scoped>
.lv { display: flex; flex-direction: column; gap: 1rem; }

/* Header */
.lv-hdr {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.75rem;
}
.lv-hdr-left { display: flex; align-items: center; gap: 0.875rem; }
.lv-hdr-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: rgba(124,58,237,0.1); color: #7C3AED;
  display: grid; place-items: center; flex-shrink: 0;
}
.lv-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text); margin: 0 0 2px; }
.lv-sub   { font-size: 0.78rem; color: var(--c-text-2); margin: 0; }

.lv-compose-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1rem; border-radius: 10px;
  background: #7C3AED; color: #fff;
  font-size: 0.84rem; font-weight: 600;
  transition: background 0.15s, box-shadow 0.15s;
}
.lv-compose-btn:hover { background: #6D28D9; box-shadow: 0 3px 12px rgba(124,58,237,0.35); }

/* Loading / Error */
.lv-loading {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 3rem; color: var(--c-text-2);
}
.lv-spinner {
  width: 18px; height: 18px; border: 2px solid var(--c-border);
  border-top-color: #7C3AED; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.lv-error {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.875rem 1rem; border-radius: 10px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #EF4444; font-size: 0.875rem;
}

/* Stats row */
.lv-stats {
  display: flex; gap: 0.75rem;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px; padding: 0.875rem 1.25rem;
}
.lv-stat { display: flex; flex-direction: column; gap: 2px; min-width: 64px; }
.lv-stat-val { font-size: 1.3rem; font-weight: 700; color: var(--c-text); }
.lv-stat-lbl { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--c-text-2); }
.lv-stat--reward  .lv-stat-val { color: #059669; }
.lv-stat--warning .lv-stat-val { color: #F59E0B; }

/* Filters */
.lv-filters { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.lv-ftag {
  padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
  background: var(--c-surface); border: 1px solid var(--c-border); color: var(--c-text-2);
  cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.lv-ftag:hover { background: var(--c-hover); color: var(--c-text); }
.lv-ftag--active { background: var(--c-text); color: var(--c-surface); border-color: var(--c-text); }
.lv-ftag--reward.lv-ftag--active  { background: rgba(5,150,105,0.12);  color: #059669; border-color: rgba(5,150,105,0.35); }
.lv-ftag--warning.lv-ftag--active { background: rgba(245,158,11,0.12); color: #D97706; border-color: rgba(245,158,11,0.35); }

/* Empty */
.lv-empty {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 3rem; color: var(--c-text-2); font-size: 0.875rem;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
}
.lv-empty svg { opacity: 0.35; }

/* Letter list */
.lv-list { display: flex; flex-direction: column; gap: 0; }
.lv-list { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px; overflow: hidden; }

.lv-item {
  display: flex; align-items: flex-start; gap: 0.875rem;
  padding: 1rem 1.1rem; border-bottom: 1px solid var(--c-border);
  cursor: pointer; transition: background 0.15s;
}
.lv-item:last-child { border-bottom: none; }
.lv-item:hover { background: var(--c-hover); }

.lv-item-icon {
  width: 38px; height: 38px; border-radius: 10px;
  display: grid; place-items: center; flex-shrink: 0; margin-top: 1px;
}
.lv-item-icon--reward  { background: rgba(5,150,105,0.1);  color: #059669; }
.lv-item-icon--warning { background: rgba(245,158,11,0.1); color: #D97706; }

.lv-item-body { flex: 1; min-width: 0; }
.lv-item-top {
  display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem; flex-wrap: wrap;
}
.lv-item-subject { font-size: 0.9rem; font-weight: 600; color: var(--c-text); flex: 1; min-width: 0; }
.lv-type-badge {
  display: inline-block; padding: 0.12rem 0.5rem; border-radius: 20px;
  font-size: 0.68rem; font-weight: 700; text-transform: capitalize; flex-shrink: 0;
}
.lv-type-badge--reward  { background: rgba(5,150,105,0.1);  color: #059669; }
.lv-type-badge--warning { background: rgba(245,158,11,0.1); color: #D97706; }

.lv-item-preview {
  font-size: 0.82rem; color: var(--c-text-2); margin: 0 0 0.35rem;
  overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.lv-item-meta {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
}
.lv-item-driver, .lv-item-date {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.73rem; color: var(--c-text-2);
}
.lv-item-arrow { color: var(--c-text-2); flex-shrink: 0; margin-top: 4px; opacity: 0.5; }

/* ── Detail modal ─────────────────────────────────────────────────────────────── */
.lv-modal-icon {
  width: 36px; height: 36px; border-radius: 9px;
  display: grid; place-items: center; flex-shrink: 0;
}
.lv-modal-icon--reward  { background: rgba(5,150,105,0.12);  color: #059669; }
.lv-modal-icon--warning { background: rgba(245,158,11,0.12); color: #D97706; }

.lv-detail { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.875rem; }
.lv-detail-driver {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.84rem; color: var(--c-text-2); font-weight: 500;
}
.lv-detail-type {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.25rem 0.75rem; border-radius: 20px;
  font-size: 0.78rem; font-weight: 700; text-transform: capitalize; width: fit-content;
}
.lv-detail-type--reward  { background: rgba(5,150,105,0.1);  color: #059669; }
.lv-detail-type--warning { background: rgba(245,158,11,0.1); color: #D97706; }

.lv-detail-body {
  font-size: 0.9rem; line-height: 1.6; color: var(--c-text);
  white-space: pre-wrap; margin: 0;
  padding: 1rem; background: var(--c-bg); border-radius: 10px; border: 1px solid var(--c-border);
}
.lv-detail-foot {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.76rem; color: var(--c-text-2);
}

/* ── Compose modal ─────────────────────────────────────────────────────────────── */
.lv-compose-icon {
  width: 36px; height: 36px; border-radius: 9px;
  background: rgba(124,58,237,0.1); color: #7C3AED;
  display: grid; place-items: center; flex-shrink: 0;
}
.lv-compose { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
.lv-compose-err {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.7rem 0.875rem; border-radius: 8px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #EF4444; font-size: 0.82rem;
}
.lv-field { display: flex; flex-direction: column; gap: 0.35rem; }
.lv-label { font-size: 0.74rem; font-weight: 700; color: var(--c-text-2); text-transform: uppercase; letter-spacing: .06em; }
.req { color: #EF4444; }
.lv-input, .lv-textarea {
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: 9px; padding: 0.55rem 0.875rem;
  font-size: 0.875rem; color: var(--c-text); outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}
.lv-input:focus, .lv-textarea:focus { border-color: #7C3AED; }
.lv-textarea { resize: vertical; min-height: 120px; }

/* ── Driver search combobox ──────────────────────────────────────────────────── */
/* Selected chip */
.lv-driver-chip {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.5rem 0.75rem; border-radius: 9px;
  background: rgba(124,58,237,0.06); border: 1.5px solid rgba(124,58,237,0.35);
}
.lv-driver-chip-avatar {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  background: rgba(124,58,237,0.15); color: #7C3AED;
  display: grid; place-items: center;
  font-size: 0.78rem; font-weight: 700;
}
.lv-driver-chip-info { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.lv-driver-chip-name { font-size: 0.875rem; font-weight: 600; color: var(--c-text); }
.lv-driver-chip-id   { font-size: 0.72rem; color: var(--c-text-2); font-family: monospace; }
.lv-driver-chip-clear {
  width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0;
  display: grid; place-items: center;
  color: var(--c-text-2); transition: background 0.12s, color 0.12s;
}
.lv-driver-chip-clear:hover { background: rgba(239,68,68,0.1); color: #EF4444; }

/* Search input area */
.lv-driver-search { position: relative; }
.lv-driver-search-wrap {
  display: flex; align-items: center; gap: 0.4rem;
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: 9px; padding: 0.45rem 0.75rem;
  transition: border-color 0.15s;
}
.lv-driver-search-wrap:focus-within { border-color: #7C3AED; }
.lv-driver-search-icon { color: var(--c-text-2); flex-shrink: 0; }
.lv-driver-search-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 0.875rem; color: var(--c-text); font-family: inherit;
}
.lv-driver-search-input::placeholder { color: var(--c-text-2); }
.lv-driver-searching {
  width: 14px; height: 14px; flex-shrink: 0;
  border: 2px solid var(--c-border); border-top-color: #7C3AED;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}

/* Dropdown */
.lv-driver-drop {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  overflow: hidden; max-height: 220px; overflow-y: auto;
}
.lv-driver-drop-empty {
  padding: 0.75rem 1rem; font-size: 0.84rem; color: var(--c-text-2); text-align: center;
}
.lv-driver-drop-item {
  display: flex; align-items: center; gap: 0.625rem;
  width: 100%; padding: 0.6rem 0.875rem; text-align: left;
  transition: background 0.12s; cursor: pointer;
  border-bottom: 1px solid var(--c-border);
}
.lv-driver-drop-item:last-child { border-bottom: none; }
.lv-driver-drop-item:hover { background: var(--c-hover); }
.lv-driver-drop-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: rgba(124,58,237,0.1); color: #7C3AED;
  display: grid; place-items: center;
  font-size: 0.72rem; font-weight: 700;
}
.lv-driver-drop-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.lv-driver-drop-name { font-size: 0.875rem; font-weight: 600; color: var(--c-text); }
.lv-driver-drop-id   { font-size: 0.72rem; color: var(--c-text-2); font-family: monospace; }

/* Letter type toggle buttons */
.lv-type-btns { display: flex; gap: 0.5rem; }
.lv-type-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  padding: 0.55rem 0.875rem; border-radius: 9px; font-size: 0.84rem; font-weight: 600;
  background: var(--c-bg); border: 1.5px solid var(--c-border); color: var(--c-text-2);
  cursor: pointer; transition: all 0.15s;
}
.lv-type-btn:hover { border-color: var(--c-text-2); color: var(--c-text); }
.lv-type-btn--reward  { background: rgba(5,150,105,0.08);  border-color: #059669; color: #059669; }
.lv-type-btn--warning { background: rgba(245,158,11,0.08); border-color: #D97706; color: #D97706; }

/* Compose footer actions */
.lv-compose-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 0.5rem;
  padding: 0.5rem;
}
.lv-btn-cancel {
  padding: 0.5rem 1rem; border-radius: 9px; font-size: 0.84rem; font-weight: 600;
  background: var(--c-bg); border: 1px solid var(--c-border); color: var(--c-text-2);
  cursor: pointer; transition: background 0.15s;
}
.lv-btn-cancel:hover:not(:disabled) { background: var(--c-hover); }
.lv-btn-send {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1.1rem; border-radius: 9px; font-size: 0.84rem; font-weight: 600;
  background: #7C3AED; color: #fff; cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.lv-btn-send:hover:not(:disabled) { background: #6D28D9; }
.lv-btn-send:disabled, .lv-btn-cancel:disabled { opacity: 0.55; cursor: not-allowed; }

@media (max-width: 640px) {
  .lv-hdr { flex-direction: column; align-items: flex-start; }
  .lv-type-btns { flex-direction: column; }
}
</style>
