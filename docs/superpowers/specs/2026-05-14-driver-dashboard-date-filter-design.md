# Driver Dashboard — Date Filter

**Date:** 2026-05-14
**File:** `src/views/dashboard/DriverDashboardView.vue`
**Status:** Approved

## Summary

Add a date period filter to the driver's own dashboard so all performance data (stat cards, monthly activity chart, trips table) reflects only the selected date range. Default period on load is This Month.

## Scope

- **In scope:** `DriverDashboardView.vue` only
- **Out of scope:** Admin dashboard, earnings view, payslips — no changes to those views
- **No backend changes required**

## Data Flow

### Before

Three separate API calls on mount:
1. `driverMeApi.profile()` → profile data
2. `driverMeApi.kmSummary()` → total trips, total KM, avg KM, monthly breakdown
3. `driverMeApi.trips()` → all trips, sliced to 10 for display

### After

Two API calls on mount:
1. `driverMeApi.profile()` → profile data (unchanged)
2. `driverMeApi.trips()` → all trips stored in `allTrips` ref

`kmSummary()` call is removed. All stats are computed client-side from `filteredTrips`.

## State

| Ref | Type | Default | Purpose |
|-----|------|---------|---------|
| `allTrips` | `Array` | `[]` | All trips fetched on mount, never mutated |
| `activePreset` | `String` | `'this-month'` | Active period chip selection |
| `customFrom` | `String\|null` | `null` | From date `YYYY-MM-DD`, used when preset is `custom` |
| `customTo` | `String\|null` | `null` | To date `YYYY-MM-DD`, used when preset is `custom` |

## Computed Properties

### `dateRange`
Derives `{ from: string, to: string } | null` from `activePreset`, `customFrom`, `customTo`.

| Preset | from | to |
|--------|------|----|
| `this-month` | First day of current month | Today |
| `last-month` | First day of last month | Last day of last month |
| `last-3-months` | First day of the month 3 months prior (e.g. May → Feb 1) | Today |
| `this-year` | Jan 1 of current year | Today |
| `all-time` | `null` (no filter) | `null` |
| `custom` | `customFrom` value | `customTo` value |

All dates compared as `YYYY-MM-DD` strings (trip `date` field already uses this format).

### `filteredTrips`
Filters `allTrips` against `dateRange`. If `dateRange` is `null` (All Time), returns all trips unfiltered.

### Stats (all derived from `filteredTrips`)
- `totalTrips` — `filteredTrips.length`
- `totalKm` — sum of `t.km_driven`
- `avgKm` — `totalKm / totalTrips`, rounded to 1 decimal (0 if no trips)
- `monthly` — grouped by `YYYY-MM`, sorted ascending, mapped to `{ month, label, trips, km }`

### `periodLabel`
Human-readable string shown in section labels.

| Preset | Label |
|--------|-------|
| `this-month` | `May 2026` (current month name + year) |
| `last-month` | `April 2026` |
| `last-3-months` | `Last 3 Months` |
| `this-year` | `2026` |
| `all-time` | `All Time` |
| `custom` | `01/05 – 14/05/2026` (formatted from/to) |

### `displayedTrips`
`filteredTrips` capped at 50 to avoid rendering issues with large datasets.

## Filter UI

A `.ddash-filter-strip` block placed between the `.ddash-quicklinks` row and the `MY PERFORMANCE` section label.

### Preset chips
- Rendered as `<button>` elements: `This Month`, `Last Month`, `Last 3 Months`, `This Year`, `All Time`, `Custom…`
- Active chip: accent green background (`--c-accent`), white text
- Inactive chip: surface background, border, text-2 colour
- Chips wrap on mobile (no horizontal scroll)

### Custom date row
- Shown only when `activePreset === 'custom'`
- Two `<input type="date">` fields (from / to) + an **Apply** button
- Apply is disabled unless both from and to fields are filled
- Apply commits the date values and triggers re-filter
- If the user clicks "Custom…" but hasn't applied yet, no filter change occurs until Apply is pressed
- Inline below the chips, not a modal or dropdown

## Section Labels

- `MY PERFORMANCE` → `MY PERFORMANCE · {{ periodLabel }}`
- `RECENT TRIPS` heading → `TRIPS · {{ periodLabel }}`
- Trip count badge shows `displayedTrips.length` records

## License Card

Always shown regardless of the active filter — it displays profile data (expiry date), not trip data. No change to its behaviour.

## Empty State

If `filteredTrips` is empty:
- Stat cards show `0` values
- Monthly chart shows existing "No trip history available yet." empty state
- Trips table shows existing "No trips recorded yet" empty state

## Responsive Behaviour

- Filter chips wrap to a second line on small screens (≤ 640px)
- Custom date inputs stack vertically on small screens

## Files Changed

| File | Change |
|------|--------|
| `src/views/dashboard/DriverDashboardView.vue` | All changes contained here |
| `src/api/driverMe.js` | No changes |
| Backend | No changes |
