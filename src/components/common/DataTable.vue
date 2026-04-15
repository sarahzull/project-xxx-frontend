<!--
  DataTable — responsive table with mobile card fallback.

  Props:
    columns       – array of { key, label, sortable? }
    rows          – data rows
    loading       – show loading state
    emptyMessage  – shown when rows is empty
    flat          – removes the card wrapper (use when the parent is already a card)
    sortKey       – currently sorted column key
    sortDir       – 'asc' | 'desc'

  Emits:
    sort(key)     – emitted when a sortable column header is clicked
-->
<script setup>
import SortIcon from '../icons/SortIcon.vue'

defineProps({
  columns:      { type: Array,   required: true },
  rows:         { type: Array,   required: true },
  loading:      { type: Boolean, default: false },
  emptyMessage: { type: String,  default: 'No data available.' },
  flat:         { type: Boolean, default: false },
  sortKey:      { type: String,  default: '' },
  sortDir:      { type: String,  default: 'asc' },
})
const emit = defineEmits(['sort'])
</script>

<template>
  <div>
    <!-- Desktop table -->
    <div :class="['tbl-wrap', 'd-md-up', flat ? 'tbl-wrap-flat' : '']">
      <div class="tbl-scroll">
        <table class="tbl">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
                :class="col.sortable ? 'tbl-th-sort' : ''"
                @click="col.sortable ? emit('sort', col.key) : undefined"
              >
                <span class="tbl-th-inner">
                  {{ col.label }}
                  <span
                    v-if="col.sortable"
                    :class="['tbl-sort-icon', sortKey === col.key ? 'sort-active' : '']"
                    aria-hidden="true"
                  >
                    <SortIcon :active="sortKey === col.key" :dir="sortDir" />
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td :colspan="columns.length" class="tbl-empty">Loading…</td>
            </tr>
            <tr v-else-if="rows.length === 0">
              <td :colspan="columns.length" class="tbl-empty">{{ emptyMessage }}</td>
            </tr>
            <tr v-for="(row, idx) in rows" :key="idx">
              <td v-for="col in columns" :key="col.key">
                <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                  {{ row[col.key] }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile cards -->
    <div :class="['tbl-cards', 'd-md-dn', flat ? 'tbl-cards--flat' : '']">
      <div v-if="loading" class="tbl-m-empty">Loading…</div>
      <div v-else-if="rows.length === 0" class="tbl-m-empty">{{ emptyMessage }}</div>
      <div v-for="(row, idx) in rows" :key="idx" :class="['tbl-card', flat ? 'tbl-card--flat' : '']">

        <!-- Top row: primary info + actions -->
        <div class="tbl-card-top">
          <!-- First non-actions column as primary label -->
          <div class="tbl-card-primary">
            <slot
              :name="`cell-${columns.filter(c => c.key !== 'actions')[0]?.key}`"
              :row="row"
              :value="row[columns.filter(c => c.key !== 'actions')[0]?.key]"
            >
              {{ row[columns.filter(c => c.key !== 'actions')[0]?.key] }}
            </slot>
          </div>
          <!-- Actions -->
          <div v-if="columns.some(c => c.key === 'actions')" class="tbl-card-actions">
            <slot name="cell-actions" :row="row" :value="row['actions']" />
          </div>
        </div>

        <!-- Remaining columns as key-value rows -->
        <div class="tbl-card-body">
          <div
            v-for="col in columns.filter(c => c.key !== 'actions').slice(1)"
            :key="col.key"
            class="tbl-card-row"
          >
            <span class="tbl-card-label">{{ col.label }}</span>
            <span class="tbl-card-val">
              <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </span>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Flat mode — strip card chrome so it blends into a parent card */
.tbl-wrap-flat {
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

/* Sortable column header */
.tbl-th-sort {
  cursor: pointer;
  user-select: none;
  transition: background var(--dur);
}
.tbl-th-sort:hover { background: var(--c-bg); }

/* Flex wrapper for text + sort icon */
.tbl-th-inner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

/* Sort icon */
.tbl-sort-icon {
  display: inline-flex;
  align-items: center;
  width: 9px;
  height: 14px;
  flex-shrink: 0;
  color: var(--c-text-3);
  opacity: 0.5;
  transition: opacity var(--dur), color var(--dur);
}
.tbl-th-sort:hover .tbl-sort-icon { opacity: 0.8; }
.tbl-sort-icon.sort-active {
  color: var(--c-accent);
  opacity: 1;
}
.tbl-sort-icon svg { width: 100%; height: 100%; display: block; }
</style>
