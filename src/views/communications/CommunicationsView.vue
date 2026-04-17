<!--
  CommunicationsView.vue
  ──────────────────────
  Driver Communications module.

  Role behaviour:
    Admin  → sees all sent communications; can compose, view, and resend
    Driver → sees their received communications; can view and mark as read

  Layout: standard banner + data table, responsive at all breakpoints
-->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  CommunicationsIcon, CheckCircleIcon, AlertIcon, AddIcon,
  CloseIcon, CalendarIcon, ViewIcon, ResendIcon, FilterIcon,
} from '../../components/icons/index.js'
import communicationsApi from '../../api/communications'
import { useAuthStore }  from '../../stores/auth'
import { useToast }      from '../../composables/useToast'
import ModalSheet        from '../../components/common/ModalSheet.vue'
import ComposeModal      from '../../components/communications/ComposeModal.vue'
import ActionBtn         from '../../components/common/ActionBtn.vue'
import SearchInput       from '../../components/common/SearchInput.vue'
import AppPagination     from '../../components/common/AppPagination.vue'

const auth  = useAuthStore()
const toast = useToast()
const route = useRoute()

const isAdmin = computed(() => auth.hasRole('admin'))

// ── State ─────────────────────────────────────────────────────────────────────
const items   = ref([])
const loading = ref(true)
const error   = ref('')

// Filters
const typeFilter   = ref('')    // '' | 'reward' | 'warning'
const searchQuery  = ref('')

// ── Pagination (admin only) ───────────────────────────────────────────────────
const page = ref(1)
const meta = ref({})

// Detail modal
const showDetail   = ref(false)
const activeItem   = ref(null)

// Compose modal (admin)
const showCompose  = ref(false)

// Resend state
const resendingId  = ref(null)

// ── Read tracking (driver — localStorage until backend supports it) ────────────
const VIEWED_KEY = 'cv_viewed_ids'
const viewedIds  = ref(new Set(JSON.parse(localStorage.getItem(VIEWED_KEY) || '[]')))

