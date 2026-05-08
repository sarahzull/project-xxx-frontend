<!--
  PhotoCropper — modal for repositioning and zooming a profile photo before saving.

  Props:
    src   – data URL of the selected image

  Emits:
    crop(dataUrl)  – JPEG data URL of the cropped square image
    cancel()
-->
<script setup>
import { ref, computed } from 'vue'
import { useBodyScrollLock } from '../../composables/useBodyScrollLock'

const props = defineProps({
  src: { type: String, required: true },
})
const emit = defineEmits(['crop', 'cancel'])
import { CloseIcon, SearchIcon } from '../icons/index.js'

useBodyScrollLock(ref(true))

// ── Constants ─────────────────────────────────────────────────────────────────
const STAGE    = 300   // px – viewing square
const CIRCLE_R = 126   // px – crop circle radius  (252px diameter)
const OUTPUT   = 320   // px – output canvas size

// ── Image state ───────────────────────────────────────────────────────────────
const imgEl    = ref(null)
const natW     = ref(0)
const natH     = ref(0)
const baseScale = ref(1) // scale that makes the shorter side = 2×CIRCLE_R at zoom 1
const zoom     = ref(1)  // user multiplier (1 – 4)
const offset   = ref({ x: 0, y: 0 })

const dispScale = computed(() => baseScale.value * zoom.value)

function onLoad() {
  natW.value = imgEl.value.naturalWidth
  natH.value = imgEl.value.naturalHeight
  const shortSide = Math.min(natW.value, natH.value)
  baseScale.value = (CIRCLE_R * 2) / shortSide
  zoom.value = 1
  offset.value = { x: 0, y: 0 }
}

// ── Clamp offset so image always covers the circle ────────────────────────────
function clamp(ox, oy) {
  const dw   = natW.value * dispScale.value
  const dh   = natH.value * dispScale.value
  const maxX = Math.max(0, dw / 2 - CIRCLE_R)
  const maxY = Math.max(0, dh / 2 - CIRCLE_R)
  return {
    x: Math.min(maxX, Math.max(-maxX, ox)),
    y: Math.min(maxY, Math.max(-maxY, oy)),
  }
}

// ── Drag ──────────────────────────────────────────────────────────────────────
let dragging   = false
let dragStart  = { x: 0, y: 0 }
let snapOffset = { x: 0, y: 0 }

function onPointerDown(e) {
  dragging   = true
  dragStart  = { x: e.clientX, y: e.clientY }
  snapOffset = { ...offset.value }
  e.currentTarget.setPointerCapture(e.pointerId)
  e.preventDefault()
}
function onPointerMove(e) {
  if (!dragging) return
  offset.value = clamp(
    snapOffset.x + (e.clientX - dragStart.x),
    snapOffset.y + (e.clientY - dragStart.y),
  )
}
function onPointerUp() { dragging = false }

// ── Zoom controls ─────────────────────────────────────────────────────────────
const MIN_ZOOM = 1
const MAX_ZOOM = 4

function onZoomSlider(e) {
  zoom.value = parseFloat(e.target.value)
  offset.value = clamp(offset.value.x, offset.value.y)
}
function stepZoom(delta) {
  zoom.value = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat((zoom.value + delta).toFixed(2))))
  offset.value = clamp(offset.value.x, offset.value.y)
}

// ── Image CSS transform ───────────────────────────────────────────────────────
const imgStyle = computed(() => ({
  position:      'absolute',
  top:           '50%',
  left:          '50%',
  transformOrigin: 'center center',
  transform:     `translate(calc(-50% + ${offset.value.x}px), calc(-50% + ${offset.value.y}px)) scale(${dispScale.value})`,
  userSelect:    'none',
  pointerEvents: 'none',
  maxWidth:      'none',
  display:       'block',
}))

