<!--
  CommunicationsView.vue
  ──────────────────────
  Driver Communications module — enterprise-grade listing page.

  Role behaviour:
    Admin  → sees all sent communications; can compose, view, and resend
    Driver → sees their received communications; can view and mark as read

  Layout:
    Desktop (≥768px) → responsive table (grid-based divs)
    Mobile  (<768px)  → card stack
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  CommunicationsIcon, CheckCircleIcon, AlertIcon, AddIcon,
  CloseIcon, DriversIcon, CalendarIcon, ViewIcon, ResendIcon,
  LetterOpenIcon, SearchIcon,
} from '../../components/icons/index.js'
import communicationsApi from '../../api/communications'
import { useAuthStore }  from '../../stores/auth'
import { useToast }      from '../../composables/useToast'
import ModalSheet        from '../../components/common/ModalSheet.vue'
import ComposeModal      from '../../components/communications/ComposeModal.vue'

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

// Detail modal
const showDetail   = ref(false)
const activeItem   = ref(null)

// Compose modal (admin)
const showCompose  = ref(false)

// Resend state
const resendingId  = ref(null)

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—'
  const d = new Date((s || '').split('T')[0])
  if (isNaN(d)) return s
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function contentPreview(html) {
  if (!html) return ''
  // Strip tags for plain-text preview
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ── Computed ──────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list = items.value
  if (typeFilter.value)  list = list.filter(i => i.type === typeFilter.value)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(i =>
      i.subject?.toLowerCase().includes(q) ||
      i.driver_name?.toLowerCase().includes(q) ||
      i.content?.toLowerCase().includes(q)
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
    const res = isAdmin.value
      ? await communicationsApi.list()
      : await communicationsApi.myList()
    items.value = res.data.data || []
  } catch (e) {
    error.value = e.response?.data?.message || 'Failed to load communications.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await fetchItems()
  // If navigated with ?open=<id>, auto-open that communication
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

function onSent() {
  fetchItems()
}
</script>

<template>
  <div class="cv">

    <!-- ── Page header ──────────────────────────────────────────────────────── -->
    <div class="cv-hdr">
      <div class="cv-hdr-left">
        <div class="cv-hdr-icon">
          <CommunicationsIcon :size="20" />
        </div>
        <div>
          <h1 class="cv-title">
            {{ isAdmin ? 'Driver Communications' : 'My Communications' }}
          </h1>
          <p class="cv-sub">
            {{ isAdmin
              ? 'Manage official reward and warning communications for drivers'
              : 'Reward and warning communications from management' }}
          </p>
        </div>
      </div>
      <button v-if="isAdmin" class="cv-compose-btn" @click="showCompose = true">
        <AddIcon :size="15" />
        New Communication
      </button>
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

      <!-- ── Stats bar ──────────────────────────────────────────────────────── -->
      <div class="cv-stats">
        <div class="cv-stat">
          <span class="cv-stat-val">{{ items.length }}</span>
          <span class="cv-stat-lbl">Total</span>
        </div>
        <div class="cv-stat-divider" />
        <div class="cv-stat cv-stat--reward">
          <div class="cv-stat-icon cv-stat-icon--reward"><CheckCircleIcon :size="13" /></div>
          <div>
            <span class="cv-stat-val cv-stat-val--reward">{{ rewardCount }}</span>
            <span class="cv-stat-lbl">Reward</span>
          </div>
        </div>
        <div class="cv-stat-divider" />
        <div class="cv-stat cv-stat--warning">
          <div class="cv-stat-icon cv-stat-icon--warning"><AlertIcon :size="13" /></div>
          <div>
            <span class="cv-stat-val cv-stat-val--warning">{{ warningCount }}</span>
            <span class="cv-stat-lbl">Warning</span>
          </div>
        </div>
      </div>

      <!-- ── Toolbar: search + filters ────────────────────────────────────── -->
      <div class="cv-toolbar">
        <!-- Search -->
        <div class="cv-search-wrap">
          <SearchIcon :size="14" class="cv-search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="cv-search"
            placeholder="Search subject, driver, or content…"
          />
        </div>
        <!-- Filter chips -->
        <div class="cv-filters">
          <button :class="['cv-ftag', !typeFilter && 'active']"               @click="typeFilter = ''">All</button>
          <button :class="['cv-ftag cv-ftag--reward',  typeFilter === 'reward'  && 'active']" @click="typeFilter = 'reward'">
            <CheckCircleIcon :size="11" /> Reward
          </button>
          <button :class="['cv-ftag cv-ftag--warning', typeFilter === 'warning' && 'active']" @click="typeFilter = 'warning'">
            <AlertIcon :size="11" /> Warning
          </button>
        </div>
      </div>

      <!-- ── Empty state ───────────────────────────────────────────────────── -->
      <div v-if="!filtered.length" class="cv-empty">
        <CommunicationsIcon :size="38" :stroke-width="1.2" />
        <p class="cv-empty-title">{{ searchQuery || typeFilter ? 'No results found' : 'No communications yet' }}</p>
        <p class="cv-empty-sub">
          {{ searchQuery || typeFilter
            ? 'Try adjusting your search or filter'
            : isAdmin ? 'Send the first communication using the button above.' : 'Communications from management will appear here.' }}
        </p>
      </div>

      <!-- ── List ─────────────────────────────────────────────────────────── -->
      <div v-else class="cv-list">

        <!-- Desktop column headers -->
        <div class="cv-row cv-row--header" aria-hidden="true">
          <div class="cv-col cv-col-type">Type</div>
          <div class="cv-col cv-col-subject">Subject</div>
          <div v-if="isAdmin" class="cv-col cv-col-driver">Driver</div>
          <div class="cv-col cv-col-date">Date</div>
          <div class="cv-col cv-col-status">Status</div>
          <div class="cv-col cv-col-actions">Actions</div>
        </div>

        <!-- Rows -->
        <div
          v-for="item in filtered"
          :key="item.id"
          :class="['cv-row cv-row--item', `cv-row--${item.type}`]"
        >
          <!-- Type -->
          <div class="cv-col cv-col-type" data-label="Type">
            <div :class="['cv-type-icon', `cv-type-icon--${item.type}`]">
              <CheckCircleIcon v-if="item.type === 'reward'" :size="15" />
              <AlertIcon       v-else                        :size="15" />
            </div>
            <span :class="['cv-type-badge', `cv-type-badge--${item.type}`]">
              {{ item.type === 'reward' ? 'Reward' : 'Warning' }}
            </span>
          </div>

          <!-- Subject + preview -->
          <div class="cv-col cv-col-subject" data-label="Subject">
            <p class="cv-subject">{{ item.subject || '(No subject)' }}</p>
            <p class="cv-preview">{{ contentPreview(item.content) }}</p>
          </div>

          <!-- Driver (admin only) -->
          <div v-if="isAdmin" class="cv-col cv-col-driver" data-label="Driver">
            <div v-if="item.driver_name" class="cv-driver-cell">
              <div class="cv-driver-avatar">{{ item.driver_name.charAt(0).toUpperCase() }}</div>
              <span class="cv-driver-name">{{ item.driver_name }}</span>
            </div>
            <span v-else class="cv-cell-muted">—</span>
          </div>

          <!-- Date -->
          <div class="cv-col cv-col-date" data-label="Date">
            <div class="cv-date-cell">
              <CalendarIcon :size="12" class="cv-date-icon" />
              {{ formatDate(item.date || item.created_at) }}
            </div>
          </div>

          <!-- Status -->
          <div class="cv-col cv-col-status" data-label="Status">
            <span class="cv-status-badge">Sent</span>
          </div>

          <!-- Actions -->
          <div class="cv-col cv-col-actions">
            <button class="cv-action-btn cv-action-btn--view" @click="openDetail(item)" title="View">
              <ViewIcon :size="13" />
              <span>View</span>
            </button>
            <button
              v-if="isAdmin"
              :class="['cv-action-btn cv-action-btn--resend', resendingId === item.id && 'loading']"
              @click="resendCommunication(item)"
              :disabled="resendingId === item.id"
              title="Resend"
            >
              <ResendIcon :size="13" :class="resendingId === item.id && 'spinning'" />
              <span>Resend</span>
            </button>
          </div>

        </div><!-- /cv-row -->
      </div><!-- /cv-list -->

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
          <div class="cv-detail-driver-avatar">{{ activeItem.driver_name.charAt(0).toUpperCase() }}</div>
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
        <div
          class="cv-detail-body"
          v-html="activeItem.content || '<p>No content.</p>'"
        />
      </div>
    </ModalSheet>

    <!-- ── Compose modal (admin) ──────────────────────────────────────────────── -->
    <ComposeModal v-if="isAdmin" v-model="showCompose" @sent="onSent" />

  </div>
</template>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────────────── */
.cv { display: flex; flex-direction: column; gap: 1rem; }

/* ── Header ──────────────────────────────────────────────────────────────────── */
.cv-hdr {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.75rem;
}
.cv-hdr-left { display: flex; align-items: center; gap: 0.875rem; }
.cv-hdr-icon {
  width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
  background: rgba(124,58,237,0.1); color: #7C3AED;
  display: grid; place-items: center;
}
.cv-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); margin: 0 0 2px; }
.cv-sub   { font-size: 0.78rem; color: var(--c-text-2); margin: 0; }

