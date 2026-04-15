<script setup>
defineProps({
  status:  { type: String,  required: true },
  dot:     { type: Boolean, default: false },   // show a leading status dot
  label:   { type: String,  default: null  },   // override display text
})

const map = {
  active:    'badge-active',
  blocked:   'badge-blocked',
  draft:     'badge-draft',
  pending:   'badge-pending',
  confirmed: 'badge-confirmed',
  exported:  'badge-exported',
  info:      'badge-info',
}

const dotColor = {
  active:    '#16A34A',
  blocked:   '#DC2626',
  draft:     '#D97706',
  pending:   '#D97706',
  confirmed: '#2563EB',
  exported:  '#16A34A',
  info:      '#7C3AED',
}
</script>

<template>
  <span :class="['badge', map[status] || 'badge-default']">
    <!-- optional leading dot -->
    <svg
      v-if="dot"
      class="badge-icon"
      viewBox="0 0 8 8"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="4" cy="4" r="4" />
    </svg>

    {{ label ?? status }}
  </span>
</template>
