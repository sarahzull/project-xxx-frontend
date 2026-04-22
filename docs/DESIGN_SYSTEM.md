# Project XXX — Design System & Consistency Guide

Living reference for visual and interaction patterns. When adding a new view, filter, or component, check this document first. When you invent a new pattern, update this document.

**Principle:** _Consistency over cleverness._ If a pattern already exists for what you need, use it. Only introduce new patterns when the existing ones genuinely don't fit — and document the new one here.

---

## 1. Design tokens (CSS variables)

All tokens live in `src/style.css`. Never hardcode colors, spacing, or radius values in component styles — use the tokens so light/dark theming and future palette updates flow through automatically.

### Colors

| Token | Purpose |
|---|---|
| `--c-accent` | Primary brand blue. Active/selected states, primary buttons, focus rings. |
| `--c-accent-tint` | Translucent accent for hover/selected backgrounds on subtle controls. |
| `--c-accent-ring` | Focus-ring halo (`box-shadow: 0 0 0 3px var(--c-accent-ring)`). |
| `--c-accent-h` | Darker accent for primary button hover. |
| `--c-green`, `--c-green-tint` | Reward / success / positive monetary values. |
| `--c-amber`, `--c-amber-tint` | Warning / caution. |
| `--c-red`, `--c-red-tint` | Destructive / error / reset-to-empty affordances. |
| `--c-purple`, `--c-purple-tint` | Announcement / informational category. |
| `--c-bg` | Page / inset surface background. |
| `--c-surface` | Elevated card background (sits above `--c-bg`). |
| `--c-border`, `--c-border-light` | Standard / subtle separator lines. |
| `--c-text-1`, `--c-text-2`, `--c-text-3` | Primary / secondary / tertiary text. |

### Radius, shadow, timing

| Token | Value (roughly) | Use |
|---|---|---|
| `--r-md` | 8–10px | Buttons, inputs, list rows |
| `--r-lg` | 12px | Popovers, modal sheets |
| `--r-xl` | 14–16px | Banners, large cards |
| `--r-2xl` | 18–20px | Modal panels |
| `--r-full` | 999px | Pill / chip controls |
| `--sh-xs`, `--sh-sm`, `--sh-md`, `--sh-lg`, `--sh-xl` | Ascending elevation | Popovers use `--sh-md`, modals use `--sh-xl`. |
| `--dur` | ~150–200ms | Standard transition duration. |

### Semantic color mapping (keep in sync across views)

| Domain | Token |
|---|---|
| Reward | `--c-green` |
| Warning | `--c-amber` |
| Announcement | `--c-purple` |
| Monetary paid / credit | `--c-green` |
| Destructive / reset | `--c-red` |
| Confirmed batch / exported | `--c-accent` (blue) / `--c-green` |

---

## 2. Layout primitives

### 2.1 Page shell

Every view is a single top-level class with `display: flex; flex-direction: column; gap: 1–1.25rem`. Use a two-letter namespace for scoped class prefixes (e.g., `.cv-*` for Communications, `.ps-*` for Payslips, `.tv-*` for Trips).

### 2.2 Page banner (stat header)

Pattern in `CommunicationsView.vue` (`.cv-banner`):

- Surface background, 1px border, `--r-xl` radius, top accent bar via `::before`.
- Left: icon + title + subtitle.
- Right: a row of "stat pills" — each stat is a small `--c-bg`-filled pill with a value on top, tiny uppercased label underneath.
- **On mobile (≤640px): stat pills must wrap into a 2×2 grid, never horizontal scroll.** Use `display: grid; grid-template-columns: repeat(2, 1fr)`.

Copy the `.cv-banner` + `.cv-bstat` blocks as the starting point when introducing a new page banner.

### 2.3 Data card / table

- Outer: `.*-table-card` — surface bg, 1px border, `--r-xl`, `overflow: hidden`.
- Card header: title + record count on the left, search / primary action on the right.
- Filter bar nested under the header with the `.*-filter-bar` pattern (see §3).
- Then: table (desktop) collapsing to card rows (mobile ≤640px).

---

## 3. Filter bar

This is the single hardest area to keep consistent. **Follow these rules.**

### 3.1 Structure

