<script setup>
import { ref } from 'vue'
import CalendarPanel    from '../../components/common/CalendarPanel.vue'
import DatePicker       from '../../components/common/DatePicker.vue'
import DateRangePicker  from '../../components/common/DateRangePicker.vue'

const single = ref('')
const fromV  = ref('')
const toV    = ref('')
const dpInput = ref('')
const dpChip  = ref('')
const dpDob   = ref('')

function onSingle(v) { single.value = v }
function onRange(v)  { if (v && typeof v === 'object') { fromV.value = v.from; toV.value = v.to } }
</script>

<template>
  <div style="padding: 40px; display: flex; flex-direction: column; gap: 40px; align-items: flex-start; max-width: 520px;">
    <div style="width: 100%;">
      <h3>Raw CalendarPanel — single</h3>
      <CalendarPanel mode="single" :model-value="single" @select="onSingle" />
    </div>
    <div style="width: 100%;">
      <h3>Raw CalendarPanel — range</h3>
      <CalendarPanel mode="range" :from="fromV" :to="toV" @select="onRange" />
    </div>
    <div style="width: 100%;">
      <h3>DatePicker — input variant</h3>
      <p>Value: <code>{{ dpInput || '(empty)' }}</code></p>
      <DatePicker v-model="dpInput" aria-label="Event date" />
    </div>
    <div style="width: 100%;">
      <h3>DatePicker — chip variant</h3>
      <p>Value: <code>{{ dpChip || '(empty)' }}</code></p>
      <DatePicker v-model="dpChip" variant="chip" placeholder="Pick a date" />
    </div>
    <div style="width: 100%;">
      <h3>DatePicker — DOB with max=today</h3>
      <p>Value: <code>{{ dpDob || '(empty)' }}</code></p>
      <DatePicker v-model="dpDob" aria-label="Date of birth" max="2026-04-21" placeholder="DD/MM/YYYY" />
    </div>
    <div style="width: 100%;">
      <h3>DateRangePicker — chip variant (default)</h3>
      <p>From: <code>{{ fromV || '(empty)' }}</code> → To: <code>{{ toV || '(empty)' }}</code></p>
      <DateRangePicker v-model:from="fromV" v-model:to="toV" />
    </div>

    <div style="width: 100%;">
      <h3>DateRangePicker — input variant, no presets</h3>
      <DateRangePicker v-model:from="fromV" v-model:to="toV" variant="input" :presets="[]" />
    </div>
  </div>
</template>
