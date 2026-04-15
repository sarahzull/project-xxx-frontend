<!--
  BirthdayCard — Upcoming driver birthdays within the next 7 days.

  Props:
    birthdays – array from /dashboard/birthdays
    loading   – show skeleton while fetching

  Each birthday shape:
    { driver_id, name, birth_date, days_until }
-->
<script setup>
import { useRouter } from 'vue-router'
import { CakeIcon } from '../icons/index.js'

defineProps({
  birthdays: { type: Array,   default: () => [] },
  loading:   { type: Boolean, default: false },
})

const router = useRouter()

function formatDate(iso) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]}`
}

function daysLabel(n) {
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  return `In ${n} days`
}
</script>

<template>
  <!-- Hidden entirely if no birthdays and not loading -->
  <div v-if="loading || birthdays.length" class="bc-card">
    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="bc-hd">
      <div class="bc-hd-ico"><CakeIcon :size="16" /></div>
      <div>
        <p class="bc-hd-title">Upcoming Birthdays</p>
        <p class="bc-hd-sub">Within the next 7 days</p>
      </div>
    </div>

    <!-- ── Skeleton ──────────────────────────────────────────────────── -->
    <div v-if="loading" class="bc-list">
      <div v-for="i in 3" :key="i" class="bc-skel-row">
        <div class="bc-skel-line bc-skel-line--name"></div>
        <div class="bc-skel-line bc-skel-line--date"></div>
      </div>
    </div>

    <!-- ── Birthday rows ─────────────────────────────────────────────── -->
    <div v-else class="bc-list">
      <button
        v-for="b in birthdays"
        :key="b.driver_id"
        class="bc-row"
        @click="router.push({ name: 'driver-detail', params: { id: b.driver_id } })"
      >
        <span class="bc-emoji" aria-hidden="true">🎂</span>
        <span class="bc-name">{{ b.name }}</span>
        <span class="bc-date">{{ formatDate(b.birth_date) }}</span>
        <span
          class="bc-pill"
          :class="b.days_until === 0 ? 'bc-pill--today' : 'bc-pill--soon'"
        >{{ daysLabel(b.days_until) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell ────────────────────────────────────────────────────────────────── */
.bc-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 14px; overflow: hidden;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.bc-hd {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1.25rem; border-bottom: 1px solid var(--c-border);
}
.bc-hd-ico {
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  background: rgba(168,85,247,0.1); color: #A855F7; display: grid; place-items: center;
}
.bc-hd-title { font-size: 0.875rem; font-weight: 700; color: var(--c-text); margin: 0 0 2px; }
.bc-hd-sub   { font-size: 0.76rem;  color: var(--c-text-2); margin: 0; }

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
.bc-skel-row {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.7rem 1.25rem; border-bottom: 1px solid var(--c-border);
}
.bc-skel-row:last-child { border-bottom: none; }
.bc-skel-line {
  height: 11px; border-radius: 5px; background: var(--c-border);
  animation: bc-pulse 1.4s ease-in-out infinite;
}
.bc-skel-line--name { width: 45%; }
.bc-skel-line--date { width: 25%; }
@keyframes bc-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }

/* ── Row ──────────────────────────────────────────────────────────────────── */
.bc-list { display: flex; flex-direction: column; }
.bc-row {
  all: unset; box-sizing: border-box; cursor: pointer; width: 100%;
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.65rem 1.25rem; border-bottom: 1px solid var(--c-border);
  transition: background 0.13s;
}
.bc-row:last-child { border-bottom: none; }
.bc-row:hover      { background: var(--c-hover); }

.bc-emoji { font-size: 1rem; flex-shrink: 0; }
.bc-name  {
  flex: 1; font-size: 0.84rem; font-weight: 500; color: var(--c-text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.bc-date  { font-size: 0.78rem; color: var(--c-text-2); white-space: nowrap; }
.bc-pill  {
  padding: 0.15rem 0.5rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 600; white-space: nowrap;
}
.bc-pill--today { background: rgba(168,85,247,0.12); color: #A855F7; }
.bc-pill--soon  { background: rgba(29,78,216,0.1);   color: #1D4ED8; }
</style>
