<!--
  MySafetyView.vue (driver-self)
  ──────────────────────────────
  Driver's personal safety scorecard. Current STSB grade + 6-month trend,
  breakdown by category, recent events with embedded video, and coaching
  notes the driver can acknowledge.
-->
<script setup>
import { ref, computed, onMounted } from 'vue'
import safetyApi from '../../api/safety'
import { useToast } from '../../composables/useToast'
import { SafetyIcon, CheckCircleIcon, AlertIcon, ShieldAlertIcon } from '../../components/icons/index.js'
import { useSafetyStore } from '../../stores/safety'

const toast = useToast()
const safety = useSafetyStore()

const loading = ref(true)
const data    = ref(null)
const activeEvent = ref(null)

async function load() {
  loading.value = true
  try {
    const res = await safetyApi.myOwn()
    data.value = res?.data?.data || null
    activeEvent.value = data.value?.events?.[0] || null
  } catch {
    toast.error('Could not load your safety data.', { title: 'Load failed' })
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function ackNote(note) {
  try {
    await safetyApi.acknowledgeNote(note.id)
    note.acknowledged_at = new Date().toISOString()
    safety.decrementCoaching(1)  // optimistic — keeps the sidebar badge in sync
    toast.success('Coaching note acknowledged.', { title: 'Acknowledged' })
  } catch {
    toast.error('Failed to acknowledge note.', { title: 'Action failed' })
  }
}

function pickEvent(ev) { activeEvent.value = ev }

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const TYPE_LABELS = {
  hard_brake:           'Hard braking',
  distracted:           'Distracted driving',
  drowsy:               'Drowsy',
  fatigue:              'Fatigue',
  speeding:             'Speeding',
  phone_use:            'Phone use',
  no_seatbelt:          'No seatbelt',
  following_too_close:  'Following too close',
}
function eventTypeLabel(t) { return TYPE_LABELS[t] || t }
const SEVERITY_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High' }
function severityLabel(n) { return SEVERITY_LABELS[n] || n }

const TIPS_BY_TYPE = {
  hard_brake:           'Maintain a 3-second following gap and anticipate traffic — smooth braking reduces risk and wear.',
  distracted:           'Keep eyes on the road. If you must look at something, pull over safely.',
  drowsy:               'Get adequate rest before shifts. If you feel drowsy, pull over and notify dispatch.',
  fatigue:              'Recognize signs of fatigue (yawning, lane drift). Take a 15-minute break every 2 hours.',
  speeding:             'Observe posted speed limits. Schedule pressure does not justify exceeding them.',
  phone_use:            'No phone interaction while moving. Use voice or pull over.',
  no_seatbelt:          'Belt up before the vehicle moves — every time, no exceptions.',
  following_too_close:  'Keep a 3-second gap. Increase to 4–5 seconds in poor weather.',
}
function tipFor(t) { return TIPS_BY_TYPE[t] || 'Review the recording with your supervisor at the next briefing.' }

const byCategoryArr = computed(() => {
  const obj = data.value?.current_scorecard?.by_category || {}
  return Object.entries(obj)
    .map(([k, v]) => ({ key: k, label: eventTypeLabel(k), count: Number(v) || 0 }))
    .filter(x => x.count > 0)
    .sort((a, b) => b.count - a.count)
})

// ── Streak: days since the last severity-3 (high) event ───────────────────
const streakDays = computed(() => {
  const events = data.value?.events || []
  const sev3 = events
    .filter(e => e.severity >= 3)
    .map(e => new Date(e.occurred_at).getTime())
    .filter(t => !isNaN(t))
  if (!sev3.length) return null // never had one — celebrate elsewhere
  const last = Math.max(...sev3)
  return Math.max(0, Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000)))
})

// ── Change vs last month — sets the "↑3" / "↓2" badge tone ────────────────
const monthChange = computed(() => {
  const trend = data.value?.trend || []
  if (trend.length < 2) return null
  const latest = trend[trend.length - 1]
  const prev   = trend[trend.length - 2]
  const diff = (latest?.score || 0) - (prev?.score || 0)
  if (Math.abs(diff) < 0.5) return { delta: 0, dir: 'flat' }
  return { delta: Math.abs(Math.round(diff * 10) / 10), dir: diff > 0 ? 'up' : 'down' }
})

