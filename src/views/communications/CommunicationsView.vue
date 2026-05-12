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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CommunicationsIcon, CheckCircleIcon, AlertIcon, AddIcon,
  CloseIcon, CalendarIcon, ViewIcon, ResendIcon, FilterIcon,
  BellRingIcon, ChevronDownIcon, CheckIcon,
} from '../../components/icons/index.js'
import communicationsApi from '../../api/communications'
import { useAuthStore }          from '../../stores/auth'
import { useNotificationsStore } from '../../stores/notifications'
import { useToast }              from '../../composables/useToast'
import ModalSheet        from '../../components/common/ModalSheet.vue'
import ActionBtn         from '../../components/common/ActionBtn.vue'
import SearchInput       from '../../components/common/SearchInput.vue'
import AppPagination     from '../../components/common/AppPagination.vue'
import DateRangePicker   from '../../components/common/DateRangePicker.vue'
import Skeleton          from '../../components/common/Skeleton.vue'

const auth          = useAuthStore()
const notifications = useNotificationsStore()
const toast         = useToast()
const route  = useRoute()
const router = useRouter()

const isAdmin = computed(() => auth.hasRole('admin'))

// ── State ─────────────────────────────────────────────────────────────────────
const items   = ref([])
const loading = ref(true)
const error   = ref('')

// Filters
const typeFilter   = ref('')    // '' | 'reward' | 'warning' | 'announcement'
const searchQuery  = ref('')
const dateFrom     = ref('')    // ISO YYYY-MM-DD
const dateTo       = ref('')    // ISO YYYY-MM-DD

// Custom type-filter dropdown (mobile)
const TYPE_OPTIONS = [
  { value: '',             label: 'Type',         icon: null            },
  { value: 'reward',       label: 'Reward',       icon: CheckCircleIcon },
  { value: 'warning',      label: 'Warning',      icon: AlertIcon       },
  { value: 'announcement', label: 'Announcement', icon: BellRingIcon    },
]
const showTypeDropdown = ref(false)
const typeDdRef        = ref(null)
const activeTypeOption = computed(() =>
  TYPE_OPTIONS.find(o => o.value === typeFilter.value) || TYPE_OPTIONS[0]
)
function selectType(val) {
  typeFilter.value       = val
  showTypeDropdown.value = false
}
function onTypeDocClick(e) {
  if (!showTypeDropdown.value) return
  if (typeDdRef.value && !typeDdRef.value.contains(e.target)) showTypeDropdown.value = false
}

// ── Pagination (admin only) ───────────────────────────────────────────────────
const page = ref(1)
const meta = ref({})

// Detail modal
const showDetail   = ref(false)
const activeItem   = ref(null)

// Recipients drill-down modal
const showRecipients      = ref(false)
const recipientItem       = ref(null)   // the communication row
const recipientList       = ref([])     // [{user_id, name, driver_id, base, read_at, rendered_subject, rendered_body}]
const recipientsLoading   = ref(false)
const recipientsErr       = ref('')
const recipientReadFilter = ref('all')  // 'all' | 'read' | 'unread'
const recipientSearch     = ref('')
const previewRecipient    = ref(null)   // a single recipient when admin clicks Preview

async function openRecipients(item) {
  recipientItem.value       = item
  recipientList.value       = []
  recipientsErr.value       = ''
  recipientReadFilter.value = 'all'
  recipientSearch.value     = ''
  previewRecipient.value    = null
  showRecipients.value      = true
  recipientsLoading.value   = true
  try {
    const { data } = await communicationsApi.get(item.id)
    recipientList.value = data?.data?.recipients || []
  } catch (e) {
    recipientsErr.value = e?.response?.data?.message || 'Failed to load recipients.'
  } finally {
    recipientsLoading.value = false
  }
}

function closeRecipients() {
  showRecipients.value   = false
  previewRecipient.value = null
}

const recipientsFiltered = computed(() => {
  let list = recipientList.value
  if (recipientReadFilter.value === 'read')   list = list.filter(r => r.read_at)
  if (recipientReadFilter.value === 'unread') list = list.filter(r => !r.read_at)
  if (recipientSearch.value.trim()) {
    const q = recipientSearch.value.trim().toLowerCase()
    list = list.filter(r =>
      (r.name      || '').toLowerCase().includes(q) ||
      (r.driver_id || '').toLowerCase().includes(q) ||
      (r.base      || '').toLowerCase().includes(q)
    )
  }
  return list
})

const recipientReadCount   = computed(() => recipientList.value.filter(r => r.read_at).length)
const recipientUnreadCount = computed(() => recipientList.value.length - recipientReadCount.value)

function openCompose() {
  router.push({ name: 'communications-compose' })
}

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

