<script setup>
import { computed } from 'vue'
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/index.js'

const props = defineProps({
  currentPage: { type: Number, required: true },
  lastPage:    { type: Number, required: true },
  total:       { type: Number, default: 0 },
  from:        { type: Number, default: 0 },
  to:          { type: Number, default: 0 },
  // When true, render the footer (with results info) even on a single page;
  // page controls still hide when there's nothing to navigate.
  always:      { type: Boolean, default: false },
})

const emit = defineEmits(['change'])

// Generate page list with ellipsis for large ranges
const pages = computed(() => {
  const curr = props.currentPage
  const last = props.lastPage
  if (last <= 1) return []
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)

  const set = new Set(
    [1, last, curr - 1, curr, curr + 1].filter(p => p >= 1 && p <= last)
  )
  const sorted = [...set].sort((a, b) => a - b)

  const result = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) result.push('...')
    result.push(p)
    prev = p
  }
  return result
})

function go(page) {
  if (page < 1 || page > props.lastPage || page === props.currentPage) return
  emit('change', page)
}
</script>

<template>
  <div v-if="lastPage > 1 || always" class="apg">
    <!-- Results info -->
    <p class="apg-info">
      <template v-if="from && to">
        Showing <strong>{{ from }}–{{ to }}</strong> of <strong>{{ total }}</strong>
      </template>
      <template v-else>
        Page <strong>{{ currentPage }}</strong> of <strong>{{ lastPage }}</strong>
      </template>
    </p>

    <!-- Controls -->
    <div v-if="lastPage > 1" class="apg-controls" role="navigation" aria-label="Pagination">
      <button
        class="apg-btn apg-btn--nav"
        :disabled="currentPage <= 1"
        aria-label="Previous page"
        @click="go(currentPage - 1)"
      >
        <ChevronLeftIcon :size="14" :stroke-width="2.5" />
      </button>

      <template v-for="(p, i) in pages" :key="i">
        <span v-if="p === '...'" class="apg-ellipsis">…</span>
        <button
          v-else
          :class="['apg-btn', p === currentPage && 'apg-btn--active']"
          :aria-label="`Page ${p}`"
          :aria-current="p === currentPage ? 'page' : undefined"
          @click="go(p)"
        >
          {{ p }}
        </button>
      </template>

      <button
        class="apg-btn apg-btn--nav"
        :disabled="currentPage >= lastPage"
        aria-label="Next page"
        @click="go(currentPage + 1)"
      >
        <ChevronRightIcon :size="14" :stroke-width="2.5" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.apg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--c-border-light);
}

@media (max-width: 767px) {
  .apg { padding: 10px 14px; flex-direction: column; align-items: center; gap: 8px; }
}

.apg-info {
  font-size: 0.8125rem;
  color: var(--c-text-3);
}
.apg-info strong {
  font-weight: 600;
  color: var(--c-text-2);
}

.apg-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.apg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border-radius: var(--r-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--c-text-2);
  background: transparent;
  border: 1px solid transparent;
  transition: background var(--dur), color var(--dur), border-color var(--dur);
}

.apg-btn:hover:not(:disabled):not(.apg-btn--active) {
  background: var(--c-bg);
  border-color: var(--c-border);
  color: var(--c-text-1);
}

.apg-btn--active {
  background: var(--c-accent);
  color: #fff;
  border-color: var(--c-accent);
  font-weight: 600;
}

.apg-btn--nav {
  color: var(--c-text-3);
  border-color: var(--c-border);
  background: var(--c-surface);
}

.apg-btn--nav:hover:not(:disabled) {
  border-color: var(--c-accent);
  color: var(--c-accent);
  background: var(--c-accent-tint);
}

.apg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.apg-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 32px;
  font-size: 0.875rem;
  color: var(--c-text-3);
  user-select: none;
}
</style>
