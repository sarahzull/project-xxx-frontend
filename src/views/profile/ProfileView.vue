<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../../stores/auth'
import profileApi   from '../../api/profile'
import { useToast } from '../../composables/useToast'
import PhotoCropper from '../../components/common/PhotoCropper.vue'
import {
  UserIcon, CloseIcon, ViewIcon, PhotoIcon, TrashIcon, SearchIcon, InfoIcon, MoreIcon,
} from '../../components/icons/index.js'

const auth    = useAuthStore()
const toast   = useToast()
const isAdmin = computed(() => auth.hasRole('admin'))
const saving  = ref(false)

// ── Photo section ─────────────────────────────────────────────────────────────
const photoPreview  = ref(auth.user?.photo || '')
const originalPhoto = ref(auth.user?.photo || '')   // tracks saved state
const hasPhotoChange = computed(() => photoPreview.value !== originalPhoto.value)
const showCropper   = ref(false)
const cropperSrc    = ref('')
const fileInputRef  = ref(null)
const showPhotoModal = ref(false)

function openFilePicker() {
  fileInputRef.value?.click()
}

function onPhotoChange(e) {
  const file = e.target.files[0]
  if (!file) return
  // Reset input so same file can be re-selected after cancel
  e.target.value = ''
  const reader = new FileReader()
  reader.onload = (ev) => {
    cropperSrc.value  = ev.target.result
    showCropper.value = true
  }
  reader.readAsDataURL(file)
}

function onCrop(dataUrl) {
  photoPreview.value  = dataUrl
  showCropper.value   = false
  cropperSrc.value    = ''
}

function onCropCancel() {
  showCropper.value = false
  cropperSrc.value  = ''
}

function editPhoto() {
  // Re-open cropper on the already-previewed photo
  cropperSrc.value  = photoPreview.value
  showCropper.value = true
}

function removePhoto() {
  photoPreview.value = ''
  showMenu.value = false
}

// ── Photo dropdown menu ───────────────────────────────────────────────────────
const showMenu   = ref(false)
const menuBtnRef = ref(null)

function toggleMenu() { showMenu.value = !showMenu.value }

function menuAction(fn) {
  showMenu.value = false
  fn()
}

function viewPhoto() {
  if (photoPreview.value) showPhotoModal.value = true
}

function onDocClick(e) {
  if (menuBtnRef.value && !menuBtnRef.value.contains(e.target)) {
    showMenu.value = false
  }
}
onMounted(()  => document.addEventListener('mousedown', onDocClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocClick))

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(s) {
  if (!s) return '—'
  const p = s.split('-')
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s
}

// ── Info form (admin only) ────────────────────────────────────────────────────
const infoForm = ref({
  name:         auth.user?.name || '',
  email:        auth.user?.email || '',
  phone:        auth.user?.phone || '',
  dob:          auth.user?.dob || '',
  license_no:   auth.user?.license_no || '',
  license_date: auth.user?.license_date || '',
  date_joined:  auth.user?.date_joined || '',
})

// ── Password form ─────────────────────────────────────────────────────────────
const pwForm = ref({
  password:              '',
  password_confirmation: '',
})

// ── Save handlers ─────────────────────────────────────────────────────────────
async function savePhoto() {
  saving.value  = true
  try {
    const { data } = await profileApi.update({ photo: photoPreview.value || null })
    auth.setUser(data.user)
    originalPhoto.value = photoPreview.value   // mark as saved — hides the button again
    toast.success('Profile photo updated successfully.', { title: 'Photo Updated' })
  } catch (e) {
    toast.error(e.response?.data?.message || 'Failed to update photo.', { title: 'Photo Update Failed' })
  } finally {
    saving.value = false
  }
}

async function saveInfo() {
  saving.value  = true
  try {
    const payload = { ...infoForm.value }
    Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
    const { data } = await profileApi.update(payload)
    auth.setUser(data.user)
    toast.success('Profile information updated successfully.', { title: 'Profile Updated' })
  } catch (e) {
    const errs = e.response?.data?.errors
    const message = errs
      ? Object.values(errs).flat().join(' ')
      : (e.response?.data?.message || 'Failed to update profile.')
    toast.error(message, { title: 'Profile Update Failed' })
  } finally {
    saving.value = false
  }
}