function isViewed(id) { return viewedIds.value.has(String(id)) }
function markViewed(id) {
  if (isViewed(id)) return
  viewedIds.value.add(String(id))
  localStorage.setItem(VIEWED_KEY, JSON.stringify([...viewedIds.value]))
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—'
  const d = new Date((s || '').split('T')[0])
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function contentPreview(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Handle both legacy plain-text content and new Tiptap HTML content. */
function formatContent(content) {
  if (!content) return '<p>No content.</p>'
  if (content.trim().startsWith('<')) return content
  return '<p>' + content.split(/\n\n+/).map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>'
}

// ── Computed ──────────────────────────────────────────────────────────────────
// Admin: filtering is server-side. Driver: client-side (small dataset, no pagination).
const filtered = computed(() => {
  if (isAdmin.value) return items.value
  let list = items.value
  if (typeFilter.value)  list = list.filter(i => i.type === typeFilter.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(i =>
      i.subject?.toLowerCase().includes(q) ||
      i.driver_name?.toLowerCase().includes(q) ||
      i.driver_id?.toLowerCase().includes(q) ||
      i.body?.toLowerCase().includes(q)
    )
  }
  return list
})

const rewardCount  = computed(() => items.value.filter(i => i.type === 'reward').length)
const warningCount = computed(() => items.value.filter(i => i.type === 'warning').length)

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchItems() {
  loading.value = true
  error.value   = ''
  try {
    if (isAdmin.value) {
      const { data } = await communicationsApi.list({
        type:   typeFilter.value  || undefined,
        search: searchQuery.value || undefined,
        page:   page.value,
      })
      items.value = data.data || []
      meta.value  = data.meta || {}
    } else {
      const res = await communicationsApi.myList()
      items.value = res.data.data || []
    }
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load communications.'
  } finally {
    loading.value = false
  }
}

// Admin: reset to page 1 and refetch when filters change
watch(typeFilter, () => { if (isAdmin.value) { page.value = 1; fetchItems() } })

let searchTimer = null
watch(searchQuery, () => {
  if (!isAdmin.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; fetchItems() }, 300)
})

onMounted(async () => {
  await fetchItems()
  const openId = route.query.open
  if (openId) {
    const found = items.value.find(i => String(i.id) === String(openId))
    if (found) openDetail(found)
  }
})

// ── Actions ───────────────────────────────────────────────────────────────────
function openDetail(item) {
  activeItem.value = item
  showDetail.value = true
  if (!isAdmin.value) markViewed(item.id)
}

async function resendCommunication(item) {
  resendingId.value = item.id
  try {
    await communicationsApi.resend(item.id)
    toast.success('Communication resent successfully.', { title: 'Resent' })
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to resend.', { title: 'Resend Failed' })
  } finally {
    resendingId.value = null
  }
}

function onSent() { fetchItems() }
</script>

<template>
  <div class="cv">

    <!-- ── Standard page banner ──────────────────────────────────────────────── -->
    <div class="cv-banner">
      <div class="cv-banner-left">
        <div class="cv-banner-icon" aria-hidden="true">
          <CommunicationsIcon :size="20" />
        </div>
        <div>
          <h1 class="cv-banner-title">
            {{ isAdmin ? 'Driver Communications' : 'My Communications' }}
          </h1>
          <p class="cv-banner-sub">
            {{ isAdmin ? 'Reward and warning communications for drivers' : 'Communications from management' }}
          </p>
        </div>
      </div>

      <div class="cv-banner-right">
        <!-- Stats pills -->
        <div v-if="!loading && items.length" class="cv-banner-stats">
          <div class="cv-bstat">
            <span class="cv-bstat-val">{{ items.length }}</span>
            <span class="cv-bstat-lbl">Total</span>
          </div>
          <div class="cv-bstat cv-bstat--green">
            <span class="cv-bstat-val">{{ rewardCount }}</span>
            <span class="cv-bstat-lbl">Rewards</span>
          </div>
          <div class="cv-bstat cv-bstat--amber">
            <span class="cv-bstat-val">{{ warningCount }}</span>
            <span class="cv-bstat-lbl">Warnings</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Error ────────────────────────────────────────────────────────────── -->
    <div v-if="error" class="cv-error">
      <CloseIcon :size="15" />{{ error }}
    </div>

    <!-- ── Loading ──────────────────────────────────────────────────────────── -->
    <div v-else-if="loading" class="cv-loading">
      <div class="cv-spinner" /><span>Loading communications…</span>
    </div>

    <template v-else>

      <!-- ── Table card ───────────────────────────────────────────────────── -->
      <div class="cv-table-card">

        <!-- Card header -->
        <div class="cv-card-hd">
          <div class="cv-card-hd-left">
            <p class="cv-card-title">Communications Log</p>
            <p class="cv-card-sub">
              {{ isAdmin ? (meta.total ?? filtered.length) : filtered.length }} record{{ (isAdmin ? (meta.total ?? filtered.length) : filtered.length) !== 1 ? 's' : '' }}
              <span v-if="typeFilter || searchQuery" class="chip chip--filter">filtered</span>
            </p>
          </div>
          <div class="cv-card-hd-right">
            <div class="cv-card-search">
              <SearchInput
                v-model="searchQuery"
                :placeholder="isAdmin ? 'Search subject, driver…' : 'Search subject…'"
              />
            </div>
            <button v-if="isAdmin" class="cv-compose-btn" @click="showCompose = true">
              <AddIcon :size="16" :stroke-width="2.5" />
              New Communication
            </button>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="cv-filter-bar">
          <span class="cv-filter-lbl">
            <FilterIcon :size="12" aria-hidden="true" />
            Filter
          </span>
          <div class="cv-seg" role="group" aria-label="Filter by type">
            <button :class="['cv-seg-btn', !typeFilter && 'cv-seg-btn--on']" @click="typeFilter = ''">All</button>
            <button :class="['cv-seg-btn cv-seg-btn--reward',  typeFilter === 'reward'  && 'cv-seg-btn--on']" @click="typeFilter = 'reward'">
              <CheckCircleIcon :size="11" /> Reward
            </button>
            <button :class="['cv-seg-btn cv-seg-btn--warning', typeFilter === 'warning' && 'cv-seg-btn--on']" @click="typeFilter = 'warning'">
              <AlertIcon :size="11" /> Warning
            </button>
          </div>
          <Transition name="cv-fade">
            <button v-if="typeFilter" class="cv-clear-btn" @click="typeFilter = ''">
              <CloseIcon :size="10" :stroke-width="2.5" />
              Reset
            </button>
          </Transition>
        </div>

        <!-- ── Empty state ─────────────────────────────────────────────────── -->
        <div v-if="!filtered.length" class="cv-empty">
          <CommunicationsIcon :size="38" :stroke-width="1.2" />
          <p class="cv-empty-title">{{ searchQuery || typeFilter ? 'No results found' : 'No communications yet' }}</p>
          <p class="cv-empty-sub">
            {{ searchQuery || typeFilter
              ? 'Try adjusting your search or filter'
              : isAdmin ? 'Send the first communication using the button above.' : 'Communications from management will appear here.' }}
          </p>
        </div>

        <!-- ── Data table ──────────────────────────────────────────────────── -->
        <div v-else class="cv-table-wrap" style="overflow-x: auto;">
          <table class="cv-table">
            <thead>
              <tr>
                <th class="cv-th cv-th--type">Type</th>
                <th v-if="isAdmin" class="cv-th cv-th--driver">Driver</th>
                <th class="cv-th cv-th--subject">Subject</th>
                <th class="cv-th cv-th--date">Date</th>
                <th class="cv-th cv-th--status">Status</th>
                <th class="cv-th cv-th--actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in filtered"
                :key="item.id"
                :class="['cv-tr', !isAdmin && isViewed(item.id) && 'cv-tr--read']"
                @click="openDetail(item)"
              >
                <!-- Type -->
                <td class="cv-td cv-td--type">
                  <span :class="['cv-type-badge', `cv-type-badge--${item.type}`]">
                    <CheckCircleIcon v-if="item.type === 'reward'" :size="11" />
                    <AlertIcon       v-else                         :size="11" />
                    {{ item.type === 'reward' ? 'Reward' : 'Warning' }}
                  </span>
                </td>

                <!-- Driver (admin only) -->
                <td v-if="isAdmin" class="cv-td cv-td--driver">
                  <div v-if="item.driver_name" class="cv-driver-cell">
                    <div class="cv-driver-avatar">
                      <img v-if="item.driver_photo" :src="item.driver_photo" :alt="item.driver_name" class="cv-driver-photo" />
                      <span v-else>{{ item.driver_name.charAt(0).toUpperCase() }}</span>
                    </div>
                    <div class="cv-driver-info">
                      <span class="cv-driver-name">{{ item.driver_name }}</span>
                      <span v-if="item.driver_id" class="cv-driver-id">{{ item.driver_id }}</span>
                    </div>
                  </div>
                  <span v-else class="cv-td-empty">—</span>
                </td>

                <!-- Subject + preview -->
                <td class="cv-td cv-td--subject">
                  <div class="cv-subject-cell">
                    <span :class="['cv-subject', !isAdmin && !isViewed(item.id) && 'cv-subject--new']">
                      {{ item.subject || '(No subject)' }}
                      <span v-if="!isAdmin && !isViewed(item.id)" class="cv-unread-dot" />
                    </span>
                    <span v-if="contentPreview(item.body)" class="cv-preview">
                      {{ contentPreview(item.body) }}
                    </span>
                  </div>
                </td>

                <!-- Date -->
                <td class="cv-td cv-td--date">
                  <span class="cv-date-cell">
                    <CalendarIcon :size="12" />
                    {{ formatDate(item.date || item.created_at) }}
                  </span>
                </td>

                <!-- Status -->
                <td class="cv-td cv-td--status">
                  <span :class="['badge', isAdmin ? 'badge-confirmed' : (isViewed(item.id) ? 'badge-active' : 'badge-info')]">
                    {{ isAdmin ? 'Sent' : (isViewed(item.id) ? 'Read' : 'New') }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="cv-td cv-td--actions" @click.stop>
                  <div class="cv-actions">
                    <ActionBtn tooltip="View" variant="view" @click="openDetail(item)">
                      <ViewIcon :size="14" />
                    </ActionBtn>
                    <ActionBtn
                      v-if="isAdmin"
                      :tooltip="resendingId === item.id ? 'Sending…' : 'Resend'"
                      variant="warning"
                      :disabled="resendingId === item.id"
                      @click="resendCommunication(item)"
                    >
                      <ResendIcon :size="14" :class="resendingId === item.id && 'spinning'" />
                    </ActionBtn>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination (admin only) -->
        <AppPagination
          v-if="isAdmin && meta.last_page > 1"
          :current-page="meta.current_page ?? 1"
          :last-page="meta.last_page ?? 1"
          :total="meta.total ?? 0"
          :from="meta.from ?? 0"
          :to="meta.to ?? 0"
          @change="p => { page = p; fetchItems() }"
        />

      </div>

    </template>

    <!-- ── Detail modal ──────────────────────────────────────────────────────── -->
    <ModalSheet
      v-model="showDetail"
      :title="activeItem?.subject || 'Communication'"
      :subtitle="activeItem ? `${activeItem.type === 'reward' ? 'Reward' : 'Warning'} Communication · ${formatDate(activeItem.date || activeItem.created_at)}` : ''"
      max-width="600px"
    >
      <template #icon>
        <div :class="['cv-modal-icon', activeItem ? `cv-modal-icon--${activeItem.type}` : '']">
          <CheckCircleIcon v-if="activeItem?.type === 'reward'" :size="17" />
          <AlertIcon       v-else                               :size="17" />
        </div>
      </template>

      <div v-if="activeItem" class="cv-detail">
        <!-- Driver row (admin view) -->
        <div v-if="isAdmin && activeItem.driver_name" class="cv-detail-driver">
          <div class="cv-detail-driver-avatar">
            <img v-if="activeItem.driver_photo" :src="activeItem.driver_photo" :alt="activeItem.driver_name" class="cv-driver-photo" />
            <span v-else>{{ activeItem.driver_name.charAt(0).toUpperCase() }}</span>
          </div>
          <div>
            <span class="cv-detail-driver-name">{{ activeItem.driver_name }}</span>
            <span v-if="activeItem.driver_id" class="cv-detail-driver-id">{{ activeItem.driver_id }}</span>
          </div>
        </div>

        <!-- Type + date row -->
        <div class="cv-detail-meta-row">
          <span :class="['cv-detail-type', `cv-detail-type--${activeItem.type}`]">
            <CheckCircleIcon v-if="activeItem.type === 'reward'" :size="12" />
            <AlertIcon       v-else                               :size="12" />
            {{ activeItem.type === 'reward' ? 'Reward Communication' : 'Warning Communication' }}
          </span>
          <span class="cv-detail-date">
            <CalendarIcon :size="12" />
            {{ formatDate(activeItem.date || activeItem.created_at) }}
          </span>
        </div>

        <!-- Content body -->
        <div class="cv-detail-body" v-html="formatContent(activeItem.body)" />
      </div>
    </ModalSheet>

    <!-- ── Compose modal (admin) ──────────────────────────────────────────────── -->
    <ComposeModal v-if="isAdmin" v-model="showCompose" @sent="onSent" />

  </div>
</template>

<style scoped>
/* ══ PAGE SHELL ══════════════════════════════════════════════════════════════ */
.cv { display: flex; flex-direction: column; gap: 1.25rem; }

/* ══ STANDARD BANNER ════════════════════════════════════════════════════════ */
.cv-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-sm);
  padding: 16px 20px;
  position: relative;
  overflow: hidden;
}
.cv-banner::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--c-accent);
  border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .cv-banner { padding: 18px 24px; } }

