<!--
  ComposeModal.vue
  ─────────────────
  Admin-only modal for composing driver communications.

  Features:
  - Tiptap rich-text editor (Bold, Italic, Bullet List)
  - Template selector: Reward / Warning (auto-fills editor + subject)
  - Live preview panel (right side on desktop, tab on mobile)
  - Driver search combobox
  - 2-column layout on desktop (≥768px), single-column tab-switch on mobile

  Props:
    modelValue  – v-model boolean (show/hide)

  Emits:
    update:modelValue
    sent             – payload: the newly created communication object
-->
<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import communicationsApi from '../../api/communications'
import driversApi        from '../../api/drivers'
import basesApi          from '../../api/bases'
import { useToast }      from '../../composables/useToast'
import {
  CloseIcon, SearchIcon, SendIcon, CheckCircleIcon, AlertIcon,
  BoldIcon, ItalicIcon, ListIcon, DriversIcon, CalendarIcon,
  BellRingIcon, InfoIcon,
} from '../icons/index.js'

const props = defineProps({ modelValue: { type: Boolean, required: true } })
const emit  = defineEmits(['update:modelValue', 'sent'])

const toast = useToast()

// ── Tabs (mobile) ────────────────────────────────────────────────────────────
// 'form' | 'preview'
const activeTab = ref('form')

// ── Form state ───────────────────────────────────────────────────────────────
const sending    = ref(false)
const composeErr = ref('')
const form = ref({
  driver_id: '',
  type:      'reward',
  subject:   '',
  content:   '',
  date:      new Date().toISOString().split('T')[0],
})

// ── Audience picker ───────────────────────────────────────────────────────────
// Mirrors the rates "Apply to" pattern: pick a single driver, all drivers,
// drivers in selected base(s), or an explicit driver list.
const audienceType    = ref('single') // 'single' | 'all' | 'bases' | 'drivers'
const selectedBases   = ref([])       // base codes, e.g. ['MA','PG']
const selectedDrivers = ref([])       // [{ driver_id, name, user_id?, base?, ... }]
const bases           = ref([])       // [{ code, label }]
const baseLabelByCode = computed(() => Object.fromEntries(bases.value.map(b => [b.code, b.label])))

async function fetchBases() {
  try {
    const { data } = await basesApi.list()
    bases.value = data.data || []
  } catch { /* silent — picker just shows empty */ }
}

function toggleBase(code) {
  const i = selectedBases.value.indexOf(code)
  if (i === -1) selectedBases.value = [...selectedBases.value, code]
  else          selectedBases.value = selectedBases.value.filter(b => b !== code)
}
function isBaseSelected(code) { return selectedBases.value.includes(code) }

function addDriverToList(d) {
  // Dedupe by driver_id (always present). SWAT search results have no `id`,
  // so the previous `x.id === d.id` check collapsed to undefined === undefined
  // and rejected every driver after the first one.
  if (selectedDrivers.value.some(x => x.driver_id === d.driver_id)) return
  selectedDrivers.value = [...selectedDrivers.value, d]
}
function removeDriverFromList(driverId) {
  selectedDrivers.value = selectedDrivers.value.filter(d => d.driver_id !== driverId)
}

// ── Driver search ─────────────────────────────────────────────────────────────
const driverQuery     = ref('')
const driverResults   = ref([])
const driverSearching = ref(false)
const showDriverDrop  = ref(false)
const selectedDriver  = ref(null) // single-mode only

let _searchTimer = null
function onDriverInput() {
  if (audienceType.value === 'single') {
    selectedDriver.value = null
    form.value.driver_id = ''
  }
  const q = driverQuery.value.trim()
  if (!q) { driverResults.value = []; showDriverDrop.value = false; return }
  clearTimeout(_searchTimer)
  driverSearching.value = true
  showDriverDrop.value  = true
  _searchTimer = setTimeout(async () => {
    try {
      const res = await driversApi.list({ search: q })
      driverResults.value = res.data.data || []
    } catch {
      driverResults.value = []
    } finally {
      driverSearching.value = false
    }
  }, 280)
}
function selectDriver(d) {
  if (audienceType.value === 'single') {
    selectedDriver.value = d
    form.value.driver_id = d.driver_id
  } else {
    addDriverToList(d)
  }
  driverQuery.value    = ''
  driverResults.value  = []
  showDriverDrop.value = false
}
function clearDriver() {
  selectedDriver.value = null
  form.value.driver_id = ''
  driverQuery.value    = ''
  driverResults.value  = []
  showDriverDrop.value = false
}

function onDriverBlur() { setTimeout(() => { showDriverDrop.value = false }, 180) }

// ── Templates ─────────────────────────────────────────────────────────────────
const BUILTIN_TEMPLATES = {
  reward: {
    subject: 'Recognition of Outstanding Performance',
    content: `<p>Dear [Driver Name],</p><p>We are delighted to formally recognise your exceptional performance and dedication to our operations.</p><p>Your commitment to excellence, professional conduct, and consistent delivery of results have set a commendable standard for your peers. This communication serves as an official acknowledgement of your contribution.</p><p>We encourage you to continue demonstrating this level of professionalism and look forward to your continued success within the organisation.</p><p>Congratulations on this well-deserved recognition.</p><p>Warm regards,<br>Management</p>`,
  },
  warning: {
    subject: 'Official Warning Notice',
    content: `<p>Dear [Driver Name],</p><p>This communication serves as an official written warning regarding concerns that have been brought to management's attention.</p><p>The matter in question relates to: <strong>[describe the issue clearly]</strong></p><p>This behaviour is in breach of our company standards and policies and cannot be condoned. You are required to immediately address and rectify this matter.</p><p>Please be advised that failure to demonstrate improvement may result in further disciplinary action, up to and including termination of employment.</p><p>You are requested to acknowledge receipt of this notice and arrange a meeting with management within <strong>5 working days</strong>.</p><p>Regards,<br>Management</p>`,
  },
  announcement: {
    subject: 'General Announcement',
    content: `<p>Dear [Driver Name],</p><p>We would like to bring the following announcement to your attention:</p><p><strong>[Announcement details]</strong></p><p>Please take note of the above information and act accordingly where required. Should you have any questions or concerns, feel free to reach out to management.</p><p>Thank you for your continued cooperation.</p><p>Regards,<br>Management</p>`,
  },
}

// Persist admin-saved templates locally for now. When the backend exposes a
// templates endpoint, swap the localStorage layer for an API call.
const CUSTOM_TPL_KEY = 'cv_custom_templates'
const customTemplates = ref([])

function loadCustomTemplates() {
  try {
    customTemplates.value = JSON.parse(localStorage.getItem(CUSTOM_TPL_KEY) || '[]')
  } catch {
    customTemplates.value = []
  }
}
function persistCustomTemplates() {
  localStorage.setItem(CUSTOM_TPL_KEY, JSON.stringify(customTemplates.value))
}

