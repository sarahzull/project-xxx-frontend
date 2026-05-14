<!--
  NotificationBell.vue
  ──────────────────────
  In-app notification bell for drivers/employees.

  - Desktop: click opens a right-anchored dropdown
  - Mobile (≤768px): click opens a bottom sheet with drag-handle and
    swipe-down-to-dismiss
  - Single instance — CSS handles desktop vs. mobile placement
-->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationsStore } from '../../stores/notifications'
import { BellIcon, BellRingIcon, CheckCircleIcon, AlertIcon, CloseIcon, CheckIcon, TrashIcon } from '../icons/index.js'

const router = useRouter()
const store  = useNotificationsStore()

const open            = ref(false)
const confirmingClear = ref(false)
const wrapRef         = ref(null)
const panelRef        = ref(null)
const bellRef         = ref(null)
const closeBtnRef     = ref(null)

const dragY    = ref(0)
let   dragging = false
let   startY   = 0

onMounted(() => {
  if (!store.initialized) store.fetchNotifications()
  document.addEventListener('pointerdown', onDocPointer, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
})

function onDocPointer(e) {
  if (!open.value) return
  const inWrap  = wrapRef.value?.contains(e.target)
  const inPanel = panelRef.value?.contains(e.target)
  if (!inWrap && !inPanel) open.value = false
}

function toggle() {
  open.value = !open.value
  confirmingClear.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    // Defer focus to the next tick AFTER the transition fires so it doesn't
    // race with Vue's CSS class removal logic on the entering element.
    nextTick(() => {
      requestAnimationFrame(() => closeBtnRef.value?.focus())
    })
  } else {
    confirmingClear.value = false
    dragY.value = 0
    bellRef.value?.focus()
  }
}, { flush: 'post' })

function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff  = Date.now() - new Date(dateStr).getTime()
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
  router.push({ name: 'communications', query: { open: n.communication_id } })
}

function requestClear() {
  if (!store.notifications.length) return
  confirmingClear.value = true
}
async function confirmClear() {
  await store.clearAll()
  confirmingClear.value = false
}

