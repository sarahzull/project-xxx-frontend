<script setup>
import { ref } from 'vue'
import CalendarPanel from '../../components/common/CalendarPanel.vue'

const single = ref('')
const fromV  = ref('')
const toV    = ref('')

function onSingle(v) { single.value = v }
function onRange(v) {
  if (v && typeof v === 'object') {
    fromV.value = v.from
    toV.value   = v.to
  }
}
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 40px; align-items: flex-start;">
    <div>
      <h3>Single mode</h3>
      <p>Selected: <code>{{ single || '(empty)' }}</code></p>
      <CalendarPanel mode="single" :model-value="single" @select="onSingle" />
    </div>

    <div>
      <h3>Range mode</h3>
      <p>From: <code>{{ fromV || '(empty)' }}</code> → To: <code>{{ toV || '(empty)' }}</code></p>
      <CalendarPanel mode="range" :from="fromV" :to="toV" @select="onRange" />
    </div>
  </div>
</template>
