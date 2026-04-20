<!--
  DriverLocationMap — Leaflet map showing driver trip locations.

  Props:
    locations – array of { driver_name, driver_id, location_name, lat, lng, trips_count }
    loading   – show skeleton while fetching
    period    – 'today' | 'week' | 'month' (display label)
-->
<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  locations: { type: Array, default: () => [] },
  loading:   { type: Boolean, default: false },
  period:    { type: String, default: 'today' },
})

const mapContainer = ref(null)
let map = null
let markersLayer = null

// Custom marker icon
const pinIcon = L.divIcon({
  className: 'dlm-pin',
  html: `<div class="dlm-pin-inner"></div><div class="dlm-pin-pulse"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function initMap() {
  if (!mapContainer.value || map) return
  map = L.map(mapContainer.value, {
    center: [3.1, 101.6],  // Malaysia center
    zoom: 10,
    zoomControl: false,
    attributionControl: false,
  })

  // Clean, modern tile layer
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19,
  }).addTo(map)

  // Zoom control bottom-right
  L.control.zoom({ position: 'bottomright' }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  renderMarkers()
}

function renderMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()

  if (!props.locations.length) return

  const bounds = []
  props.locations.forEach(loc => {
    const marker = L.marker([loc.lat, loc.lng], { icon: pinIcon })
    marker.bindPopup(`
      <div class="dlm-popup">
        <strong>${loc.driver_name || loc.location_name}</strong>
        <span>${loc.location_name}</span>
        <span class="dlm-popup-trips">${loc.trips_count} trip${loc.trips_count !== 1 ? 's' : ''}</span>
      </div>
    `, { className: 'dlm-popup-wrap' })
    markersLayer.addLayer(marker)
    bounds.push([loc.lat, loc.lng])
  })

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 })
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 12)
  }
}

watch(() => props.locations, () => {
  nextTick(renderMarkers)
})

onMounted(() => {
  nextTick(initMap)
})
</script>

<template>
  <div class="dlm-card">
    <div class="dlm-header">
      <div class="dlm-header-left">
        <div class="dlm-header-ico">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <div>
          <p class="dlm-title">Driver Locations</p>
          <p class="dlm-sub">Trip destinations · {{ period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month' }}</p>
        </div>
      </div>
      <div class="dlm-count" v-if="!loading">
        <span class="dlm-count-num">{{ locations.length }}</span>
        <span class="dlm-count-label">locations</span>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="dlm-skeleton">
      <div class="dlm-skel-shimmer"></div>
    </div>

    <!-- Map -->
    <div v-else class="dlm-map-wrap">
      <div ref="mapContainer" class="dlm-map"></div>
      <!-- Empty state -->
      <div v-if="!locations.length" class="dlm-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <p>No location data for this period</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dlm-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 14px;
  overflow: hidden;
}

.dlm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--c-border);
}
.dlm-header-left { display: flex; align-items: center; gap: 0.75rem; }
.dlm-header-ico {
  width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
  background: rgba(29,78,216,0.1); color: #1D4ED8;
  display: grid; place-items: center;
}
.dlm-title { font-size: 0.875rem; font-weight: 700; color: var(--c-text); margin: 0 0 2px; }
.dlm-sub   { font-size: 0.76rem; color: var(--c-text-2); margin: 0; }

.dlm-count { text-align: right; }
.dlm-count-num   { font-size: 1.25rem; font-weight: 800; color: var(--c-accent); display: block; line-height: 1; }
.dlm-count-label { font-size: 0.68rem; color: var(--c-text-3); text-transform: uppercase; letter-spacing: .06em; }

/* Map */
.dlm-map-wrap { position: relative; }
.dlm-map { height: 280px; width: 100%; z-index: 1; }

/* Skeleton */
.dlm-skeleton {
  height: 280px;
  background: var(--c-bg);
  position: relative;
  overflow: hidden;
}
.dlm-skel-shimmer {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%);
  animation: dlm-shimmer 1.8s infinite;
}
@keyframes dlm-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

/* Empty */
.dlm-empty {
  position: absolute; inset: 0; z-index: 2;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; color: var(--c-text-3); font-size: 0.84rem;
  background: var(--c-bg);
}
.dlm-empty svg { opacity: 0.4; }

@media (max-width: 768px) {
  .dlm-map { height: 240px; }
  .dlm-skeleton { height: 240px; }
  .dlm-header { padding: 0.75rem 1rem; }
  .dlm-title { font-size: 0.8125rem; }
}
@media (max-width: 640px) {
  .dlm-map { height: 200px; }
  .dlm-skeleton { height: 200px; }
  .dlm-count-num { font-size: 1rem; }
}
@media (max-width: 360px) {
  .dlm-map { height: 180px; }
  .dlm-skeleton { height: 180px; }
  .dlm-header { gap: 0.5rem; }
  .dlm-header-ico { width: 26px; height: 26px; }
}
</style>

<!-- Global styles for Leaflet markers (unscoped) -->
<style>
.dlm-pin {
  background: transparent !important;
  border: none !important;
}
.dlm-pin-inner {
  width: 10px; height: 10px;
  background: #1D4ED8;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(29,78,216,0.4);
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
}
.dlm-pin-pulse {
  width: 24px; height: 24px;
  background: rgba(29,78,216,0.15);
  border-radius: 50%;
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  animation: dlm-pulse 2.5s ease-out infinite;
}
@keyframes dlm-pulse {
  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
}

.dlm-popup-wrap .leaflet-popup-content-wrapper {
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  padding: 0;
}
.dlm-popup-wrap .leaflet-popup-content {
  margin: 0;
}
.dlm-popup {
  display: flex; flex-direction: column; gap: 2px;
  padding: 10px 14px;
  font-family: 'Hanken Grotesk', system-ui, sans-serif;
  font-size: 0.8rem;
}
.dlm-popup strong { font-size: 0.84rem; color: #0F172A; }
.dlm-popup span { color: #64748B; }
.dlm-popup-trips { font-weight: 600; color: #1D4ED8 !important; }

[data-theme="dark"] .dlm-pin-inner { background: #60A5FA; box-shadow: 0 2px 6px rgba(96,165,250,0.5); }
[data-theme="dark"] .dlm-pin-pulse { background: rgba(96,165,250,0.2); }
</style>
