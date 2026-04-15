<!--
  SortIcon — dual-chevron sort indicator for table column headers.
  The active direction's chevron is full opacity; the inactive one dims.

  Props:
    active  – whether this column is the active sort column
    dir     – 'asc' | 'desc' — current sort direction
    size    – icon size in pixels (default: 14)

  Usage:
    <SortIcon :active="sortKey === col.key" :dir="sortDir" />
-->
<script setup>
defineProps({
  active: { type: Boolean, default: false },
  dir:    { type: String,  default: 'asc' },
  size:   { type: [Number, String], default: 14 },
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 10 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <!-- Up chevron: dims when sort is desc (active direction is down) -->
    <path
      d="M5 0.5L0.5 6.5h9z"
      :opacity="active && dir === 'desc' ? 0.18 : 1"
    />
    <!-- Down chevron: dims when sort is asc (active direction is up) -->
    <path
      d="M5 15.5L0.5 9.5h9z"
      :opacity="active && dir === 'asc' ? 0.18 : 1"
    />
  </svg>
</template>