// ── Crop + emit ───────────────────────────────────────────────────────────────
function applyCrop() {
  const canvas = document.createElement('canvas')
  canvas.width  = OUTPUT
  canvas.height = OUTPUT
  const ctx = canvas.getContext('2d')

  // Source rectangle in original-image pixels:
  //   image center on stage = (STAGE/2 + offsetX, STAGE/2 + offsetY)
  //   crop circle top-left  = (STAGE/2 - CIRCLE_R, STAGE/2 - CIRCLE_R)
  //   → crop top-left relative to image top-left (display px):
  //       dw/2 - CIRCLE_R - offsetX
  //   → divide by dispScale to get original-image coords
  const ds   = dispScale.value
  const srcX = (natW.value * ds / 2 - CIRCLE_R - offset.value.x) / ds
  const srcY = (natH.value * ds / 2 - CIRCLE_R - offset.value.y) / ds
  const srcW = (CIRCLE_R * 2) / ds
  const srcH = (CIRCLE_R * 2) / ds

  // Circular clip on output canvas
  ctx.save()
  ctx.beginPath()
  ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(imgEl.value, srcX, srcY, srcW, srcH, 0, 0, OUTPUT, OUTPUT)
  ctx.restore()

  emit('crop', canvas.toDataURL('image/jpeg', 0.9))
}
</script>

<template>
  <Teleport to="body">
    <div class="pc-overlay" @click.self="emit('cancel')">
      <div class="pc-dialog" role="dialog" aria-modal="true" aria-label="Adjust photo">

        <!-- Header -->
        <div class="pc-header">
          <span class="pc-title">Adjust Photo</span>
          <button class="pc-close" aria-label="Close" @click="emit('cancel')">
            <CloseIcon :size="16" :stroke-width="2.5" />
          </button>
        </div>

        <!-- Stage -->
        <div class="pc-stage-wrap">
          <div
            class="pc-stage"
            :style="{ width: STAGE + 'px', height: STAGE + 'px' }"
            :class="{ 'pc-stage--drag': dragging }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
          >
            <!-- Source image -->
            <img
              ref="imgEl"
              :src="src"
              :style="imgStyle"
              alt=""
              draggable="false"
              @load="onLoad"
            />

            <!-- Dark vignette with circle cut-out (CSS mask) -->
            <div class="pc-vignette" :style="{
              '--r': CIRCLE_R + 'px',
              '--cx': STAGE / 2 + 'px',
              '--cy': STAGE / 2 + 'px',
            }" />

            <!-- Circle guide border -->
            <div class="pc-circle-border" :style="{
              width:  CIRCLE_R * 2 + 'px',
              height: CIRCLE_R * 2 + 'px',
            }" />

            <!-- Drag hint (shown only before first drag) -->
            <div class="pc-drag-hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="20" height="20" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 11.5V14m0-2.5V6a1.5 1.5 0 013 0m-3 5.5a1.5 1.5 0 00-3 0V14m6-10v2m0-2a1.5 1.5 0 013 0v5m0 0v3m0-3a1.5 1.5 0 013 0v2"/>
              </svg>
              Drag to reposition
            </div>
          </div>
        </div>

        <!-- Zoom controls -->
        <div class="pc-zoom-row">
          <button class="pc-zoom-btn" aria-label="Zoom out" @click="stepZoom(-0.1)">
            <SearchIcon :size="16" :stroke-width="2.5" />
          </button>
          <div class="pc-slider-wrap">
            <input
              class="pc-slider"
              type="range"
              :min="MIN_ZOOM"
              :max="MAX_ZOOM"
              step="0.01"
              :value="zoom"
              @input="onZoomSlider"
            />
          </div>
          <button class="pc-zoom-btn" aria-label="Zoom in" @click="stepZoom(0.1)">
            <SearchIcon :size="16" :stroke-width="2.5" />
          </button>
          <span class="pc-zoom-val">{{ Math.round(zoom * 100) }}%</span>
        </div>
        <p class="pc-zoom-hint">Scroll or drag the slider to zoom · Drag image to reposition</p>

        <!-- Actions -->
        <div class="pc-actions">
          <button class="pc-btn-cancel" type="button" @click="emit('cancel')">Cancel</button>
          <button class="pc-btn-apply" type="button" @click="applyCrop">Apply</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────── */
.pc-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}