function onHandlePointerDown(e) {
  if (e.pointerType === 'mouse') return
  dragging = true
  startY   = e.clientY
  dragY.value = 0
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onHandlePointerMove(e) {
  if (!dragging) return
  const delta = e.clientY - startY
  dragY.value = Math.max(0, delta)
}
function onHandlePointerUp() {
  if (!dragging) return
  dragging = false
  if (dragY.value > 80) {
    open.value = false
  } else {
    dragY.value = 0
  }
}

const badgeLabel = computed(() => {
  const c = store.unreadCount
  return c > 99 ? '99+' : String(c)
})

const sheetStyle = computed(() => (
  dragY.value > 0 ? { transform: `translateY(${dragY.value}px)`, transition: 'none' } : null
))
</script>

<template>
  <div class="nb-wrap" ref="wrapRef">

    <!-- Bell button -->
    <button
      ref="bellRef"
      :class="['nb-btn', store.hasUnread && 'nb-btn--unread', open && 'nb-btn--open']"
      @click="toggle"
      :aria-label="`Notifications${store.unreadCount ? `, ${store.unreadCount} unread` : ''}`"
      :aria-expanded="open"
      aria-haspopup="dialog"
    >
      <component :is="store.hasUnread ? BellRingIcon : BellIcon" :size="18" />
      <span v-if="store.unreadCount" class="nb-badge" aria-hidden="true">
        {{ badgeLabel }}
      </span>
    </button>

    <!-- Dropdown / bottom-sheet panel.
         (The sticky .app-header sets its z-index above the bottom-nav so the
         fixed mobile sheet renders correctly above it.)
         CSS-driven enter animation via the `nb-panel--open` class instead of
         <Transition> to avoid a transition-stage-2 hang we hit in this env. -->
    <div
      v-if="open"
      ref="panelRef"
      :class="['nb-panel', 'nb-panel--open']"
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      :style="sheetStyle"
    >
        <div
          class="nb-handle"
          aria-hidden="true"
          @pointerdown="onHandlePointerDown"
          @pointermove="onHandlePointerMove"
          @pointerup="onHandlePointerUp"
          @pointercancel="onHandlePointerUp"
        >
          <span class="nb-handle-pill" />
        </div>

        <div class="nb-panel-head">
          <span class="nb-panel-title">Notifications</span>
          <div class="nb-panel-head-right">
            <button
              v-if="store.unreadCount && !confirmingClear"
              class="nb-action nb-action--accent"
              @click="store.markAllRead()"
            >
              <CheckIcon :size="13" :stroke-width="2.4" />
              <span class="nb-action-label">Mark all read</span>
            </button>

            <button
              v-if="store.notifications.length && !confirmingClear"
              class="nb-action nb-action--danger"
              @click="requestClear"
            >
              <TrashIcon :size="13" :stroke-width="2.2" />
              <span class="nb-action-label">Hide</span>
            </button>

            <template v-if="confirmingClear">
              <span class="nb-confirm-msg">Hide all? Still in Communications.</span>
              <button class="nb-action nb-action--danger nb-action--solid" @click="confirmClear">
                Confirm
              </button>
              <button class="nb-action" @click="confirmingClear = false">
                Cancel
              </button>
            </template>

            <button
              ref="closeBtnRef"
              class="nb-close"
              @click="open = false"
              aria-label="Close notifications"
            >
              <CloseIcon :size="16" :stroke-width="2.2" />
            </button>
          </div>
        </div>

        <div class="nb-list">
          <div v-if="store.loading" class="nb-state-msg">
            <div class="nb-spinner" />
            Loading notifications…
          </div>

          <div v-else-if="!store.notifications.length" class="nb-state-msg">
            <BellIcon :size="28" :stroke-width="1.3" style="opacity:0.3" />
            <span>No notifications yet</span>
          </div>

          <button
            v-else
            v-for="n in store.notifications"
            :key="n.id"
            :class="['nb-item', !n.read_at && 'nb-item--unread']"
            @click="openNotification(n)"
          >
            <div :class="['nb-item-icon', `nb-item-icon--${n.communication_type || 'reward'}`]">
              <CheckCircleIcon v-if="n.communication_type === 'reward'" :size="14" />
              <AlertIcon       v-else                                    :size="14" />
            </div>

            <div class="nb-item-body">
              <p class="nb-item-title">{{ n.title || n.subject || 'New communication' }}</p>
              <p v-if="n.subject && n.title !== n.subject" class="nb-item-sub">{{ n.subject }}</p>
              <span class="nb-item-time">{{ formatTimeAgo(n.created_at) }}</span>
            </div>

            <span v-if="!n.read_at" class="nb-unread-dot" aria-label="Unread" />
          </button>
        </div>
    </div>

    <div v-if="open" class="nb-mobile-backdrop" @click="open = false" />

  </div>
</template>

<style scoped>
.nb-wrap { position: relative; display: inline-flex; align-items: center; }

.nb-btn {
  position: relative; width: 40px; height: 40px; border-radius: var(--r-md);
  display: grid; place-items: center;
  color: var(--c-text-2);
  transition: background var(--dur), color var(--dur);
}
.nb-btn:hover       { background: var(--c-bg); color: var(--c-text-1); }
.nb-btn--unread     { color: var(--c-accent); }
.nb-btn--open       { background: var(--c-bg); color: var(--c-text-1); }
.nb-btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }

.nb-badge {
  position: absolute; top: 4px; right: 4px;
  min-width: 16px; height: 16px; padding: 0 3px;
  border-radius: var(--r-full); border: 2px solid var(--c-surface);
  background: var(--c-red); color: #fff;
  font-size: 0.5625rem; font-weight: 800; line-height: 12px;
  display: grid; place-items: center; letter-spacing: 0;
  pointer-events: none;
}

.nb-panel {
  position: absolute; top: calc(100% + 8px); right: 0; z-index: 300;
  width: min(380px, 90vw);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-xl);
  box-shadow: var(--sh-xl);
  overflow: hidden;
  display: flex; flex-direction: column;
  max-height: 480px;
}

@media (max-width: 768px) {
  .nb-panel {
    position: fixed; inset: auto 0 0 0; z-index: 400;
    width: 100%;
    max-height: 80vh;
    border-radius: var(--r-2xl) var(--r-2xl) 0 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}

.nb-handle {
  display: none;
  padding: 8px 0 4px;
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
}
.nb-handle:active { cursor: grabbing; }
.nb-handle-pill {
  display: block;
  width: 40px; height: 4px;
  margin: 0 auto;
  border-radius: var(--r-full);
  background: var(--c-border);
}
@media (max-width: 768px) {
  .nb-handle { display: block; }
}

.nb-panel-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
  min-height: 56px;
}
.nb-panel-title { font-size: 0.9375rem; font-weight: 700; color: var(--c-text-1); }
.nb-panel-head-right {
  display: flex; align-items: center; gap: 4px;
  flex-wrap: wrap; justify-content: flex-end;
}