.cv-banner-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cv-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg);
  background: var(--c-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.cv-banner-title {
  font-size: 1.125rem; font-weight: 700; color: var(--c-text-1);
  letter-spacing: -0.02em; margin-bottom: 1px;
}
@media (min-width: 640px) { .cv-banner-title { font-size: 1.25rem; } }
.cv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.cv-banner-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

.cv-banner-stats { display: flex; align-items: center; gap: 6px; }
.cv-bstat {
  display: flex; flex-direction: column; align-items: center;
  padding: 6px 14px; border-radius: var(--r-lg);
  background: var(--c-bg); border: 1px solid var(--c-border-light);
  min-width: 52px;
}
.cv-bstat-val {
  font-size: 1.25rem; font-weight: 700; letter-spacing: -0.03em;
  line-height: 1; color: var(--c-text-1);
}
.cv-bstat-lbl {
  font-size: 0.5625rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.08em; color: var(--c-text-3); margin-top: 3px;
}
.cv-bstat--green .cv-bstat-val { color: var(--c-green, #16A34A); }
.cv-bstat--amber .cv-bstat-val { color: var(--c-amber, #D97706); }

.cv-compose-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--c-accent); color: #fff; border: none; border-radius: 8px;
  padding: 8px 14px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: opacity var(--dur); white-space: nowrap; flex-shrink: 0;
}
.cv-compose-btn svg { width: 14px; height: 14px; }
.cv-compose-btn:hover { opacity: 0.88; }

/* ══ LOADING / ERROR ═════════════════════════════════════════════════════════ */
.cv-loading {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 3rem; color: var(--c-text-2); font-size: 0.875rem;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px;
}
.cv-spinner {
  width: 18px; height: 18px; border: 2px solid var(--c-border);
  border-top-color: var(--c-accent); border-radius: 50%; animation: spin 0.7s linear infinite;
}
.cv-error {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.875rem 1rem; border-radius: 10px;
  background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15);
  color: #DC2626; font-size: 0.875rem;
}

/* ══ TABLE CARD ══════════════════════════════════════════════════════════════ */
.cv-table-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-sm);
  overflow: hidden;
}

