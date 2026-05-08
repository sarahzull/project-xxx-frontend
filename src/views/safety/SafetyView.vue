<!--
  SafetyView.vue (admin)
  ──────────────────────
  Fleet safety dashboard. Shows the grade distribution + ranked offenders +
  events-by-type for the chosen period. Click a driver to drill into their
  events, video, and coaching loop.
-->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import safetyApi from '../../api/safety'
import { useToast } from '../../composables/useToast'
import {
  SafetyIcon, CheckCircleIcon, ViewIcon,
  AlertIcon, SearchIcon, ShieldAlertIcon,
} from '../../components/icons/index.js'
import ModalSheet from '../../components/common/ModalSheet.vue'
import SelectInput from '../../components/common/SelectInput.vue'
import { useSafetyStore } from '../../stores/safety'

const toast = useToast()
const safety = useSafetyStore()

// ── Period picker ────────────────────────────────────────────────────────────
function buildPeriodOptions() {
  const now  = new Date()
  const opts = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const lbl = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    opts.push({ value: ym, label: lbl })
  }
  return opts
}
const periodOptions = ref(buildPeriodOptions())
const period        = ref(periodOptions.value[0].value)

// ── Fleet state ──────────────────────────────────────────────────────────────
const loading = ref(true)
const fleet   = ref(null)

async function loadFleet() {
  loading.value = true
  try {
    const { data } = await safetyApi.fleet({ period: period.value })
    fleet.value = data?.data || null
  } catch (err) {
    toast.error(err?.response?.data?.message || 'Failed to load fleet safety summary.', { title: 'Load failed' })
  } finally {
    loading.value = false
  }
}

onMounted(loadFleet)
watch(period, loadFleet)

// ── Driver detail modal ──────────────────────────────────────────────────────
const showDetail   = ref(false)
const detailLoading = ref(false)
const detail       = ref(null)
const activeEvent  = ref(null)
const coachNote    = ref('')
const coachSaving  = ref(false)

async function openDriver(driver) {
  showDetail.value   = true
  detailLoading.value = true
  detail.value       = null
  activeEvent.value  = null
  try {
    const { data } = await safetyApi.driver(driver.driver_user_id, { period: period.value })
    detail.value = data?.data || null
  } catch (err) {
    toast.error('Could not load driver detail.', { title: 'Load failed' })
  } finally {
    detailLoading.value = false
  }
}

function pickEvent(ev) {
  activeEvent.value = ev
  coachNote.value   = ''
}

async function markReviewed(ev) {
  const wasPending = ev.status === 'pending'
  try {
    const { data } = await safetyApi.review(ev.id)
    Object.assign(ev, data?.data || {})
    if (wasPending) safety.decrementReview(1)
    toast.success('Event marked reviewed.', { title: 'Reviewed' })
  } catch (err) {
    toast.error('Failed to update event.', { title: 'Action failed' })
  }
}

