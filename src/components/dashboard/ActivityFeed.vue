<!--
  ActivityFeed — Scrollable timeline of the latest system actions.

  Props:
    items   – array of activity objects from /dashboard/recent-activities
    loading – show skeleton while fetching

  Each item shape:
    { type, driver_name, driver_id, description, timestamp }

  Supported types:
    trip_completed | trip_started | driver_created |
    driver_updated | driver_blocked | driver_unblocked
-->
<script setup>
import { useRouter } from 'vue-router'
import {
  ActivityIcon,
  CheckCircleIcon,
  TruckIcon,
  UserAddIcon,
  UserIcon,
  UserBlockIcon,
  UserUnblockIcon,
} from '../icons/index.js'

defineProps({
  items:   { type: Array,   default: () => [] },
  loading: { type: Boolean, default: false },
})

const router = useRouter()

// ── Activity type metadata ─────────────────────────────────────────────────
const TYPE_META = {
  trip_completed:   { label: 'Trip completed',    color: 'green',   icon: CheckCircleIcon },
  trip_started:     { label: 'Trip started',      color: 'blue',    icon: TruckIcon },
  driver_created:   { label: 'Driver created',    color: 'blue',    icon: UserAddIcon },
  driver_updated:   { label: 'Driver updated',    color: 'neutral', icon: UserIcon },
  driver_blocked:   { label: 'Driver blocked',    color: 'red',     icon: UserBlockIcon },
  driver_unblocked: { label: 'Driver unblocked',  color: 'green',   icon: UserUnblockIcon },
}

function getMeta(type) {
  return TYPE_META[type] || { label: type, color: 'neutral', icon: ActivityIcon }
}

// ── Relative time ──────────────────────────────────────────────────────────
function timeAgo(iso) {
  if (!iso) return '—'
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
</script>

<template>
  <div class="af-card">
    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="af-hd">
      <div class="af-hd-ico"><ActivityIcon :size="16" /></div>
      <div>
        <p class="af-hd-title">Recent Activity</p>
        <p class="af-hd-sub">Latest system actions</p>
      </div>
    </div>

    <!-- ── Skeleton ───────────────────────────────────────────────────── -->
    <div v-if="loading" class="af-body">
      <div v-for="i in 6" :key="i" class="af-skel-item">
        <div class="af-skel-dot"></div>
        <div class="af-skel-lines">
          <div class="af-skel-line af-skel-line--wide"></div>
          <div class="af-skel-line af-skel-line--narrow"></div>
        </div>
      </div>
    </div>

    <!-- ── Empty ──────────────────────────────────────────────────────── -->
    <div v-else-if="!items.length" class="af-empty">
      <ActivityIcon :size="22" />
      <p>No recent activity to display</p>
    </div>

    <!-- ── Timeline ───────────────────────────────────────────────────── -->
    <div v-else class="af-body">
      <div
        v-for="(item, idx) in items"
        :key="idx"
        class="af-row"
      >
        <!-- Dot + connector line -->
        <div class="af-dot-col">
          <span
            class="af-dot"
            :class="`af-dot--${getMeta(item.type).color}`"
          >
            <component :is="getMeta(item.type).icon" :size="10" />
          </span>
          <span v-if="idx < items.length - 1" class="af-line"></span>
        </div>

        <!-- Content -->
        <div class="af-row-body">
          <div class="af-row-main">
            <span class="af-action">{{ getMeta(item.type).label }}</span>
            <button
              v-if="item.driver_id"
              class="af-driver-link"
              @click="router.push({ name: 'driver-detail', params: { id: item.driver_id } })"
            >{{ item.driver_name }}</button>
            <span v-else-if="item.driver_name" class="af-driver-plain">
              {{ item.driver_name }}
            </span>
          </div>
          <div class="af-row-meta">
            <span v-if="item.description" class="af-desc">{{ item.description }}</span>
            <span class="af-time">{{ timeAgo(item.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell ────────────────────────────────────────────────────────────────── */
.af-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.af-hd {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--c-border); flex-shrink: 0;
}
.af-hd-ico {
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  background: rgba(37,99,235,0.1); color: #2563EB; display: grid; place-items: center;
}
.af-hd-title { font-size: 0.875rem; font-weight: 700; color: var(--c-text); margin: 0 0 2px; }
.af-hd-sub   { font-size: 0.76rem;  color: var(--c-text-2); margin: 0; }

/* ── Scrollable body ──────────────────────────────────────────────────────── */
.af-body {
  overflow-y: auto; max-height: 340px; padding: 0.75rem 1.25rem 0.5rem;
  display: flex; flex-direction: column; gap: 0;
}
.af-body::-webkit-scrollbar { width: 4px; }
.af-body::-webkit-scrollbar-track { background: transparent; }
.af-body::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 2px; }

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
.af-skel-item {
  display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.6rem 0;
}
.af-skel-dot {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  background: var(--c-border); animation: af-pulse 1.4s ease-in-out infinite;
}
.af-skel-lines { display: flex; flex-direction: column; gap: 6px; flex: 1; padding-top: 3px; }
.af-skel-line {
  height: 11px; border-radius: 5px; background: var(--c-border);
  animation: af-pulse 1.4s ease-in-out infinite;
}
.af-skel-line--wide   { width: 75%; }
.af-skel-line--narrow { width: 40%; }
@keyframes af-pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }

/* ── Empty ────────────────────────────────────────────────────────────────── */
.af-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; padding: 2.5rem 1rem; color: var(--c-text-2); font-size: 0.84rem;
}
.af-empty svg { opacity: 0.4; }

/* ── Timeline row ─────────────────────────────────────────────────────────── */
.af-row { display: flex; align-items: flex-start; gap: 0.75rem; }

.af-dot-col {
  display: flex; flex-direction: column; align-items: center;
  flex-shrink: 0; width: 22px;
}
.af-dot {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; margin-top: 3px;
}
.af-dot--green   { background: rgba(5,150,105,0.14);  color: #059669; }
.af-dot--blue    { background: rgba(37,99,235,0.12);  color: #2563EB; }
.af-dot--red     { background: rgba(239,68,68,0.12);  color: #EF4444; }
.af-dot--neutral { background: var(--c-border);       color: var(--c-text-2); }

.af-line {
  flex: 1; width: 1px; background: var(--c-border);
  margin: 4px 0; min-height: 14px;
}

.af-row-body { flex: 1; padding: 4px 0 14px; min-width: 0; }
.af-row-main {
  display: flex; align-items: baseline; gap: 0.35rem; flex-wrap: wrap;
  margin-bottom: 2px;
}
.af-action      { font-size: 0.82rem; font-weight: 600; color: var(--c-text); }
.af-driver-link {
  all: unset; cursor: pointer;
  font-size: 0.82rem; color: #2563EB; font-weight: 500;
}
.af-driver-link:hover { text-decoration: underline; }
.af-driver-plain { font-size: 0.82rem; color: var(--c-text-2); }

.af-row-meta  { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.af-desc      { font-size: 0.76rem; color: var(--c-text-2); }
.af-time      { font-size: 0.72rem; color: var(--c-text-2); opacity: 0.75; white-space: nowrap; }
.af-desc + .af-time::before { content: '·'; margin-right: 0.5rem; }
</style>
