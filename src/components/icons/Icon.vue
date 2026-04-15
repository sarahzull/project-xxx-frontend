<!--
  Icon — dynamic icon wrapper for runtime icon selection.

  Props:
    name        – icon name string (see ICON_REGISTRY in index.js)
    size        – icon size in pixels (default: 20)
    color       – stroke color (default: 'currentColor')
    strokeWidth – stroke width (default: 1.75)

  Usage:
    <Icon name="driver" />
    <Icon name="truck" :size="24" color="#1D4ED8" />
    <Icon name="check-circle" :size="16" />
-->
<script setup>
import { computed } from 'vue'
import { ICON_REGISTRY } from './index.js'

const props = defineProps({
  name:        { type: String,           required: true },
  size:        { type: [Number, String], default: 20 },
  color:       { type: String,           default: 'currentColor' },
  strokeWidth: { type: [Number, String], default: 1.75 },
})

const component = computed(() => {
  const icon = ICON_REGISTRY[props.name]
  if (!icon && import.meta.env.DEV) {
    console.warn(`[Icon] Unknown icon name: "${props.name}". Check ICON_REGISTRY in components/icons/index.js`)
  }
  return icon ?? null
})
</script>

<template>
  <component
    :is="component"
    v-if="component"
    :size="size"
    :color="color"
    :stroke-width="strokeWidth"
  />
</template>