/* Card header */
.cv-card-hd {
  display: flex; align-items: center; justify-content: space-between;
  gap: 0.75rem; flex-wrap: wrap;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--c-border);
}
@media (min-width: 640px) { .cv-card-hd { padding: 1rem 1.5rem; } }

.cv-card-hd-left { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cv-card-title   { font-size: 0.9375rem; font-weight: 700; color: var(--c-text-1); margin: 0; }
.cv-card-sub     { font-size: 0.78rem; color: var(--c-text-3); margin: 0; display: flex; align-items: center; gap: 0.4rem; }

.cv-card-hd-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.cv-card-search { width: 200px; }
@media (max-width: 640px) { .cv-card-search { display: none; } }

/* Filter bar — same structure as Driver/Trip/Batch pages */
.cv-filter-bar {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  padding: 10px 20px; border-bottom: 1px solid var(--c-border-light);
}
.cv-filter-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--c-text-3); flex-shrink: 0;
}
.cv-seg {
  display: inline-flex; background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: var(--r-full); padding: 3px; gap: 2px; flex-shrink: 0;
}
.cv-seg-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: var(--r-full);
  font-size: 0.8125rem; font-weight: 500; color: var(--c-text-3);
  background: transparent; border: none; cursor: pointer;
  transition: all var(--dur); white-space: nowrap;
}
/* All — active: accent blue */
.cv-seg-btn--on { background: var(--c-surface); color: var(--c-accent); font-weight: 600; box-shadow: var(--sh-xs); }
/* Reward — active: green (semantic) */
.cv-seg-btn--reward.cv-seg-btn--on { color: var(--c-green); }
/* Warning — active: amber (semantic) */
.cv-seg-btn--warning.cv-seg-btn--on { color: var(--c-amber); }
.cv-clear-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur); flex-shrink: 0;
}
.cv-clear-btn:hover { border-color: var(--c-red); color: var(--c-red); background: var(--c-red-tint); }
.cv-fade-enter-active, .cv-fade-leave-active { transition: opacity var(--dur); }
.cv-fade-enter-from, .cv-fade-leave-to { opacity: 0; }

