<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { CalendarIcon, ChevronDownIcon, CheckIcon } from '../icons/index.js'

const props = defineProps({
  from: { type: String, default: '' },
  to:   { type: String, default: '' },
})

const emit = defineEmits(['update:from', 'update:to'])

const activePreset = ref(null)
const showCustom   = ref(false)
const customFrom   = ref(props.from)
const customTo     = ref(props.to)

const menuOpen = ref(false)
const menuRef  = ref(null)

const PRESETS = [
  { key: 'today',  label: 'Today'        },
  { key: 'week',   label: 'This Week'    },
  { key: 'month',  label: 'This Month'   },
  { key: 'last30', label: 'Last 30 Days' },
]

const activeLabel = computed(() => {
  if (activePreset.value === 'custom') return 'Custom Range'
  const hit = PRESETS.find(p => p.key === activePreset.value)
  return hit ? hit.label : 'Date Range'
})

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISO(d) { return d.toISOString().slice(0, 10) }

function getPresetRange(key) {
  const now = new Date()
  const today = toISO(now)
  switch (key) {
    case 'today': return { from: today, to: today }
    case 'week': {
      const d = new Date(now)
      const day = d.getDay()
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
      return { from: toISO(d), to: today }
    }
    case 'month': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: toISO(d), to: today }
    }
    case 'last30': {
      const d = new Date(now)
      d.setDate(d.getDate() - 29)
      return { from: toISO(d), to: today }
    }
    default: return { from: '', to: '' }
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────
function selectPreset(key) {
  if (activePreset.value === key) {
    activePreset.value = null
    customFrom.value = ''
    customTo.value = ''
    emit('update:from', '')
    emit('update:to', '')
    menuOpen.value = false
    return
  }
  activePreset.value = key
  showCustom.value   = false
  const range = getPresetRange(key)
  customFrom.value = range.from
  customTo.value   = range.to
  emit('update:from', range.from)
  emit('update:to',   range.to)
  menuOpen.value = false
}

function toggleCustom() {
  if (showCustom.value) {
    showCustom.value   = false
    activePreset.value = null
    customFrom.value   = ''
    customTo.value     = ''
    emit('update:from', '')
    emit('update:to',   '')
  } else {
    showCustom.value   = true
    activePreset.value = 'custom'
    customFrom.value = props.from
    customTo.value   = props.to
  }
  menuOpen.value = false
}

// ── Mobile menu ──────────────────────────────────────────────────────────────
function toggleMenu() { menuOpen.value = !menuOpen.value }

function onDocClick(e) {
  if (!menuOpen.value) return
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    menuOpen.value = false
  }
}
function onEsc(e) { if (e.key === 'Escape') menuOpen.value = false }

watch(menuOpen, (open) => {
  if (open) {
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onEsc)
  } else {
    document.removeEventListener('click', onDocClick)
    document.removeEventListener('keydown', onEsc)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onEsc)
})

// Emit as user changes custom inputs
watch(customFrom, v => { if (activePreset.value === 'custom') emit('update:from', v) })
watch(customTo,   v => { if (activePreset.value === 'custom') emit('update:to',   v) })

// Sync when parent clears (e.g. clearFilters)
watch(() => props.from, v => {
  if (!v && !props.to) {
    activePreset.value = null
    showCustom.value   = false
    customFrom.value   = ''
    customTo.value     = ''
  }
})
watch(() => props.to, v => {
  if (!v && !props.from) {
    activePreset.value = null
    showCustom.value   = false
  }
})
</script>