/* ── Dialog ──────────────────────────────────────────────────── */
.pc-dialog {
  background: var(--c-surface); border: 1px solid var(--c-border);
  border-radius: 20px; box-shadow: var(--sh-xl);
  width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: 0; overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────── */
.pc-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--c-border-light);
}
.pc-title { font-size: 1rem; font-weight: 700; color: var(--c-text-1); }
.pc-close {
  width: 28px; height: 28px; border: none; background: none;
  cursor: pointer; color: var(--c-text-3); border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  transition: all var(--dur);
}
.pc-close svg { width: 14px; height: 14px; }
.pc-close:hover { background: var(--c-bg); color: var(--c-text-1); }

/* ── Stage wrapper ───────────────────────────────────────────── */
.pc-stage-wrap {
  display: flex; justify-content: center;
  padding: 20px 20px 12px;
  background: #111;
}

/* ── Stage (the crop canvas) ─────────────────────────────────── */
.pc-stage {
  position: relative;
  overflow: hidden;
  cursor: grab;
  border-radius: 8px;
  touch-action: none;
  flex-shrink: 0;
}
.pc-stage--drag { cursor: grabbing; }

/* ── Dark vignette with circle cut-out ───────────────────────── */
.pc-vignette {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.55);
  mask-image: radial-gradient(circle var(--r) at var(--cx) var(--cy), transparent 100%, black 100%);
  -webkit-mask-image: radial-gradient(circle var(--r) at var(--cx) var(--cy), transparent 100%, black 100%);
  pointer-events: none;
}

/* ── Circle guide border ─────────────────────────────────────── */
.pc-circle-border {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.7);
  box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
  pointer-events: none;
}

/* ── Drag hint ───────────────────────────────────────────────── */
.pc-drag-hint {
  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 5px;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  color: rgba(255,255,255,0.85); font-size: 0.6875rem; font-weight: 500;
  padding: 4px 10px; border-radius: 20px; pointer-events: none;
  white-space: nowrap;
}
.pc-drag-hint svg { width: 12px; height: 12px; }
.pc-stage--drag .pc-drag-hint,
.pc-stage:active .pc-drag-hint { opacity: 0; }

/* ── Zoom controls ───────────────────────────────────────────── */
.pc-zoom-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px 4px;
}

.pc-zoom-btn {
  width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
  border: 1.5px solid var(--c-border); background: var(--c-bg);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--c-text-2); transition: all var(--dur);
}
.pc-zoom-btn svg { width: 16px; height: 16px; }
.pc-zoom-btn:hover { border-color: var(--c-accent); color: var(--c-accent); background: var(--c-accent-tint); }

.pc-slider-wrap { flex: 1; display: flex; align-items: center; }
.pc-slider {
  -webkit-appearance: none; appearance: none;
  width: 100%; height: 4px; border-radius: 2px;
  background: var(--c-border); outline: none; cursor: pointer;
  accent-color: var(--c-accent);
}
.pc-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--c-accent); cursor: grab; border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.pc-slider::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 50%;
  background: var(--c-accent); cursor: grab; border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

.pc-zoom-val {
  font-size: 0.75rem; font-weight: 600; color: var(--c-text-3);
  min-width: 36px; text-align: right; flex-shrink: 0;
}

.pc-zoom-hint {
  font-size: 0.6875rem; color: var(--c-text-3); text-align: center;
  padding: 0 18px 12px;
}

/* ── Actions ─────────────────────────────────────────────────── */
.pc-actions {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 18px 16px; border-top: 1px solid var(--c-border-light);
}
.pc-btn-cancel {
  background: transparent; color: var(--c-text-2); border: 1px solid var(--c-border);
  border-radius: 8px; padding: 8px 16px; font-size: 0.875rem; font-weight: 500;
  cursor: pointer; transition: all var(--dur);
}
.pc-btn-cancel:hover { border-color: var(--c-text-2); color: var(--c-text-1); }
.pc-btn-apply {
  background: var(--c-accent); color: #fff; border: none; border-radius: 8px;
  padding: 8px 22px; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; transition: opacity var(--dur);
}
.pc-btn-apply:hover { opacity: 0.88; }
</style>