// Short label describing who received this communication (admin table cell).
function audienceSummary(item) {
  const a = item.audience
  if (!a || !a.type || a.type === 'single') return item.driver_name || '—'
  if (a.type === 'all')     return 'All drivers'
  if (a.type === 'bases')   return `By base: ${(a.payload?.bases || []).join(', ') || '—'}`
  if (a.type === 'drivers') {
    const n = (a.payload?.driver_user_ids || []).length
    return `${n} selected driver${n === 1 ? '' : 's'}`
  }
  if (a.type === 'mixed')   return 'Mixed audience'
  return '—'
}

// Sub-line under audienceSummary — recipient/read tally.
function recipientSummary(item) {
  const total = item.recipients_count
  const read  = item.read_count
  if (total == null) return ''
  if (read == null)  return `${total} sent`
  return `${total} sent · ${read} read`
}

// Short category label rendered as a colored chip in the Recipients cell.
function audienceCategoryLabel(item) {
  const t = item.audience?.type || 'single'
  return ({ single: 'Single', all: 'All', bases: 'By base', drivers: 'Selected', mixed: 'Mixed' })[t] || 'Single'
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
function itemDate(i) { return (i.date || i.created_at || '').slice(0, 10) }

// Date-range-filtered pool. The driver-side `filtered` view layers type +
// search on top; banner stats reflect search + date so per-type counts
// stay meaningful even after the user narrows the view.
const dateScoped = computed(() => {
  let list = items.value
  if (dateFrom.value) list = list.filter(i => itemDate(i) >= dateFrom.value)
  if (dateTo.value)   list = list.filter(i => itemDate(i) <= dateTo.value)
  return list
})

// Admin pagination still happens server-side; search is server-side too.
// Type + date-range are applied client-side to the current page so counts stay consistent.
const filtered = computed(() => {
  let list = dateScoped.value
  if (typeFilter.value)  list = list.filter(i => i.type === typeFilter.value)
  if (!isAdmin.value && searchQuery.value) {
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

// Banner stats reflect everything except the type pill, so the per-type
// counts stay meaningful (e.g. "Rewards: 3 · Warnings: 2") even when the
// user has narrowed the date range or searched.
const bannerScoped = computed(() => {
  let list = dateScoped.value
  if (!isAdmin.value && searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(i =>
      i.subject?.toLowerCase().includes(q) ||
      i.body?.toLowerCase().includes(q)
    )
  }
  return list
})

const totalCount        = computed(() => bannerScoped.value.length)
const rewardCount       = computed(() => bannerScoped.value.filter(i => i.type === 'reward').length)
const warningCount      = computed(() => bannerScoped.value.filter(i => i.type === 'warning').length)
const announcementCount = computed(() => bannerScoped.value.filter(i => i.type === 'announcement').length)

// ── Driver-side client pagination ───────────────────────────────────────────
const DRIVER_PER_PAGE = 15
const driverPage = ref(1)
const driverLastPage = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / DRIVER_PER_PAGE))
)
const driverPagedItems = computed(() => {
  const start = (driverPage.value - 1) * DRIVER_PER_PAGE
  return filtered.value.slice(start, start + DRIVER_PER_PAGE)
})
const driverPageFrom = computed(() =>
  filtered.value.length === 0 ? 0 : (driverPage.value - 1) * DRIVER_PER_PAGE + 1
)
const driverPageTo = computed(() =>
  Math.min(driverPage.value * DRIVER_PER_PAGE, filtered.value.length)
)
watch([typeFilter, searchQuery, dateFrom, dateTo], () => {
  if (!isAdmin.value) driverPage.value = 1
})

// Rows actually rendered — page-sliced for drivers, full filtered set for admin.
const visibleRows = computed(() =>
  isAdmin.value ? filtered.value : driverPagedItems.value
)

// ── Fetch ─────────────────────────────────────────────────────────────────────
async function fetchItems() {
  loading.value = true
  error.value   = ''
  try {
    if (isAdmin.value) {
      const { data } = await communicationsApi.list({
        type:   typeFilter.value  || undefined,
        search: searchQuery.value || undefined,
        from:   dateFrom.value    || undefined,
        to:     dateTo.value      || undefined,
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
watch([dateFrom, dateTo], () => { if (isAdmin.value) { page.value = 1; fetchItems() } })

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
  document.addEventListener('click', onTypeDocClick, true)
})

// Auto-refresh the page list whenever the global notifications store sees
// a change in count — that's the signal that polling has brought in (or
// removed) a communication while the user is viewing this page.
watch(() => notifications.notifications.length, (next, prev) => {
  if (next !== prev) fetchItems()
})
onUnmounted(() => {
  document.removeEventListener('click', onTypeDocClick, true)
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
        <!-- Stats pills (skeletons while loading, real values once loaded) -->
        <div v-if="loading || items.length" class="cv-banner-stats">
          <div class="cv-bstat">
            <Skeleton v-if="loading" width="36px" height="22px" rounded="md" />
            <span v-else class="cv-bstat-val">{{ totalCount }}</span>
            <span class="cv-bstat-lbl">Total</span>
          </div>
          <div class="cv-bstat cv-bstat--green">
            <Skeleton v-if="loading" width="32px" height="22px" rounded="md" />
            <span v-else class="cv-bstat-val">{{ rewardCount }}</span>
            <span class="cv-bstat-lbl">Rewards</span>
          </div>
          <div class="cv-bstat cv-bstat--amber">
            <Skeleton v-if="loading" width="32px" height="22px" rounded="md" />
            <span v-else class="cv-bstat-val">{{ warningCount }}</span>
            <span class="cv-bstat-lbl">Warnings</span>
          </div>
          <div class="cv-bstat cv-bstat--purple">
            <Skeleton v-if="loading" width="32px" height="22px" rounded="md" />
            <span v-else class="cv-bstat-val">{{ announcementCount }}</span>
            <span class="cv-bstat-lbl">Announcement</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Error ────────────────────────────────────────────────────────────── -->
    <div v-if="error" class="cv-error">
      <CloseIcon :size="15" />{{ error }}
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
              <span v-if="typeFilter || searchQuery || dateFrom || dateTo" class="chip chip--filter">filtered</span>
            </p>
          </div>
          <div class="cv-card-hd-right">
            <div class="cv-card-search">
              <SearchInput
                v-model="searchQuery"
                :placeholder="isAdmin ? 'Search subject, driver…' : 'Search subject…'"
              />
            </div>
            <button v-if="isAdmin" class="cv-compose-btn" @click="openCompose">
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
            <button :class="['cv-seg-btn cv-seg-btn--announcement', typeFilter === 'announcement' && 'cv-seg-btn--on']" @click="typeFilter = 'announcement'">
              <BellRingIcon :size="11" /> Announcement
            </button>
          </div>

          <!-- Mobile: custom dropdown (styled pill + panel) replaces the segmented control -->
          <div class="cv-type-dd" ref="typeDdRef">
            <button
              type="button"
              :class="['cv-type-dd-trigger', showTypeDropdown && 'cv-type-dd-trigger--open', typeFilter && `cv-type-dd-trigger--${typeFilter}`]"
              :aria-haspopup="'listbox'"
              :aria-expanded="showTypeDropdown"
              @click="showTypeDropdown = !showTypeDropdown"
            >
              <component :is="activeTypeOption.icon" v-if="activeTypeOption.icon" :size="12" />
              <span class="cv-type-dd-label">{{ activeTypeOption.label }}</span>
              <ChevronDownIcon :size="12" :class="['cv-type-dd-caret', showTypeDropdown && 'cv-type-dd-caret--open']" />
            </button>

            <Transition name="cv-dd">
              <div v-if="showTypeDropdown" class="cv-type-dd-panel" role="listbox" aria-label="Filter by type">
                <button
                  v-for="opt in TYPE_OPTIONS"
                  :key="opt.value || 'all'"
                  type="button"
                  role="option"
                  :aria-selected="typeFilter === opt.value"
                  :class="['cv-type-dd-item', typeFilter === opt.value && 'cv-type-dd-item--on', opt.value && `cv-type-dd-item--${opt.value}`]"
                  @click="selectType(opt.value)"
                >
                  <span class="cv-type-dd-item-icon">
                    <component :is="opt.icon" v-if="opt.icon" :size="13" />
                  </span>
                  <span class="cv-type-dd-item-label">{{ opt.label }}</span>
                  <CheckIcon v-if="typeFilter === opt.value" :size="13" class="cv-type-dd-item-check" />
                </button>
              </div>
            </Transition>
          </div>

          <DateRangePicker v-model:from="dateFrom" v-model:to="dateTo" />

          <Transition name="cv-fade">
            <button v-if="typeFilter || dateFrom || dateTo" class="cv-clear-btn" @click="typeFilter = ''; dateFrom = ''; dateTo = ''">
              <CloseIcon :size="10" :stroke-width="2.5" />
              Reset
            </button>
          </Transition>
        </div>

        <!-- ── Empty state ─────────────────────────────────────────────────── -->
        <div v-if="!loading && !filtered.length" class="cv-empty">
          <CommunicationsIcon :size="38" :stroke-width="1.2" />
          <p class="cv-empty-title">{{ searchQuery || typeFilter || dateFrom || dateTo ? 'No results found' : 'No communications yet' }}</p>
          <p class="cv-empty-sub">
            {{ searchQuery || typeFilter || dateFrom || dateTo
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
                <th v-if="isAdmin" class="cv-th cv-th--recipients">Recipients</th>
                <th class="cv-th cv-th--subject">Subject</th>
                <th class="cv-th cv-th--date">Date</th>
                <th v-if="!isAdmin" class="cv-th cv-th--status">Status</th>
                <!-- <th class="cv-th cv-th--actions">Actions</th> -->
              </tr>
            </thead>
            <tbody>
              <!-- Skeleton rows during initial load -->
              <template v-if="loading">
                <tr v-for="n in 6" :key="`skel-${n}`" class="cv-tr cv-tr--skel">
                  <td class="cv-td"><Skeleton width="76px" height="20px" rounded="full" /></td>
                  <td v-if="isAdmin" class="cv-td">
                    <div class="cv-recipients-cell">
                      <Skeleton width="120px" height="12px" />
                      <Skeleton width="90px" height="10px" />
                    </div>
                  </td>
                  <td class="cv-td">
                    <div class="cv-subject-cell" style="gap:6px;">
                      <Skeleton width="220px" height="14px" />
                      <Skeleton width="280px" height="10px" />
                    </div>
                  </td>
                  <td class="cv-td"><Skeleton width="86px" height="12px" /></td>
                  <td v-if="!isAdmin" class="cv-td"><Skeleton width="56px" height="20px" rounded="full" /></td>
                  <!-- <td class="cv-td"><Skeleton width="80px" height="26px" rounded="md" /></td> -->
                </tr>
              </template>

              <tr
                v-for="item in visibleRows"
                :key="item.id"
                :class="['cv-tr', !isAdmin && isViewed(item.id) && 'cv-tr--read']"
                @click="openDetail(item)"
              >
                <!-- Type -->
                <td class="cv-td cv-td--type">
                  <span :class="['cv-type-badge', `cv-type-badge--${item.type}`]">
                    <CheckCircleIcon v-if="item.type === 'reward'"       :size="11" />
                    <BellRingIcon    v-else-if="item.type === 'announcement'" :size="11" />
                    <AlertIcon       v-else                                   :size="11" />
                    {{ item.type === 'reward' ? 'Reward' : item.type === 'announcement' ? 'Announcement' : 'Warning' }}
                  </span>
                </td>

                <!-- Recipients (admin only) — click to drill into the actual list -->
                <td v-if="isAdmin" class="cv-td cv-td--recipients">
                  <button
                    type="button"
                    class="cv-recipients-cell cv-recipients-cell--btn"
                    title="View recipients"
                    @click.stop="openRecipients(item)"
                  >
                    <div class="cv-recipients-row">
                      <span :class="['cv-aud-tag', `cv-aud-tag--${item.audience?.type || 'single'}`]">
                        {{ audienceCategoryLabel(item) }}
                      </span>
                      <span class="cv-recipients-main">{{ audienceSummary(item) }}</span>
                    </div>
                    <span v-if="recipientSummary(item)" class="cv-recipients-sub">{{ recipientSummary(item) }}</span>
                  </button>
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

                <!-- Status (driver-side only — admin gets recipients sub-line instead) -->
                <td v-if="!isAdmin" class="cv-td cv-td--status">
                  <span :class="['badge', isViewed(item.id) ? 'badge-active' : 'badge-info']">
                    {{ isViewed(item.id) ? 'Read' : 'New' }}
                  </span>
                </td>

                <!-- Actions -->
                <!-- <td class="cv-td cv-td--actions" @click.stop>
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
                </td> -->
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination — admin uses server-side meta, driver uses client-side -->
        <AppPagination
          v-if="isAdmin && !loading && filtered.length"
          :current-page="meta.current_page ?? 1"
          :last-page="meta.last_page ?? 1"
          :total="meta.total ?? 0"
          :from="meta.from ?? 0"
          :to="meta.to ?? 0"
          always
          @change="p => { page = p; fetchItems() }"
        />
        <AppPagination
          v-else-if="!isAdmin && !loading && filtered.length"
          :current-page="driverPage"
          :last-page="driverLastPage"
          :total="filtered.length"
          :from="driverPageFrom"
          :to="driverPageTo"
          always
          @change="p => { driverPage = p }"
        />

      </div>

    </template>

    <!-- ── Detail modal ──────────────────────────────────────────────────────── -->
    <ModalSheet
      v-model="showDetail"
      :title="activeItem?.subject || 'Communication'"
      :subtitle="activeItem ? `${activeItem.type === 'reward' ? 'Reward' : activeItem.type === 'announcement' ? 'Announcement' : 'Warning'} Communication · ${formatDate(activeItem.date || activeItem.created_at)}` : ''"
      max-width="600px"
    >
      <template #icon>
        <div :class="['cv-modal-icon', activeItem ? `cv-modal-icon--${activeItem.type}` : '']">
          <CheckCircleIcon v-if="activeItem?.type === 'reward'"       :size="17" />
          <BellRingIcon    v-else-if="activeItem?.type === 'announcement'" :size="17" />
          <AlertIcon       v-else                                         :size="17" />
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
            <CheckCircleIcon v-if="activeItem.type === 'reward'"       :size="12" />
            <BellRingIcon    v-else-if="activeItem.type === 'announcement'" :size="12" />
            <AlertIcon       v-else                                         :size="12" />
            {{ activeItem.type === 'reward' ? 'Reward Communication' : activeItem.type === 'announcement' ? 'Announcement' : 'Warning Communication' }}
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

    <!-- ── Recipients drill-down modal (admin) ─────────────────────────────── -->
    <ModalSheet
      v-if="isAdmin"
      v-model="showRecipients"
      max-width="620px"
      :title="recipientItem?.subject || 'Recipients'"
      :subtitle="recipientItem ? audienceSummary(recipientItem) : ''"
    >
      <template v-if="recipientItem" #icon>
        <span :class="['cv-aud-tag', `cv-aud-tag--${recipientItem.audience?.type || 'single'}`]">
          {{ audienceCategoryLabel(recipientItem) }}
        </span>
      </template>

      <div v-if="recipientItem" class="cv-recip">

        <!-- Stat strip -->
        <div class="cv-recip-stats">
          <button
            type="button"
            :class="['cv-recip-stat', recipientReadFilter === 'all' && 'cv-recip-stat--on']"
            @click="recipientReadFilter = 'all'"
          >
            <span class="cv-recip-stat-num">{{ recipientList.length }}</span>
            <span class="cv-recip-stat-lbl">Total</span>
          </button>
          <button
            type="button"
            :class="['cv-recip-stat', recipientReadFilter === 'read' && 'cv-recip-stat--on']"
            @click="recipientReadFilter = 'read'"
          >
            <span class="cv-recip-stat-num cv-recip-stat-num--read">{{ recipientReadCount }}</span>
            <span class="cv-recip-stat-lbl">Read</span>
          </button>
          <button
            type="button"
            :class="['cv-recip-stat', recipientReadFilter === 'unread' && 'cv-recip-stat--on']"
            @click="recipientReadFilter = 'unread'"
          >
            <span class="cv-recip-stat-num cv-recip-stat-num--unread">{{ recipientUnreadCount }}</span>
            <span class="cv-recip-stat-lbl">Unread</span>
          </button>
        </div>

        <!-- Search -->
        <div class="cv-recip-tools">
          <SearchInput v-model="recipientSearch" placeholder="Search by name, ID or base…" />
        </div>

        <!-- States -->
        <div v-if="recipientsLoading" class="cv-recip-state">Loading recipients…</div>
        <div v-else-if="recipientsErr" class="cv-recip-state cv-recip-state--err">{{ recipientsErr }}</div>
        <div v-else-if="!recipientsFiltered.length" class="cv-recip-state">No matching recipients.</div>

        <!-- List -->
        <ul v-else class="cv-recip-list">
          <li v-for="r in recipientsFiltered" :key="r.user_id" class="cv-recip-item">
            <div class="cv-recip-avatar">{{ (r.name || '?').charAt(0).toUpperCase() }}</div>
            <div class="cv-recip-info">
              <span class="cv-recip-name">{{ r.name || '—' }}</span>
              <span class="cv-recip-meta">
                <span class="cv-recip-id">{{ r.driver_id || '—' }}</span>
                <span v-if="r.base" class="cv-recip-base">{{ r.base }}</span>
              </span>
            </div>
            <div class="cv-recip-status">
              <span v-if="r.read_at" class="badge badge-active" :title="`Read at ${formatDate(r.read_at)}`">
                <CheckIcon :size="11" /> Read
              </span>
              <span v-else class="badge badge-info">Unread</span>
            </div>
            <button
              type="button"
              class="cv-recip-preview-btn"
              title="Preview as this recipient"
              @click="previewRecipient = r"
            >
              <ViewIcon :size="13" />
            </button>
          </li>
        </ul>

        <!-- Per-recipient rendered preview -->
        <div v-if="previewRecipient" class="cv-recip-preview">
          <div class="cv-recip-preview-hd">
            <div>
              <p class="cv-recip-preview-eyebrow">Preview as</p>
              <p class="cv-recip-preview-name">{{ previewRecipient.name }} <span class="cv-recip-preview-id">{{ previewRecipient.driver_id }}</span></p>
            </div>
            <button class="cv-recip-close" @click="previewRecipient = null" aria-label="Close preview">
              <CloseIcon :size="13" />
            </button>
          </div>
          <p class="cv-recip-preview-subject">{{ previewRecipient.rendered_subject || recipientItem.subject }}</p>
          <div class="cv-recip-preview-body" v-html="formatContent(previewRecipient.rendered_body || recipientItem.body)" />
        </div>
      </div>
    </ModalSheet>

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
.cv-bstat--green  .cv-bstat-val { color: var(--c-green, #16A34A); }
.cv-bstat--amber  .cv-bstat-val { color: var(--c-amber, #D97706); }
.cv-bstat--purple .cv-bstat-val { color: var(--c-purple, #7C3AED); }

.cv-compose-btn {
  display: inline-flex; align-items: center; gap: 6px;
  background: var(--c-accent); color: #fff; border: none; border-radius: 8px;
  padding: 8px 14px; font-size: 0.875rem; font-weight: 600; cursor: pointer;
  transition: opacity var(--dur); white-space: nowrap; flex-shrink: 0;
}
.cv-compose-btn svg { width: 14px; height: 14px; }
.cv-compose-btn:hover { opacity: 0.88; }

/* ══ LOADING / ERROR ═════════════════════════════════════════════════════════ */
.cv-tr--skel { cursor: default; }
.cv-tr--skel:hover { background: transparent; }
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
/* FILTER label always on its own row (matches Compensation/Payroll Batches standard) */
.cv-filter-lbl {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: var(--c-text-3);
  width: 100%; margin-bottom: 4px;
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
/* Announcement — active: purple (semantic) */
.cv-seg-btn--announcement.cv-seg-btn--on { color: var(--c-purple); }
.cv-clear-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 0.75rem; font-weight: 500; color: var(--c-text-3);
  padding: 4px 10px; border-radius: var(--r-full);
  border: 1px solid var(--c-border); background: var(--c-surface);
  cursor: pointer; transition: all var(--dur); flex-shrink: 0;
}

/* Match DateRangePicker trigger to the .cv-seg container dimensions exactly.
   .cv-seg = 3px container padding + .cv-seg-btn 4px inner padding → 7px effective vertical,
   12px + 3px → 15px effective horizontal. */
.cv-filter-bar :deep(.drp-chip) {
  padding: 7px 14px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--c-text-3);
  line-height: 1;
  background: var(--c-bg);
}
.cv-filter-bar :deep(.drp-chip:hover:not(:disabled)) { color: var(--c-text-1); }
.cv-filter-bar :deep(.drp-chip--open) { color: var(--c-accent); font-weight: 600; }
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
.cv-th--recipients { min-width: 180px; }
.cv-td--recipients { vertical-align: middle; }
.cv-recipients-cell {
  display: flex; flex-direction: column; gap: 3px;
}
.cv-recipients-row  {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.cv-recipients-main { font-size: 0.875rem; font-weight: 600; color: var(--c-text-1); }
.cv-recipients-sub  { font-size: 0.72rem; color: var(--c-text-3); }

/* Make the cell behave like a clickable link without losing layout. */
.cv-recipients-cell--btn {
  width: 100%; text-align: left;
  background: transparent; border: none; padding: 4px 6px; margin: -4px -6px;
  border-radius: 6px; cursor: pointer; transition: background var(--dur);
}
.cv-recipients-cell--btn:hover { background: var(--c-hover); }
.cv-recipients-cell--btn:hover .cv-recipients-main { color: var(--c-accent); }

/* ══ Recipients drill-down modal ════════════════════════════════════════════ */
.cv-recip { display: flex; flex-direction: column; gap: 10px; padding: 14px 18px 18px; }

.cv-recip-stats {
  display: flex; gap: 5px;
}
.cv-recip-stat {
  display: inline-flex; align-items: center; gap: 6px; flex: 1;
  padding: 5px 10px; border-radius: var(--r-full);
  background: var(--c-bg); border: 1px solid var(--c-border);
  cursor: pointer; transition: all var(--dur);
}
.cv-recip-stat:hover { border-color: var(--c-accent); }
.cv-recip-stat--on  { background: var(--c-accent-tint); border-color: var(--c-accent); }
.cv-recip-stat-num  { font-size: 0.9rem; font-weight: 700; color: var(--c-text-1); font-variant-numeric: tabular-nums; }
.cv-recip-stat-num--read   { color: #16A34A; }
.cv-recip-stat-num--unread { color: #D97706; }
.cv-recip-stat-lbl { font-size: 0.7rem; font-weight: 600; color: var(--c-text-3); text-transform: uppercase; letter-spacing: 0.05em; }

.cv-recip-tools { display: flex; gap: 6px; }

.cv-recip-state {
  padding: 16px 12px; text-align: center; color: var(--c-text-3); font-size: 0.8rem;
  background: var(--c-bg); border-radius: 8px; border: 1px dashed var(--c-border);
}
.cv-recip-state--err { color: var(--c-red); border-color: var(--c-red); background: var(--c-red-tint); }

.cv-recip-list {
  list-style: none; margin: 0; padding: 0;
  border: 1px solid var(--c-border); border-radius: 8px; overflow: hidden;
  max-height: 340px; overflow-y: auto;
}
.cv-recip-item {
  display: grid; grid-template-columns: 28px 1fr auto auto;
  align-items: center; gap: 8px;
  padding: 7px 10px; border-bottom: 1px solid var(--c-border-light);
}
.cv-recip-item:last-child { border-bottom: none; }
.cv-recip-item:hover { background: var(--c-hover); }
.cv-recip-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: rgba(124,58,237,0.12); color: #7C3AED;
  display: grid; place-items: center; font-size: 0.72rem; font-weight: 700;
}
.cv-recip-info { display: flex; flex-direction: column; min-width: 0; }
.cv-recip-name { font-size: 0.875rem; font-weight: 600; color: var(--c-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cv-recip-meta { display: flex; gap: 8px; font-size: 0.72rem; color: var(--c-text-3); }
.cv-recip-id   { font-family: monospace; }
.cv-recip-base {
  padding: 0 6px; border-radius: 4px;
  background: var(--c-bg); color: var(--c-text-2); font-weight: 600;
}
.cv-recip-status .badge { display: inline-flex; align-items: center; gap: 4px; }
.cv-recip-preview-btn {
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid var(--c-border); background: transparent; color: var(--c-text-3);
  display: grid; place-items: center; cursor: pointer; transition: all var(--dur);
}
.cv-recip-preview-btn:hover { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-accent-tint); }

.cv-recip-preview {
  margin-top: 4px; padding: 14px 16px;
  background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 10px;
}
.cv-recip-preview-hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.cv-recip-preview-eyebrow { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--c-text-3); margin-bottom: 2px; }
.cv-recip-preview-name { font-size: 0.92rem; font-weight: 700; color: var(--c-text-1); }
.cv-recip-preview-id   { font-family: monospace; font-size: 0.75rem; color: var(--c-text-3); margin-left: 6px; }
.cv-recip-preview-subject { margin-top: 12px; font-size: 0.95rem; font-weight: 700; color: var(--c-text-1); }
.cv-recip-preview-body :deep(p) { margin: 0.5em 0; line-height: 1.55; color: var(--c-text-1); }
.cv-recip-preview-body :deep(strong) { color: var(--c-text-1); font-weight: 700; }

.cv-aud-tag {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 4px;
  font-size: 0.65rem; font-weight: 700;
  letter-spacing: 0.05em; text-transform: uppercase;
  white-space: nowrap; flex-shrink: 0;
}
.cv-aud-tag--single  { background: #E0E7FF; color: #3730A3; }
.cv-aud-tag--all     { background: #DCFCE7; color: #166534; }
.cv-aud-tag--bases   { background: #F3E8FF; color: #6B21A8; }
.cv-aud-tag--drivers { background: #FEF3C7; color: #92400E; }
.cv-aud-tag--mixed   { background: #FCE7F3; color: #9D174D; }
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
.cv-type-badge--reward       { border-color: var(--c-green);  color: var(--c-green);  background: var(--c-green-tint); }
.cv-type-badge--warning      { border-color: var(--c-amber);  color: var(--c-amber);  background: var(--c-amber-tint); }
.cv-type-badge--announcement { border-color: var(--c-purple); color: var(--c-purple); background: var(--c-purple-tint); }

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

/* ══ MOBILE TYPE DROPDOWN — custom pill + popover panel ════════════════════ */
.cv-type-dd {
  display: none;
  position: relative;
}
.cv-type-dd-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-full);
  color: var(--c-text-3);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: border-color var(--dur), color var(--dur), box-shadow var(--dur);
  width: 100%;
  min-width: 160px;
  justify-content: flex-start;
}
.cv-type-dd-trigger:hover { color: var(--c-text-1); border-color: var(--c-text-3); }
.cv-type-dd-trigger--open {
  border-color: var(--c-accent);
  color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.cv-type-dd-trigger--reward       { color: var(--c-green);  border-color: color-mix(in srgb, var(--c-green) 40%, transparent); }
.cv-type-dd-trigger--warning      { color: var(--c-amber);  border-color: color-mix(in srgb, var(--c-amber) 40%, transparent); }
.cv-type-dd-trigger--announcement { color: var(--c-purple); border-color: color-mix(in srgb, var(--c-purple) 40%, transparent); }

.cv-type-dd-label { flex: 1; text-align: left; white-space: nowrap; }
.cv-type-dd-caret { transition: transform var(--dur); flex-shrink: 0; }
.cv-type-dd-caret--open { transform: rotate(180deg); }

.cv-type-dd-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 40;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-md);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 180px;
}
.cv-type-dd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: var(--r-md);
  background: transparent;
  color: var(--c-text-2);
  font-size: 0.8125rem;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background var(--dur), color var(--dur);
  line-height: 1.2;
}
.cv-type-dd-item:hover { background: var(--c-bg); color: var(--c-text-1); }
.cv-type-dd-item--on { background: var(--c-accent-tint, rgba(29,78,216,0.08)); color: var(--c-accent); font-weight: 600; }
.cv-type-dd-item--reward       .cv-type-dd-item-icon { color: var(--c-green); }
.cv-type-dd-item--warning      .cv-type-dd-item-icon { color: var(--c-amber); }
.cv-type-dd-item--announcement .cv-type-dd-item-icon { color: var(--c-purple); }
.cv-type-dd-item-icon {
  width: 16px; display: inline-flex; align-items: center; justify-content: center;
  color: var(--c-text-3);
}
.cv-type-dd-item-label { flex: 1; }
.cv-type-dd-item-check { color: var(--c-accent); flex-shrink: 0; }

.cv-dd-enter-active, .cv-dd-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.cv-dd-enter-from, .cv-dd-leave-to { opacity: 0; transform: translateY(-4px); }

/* ══ MOBILE — convert table rows to stacked cards ═══════════════════════════ */
/* Each row becomes a self-contained card: type chip + status on top, full
   subject + preview below, then date. No horizontal overflow on phones. */
@media (max-width: 640px) {
  .cv-card-hd { flex-direction: column; align-items: flex-start; }
  .cv-card-hd-right { width: 100%; }

  /* Filter bar: swap the segmented pill for a custom type dropdown on phones */
  .cv-filter-bar { padding: 10px 14px; }
  .cv-seg { display: none; }
  .cv-type-dd { display: inline-block; flex: 1 1 160px; min-width: 0; }

  /* Banner stats: let four pills wrap into a 2x2 grid on phones so "Announcement" isn't clipped */
  .cv-banner-right { width: 100%; }
  .cv-banner-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    width: 100%;
  }
  .cv-bstat { min-width: 0; padding: 8px 10px; }

  /* ── Card-stack transformation ───────────────────────────────────────────
     Hide thead (column titles don't make sense in card view) and reflow
     each <tr> as a vertical card with a flex-wrap layout. */
  .cv-table-wrap { overflow-x: visible !important; }
  .cv-table,
  .cv-table tbody { display: block; width: 100%; }
  .cv-table thead { display: none; }

  .cv-tr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    padding: 12px 14px;
    margin: 8px 12px;
    border: 1px solid var(--c-border);
    border-radius: 12px;
    background: var(--c-surface);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  }
  .cv-tr:hover  { background: var(--c-surface); }
  .cv-tr--read  { background: var(--c-bg); }

  .cv-td {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    text-align: left;
  }
  /* Type chip + status badge share the first row.
     `order` overrides DOM sequence (type, subject, date, status) so the
     status badge sits next to the type chip instead of below the date. */
  .cv-td--type       { order: 1; width: auto; }
  .cv-td--status     { order: 2; width: auto; margin-left: auto; text-align: right; }
  .cv-td--recipients { order: 3; width: 100%; }
  .cv-td--subject    { order: 4; width: 100%; }
  .cv-td--date       { order: 5; width: 100%; }

  /* Subject wraps to 2 lines, preview clamps to 1, both use full width */
  .cv-subject {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
            line-clamp: 2;
    white-space: normal;
    overflow: hidden;
    max-width: none;
    line-height: 1.3;
  }
  .cv-preview {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: none;
  }

  /* Recipients button — left align inside the card */
  .cv-recipients-cell--btn { text-align: left; padding: 0; }

  /* Date — muted, sits at bottom of card */
  .cv-date-cell {
    font-size: 0.75rem;
    color: var(--c-text-3);
  }

  /* ── Pro-style tags inside mobile cards ────────────────────────────────
     Subtle filled chip (no border, soft tint), title-case, no icon. Reads
     like a meta tag in Notion/Linear/Gmail rather than a call-to-action. */
  .cv-tr .cv-type-badge {
    padding: 2px 8px;
    border: none;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: capitalize;
    gap: 0;
  }
  .cv-tr .cv-type-badge svg { display: none; }

  /* Status pill: hide entirely on mobile. The unread dot next to the
     subject (.cv-unread-dot) already tells the user "this is new" — having
     BOTH a dot and a "NEW"/"READ" pill is redundant and feels heavy. */
  .cv-tr .badge { display: none; }
}

/* ══ DETAIL MODAL ════════════════════════════════════════════════════════════ */
.cv-modal-icon {
  width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
  display: grid; place-items: center;
}
.cv-modal-icon--reward       { background: var(--c-green);  color: #fff; }
.cv-modal-icon--warning      { background: var(--c-amber);  color: #fff; }
.cv-modal-icon--announcement { background: var(--c-purple); color: #fff; }

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
.cv-detail-type--reward       { background: var(--c-green-tint);  color: var(--c-green); }
.cv-detail-type--warning      { background: var(--c-amber-tint);  color: var(--c-amber); }
.cv-detail-type--announcement { background: var(--c-purple-tint); color: var(--c-purple); }
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
