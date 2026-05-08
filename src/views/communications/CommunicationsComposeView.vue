<script setup>
import { useRouter } from 'vue-router'
import { ChevronLeftIcon } from '../../components/icons/index.js'
import ComposeModal from '../../components/communications/ComposeModal.vue'

const router = useRouter()

function back() {
  router.push({ name: 'communications' })
}
</script>

<template>
  <div class="ccv">
    <div class="ccv-topbar">
      <button type="button" class="ccv-back" @click="back">
        <ChevronLeftIcon :size="16" />
        <span>Driver Communications</span>
      </button>
    </div>

    <ComposeModal
      inline
      @cancel="back"
      @sent="back"
    />
  </div>
</template>

<style scoped>
.ccv { min-width: 0; max-width: 1100px; margin: 0 auto; }

.ccv-topbar {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  margin-bottom: 14px;
}
.ccv-back {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-md); padding: 7px 11px;
  font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2);
  cursor: pointer; transition: all var(--dur);
}
.ccv-back:hover { border-color: var(--c-text-2); color: var(--c-text-1); }
.ccv-back svg { width: 14px; height: 14px; }
</style>