async function savePassword() {
  if (!pwForm.value.password) {
    toast.warning('Please enter a new password.', { title: 'Password Required' })
    return
  }
  if (pwForm.value.password !== pwForm.value.password_confirmation) {
    toast.warning('Passwords do not match.', { title: 'Password Mismatch' })
    return
  }
  saving.value = true
  try {
    await profileApi.update({
      password:              pwForm.value.password,
      password_confirmation: pwForm.value.password_confirmation,
    })
    pwForm.value = { password: '', password_confirmation: '' }
    toast.success('Password changed successfully.', { title: 'Password Updated' })
  } catch (e) {
    const errs = e.response?.data?.errors
    const message = errs
      ? Object.values(errs).flat().join(' ')
      : (e.response?.data?.message || 'Failed to change password.')
    toast.error(message, { title: 'Password Update Failed' })
  } finally {
    saving.value = false
  }
}

function userInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
</script>

<template>
  <div class="pv">

    <!-- ── Photo cropper modal ────────────────────────────────── -->
    <PhotoCropper
      v-if="showCropper && cropperSrc"
      :src="cropperSrc"
      @crop="onCrop"
      @cancel="onCropCancel"
    />

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="pv-file-hidden"
      @change="onPhotoChange"
    />

    <!-- ── Banner ──────────────────────────────────────────────── -->
    <div class="pv-banner">
      <div class="pv-banner-left">
        <div class="pv-banner-icon">
          <UserIcon :size="20" />
        </div>
        <div>
          <h1 class="pv-banner-title">My Profile</h1>
          <p class="pv-banner-sub">{{ isAdmin ? 'Account Settings' : 'Update photo &amp; password' }}</p>
        </div>
      </div>
      <div :class="['pv-role-badge', isAdmin ? 'pv-role--admin' : 'pv-role--driver']">
        {{ isAdmin ? 'Admin' : 'Driver' }}
      </div>
    </div>
    <div class="pv-grid">

      <!-- ── Photo lightbox modal ──────────────────────────────── -->
      <Teleport to="body">
        <transition name="pv-modal">
          <div v-if="showPhotoModal" class="pv-lightbox" @click.self="showPhotoModal = false">
            <div class="pv-lightbox-box">
              <button class="pv-lightbox-close" aria-label="Close" @click="showPhotoModal = false">
                <CloseIcon :size="18" :stroke-width="2.5" />
              </button>
              <img :src="photoPreview" class="pv-lightbox-img" alt="Profile photo" />
            </div>
          </div>
        </transition>
      </Teleport>

      <!-- ── Photo card ────────────────────────────────────────── -->
      <div class="pv-card pv-card--photo">

        <!-- Card header — title inline with three-dot button -->
        <div class="pv-card-hd pv-card-hd--row">
          <span class="pv-card-title">Profile Photo</span>
          <!-- Three-dot menu button -->
          <div ref="menuBtnRef" class="pv-menu-wrap">
            <button class="pv-menu-btn" type="button" aria-label="Photo options" @click="toggleMenu">
              <MoreIcon :size="18" />
            </button>

            <!-- Dropdown -->
            <transition name="pv-menu">
              <div v-if="showMenu" class="pv-dropdown" role="menu">
                <!-- View (only when photo set) -->
                <button
                  v-if="photoPreview"
                  class="pv-dropdown-item"
                  role="menuitem"
                  @click="menuAction(viewPhoto)"
                >
                  <ViewIcon :size="16" />
                  View image
                </button>

                <!-- Change / Upload -->
                <button class="pv-dropdown-item" role="menuitem" @click="menuAction(openFilePicker)">
                  <PhotoIcon :size="16" />
                  {{ photoPreview ? 'Change photo' : 'Upload photo' }}
                </button>

                <!-- Adjust (only when photo set) -->
                <button
                  v-if="photoPreview"
                  class="pv-dropdown-item"
                  role="menuitem"
                  @click="menuAction(editPhoto)"
                >
                  <SearchIcon :size="16" />
                  Adjust position
                </button>

                <!-- Divider + Remove (only when photo set) -->
                <template v-if="photoPreview">
                  <div class="pv-dropdown-divider" />
                  <button
                    class="pv-dropdown-item pv-dropdown-item--danger"
                    role="menuitem"
                    @click="menuAction(removePhoto)"
                  >
                    <TrashIcon :size="16" />
                    Remove photo
                  </button>
                </template>
              </div>
            </transition>
          </div>
        </div>

        <!-- Avatar (centred, decorative only — menu handles actions) -->
        <div class="pv-photo-body">
          <div class="pv-avatar-wrap">
            <img v-if="photoPreview" :src="photoPreview" class="pv-avatar-img" alt="Profile photo" />
            <div v-else class="pv-avatar-init">{{ userInitials(auth.user?.name) }}</div>
          </div>
          <p class="pv-photo-name">{{ auth.user?.name || 'Your Name' }}</p>
          <p class="pv-photo-role">{{ isAdmin ? 'Administrator' : 'Driver' }}</p>
        </div>

        <!-- Save footer — only visible when photo has unsaved changes -->
        <transition name="pv-footer">
          <div v-if="hasPhotoChange" class="pv-photo-footer">
            <button class="pv-btn-save pv-btn-save--full" :disabled="saving" @click="savePhoto">
              {{ saving ? 'Saving…' : 'Save Photo' }}
            </button>
          </div>
        </transition>
      </div>

      <!-- ── Info card (admin only) ─────────────────────────────── -->
      <div v-if="isAdmin" class="pv-card pv-card--info">
        <div class="pv-card-hd">
          <span class="pv-card-title">Personal Information</span>
          <span class="pv-card-sub">Name, email, phone &amp; details</span>
        </div>
        <form class="pv-card-body" @submit.prevent="saveInfo">
          <div class="pv-form-grid">
            <div class="pv-field pv-field--full">
              <label class="pv-label">Full Name</label>
              <input v-model="infoForm.name" class="pv-input" type="text" required placeholder="Your full name" />
            </div>
            <div class="pv-field pv-field--full">
              <label class="pv-label">Email Address</label>
              <input v-model="infoForm.email" class="pv-input" type="email" required placeholder="you@example.com" />
            </div>
            <div class="pv-field">
              <label class="pv-label">Phone Number</label>
              <input v-model="infoForm.phone" class="pv-input" type="tel" placeholder="e.g. 012-3456789" />
            </div>
            <div class="pv-field">
              <label class="pv-label">Date of Birth</label>
              <input v-model="infoForm.dob" class="pv-input" type="date" />
            </div>
            <div class="pv-field">
              <label class="pv-label">License No.</label>
              <input v-model="infoForm.license_no" class="pv-input pv-input--mono" type="text" placeholder="e.g. D12345678" />
            </div>
            <div class="pv-field">
              <label class="pv-label">License Expiry Date</label>
              <input v-model="infoForm.license_date" class="pv-input" type="date" />
            </div>
            <div class="pv-field">
              <label class="pv-label">Date Joined Company</label>
              <input v-model="infoForm.date_joined" class="pv-input" type="date" />
            </div>
          </div>
          <div class="pv-card-foot">
            <button type="submit" class="pv-btn-save" :disabled="saving">
              {{ saving ? 'Saving…' : 'Save Information' }}
            </button>
          </div>
        </form>
      </div>

      <!-- ── Driver info (read-only) ────────────────────────────── -->
      <div v-else class="pv-card pv-card--info-ro">
        <div class="pv-card-hd">
          <span class="pv-card-title">Account Information</span>
        </div>
        <div class="pv-card-body">
          <div class="pv-info-rows">
            <div class="pv-info-row">
              <span class="pv-info-label">Name</span>
              <span class="pv-info-val">{{ auth.user?.name || '—' }}</span>
            </div>
            <div v-if="auth.user?.driver_id" class="pv-info-row">
              <span class="pv-info-label">Driver ID</span>
              <span class="pv-info-val pv-info-val--mono">{{ auth.user.driver_id }}</span>
            </div>
            <div class="pv-info-row">
              <span class="pv-info-label">Email</span>
              <span class="pv-info-val">{{ auth.user?.email || '—' }}</span>
            </div>
            <div class="pv-info-row">
              <span class="pv-info-label">Phone</span>
              <span class="pv-info-val">{{ auth.user?.phone || '—' }}</span>
            </div>
            <div class="pv-info-row">
              <span class="pv-info-label">Date of Birth</span>
              <span class="pv-info-val">{{ formatDate(auth.user?.dob) }}</span>
            </div>
            <div class="pv-info-row">
              <span class="pv-info-label">Date Joined</span>
              <span class="pv-info-val">{{ formatDate(auth.user?.date_joined) }}</span>
            </div>
          </div>
          <p class="pv-ro-note">
            <InfoIcon :size="15" />
            Personal details can only be updated by an administrator.
          </p>
        </div>
      </div>

      <!-- ── Password card ─────────────────────────────────────── -->
      <div class="pv-card pv-card--password">
        <div class="pv-card-hd">
          <span class="pv-card-title">Change Password</span>
          <span class="pv-card-sub">Use a strong, unique password</span>
        </div>
        <form class="pv-card-body" @submit.prevent="savePassword">
          <div class="pv-field">
            <label class="pv-label">New Password</label>
            <input
              v-model="pwForm.password"
              class="pv-input"
              type="password"
              placeholder="Min. 8 characters"
              autocomplete="new-password"
            />
          </div>
          <div class="pv-field">
            <label class="pv-label">Confirm New Password</label>
            <input
              v-model="pwForm.password_confirmation"
              class="pv-input"
              type="password"
              placeholder="Repeat password"
              autocomplete="new-password"
            />
          </div>
          <div class="pv-card-foot">
            <button type="submit" class="pv-btn-save" :disabled="saving">
              {{ saving ? 'Saving…' : 'Change Password' }}
            </button>
          </div>
        </form>
      </div>

    </div><!-- /pv-grid -->
  </div>
