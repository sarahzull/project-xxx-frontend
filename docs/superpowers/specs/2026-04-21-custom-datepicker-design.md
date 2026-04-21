# Custom Date Picker Components — Design Spec

**Date:** 2026-04-21
**Status:** Approved (design), pending implementation plan
**Author:** sarahzull + Claude

## Goal

Replace native `<input type="date">` across the app with a consistent, branded custom date picker. Ship two public components backed by a shared calendar primitive, so forms and filter bars both get a unified look without forking UI.

## Scope

**In scope:**
- New `CalendarPanel.vue` primitive (internal).
- New `DatePicker.vue` single-date component.
- Rewritten `DateRangePicker.vue` using the same primitive.
- New `DatePickerPopover.vue` positioning/dismiss wrapper.

**Out of scope (YAGNI):**
- Time-of-day selection.
- Multi-month side-by-side calendar view.
- Localization beyond English.
- Free-form typed date input.
- Migrating existing `<input type="date">` call sites — tracked as a follow-up PR after these components are merged.

## Component structure

Three files under `src/components/common/`:

### `CalendarPanel.vue` (internal primitive)

Renders the month grid, header nav, and Today/Clear footer buttons. Pure UI — no popover behavior.

**Props:**
- `mode: 'single' | 'range'` (default `'single'`)
- `modelValue`: `string` in single mode (ISO `YYYY-MM-DD`, or `''`)
- `from`, `to`: `string` in range mode (ISO, or `''`)
- `min`, `max`: `string` (ISO) — disables days outside this range
- `weekStart`: `0` (Sunday) — fixed for now; prop exists for future flex

**Events:**
- `select` — emits `string` in single mode, `{ from, to }` in range mode (only fires once the range has both ends)
- `clear` — fires when Clear button clicked
- `today` — fires when Today button clicked

**Internal state:**
- `viewYear`, `viewMonth` — which month is displayed
- `viewMode: 'days' | 'months'` — day grid or year/month picker grid
- `pendingStart` — in range mode, the first click's date (before the second click completes the range)
- `hoverDate` — in range mode, to render the range-preview highlight on hover

### `DatePickerPopover.vue` (internal wrapper)

Thin positioning wrapper. Handles:
- Click-outside detection (closes popover)
- Escape key (closes popover)
- Auto-flip placement (prefers below trigger; flips above if clipped)
- Focus trap while open; returns focus to trigger on close
- `role="dialog"`, `aria-label="Choose date"`

**Slot:** default — receives the calendar contents.
**Props:** `open: boolean`, `triggerEl: HTMLElement | null`.
**Events:** `close`.

### `DatePicker.vue` (public)

Single-date picker. Drop-in replacement for `<input type="date">`.

**Props:**
- `modelValue`: `string` (ISO or `''`)
- `variant: 'input' | 'chip'` (default `'input'`)
- `placeholder`: `string` (default `'Select date'`)
- `min`, `max`: `string` (ISO)
- `disabled`: `boolean`
- `ariaLabel`: `string` — screen-reader label for the trigger

**Events:**
- `update:modelValue` — ISO string or `''`

**Render:** trigger button (styled per `variant`) + `DatePickerPopover` containing a single-mode `CalendarPanel`.

### `DateRangePicker.vue` (rewrite of existing)

**Props:**
- `from`, `to`: `string` (ISO, v-modelable)
- `variant: 'input' | 'chip'` (default `'chip'` — matches current filter-bar usage)
- `presets`: array of preset keys (default `['today', 'week', 'month', 'last30']`; pass `[]` to hide)
- `min`, `max`: `string` (ISO)

**Events:**
- `update:from`, `update:to`

**Render:** trigger button + popover containing:
1. Preset chip row (if `presets` non-empty) — Today / This Week / This Month / Last 30 Days
2. `CalendarPanel` in range mode

Preset chip selection fills the calendar range and closes the popover. Clicking days in the calendar switches the active preset to `'custom'`.

## Behavior

### Trigger variants

**`variant="input"`** — matches existing form input look:
- Bordered box (1.5px solid `var(--c-border)`), radius 8px
- Height/padding mirroring `.uv-input` / `.pv-input`
- Calendar icon on the right
- Shows formatted date (`21/04/2026`) or placeholder text in `var(--c-text-3)`
- On focus: border `var(--c-accent)`, ring `var(--c-accent-ring)`

**`variant="chip"`** — matches filter-chip look:
- Rounded pill (`border-radius: var(--r-full)`)
- Calendar icon + text + chevron-down
- Background `var(--c-bg)`, border `var(--c-border)`
- On open: border `var(--c-accent)`, ring `var(--c-accent-ring)`

### Calendar panel

**Header:**
- Left arrow button, center text `"April 2026"` (clickable to enter month/year grid), right arrow button.
- In month/year grid mode: arrows page by year; 3x4 grid of month buttons for the shown year; clicking a month returns to day grid for that month.

