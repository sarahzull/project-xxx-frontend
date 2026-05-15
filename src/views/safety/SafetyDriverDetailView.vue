<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import safetyApi from '../../api/safety'
import { useBasesStore } from '../../stores/bases'
import { useToast } from '../../composables/useToast'
import {
  ChevronLeftIcon, AlertIcon, CheckCircleIcon, ShieldAlertIcon,
} from '../../components/icons/index.js'

const props = defineProps({
  driverId: { type: [String, Number], required: true },
})

const route       = useRoute()
const router      = useRouter()
const toast       = useToast()
const basesStore  = useBasesStore()

function defaultPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const period = ref(route.query.period || defaultPeriod())

const detailLoading = ref(true)
const detail        = ref(null)
const activeEvent   = ref(null)
const coachNote     = ref('')
const coachSaving   = ref(false)

async function loadDriver() {
  detailLoading.value = true
  detail.value = null
  activeEvent.value = null
  try {
    const { data } = await safetyApi.driver(props.driverId, { period: period.value })
    detail.value = data?.data || null
  } catch {
    toast.error('Could not load driver detail.', { title: 'Load failed' })
    router.replace({ name: 'safety' })
  } finally {
    detailLoading.value = false
  }
}

onMounted(() => { loadDriver(); basesStore.ensureLoaded() })
watch(() => props.driverId, loadDriver)

function pickEvent(ev) {
  activeEvent.value = ev
  coachNote.value   = ''
}

async function markReviewed(ev) {
  try {
    const { data } = await safetyApi.review(ev.id)
    Object.assign(ev, data?.data || {})
    toast.success('Event marked reviewed.', { title: 'Reviewed' })
  } catch {
    toast.error('Failed to update event.', { title: 'Action failed' })
  }
}

async function submitCoach(ev) {
  if (!coachNote.value.trim()) {
    toast.warning('Write a brief coaching note before saving.', { title: 'Note required' })
    return
  }
  coachSaving.value = true
  try {
    const { data } = await safetyApi.coach(ev.id, coachNote.value.trim())
    Object.assign(ev, data?.data?.event || {})
    coachNote.value = ''
    toast.success('Coaching note saved.', { title: 'Coached' })
  } catch {
    toast.error('Failed to save coaching note.', { title: 'Action failed' })
  } finally {
    coachSaving.value = false
  }
}

function back() {
  router.push({ name: 'safety' })
}

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
  hard_brake: 'Hard braking', distracted: 'Distracted driving',
  drowsy: 'Drowsy', fatigue: 'Fatigue', speeding: 'Speeding',
  phone_use: 'Phone use', no_seatbelt: 'No seatbelt',
  following_too_close: 'Following too close',
}
function eventTypeLabel(t) { return TYPE_LABELS[t] || t }
const SEVERITY_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High' }
function severityLabel(n) { return SEVERITY_LABELS[n] || n }

// Demo sample clips (Google's public sample-videos bucket). Used when the
// backend has no real dashcam footage yet so the player isn't black/silent.
const SAMPLE_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
]
function sampleVideoFor(ev) {
  if (!ev) return SAMPLE_VIDEOS[0]
  const key = Number(ev.id) || 0
  return SAMPLE_VIDEOS[key % SAMPLE_VIDEOS.length]
}
const STATUS_LABELS = { pending: 'New', reviewed: 'Reviewed', coached: 'Coached' }

function diagnosis(events) {
  if (!events?.length) return ''
  const byType = {}
  events.forEach(e => { byType[e.event_type] = (byType[e.event_type] || 0) + 1 })
  const top = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]
  if (!top) return ''
  const [type, count] = top
  const typeLabel = eventTypeLabel(type).toLowerCase()
  const hours = events
    .filter(e => e.event_type === type)
    .map(e => new Date(e.occurred_at).getHours())
    .filter(h => !isNaN(h))
  let timeHint = ''
  if (hours.length >= 3) {
    const buckets = { 'early morning (00–06)': 0, 'morning (06–12)': 0, 'afternoon (12–18)': 0, 'evening (18–24)': 0 }
    hours.forEach(h => {
      if (h < 6) buckets['early morning (00–06)']++
      else if (h < 12) buckets['morning (06–12)']++
      else if (h < 18) buckets['afternoon (12–18)']++
      else buckets['evening (18–24)']++
    })
    const top2 = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
    if (top2 && top2[1] >= Math.ceil(hours.length / 2)) timeHint = ` Most occur during the ${top2[0]}.`
  }
  return `${count} ${typeLabel} event${count > 1 ? 's' : ''} this period.${timeHint}`
}
</script>