</template>

<style scoped>
.pv { min-width: 0; overflow: hidden; }
.pv-file-hidden { display: none; }

/* ── Banner ──────────────────────────────────────────────────── */
.pv-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm);
  padding: 16px 20px; margin-bottom: 20px;
  position: relative; overflow: hidden;
}
.pv-banner::before {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #7C3AED, var(--c-accent));
  border-radius: var(--r-xl) var(--r-xl) 0 0;
}
@media (min-width: 640px) { .pv-banner { padding: 18px 24px; margin-bottom: 24px; } }

.pv-banner-left { display: flex; align-items: center; gap: 12px; }
.pv-banner-icon {
  width: 42px; height: 42px; border-radius: var(--r-lg); flex-shrink: 0;
  background: #EDE9FE; border: 1.5px solid rgba(124,58,237,0.15);
  display: flex; align-items: center; justify-content: center; color: #7C3AED;
}
.pv-banner-icon svg { width: 20px; height: 20px; }
.pv-banner-title { font-size: 1.125rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.02em; margin-bottom: 1px; }
@media (min-width: 640px) { .pv-banner-title { font-size: 1.25rem; } }
.pv-banner-sub { font-size: 0.8125rem; color: var(--c-text-3); }

.pv-role-badge {
  font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.07em;
  text-transform: uppercase; padding: 4px 12px; border-radius: 20px;
}
.pv-role--admin  { background: #DBEAFE; color: #1D4ED8; }
.pv-role--driver { background: #D1FAE5; color: #047857; }

/* ── Grid layout ─────────────────────────────────────────────── */
.pv-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .pv-grid {
    grid-template-columns: 260px 1fr;
    align-items: start;
  }
  .pv-card--photo    { grid-column: 1; grid-row: 1 / span 2; }
  .pv-card--info     { grid-column: 2; grid-row: 1; }
  .pv-card--info-ro  { grid-column: 2; grid-row: 1; }
  .pv-card--password { grid-column: 2; grid-row: 2; }
}

/* ── Cards ───────────────────────────────────────────────────── */
.pv-card {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: var(--r-xl); box-shadow: var(--sh-sm); overflow: hidden;
}
.pv-card-hd {
  padding: 14px 18px 12px; border-bottom: 1px solid var(--c-border-light);
  display: flex; flex-direction: column; gap: 2px;
}
.pv-card-title { font-size: 0.9375rem; font-weight: 600; color: var(--c-text-1); }
.pv-card-sub { font-size: 0.75rem; color: var(--c-text-3); }
.pv-card-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.pv-card-foot { display: flex; justify-content: flex-end; padding-top: 4px; }

/* ── Photo card ──────────────────────────────────────────────── */

/* Avatar centred display */
.pv-photo-body {
  display: flex; flex-direction: column; align-items: center;
  gap: 10px; padding: 28px 18px 24px;
}
.pv-avatar-wrap {
  width: 96px; height: 96px; border-radius: 50%;
  overflow: hidden; border: 3px solid var(--c-border); box-shadow: var(--sh-sm);
  background: var(--c-accent-tint);
}
.pv-avatar-img  { width: 100%; height: 100%; object-fit: cover; display: block; }
.pv-avatar-init {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: var(--c-accent); font-size: 2rem; font-weight: 700; letter-spacing: -0.03em;
}
.pv-photo-name { font-size: 0.9375rem; font-weight: 700; color: var(--c-text-1); letter-spacing: -0.01em; }
.pv-photo-role { font-size: 0.75rem;   color: var(--c-text-3); }

/* ── Card header row override for photo card ─────────────────── */
.pv-card-hd--row {
  flex-direction: row !important;
  align-items: center !important;
  gap: 0 !important;
}

/* ── Three-dot menu ──────────────────────────────────────────── */
.pv-menu-wrap { position: relative; margin-left: auto; }

.pv-menu-btn {
  width: 30px; height: 30px; border-radius: 7px; border: none;
  background: transparent; cursor: pointer; color: var(--c-text-3);
  display: flex; align-items: center; justify-content: center;
  transition: background var(--dur), color var(--dur);
}
.pv-menu-btn svg { width: 18px; height: 18px; }
.pv-menu-btn:hover { background: var(--c-bg); color: var(--c-text-1); }

/* Dropdown panel */
.pv-dropdown {
  position: absolute; top: calc(100% + 6px); right: 0;
  min-width: 190px;
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 12px; box-shadow: var(--sh-xl);
  padding: 5px; z-index: 100;
  display: flex; flex-direction: column;
}

.pv-dropdown-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 8px 10px; border: none; border-radius: 8px;
  background: transparent; cursor: pointer; text-align: left;
  font-size: 0.875rem; font-weight: 500; color: var(--c-text-1);
  transition: background var(--dur);
}
.pv-dropdown-item svg { width: 15px; height: 15px; flex-shrink: 0; color: var(--c-text-3); }
.pv-dropdown-item:hover { background: var(--c-bg); }
.pv-dropdown-item--danger       { color: var(--c-red); }
.pv-dropdown-item--danger svg   { color: var(--c-red); }
.pv-dropdown-item--danger:hover { background: var(--c-red-tint); }

