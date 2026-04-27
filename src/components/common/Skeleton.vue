<!--
  Skeleton.vue — soft loading placeholder (pulse).
  Mirrors the dashboard's adash-pulse rhythm so loading states feel
  cohesive across the app. Use it instead of full-page spinners.

  Examples:
    <Skeleton width="120px" height="14px" />                ← inline text run
    <Skeleton width="100%"  height="48px" rounded="md" />   ← card / row
    <Skeleton width="32px"  height="32px" rounded="full" /> ← avatar / dot
-->
<script setup>
defineProps({
  width:   { type: String, default: '100%' },
  height:  { type: String, default: '14px' },
  rounded: { type: String, default: 'sm' },
  block:   { type: Boolean, default: false },
})
</script>

<template>
  <span
    class="skel"
    :class="[`skel--${rounded}`, block && 'skel--block']"
    :style="{ width, height }"
    aria-hidden="true"
  />
</template>

<style scoped>
.skel {
  display: inline-block;
  background: var(--c-border);
  border-radius: var(--r-sm);
  animation: skel-pulse 1.4s ease-in-out infinite;
  vertical-align: middle;
}
.skel--block { display: block; }
.skel--md   { border-radius: var(--r-md); }
.skel--lg   { border-radius: var(--r-lg); }
.skel--full { border-radius: 999px; }

@keyframes skel-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.45; }
}
</style>