```
.*-filter-bar
  ├── .*-filter-lbl    ← "FILTER" label, uppercase, always on its own first row
  ├── segmented pills  ← primary dimension (type, status, etc.)
  ├── additional chips ← date range, period, etc.
  └── reset button     ← visible only when any filter is active
```

### 3.2 Label rule

The `FILTER` label is **always** on its own row, full width, margin-bottom 4px. This is a hard rule — see `.cv-filter-lbl { width: 100%; margin-bottom: 4px }`. Do not break it.

### 3.3 Segmented pill group (desktop)

- Container: `--c-bg` fill, 1px `--c-border`, `--r-full`, 3px inner padding, `inline-flex`.
- Buttons inside: transparent bg, `4px 12px` padding, `0.8125rem / 500` weight, muted text.
- Active button: `--c-surface` bg, accent color for "All", semantic color (green/amber/purple) for typed segments, `--sh-xs`.

### 3.4 Date/range chip

- Standalone pill: `--c-bg` fill, 1px `--c-border`, `--r-full`, `7px 14px` padding (matches segment outer height), `0.8125rem / 500` muted text, calendar icon + label + caret.
- Open state: accent border + `--c-accent-ring` focus halo, rotated caret.
- `DateRangePicker` (multi-date) and `MonthYearPicker` (single month) both use this chip shape. Any future temporal control must too.

### 3.5 Mobile (≤640px) substitution

- Segmented pills are replaced with a **custom dropdown pill** (not a native `<select>`). See `.cv-type-dd` in `CommunicationsView.vue`.
- Trigger pill **must match** the date chip's padding/colors/typography.
- Popover panel is `--c-surface`, 1px border, `--r-lg`, `--sh-md`, 4px padding, with `.*-item` rows. Selected row uses `--c-accent-tint` bg + accent text + check mark on the right.
- Dismiss on outside click; transition: `opacity + translateY(-4px)` over 140ms.

### 3.6 Live counts

When a filter is active, **every banner stat pill must recompute against the filtered set**, not the full response. This is the user's mental model of a filter and any deviation is a bug.

Example — from `CommunicationsView.vue`:

```js
const dateScoped = computed(() => {
  let list = items.value
  if (dateFrom.value) list = list.filter(i => itemDate(i) >= dateFrom.value)
  if (dateTo.value)   list = list.filter(i => itemDate(i) <= dateTo.value)
  return list
})
const totalCount        = computed(() => dateScoped.value.length)
const rewardCount       = computed(() => dateScoped.value.filter(i => i.type === 'reward').length)
// …
```

`PayslipsView.vue` does the same via `filteredPayslips` → `totalPaid` + header count.

### 3.7 Reset button

- Visible only when any filter is non-default.
- Pill-shaped, `--c-surface` bg, 1px `--c-border`, muted text.
- Hover: border + text turn `--c-red`.
- On click: clears every filter ref back to `''` / `null`, not just one.

---

## 4. Date & time controls

### 4.1 Components

| Use case | Component |
|---|---|
| Single calendar date | `DatePicker.vue` (uses `CalendarPanel` in single mode) |
| Date range (from/to) | `DateRangePicker.vue` (uses `CalendarPanel` in range mode with preset rail) |
| Single month + year | `MonthYearPicker.vue` |

All three share the same `DatePickerPopover.vue` positioning primitive. When adding a new temporal control, **reuse `DatePickerPopover`** — do not reinvent positioning.

### 4.2 Preset rail

- `DateRangePicker` desktop layout = left preset rail + calendar grid.
- Presets are left-aligned pills, accent border + `--c-accent-tint` bg when active.
- Mobile collapses to a horizontal chip strip above the calendar.

### 4.3 Calendar footer

- Only rendered in `mode === 'single'`. Range mode relies on preset rail + parent Reset button.
- Never duplicate "Today" affordances.

### 4.4 ISO format

All date values move across component boundaries as ISO `YYYY-MM-DD` strings (or `YYYY-MM` for month-only). Never `Date` objects at the API boundary — they don't serialize predictably across timezones.

---

## 5. Icons