.pv-dropdown-divider { height: 1px; background: var(--c-border-light); margin: 4px 0; }

/* Dropdown open/close animation */
.pv-menu-enter-active, .pv-menu-leave-active { transition: opacity 0.12s, transform 0.12s; }
.pv-menu-enter-from, .pv-menu-leave-to { opacity: 0; transform: translateY(-6px) scale(0.97); }

/* ── Save footer — animated in/out ──────────────────────────── */
.pv-photo-footer {
  padding: 14px 18px;
  border-top: 1px solid var(--c-border-light);
  background: var(--c-bg);
}
.pv-footer-enter-active, .pv-footer-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden; max-height: 80px;
}
.pv-footer-enter-from, .pv-footer-leave-to { max-height: 0; opacity: 0; }

/* ── Photo lightbox modal ────────────────────────────────────── */
.pv-lightbox {
  position: fixed; inset: 0; z-index: 400;
  background: rgba(0,0,0,0.80); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}
.pv-lightbox-box {
  position: relative;
  max-width: min(480px, 100%);
  width: 100%;
  display: flex; align-items: center; justify-content: center;
}
.pv-lightbox-img {
  width: 100%; max-width: 420px;
  border-radius: 50%; aspect-ratio: 1 / 1;
  object-fit: cover;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
  border: 3px solid rgba(255,255,255,0.15);
  /* responsive on very small screens */
  max-height: 80dvh;
}
.pv-lightbox-close {
  position: absolute; top: -14px; right: -14px;
  width: 34px; height: 34px; border-radius: 50%;
  background: rgba(255,255,255,0.15); backdrop-filter: blur(4px);
  border: 1.5px solid rgba(255,255,255,0.25);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #fff; transition: background 0.15s;
}
.pv-lightbox-close svg { width: 14px; height: 14px; }
.pv-lightbox-close:hover { background: rgba(255,255,255,0.28); }