<template>
  <div class="sdd">

    <div class="sdd-topbar">
      <button type="button" class="sdd-back" @click="back">
        <ChevronLeftIcon :size="16" />
        <span>Safety</span>
      </button>
      <div v-if="detail?.driver" class="sdd-title-block">
        <h1 class="sdd-title">{{ detail.driver.name || 'Driver detail' }}</h1>
        <p class="sdd-sub">{{ detail.driver.driver_id }}<span v-if="detail.driver.base"> · <span v-tooltip="basesStore.tooltipOf(detail.driver.base)">{{ detail.driver.base }}</span></span></p>
      </div>
    </div>

    <div v-if="detailLoading" class="sv-state"><div class="sv-spinner" /> Loading driver…</div>

    <div v-else-if="detail" class="sv-detail sdd-card">
      <div class="sv-detail-grade">
        <div :class="['sv-detail-letter', `sv-grade-pill--${detail.current_scorecard?.grade || 'A'}`]">
          {{ detail.current_scorecard?.grade || '—' }}
        </div>
        <div class="sv-detail-grade-info">
          <p class="sv-detail-score">{{ detail.current_scorecard?.score ?? '—' }} <span>/ 100</span></p>
          <p class="sv-detail-meta">
            {{ detail.current_scorecard?.total_events || 0 }} events ·
            fleet median {{ detail.fleet_median ?? '—' }}
          </p>
        </div>
        <div class="sv-trend">
          <div v-for="t in detail.trend" :key="`${t.period_year}-${t.period_month}`" class="sv-trend-bar">
            <span :style="{ height: Math.max(6, (t.score || 0) * 0.7) + 'px' }" :class="`sv-trend-bar--${t.grade}`" />
            <span class="sv-trend-lbl">{{ String(t.period_month).padStart(2, '0') }}/{{ String(t.period_year).slice(2) }}</span>
          </div>
        </div>
      </div>

      <p v-if="diagnosis(detail.events)" class="sv-diagnosis">
        <AlertIcon :size="13" />
        {{ diagnosis(detail.events) }}
      </p>

      <div class="sv-detail-grid">
        <div class="sv-events">
          <p class="sv-section-title">Events ({{ detail.events.length }})</p>
          <div v-if="!detail.events.length" class="sv-empty">No events for this driver.</div>
          <ul class="sv-event-list">
            <li
              v-for="ev in detail.events"
              :key="ev.id"
              :class="['sv-event-row', `sv-event-row--sev${ev.severity}`, activeEvent?.id === ev.id && 'sv-event-row--on']"
              @click="pickEvent(ev)"
            >
              <span :class="['sv-sev', `sv-sev--${ev.severity}`]" :title="severityLabel(ev.severity)">
                {{ ev.severity }}
              </span>
              <div class="sv-event-info">
                <span class="sv-event-type">{{ eventTypeLabel(ev.event_type) }}</span>
                <span class="sv-event-when">{{ formatDateTime(ev.occurred_at) }}</span>
              </div>
              <span :class="['sv-event-status', `sv-event-status--${ev.status}`]">
                {{ STATUS_LABELS[ev.status] || ev.status }}
              </span>
            </li>
          </ul>
        </div>

        <div v-if="activeEvent" class="sv-event-panel">
          <p class="sv-section-title">{{ eventTypeLabel(activeEvent.event_type) }}</p>
          <div class="sv-event-meta-row">
            <span class="sv-event-meta-chip">{{ formatDateTime(activeEvent.occurred_at) }}</span>
            <span :class="['sv-event-meta-chip', `sv-sev-chip--${activeEvent.severity}`]">
              Severity {{ severityLabel(activeEvent.severity) }}
            </span>
            <span v-if="activeEvent.location" class="sv-event-meta-chip">{{ activeEvent.location }}</span>
          </div>

          <div :class="['sv-video', `sv-video--sev${activeEvent.severity}`]">
            <span class="sv-video-overlay">
              <span :class="['sv-video-sev', `sv-sev-chip--${activeEvent.severity}`]">
                SEV {{ activeEvent.severity }} · {{ severityLabel(activeEvent.severity).toUpperCase() }}
              </span>
              <span class="sv-video-rec">● REC</span>
            </span>
            <video controls :src="sampleVideoFor(activeEvent)" :key="activeEvent.id" />
          </div>

          <div v-if="activeEvent.behaviors?.length" class="sv-behaviors">
            <span class="sv-behaviors-lbl">Behaviors:</span>
            <span v-for="b in activeEvent.behaviors" :key="b" class="sv-behavior">{{ b.replace(/_/g, ' ') }}</span>
          </div>

          <div v-if="activeEvent.coaching_notes?.length" class="sv-notes">
            <p class="sv-notes-title">Coaching notes</p>
            <div v-for="n in activeEvent.coaching_notes" :key="n.id" class="sv-note">
              <p class="sv-note-meta">
                <strong>{{ n.admin_name || 'Admin' }}</strong>
                · {{ formatDateTime(n.created_at) }}
                <span v-if="n.acknowledged_at" class="sv-note-ack">
                  <CheckCircleIcon :size="11" /> ack {{ formatDateTime(n.acknowledged_at) }}
                </span>
              </p>
              <p class="sv-note-body">{{ n.note }}</p>
            </div>
          </div>

          <div class="sv-actions">
            <button
              class="sv-btn sv-btn--secondary"
              :disabled="activeEvent.status !== 'pending'"
              @click="markReviewed(activeEvent)"
            >Mark reviewed</button>
          </div>

          <div class="sv-coach">
            <label class="sv-coach-label">Add coaching note</label>
            <textarea
              v-model="coachNote"
              class="sv-coach-input"
              rows="3"
              placeholder="What should the driver do differently next time?"
            />
            <div class="sv-coach-actions">
              <button
                class="sv-btn sv-btn--primary"
                :disabled="coachSaving || !coachNote.trim()"
                @click="submitCoach(activeEvent)"
              >{{ coachSaving ? 'Saving…' : 'Save & mark coached' }}</button>
            </div>
          </div>
        </div>

        <div v-else class="sv-event-panel sv-event-panel--empty">
          <p class="sv-empty">Select an event on the left to review the recording and coach.</p>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.sdd { min-width: 0; max-width: 1100px; margin: 0 auto; }