async function submitCoach(ev) {
  if (!coachNote.value.trim()) {
    toast.warning('Write a brief coaching note before saving.', { title: 'Note required' })
    return
  }
  coachSaving.value = true
  const wasPending = ev.status === 'pending'
  try {
    const { data } = await safetyApi.coach(ev.id, coachNote.value.trim())
    Object.assign(ev, data?.data?.event || {})
    if (wasPending) safety.decrementReview(1)
    coachNote.value = ''
    toast.success('Coaching note saved.', { title: 'Coached' })
  } catch (err) {
    toast.error('Failed to save coaching note.', { title: 'Action failed' })
  } finally {
    coachSaving.value = false
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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

const STATUS_LABELS = { pending: 'New', reviewed: 'Reviewed', coached: 'Coached' }

const totalDrivers = computed(() => {
  if (!fleet.value) return 0
  const g = fleet.value.grade_distribution || {}
  return (g.A || 0) + (g.B || 0) + (g.C || 0)
})
function gradePct(g) {
  if (!totalDrivers.value) return 0
  return Math.round(((fleet.value.grade_distribution?.[g] || 0) / totalDrivers.value) * 100)
}

const eventsByTypeArr = computed(() => {
  const obj = fleet.value?.events_by_type || {}
  return Object.entries(obj)
    .map(([k, v]) => ({ key: k, label: eventTypeLabel(k), count: Number(v) || 0 }))
    .sort((a, b) => b.count - a.count)
})
const maxEventCount = computed(() =>
  eventsByTypeArr.value.reduce((m, r) => Math.max(m, r.count), 0)
)

// ── Hero: worst driver + last incident relative time ────────────────────────
const worstDriver = computed(() => fleet.value?.top_offenders?.[0] || null)

const unreviewedHigh = computed(() => fleet.value?.high_severity || 0)

// ── Severity-stacked events-by-type — replaces the flat blue bar ───────────
const HIGH_SEVERITY_TYPES = ['drowsy', 'fatigue', 'phone_use']
const MED_SEVERITY_TYPES  = ['speeding', 'distracted']
function severityWeight(type) {
  if (HIGH_SEVERITY_TYPES.includes(type)) return 3
  if (MED_SEVERITY_TYPES.includes(type))  return 2
  return 1
}

// ── Top-offenders table: search ─────────────────────────────────────────────
const tableSearch = ref('')
const filteredOffenders = computed(() => {
  const list = fleet.value?.top_offenders || []
  const q = tableSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(d =>
    (d.name || '').toLowerCase().includes(q) ||
    (d.driver_id || '').toLowerCase().includes(q) ||
    (d.base || '').toLowerCase().includes(q)
  )
})

// ── Driver detail: auto-generated diagnosis line ─────────────────────────────
function diagnosis(events) {
  if (!events?.length) return ''
  // Most-common type
  const byType = {}
  events.forEach(e => { byType[e.event_type] = (byType[e.event_type] || 0) + 1 })
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0]
  if (!topType) return ''
  const [type, count] = topType
  const typeLabel = eventTypeLabel(type).toLowerCase()

  // Time-of-day pattern (group hours into windows)
  const hours = events
    .filter(e => e.event_type === type)
    .map(e => new Date(e.occurred_at).getHours())
    .filter(h => !isNaN(h))
  let timeHint = ''
  if (hours.length >= 3) {
    const buckets = { 'early morning (00–06)': 0, 'morning (06–12)': 0, 'afternoon (12–18)': 0, 'evening (18–24)': 0 }
    hours.forEach(h => {
      if (h < 6)       buckets['early morning (00–06)']++
      else if (h < 12) buckets['morning (06–12)']++
      else if (h < 18) buckets['afternoon (12–18)']++
      else             buckets['evening (18–24)']++
    })
    const topBucket = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]
    if (topBucket && topBucket[1] >= Math.ceil(hours.length * 0.5)) {
      timeHint = `, mostly in the ${topBucket[0]}`
    }
  }

  // Location pattern
  const locs = events.filter(e => e.event_type === type).map(e => e.location).filter(Boolean)
  const locCount = {}
  locs.forEach(l => { locCount[l] = (locCount[l] || 0) + 1 })
  const topLoc = Object.entries(locCount).sort((a, b) => b[1] - a[1])[0]
  let locHint = ''
  if (topLoc && topLoc[1] >= 2 && topLoc[1] >= Math.ceil(locs.length * 0.4)) {
    locHint = ` — recurring at ${topLoc[0]}`
  }

  return `Pattern: ${count} ${typeLabel} event${count === 1 ? '' : 's'}${timeHint}${locHint}.`
}
</script>

