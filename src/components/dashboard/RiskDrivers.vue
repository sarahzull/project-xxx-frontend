<!--
  RiskDrivers — Compact list of drivers flagged for attention.

  Props:
    drivers – array from /dashboard/risk-drivers
    loading – show skeleton while fetching

  Each driver shape:
    { driver_id, name, risks: ['license_expiring', 'rank_c', 'incomplete_trips'], license_expiry }
-->
<script setup>
import { useRouter } from 'vue-router'
import {
  ShieldAlertIcon,
  IdCardIcon,
  TrendingDownIcon,
  TruckIcon,
  ChevronRightIcon,
} from '../icons/index.js'

defineProps({
  drivers: { type: Array,   default: () => [] },
  loading: { type: Boolean, default: false },
})

const router = useRouter()

// ── Risk type metadata ─────────────────────────────────────────────────────
const RISK_META = {
  license_expiring: { label: 'License Expiring', color: 'red',    icon: IdCardIcon },
  rank_c:           { label: 'Low Performance',  color: 'orange', icon: TrendingDownIcon },
  incomplete_trips: { label: 'Missed Trips',     color: 'yellow', icon: TruckIcon },
}

function getRisk(key) {
  return RISK_META[key] || { label: key, color: 'neutral', icon: ShieldAlertIcon }
}
</script>

<template>
  <div class="rd-card">
    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="rd-hd">
      <div class="rd-hd-ico"><ShieldAlertIcon :size="16" /></div>
      <div>
        <p class="rd-hd-title">Top Risk Drivers</p>
        <p class="rd-hd-sub">Drivers requiring immediate attention</p>
      </div>
    </div>

    <!-- ── Skeleton ───────────────────────────────────────────────────── -->
    <div v-if="loading" class="rd-list">
      <div v-for="i in 5" :key="i" class="rd-skel-row">
        <div class="rd-skel-avatar"></div>
        <div class="rd-skel-lines">
          <div class="rd-skel-line rd-skel-line--name"></div>
          <div class="rd-skel-line rd-skel-line--badge"></div>
        </div>
      </div>
    </div>

    <!-- ── Empty ──────────────────────────────────────────────────────── -->
    <div v-else-if="!drivers.length" class="rd-empty">
      <ShieldAlertIcon :size="22" />
      <p>No risk drivers identified</p>
    </div>

    <!-- ── Driver rows ────────────────────────────────────────────────── -->
    <div v-else class="rd-list">
      <button
        v-for="driver in drivers"
        :key="driver.driver_id"
        class="rd-row"
        @click="router.push({ name: 'driver-detail', params: { id: driver.driver_id } })"
      >
        <!-- Avatar -->
        <span class="rd-avatar" aria-hidden="true">
          {{ driver.name?.charAt(0)?.toUpperCase() || '?' }}
        </span>

        <!-- Info -->
        <div class="rd-info">
          <span class="rd-name">{{ driver.name }}</span>
          <span class="rd-id">{{ driver.driver_id }}</span>
        </div>

        <!-- Risk badges -->
        <div class="rd-badges">
          <span
            v-for="risk in driver.risks"
            :key="risk"
            class="rd-badge"
            :class="`rd-badge--${getRisk(risk).color}`"
          >
            <component :is="getRisk(risk).icon" :size="10" />
            {{ getRisk(risk).label }}
          </span>
        </div>

        <ChevronRightIcon :size="14" class="rd-arrow" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell ────────────────────────────────────────────────────────────────── */
.rd-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; overflow: hidden; display: flex; flex-direction: column;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.rd-hd {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--c-border); flex-shrink: 0;
}
.rd-hd-ico {
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  background: rgba(239,68,68,0.1); color: #EF4444; display: grid; place-items: center;
}
.rd-hd-title { font-size: 0.875rem; font-weight: 700; color: var(--c-text); margin: 0 0 2px; }
.rd-hd-sub   { font-size: 0.76rem;  color: var(--c-text-2); margin: 0; }

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
.rd-skel-row {
  display: flex; align-items: center; gap: 0.875rem;
  padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--c-border);
}
.rd-skel-row:last-child { border-bottom: none; }
.rd-skel-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: var(--c-border); animation: rd-pulse 1.4s ease-in-out infinite;
}
.rd-skel-lines { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.rd-skel-line {
  height: 11px; border-radius: 5px; background: var(--c-border);
  animation: rd-pulse 1.4s ease-in-out infinite;
}
.rd-skel-line--name  { width: 55%; }
.rd-skel-line--badge { width: 35%; }
@keyframes rd-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

/* ── Empty ────────────────────────────────────────────────────────────────── */
.rd-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; padding: 2.5rem 1rem; color: var(--c-text-2); font-size: 0.84rem;
}
.rd-empty svg { opacity: 0.4; }

/* ── Driver list ──────────────────────────────────────────────────────────── */
.rd-list { overflow-y: auto; max-height: 340px; }
.rd-list::-webkit-scrollbar { width: 4px; }
.rd-list::-webkit-scrollbar-thumb { background: var(--c-border); border-radius: 2px; }

.rd-row {
  all: unset; box-sizing: border-box; cursor: pointer; width: 100%;
  display: flex; align-items: center; gap: 0.875rem;
  padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--c-border);
  transition: background 0.13s;
}
.rd-row:last-child { border-bottom: none; }
.rd-row:hover      { background: var(--c-hover); }

/* Avatar */
.rd-avatar {
  width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
  background: rgba(29,78,216,0.1); color: #1D4ED8;
  font-size: 0.8rem; font-weight: 700;
  display: grid; place-items: center;
}

/* Info */
.rd-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.rd-name { font-size: 0.84rem; font-weight: 600; color: var(--c-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-id   { font-size: 0.72rem; color: var(--c-text-2); font-family: monospace; }

/* Risk badges */
.rd-badges {
  display: flex; flex-wrap: wrap; gap: 0.3rem; flex: 1;
  justify-content: flex-end;
}
.rd-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 0.2rem 0.5rem; border-radius: 5px;
  font-size: 0.7rem; font-weight: 600; white-space: nowrap;
}
.rd-badge--red    { background: rgba(239,68,68,0.1);   color: #EF4444; }
.rd-badge--orange { background: rgba(249,115,22,0.1);  color: #F97316; }
.rd-badge--yellow { background: rgba(245,158,11,0.1);  color: #D97706; }
.rd-badge--neutral{ background: var(--c-border);       color: var(--c-text-2); }

.rd-arrow { color: var(--c-text-2); flex-shrink: 0; }

/* ── Responsive ───────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .rd-badges { display: none; }
}
</style>