<template>
  <div class="drp">
    <!-- Desktop: preset chip group -->
    <div class="drp-seg" role="group" aria-label="Date range preset">
      <button
        v-for="p in PRESETS"
        :key="p.key"
        type="button"
        :class="['drp-chip', activePreset === p.key && 'drp-chip--on']"
        :aria-pressed="activePreset === p.key"
        @click="selectPreset(p.key)"
      >{{ p.label }}</button>

      <button
        type="button"
        :class="['drp-chip drp-chip--custom', activePreset === 'custom' && 'drp-chip--on']"
        :aria-pressed="showCustom"
        @click="toggleCustom"
      >
        <CalendarIcon :size="12" aria-hidden="true" />
        Custom
        <ChevronDownIcon :size="10" :stroke-width="2" :class="['drp-caret', showCustom && 'drp-caret--open']" />
      </button>
    </div>

    <!-- Mobile: compact dropdown -->
    <div ref="menuRef" class="drp-mobile">
      <button
        type="button"
        class="drp-trigger"
        :aria-expanded="menuOpen"
        aria-haspopup="listbox"
        @click.stop="toggleMenu"
      >
        <CalendarIcon :size="14" aria-hidden="true" />
        <span class="drp-trigger-label">{{ activeLabel }}</span>
        <ChevronDownIcon :size="12" :stroke-width="2" :class="['drp-caret', menuOpen && 'drp-caret--open']" />
      </button>

      <Transition name="drp-menu">
        <div v-if="menuOpen" class="drp-menu" role="listbox">
          <button
            v-for="p in PRESETS"
            :key="p.key"
            type="button"
            role="option"
            :aria-selected="activePreset === p.key"
            :class="['drp-menu-item', activePreset === p.key && 'drp-menu-item--on']"
            @click="selectPreset(p.key)"
          >
            <span>{{ p.label }}</span>
            <CheckIcon v-if="activePreset === p.key" :size="14" aria-hidden="true" />
          </button>
          <div class="drp-menu-sep" aria-hidden="true"></div>
          <button
            type="button"
            role="option"
            :aria-selected="activePreset === 'custom'"
            :class="['drp-menu-item', activePreset === 'custom' && 'drp-menu-item--on']"
            @click="toggleCustom"
          >
            <span class="drp-menu-custom">
              <CalendarIcon :size="13" aria-hidden="true" />
              Custom Range
            </span>
            <CheckIcon v-if="activePreset === 'custom'" :size="14" aria-hidden="true" />
          </button>
        </div>
      </Transition>
    </div>

    <!-- Custom date inputs -->
    <Transition name="drp-expand">
      <div v-if="showCustom" class="drp-custom">
        <div class="drp-field">
          <label class="drp-lbl">From</label>
          <input
            v-model="customFrom"
            type="date"
            class="drp-input"
            :max="customTo || undefined"
            aria-label="Date from"
          />
        </div>
        <span class="drp-arrow" aria-hidden="true">→</span>
        <div class="drp-field">
          <label class="drp-lbl">To</label>
          <input
            v-model="customTo"
            type="date"
            class="drp-input"
            :min="customFrom || undefined"
            aria-label="Date to"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drp {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* Pill group (desktop) */
.drp-seg {
  display: inline-flex;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-full);
  padding: 3px;
  gap: 2px;
  flex-shrink: 0;
}

.drp-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: var(--r-full);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--c-text-3);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all var(--dur);
  white-space: nowrap;
  line-height: 1;
}
.drp-chip:hover:not(.drp-chip--on) {
  background: var(--c-surface);
  color: var(--c-text-1);
}
.drp-chip--on {
  background: var(--c-surface);
  color: var(--c-accent);
  font-weight: 600;
  box-shadow: var(--sh-xs);
}

.drp-caret {
  flex-shrink: 0;
  transition: transform var(--dur);
}
.drp-caret--open { transform: rotate(180deg); }

/* Mobile dropdown — hidden on desktop */
.drp-mobile { display: none; position: relative; }

.drp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: var(--r-full);
  color: var(--c-text-1);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--dur), background var(--dur);
  line-height: 1;
}
.drp-trigger:hover { border-color: var(--c-text-3); }
.drp-trigger[aria-expanded="true"] {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.drp-trigger-label { white-space: nowrap; }

.drp-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 180px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-md, 0 8px 24px rgba(0,0,0,0.08));
  padding: 4px;
  z-index: 40;
}

.drp-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.8125rem;
  color: var(--c-text-1);
  cursor: pointer;
  text-align: left;
  transition: background var(--dur);
}
.drp-menu-item:hover { background: var(--c-bg); }
.drp-menu-item--on {
  color: var(--c-accent);
  font-weight: 600;
  background: var(--c-accent-ring);
}
.drp-menu-custom {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.drp-menu-sep {
  height: 1px;
  background: var(--c-border);
  margin: 4px 2px;
}

/* Custom date inputs */
.drp-custom {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.drp-field {
  display: flex;
  align-items: center;
  gap: 5px;
}

.drp-lbl {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--c-text-3);
  white-space: nowrap;
}

.drp-input {
  padding: 4px 8px;
  border-radius: 8px;
  border: 1.5px solid var(--c-border);
  background: var(--c-surface);
  color: var(--c-text-1);
  font-size: 0.8125rem;
  transition: border-color var(--dur);
  cursor: pointer;
}
.drp-input:focus {
  outline: none;
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-ring);
}
.drp-input::-webkit-calendar-picker-indicator {
  opacity: 0.5;
  cursor: pointer;
}

.drp-arrow {
  font-size: 0.75rem;
  color: var(--c-text-3);
}

/* Transitions */
.drp-expand-enter-active {
  transition: opacity 160ms ease-out, transform 160ms ease-out;
}
.drp-expand-leave-active {
  transition: opacity 120ms ease-in, transform 120ms ease-in;
}
.drp-expand-enter-from,
.drp-expand-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.drp-menu-enter-active {
  transition: opacity 140ms ease-out, transform 140ms ease-out;
}
.drp-menu-leave-active {
  transition: opacity 100ms ease-in, transform 100ms ease-in;
}
.drp-menu-enter-from,
.drp-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Mobile: swap chip group for dropdown */
@media (max-width: 767px) {
  .drp-seg    { display: none; }
  .drp-mobile { display: inline-block; }

  .drp-custom {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .drp-field {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .drp-input { width: 100%; }
  .drp-arrow { display: none; }
}
</style>