<template>
  <div class="sv">
    <!-- Banner -->
    <div class="sv-banner">
      <div class="sv-banner-left">
        <div class="sv-banner-icon"><SafetyIcon :size="20" /></div>
        <div>
          <h1 class="sv-banner-title">Safety Driving</h1>
          <p class="sv-banner-sub">Lytx telematics — violations, scorecards, coaching</p>
        </div>
      </div>
      <div class="sv-period">
        <SelectInput
          v-model="period"
          :options="periodOptions"
          :clearable="false"
          placeholder="Select period"
          auto
        />
      </div>
    </div>

    <div v-if="loading" class="sv-state"><div class="sv-spinner" /> Loading…</div>

    <template v-else-if="fleet">
      <!-- ── Hero: worst driver this period, urgent counters ──────────────── -->
      <div class="sv-hero">
        <div class="sv-hero-eyebrow">
          <ShieldAlertIcon :size="13" /> NEEDS ATTENTION
        </div>

        <div v-if="worstDriver" class="sv-hero-body">
          <div :class="['sv-hero-grade', `sv-grade-pill--${worstDriver.grade}`]">
            <span class="sv-hero-grade-letter">{{ worstDriver.grade }}</span>
            <span class="sv-hero-grade-score">{{ Number(worstDriver.score).toFixed(1) }}</span>
          </div>
          <div class="sv-hero-info">
            <p class="sv-hero-headline">
              <ShieldAlertIcon :size="16" />
              <span>{{ worstDriver.name }}</span>
              <span class="sv-hero-id">{{ worstDriver.driver_id }}</span>
              <span v-if="worstDriver.base" class="sv-base">{{ worstDriver.base }}</span>
            </p>
            <p class="sv-hero-subline">
              {{ worstDriver.total_events }} events recorded this period —
              <strong>highest risk in the fleet right now</strong>.
            </p>
            <button class="sv-hero-cta" @click="openDriver(worstDriver)">
              <ViewIcon :size="13" /> Open driver report
            </button>
          </div>
          <div class="sv-hero-counters">
            <div class="sv-hero-counter sv-hero-counter--alert">
              <span class="sv-hero-counter-num">{{ unreviewedHigh }}</span>
              <span class="sv-hero-counter-lbl">High severity</span>
            </div>
            <div class="sv-hero-counter">
              <span class="sv-hero-counter-num">{{ fleet.driver_count || 0 }}</span>
              <span class="sv-hero-counter-lbl">Drivers</span>
            </div>
            <div class="sv-hero-counter">
              <span class="sv-hero-counter-num">{{ fleet.fleet_avg_score ?? '—' }}</span>
              <span class="sv-hero-counter-lbl">Avg STSB</span>
            </div>
          </div>
        </div>
        <div v-else class="sv-hero-clear">
          <CheckCircleIcon :size="22" />
          <div>
            <p class="sv-hero-clear-title">All clear this period.</p>
            <p class="sv-hero-clear-sub">No drivers below grade A — keep the streak going.</p>
          </div>
        </div>
      </div>

      <div class="sv-card">
        <p class="sv-card-title">STSB grade distribution</p>
        <div class="sv-grades">
          <div v-for="g in ['A','B','C']" :key="g" :class="['sv-grade', `sv-grade--${g}`]">
            <div class="sv-grade-letter">{{ g }}</div>
            <div class="sv-grade-meta">
              <div class="sv-grade-count">{{ fleet.grade_distribution?.[g] || 0 }}</div>
              <div class="sv-grade-foot">{{ gradePct(g) }}% of fleet</div>
            </div>
            <div class="sv-grade-bar"><span :style="{ width: gradePct(g) + '%' }" /></div>
          </div>
        </div>
      </div>

      <div class="sv-card">
        <p class="sv-card-title">Events by type</p>
        <div v-if="eventsByTypeArr.length" class="sv-typelist">
          <div v-for="row in eventsByTypeArr" :key="row.key" class="sv-typerow">
            <span class="sv-typerow-label">
              <span :class="['sv-typerow-dot', `sv-typerow-dot--sev${severityWeight(row.key)}`]" />
              {{ row.label }}
            </span>
            <div class="sv-typerow-bar">
              <span
                :class="`sv-typerow-fill--sev${severityWeight(row.key)}`"
                :style="{ width: maxEventCount ? (row.count / maxEventCount * 100) + '%' : 0 }"
              />
            </div>
            <span class="sv-typerow-count">{{ row.count }}</span>
          </div>
        </div>
        <p v-else class="sv-empty">No events recorded for this period.</p>
      </div>

      <div class="sv-card">
        <div class="sv-card-hd">
          <p class="sv-card-title">Drivers needing attention</p>
          <div v-if="fleet.top_offenders?.length" class="sv-search">
            <SearchIcon :size="13" class="sv-search-icon" />
            <input
              v-model="tableSearch"
              type="text"
              class="sv-search-input"
              placeholder="Search by name, ID or base…"
            />
          </div>
        </div>
        <table v-if="filteredOffenders.length" class="sv-table">
          <thead>
            <tr>
              <th>Driver</th>
              <th>Base</th>
              <th class="sv-th-grade">Grade</th>
              <th class="sv-th-num">Score</th>
              <th class="sv-th-num">Events</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="d in filteredOffenders"
              :key="d.driver_user_id"
              :class="['sv-row', `sv-row--${d.grade}`]"
              @click="openDriver(d)"
            >
              <td>
                <div class="sv-driver-cell">
                  <div :class="['sv-avatar', `sv-avatar--${d.grade}`]">{{ (d.name || '?').charAt(0).toUpperCase() }}</div>
                  <div>
                    <div class="sv-driver-name">{{ d.name }}</div>
                    <div class="sv-driver-id">{{ d.driver_id }}</div>
                  </div>
                </div>
              </td>
              <td><span class="sv-base">{{ d.base || '—' }}</span></td>
              <td><span :class="['sv-grade-pill', `sv-grade-pill--${d.grade}`]">{{ d.grade }}</span></td>
              <td class="sv-num">{{ Number(d.score).toFixed(1) }}</td>
              <td class="sv-num">{{ d.total_events }}</td>
              <td class="sv-row-actions" @click.stop>
                <button class="sv-btn-link" @click="openDriver(d)">
                  <ViewIcon :size="13" /> Open
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="!fleet.top_offenders?.length" class="sv-empty">
          <CheckCircleIcon :size="14" />
          All clear — every driver is grade A this period.
        </p>
        <p v-else class="sv-empty">No matches for "{{ tableSearch }}".</p>
      </div>
    </template>

    <ModalSheet
      v-model="showDetail"
      max-width="900px"
      :title="detail?.driver?.name || 'Driver detail'"
      :subtitle="detail?.driver ? `${detail.driver.driver_id}${detail.driver.base ? ' · ' + detail.driver.base : ''}` : ''"
    >
      <div v-if="detailLoading" class="sv-state"><div class="sv-spinner" /> Loading driver…</div>
      <div v-else-if="detail" class="sv-detail">
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

        <!-- Auto-generated diagnosis line — turns the data into an insight. -->
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
              <video v-if="activeEvent.video_url" controls :src="activeEvent.video_url" />
              <div v-else class="sv-video-empty">
                <ShieldAlertIcon :size="20" />
                <p>Lytx footage not yet attached</p>
                <p class="sv-video-empty-sub">{{ activeEvent.video_url || 'When the integration is live, the recorded clip plays here.' }}</p>
              </div>
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
    </ModalSheet>
  </div>
