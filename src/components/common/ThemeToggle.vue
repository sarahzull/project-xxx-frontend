<!--
  ThemeToggle — sun/moon button that switches light ↔ dark mode.
  Reads and writes the global theme store.
-->
<script setup>
import { useThemeStore } from '../../stores/theme'
import { MoonIcon, SunIcon } from '../icons/index.js'
const theme = useThemeStore()
</script>

<template>
  <button
    class="tt-btn"
    :title="theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :aria-label="theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="theme.toggle()"
  >
    <MoonIcon v-if="!theme.isDark" class="tt-icon" :size="17" />
    <SunIcon  v-else               class="tt-icon" :size="17" />
  </button>
</template>

<style scoped>
.tt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--r-md);
  color: var(--c-text-2);
  transition: background var(--dur), color var(--dur), transform 200ms ease;
}
.tt-btn:hover  { background: var(--c-bg); color: var(--c-text-1); }
.tt-btn:active { transform: scale(0.9); }
.tt-icon { width: 17px; height: 17px; }
</style>