- Centralized factory in `src/components/icons/index.js`. Wraps `lucide-vue-next`.
- Defaults: `size=20`, `strokeWidth=1.75`, `color='currentColor'`.
- Semantic mapping lives in the factory file — add a new export when introducing a new icon, do not import Lucide directly from views.
- Match icon to its existing meaning: `Megaphone` = Communications, `TriangleAlert` = Warning, `CircleCheck` = Reward, `BellRing` = Announcement, `Filter` = filter label, `Calendar` = date.

---

## 6. Typography

- Primary text: inherits body font from `src/style.css` (no per-view font-family overrides).
- Mono sections: `.mono { font-family: 'JetBrains Mono', monospace }` — used for numeric columns (amounts, kilometres, IDs).
- Scale (rough):
  - Page title: `1.125–1.25rem`, `font-weight: 700`, `letter-spacing: -0.02em`.
  - Card title: `0.9375rem`, `700`.
  - Body: `0.875rem`, `400–500`.
  - Labels: `0.6875–0.72rem`, `700`, `text-transform: uppercase`, `letter-spacing: 0.06–0.08em`, muted color.
  - Chips / pill buttons: `0.8125rem`, `500`.

---

## 7. Microcopy

- **Filter pills default label = singular field noun** ("Date", "Type", "Period", "Status"). Not "All …", not plural.
- Action verbs on buttons: "Send", "Resend", "Reset", "Clear" — not "OK" / "Submit" / "Dismiss".
- Empty states: two lines — heading + one-line guidance. See `CommunicationsView.vue`'s `.cv-empty`.
- Error messages surfaced from the API use `e.response?.data?.message` with a domain-specific fallback.

---

## 8. Behavior patterns

### 8.1 Modals

- Use `ModalSheet.vue` for any overlay larger than a popover.
- Bottom-sheet on mobile, centered panel on desktop — `ModalSheet` handles both.
- Close on backdrop click and `Escape`.

### 8.2 Outside-click dismissal

Popovers and dropdowns must dismiss on outside click. Pattern:

```js
function onDocClick(e) {
  if (!open.value) return
  if (rootRef.value && !rootRef.value.contains(e.target)) open.value = false
}
onMounted(()  => document.addEventListener('click', onDocClick, true))
onUnmounted(()=> document.removeEventListener('click', onDocClick, true))
```

Use the **capture phase** (`true`) so a popover-internal click handler can still read `e.target` before dismissal.

### 8.3 Transitions

- Popovers/dropdowns: 140ms `opacity` + small `translateY(-4px)` origin.
- Modal sheets: 200ms `scale(0.95)` + `opacity`.
- Caret rotation: `rotate(180deg)` when open, `transition: transform var(--dur)`.

### 8.4 Focus & accessibility

- Every interactive control has a visible focus ring (accent border + `--c-accent-ring` halo).
- `role` and `aria-*` attributes on custom controls (`listbox` / `option`, `dialog`, `grid` / `gridcell`).
- Dropdown rows keep the aria selection model in sync with the visual one.

---

## 9. Responsive breakpoints

| Breakpoint | Purpose |
|---|---|
| `max-width: 360px` | Very small phones — single-column fallbacks for multi-column grids. |
| `max-width: 640px` | Standard phone — swap segmented controls for custom dropdowns, stat pills wrap to 2×2, hide less-critical columns. |
| `min-width: 560px` (popovers only) | Date-range popover switches to left-sidebar preset layout. |
| `min-width: 640px` | Desktop — full segmented controls, full card-header layout. |

---

## 10. When you catch yourself…

- …reaching for a new color: check §1 tokens first.
- …writing a new filter bar: copy `.cv-filter-bar` + `.cv-filter-lbl` as the starting scaffold.
- …building a new date/month/period picker: reuse `DatePickerPopover` for positioning; reuse trigger-chip styling; match the §3.4 chip shape.
- …adding a stat pill to a banner: compute it against the filtered dataset, not the raw response.
- …writing microcopy: singular noun on default filters, never "All X".
- …using a native `<select>` on mobile: **stop.** Build a custom dropdown matching `.cv-type-dd` so the styling is controlled.
- …positioning a popover with fixed `top: N`: use `DatePickerPopover` so the viewport clamp and flip-above logic is inherited.

Update this doc as the system grows. The cost of a stale doc is cheaper than the cost of silent drift.
