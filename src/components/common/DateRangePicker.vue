<script setup>
import { ref, watch } from 'vue'
import { CalendarIcon, ChevronDownIcon } from '../icons/index.js'

const props = defineProps({
  from: { type: String, default: '' },
  to:   { type: String, default: '' },
})

const emit = defineEmits(['update:from', 'update:to'])

const activePreset = ref(null)
const showCustom   = ref(false)
const customFrom   = ref(props.from)
const customTo     = ref(props.to)

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
    // Deselect — clear everything
    activePreset.value = null
    customFrom.value = ''
    customTo.value = ''
    emit('update:from', '')
    emit('update:to', '')
    return
  }
  activePreset.value = key
  showCustom.value   = false
  const range = getPresetRange(key)
  customFrom.value = range.from
  customTo.value   = range.to
  emit('update:from', range.from)
  emit('update:to',   range.to)
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
}

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
    <!-- Preset chips -->
    <div class="drp-seg" role="group" aria-label="Date range preset">
      <button
        v-for="p in [
          { key: 'today',  label: 'Today'        },
          { key: 'week',   label: 'This Week'    },
          { key: 'month',  label: 'This Month'   },
          { key: 'last30', label: 'Last 30 Days' },
        ]"
        :key="p.key"
        type="button"
        :class="['drp-chip', activePreset === p.key && 'drp-chip--on']"
        :aria-pressed="activePreset === p.key"
        @click="selectPreset(p.key)"
      >{{ p.label }}</button>

      <!-- Custom toggle -->
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

/* Pill group */
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
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  transition: transform var(--dur);
}
.drp-caret--open { transform: rotate(180deg); }

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

/* Expand transition */
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

/* Mobile */
@media (max-width: 767px) {
  .drp { flex-direction: column; align-items: stretch; }

  .drp-seg {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .drp-chip {
    min-height: 44px;
    justify-content: center;
  }

  .drp-custom {
    flex-direction: column;
    align-items: stretch;
  }

  .drp-field {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }

  .drp-input {
    width: 100%;
    min-height: 44px;
  }

  .drp-arrow { display: none; }
}
</style>
