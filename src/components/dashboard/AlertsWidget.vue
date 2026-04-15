<!--
  AlertsWidget — Today's priority alerts banner.

  Props:
    data    – { license_expiring, blocked_assigned, incomplete_trips }
    loading – show skeleton while fetching

  Behaviour:
    • All-clear green bar when no alerts
    • Red/amber rows with count, description and click-to-route when alerts exist
    • Each row routes to the relevant page
-->
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  AlertIcon,
  IdCardIcon,
  UserBlockIcon,
  TruckIcon,
  CheckCircleIcon,
  ChevronRightIcon,
} from '../icons/index.js'

const props = defineProps({
  data:    { type: Object,  default: () => null },
  loading: { type: Boolean, default: false },
})

const router = useRouter()

const alertItems = computed(() => {
  if (!props.data) return []
  const d   = props.data
  const list = []

  if ((d.license_expiring || 0) > 0) {
    list.push({
      key:      'license',
      icon:     IdCardIcon,
      count:    d.license_expiring,
      label:    `driver license${d.license_expiring !== 1 ? 's' : ''} expiring within 7 days`,
      severity: 'critical',
      route:    { name: 'drivers' },
    })
  }
  if ((d.blocked_assigned || 0) > 0) {
    list.push({
      key:      'blocked',
      icon:     UserBlockIcon,
      count:    d.blocked_assigned,
      label:    `blocked driver${d.blocked_assigned !== 1 ? 's' : ''} still assigned to active trips`,
      severity: 'critical',
      route:    { name: 'drivers' },
    })
  }
  if ((d.incomplete_trips || 0) > 0) {
    list.push({
      key:      'trips',
      icon:     TruckIcon,
      count:    d.incomplete_trips,
      label:    `trip${d.incomplete_trips !== 1 ? 's' : ''} not completed today`,
      severity: 'warning',
      route:    { name: 'trips' },
    })
  }
  return list
})

const totalAlerts = computed(() =>
  alertItems.value.reduce((sum, a) => sum + a.count, 0)
)
</script>

<template>
  <!-- ── Skeleton ─────────────────────────────────────────────────────────── -->
  <div v-if="loading" class="aw-skeleton" aria-label="Loading alerts">
    <div class="aw-skel-ico"></div>
    <div class="aw-skel-body">
      <div class="aw-skel-line aw-skel-line--title"></div>
      <div class="aw-skel-line aw-skel-line--sub"></div>
    </div>
  </div>

  <!-- ── All clear ──────────────────────────────────────────────────────── -->
  <div v-else-if="!alertItems.length" class="aw-clear">
    <div class="aw-clear-ico"><CheckCircleIcon :size="17" /></div>
    <div class="aw-clear-body">
      <span class="aw-clear-title">All Clear</span>
      <span class="aw-clear-sep">—</span>
      <span class="aw-clear-sub">No urgent items require your attention today.</span>
    </div>
  </div>

  <!-- ── Has alerts ─────────────────────────────────────────────────────── -->
  <div v-else class="aw-card" role="alert">
    <div class="aw-hd">
      <div class="aw-hd-left">
        <div class="aw-hd-ico"><AlertIcon :size="16" /></div>
        <span class="aw-hd-title">Today's Alerts</span>
        <span class="aw-hd-sub">{{ totalAlerts }} item{{ totalAlerts !== 1 ? 's' : '' }} need attention</span>
      </div>
      <span class="aw-total-pill">{{ totalAlerts }}</span>
    </div>

    <div class="aw-list">
      <button
        v-for="item in alertItems"
        :key="item.key"
        class="aw-item"
        :class="`aw-item--${item.severity}`"
        @click="router.push(item.route)"
      >
        <span class="aw-item-ico" :class="`aw-item-ico--${item.severity}`">
          <component :is="item.icon" :size="14" />
        </span>
        <span class="aw-item-label">
          <strong class="aw-item-num">{{ item.count }}</strong> {{ item.label }}
        </span>
        <ChevronRightIcon :size="14" class="aw-item-arrow" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── Skeleton ─────────────────────────────────────────────────────────────── */
.aw-skeleton {
  display: flex; align-items: center; gap: 1rem;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px; padding: 1.1rem 1.5rem;
}
.aw-skel-ico {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: var(--c-border); animation: aw-pulse 1.4s ease-in-out infinite;
}
.aw-skel-body { display: flex; flex-direction: column; gap: 7px; flex: 1; }
.aw-skel-line {
  border-radius: 5px; background: var(--c-border);
  animation: aw-pulse 1.4s ease-in-out infinite;
}
.aw-skel-line--title { height: 13px; width: 28%; }
.aw-skel-line--sub   { height: 11px; width: 52%; }
@keyframes aw-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

/* ── All clear ────────────────────────────────────────────────────────────── */
.aw-clear {
  display: flex; align-items: center; gap: 0.875rem;
  background: rgba(22,163,74,0.06); border: 1px solid rgba(22,163,74,0.2);
  border-radius: 12px; padding: 1rem 1.5rem;
}
.aw-clear-ico {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  background: rgba(22,163,74,0.12); color: #16A34A;
  display: grid; place-items: center;
}
.aw-clear-body { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 0.4rem; }
.aw-clear-title { font-size: 0.875rem; font-weight: 700; color: #16A34A; }
.aw-clear-sep   { font-size: 0.875rem; color: var(--c-text-2); }
.aw-clear-sub   { font-size: 0.84rem;  color: var(--c-text-2); }

/* ── Alert card ───────────────────────────────────────────────────────────── */
.aw-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px; overflow: hidden;
}
.aw-hd {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 0.9rem 1.5rem; border-bottom: 1px solid var(--c-border);
}
.aw-hd-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
.aw-hd-ico {
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  background: rgba(239,68,68,0.1); color: #EF4444; display: grid; place-items: center;
}
.aw-hd-title { font-size: 0.875rem; font-weight: 700; color: var(--c-text); white-space: nowrap; }
.aw-hd-sub   { font-size: 0.8rem;   color: var(--c-text-2); }
.aw-total-pill {
  background: #EF4444; color: #fff; font-size: 0.7rem; font-weight: 700;
  padding: 0.15rem 0.55rem; border-radius: 999px; flex-shrink: 0;
}

/* ── Alert rows ───────────────────────────────────────────────────────────── */
.aw-list { display: flex; flex-direction: column; }
.aw-item {
  all: unset; box-sizing: border-box; cursor: pointer;
  display: flex; align-items: center; gap: 0.875rem; width: 100%;
  padding: 0.8rem 1.5rem; border-bottom: 1px solid var(--c-border);
  transition: background 0.13s;
}
.aw-item:last-child { border-bottom: none; }
.aw-item:hover      { background: var(--c-hover); }
.aw-item--critical  { border-left: 3px solid #EF4444; }
.aw-item--warning   { border-left: 3px solid #F59E0B; }

.aw-item-ico {
  width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0;
  display: grid; place-items: center;
}
.aw-item-ico--critical { background: rgba(239,68,68,0.1);  color: #EF4444; }
.aw-item-ico--warning  { background: rgba(245,158,11,0.1); color: #D97706; }

.aw-item-label { flex: 1; font-size: 0.84rem; color: var(--c-text); line-height: 1.4; }
.aw-item-num   { font-weight: 700; }
.aw-item-arrow { color: var(--c-text-2); flex-shrink: 0; }

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .aw-hd-sub { display: none; }
}
</style>