.cv-compose-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1.125rem; border-radius: 10px;
  background: #7C3AED; color: #fff; font-size: 0.84rem; font-weight: 600;
  transition: background var(--dur), box-shadow var(--dur);
  white-space: nowrap;
}
.cv-compose-btn:hover { background: #6D28D9; box-shadow: 0 4px 14px rgba(124,58,237,0.4); }

/* ── Loading / Error ─────────────────────────────────────────────────────────── */
.cv-loading {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  padding: 3rem; color: var(--c-text-2); font-size: 0.875rem;
}
.cv-spinner {
  width: 18px; height: 18px; border: 2px solid var(--c-border);
  border-top-color: #7C3AED; border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.cv-error {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.875rem 1rem; border-radius: 10px;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #EF4444; font-size: 0.875rem;
}

/* ── Stats bar ───────────────────────────────────────────────────────────────── */
.cv-stats {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px; padding: 0.875rem 1.25rem;
}
.cv-stat { display: flex; align-items: center; gap: 0.5rem; }
.cv-stat-val   { font-size: 1.35rem; font-weight: 800; color: var(--c-text-1); }
.cv-stat-lbl   { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--c-text-2); margin-top: 1px; display: block; }
.cv-stat-val--reward  { color: #059669; }
.cv-stat-val--warning { color: #D97706; }
.cv-stat-divider { width: 1px; height: 30px; background: var(--c-border); }
.cv-stat-icon { width: 28px; height: 28px; border-radius: 7px; display: grid; place-items: center; flex-shrink: 0; }
.cv-stat-icon--reward  { background: rgba(5,150,105,0.1); color: #059669; }
.cv-stat-icon--warning { background: rgba(245,158,11,0.1); color: #D97706; }

/* ── Toolbar ─────────────────────────────────────────────────────────────────── */
.cv-toolbar {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
}
.cv-search-wrap {
  position: relative; flex: 1; min-width: 180px;
}
.cv-search-icon {
  position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);
  color: var(--c-text-3); pointer-events: none;
}
.cv-search {
  width: 100%; background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 9px; padding: 0.48rem 0.875rem 0.48rem 2.25rem;
  font-size: 0.855rem; color: var(--c-text-1); outline: none; font-family: inherit;
  transition: border-color var(--dur);
}
.cv-search:focus { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }

.cv-filters   { display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
.cv-ftag {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.75rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
  background: var(--c-surface); border: 1px solid var(--c-border); color: var(--c-text-2);
  transition: all var(--dur); cursor: pointer;
}
.cv-ftag:hover { background: var(--c-bg); color: var(--c-text-1); }
.cv-ftag.active { background: var(--c-text-1); color: var(--c-surface); border-color: var(--c-text-1); }
.cv-ftag--reward.active  { background: rgba(5,150,105,0.1);  color: #059669; border-color: rgba(5,150,105,0.3); }
.cv-ftag--warning.active { background: rgba(245,158,11,0.1); color: #D97706; border-color: rgba(245,158,11,0.3); }

/* ── Empty state ─────────────────────────────────────────────────────────────── */
.cv-empty {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 3.5rem 1.5rem; text-align: center;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
  color: var(--c-text-2);
}
.cv-empty svg    { opacity: 0.3; }
.cv-empty-title  { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); margin-top: 0.25rem; }
.cv-empty-sub    { font-size: 0.82rem; color: var(--c-text-2); max-width: 320px; line-height: 1.55; }

/* ══ LIST TABLE ═══════════════════════════════════════════════════════════════ */
.cv-list {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; overflow: hidden;
}

/* Column grid — desktop */
.cv-row {
  display: grid;
  grid-template-columns:
    130px          /* type */
    1fr            /* subject */
    150px          /* date */
    80px           /* status */
    auto;          /* actions */
  align-items: center;
  gap: 0;
  padding: 0 1rem;
  border-bottom: 1px solid var(--c-border);
}
/* Admin gets driver column */
.cv-row:has(.cv-col-driver) {
  grid-template-columns:
    130px          /* type */
    1fr            /* subject */
    160px          /* driver */
    130px          /* date */
    80px           /* status */
    auto;          /* actions */
}
.cv-row:last-child { border-bottom: none; }

/* Header row */
.cv-row--header {
  background: var(--c-bg);
  border-bottom: 1px solid var(--c-border) !important;
}
.cv-row--header .cv-col {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: .07em; color: var(--c-text-3); padding: 0.625rem 0.75rem;
}

/* Item row */
.cv-row--item {
  transition: background var(--dur);
  cursor: default;
}
.cv-row--item:hover { background: var(--c-bg); }

/* Left accent bar on hover */
.cv-row--item.cv-row--reward  { border-left: 3px solid transparent; }
.cv-row--item.cv-row--warning { border-left: 3px solid transparent; }
.cv-row--item.cv-row--reward:hover  { border-left-color: #059669; }
.cv-row--item.cv-row--warning:hover { border-left-color: #D97706; }

/* Columns */
.cv-col { padding: 0.875rem 0.75rem; }

.cv-col-type    { display: flex; align-items: center; gap: 0.5rem; }
.cv-col-subject { min-width: 0; }
.cv-col-driver  { min-width: 0; }
.cv-col-date    { white-space: nowrap; }
.cv-col-status  {}
.cv-col-actions { display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end; padding-right: 0.875rem; }

/* Type icon */
.cv-type-icon {
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center;
}
.cv-type-icon--reward  { background: rgba(5,150,105,0.1);  color: #059669; }
.cv-type-icon--warning { background: rgba(245,158,11,0.1); color: #D97706; }

/* Type badge — hidden on mobile to save space */
.cv-type-badge {
  display: none; padding: 0.12rem 0.5rem; border-radius: 20px;
  font-size: 0.68rem; font-weight: 700; text-transform: capitalize; white-space: nowrap;
}
@media (min-width: 900px) { .cv-type-badge { display: inline-block; } }
.cv-type-badge--reward  { background: rgba(5,150,105,0.08); color: #059669; }
.cv-type-badge--warning { background: rgba(245,158,11,0.08); color: #D97706; }

/* Subject + preview */
.cv-subject {
  font-size: 0.875rem; font-weight: 600; color: var(--c-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-bottom: 2px;
}
.cv-preview {
  font-size: 0.78rem; color: var(--c-text-2); margin: 0;
  overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 1; -webkit-box-orient: vertical;
}

/* Driver cell */
.cv-driver-cell  { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.cv-driver-avatar {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  background: rgba(37,99,235,0.1); color: #2563EB;
  display: grid; place-items: center; font-size: 0.7rem; font-weight: 700;
}
.cv-driver-name  { font-size: 0.84rem; font-weight: 500; color: var(--c-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cv-cell-muted   { font-size: 0.82rem; color: var(--c-text-3); }

/* Date cell */
.cv-date-cell   { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; color: var(--c-text-2); }
.cv-date-icon   { flex-shrink: 0; opacity: 0.7; }

/* Status badge */
.cv-status-badge {
  display: inline-block; padding: 0.18rem 0.6rem; border-radius: 20px;
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  background: rgba(37,99,235,0.08); color: #2563EB;
}

/* Action buttons */
.cv-action-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.65rem; border-radius: 7px; font-size: 0.75rem; font-weight: 600;
  transition: background var(--dur), color var(--dur);
  white-space: nowrap;
}
.cv-action-btn--view   { color: #2563EB; background: rgba(37,99,235,0.07); }
.cv-action-btn--view:hover { background: rgba(37,99,235,0.14); }
.cv-action-btn--resend { color: var(--c-text-2); background: var(--c-bg); border: 1px solid var(--c-border); }
.cv-action-btn--resend:hover:not(:disabled) { background: var(--c-surface); color: var(--c-text-1); }
.cv-action-btn--resend:disabled { opacity: 0.5; cursor: not-allowed; }

.spinning { animation: spin 0.7s linear infinite; }

/* ══ MOBILE RESPONSIVE ════════════════════════════════════════════════════════ */
/*
  On mobile: collapse the grid into a card layout.
  Each cv-row--item becomes a card. The cv-row--header is hidden.
  Each cv-col shows its data-label for context.
*/
@media (max-width: 767px) {
  .cv-list { border-radius: 12px; }

  /* Hide desktop header */
  .cv-row--header { display: none; }

  /* Card layout */
  .cv-row--item {
    display: flex !important;         /* override grid */
    flex-direction: column;
    gap: 0;
    padding: 0;
    border-bottom: 1px solid var(--c-border);
    border-left: none !important;
  }
  .cv-row--item.cv-row--reward  { border-left: none !important; border-top: 3px solid #059669; }
  .cv-row--item.cv-row--warning { border-left: none !important; border-top: 3px solid #D97706; }
  .cv-row--item:first-child { border-top: none; border-radius: 0; }

  /* Card inner padding */
  .cv-col { padding: 0; }

  /* Top row: type + status + date */
  .cv-col-type {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.75rem 1rem 0.4rem;
    gap: 0.5rem;
  }
  .cv-type-badge { display: inline-block !important; } /* show on mobile */

  /* Subject col: full row */
  .cv-col-subject {
    padding: 0 1rem 0.35rem;
  }
  .cv-subject { white-space: normal; -webkit-line-clamp: unset; font-size: 0.9rem; }
  .cv-preview { -webkit-line-clamp: 2; }

  /* Driver col */
  .cv-col-driver { padding: 0 1rem 0.35rem; }

  /* Date col */
  .cv-col-date { padding: 0 1rem 0.35rem; }
  .cv-date-cell { font-size: 0.78rem; }

  /* Hide status column (shown inline in type row as badge) */
  .cv-col-status { display: none; }

  /* Actions row: full width, horizontal */
  .cv-col-actions {
    padding: 0.5rem 1rem 0.75rem;
    justify-content: flex-start; gap: 0.5rem;
    border-top: 1px solid var(--c-border-light, #F1F5F9);
    margin-top: 0.35rem;
  }
  .cv-action-btn { padding: 0.4rem 0.875rem; font-size: 0.8rem; }
}

/* ── Detail modal ─────────────────────────────────────────────────────────────── */
.cv-modal-icon {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: grid; place-items: center;
}
.cv-modal-icon--reward  { background: rgba(5,150,105,0.1); color: #059669; }
.cv-modal-icon--warning { background: rgba(245,158,11,0.1); color: #D97706; }

.cv-detail { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

.cv-detail-driver {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.625rem 0.875rem; border-radius: 10px;
  background: var(--c-bg); border: 1px solid var(--c-border);
}
.cv-detail-driver-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: rgba(37,99,235,0.1); color: #2563EB;
  display: grid; place-items: center; font-size: 0.82rem; font-weight: 700;
}
.cv-detail-driver-name { font-size: 0.9rem; font-weight: 600; color: var(--c-text-1); display: block; }
.cv-detail-driver-id   { font-size: 0.72rem; color: var(--c-text-3); font-family: monospace; }

.cv-detail-meta-row {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;
}
.cv-detail-type {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.22rem 0.7rem; border-radius: 20px;
  font-size: 0.75rem; font-weight: 700;
}
.cv-detail-type--reward  { background: rgba(5,150,105,0.1); color: #059669; }
.cv-detail-type--warning { background: rgba(245,158,11,0.1); color: #D97706; }
.cv-detail-date {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.78rem; color: var(--c-text-2);
}

.cv-detail-body {
  font-size: 0.9rem; line-height: 1.7; color: var(--c-text-1);
  padding: 1.1rem 1.25rem; background: var(--c-bg);
  border-radius: 10px; border: 1px solid var(--c-border);
}
:deep(.cv-detail-body p)      { margin: 0 0 0.6em; }
:deep(.cv-detail-body p:last-child) { margin-bottom: 0; }
:deep(.cv-detail-body ul)     { padding-left: 1.5em; margin: 0 0 0.5em; }
:deep(.cv-detail-body li)     { margin-bottom: 0.2em; }
:deep(.cv-detail-body strong) { font-weight: 700; }
:deep(.cv-detail-body em)     { font-style: italic; }
:deep(.cv-detail-body h2)     { font-size: 1rem; font-weight: 700; margin: 0 0 0.4em; }
</style>