// Tracks which slot is selected in the template picker.
// Values: 'blank' | 'reward' | 'warning' | 'announcement' | `custom:<id>`.
const selectedTemplate = ref('reward')

function applyTemplate(value) {
  selectedTemplate.value = value

  // Blank — clear subject/content; type stays whatever the admin picked above.
  if (value === 'blank') {
    form.value.subject = ''
    form.value.content = ''
    editor.value?.commands.setContent('')
    return
  }

  // Built-in templates only pre-fill subject/content. Type is chosen
  // independently in the Type selector above so the two concerns don't fight.
  // Merge tags like [Driver Name] / [Name] / [Driver ID] / [Base] are kept
  // templated; the backend substitutes them per recipient at read time.
  const builtin = BUILTIN_TEMPLATES[value]
  if (builtin) {
    form.value.subject = builtin.subject
    form.value.content = builtin.content
    editor.value?.commands.setContent(builtin.content)
    return
  }

  // Saved custom template — restore its captured type so the badge matches
  // what the admin originally picked when saving.
  if (value.startsWith('custom:')) {
    const id  = value.slice('custom:'.length)
    const tpl = customTemplates.value.find(t => String(t.id) === id)
    if (!tpl) return
    if (tpl.type) form.value.type = tpl.type
    form.value.subject = tpl.subject || ''
    const content = tpl.content || ''
    form.value.content = content
    editor.value?.commands.setContent(content)
  }
}

const TYPE_OPTIONS = [
  { value: 'reward',       label: 'Reward'       },
  { value: 'warning',      label: 'Warning'      },
  { value: 'announcement', label: 'Announcement' },
]

// In-form save flow — shows an inline name field so admins can label templates
// without a native prompt() dialog.
const showSaveForm = ref(false)
const saveNameInput = ref('')

function openSaveTemplateForm() {
  const subject = form.value.subject.trim()
  const content = form.value.content
  if (!subject || !content || content === '<p></p>') {
    toast.error('Add a subject and content before saving as a template.', { title: 'Cannot Save' })
    return
  }
  saveNameInput.value = subject
  showSaveForm.value  = true
}

function cancelSaveTemplate() {
  showSaveForm.value  = false
  saveNameInput.value = ''
}

function confirmSaveTemplate() {
  const name = saveNameInput.value.trim()
  if (!name) {
    toast.error('Template name cannot be empty.', { title: 'Cannot Save' })
    return
  }

  // Editor stays templated, so the content is already storeable as-is.
  const tpl = {
    id:      String(Date.now()),
    name,
    type:    form.value.type,
    subject: form.value.subject.trim(),
    content: form.value.content,
  }
  customTemplates.value = [...customTemplates.value, tpl]
  persistCustomTemplates()
  selectedTemplate.value = `custom:${tpl.id}`
  showSaveForm.value  = false
  saveNameInput.value = ''
  toast.success(`Saved "${tpl.name}" to your templates.`, { title: 'Template Saved' })
}

// Rename flow for an existing custom template.
const renamingTemplateId = ref(null)
const renameInput = ref('')

function startRenameTemplate(tpl) {
  renamingTemplateId.value = tpl.id
  renameInput.value = tpl.name
}
function cancelRenameTemplate() {
  renamingTemplateId.value = null
  renameInput.value = ''
}
function confirmRenameTemplate() {
  const id   = renamingTemplateId.value
  const name = renameInput.value.trim()
  if (!id) return
  if (!name) {
    toast.error('Template name cannot be empty.', { title: 'Cannot Rename' })
    return
  }
  customTemplates.value = customTemplates.value.map(t =>
    String(t.id) === String(id) ? { ...t, name } : t
  )
  persistCustomTemplates()
  renamingTemplateId.value = null
  renameInput.value = ''
}

function removeCustomTemplate(id) {
  customTemplates.value = customTemplates.value.filter(t => String(t.id) !== String(id))
  persistCustomTemplates()
  if (selectedTemplate.value === `custom:${id}`) selectedTemplate.value = 'blank'
  if (renamingTemplateId.value === id) cancelRenameTemplate()
}

// ── Tiptap editor ─────────────────────────────────────────────────────────────
const editor = useEditor({
  extensions: [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    Placeholder.configure({ placeholder: 'Write your communication here…' }),
  ],
  content: '',
  onUpdate({ editor }) {
    form.value.content = editor.getHTML()
  },
})

onBeforeUnmount(() => editor.value?.destroy())

