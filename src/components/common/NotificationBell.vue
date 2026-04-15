<!--
  NotificationBell.vue
  ──────────────────────
  In-app notification bell for drivers/employees.

  - Shows unread badge count on the bell icon
  - Desktop: click opens a popover dropdown
  - Mobile: click opens a full-screen overlay
  - Each notification represents a driver communication (reward/warning)
  - Clicking a notification opens the communication and marks it as read

  Architecture note:
  The store (useNotificationsStore) polls on app init and can be swapped
  for WebSocket / SSE without changing this component.
-->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '../../stores/notifications'
import { BellIcon, BellRingIcon, CheckCircleIcon, AlertIcon, CloseIcon, CheckIcon } from '../icons/index.js'

const router = useRouter()
const store  = useNotificationsStore()

const open = ref(false)

// Fetch on mount
onMounted(() => {
  if (!store.initialized) store.fetchNotifications()
})

// Close panel when clicking outside
const panelRef = ref(null)
function onDocClick(e) {
  if (open.value && panelRef.value && !panelRef.value.contains(e.target)) {
    open.value = false
  }
}
onMounted(() => document.addEventListener('mousedown', onDocClick))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocClick))

function toggle() { open.value = !open.value }

function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

async function openNotification(n) {
  await store.markRead(n.id)
  open.value = false
  // Navigate to communications and pass the communication id
  router.push({ name: 'communications', query: { open: n.communication_id } })
}

const badgeLabel = computed(() => {
  const c = store.unreadCount
  return c > 99 ? '99+' : String(c)
})
</script>

<template>
  <div class="nb-wrap" ref="panelRef">

    <!-- ── Bell button ──────────────────────────────────────────────── -->
    <button
      :class="['nb-btn', store.hasUnread && 'nb-btn--unread', open && 'nb-btn--open']"
      @click="toggle"
      :aria-label="`Notifications${store.unreadCount ? `, ${store.unreadCount} unread` : ''}`"
    >
      <component :is="store.hasUnread ? BellRingIcon : BellIcon" :size="18" />
      <span v-if="store.unreadCount" class="nb-badge" aria-hidden="true">
        {{ badgeLabel }}
      </span>
    </button>

    <!-- ── Dropdown panel ────────────────────────────────────────────── -->
    <Transition name="nb-panel">
      <div v-if="open" class="nb-panel" role="region" aria-label="Notifications">

        <!-- Panel header -->
        <div class="nb-panel-head">
          <span class="nb-panel-title">Notifications</span>
          <div class="nb-panel-head-right">
            <button
              v-if="store.unreadCount"
              class="nb-mark-all"
              @click="store.markAllRead()"
              title="Mark all as read"
            >
              <CheckIcon :size="12" :stroke-width="2.5" />
              Mark all read
            </button>
            <button class="nb-close-panel" @click="open = false" aria-label="Close notifications">
              <CloseIcon :size="14" :stroke-width="2.2" />
            </button>
          </div>
        </div>

        <!-- Notification list -->
        <div class="nb-list">
          <!-- Loading -->
          <div v-if="store.loading" class="nb-state-msg">
            <div class="nb-spinner" />
            Loading notifications…
          </div>

          <!-- Empty -->
          <div v-else-if="!store.notifications.length" class="nb-state-msg">
            <BellIcon :size="28" :stroke-width="1.3" style="opacity:0.3" />
            <span>No notifications yet</span>
          </div>

          <!-- Items -->
          <button
            v-else
            v-for="n in store.notifications"
            :key="n.id"
            :class="['nb-item', !n.read_at && 'nb-item--unread']"
            @click="openNotification(n)"
          >
            <!-- Type indicator -->
            <div :class="['nb-item-icon', `nb-item-icon--${n.communication_type || 'reward'}`]">
              <CheckCircleIcon v-if="n.communication_type === 'reward'" :size="14" />
              <AlertIcon       v-else                                    :size="14" />
            </div>

            <!-- Content -->
            <div class="nb-item-body">
              <p class="nb-item-title">{{ n.title || n.subject || 'New communication' }}</p>
              <p v-if="n.subject && n.title !== n.subject" class="nb-item-sub">{{ n.subject }}</p>
              <span class="nb-item-time">{{ formatTimeAgo(n.created_at) }}</span>
            </div>

            <!-- Unread dot -->
            <span v-if="!n.read_at" class="nb-unread-dot" aria-label="Unread" />
          </button>
        </div>

      </div>
    </Transition>

    <!-- ── Mobile backdrop ────────────────────────────────────────────── -->
    <Transition name="nb-backdrop">
      <div v-if="open" class="nb-mobile-backdrop" @click="open = false" />
    </Transition>

  </div>
</template>

<style scoped>
/* ── Wrapper ──────────────────────────────────────────────────────────────── */
.nb-wrap { position: relative; display: inline-flex; align-items: center; }

