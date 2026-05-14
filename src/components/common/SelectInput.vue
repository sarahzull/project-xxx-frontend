<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronDownIcon, CloseIcon, CheckIcon, AddIcon } from '../icons/index.js'

const props = defineProps({
  modelValue:  { type: [String, Number, Boolean, Object, null], default: null },
  options:     { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Select, search or create' },
  allowCreate: { type: Boolean, default: false },
  error:       { type: Boolean, default: false },
  disabled:    { type: Boolean, default: false },
  clearable:   { type: Boolean, default: true },
  auto:        { type: Boolean, default: false },
  searchable:  { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue', 'create'])

const root    = ref(null)
const menuEl  = ref(null)
const inputEl = ref(null)
const isFocus = ref(false)
const query   = ref('')
const activeIdx = ref(-1)
const menuStyle = ref({})

const normalizedOptions = computed(() =>
  (props.options ?? []).map((o) => {
    if (o == null) return { value: null, label: '' }
    if (typeof o === 'string' || typeof o === 'number') return { value: o, label: String(o) }
    return { value: o.value, label: o.label ?? String(o.value) }
  })
)

const selectedOption = computed(() =>
  normalizedOptions.value.find((o) => o.value === props.modelValue) ?? null
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return normalizedOptions.value
  return normalizedOptions.value.filter((o) =>
    String(o.label).toLowerCase().includes(q)
  )
})

const showCreate = computed(() => {
  if (!props.allowCreate) return false
  const q = query.value.trim()
  if (!q) return false
  return !normalizedOptions.value.some((o) => String(o.label).toLowerCase() === q.toLowerCase())
})

const displayValue = computed(() => {
  if (isFocus.value) return query.value
  return selectedOption.value?.label ?? ''
})

function computeMenuPos() {
  if (!root.value) return
  const rect = root.value.getBoundingClientRect()
  const vh   = window.innerHeight
  const spaceBelow = vh - rect.bottom - 8
  const spaceAbove = rect.top - 8
  const maxH = 280

  if (spaceBelow < 120 && spaceAbove > spaceBelow) {
    menuStyle.value = {
      position:  'fixed',
      bottom:    `${vh - rect.top + 4}px`,
      top:       'auto',
      left:      `${rect.left}px`,
      width:     `${rect.width}px`,
      maxHeight: `${Math.min(maxH, spaceAbove)}px`,
      zIndex:    '9999',
    }
  } else {
    menuStyle.value = {
      position:  'fixed',
      top:       `${rect.bottom + 4}px`,
      bottom:    'auto',
      left:      `${rect.left}px`,
      width:     `${rect.width}px`,
      maxHeight: `${Math.min(maxH, Math.max(spaceBelow, 80))}px`,
      zIndex:    '9999',
    }
  }
}

function onPageScroll(e) {
  if (menuEl.value?.contains(e.target)) return
  close()
}

watch(isFocus, (open) => {
  if (open) {
    query.value = ''
    activeIdx.value = filtered.value.length ? 0 : -1
    nextTick(computeMenuPos)
    window.addEventListener('scroll', onPageScroll, { capture: true, passive: true })
    window.addEventListener('resize', computeMenuPos, { passive: true })
  } else {
    window.removeEventListener('scroll', onPageScroll, { capture: true, passive: true })
    window.removeEventListener('resize', computeMenuPos, { passive: true })
  }
})

watch(query, () => {
  activeIdx.value = filtered.value.length ? 0 : (showCreate.value ? -2 : -1)
})

function open() {
  if (props.disabled) return
  isFocus.value = true
  nextTick(() => inputEl.value?.focus())
}
function onControlClick() {
  if (!isFocus.value) open()
}
function close() {
  isFocus.value = false
  query.value = ''
}
function selectOption(opt) {
  emit('update:modelValue', opt.value)
  close()
}
function clearSelection(e) {
  e.stopPropagation()
  emit('update:modelValue', null)
  close()
  nextTick(() => inputEl.value?.blur())
}
function triggerCreate() {
  const label = query.value.trim()
  if (!label) return
  emit('create', label)
  close()
}

function onKeydown(e) {
  if (props.disabled) return
  if (!isFocus.value && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault()
    open()
    return
  }
  if (!isFocus.value) return
  const len = filtered.value.length
  const hasCreate = showCreate.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (activeIdx.value === -2) activeIdx.value = len ? 0 : -2
    else if (activeIdx.value < len - 1) activeIdx.value++
    else if (hasCreate) activeIdx.value = -2
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (activeIdx.value === -2) activeIdx.value = len - 1
    else if (activeIdx.value > 0) activeIdx.value--
    else if (hasCreate) activeIdx.value = -2
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (activeIdx.value === -2) triggerCreate()
    else if (activeIdx.value >= 0 && filtered.value[activeIdx.value]) {
      selectOption(filtered.value[activeIdx.value])
    } else if (hasCreate) triggerCreate()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
    inputEl.value?.blur()
  } else if (e.key === 'Tab') {
    close()
  }
}

function onClickOutside(e) {
  if (!isFocus.value) return
  if (root.value?.contains(e.target)) return
  if (menuEl.value?.contains(e.target)) return
  close()
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', onPageScroll, { capture: true, passive: true })
  window.removeEventListener('resize', computeMenuPos, { passive: true })
})
</script>

<template>
  <div
    ref="root"
    :class="[
      'select-wrap',
      { 'select-wrap--auto': auto, 'is-focus': isFocus, 'is-error': error, 'is-disabled': disabled },
    ]"
  >
    <div class="select-control" @mousedown.prevent="open" @click="onControlClick">
      <input
        ref="inputEl"
        class="select-input"
        type="text"
        :placeholder="placeholder"
        :value="displayValue"
        :disabled="disabled"
        :readonly="!isFocus || !searchable"
        :inputmode="searchable ? 'text' : 'none'"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        @input="(e) => { if (searchable) query = e.target.value }"
        @focus="isFocus = true"
        @keydown="onKeydown"
      />
      <button
        v-if="clearable && !disabled && (selectedOption || query)"
        type="button"
        class="select-clear"
        title="Clear"
        aria-label="Clear selection"
        @mousedown.prevent
        @click="clearSelection"
      >
        <CloseIcon :size="11" :stroke-width="2.5" />
      </button>
      <ChevronDownIcon class="select-chevron" :size="14" />
    </div>

    <Teleport to="body">
      <div v-if="isFocus" ref="menuEl" class="select-menu" :style="menuStyle" @mousedown.prevent>
        <div
          v-if="showCreate"
          :class="['select-create', { 'is-active': activeIdx === -2 }]"
          @mouseenter="activeIdx = -2"
          @click="triggerCreate"
        >
          <AddIcon :size="14" />
          <span>Create &ldquo;{{ query.trim() }}&rdquo;</span>
        </div>

        <div
          v-for="(opt, i) in filtered"
          :key="`${opt.value}-${i}`"
          :class="[
            'select-option',
            { 'is-active': activeIdx === i, 'is-selected': opt.value === modelValue },
          ]"
          @mouseenter="activeIdx = i"
          @click="selectOption(opt)"
        >
          <CheckIcon class="select-option-check" :size="14" />
          <span>{{ opt.label }}</span>
        </div>

        <div v-if="!filtered.length && !showCreate" class="select-empty">
          No matches found
        </div>
      </div>
    </Teleport>
  </div>
</template>