/* Lightbox open/close animation */
.pv-modal-enter-active, .pv-modal-leave-active { transition: opacity 0.18s ease; }
.pv-modal-enter-from,  .pv-modal-leave-to      { opacity: 0; }
.pv-modal-enter-active .pv-lightbox-box,
.pv-modal-leave-active .pv-lightbox-box        { transition: transform 0.2s ease; }
.pv-modal-enter-from   .pv-lightbox-box        { transform: scale(0.88); }
.pv-modal-leave-to     .pv-lightbox-box        { transform: scale(0.88); }

/* ── Info form ───────────────────────────────────────────────── */
.pv-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 640px) { .pv-form-grid { grid-template-columns: 1fr; } }

.pv-field { display: flex; flex-direction: column; gap: 5px; }
.pv-field--full { grid-column: 1 / -1; }
.pv-label { font-size: 0.8125rem; font-weight: 600; color: var(--c-text-2); }

.pv-input {
  width: 100%; padding: 8px 12px; border: 1px solid var(--c-border); border-radius: 8px;
  background: var(--c-bg); color: var(--c-text-1); font-size: 0.875rem;
  transition: border-color var(--dur); box-sizing: border-box;
}
.pv-input:focus { outline: none; border-color: var(--c-accent); box-shadow: 0 0 0 3px var(--c-accent-ring); }
.pv-input--mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; letter-spacing: 0.04em; }