/* ══ EMPTY STATE ═════════════════════════════════════════════════════════════ */
.cv-empty {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 4rem 1.5rem; text-align: center; color: var(--c-text-2);
}
.cv-empty svg      { opacity: 0.25; margin-bottom: 0.25rem; }
.cv-empty-title    { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); margin: 0; }
.cv-empty-sub      { font-size: 0.8125rem; color: var(--c-text-2); max-width: 300px; line-height: 1.6; margin: 0; }

/* ══ DATA TABLE ══════════════════════════════════════════════════════════════ */
.cv-table-wrap { overflow-x: auto; }

.cv-table {
  width: 100%; border-collapse: collapse;
  font-size: 0.85rem;
}

/* Header row */
.cv-th {
  padding: 0.625rem 1rem;
  text-align: left;
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--c-text-3);
  background: var(--c-bg);
  border-bottom: 1px solid var(--c-border);
  white-space: nowrap;
}
.cv-th--type    { width: 100px; }
.cv-th--driver  { width: 180px; }
.cv-th--subject { }
.cv-th--date    { width: 130px; }
.cv-th--status  { width: 90px; text-align: center; }
.cv-th--actions { width: 80px; text-align: center; }

/* Body rows */
.cv-tr {
  cursor: pointer;
  transition: background var(--dur);
  border-bottom: 1px solid var(--c-border);
}
.cv-tr:last-child { border-bottom: none; }
.cv-tr:hover { background: var(--c-bg); }
.cv-tr--read {
  background: linear-gradient(180deg, color-mix(in srgb, var(--c-accent-tint) 70%, transparent) 0%, color-mix(in srgb, var(--c-bg) 78%, transparent) 100%);
  opacity: 0.78;
}
.cv-tr--read:hover { opacity: 1; }