// ── Preview computed ──────────────────────────────────────────────────────────
const previewDate = computed(() => {
  if (!form.value.date) return '—'
  const [y, m, d] = form.value.date.split('-')
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`
})

// Mailchimp-style merge tags. Stays templated in the editor / stored body;
// the backend substitutes per recipient at read time. We mirror the same
// tokens here for the live preview only.
const MERGE_TOKENS = ['[Driver Name]', '[Name]', '[Driver ID]', '[Base]']

function renderTokens(text, user) {
  if (!text || !user) return text || ''
  return text
    .replaceAll('[Driver Name]', user.name      || '')
    .replaceAll('[Name]',        user.name      || '')
    .replaceAll('[Driver ID]',   user.driver_id || '')
    .replaceAll('[Base]',        user.base      || '')
}

// Driver used in the preview pane. Single mode → the picked driver; multi
// modes (drivers/all/bases) → the first chosen driver as a representative
// example. Falls back to a placeholder so the preview still renders.
const previewAsDriver = computed(() => {
  if (audienceType.value === 'single') return selectedDriver.value
  if (selectedDrivers.value.length)    return selectedDrivers.value[0]
  return null
})

const previewDriver = computed(() => previewAsDriver.value?.name || '[Driver Name]')

const previewSubject = computed(() =>
  renderTokens(form.value.subject, previewAsDriver.value)
)

const previewBody = computed(() =>
  renderTokens(form.value.content, previewAsDriver.value)
)

function copyMergeTag(tag) {
  if (editor.value) {
    editor.value.chain().focus().insertContent(tag).run()
    return
  }
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(tag)
}

// ── Reset on open/close ───────────────────────────────────────────────────────
watch(() => props.modelValue, (open) => {
  if (open) {
    form.value    = { driver_id: '', type: 'reward', subject: '', content: '', date: new Date().toISOString().split('T')[0] }
    composeErr.value = ''
    activeTab.value  = 'form'
    audienceType.value    = 'single'
    selectedBases.value   = []
    selectedDrivers.value = []
    loadCustomTemplates()
    fetchBases()
    clearDriver()
    applyTemplate('reward')
  }
})

// ── Submit ────────────────────────────────────────────────────────────────────
function buildAudiencePayload() {
  switch (audienceType.value) {
    case 'single':
      return form.value.driver_id ? { type: 'single', driver_id: form.value.driver_id } : null
    case 'all':
      return { type: 'all' }
    case 'bases':
      return selectedBases.value.length ? { type: 'bases', bases: [...selectedBases.value] } : null
    case 'drivers': {
      // Backend expects users.id ints — use user_id from the enriched driver
      // record (added by DriverController::index). Drivers without a matching
      // User row are dropped silently here; the audienceErrorMessage() guard
      // catches the empty-list case below.
      const ids = selectedDrivers.value
        .map(d => d.user_id)
        .filter(v => Number.isInteger(v))
      return ids.length ? { type: 'drivers', driver_user_ids: ids } : null
    }
    default:
      return null
  }
}

function audienceErrorMessage() {
  if (!form.value.subject || !form.value.content || form.value.content === '<p></p>') {
    return 'Please fill in subject and content.'
  }
  switch (audienceType.value) {
    case 'single':  return 'Please select a driver.'
    case 'bases':   return 'Pick at least one base.'
    case 'drivers': return 'Pick at least one driver.'
    default:        return 'Please complete the audience selection.'
  }
}

async function sendCommunication() {
  const audience = buildAudiencePayload()
  if (!audience || !form.value.subject || !form.value.content || form.value.content === '<p></p>') {
    composeErr.value = audienceErrorMessage()
    return
  }
  composeErr.value = ''
  sending.value = true
  try {
    const payload = {
      type:    form.value.type,
      subject: form.value.subject,
      body:    form.value.content,
      audience,
    }
    const res = await communicationsApi.send(payload)
    emit('update:modelValue', false)
    emit('sent', res.data?.data || res.data)
    const sentTo = audience.type === 'single'
      ? 'driver'
      : audience.type === 'all'
        ? 'all drivers'
        : audience.type === 'bases'
          ? `drivers in ${audience.bases.join(', ')}`
          : `${audience.driver_user_ids.length} driver${audience.driver_user_ids.length === 1 ? '' : 's'}`
    toast.success(`Communication sent to ${sentTo}.`, { title: 'Sent' })
  } catch (e) {
    composeErr.value = e.response?.data?.message || 'Failed to send communication.'
    toast.error(composeErr.value, { title: 'Send Failed' })
  } finally {
    sending.value = false
  }
}

function close() { if (!sending.value) emit('update:modelValue', false) }
</script>

<template>
  <Teleport to="body">
    <Transition name="cm">
      <div v-if="modelValue" class="cm-backdrop" @click.self="close" role="dialog" aria-modal="true" aria-label="Compose Communication">

        <div class="cm-panel">

          <!-- ── Header ──────────────────────────────────────────────────── -->
          <div class="cm-head">
            <div class="cm-head-left">
              <div class="cm-head-icon">
                <SendIcon :size="17" />
              </div>
              <div>
                <p class="cm-head-title">New Driver Communication</p>
                <p class="cm-head-sub">Send an official reward or warning communication</p>
              </div>
            </div>
            <button class="cm-close" @click="close" aria-label="Close" :disabled="sending">
              <CloseIcon :size="16" :stroke-width="2.2" />
            </button>
          </div>

          <!-- ── Mobile tab bar ─────────────────────────────────────────── -->
          <div class="cm-tabs">
            <button :class="['cm-tab', activeTab === 'form' && 'active']" @click="activeTab = 'form'">Compose</button>
            <button :class="['cm-tab', activeTab === 'preview' && 'active']" @click="activeTab = 'preview'">Preview</button>
          </div>

          <!-- ── Body: 2-column desktop / tab-switched mobile ───────────── -->
          <div class="cm-body">

            <!-- ── LEFT: Form ────────────────────────────────────────────── -->
            <div :class="['cm-col-form', activeTab !== 'form' && 'cm-col--hidden']">

              <div v-if="composeErr" class="cm-err">
                <CloseIcon :size="14" />{{ composeErr }}
              </div>

              <!-- Type selector -->
              <div class="cm-section">
                <p class="cm-section-label">Type</p>
                <div class="cm-type-seg" role="group" aria-label="Communication type">
                  <button
                    v-for="opt in TYPE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    :class="['cm-type-seg-btn', `cm-type-seg-btn--${opt.value}`, form.type === opt.value && 'cm-type-seg-btn--on']"
                    @click="form.type = opt.value"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- Template selector -->
              <div class="cm-section">
                <div class="cm-section-row">
                  <p class="cm-section-label">Template</p>
                  <button
                    type="button"
                    class="cm-tpl-save"
                    :disabled="showSaveForm"
                    @click="openSaveTemplateForm"
                    title="Save the current subject and content as a reusable template"
                  >
                    + Save as template
                  </button>
                </div>
                <div class="cm-template-select-wrap">
                  <select
                    :value="selectedTemplate"
                    class="cm-template-select"
                    @change="applyTemplate($event.target.value)"
                  >
                    <option value="blank">Blank — write from scratch</option>
                    <optgroup label="Built-in templates">
                      <option value="reward">Recognition / reward template</option>
                      <option value="warning">Disciplinary warning template</option>
                      <option value="announcement">General announcement template</option>
                    </optgroup>
                    <optgroup v-if="customTemplates.length" label="Saved templates">
                      <option
                        v-for="tpl in customTemplates"
                        :key="tpl.id"
                        :value="`custom:${tpl.id}`"
                      >{{ tpl.name }}</option>
                    </optgroup>
                  </select>
                </div>

                <!-- Save-as-template inline form (shown after clicking + Save as template) -->
                <Transition name="cm-fade">
                  <div v-if="showSaveForm" class="cm-tpl-save-form">
                    <label class="cm-tpl-save-lbl">Template name</label>
                    <div class="cm-tpl-save-row">
                      <input
                        v-model="saveNameInput"
                        type="text"
                        class="cm-input cm-tpl-save-input"
                        placeholder="e.g. Vehicle Maintenance Reminder"
                        @keyup.enter="confirmSaveTemplate"
                        @keyup.esc="cancelSaveTemplate"
                      />
                      <button type="button" class="cm-tpl-save-btn" @click="confirmSaveTemplate">Save</button>
                      <button type="button" class="cm-tpl-cancel-btn" @click="cancelSaveTemplate">Cancel</button>
                    </div>
                  </div>
                </Transition>

                <!-- Inline rename / remove for the currently selected custom template -->
                <div
                  v-if="selectedTemplate.startsWith('custom:')"
                  class="cm-tpl-actions"
                >
                  <template v-if="renamingTemplateId === selectedTemplate.slice('custom:'.length)">
                    <input
                      v-model="renameInput"
                      type="text"
                      class="cm-input cm-tpl-save-input"
                      placeholder="Template name"
                      @keyup.enter="confirmRenameTemplate"
                      @keyup.esc="cancelRenameTemplate"
                    />
                    <button type="button" class="cm-tpl-save-btn" @click="confirmRenameTemplate">Save</button>
                    <button type="button" class="cm-tpl-cancel-btn" @click="cancelRenameTemplate">Cancel</button>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="cm-tpl-link"
                      @click="startRenameTemplate(customTemplates.find(t => String(t.id) === selectedTemplate.slice('custom:'.length)))"
                    >Rename</button>
                    <span class="cm-tpl-link-sep">·</span>
                    <button
                      type="button"
                      class="cm-tpl-link cm-tpl-link--danger"
                      @click="removeCustomTemplate(selectedTemplate.slice('custom:'.length))"
                    >Remove</button>
                  </template>
                </div>
              </div>

              <!-- Audience picker -->
              <div class="cm-field">
                <label class="cm-label">Send to <span class="cm-req">*</span></label>
                <div class="cm-aud-seg" role="group" aria-label="Audience type">
                  <button type="button" :class="['cm-aud-seg-btn', audienceType === 'single'  && 'cm-aud-seg-btn--on']" @click="audienceType = 'single'">Single driver</button>
                  <button type="button" :class="['cm-aud-seg-btn', audienceType === 'bases'   && 'cm-aud-seg-btn--on']" @click="audienceType = 'bases'">By base</button>
                  <button type="button" :class="['cm-aud-seg-btn', audienceType === 'drivers' && 'cm-aud-seg-btn--on']" @click="audienceType = 'drivers'">Selected drivers</button>
                  <button type="button" :class="['cm-aud-seg-btn', audienceType === 'all'     && 'cm-aud-seg-btn--on']" @click="audienceType = 'all'">All drivers</button>
                </div>

                <!-- Single driver -->
                <div v-if="audienceType === 'single'" class="cm-aud-panel">
                  <div v-if="selectedDriver" class="cm-driver-chip">
                    <div class="cm-driver-avatar">{{ selectedDriver.name.charAt(0).toUpperCase() }}</div>
                    <div class="cm-driver-info">
                      <span class="cm-driver-name">{{ selectedDriver.name }}</span>
                      <span class="cm-driver-id">{{ selectedDriver.driver_id }}</span>
                    </div>
                    <button class="cm-driver-clear" type="button" @click="clearDriver" aria-label="Remove driver">
                      <CloseIcon :size="13" :stroke-width="2.4" />
                    </button>
                  </div>
                  <div v-else class="cm-driver-search">
                    <div class="cm-driver-search-row">
                      <SearchIcon :size="14" class="cm-driver-search-icon" />
                      <input
                        v-model="driverQuery"
                        type="text"
                        class="cm-driver-input"
                        placeholder="Search by name or driver ID…"
                        autocomplete="off"
                        @input="onDriverInput"
                        @focus="driverQuery && (showDriverDrop = true)"
                        @blur="onDriverBlur"
                      />
                      <span v-if="driverSearching" class="cm-searching-dot" />
                    </div>
                    <div v-if="showDriverDrop" class="cm-driver-drop">
                      <div v-if="!driverSearching && !driverResults.length" class="cm-drop-empty">
                        No drivers found for "{{ driverQuery }}"
                      </div>
                      <button
                        v-for="d in driverResults" :key="d.driver_id"
                        class="cm-drop-item" type="button"
                        @mousedown.prevent="selectDriver(d)"
                      >
                        <div class="cm-drop-avatar">{{ d.name.charAt(0).toUpperCase() }}</div>
                        <div class="cm-drop-info">
                          <span class="cm-drop-name">{{ d.name }}</span>
                          <span class="cm-drop-id">{{ d.driver_id }}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- By base -->
                <div v-else-if="audienceType === 'bases'" class="cm-aud-panel">
                  <div v-if="bases.length" class="cm-aud-chips">
                    <button
                      v-for="b in bases" :key="b.code" type="button"
                      :class="['cm-aud-chip', isBaseSelected(b.code) && 'cm-aud-chip--on']"
                      :title="b.label"
                      @click="toggleBase(b.code)"
                    >{{ b.code }}</button>
                  </div>
                  <p v-else class="cm-aud-hint">Loading bases…</p>
                </div>

                <!-- Selected drivers (multi) -->
                <div v-else-if="audienceType === 'drivers'" class="cm-aud-panel">
                  <div v-if="selectedDrivers.length" class="cm-aud-chips cm-aud-chips--drivers">
                    <span v-for="d in selectedDrivers" :key="d.driver_id" class="cm-aud-driver-chip">
                      {{ d.name }} <span class="cm-aud-driver-id">{{ d.driver_id }}</span>
                      <button type="button" class="cm-aud-driver-remove" @click="removeDriverFromList(d.driver_id)" aria-label="Remove">
                        <CloseIcon :size="11" :stroke-width="2.4" />
                      </button>
                    </span>
                  </div>
                  <div class="cm-driver-search">
                    <div class="cm-driver-search-row">
                      <SearchIcon :size="14" class="cm-driver-search-icon" />
                      <input
                        v-model="driverQuery"
                        type="text"
                        class="cm-driver-input"
                        placeholder="Add a driver by name or ID…"
                        autocomplete="off"
                        @input="onDriverInput"
                        @focus="driverQuery && (showDriverDrop = true)"
                        @blur="onDriverBlur"
                      />
                      <span v-if="driverSearching" class="cm-searching-dot" />
                    </div>
                    <div v-if="showDriverDrop" class="cm-driver-drop">
                      <div v-if="!driverSearching && !driverResults.length" class="cm-drop-empty">
                        No drivers found for "{{ driverQuery }}"
                      </div>
                      <button
                        v-for="d in driverResults" :key="d.driver_id"
                        class="cm-drop-item" type="button"
                        @mousedown.prevent="selectDriver(d)"
                      >
                        <div class="cm-drop-avatar">{{ d.name.charAt(0).toUpperCase() }}</div>
                        <div class="cm-drop-info">
                          <span class="cm-drop-name">{{ d.name }}</span>
                          <span class="cm-drop-id">{{ d.driver_id }}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- All -->
                <div v-else class="cm-aud-panel">
                  <p class="cm-aud-info">All active drivers will receive this communication.</p>
                </div>
              </div>

              <!-- Subject -->
              <div class="cm-field">
                <label class="cm-label">Subject <span class="cm-req">*</span></label>
                <input v-model="form.subject" type="text" class="cm-input" placeholder="e.g. Recognition of Outstanding Performance" />
              </div>

              <!-- Date -->
              <div class="cm-field">
                <label class="cm-label">Date</label>
                <input v-model="form.date" type="date" class="cm-input cm-input--date" />
              </div>

              <!-- Rich text editor -->
              <div class="cm-field">
                <label class="cm-label">Content <span class="cm-req">*</span></label>
                <div class="cm-merge-hint">
                  <InfoIcon :size="12" />
                  <span>Personalise per recipient with merge tags:</span>
                  <button
                    v-for="t in MERGE_TOKENS"
                    :key="t"
                    type="button"
                    class="cm-merge-tag"
                    title="Click to copy — paste into the editor"
                    @click="copyMergeTag(t)"
                  >{{ t }}</button>
                </div>
                <div class="cm-editor-wrap">
                  <!-- Toolbar -->
                  <div class="cm-toolbar" v-if="editor">
                    <button type="button" :class="['cm-tb-btn', editor.isActive('bold') && 'is-active']" @click="editor.chain().focus().toggleBold().run()" title="Bold">
                      <BoldIcon :size="13" :stroke-width="2.2" />
                    </button>
                    <button type="button" :class="['cm-tb-btn', editor.isActive('italic') && 'is-active']" @click="editor.chain().focus().toggleItalic().run()" title="Italic">
                      <ItalicIcon :size="13" :stroke-width="2.2" />
                    </button>
                    <div class="cm-tb-divider" />
                    <button type="button" :class="['cm-tb-btn', editor.isActive('bulletList') && 'is-active']" @click="editor.chain().focus().toggleBulletList().run()" title="Bullet list">
                      <ListIcon :size="13" :stroke-width="2.2" />
                    </button>
                    <div class="cm-tb-divider" />
                    <button type="button" :class="['cm-tb-btn', editor.isActive('heading', { level: 2 }) && 'is-active']" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" title="Heading">
                      <span class="cm-tb-text">H</span>
                    </button>
                    <button type="button" class="cm-tb-btn" @click="editor.chain().focus().setParagraph().run()" title="Paragraph">
                      <span class="cm-tb-text">¶</span>
                    </button>
                  </div>
                  <EditorContent :editor="editor" class="cm-editor" />
                </div>
              </div>

            </div>

            <!-- ── RIGHT: Live Preview ────────────────────────────────────── -->
            <div :class="['cm-col-preview', activeTab !== 'preview' && 'cm-col--hidden']">
              <p class="cm-preview-label">Live Preview</p>

              <div :class="['cm-letter', `cm-letter--${form.type}`]">
                <!-- Letter header -->
                <div class="cm-letter-head">
                  <div class="cm-letter-brand">
                    <div class="cm-letter-brand-dot" />
                    <span class="cm-letter-brand-name">Fleet Management</span>
                  </div>
                  <span :class="['cm-letter-type-badge', `cm-letter-type-badge--${form.type}`]">
                    <CheckCircleIcon v-if="form.type === 'reward'"       :size="11" />
                    <BellRingIcon    v-else-if="form.type === 'announcement'" :size="11" />
                    <AlertIcon       v-else                                   :size="11" />
                    {{ form.type === 'reward' ? 'Reward Communication' : form.type === 'announcement' ? 'Announcement' : 'Warning Communication' }}
                  </span>
                </div>

                <div class="cm-letter-divider" />

                <!-- Meta -->
                <div class="cm-letter-meta">
                  <div class="cm-letter-meta-row">
                    <DriversIcon :size="12" class="cm-letter-meta-icon" />
                    <span class="cm-letter-meta-key">To:</span>
                    <span class="cm-letter-meta-val">{{ previewDriver }}</span>
                  </div>
                  <div class="cm-letter-meta-row">
                    <CalendarIcon :size="12" class="cm-letter-meta-icon" />
                    <span class="cm-letter-meta-key">Date:</span>
                    <span class="cm-letter-meta-val">{{ previewDate }}</span>
                  </div>
                </div>

                <!-- Subject -->
                <p class="cm-letter-subject">{{ previewSubject || 'Subject will appear here…' }}</p>

                <!-- Body content -->
                <div
                  class="cm-letter-body"
                  v-html="previewBody || '<p style=\'color:#94A3B8\'>Content will appear here as you type…</p>'"
                />

                <!-- Footer -->
                <div class="cm-letter-foot">
                  <p class="cm-letter-foot-label">OFFICIAL DRIVER COMMUNICATION</p>
                  <p class="cm-letter-foot-note">This is an official internal communication issued by management.</p>
                </div>
              </div>
            </div>

          </div><!-- /cm-body -->

          <!-- ── Footer actions ─────────────────────────────────────────── -->
          <div class="cm-footer">
            <button class="cm-btn-cancel" @click="close" :disabled="sending">Cancel</button>
            <button class="cm-btn-send"   @click="sendCommunication" :disabled="sending">
              <SendIcon :size="14" />
              {{ sending ? 'Sending…' : 'Send Communication' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop & Panel ─────────────────────────────────────────────────────── */
.cm-backdrop {
  position: fixed; inset: 0; z-index: 210;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  display: flex; align-items: flex-end; justify-content: center;
  padding: 0;
}
@media (min-width: 640px) {
  .cm-backdrop { align-items: center; padding: 20px; }
}

.cm-panel {
  width: 100%; max-width: min(900px, 100%);
  background: var(--c-surface);
  border-radius: var(--r-2xl) var(--r-2xl) 0 0;
  box-shadow: var(--sh-xl);
  max-height: 96vh;
  display: flex; flex-direction: column;
  overflow: hidden;
}
@media (min-width: 640px) {
  .cm-panel { border-radius: var(--r-2xl); max-height: 88vh; }
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.cm-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
}
.cm-head-left   { display: flex; align-items: center; gap: 11px; min-width: 0; }
.cm-head-icon   {
  width: 36px; height: 36px; border-radius: 9px;
  background: rgba(124,58,237,0.1); color: #7C3AED;
  display: grid; place-items: center; flex-shrink: 0;
}
.cm-head-title  { font-size: 0.9375rem; font-weight: 700; color: var(--c-text-1); }
.cm-head-sub    { font-size: 0.73rem; color: var(--c-text-3); margin-top: 1px; }
.cm-close {
  width: 30px; height: 30px; border-radius: var(--r-md);
  display: grid; place-items: center;
  color: var(--c-text-3); flex-shrink: 0;
  transition: background var(--dur), color var(--dur);
}
.cm-close:hover:not(:disabled) { background: var(--c-bg); color: var(--c-text-1); }

/* ── Mobile tabs ─────────────────────────────────────────────────────────────── */
.cm-tabs {
  display: flex; border-bottom: 1px solid var(--c-border);
  flex-shrink: 0;
}
@media (min-width: 768px) { .cm-tabs { display: none; } }

.cm-tab {
  flex: 1; padding: 10px 0; font-size: 0.84rem; font-weight: 600;
  color: var(--c-text-3); border-bottom: 2px solid transparent;
  transition: color var(--dur), border-color var(--dur);
}
.cm-tab.active { color: #7C3AED; border-bottom-color: #7C3AED; }

/* ── Body layout ────────────────────────────────────────────────────────────── */
.cm-body {
  flex: 1 1 auto; min-height: 0;
  overflow: hidden;
  display: flex; flex-direction: column;
}
@media (min-width: 768px) {
  .cm-body { flex-direction: row; }
}

/* ── Columns ─────────────────────────────────────────────────────────────────── */
.cm-col-form,
.cm-col-preview {
  /* min-height: 0 lets the flex child shrink below its content size so
     `overflow-y: auto` can actually scroll instead of pushing past the footer. */
  flex: 1 1 0; min-height: 0; min-width: 0;
  overflow-y: auto; padding: 1.25rem;
}
.cm-col-preview {
  background: var(--c-bg);
  border-top: 1px solid var(--c-border);
  /* Extra bottom space so the letter's foot section ("OFFICIAL DRIVER COMMUNICATION")
     is fully reachable on shorter viewports without bumping into the modal footer. */
  padding-bottom: 2rem;
}
@media (min-width: 768px) {
  .cm-col-form    { flex: 0 0 50%; border-right: 1px solid var(--c-border); }
  .cm-col-preview { flex: 0 0 50%; border-top: none; }
  /* On desktop both columns are always visible — undo the mobile-tab "hidden"
     state. Using `display: block` keeps the column a normal block flow so the
     letter card can grow naturally and the column scrolls when needed. */
  .cm-col--hidden { display: block !important; }
}
/* Mobile: hide inactive tab */
@media (max-width: 767px) {
  .cm-col--hidden { display: none; }
}

/* ── Form elements ─────────────────────────────────────────────────────────── */
.cm-err {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.65rem 0.875rem; border-radius: 8px; margin-bottom: 0.75rem;
  background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
  color: #EF4444; font-size: 0.82rem;
}
.cm-section       { margin-bottom: 0.875rem; }
.cm-section-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--c-text-2); margin-bottom: 0.4rem; }
.cm-section-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 0.4rem;
}
.cm-section-row .cm-section-label { margin-bottom: 0; }
.cm-tpl-save {
  font-size: 0.72rem; font-weight: 600; color: #7C3AED;
  background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.2);
  padding: 3px 9px; border-radius: var(--r-full);
  transition: background var(--dur), border-color var(--dur);
}
.cm-tpl-save:hover { background: rgba(124,58,237,0.16); border-color: rgba(124,58,237,0.4); }
.cm-tpl-save:disabled { opacity: 0.5; cursor: not-allowed; }

/* Inline name-template form */
.cm-tpl-save-form {
  margin-top: 8px;
  padding: 10px;
  background: rgba(124,58,237,0.05);
  border: 1px solid rgba(124,58,237,0.2);
  border-radius: 9px;
}
.cm-tpl-save-lbl {
  display: block; font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--c-text-2); margin-bottom: 6px;
}
.cm-tpl-save-row {
  display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
}
.cm-tpl-save-input { flex: 1 1 160px; min-width: 0; padding: 0.45rem 0.75rem; }
.cm-tpl-save-btn,
.cm-tpl-cancel-btn {
  padding: 0.4rem 0.85rem; border-radius: 7px; font-size: 0.78rem; font-weight: 600;
  flex-shrink: 0;
}
.cm-tpl-save-btn   { background: #7C3AED; color: #fff; border: none; }
.cm-tpl-save-btn:hover   { background: #6D28D9; }
.cm-tpl-cancel-btn {
  background: transparent; color: var(--c-text-2);
  border: 1px solid var(--c-border);
}
.cm-tpl-cancel-btn:hover { background: var(--c-bg); color: var(--c-text-1); }

/* Saved-template inline actions (rename / remove) */
.cm-tpl-actions {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-top: 6px; font-size: 0.75rem;
}
.cm-tpl-link {
  background: transparent; border: none; padding: 2px 0;
  font-size: 0.75rem; font-weight: 500; color: #7C3AED;
  text-decoration: underline; text-underline-offset: 2px; cursor: pointer;
}
.cm-tpl-link:hover { color: #6D28D9; }
.cm-tpl-link--danger { color: #EF4444; }
.cm-tpl-link--danger:hover { color: #B91C1C; }
.cm-tpl-link-sep { color: var(--c-text-3); }

/* Smooth show/hide for the inline save form */
.cm-fade-enter-active, .cm-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.cm-fade-enter-from, .cm-fade-leave-to {
  opacity: 0; transform: translateY(-4px);
}

/* Type segmented control */
.cm-type-seg {
  display: inline-flex; gap: 4px;
  background: var(--c-bg); border: 1px solid var(--c-border);
  padding: 3px; border-radius: var(--r-full);
}
.cm-type-seg-btn {
  flex: 1;
  padding: 6px 14px; border-radius: var(--r-full); border: none;
  background: transparent; color: var(--c-text-3);
  font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  transition: background var(--dur), color var(--dur), box-shadow var(--dur);
  white-space: nowrap;
}
.cm-type-seg-btn:hover:not(.cm-type-seg-btn--on) {
  background: var(--c-surface); color: var(--c-text-1);
}
.cm-type-seg-btn--on { background: var(--c-surface); box-shadow: var(--sh-xs); }
.cm-type-seg-btn--reward.cm-type-seg-btn--on       { color: #16A34A; }
.cm-type-seg-btn--warning.cm-type-seg-btn--on      { color: #D97706; }
.cm-type-seg-btn--announcement.cm-type-seg-btn--on { color: #7C3AED; }
.cm-field         { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.875rem; }
.cm-label         { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--c-text-2); }
.cm-req           { color: #EF4444; }
.cm-input {
  background: var(--c-bg); border: 1px solid var(--c-border); border-radius: 9px;
  padding: 0.55rem 0.875rem; font-size: 0.875rem; color: var(--c-text-1);
  outline: none; transition: border-color var(--dur); font-family: inherit;
}
.cm-input:focus    { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
.cm-input--date    { cursor: pointer; }

/* ── Template selector ────────────────────────────────────────────────────── */
.cm-template-select-wrap {
  position: relative;
}
.cm-template-select-wrap::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0.95rem;
  width: 0.5rem;
  height: 0.5rem;
  border-right: 1.5px solid var(--c-text-3);
  border-bottom: 1.5px solid var(--c-text-3);
  transform: translateY(-70%) rotate(45deg);
  pointer-events: none;
}
.cm-template-select {
  width: 100%;
  appearance: none;
  background: var(--c-bg);
  border: 1px solid var(--c-border);
  border-radius: 9px;
  padding: 0.625rem 2.5rem 0.625rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--c-text-1);
  outline: none;
  transition: border-color var(--dur), box-shadow var(--dur);
}
.cm-template-select:focus {
  border-color: #7C3AED;
  box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
}

/* ── Audience picker ──────────────────────────────────────────────────────── */
.cm-aud-seg {
  display: flex; flex-wrap: wrap; gap: 4px;
  background: var(--c-bg); border: 1px solid var(--c-border);
  padding: 3px; border-radius: 9px; margin-bottom: 0.5rem;
}
.cm-aud-seg-btn {
  flex: 1 1 auto; padding: 5px 10px; border-radius: 7px;
  background: transparent; border: none; cursor: pointer;
  font-size: 0.78rem; font-weight: 600; color: var(--c-text-3);
  transition: background var(--dur), color var(--dur);
  white-space: nowrap;
}
.cm-aud-seg-btn:hover:not(.cm-aud-seg-btn--on) { background: var(--c-surface); color: var(--c-text-1); }
.cm-aud-seg-btn--on { background: var(--c-surface); color: #7C3AED; box-shadow: var(--sh-xs); }

.cm-aud-panel {
  margin-top: 0.25rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.cm-aud-chips {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.cm-aud-chip {
  padding: 5px 12px; border-radius: var(--r-full);
  background: var(--c-bg); border: 1px solid var(--c-border);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.78rem; font-weight: 700; color: var(--c-text-2);
  cursor: pointer; transition: background var(--dur), color var(--dur), border-color var(--dur);
}
.cm-aud-chip:hover { border-color: #7C3AED; color: #7C3AED; }
.cm-aud-chip--on {
  background: rgba(124,58,237,0.12); color: #7C3AED;
  border-color: rgba(124,58,237,0.4);
}
.cm-aud-chips--drivers { gap: 5px; }
.cm-aud-driver-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 6px 4px 10px; border-radius: var(--r-full);
  background: rgba(124,58,237,0.08); color: var(--c-text-1);
  border: 1px solid rgba(124,58,237,0.25);
  font-size: 0.78rem;
}
.cm-aud-driver-id {
  font-family: monospace; font-size: 0.72rem; color: var(--c-text-3);
}
.cm-aud-driver-remove {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; color: var(--c-text-2);
  background: transparent; border: none; cursor: pointer;
}
.cm-aud-driver-remove:hover { background: rgba(239,68,68,0.15); color: #EF4444; }
.cm-aud-info {
  padding: 9px 12px; border-radius: 8px;
  background: rgba(124,58,237,0.06);
  border: 1px dashed rgba(124,58,237,0.3);
  color: var(--c-text-2); font-size: 0.82rem;
}
.cm-aud-hint { font-size: 0.78rem; color: var(--c-text-3); }

/* ── Driver combobox ──────────────────────────────────────────────────────── */
.cm-driver-chip {
  display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.75rem;
  border-radius: 9px; border: 1.5px solid rgba(124,58,237,0.35);
  background: rgba(124,58,237,0.05);
}
.cm-driver-avatar {
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  background: rgba(124,58,237,0.15); color: #7C3AED;
  display: grid; place-items: center; font-size: 0.78rem; font-weight: 700;
}
.cm-driver-info   { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.cm-driver-name   { font-size: 0.875rem; font-weight: 600; color: var(--c-text-1); }
.cm-driver-id     { font-size: 0.72rem; color: var(--c-text-2); font-family: monospace; }
.cm-driver-clear  {
  width: 26px; height: 26px; border-radius: 6px; flex-shrink: 0;
  display: grid; place-items: center; color: var(--c-text-2);
  transition: background var(--dur), color var(--dur);
}
.cm-driver-clear:hover { background: rgba(239,68,68,0.1); color: #EF4444; }

.cm-driver-search { position: relative; }
.cm-driver-search-row {
  display: flex; align-items: center; gap: 0.4rem;
  background: var(--c-bg); border: 1px solid var(--c-border);
  border-radius: 9px; padding: 0.45rem 0.75rem;
  transition: border-color var(--dur);
}
.cm-driver-search-row:focus-within { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
.cm-driver-search-icon { color: var(--c-text-3); flex-shrink: 0; }
.cm-driver-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 0.875rem; color: var(--c-text-1); font-family: inherit;
}
.cm-searching-dot {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--c-border); border-top-color: #7C3AED;
  animation: spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.cm-driver-drop {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 50;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 10px; box-shadow: var(--sh-lg); max-height: 200px; overflow-y: auto;
}
.cm-drop-empty { padding: 0.75rem 1rem; font-size: 0.82rem; color: var(--c-text-3); }
.cm-drop-item {
  display: flex; align-items: center; gap: 0.6rem; width: 100%;
  padding: 0.6rem 0.875rem; text-align: left;
  transition: background var(--dur);
}
.cm-drop-item:hover { background: var(--c-bg); }
.cm-drop-avatar {
  width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
  background: rgba(29,78,216,0.12); color: #1D4ED8;
  display: grid; place-items: center; font-size: 0.75rem; font-weight: 700;
}
.cm-drop-info   { display: flex; flex-direction: column; gap: 1px; }
.cm-drop-name   { font-size: 0.84rem; font-weight: 600; color: var(--c-text-1); }
.cm-drop-id     { font-size: 0.7rem; color: var(--c-text-3); font-family: monospace; }

/* ── Tiptap Editor ─────────────────────────────────────────────────────────── */
.cm-merge-hint {
  display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
  margin: -2px 0 8px;
  font-size: 0.74rem; color: var(--c-text-3);
}
.cm-merge-hint > svg { flex-shrink: 0; opacity: 0.7; }
.cm-merge-tag {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.7rem; font-weight: 600; color: #7C3AED;
  background: rgba(124,58,237,0.08); border: 1px solid rgba(124,58,237,0.25);
  padding: 1px 7px; border-radius: 4px; cursor: pointer;
  transition: background var(--dur), border-color var(--dur);
}
.cm-merge-tag:hover { background: rgba(124,58,237,0.18); border-color: rgba(124,58,237,0.5); }

.cm-editor-wrap {
  border: 1px solid var(--c-border); border-radius: 10px;
  overflow: hidden; transition: border-color var(--dur);
}
.cm-editor-wrap:focus-within { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }

.cm-toolbar {
  display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
  padding: 6px 8px; background: var(--c-bg); border-bottom: 1px solid var(--c-border);
}
.cm-tb-btn {
  width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center;
  color: var(--c-text-2); font-size: 0.78rem; font-weight: 700;
  transition: background var(--dur), color var(--dur);
}
.cm-tb-btn:hover  { background: var(--c-surface); color: var(--c-text-1); }
.cm-tb-btn.is-active { background: rgba(124,58,237,0.12); color: #7C3AED; }
.cm-tb-text { font-size: 0.8rem; font-weight: 700; font-family: inherit; }
.cm-tb-divider { width: 1px; height: 16px; background: var(--c-border); margin: 0 2px; }

/* Tiptap ProseMirror output */
:deep(.cm-editor .ProseMirror) {
  padding: 0.75rem 0.875rem;
  min-height: 140px;
  font-size: 0.875rem;
  line-height: 1.65;
  color: var(--c-text-1);
  outline: none;
  font-family: inherit;
}
:deep(.cm-editor .ProseMirror p)           { margin: 0 0 0.5em; }
:deep(.cm-editor .ProseMirror ul)          { padding-left: 1.5em; margin: 0 0 0.5em; }
:deep(.cm-editor .ProseMirror li)          { margin-bottom: 0.2em; }
:deep(.cm-editor .ProseMirror h2)          { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.4em; color: var(--c-text-1); }
:deep(.cm-editor .ProseMirror strong)      { font-weight: 700; }
:deep(.cm-editor .ProseMirror em)          { font-style: italic; }
:deep(.cm-editor .ProseMirror .is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--c-text-3); float: left; pointer-events: none; height: 0;
}

/* ── Preview panel ─────────────────────────────────────────────────────────── */
.cm-preview-label {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
  color: var(--c-text-3); margin: 0 0.5rem 1rem 0.35rem; white-space: nowrap;
}

.cm-letter {
  background: var(--c-surface); border-radius: 12px;
  box-shadow: var(--sh-md); overflow: hidden;
}
.cm-letter--warning      .cm-letter-head { background: rgba(245,158,11,0.06); }
.cm-letter--reward       .cm-letter-head { background: rgba(22,163,74,0.06); }
.cm-letter--announcement .cm-letter-head { background: rgba(124,58,237,0.06); }

.cm-letter-head {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  padding: 1rem 1.1rem 0.75rem; flex-wrap: wrap;
}
.cm-letter-brand { display: flex; align-items: center; gap: 7px; }
.cm-letter-brand-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #1D4ED8; flex-shrink: 0;
}
.cm-letter-brand-name { font-size: 0.78rem; font-weight: 700; color: var(--c-text-1); letter-spacing: .02em; }

.cm-letter-type-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 0.2rem 0.6rem; border-radius: 20px;
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
}
.cm-letter-type-badge--reward       { background: rgba(22,163,74,0.1);  color: #16A34A; }
.cm-letter-type-badge--warning      { background: rgba(245,158,11,0.1); color: #D97706; }
.cm-letter-type-badge--announcement { background: rgba(124,58,237,0.1); color: #7C3AED; }

.cm-letter-divider { height: 1px; background: var(--c-border); margin: 0 1.1rem; }

.cm-letter-meta    { padding: 0.75rem 1.1rem; display: flex; flex-direction: column; gap: 4px; }
.cm-letter-meta-row { display: flex; align-items: center; gap: 6px; }
.cm-letter-meta-icon { color: var(--c-text-3); flex-shrink: 0; }
.cm-letter-meta-key  { font-size: 0.73rem; font-weight: 600; color: var(--c-text-3); min-width: 36px; }
.cm-letter-meta-val  { font-size: 0.8rem; font-weight: 600; color: var(--c-text-1); }

.cm-letter-subject {
  font-size: 0.9rem; font-weight: 700; color: var(--c-text-1);
  padding: 0 1.1rem 0.5rem; line-height: 1.35;
}

.cm-letter-body {
  padding: 0 1.1rem; font-size: 0.82rem; line-height: 1.65;
  color: var(--c-text-1); min-height: 60px;
}
:deep(.cm-letter-body p)      { margin: 0 0 0.5em; }
:deep(.cm-letter-body ul)     { padding-left: 1.25em; margin: 0 0 0.5em; }
:deep(.cm-letter-body li)     { margin-bottom: 0.15em; }
:deep(.cm-letter-body strong) { font-weight: 700; }
:deep(.cm-letter-body em)     { font-style: italic; }
:deep(.cm-letter-body h2)     { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.3em; }

.cm-letter-foot {
  padding: 0.75rem 1.1rem 1rem; margin-top: 0.5rem;
  border-top: 1px solid var(--c-border);
}
.cm-letter-foot-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--c-text-3); }
.cm-letter-foot-note  { font-size: 0.7rem; color: var(--c-text-3); margin-top: 2px; }

/* ── Footer ─────────────────────────────────────────────────────────────────── */
.cm-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 0.625rem;
  padding: 10px 18px; border-top: 1px solid var(--c-border); flex-shrink: 0;
}
.cm-btn-cancel {
  padding: 0.5rem 1.125rem; border-radius: 9px; font-size: 0.84rem; font-weight: 600;
  color: var(--c-text-2); background: transparent; border: 1px solid var(--c-border);
  transition: background var(--dur), color var(--dur);
}
.cm-btn-cancel:hover:not(:disabled) { background: var(--c-bg); color: var(--c-text-1); }
.cm-btn-send {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1.25rem; border-radius: 9px; font-size: 0.84rem; font-weight: 600;
  background: #7C3AED; color: #fff;
  transition: background var(--dur), box-shadow var(--dur), opacity var(--dur);
}
.cm-btn-send:hover:not(:disabled) { background: #6D28D9; box-shadow: 0 4px 14px rgba(124,58,237,0.4); }
.cm-btn-cancel:disabled, .cm-btn-send:disabled { opacity: 0.55; cursor: not-allowed; }

/* ── Transitions ─────────────────────────────────────────────────────────────── */
.cm-enter-active { transition: opacity 200ms ease; }
.cm-leave-active { transition: opacity 180ms ease; }
.cm-enter-from, .cm-leave-to { opacity: 0; }
.cm-enter-active .cm-panel { transition: transform 240ms cubic-bezier(0.16,1,0.3,1); }
.cm-leave-active .cm-panel  { transition: transform 180ms ease; }
.cm-enter-from .cm-panel    { transform: translateY(100%); }
.cm-leave-to .cm-panel      { transform: translateY(100%); }
@media (min-width: 640px) {
  .cm-enter-active .cm-panel { transition: transform 200ms cubic-bezier(0.16,1,0.3,1), opacity 180ms ease; }
  .cm-leave-active .cm-panel { transition: transform 160ms ease, opacity 140ms ease; }
  .cm-enter-from .cm-panel   { transform: scale(0.95); opacity: 0; }
  .cm-leave-to .cm-panel     { transform: scale(0.95); opacity: 0; }
}
</style>