.sdd-topbar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.sdd-back {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-md); padding: 7px 11px;
  font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2);
  cursor: pointer; transition: all var(--dur);
}
.sdd-back:hover { border-color: var(--c-text-2); color: var(--c-text-1); }
.sdd-back svg { width: 14px; height: 14px; }
.sdd-title-block { min-width: 0; }
.sdd-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -.02em; }
@media (min-width: 640px) { .sdd-title { font-size: 1.25rem; } }
.sdd-sub { font-size: 0.8125rem; color: var(--c-text-3); margin-top: 1px; }

.sdd-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
}

.sv-state { display: flex; align-items: center; gap: 10px; padding: 32px; color: var(--c-text-3); }
.sv-spinner { width: 18px; height: 18px; border: 2px solid var(--c-border); border-top-color: #16A34A; border-radius: 50%; animation: sdd-spin 0.7s linear infinite; }
@keyframes sdd-spin { to { transform: rotate(360deg); } }
.sv-empty { color: var(--c-text-3); font-size: 0.875rem; padding: 12px 4px; }

.sv-grade-pill--A { background: rgba(22,163,74,0.15); color: #16A34A; }
.sv-grade-pill--B { background: rgba(217,119,6,0.15); color: #D97706; }
.sv-grade-pill--C { background: rgba(220,38,38,0.15); color: #DC2626; }

.sv-detail { display: flex; flex-direction: column; gap: 18px; padding: 18px 20px 22px; }

.sv-detail-grade {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  gap: 14px 18px;
  align-items: center;
  padding: 16px 18px;
  background: var(--c-bg);
  border-radius: 12px;
  border: 1px solid var(--c-border-light);
}
.sv-detail-letter { width: 60px; height: 60px; font-size: 1.85rem; font-weight: 800; display: grid; place-items: center; border-radius: 12px; }
.sv-detail-grade-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.sv-detail-score { font-size: 1.4rem; font-weight: 800; color: var(--c-text-1); line-height: 1.1; }
.sv-detail-score span { font-size: 0.8rem; font-weight: 600; color: var(--c-text-3); }
.sv-detail-meta { font-size: 0.8rem; color: var(--c-text-3); }
.sv-trend {
  grid-column: 1 / -1;
  display: flex; align-items: flex-end; gap: 8px;
  padding-top: 10px; border-top: 1px dashed var(--c-border-light);
}
.sv-trend-bar { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.sv-trend-bar > span:first-child { width: 100%; max-width: 28px; min-height: 6px; border-radius: 3px 3px 0 0; background: var(--c-border); }
.sv-trend-bar--A { background: #16A34A !important; }
.sv-trend-bar--B { background: #D97706 !important; }
.sv-trend-bar--C { background: #DC2626 !important; }
.sv-trend-lbl { font-size: 0.62rem; color: var(--c-text-3); font-variant-numeric: tabular-nums; }

.sv-detail-grid { display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 16px; }
@media (max-width: 720px) {
  .sv-detail-grid { grid-template-columns: 1fr; }
}

.sv-section-title { font-size: 0.82rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); margin-bottom: 8px; }

.sv-diagnosis {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 14px; border-radius: 10px;
  background: rgba(217,119,6,0.06);
  border: 1px solid rgba(217,119,6,0.2);
  font-size: 0.875rem; color: var(--c-text-1); line-height: 1.5;
}
.sv-diagnosis svg {
  color: #D97706; flex-shrink: 0; margin-top: 3px;
  background: rgba(217,119,6,0.14); border-radius: 50%; padding: 3px;
  width: 22px; height: 22px;
}

.sv-events { border: 1px solid var(--c-border); border-radius: 10px; padding: 10px 12px; max-height: 460px; overflow-y: auto; }
.sv-event-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.sv-event-row { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px 8px 12px; border-radius: 7px; cursor: pointer; transition: background var(--dur); border-left: 3px solid transparent; }
.sv-event-row:hover { background: var(--c-hover); }
.sv-event-row--on   { background: rgba(29,78,216,0.08); }
.sv-event-row--sev1 { border-left-color: rgba(22,163,74,0.4); }
.sv-event-row--sev2 { border-left-color: rgba(217,119,6,0.55); }
.sv-event-row--sev3 { border-left-color: #DC2626; background: rgba(220,38,38,0.04); }
.sv-event-row--sev3:hover { background: rgba(220,38,38,0.09); }
.sv-sev { width: 26px; height: 26px; border-radius: 6px; display: grid; place-items: center; font-weight: 800; font-size: 0.85rem; }
.sv-sev--1 { background: rgba(22,163,74,0.12); color: #16A34A; }
.sv-sev--2 { background: rgba(217,119,6,0.12); color: #D97706; }
.sv-sev--3 { background: rgba(220,38,38,0.15); color: #DC2626; }

.sv-event-info { display: flex; flex-direction: column; min-width: 0; }
.sv-event-type { font-size: 0.875rem; font-weight: 600; color: var(--c-text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sv-event-when { font-size: 0.72rem; color: var(--c-text-3); }

.sv-event-status { font-size: 0.66rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 7px; border-radius: 999px; }
.sv-event-status--pending  { background: var(--c-bg); color: var(--c-text-3); }
.sv-event-status--reviewed { background: rgba(29,78,216,0.12); color: #1D4ED8; }
.sv-event-status--coached  { background: rgba(22,163,74,0.12); color: #16A34A; }

.sv-event-panel { border: 1px solid var(--c-border); border-radius: 10px; padding: 16px 18px; display: flex; flex-direction: column; gap: 14px; }
.sv-event-panel--empty { display: grid; place-items: center; min-height: 160px; }
.sv-event-meta-row { display: flex; flex-wrap: wrap; gap: 6px; }
.sv-event-meta-chip { font-size: 0.7rem; font-weight: 600; color: var(--c-text-2); padding: 2px 8px; border-radius: 999px; background: var(--c-bg); border: 1px solid var(--c-border-light); }
.sv-sev-chip--1 { color: #16A34A !important; border-color: rgba(22,163,74,0.3) !important; background: rgba(22,163,74,0.06) !important; }
.sv-sev-chip--2 { color: #D97706 !important; border-color: rgba(217,119,6,0.3) !important; background: rgba(217,119,6,0.06) !important; }
.sv-sev-chip--3 { color: #DC2626 !important; border-color: rgba(220,38,38,0.3) !important; background: rgba(220,38,38,0.06) !important; }

.sv-video {
  position: relative;
  background: oklch(14% 0.012 250);
  border-radius: 10px; overflow: hidden;
  display: flex; flex-direction: column;
  border: 1px solid var(--c-border);
}
.sv-video--sev3 { border-color: rgba(220,38,38,0.45); box-shadow: 0 0 0 1px rgba(220,38,38,0.15); }
.sv-video--sev2 { border-color: rgba(217,119,6,0.35); }
.sv-video video { width: 100%; max-height: 280px; background: oklch(10% 0.012 250); display: block; }

.sv-video-overlay {
  position: absolute; top: 10px; left: 10px; right: 10px; z-index: 2;
  display: flex; justify-content: space-between; align-items: center;
  pointer-events: none;
}
.sv-video-sev {
  display: inline-flex; align-items: center;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.07em;
  padding: 3px 9px; border-radius: 4px;
  background: rgba(15,23,42,0.85); color: #fff;
  text-shadow: 0 1px 1px rgba(0,0,0,0.4);
}
.sv-video-rec {
  font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em;
  color: #fff;
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 4px;
  background: rgba(15,23,42,0.85);
}
.sv-video-rec::before {
  content: '●'; color: #DC2626;
  animation: sdd-rec-blink 1.4s ease-in-out infinite;
}
@keyframes sdd-rec-blink {
  0%, 50% { opacity: 1; }
  60%, 100% { opacity: 0.25; }
}

.sv-video-empty {
  padding: 38px 16px; text-align: center; color: #94A3B8;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.sv-video-empty svg { color: #475569; }
.sv-video-empty p { font-size: 0.9rem; font-weight: 600; color: #CBD5E1; }
.sv-video-empty-sub { font-size: 0.72rem !important; font-weight: 400 !important; color: #64748B !important; max-width: 260px; line-height: 1.4; }

.sv-behaviors { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.sv-behaviors-lbl { font-size: 0.74rem; font-weight: 600; color: var(--c-text-3); }
.sv-behavior { font-size: 0.7rem; padding: 2px 8px; border-radius: 999px; background: rgba(124,58,237,0.08); color: #7C3AED; border: 1px solid rgba(124,58,237,0.25); text-transform: capitalize; }

.sv-notes { display: flex; flex-direction: column; gap: 6px; }
.sv-notes-title { font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); }
.sv-note { padding: 8px 10px; background: var(--c-bg); border: 1px solid var(--c-border-light); border-radius: 7px; }
.sv-note-meta { font-size: 0.72rem; color: var(--c-text-3); display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.sv-note-meta strong { color: var(--c-text-2); }
.sv-note-ack { display: inline-flex; align-items: center; gap: 4px; color: #16A34A; }
.sv-note-body { font-size: 0.85rem; color: var(--c-text-1); margin-top: 4px; line-height: 1.45; }

.sv-actions { display: flex; gap: 8px; justify-content: flex-start; }
.sv-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--c-border); background: var(--c-bg); color: var(--c-text-2); font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all var(--dur); }
.sv-btn:hover:not(:disabled) { border-color: var(--c-accent); color: var(--c-accent); }
.sv-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sv-btn--primary { background: #16A34A; color: #fff; border-color: #16A34A; }
.sv-btn--primary:hover:not(:disabled) { background: #15803D; border-color: #15803D; color: #fff; }
.sv-btn--secondary:hover:not(:disabled) { border-color: #1D4ED8; color: #1D4ED8; background: rgba(29,78,216,0.08); }

.sv-coach { display: flex; flex-direction: column; gap: 8px; padding-top: 14px; margin-top: 4px; border-top: 1px dashed var(--c-border-light); }
.sv-coach-label { font-size: 0.74rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); }
.sv-coach-input { width: 100%; padding: 8px 12px; border: 1px solid var(--c-border); border-radius: 8px; background: var(--c-bg); color: var(--c-text-1); font-size: 0.875rem; font-family: inherit; resize: vertical; }
.sv-coach-input:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-ring); }
.sv-coach-actions { display: flex; justify-content: flex-end; }
</style>