/* ── Bell button ──────────────────────────────────────────────────────────── */
.nb-btn {
  position: relative; width: 34px; height: 34px; border-radius: var(--r-md);
  display: grid; place-items: center;
  color: var(--c-text-2);
  transition: background var(--dur), color var(--dur);
}
.nb-btn:hover       { background: var(--c-bg); color: var(--c-text-1); }
.nb-btn--unread     { color: #7C3AED; }
.nb-btn--open       { background: var(--c-bg); color: var(--c-text-1); }

.nb-badge {
  position: absolute; top: 2px; right: 2px;
  min-width: 16px; height: 16px; padding: 0 3px;
  border-radius: var(--r-full); border: 2px solid var(--c-surface);
  background: #EF4444; color: #fff;
  font-size: 0.5625rem; font-weight: 800; line-height: 12px;
  display: grid; place-items: center; letter-spacing: 0;
  pointer-events: none;
}

/* ── Dropdown panel ───────────────────────────────────────────────────────── */
.nb-panel {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 300;
  width: min(360px, 90vw);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-xl);
  overflow: hidden;
  display: flex; flex-direction: column;
}
/* Mobile: full bottom-sheet style */
@media (max-width: 480px) {
  .nb-panel {
    position: fixed; inset: auto 0 0 0; z-index: 400;
    width: 100%; max-height: 80vh;
    border-radius: var(--r-2xl) var(--r-2xl) 0 0;
  }
}

/* ── Panel header ─────────────────────────────────────────────────────────── */
.nb-panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
}
.nb-panel-title { font-size: 0.875rem; font-weight: 700; color: var(--c-text-1); }
.nb-panel-head-right { display: flex; align-items: center; gap: 4px; }

.nb-mark-all {
  display: flex; align-items: center; gap: 3px;
  font-size: 0.72rem; font-weight: 600; color: #7C3AED; padding: 3px 6px; border-radius: 6px;
  transition: background var(--dur);
}
.nb-mark-all:hover { background: rgba(124,58,237,0.08); }

.nb-close-panel {
  width: 26px; height: 26px; border-radius: 6px;
  display: grid; place-items: center; color: var(--c-text-3);
  transition: background var(--dur), color var(--dur);
}
.nb-close-panel:hover { background: var(--c-bg); color: var(--c-text-1); }

/* ── Notification list ────────────────────────────────────────────────────── */
.nb-list { overflow-y: auto; max-height: 360px; }
@media (max-width: 480px) { .nb-list { max-height: calc(80vh - 55px); } }

.nb-state-msg {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 2.5rem 1rem; text-align: center;
  font-size: 0.82rem; color: var(--c-text-3);
}
.nb-spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--c-border); border-top-color: #7C3AED;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Notification item ────────────────────────────────────────────────────── */
.nb-item {
  display: flex; align-items: flex-start; gap: 10px;
  width: 100%; padding: 10px 14px; text-align: left;
  border-bottom: 1px solid var(--c-border-light, #F1F5F9);
  transition: background var(--dur);
  position: relative;
}
.nb-item:last-child   { border-bottom: none; }
.nb-item:hover        { background: var(--c-bg); }
.nb-item--unread      { background: rgba(124,58,237,0.03); }
.nb-item--unread:hover{ background: rgba(124,58,237,0.06); }

.nb-item-icon {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center; margin-top: 1px;
}
.nb-item-icon--reward  { background: rgba(22,163,74,0.1); color: #16A34A; }
.nb-item-icon--warning { background: rgba(245,158,11,0.1); color: #D97706; }

.nb-item-body   { flex: 1; min-width: 0; }
.nb-item-title  { font-size: 0.82rem; font-weight: 600; color: var(--c-text-1); line-height: 1.35; }
.nb-item-sub    { font-size: 0.76rem; color: var(--c-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nb-item-time   { font-size: 0.7rem; color: var(--c-text-3); margin-top: 3px; display: block; }

.nb-unread-dot {
  position: absolute; top: 50%; right: 14px; transform: translateY(-50%);
  width: 8px; height: 8px; border-radius: 50%; background: #7C3AED; flex-shrink: 0;
}

/* ── Mobile backdrop ──────────────────────────────────────────────────────── */
.nb-mobile-backdrop {
  display: none;
}
@media (max-width: 480px) {
  .nb-mobile-backdrop {
    display: block;
    position: fixed; inset: 0; z-index: 399;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(2px);
  }
}

/* ── Transitions ──────────────────────────────────────────────────────────── */
.nb-panel-enter-active { transition: opacity 160ms ease, transform 180ms cubic-bezier(0.34,1.3,0.64,1); }
.nb-panel-leave-active { transition: opacity 140ms ease, transform 140ms ease; }
.nb-panel-enter-from   { opacity: 0; transform: translateY(-8px) scale(0.97); }
.nb-panel-leave-to     { opacity: 0; transform: translateY(-6px) scale(0.97); }

@media (max-width: 480px) {
  .nb-panel-enter-from { opacity: 0; transform: translateY(20px); }
  .nb-panel-leave-to   { opacity: 0; transform: translateY(20px); }
}

.nb-backdrop-enter-active { transition: opacity 180ms ease; }
.nb-backdrop-leave-active { transition: opacity 160ms ease; }
.nb-backdrop-enter-from, .nb-backdrop-leave-to { opacity: 0; }
</style>