.cv-td {
  padding: 0.875rem 1rem;
  vertical-align: middle;
  color: var(--c-text-1);
}
.cv-td--status  { text-align: center; }
.cv-td--actions { text-align: center; }

.cv-td-empty { color: var(--c-text-3); }

/* Type badge — outlined like status badges */
.cv-type-badge {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1.5px solid transparent;
  font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  white-space: nowrap;
}
.cv-type-badge--reward  { border-color: var(--c-green); color: var(--c-green); background: var(--c-green-tint); }
.cv-type-badge--warning { border-color: var(--c-amber); color: var(--c-amber); background: var(--c-amber-tint); }

/* Driver cell */
.cv-driver-cell { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.cv-driver-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: var(--c-accent); color: #fff;
  display: grid; place-items: center; font-size: 0.68rem; font-weight: 700;
}
.cv-driver-info { display: flex; flex-direction: column; min-width: 0; }
.cv-driver-name {
  font-size: 0.84rem; font-weight: 600; color: var(--c-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cv-driver-id {
  font-size: 0.7rem; color: var(--c-text-3);
  font-family: 'SFMono-Regular', 'Consolas', monospace;
  letter-spacing: 0.03em;
}
.cv-driver-photo {
  width: 100%; height: 100%; object-fit: cover; border-radius: 50%;
}

/* Subject + preview cell */
.cv-subject-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cv-subject {
  font-size: 0.875rem; font-weight: 600; color: var(--c-text-1);
  display: flex; align-items: center; gap: 0.4rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 420px;
}
.cv-subject--new { font-weight: 700; }
.cv-unread-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--c-accent); flex-shrink: 0;
}
.cv-preview {
  font-size: 0.775rem; color: var(--c-text-3); line-height: 1.4;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 420px;
}

