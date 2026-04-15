<!--
  ChartCard — reusable wrapper for any Chart.js chart.

  Props:
    title     – card heading (required)
    subtitle  – muted line under the title (optional)
    height    – CSS height string for the chart area, default "220px"

  Slots:
    default   – the actual <Bar />, <Doughnut />, etc.
    actions   – optional top-right content (filters, legend, etc.)
-->
<script setup>
defineProps({
  title:    { type: String, required: true },
  subtitle: { type: String, default: '' },
  height:   { type: String, default: '220px' },
})
</script>

<template>
  <div class="cc-root card">
    <div class="cc-header">
      <div class="cc-titles">
        <p class="cc-title">{{ title }}</p>
        <p v-if="subtitle" class="cc-sub">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="cc-actions">
        <slot name="actions" />
      </div>
    </div>
    <div class="cc-body" :style="{ height }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.cc-root { padding: 18px 18px 14px; }
@media (min-width: 640px) { .cc-root { padding: 20px 22px 16px; } }

.cc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.cc-titles { min-width: 0; }
.cc-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--c-text-1);
  margin-bottom: 2px;
  letter-spacing: -0.01em;
}
.cc-sub {
  font-size: 0.6875rem;
  color: var(--c-text-3);
}
.cc-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.cc-body {
  position: relative;
  min-width: 0;
}
</style>
