<!--
  StatCard — metric display card.

  Props:
    title     – label text (required)
    value     – metric value (required)
    subtitle  – small muted line below the value (optional)
    color     – accent colour: blue | green | red | yellow | purple (default blue)
    clickable – renders as <button> and emits "click" (default false)
    hint      – small hint shown when clickable, e.g. "tap to view list"

  Emits:
    click – only when clickable is true
-->
<script setup>
defineProps({
  title:    { type: String, required: true },
  value:    { type: [String, Number], required: true },
  subtitle: { type: String, default: '' },
  color:    { type: String, default: 'blue' },
  clickable:{ type: Boolean, default: false },
  hint:     { type: String, default: '' },
})
defineEmits(['click'])
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :class="['stat-card', `sc-${color}`, clickable && 'stat-card-clickable']"
    @click="clickable ? $emit('click') : undefined"
  >
    <p class="stat-label">{{ title }}</p>
    <p class="stat-value">{{ value }}</p>
    <p v-if="subtitle" class="stat-sub">{{ subtitle }}</p>
    <p v-if="clickable && hint" class="stat-hint">{{ hint }}</p>
  </component>
</template>