**Day grid:**
- 7 columns, Sunday first (`Su Mo Tu We Th Fr Sa`).
- Shows full 6-week grid; previous/next month days rendered dimmed (opacity 0.4) but clickable — clicking jumps the header to that month.
- **Today:** accent ring outline (unselected).
- **Selected (single mode):** filled circle, `var(--c-accent)` background, white text.
- **Range start/end:** same filled style as selected; corners rounded on the outer side only.
- **Range middle:** `var(--c-accent-ring)` background, square edges, text in `var(--c-text-1)`.
- **Hover preview (range mode, pending start only):** between `pendingStart` and `hoverDate`, show the same middle-range style as a preview.
- **Disabled (outside min/max):** opacity 0.35, `cursor: not-allowed`, no hover/click effect.

**Footer:**
- `Today` button — selects today (or sets today as range-end if pending start exists), closes popover.
- `Clear` button — emits empty, closes popover.
- Full-width stretch on narrow viewports for bigger tap targets; side-by-side otherwise.

### Popover dismissal

Closes on:
- Outside click
- Escape key
- Date selection (single mode, once a valid date is picked)
- Range completion (range mode, once both ends set)
- Today or Clear button
- Preset chip selection (range picker only)

Does NOT close on:
- First click of a range (before range is complete)
- Header arrow navigation
- Entering/leaving month/year grid view

### v-model contract

- **DatePicker:** `v-model="dobString"` where `dobString` is `YYYY-MM-DD` or `''`. Emits `update:modelValue`.
- **DateRangePicker:** `v-model:from="fromStr"` `v-model:to="toStr"`. Emits `update:from`, `update:to`. Existing TripListView usage (`v-model:from="dateFrom" v-model:to="dateTo"`) continues unchanged.

### Keyboard

- **Trigger:** `Space` or `Enter` opens popover.
- **Inside grid:** Arrow keys move focus cell-by-cell (crossing month boundaries updates `viewMonth`). `Home`/`End` jump to start/end of week. `PageUp`/`PageDown` jump one month. `Enter` selects the focused cell.
- **Escape** anywhere in popover closes it.
- **Tab** moves focus between header arrows, day grid, Today, Clear.

## Styling (tokens)

Uses existing CSS custom properties only. No new tokens added.

- Popover container: `background: var(--c-surface)`, `border: 1px solid var(--c-border)`, `border-radius: var(--r-lg)`, `box-shadow: var(--sh-md)`, padding `12px`, width `~280px`.
- Day cell: `32x32px`, `border-radius: 50%` (selected), font-size `0.8125rem`.
- Weekday header row: `font-size: 0.6875rem`, `color: var(--c-text-3)`, `font-weight: 600`, `text-transform: uppercase`.
- Other month days: `opacity: 0.4`.
- Selected: `background: var(--c-accent)`, `color: white`.
- Today (not selected): `box-shadow: inset 0 0 0 1.5px var(--c-accent)`.
- Range middle: `background: var(--c-accent-ring)`.
- Disabled: `opacity: 0.35`, `cursor: not-allowed`.

## Accessibility

- Popover: `role="dialog"`, `aria-modal="false"`, `aria-label="Choose date"`.
- Day grid: `role="grid"`, `aria-label="{Month Year}"`.
- Day cell: `role="gridcell"`, `aria-selected`, `aria-disabled`, `aria-label="Tuesday, April 21, 2026"`, `tabindex` (0 on focused day, -1 on others — single roving tabindex).
- Live region (`aria-live="polite"`, `aria-atomic="true"`) announces focused day label when arrow keys move focus.
- Focus trap active while popover open; focus returns to trigger on close.
- Trigger has `aria-haspopup="dialog"`, `aria-expanded`, and — if no visible label — an `aria-label` (e.g., `"Date of birth, currently 21 April 2026"`).

## Mobile

- Popover intrinsic width (~280px) — already fits on 375px viewports with margin.
- Positioned centered under trigger if room, flips above if clipped at bottom, shifts horizontally to stay in viewport.
- No full-screen takeover — the calendar is already compact enough on phones.
- Footer buttons stretch full-width on narrow viewports (`@media (max-width: 480px)`).

## Testing

Manual smoke tests at 375px, 768px, and desktop for:
- Each DatePicker consumer page after migration (UserListView forms, ProfileView, LettersView, ComposeModal).
- DateRangePicker at its current usage (TripListView) — verify no regression.
- Disabled dates (pass `min`/`max` in a smoke test).
- Keyboard navigation end-to-end.
- Screen-reader announcement via VoiceOver on at least one page.

No unit tests — project has no test runner configured. If that changes, add tests for date math helpers and range completion logic.

## Migration (follow-up PR, not this spec)

Replace `<input type="date">` with `<DatePicker variant="input" />` in:

- `src/views/users/UserListView.vue` — 5 fields (dob, license_date, date_joined, license_expiry, gdl_expiry)
- `src/views/profile/ProfileView.vue` — 3 fields (dob, license_date, date_joined)
- `src/views/letters/LettersView.vue` — 1 field (date)
- `src/components/communications/ComposeModal.vue` — 1 field (date)
- `src/views/drivers/DriverDetailView.vue` — 2 fields (tripDateFrom, tripDateTo) — consider consolidating into `<DateRangePicker variant="input" />`

Existing `DateRangePicker` usage in `src/views/trips/TripListView.vue` continues unchanged — same v-model contract.

## Open questions

None as of 2026-04-21 — design fully specified for implementation planning.