/* ── Read-only info (driver) ─────────────────────────────────── */
.pv-info-rows { display: flex; flex-direction: column; }
.pv-info-row {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 8px 0; border-bottom: 1px solid var(--c-border-light);
}
.pv-info-row:last-child { border-bottom: none; }
.pv-info-label { font-size: 0.8125rem; color: var(--c-text-3); font-weight: 500; }
.pv-info-val { font-size: 0.875rem; color: var(--c-text-1); font-weight: 600; text-align: right; }
.pv-info-val--mono { font-family: 'JetBrains Mono', 'Fira Code', monospace; letter-spacing: 0.04em; }

.pv-ro-note {
  display: flex; align-items: flex-start; gap: 8px;
  font-size: 0.8125rem; color: var(--c-text-3);
  background: var(--c-bg); border: 1px solid var(--c-border-light);
  border-radius: 8px; padding: 10px 12px; line-height: 1.5;
}
.pv-ro-note svg { width: 15px; height: 15px; flex-shrink: 0; margin-top: 1px; }

/* ── Save button ─────────────────────────────────────────────── */
.pv-btn-save {
  background: var(--c-accent); color: #fff; border: none; border-radius: 8px;
  padding: 9px 20px; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; transition: opacity var(--dur);
}
.pv-btn-save--full { width: 100%; }
.pv-btn-save:hover:not(:disabled) { opacity: 0.88; }
.pv-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