.nb-action {
  display: inline-flex; align-items: center; gap: 4px;
  min-height: 36px;
  padding: 6px 10px;
  border-radius: var(--r-md);
  font-size: 0.75rem; font-weight: 600;
  color: var(--c-text-2);
  transition: background var(--dur), color var(--dur);
}
.nb-action:hover { background: var(--c-bg); color: var(--c-text-1); }
.nb-action--accent { color: var(--c-accent); }
.nb-action--accent:hover { background: var(--c-accent-tint); }
.nb-action--danger { color: var(--c-red); }
.nb-action--danger:hover { background: var(--c-red-tint); }
.nb-action--solid { background: var(--c-red); color: #fff; }
.nb-action--solid:hover { background: var(--c-red); filter: brightness(0.94); color: #fff; }
.nb-action:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 1px; }
.nb-confirm-msg { font-size: 0.72rem; color: var(--c-text-2); padding-inline: 4px; }
.nb-action-label { line-height: 1; }

.nb-close {
  width: 36px; height: 36px;
  border-radius: var(--r-md);
  display: grid; place-items: center;
  color: var(--c-text-3);
  transition: background var(--dur), color var(--dur);
}
.nb-close:hover { background: var(--c-bg); color: var(--c-text-1); }
.nb-close:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 1px; }

@media (max-width: 768px) {
  .nb-action {
    min-height: 44px;
    padding: 8px 12px;
    font-size: 0.8125rem;
  }
  .nb-close { width: 44px; height: 44px; }
  .nb-confirm-msg { flex-basis: 100%; padding-block: 4px; }
}

.nb-list {
  overflow-y: auto;
  flex: 1; min-height: 0;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.nb-state-msg {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 2.5rem 1rem; text-align: center;
  font-size: 0.82rem; color: var(--c-text-3);
}
.nb-spinner {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--c-border); border-top-color: var(--c-accent);
  animation: nb-spin 0.7s linear infinite;
}
@keyframes nb-spin { to { transform: rotate(360deg); } }

.nb-item {
  display: flex; align-items: flex-start; gap: 10px;
  width: 100%; padding: 12px 14px; text-align: left;
  min-height: 56px;
  border-bottom: 1px solid var(--c-border-light);
  transition: background var(--dur);
  position: relative;
}
.nb-item:last-child   { border-bottom: none; }
.nb-item:hover        { background: var(--c-bg); }
.nb-item--unread      { background: color-mix(in oklab, var(--c-accent) 4%, transparent); }
.nb-item--unread:hover{ background: color-mix(in oklab, var(--c-accent) 7%, transparent); }
.nb-item:focus-visible { outline: 2px solid var(--c-accent); outline-offset: -2px; }

.nb-item-icon {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  display: grid; place-items: center; margin-top: 1px;
}
.nb-item-icon--reward  { background: var(--c-green-tint); color: var(--c-green); }
.nb-item-icon--warning { background: var(--c-amber-tint); color: var(--c-amber); }

.nb-item-body   { flex: 1; min-width: 0; padding-right: 16px; }
.nb-item-title  { font-size: 0.82rem; font-weight: 600; color: var(--c-text-1); line-height: 1.35; }
.nb-item-sub    { font-size: 0.76rem; color: var(--c-text-2); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.nb-item-time   { font-size: 0.7rem; color: var(--c-text-3); margin-top: 3px; display: block; }

.nb-unread-dot {
  position: absolute; top: 50%; right: 14px; transform: translateY(-50%);
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--c-accent); flex-shrink: 0;
}

.nb-mobile-backdrop { display: none; }
@media (max-width: 768px) {
  .nb-mobile-backdrop {
    display: block;
    position: fixed; inset: 0; z-index: 399;
    background: rgba(0, 0, 0, 0.45);
  }
}

/* Panel enters via a CSS @keyframes animation triggered on mount. Desktop
   uses a small drop-in; mobile uses a bottom-sheet slide-up. */
.nb-panel--open { animation: nb-panel-in-desktop 200ms cubic-bezier(0.16, 1, 0.3, 1) both; }

@keyframes nb-panel-in-desktop {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)  scale(1); }
}

@media (max-width: 768px) {
  .nb-panel--open { animation: nb-panel-in-mobile 240ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes nb-panel-in-mobile {
    from { opacity: 0; transform: translateY(100%); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

.nb-mobile-backdrop { animation: nb-fade-in 180ms ease both; }
@keyframes nb-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .nb-panel--open,
  .nb-mobile-backdrop { animation-duration: 120ms; animation-timing-function: ease; }
  @keyframes nb-panel-in-desktop { from { opacity: 0; } to { opacity: 1; } }
  @keyframes nb-panel-in-mobile  { from { opacity: 0; } to { opacity: 1; } }
}
</style>
