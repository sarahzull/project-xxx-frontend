<script setup>
import { ref, watch } from 'vue'
import { SearchIcon } from '../icons/index.js'

const props = defineProps({
  modelValue:  { type: String, default: '' },
  placeholder: { type: String, default: 'Search…' },
})

const emit = defineEmits(['update:modelValue'])
const query = ref(props.modelValue)
let timeout = null

watch(query, (val) => {
  clearTimeout(timeout)
  timeout = setTimeout(() => emit('update:modelValue', val), 300)
})
</script>

<template>
  <div class="search-wrap">
    <SearchIcon class="search-icon" :size="16" />
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder"
      class="search-input"
    />
  </div>
</template>
