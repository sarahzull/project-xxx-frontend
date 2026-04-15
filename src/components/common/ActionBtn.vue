<script setup>
/**
 * ActionBtn — Icon-only button with a CSS tooltip.
 *
 * Usage:
 *   <ActionBtn tooltip="View" variant="view" @click="...">
 *     <IconEye />
 *   </ActionBtn>
 *
 * Variants: default | view | edit | save | delete | cancel | warning
 */
defineProps({
  tooltip:  { type: String,  default: '' },
  variant:  { type: String,  default: 'default' },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <button
    type="button"
    :class="['action-btn', variant !== 'default' && `action-btn--${variant}`]"
    :data-tooltip="tooltip"
    :disabled="disabled"
    :aria-label="tooltip"
  >
    <slot />
  </button>
</template>