</template>

<style scoped>
.sv { display: flex; flex-direction: column; gap: 16px; }

.sv-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; position: relative; overflow: hidden;
}
.sv-banner::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: #16A34A; border-radius: var(--r-xl) var(--r-xl) 0 0; }
.sv-banner-left { display: flex; align-items: center; gap: 12px; }
.sv-banner-icon { width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0; background: rgba(22,163,74,0.12); color: #16A34A; display: grid; place-items: center; }
.sv-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); }
.sv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }
.sv-period { display: inline-flex; align-items: center; min-width: 180px; }

.sv-state { display: flex; align-items: center; gap: 10px; padding: 32px; color: var(--c-text-3); }
.sv-spinner { width: 18px; height: 18px; border: 2px solid var(--c-border); border-top-color: #16A34A; border-radius: 50%; animation: sv-spin 0.7s linear infinite; }
@keyframes sv-spin { to { transform: rotate(360deg); } }
.sv-empty { color: var(--c-text-3); font-size: 0.875rem; padding: 12px 4px; }

/* ── Hero "Today's watch" ───────────────────────────────────────────────── */
.sv-hero {
  background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 14px;
  padding: 14px 18px 16px;
  position: relative; overflow: hidden;
}
.sv-hero::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(220,38,38,0.06) 0%, transparent 60%);
  pointer-events: none;
}
.sv-hero-eyebrow {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 0.66rem; font-weight: 800; letter-spacing: 0.12em;
  color: #DC2626; margin-bottom: 14px;
}
.sv-hero-eyebrow svg { color: #DC2626; }

.sv-hero-body {
  display: grid; grid-template-columns: auto 1fr auto; gap: 18px;
  align-items: center; position: relative;
}
@media (max-width: 720px) {
  .sv-hero-body { grid-template-columns: auto 1fr; }
  .sv-hero-counters { grid-column: 1 / -1; }
}

.sv-hero-grade {
  width: 84px; height: 84px; border-radius: 14px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.sv-hero-grade-letter { font-size: 2.4rem; font-weight: 900; line-height: 0.9; }
.sv-hero-grade-score  { font-size: 0.7rem; font-weight: 700; opacity: 0.7; margin-top: 4px; font-variant-numeric: tabular-nums; }

.sv-hero-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.sv-hero-headline {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  font-size: 1.05rem; font-weight: 800; color: var(--c-text-1);
}
.sv-hero-headline svg { color: #DC2626; flex-shrink: 0; }
.sv-hero-id { font-family: monospace; font-size: 0.78rem; color: var(--c-text-3); font-weight: 600; }
.sv-hero-subline { font-size: 0.84rem; color: var(--c-text-2); line-height: 1.4; }
.sv-hero-subline strong { color: #DC2626; }
.sv-hero-cta {
  align-self: flex-start;
  display: inline-flex; align-items: center; gap: 6px;
  margin-top: 4px; padding: 7px 12px;
  background: #DC2626; color: #fff; border: none; border-radius: 8px;
  font-size: 0.8rem; font-weight: 700; cursor: pointer;
  transition: background var(--dur), transform var(--dur);
}
.sv-hero-cta:hover { background: #B91C1C; transform: translateY(-1px); }

.sv-hero-counters {
  display: flex; gap: 10px; flex-shrink: 0;
}
.sv-hero-counter {
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 14px; border-radius: 10px;
  background: var(--c-bg); border: 1px solid var(--c-border-light);
  min-width: 70px;
}
.sv-hero-counter-num { font-size: 1.4rem; font-weight: 800; color: var(--c-text-1); font-variant-numeric: tabular-nums; line-height: 1.1; }
.sv-hero-counter-lbl { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-3); margin-top: 2px; }
.sv-hero-counter--alert { background: rgba(220,38,38,0.08); border-color: rgba(220,38,38,0.3); }
.sv-hero-counter--alert .sv-hero-counter-num { color: #DC2626; }
.sv-hero-counter--alert .sv-hero-counter-lbl { color: #DC2626; }

.sv-hero-clear {
  display: flex; align-items: center; gap: 14px;
  padding: 4px 0;
}
.sv-hero-clear svg { color: #16A34A; }
.sv-hero-clear-title { font-size: 1rem; font-weight: 800; color: var(--c-text-1); }
.sv-hero-clear-sub   { font-size: 0.85rem; color: var(--c-text-3); }

.sv-card { background: var(--c-surface); border: 1px solid var(--c-border); border-radius: 12px; padding: 16px 20px; }
.sv-card-title { font-size: 0.95rem; font-weight: 700; color: var(--c-text-1); margin-bottom: 12px; }

.sv-grades { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.sv-grade { display: grid; grid-template-columns: 56px 1fr; gap: 12px; padding: 12px 16px; border-radius: 10px; background: var(--c-bg); border: 1px solid var(--c-border-light); position: relative; overflow: hidden; }
.sv-grade-letter { font-size: 1.7rem; font-weight: 800; display: grid; place-items: center; border-radius: 10px; }
.sv-grade--A .sv-grade-letter { background: rgba(22,163,74,0.12); color: #16A34A; }
.sv-grade--B .sv-grade-letter { background: rgba(217,119,6,0.12); color: #D97706; }
.sv-grade--C .sv-grade-letter { background: rgba(220,38,38,0.12); color: #DC2626; }
.sv-grade-meta { display: flex; flex-direction: column; gap: 2px; }
.sv-grade-count { font-size: 1.4rem; font-weight: 800; color: var(--c-text-1); }
.sv-grade-foot  { font-size: 0.74rem; color: var(--c-text-3); }
.sv-grade-bar { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--c-border-light); }
.sv-grade-bar span { display: block; height: 100%; }
.sv-grade--A .sv-grade-bar span { background: #16A34A; }
.sv-grade--B .sv-grade-bar span { background: #D97706; }
.sv-grade--C .sv-grade-bar span { background: #DC2626; }

.sv-typelist { display: flex; flex-direction: column; gap: 8px; }
.sv-typerow { display: grid; grid-template-columns: 200px 1fr 48px; align-items: center; gap: 10px; }
.sv-typerow-label { display: inline-flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--c-text-2); }
.sv-typerow-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.sv-typerow-dot--sev1 { background: #16A34A; }
.sv-typerow-dot--sev2 { background: #D97706; }
.sv-typerow-dot--sev3 { background: #DC2626; }
.sv-typerow-bar { height: 8px; background: var(--c-border-light); border-radius: 999px; overflow: hidden; }
.sv-typerow-bar span { display: block; height: 100%; border-radius: 999px; }
.sv-typerow-fill--sev1 { background: linear-gradient(90deg, #16A34A 0%, #22C55E 100%); }
.sv-typerow-fill--sev2 { background: linear-gradient(90deg, #D97706 0%, #F59E0B 100%); }
.sv-typerow-fill--sev3 { background: linear-gradient(90deg, #DC2626 0%, #F87171 100%); }
.sv-typerow-count { font-weight: 700; color: var(--c-text-1); text-align: right; font-variant-numeric: tabular-nums; }

/* Card header with search */
.sv-card-hd {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
}
.sv-card-hd .sv-card-title { margin-bottom: 0; }
.sv-search {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 10px; border: 1px solid var(--c-border); border-radius: 8px;
  background: var(--c-bg); min-width: 220px;
}
.sv-search-icon { color: var(--c-text-3); flex-shrink: 0; }
.sv-search-input { flex: 1; border: none; background: transparent; outline: none; font-size: 0.82rem; color: var(--c-text-1); }
.sv-search:focus-within { border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-ring); }

.sv-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.sv-table thead th { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--c-border); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-3); }
.sv-table tbody td { padding: 10px; border-bottom: 1px solid var(--c-border-light); }
.sv-table tbody tr:last-child td { border-bottom: none; }
.sv-table tbody tr.sv-row { cursor: pointer; transition: background var(--dur), transform var(--dur); }
.sv-table tbody tr.sv-row:hover { background: var(--c-hover); }
.sv-table tbody tr.sv-row > td:first-child { border-left: 3px solid transparent; padding-left: 12px; }
.sv-table tbody tr.sv-row--A > td:first-child { border-left-color: #16A34A; }
.sv-table tbody tr.sv-row--B > td:first-child { border-left-color: #D97706; }
.sv-table tbody tr.sv-row--C > td:first-child { border-left-color: #DC2626; }
.sv-th-num   { text-align: right; }
.sv-th-grade { width: 80px; }
.sv-num      { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }

.sv-driver-cell { display: flex; align-items: center; gap: 10px; }
.sv-avatar { width: 32px; height: 32px; border-radius: 50%; background: rgba(29,78,216,0.12); color: #1D4ED8; display: grid; place-items: center; font-size: 0.78rem; font-weight: 700; }
.sv-avatar--A { background: rgba(22,163,74,0.14); color: #16A34A; }
.sv-avatar--B { background: rgba(217,119,6,0.14); color: #D97706; }
.sv-avatar--C { background: rgba(220,38,38,0.14); color: #DC2626; }
.sv-driver-name { font-size: 0.9rem; font-weight: 600; color: var(--c-text-1); }
.sv-driver-id   { font-size: 0.72rem; color: var(--c-text-3); font-family: monospace; }
.sv-base { font-family: monospace; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 5px; background: var(--c-bg); color: var(--c-text-2); }

.sv-grade-pill { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 6px; font-size: 0.85rem; font-weight: 800; }
.sv-grade-pill--A { background: rgba(22,163,74,0.15); color: #16A34A; }
.sv-grade-pill--B { background: rgba(217,119,6,0.15); color: #D97706; }
.sv-grade-pill--C { background: rgba(220,38,38,0.15); color: #DC2626; }

.sv-row-actions { text-align: right; }
.sv-btn-link { display: inline-flex; align-items: center; gap: 4px; background: transparent; border: none; cursor: pointer; font-size: 0.78rem; font-weight: 600; color: #1D4ED8; padding: 4px 8px; border-radius: 6px; }
.sv-btn-link:hover { background: rgba(29,78,216,0.08); }

.sv-detail {
  display: flex; flex-direction: column; gap: 18px;
  padding: 18px 20px 22px;
}

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

/* Diagnosis callout — reads as inline copy with a subtle amber accent on the
   icon, not a tabbed side-bar. */
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
  animation: sv-rec-blink 1.4s ease-in-out infinite;
}
@keyframes sv-rec-blink {
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
