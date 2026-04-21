<script setup>
import { ref } from 'vue'
import CalendarPanel from '../../components/common/CalendarPanel.vue'

const selected = ref('')
function onSelect(v) { selected.value = v }
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 24px; align-items: flex-start;">
    <h2>DatePicker sandbox</h2>
    <p>Selected: <code>{{ selected || '(empty)' }}</code></p>
    <CalendarPanel mode="single" :model-value="selected" @select="onSelect" />
  </div>
</template>