/* Date cell */
.cv-date-cell {
  display: flex; align-items: center; gap: 0.35rem;
  font-size: 0.8rem; color: var(--c-text-2); white-space: nowrap;
}


/* Actions */
.cv-actions { display: flex; align-items: center; justify-content: center; gap: 0.2rem; }

.spinning { animation: spin 0.7s linear infinite; }

/* ══ MOBILE — collapse to card-like rows ════════════════════════════════════ */
@media (max-width: 640px) {
  .cv-card-hd { flex-direction: column; align-items: flex-start; }
  .cv-card-hd-right { width: 100%; }
  .cv-filter-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .cv-seg,
  .cv-clear-btn {
    width: 100%;
  }
  .cv-seg {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cv-seg-btn,
  .cv-clear-btn {
    min-height: 44px;
    justify-content: center;
  }
  .cv-th--driver,
  .cv-td--driver { display: none; }
  .cv-th--date,
  .cv-td--date { display: none; }
  .cv-subject { max-width: 180px; }
  .cv-preview { max-width: 180px; }
}

@media (max-width: 360px) {
  .cv-subject,
  .cv-preview {
    max-width: 140px;
  }
}

/* ══ DETAIL MODAL ════════════════════════════════════════════════════════════ */
.cv-modal-icon {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: grid; place-items: center;
}
.cv-modal-icon--reward  { background: var(--c-green); color: #fff; }
.cv-modal-icon--warning { background: var(--c-amber); color: #fff; }

.cv-detail { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

.cv-detail-driver {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.625rem 0.875rem; border-radius: 10px;
  background: var(--c-bg); border: 1px solid var(--c-border);
}
.cv-detail-driver-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: var(--c-accent); color: #fff;
  display: grid; place-items: center; font-size: 0.82rem; font-weight: 700;
}
.cv-detail-driver-name { font-size: 0.9rem; font-weight: 600; color: var(--c-text-1); display: block; }
.cv-detail-driver-id   { font-size: 0.72rem; color: var(--c-text-3); font-family: monospace; }
.cv-detail-driver-avatar .cv-driver-photo { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

.cv-detail-meta-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.cv-detail-type {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.22rem 0.7rem; border-radius: 20px;
  font-size: 0.75rem; font-weight: 700;
}
.cv-detail-type--reward  { background: var(--c-green-tint); color: var(--c-green); }
.cv-detail-type--warning { background: var(--c-amber-tint); color: var(--c-amber); }
.cv-detail-date {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.78rem; color: var(--c-text-2);
}

.cv-detail-body {
  font-size: 0.9rem; line-height: 1.7; color: var(--c-text-1);
  padding: 1.1rem 1.25rem; background: var(--c-bg);
  border-radius: 10px; border: 1px solid var(--c-border);
}
:deep(.cv-detail-body p)           { margin: 0 0 0.6em; }
:deep(.cv-detail-body p:last-child) { margin-bottom: 0; }
:deep(.cv-detail-body ul)          { padding-left: 1.5em; margin: 0 0 0.5em; }
:deep(.cv-detail-body li)          { margin-bottom: 0.2em; }
:deep(.cv-detail-body strong)      { font-weight: 700; }
:deep(.cv-detail-body em)          { font-style: italic; }
:deep(.cv-detail-body h2)          { font-size: 1rem; font-weight: 700; margin: 0 0 0.4em; }
</style>
