<script setup>
import { ref, watch } from 'vue'
import { SearchIcon, CloseIcon } from '../icons/index.js'

const props = defineProps({
  modelValue:  { type: String, default: '' },
  placeholder: { type: String, default: 'Search…' },
  label:       { type: String, default: 'Search' },
})

const emit = defineEmits(['update:modelValue'])
const query = ref(props.modelValue)
let timeout = null

watch(query, (val) => {
  clearTimeout(timeout)
  timeout = setTimeout(() => emit('update:modelValue', val), 300)
})

function clear() {
  query.value = ''
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="search-wrap">
    <label :for="`search-${$.uid}`" class="sr-only">{{ label }}</label>
    <SearchIcon class="search-icon" :size="16" aria-hidden="true" />
    <input
      :id="`search-${$.uid}`"
      v-model="query"
      type="text"
      inputmode="search"
      enterkeyhint="search"
      :placeholder="placeholder"
      class="search-input"
    />
    <button v-if="query" class="search-clear" type="button" @click="clear" aria-label="Clear search">
      <CloseIcon :size="12" :stroke-width="2.5" />
    </button>
  </div>
</template>
