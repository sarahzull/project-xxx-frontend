<script setup>
import { ref } from 'vue'
import CalendarPanel     from '../../components/common/CalendarPanel.vue'
import DatePickerPopover from '../../components/common/DatePickerPopover.vue'

const single = ref('')
const fromV  = ref('')
const toV    = ref('')
const popOpen    = ref(false)
const popTrigger = ref(null)
const popValue   = ref('')

function onSingle(v) { single.value = v }
function onRange(v)  { if (v && typeof v === 'object') { fromV.value = v.from; toV.value = v.to } }
function onPop(v)    { popValue.value = v; popOpen.value = false }
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 40px; align-items: flex-start;">
    <div>
      <h3>Single</h3>
      <CalendarPanel mode="single" :model-value="single" @select="onSingle" />
    </div>
    <div>
      <h3>Range</h3>
      <CalendarPanel mode="range" :from="fromV" :to="toV" @select="onRange" />
    </div>
    <div>
      <h3>Popover</h3>
      <p>Value: <code>{{ popValue || '(empty)' }}</code></p>
      <button
        ref="popTrigger"
        type="button"
        @click="popOpen = !popOpen"
        style="padding: 8px 14px; border: 1px solid #ccc; border-radius: 8px; background: white; cursor: pointer;"
      >Open calendar</button>
      <DatePickerPopover :open="popOpen" :trigger-el="popTrigger" @close="popOpen = false">
        <CalendarPanel mode="single" :model-value="popValue" @select="onPop" />
      </DatePickerPopover>
    </div>
  </div>
</template>