// ── Pending coachings — surface the CTA front-and-centre when any exist ───
const pendingCoachings = computed(() => {
  const out = []
  for (const ev of data.value?.events || []) {
    for (const n of (ev.coaching_notes || [])) {
      if (!n.acknowledged_at) out.push({ note: n, event: ev })
    }
  }
  return out
})

// ── Most-relevant tip type — the worst category in the current scorecard ──
const topTipType = computed(() => byCategoryArr.value[0]?.key || null)
</script>

<template>
  <div class="msv">
    <div class="msv-banner">
      <div class="msv-banner-left">
        <div class="msv-banner-icon"><SafetyIcon :size="20" /></div>
        <div>
          <h1 class="msv-banner-title">My Safety</h1>
          <p class="msv-banner-sub">Your scorecard, recent events, and coaching tips</p>
        </div>
      </div>
    </div>

    <div v-if="loading" class="msv-state"><div class="msv-spinner" /> Loading…</div>

    <template v-else-if="data">
      <!-- Pending coaching CTA — surfaces unacknowledged notes at the top -->
      <div v-if="pendingCoachings.length" class="msv-pending">
        <div class="msv-pending-icon"><ShieldAlertIcon :size="16" /></div>
        <div class="msv-pending-info">
          <p class="msv-pending-title">
            You have {{ pendingCoachings.length }} unacknowledged coaching {{ pendingCoachings.length === 1 ? 'note' : 'notes' }}
          </p>
          <p class="msv-pending-sub">Tap an event below to read &amp; acknowledge — your supervisor is waiting.</p>
        </div>
      </div>

      <div class="msv-hero">
        <div :class="['msv-grade-letter', `msv-grade-letter--${data.current_scorecard?.grade || 'A'}`]">
          {{ data.current_scorecard?.grade || '—' }}
        </div>
        <div class="msv-hero-info">
          <p class="msv-hero-eyebrow">Current STSB score</p>
          <div class="msv-hero-score-row">
            <p class="msv-hero-score">{{ data.current_scorecard?.score ?? '—' }} <span>/ 100</span></p>
            <span
              v-if="monthChange"
              :class="['msv-change', `msv-change--${monthChange.dir}`]"
              :title="`vs last month`"
            >
              <template v-if="monthChange.dir === 'up'">↑ {{ monthChange.delta }}</template>
              <template v-else-if="monthChange.dir === 'down'">↓ {{ monthChange.delta }}</template>
              <template v-else>= flat</template>
              <span class="msv-change-lbl">vs last mo</span>
            </span>
          </div>
          <p class="msv-hero-meta">
            {{ data.current_scorecard?.total_events || 0 }} events ·
            fleet median <strong>{{ data.fleet_median ?? '—' }}</strong>
          </p>
        </div>
        <!-- Streak / clean-record badge -->
        <div class="msv-streak">
          <CheckCircleIcon :size="20" v-if="streakDays === null" />
          <span v-else class="msv-streak-num">{{ streakDays }}</span>
          <span class="msv-streak-lbl">
            {{ streakDays === null ? 'No high-severity events ever — keep it up!'
              : streakDays === 0 ? 'high-severity event today'
              : `day${streakDays === 1 ? '' : 's'} since high severity` }}
          </span>
        </div>

        <div class="msv-trend">
          <p class="msv-section-title">6-month trend</p>
          <div class="msv-trend-bars">
            <div v-for="t in data.trend" :key="`${t.period_year}-${t.period_month}`" class="msv-trend-bar">
              <span class="msv-trend-val">{{ Math.round(t.score) }}</span>
              <span :style="{ height: Math.max(8, (t.score || 0) * 0.7) + 'px' }" :class="`msv-trend-fill--${t.grade}`" />
              <span class="msv-trend-lbl">{{ String(t.period_month).padStart(2, '0') }}/{{ String(t.period_year).slice(2) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Unconditional top tip — keyed off the worst category this month -->
      <div v-if="topTipType" class="msv-toptip">
        <AlertIcon :size="14" />
        <div>
          <p class="msv-toptip-title">Focus this month: {{ eventTypeLabel(topTipType).toLowerCase() }}</p>
          <p class="msv-toptip-body">{{ tipFor(topTipType) }}</p>
        </div>
      </div>

      <div v-if="byCategoryArr.length" class="msv-card">
        <p class="msv-card-title">This month's events by category</p>
        <div class="msv-cat-list">
          <div v-for="row in byCategoryArr" :key="row.key" class="msv-cat-row">
            <AlertIcon :size="13" class="msv-cat-icon" />
            <span class="msv-cat-label">{{ row.label }}</span>
            <span class="msv-cat-count">{{ row.count }}</span>
          </div>
        </div>
      </div>

      <div class="msv-grid">
        <div class="msv-events">
          <p class="msv-card-title">Recent events ({{ data.events.length }})</p>
          <div v-if="!data.events.length" class="msv-empty msv-empty--celebrate">
            <CheckCircleIcon :size="22" />
            <p><strong>Clean slate.</strong> No events recorded — drive on.</p>
          </div>
          <ul class="msv-event-list">
            <li
              v-for="ev in data.events"
              :key="ev.id"
              :class="['msv-event-row', `msv-event-row--sev${ev.severity}`, activeEvent?.id === ev.id && 'msv-event-row--on']"
              @click="pickEvent(ev)"
            >
              <span :class="['msv-sev', `msv-sev--${ev.severity}`]" :title="severityLabel(ev.severity)">{{ ev.severity }}</span>
              <div class="msv-event-info">
                <span class="msv-event-type">{{ eventTypeLabel(ev.event_type) }}</span>
                <span class="msv-event-when">{{ formatDateTime(ev.occurred_at) }}</span>
              </div>
              <span
                v-if="ev.coaching_notes?.length && !ev.coaching_notes.every(n => n.acknowledged_at)"
                class="msv-pending-dot"
                title="Coaching note awaiting your acknowledgement"
              />
              <CheckCircleIcon
                v-else-if="ev.coaching_notes?.length"
                :size="14" class="msv-ack-tick"
              />
            </li>
          </ul>
        </div>

        <div v-if="activeEvent" class="msv-event-panel">
          <p class="msv-card-title">{{ eventTypeLabel(activeEvent.event_type) }}</p>
          <div class="msv-event-meta-row">
            <span class="msv-meta-chip">{{ formatDateTime(activeEvent.occurred_at) }}</span>
            <span :class="['msv-meta-chip', `msv-sev-chip--${activeEvent.severity}`]">
              Severity {{ severityLabel(activeEvent.severity) }}
            </span>
            <span v-if="activeEvent.location" class="msv-meta-chip">{{ activeEvent.location }}</span>
          </div>

          <div :class="['msv-video', `msv-video--sev${activeEvent.severity}`]">
            <span class="msv-video-overlay">
              <span class="msv-video-sev">SEV {{ activeEvent.severity }} · {{ severityLabel(activeEvent.severity).toUpperCase() }}</span>
              <span class="msv-video-rec">● REC</span>
            </span>
            <video v-if="activeEvent.video_url" controls :src="activeEvent.video_url" />
            <div v-else class="msv-video-empty">
              <ShieldAlertIcon :size="20" />
              <p>Footage not yet attached</p>
            </div>
          </div>

          <div class="msv-tip">
            <AlertIcon :size="13" />
            <span>{{ tipFor(activeEvent.event_type) }}</span>
          </div>

          <div v-if="activeEvent.coaching_notes?.length" class="msv-notes">
            <p class="msv-section-title">Coaching from your supervisor</p>
            <div v-for="n in activeEvent.coaching_notes" :key="n.id" class="msv-note">
              <p class="msv-note-meta"><strong>{{ n.admin_name || 'Admin' }}</strong> · {{ formatDateTime(n.created_at) }}</p>
              <p class="msv-note-body">{{ n.note }}</p>
              <div class="msv-note-actions">
                <span v-if="n.acknowledged_at" class="msv-note-ack">
                  <CheckCircleIcon :size="11" /> Acknowledged {{ formatDateTime(n.acknowledged_at) }}
                </span>
                <button v-else class="msv-btn msv-btn--primary" @click="ackNote(n)">Acknowledge</button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="msv-event-panel msv-event-panel--empty">
          <p class="msv-empty">Select an event on the left to review the recording and tip.</p>
        </div>
      </div>
    </template>

    <div v-else class="msv-state">
      <p>No safety data yet. Once telematics records your trips, your scorecard will show here.</p>
    </div>
  </div>
</template>

<style scoped>
.msv { display: flex; flex-direction: column; gap: 16px; }

.msv-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; position: relative; overflow: hidden;
}
.msv-banner::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #16A34A; border-radius: var(--r-xl) var(--r-xl) 0 0; }
.msv-banner-left { display: flex; align-items: center; gap: 12px; }
.msv-banner-icon { width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0; background: rgba(22,163,74,0.12); color: #16A34A; display: grid; place-items: center; }
.msv-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); }
.msv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.msv-state { display: flex; align-items: center; gap: 10px; padding: 32px; color: var(--c-text-3); }
.msv-spinner { width: 18px; height: 18px; border: 2px solid var(--c-border); border-top-color: #16A34A; border-radius: 50%; animation: msv-spin 0.7s linear infinite; }
@keyframes msv-spin { to { transform: rotate(360deg); } }
.msv-empty { color: var(--c-text-3); font-size: 0.875rem; padding: 12px 4px; }

/* Pending coaching CTA — sits above the hero so the driver can't miss it.
   Uses a tinted card + iconic badge, no side-tab. */
.msv-pending {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-radius: 12px;
  background: rgba(220,38,38,0.07);
  border: 1px solid rgba(220,38,38,0.28);
}
.msv-pending-icon {
  width: 38px; height: 38px; border-radius: 50%;
  background: rgba(220,38,38,0.18); color: #DC2626;
  display: grid; place-items: center; flex-shrink: 0;
  position: relative;
}
.msv-pending-icon::after {
  content: ''; position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid rgba(220,38,38,0.35);
  animation: msv-pending-ping 2s ease-out infinite;
}
@keyframes msv-pending-ping {
  0%   { transform: scale(0.85); opacity: 0.9; }
  100% { transform: scale(1.15); opacity: 0; }
}
.msv-pending-info { display: flex; flex-direction: column; gap: 2px; }
.msv-pending-title { font-size: 0.92rem; font-weight: 700; color: var(--c-text-1); }
.msv-pending-sub   { font-size: 0.78rem; color: var(--c-text-2); }

.msv-hero {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  grid-template-areas:
    "letter info streak trend"
    "letter info streak trend";
  gap: 18px;
  align-items: center;
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
  padding: 18px 22px;
}
.msv-grade-letter { grid-area: letter; }
.msv-hero-info    { grid-area: info; }
.msv-streak       { grid-area: streak; }
.msv-trend        { grid-area: trend; }
.msv-grade-letter { width: 88px; height: 88px; border-radius: 16px; display: grid; place-items: center; font-size: 2.6rem; font-weight: 800; }
.msv-grade-letter--A { background: rgba(22,163,74,0.15); color: #16A34A; }
.msv-grade-letter--B { background: rgba(217,119,6,0.15); color: #D97706; }
.msv-grade-letter--C { background: rgba(220,38,38,0.15); color: #DC2626; }
.msv-hero-eyebrow { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); }
.msv-hero-score-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.msv-hero-score { font-size: 2rem; font-weight: 800; color: var(--c-text-1); margin: 2px 0; line-height: 1; }
.msv-hero-score span { font-size: 0.85rem; font-weight: 600; color: var(--c-text-3); }
.msv-hero-meta { font-size: 0.82rem; color: var(--c-text-3); margin-top: 4px; }
.msv-hero-meta strong { color: var(--c-text-2); }

/* Change-vs-last-month badge */
.msv-change {
  display: inline-flex; align-items: baseline; gap: 5px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 0.85rem; font-weight: 800; font-variant-numeric: tabular-nums;
}
.msv-change-lbl { font-size: 0.62rem; font-weight: 700; opacity: 0.7; letter-spacing: 0.05em; text-transform: uppercase; }
.msv-change--up   { background: rgba(22,163,74,0.12); color: #16A34A; }
.msv-change--down { background: rgba(220,38,38,0.12); color: #DC2626; }
.msv-change--flat { background: var(--c-bg); color: var(--c-text-3); }

/* Streak badge */
.msv-streak {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; min-width: 96px;
  padding: 12px 14px; border-radius: 12px;
  background: rgba(22,163,74,0.06); border: 1px solid rgba(22,163,74,0.25);
  color: #16A34A; text-align: center;
}
.msv-streak svg { color: #16A34A; }
.msv-streak-num { font-size: 1.5rem; font-weight: 900; line-height: 1; color: #16A34A; font-variant-numeric: tabular-nums; }
.msv-streak-lbl { font-size: 0.64rem; font-weight: 700; letter-spacing: 0.04em; color: #16A34A; line-height: 1.25; }

/* Top tip — unconditional, keyed off worst category. Tinted card + icon
   badge instead of side-tab. */
.msv-toptip {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 14px 16px; border-radius: 12px;
  background: rgba(217,119,6,0.06);
  border: 1px solid rgba(217,119,6,0.22);
}
.msv-toptip > svg {
  flex-shrink: 0;
  width: 28px; height: 28px;
  padding: 6px;
  background: rgba(217,119,6,0.16); color: #D97706;
  border-radius: 50%;
}
.msv-toptip-title { font-size: 0.86rem; font-weight: 700; color: var(--c-text-1); text-transform: capitalize; }
.msv-toptip-body  { font-size: 0.82rem; color: var(--c-text-2); margin-top: 3px; line-height: 1.45; }

.msv-trend { display: flex; flex-direction: column; gap: 6px; min-width: 220px; }
.msv-section-title { font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); }
.msv-trend-bars { display: flex; align-items: flex-end; gap: 6px; height: 90px; }
.msv-trend-bar { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.msv-trend-val { font-size: 0.62rem; color: var(--c-text-3); font-variant-numeric: tabular-nums; }
.msv-trend-bar > span:nth-child(2) { width: 100%; max-width: 24px; min-height: 8px; border-radius: 3px 3px 0 0; background: var(--c-border); }
.msv-trend-fill--A { background: #16A34A !important; }
.msv-trend-fill--B { background: #D97706 !important; }
.msv-trend-fill--C { background: #DC2626 !important; }
.msv-trend-lbl { font-size: 0.6rem; color: var(--c-text-3); font-variant-numeric: tabular-nums; }

@media (max-width: 880px) {
  .msv-hero {
    grid-template-columns: auto 1fr;
    grid-template-areas:
      "letter info"
      "streak streak"
      "trend  trend";
  }
  .msv-streak { width: 100%; flex-direction: row; gap: 10px; min-width: 0; }
  .msv-trend  { min-width: 0; }
}

.msv-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px; padding: 14px 18px; }
.msv-card-title { font-size: 0.95rem; font-weight: 700; color: var(--c-text-1); margin-bottom: 12px; }

.msv-cat-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; }
.msv-cat-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 9px; background: var(--c-bg); border: 1px solid var(--c-border-light); }
.msv-cat-icon { color: #D97706; }
.msv-cat-label { font-size: 0.875rem; font-weight: 600; color: var(--c-text-1); }
.msv-cat-count { font-weight: 800; font-variant-numeric: tabular-nums; padding: 2px 10px; border-radius: 999px; background: rgba(217,119,6,0.12); color: #D97706; }

.msv-grid { display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 16px; }
@media (max-width: 720px) { .msv-grid { grid-template-columns: 1fr; } }

.msv-events { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px; padding: 14px 18px; max-height: 460px; overflow-y: auto; }
.msv-event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.msv-event-row { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px 8px 12px; border-radius: 7px; cursor: pointer; transition: background var(--dur); border-left: 3px solid transparent; }
.msv-event-row:hover { background: var(--c-hover); }
.msv-event-row--on   { background: rgba(22,163,74,0.08); }
.msv-event-row--sev1 { border-left-color: rgba(22,163,74,0.4); }
.msv-event-row--sev2 { border-left-color: rgba(217,119,6,0.55); }
.msv-event-row--sev3 { border-left-color: #DC2626; background: rgba(220,38,38,0.04); }
.msv-event-row--sev3:hover { background: rgba(220,38,38,0.09); }
.msv-pending-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #DC2626;
  box-shadow: 0 0 0 0 rgba(220,38,38,0.55);
  animation: sv-pulse 1.6s ease-out infinite;
}
@keyframes sv-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.55); }
  70%  { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
  100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
}
.msv-sev { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; font-weight: 800; font-size: 0.85rem; }
.msv-sev--1 { background: rgba(22,163,74,0.12); color: #16A34A; }
.msv-sev--2 { background: rgba(217,119,6,0.12); color: #D97706; }
.msv-sev--3 { background: rgba(220,38,38,0.15); color: #DC2626; }
.msv-event-info { display: flex; flex-direction: column; min-width: 0; }
.msv-event-type { font-size: 0.875rem; font-weight: 600; color: var(--c-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.msv-event-when { font-size: 0.72rem; color: var(--c-text-3); }
.msv-ack-tick { color: #16A34A; }

.msv-event-panel { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px; padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; }
.msv-event-panel--empty { display: grid; place-items: center; min-height: 200px; }

.msv-event-meta-row { display: flex; flex-wrap: wrap; gap: 6px; }
.msv-meta-chip { font-size: 0.7rem; font-weight: 600; color: var(--c-text-2); padding: 2px 8px; border-radius: 999px; background: var(--c-bg); border: 1px solid var(--c-border-light); }
.msv-sev-chip--1 { color: #16A34A !important; border-color: rgba(22,163,74,0.3) !important; background: rgba(22,163,74,0.06) !important; }
.msv-sev-chip--2 { color: #D97706 !important; border-color: rgba(217,119,6,0.3) !important; background: rgba(217,119,6,0.06) !important; }
.msv-sev-chip--3 { color: #DC2626 !important; border-color: rgba(220,38,38,0.3) !important; background: rgba(220,38,38,0.06) !important; }

.msv-video {
  position: relative;
  background: oklch(14% 0.012 250);
  border-radius: 10px; overflow: hidden;
  border: 1px solid var(--c-border);
}
.msv-video--sev2 { border-color: rgba(217,119,6,0.35); }
.msv-video--sev3 { border-color: rgba(220,38,38,0.45); box-shadow: 0 0 0 1px rgba(220,38,38,0.15); }
.msv-video video { width: 100%; max-height: 280px; background: oklch(10% 0.012 250); display: block; }

.msv-video-overlay {
  position: absolute; top: 10px; left: 10px; right: 10px; z-index: 2;
  display: flex; justify-content: space-between; align-items: center;
  pointer-events: none;
}
.msv-video-sev {
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.07em;
  padding: 3px 9px; border-radius: 4px;
  background: rgba(15,23,42,0.85); color: #fff;
}
.msv-video-rec {
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; color: #fff;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 4px;
  background: rgba(15,23,42,0.85);
}
.msv-video-rec::before {
  content: '●'; color: #DC2626;
  animation: msv-rec-blink 1.4s ease-in-out infinite;
}
@keyframes msv-rec-blink {
  0%, 50% { opacity: 1; }
  60%, 100% { opacity: 0.25; }
}

.msv-video-empty {
  padding: 38px 16px; text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  color: #94A3B8; font-size: 0.9rem; font-weight: 600;
}
.msv-video-empty svg { color: #475569; }

/* Celebratory empty state for "no events yet" */
.msv-empty--celebrate {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 28px 16px; text-align: center;
  background: rgba(22,163,74,0.06); border: 1px dashed rgba(22,163,74,0.35);
  border-radius: 10px; color: var(--c-text-2);
}
.msv-empty--celebrate svg { color: #16A34A; }
.msv-empty--celebrate strong { color: #16A34A; }

.msv-tip { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 8px; background: rgba(217,119,6,0.06); border: 1px solid rgba(217,119,6,0.25); color: var(--c-text-1); font-size: 0.85rem; line-height: 1.45; }
.msv-tip svg { color: #D97706; margin-top: 2px; flex-shrink: 0; }

.msv-notes { display: flex; flex-direction: column; gap: 8px; }
.msv-note { padding: 10px 12px; background: var(--c-bg); border: 1px solid var(--c-border-light); border-radius: 8px; }
.msv-note-meta { font-size: 0.72rem; color: var(--c-text-3); }
.msv-note-meta strong { color: var(--c-text-2); }
.msv-note-body { font-size: 0.875rem; color: var(--c-text-1); margin: 6px 0; line-height: 1.5; }
.msv-note-actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
.msv-note-ack { display: inline-flex; align-items: center; gap: 4px; font-size: 0.74rem; color: #16A34A; font-weight: 600; }

.msv-btn { padding: 6px 12px; border-radius: 7px; border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text-2); font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all var(--dur); }
.msv-btn--primary { background: #16A34A; color: #fff; border-color: #16A34A; }
.msv-btn--primary:hover { background: #15803D; border-color: #15803D; }
</style>
