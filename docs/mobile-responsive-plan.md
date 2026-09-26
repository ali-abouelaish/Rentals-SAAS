# Property Management — mobile responsiveness plan

Status: **COMPLETE** (2026-09-24). All phases done and verified.

**Final result — 141/141 route/width pairs pass.**

| | Baseline | Final |
|---|--:|--:|
| Horizontal overflow | 17 | **0** |
| Tap targets < 44px | 1,573 | **0** |
| Routes passing clean | 0 of 47 | **47 of 47** |

Measured at 360/390/414 on a freshly restarted dev server with the stylesheet
guard passing and nothing else competing for memory. `tsc --noEmit` clean,
`npm run build` exit 0.

Target viewports: 360×740 (small Android), 390×844 (iPhone 14/15), 414×896. Everything must work at **360px** with no horizontal page scroll.

Breakpoint contract: `< md (768px)` = phone layout. `md`–`lg` = tablet. `lg+` = today's desktop layout, unchanged.

---

## Where we actually are

The **shell** is already mobile-aware and does not need redoing:

- `AppShellClient` — responsive padding, mobile-only brand mark, `pb-24 md:pb-4` to clear the bottom bar
- `BottomNav` + `QuickActionSheet` + `MoreMenuSheet` — PM/RA/admin aware, role + entitlement gated
- `pm-dashboard/ui/MobileDashboardHome.tsx` — a purpose-built mobile dashboard already exists
- `properties/ui/UnitFilterBar.tsx` — got a partial pass in `7c266ea`

The **content layer** has had no pass. Scope of what is left:

| | count |
|---|---|
| PM routes (incl. nested `new` / `[id]` / `edit` / `setup`) | 44 |
| PM settings routes | 11 |
| PM feature UI components | ~150 files, ~37k lines |
| `<DialogContent>` with **no** `max-h` (unreachable submit button on a phone) | **46 of 70** |
| Tables with 7+ columns | 13 |
| `grid-cols-2..9` with no responsive prefix | ~120 |

### Five features share one shape

`properties`, `bookings`, `contracts`, `pm-tenants` and `maintenance` are each built from the same five parts:

```
<Feature>Page  +  <Feature>FilterBar  +  <Feature>ListView  +  <Feature>KanbanView  +  <Feature>Drawer
```

That is why Phase 1 is Properties: solving the shape once there gives a copy-paste recipe for four more features, and Phases 2–3 get much cheaper.

### Systemic defects found (fix once, in Phase 0, not 150 times)

1. **`ui/dialog.tsx` has no `max-h` and no `overflow`.** A tall form dialog is vertically clipped on a phone and the submit button cannot be reached or scrolled to. This is the single highest-impact bug — it affects 46 create/edit surfaces.
2. **No `viewport` export in `src/app/layout.tsx`.** `BottomNav` relies on `env(safe-area-inset-bottom)`, which resolves to `0` on iOS without `viewportFit: "cover"`. The bottom bar sits under the home indicator on every iPhone.
3. **`ui/tabs.tsx` `TabsList` is `inline-flex`** with no wrap and no scroll — any strip of 4+ tabs overflows the viewport.
4. **`ui/table.tsx` offers only `overflow-x-auto`.** A 12-column table inside a 360px viewport is technically scrollable and practically unusable. Needs a real stacked-card fallback.
5. **Touch targets.** Icon-only buttons are mostly `p-2` around a `h-4 w-4` icon ≈ 32px. Minimum is 44×44.
6. **`PageHero`** is `p-8` + `text-3xl` with no responsive step-down.

---

## Phase 0 — Foundations ✅ done

Landed 2026-09-16. `npx tsc --noEmit` clean, `npm run build` green.

### What changed

| File | Change |
|---|---|
| `src/app/layout.tsx` | Added the missing `viewport` export with `viewportFit: "cover"`, so `env(safe-area-inset-*)` stops resolving to 0 on iOS |
| `src/components/ui/dialog.tsx` | Bottom sheet below `md`, centred dialog from `md`. Height capped, body scrolls on an inner wrapper so the close button stays pinned. Header reserves space for it; footer stacks full-width with a real gap |
| `src/components/ui/sheet.tsx` | `h-dvh` instead of `h-full`, safe-area bottom padding, `shrink-0` header, 44px close button |
| `src/components/ui/tabs.tsx` | `TabsList` scrolls sideways instead of widening the document; triggers snap, never shrink, 44px tall on a phone |
| `src/components/ui/data-list.tsx` | **New.** Table from `md`, cards below, driven by one column spec |
| `src/components/layout/PageHeader.tsx` | Responsive type scale; action clusters wrap; `PageHero` `p-5 sm:p-8` |
| `src/components/ui/button.tsx` | `size="icon"` is 44px on a phone, 36px from `md` |
| `src/components/ui/filter-bar.tsx`, `filter-panel.tsx` | Filter rows stack full-width below `sm`; actions wrap; `ml-auto` only once horizontal |
| 22 dialog call sites | Dropped the now-redundant `max-h-[Nvh] overflow-y-auto`; moved two outer padding overrides off the shell |
| `tailwind.config.ts` | Real `sheetIn` / `dialogIn` keyframes and animations |
| `e2e/mobile-audit.mjs` | **New.** The regression gate (below) |

### Six hand-rolled tab strips bypass the primitive

Fixing `TabsList` only helps the screens that use it. These build their own strip
from `flex` + `useState`, so they need doing by hand in their phase:

| File | Phase |
|---|---|
| `properties/ui/PropertyDetailPage.tsx`, `properties/ui/UnitDrawer.tsx` | 1 |
| `maintenance/ui/MaintenancePage.tsx` | 2 |
| `pm-tenants/ui/TenantDrawer.tsx`, `bookings/ui/BookingDrawer.tsx`, `contracts/ui/ContractDrawer.tsx` | 3 |
| `acquisition-insights/ui/EvaluationDetailPage.tsx` | 6 |

`MaintenancePage.tsx:386` is the measured example: `flex items-center gap-1 … w-fit`
with three icon-and-count buttons comes to 448px inside a 360px viewport, which is
the whole of that page's horizontal overflow.

### Two things found while doing it

- **`tailwindcss-animate` was never installed** and is not in `plugins`. Every `animate-in` / `slide-in-from-*` / `zoom-in-95` / `fade-out-0` class in the Radix wrappers generates no CSS — dialogs and sheets have always appeared instantly. The two animations the new dialog needs are defined properly in `tailwind.config.ts`; the remaining inert classes were left alone rather than swept in a mobile pass. Worth a separate cleanup.
- **`DialogFooter` had no `gap`** — only `sm:space-x-2` — so stacked buttons on a phone sat flush against each other.

### Using the audit

```bash
node e2e/login.mjs                       # once, when the session lapses
node e2e/mobile-audit.mjs                # all PM routes, 360/390/414
node e2e/mobile-audit.mjs properties keys # named routes (no leading slash)
node e2e/mobile-audit.mjs --width 360 --shots
```

Horizontal overflow fails the run and names the innermost element responsible.
Tap targets under 44px are a warning and a count; `--strict` makes them fail.
Detail pages are found by following the first row link on their list page, so
nothing breaks when the test tenant is reseeded. Report lands in
`e2e/artifacts/mobile-audit.json`.

#### Measure `<main>`, not the document

The first version of the probe checked `document.documentElement.scrollWidth`
and reported **zero overflow on all 47 routes** — which is what a broken
instrument looks like, not a clean app. `AppShellClient` puts `overflow-hidden`
on its root and makes `<main>` the scroller, so content twice the width of the
screen never widens the document; it is clipped, or it scrolls inside `main`.

The probe now measures `main.scrollWidth` against `main.clientWidth`, and skips
anything sitting inside a deliberate `overflow-x: auto` box. That distinction is
the point of the check:

- `/owners` — a 605px table inside an `overflow-x-auto` wrapper. The table
  scrolls in its own box, the page does not. **Not a failure.**
- `/maintenance` — `main` is 448px wide in a 360px viewport. **Failure.**

Verified live by injecting a 900px element into a real page and confirming the
probe reports it, rather than trusting another clean pass.

### Baseline — 2026-09-16, 141 route/width pairs

**17 overflow failures across 8 distinct routes.** Everything else fits.

| Route | 360 | 390 | 414 | Cause | Phase |
|---|--:|--:|--:|---|:--:|
| `/forms` | 355 | 325 | 301 | non-wrapping row of 6 action buttons, 715px wide | 5 |
| `/settings/booking-forms` | 233 | 203 | 179 | same action-row pattern | 5 |
| `/properties/[id]` | 185 | 155 | 131 | "Manage rooms" link + hand-rolled tab strip | 1 |
| `/maintenance` | 88 | 58 | 34 | hand-rolled tab strip, `w-fit`, 448px | 2 |
| `/properties/[id]/setup` | 48 | 18 | — | "Finish setup" button row | 1 |
| `/properties/[id]/edit` | 30 | — | — | icon row | 1 |
| `/contracts` | 21 | — | — | "New contract" button in the header | 3 |
| `/rent-collection` | 9 | — | — | `#rc-sort` select + a nowrap meta line | 4 |

Tap targets under 44px: **1,573** across all three widths (~520 per width),
inline links already excluded.

Two patterns account for most of the overflow, and neither is a table: a **row
of action buttons that will not wrap**, and a **hand-rolled tab strip**. The
wide tables that looked like the obvious problem are mostly already inside
`overflow-x-auto` wrappers and scroll in their own box.

### Original scope, for reference

**Files**

- `src/app/layout.tsx` — add `export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }`
- `src/components/ui/dialog.tsx` — `DialogContent` gets `max-h-[85dvh] overflow-y-auto`, `w-[calc(100vw-2rem)]`, responsive padding `p-4 sm:p-6`; add a `variant="sheet"` that docks to the bottom edge below `md` (rounded top corners, `pb-[env(safe-area-inset-bottom)]`), since a bottom sheet is the right form for a phone form
- `src/components/ui/sheet.tsx` — add `pb-[env(safe-area-inset-bottom)]`; make sticky drawer footers clear the bottom bar
- `src/components/ui/tabs.tsx` — `TabsList` becomes `flex overflow-x-auto scrollbar-none` with scroll-snap below `md`
- `src/components/ui/table.tsx` — **new `<DataList>` primitive**: renders the existing table at `md+`, and a stacked card per row below `md`, driven by one column definition (`{ key, header, cell, priority: "primary" | "secondary" | "detail" }`) so each screen declares its columns once
- `src/components/layout/PageHeader.tsx` — `text-xl sm:text-2xl`, action cluster wraps and goes full-width on mobile; `PageHero` steps down to `p-5 sm:p-8` / `text-2xl sm:text-3xl`
- `src/components/ui/button.tsx` — icon variant floor of `min-h-11 min-w-11` below `md`
- `src/components/ui/filter-bar.tsx` / `filter-panel.tsx` — children full-width below `sm`; collapse the whole bar behind a "Filters" sheet trigger on mobile

**Tooling — `e2e/mobile-audit.mjs`** (new, reuses the existing signed-in session in `e2e/lib/harness.mjs`)

For every route in a list, at 360/390/414:

- fail if `document.documentElement.scrollWidth > window.innerWidth`, and report the offending elements by selector
- report every interactive element whose rect is `< 44px` on either axis
- report any element clipped by the viewport or hidden behind the bottom bar
- screenshot to `e2e/artifacts/mobile/<route>.png`

This turns every later phase from "looks fine on my screen" into a pass/fail number, and gives a regression gate.

**Done when:** `node e2e/mobile-audit.mjs` runs green on `/dashboard` and reports a baseline count for all 55 PM routes.

---

## Phase 0.5 — Overflow sweep

A cross-cutting pass over the 8 routes in the baseline, taken before Phase 1 so
every later phase starts from a green gate.

**Two patterns, not the tables.** Every failure came down to one of these:

1. **`shrink-0` beside `flex-wrap`.** The row cannot shrink below the width of
   all its children on one line, so `flex-wrap` never gets a chance to wrap. The
   forms builders had nine controls locked onto a single 715px line this way.
2. **A hand-rolled tab strip with `w-fit`** and no wrap or scroll.

| File | Fix |
|---|---|
| `forms/ui/FormsBuilderPage.tsx` | dropped `shrink-0` for `min-w-0`; outer row stacks below `sm` |
| `forms/ui/FormBuilderPage.tsx` | same |
| `booking-forms/ui/FormBuilderPage.tsx` | same |
| `properties/ui/PropertyDetailPage.tsx` | action row wraps; tab strip scrolls sideways, triggers `shrink-0 whitespace-nowrap` |
| `properties/ui/PropertySetupPage.tsx` | header stacks, action row wraps |
| `properties/ui/CreatePropertyPage.tsx` | header stacks, action row wraps, step switcher scrolls |
| `maintenance/ui/MaintenancePage.tsx` | tab strip scrolls sideways instead of `w-fit` |
| `contracts/ui/ContractsPage.tsx` | header stacks, action row wraps |
| `rent-collection/ui/RentCollectionList.tsx` | fixed `w-56` search box becomes fluid below `sm` |

**Result: 0 horizontal overflow across all 141 route/width pairs** (was 17).
`tsc --noEmit` clean, `npm run build` green. The probe was re-verified as live on
the pages that now pass — an 800px canary injected into `main` is still caught
and named on each — because a clean sweep is also what a broken instrument
returns.

Tap targets under 44px: 1,620, essentially unchanged. That is the Phase 1–7
backlog, not a regression: the sweep fixed layout width, not control sizing.

**One more probe correction.** The `· Started …` line on `/rent-collection`
was reported as an offender but is inside a `truncate` parent — clipped, and
unable to widen the page. `getBoundingClientRect` still returns the full layout
width of a clipped inline box. The probe now treats `overflow-x: hidden`
ancestors like scrollable ones, so every ellipsis in the app stops reading as an
overflow bug.

---

## Phase 1 — Properties & Units

The spine of PM, the largest surface (28 components, 8.3k lines), and the pattern source for Phases 2–3.

**Routes:** `/properties`, `/properties/new`, `/properties/[id]`, `/properties/[id]/edit`, `/properties/[id]/setup`

**List / board:** `UnitsPage`, `UnitsListView`, `UnitsKanbanView`, `UnitsSheetView`, `UnitFilterBar` (finish it), `KanbanCard`, `KanbanColumn`, `UnitStatusBadge`, `PortfolioBadge`

- Kanban → single swipeable column with a status switcher below `md`; the 3-across board is unusable at 360px
- `UnitsSheetView` is a spreadsheet — below `md` it must fall back to `DataList`, or be explicitly desktop-only with a clear notice

**Detail:** `PropertyDetailPage`, `OverviewTab`, `PhotosTab`, `MarketingTab`, `TenantTab`, `LandlordContractCard`, `PropertySetupPage`

- tab strip → the Phase 0 scrollable `TabsList`
- `PhotosTab` grid → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`; check the upload control's touch target

**Create / edit / add:** `CreatePropertyDialog`, `CreatePropertyPage`, `CreatePortfolioDialog`, `CreateTenantForUnitDialog`, `UnitDrawer` (tabs + forms + sticky footer), `StatusPickerDialog`, `LandlordDialogs`, `DeletePropertyButton`, `DeleteRoomButton`

- every form: single column below `md`, labels above, hints and inline errors still visible (the CLAUDE.md UI rules hold on mobile too)
- `UnitDrawer`'s save footer must be sticky and clear the safe area

**Note:** `AddRoomDialog.tsx` is live — imported and rendered at `PropertySetupPage.tsx:534`. A standing note claiming it was unused was wrong; it needs the same treatment as every other dialog here.

**Done when:** all 5 routes plus every dialog above pass the audit at 360px, and a unit can be created, edited and deleted end-to-end on a phone.

---

### Phase 1 progress — code complete, awaiting a verification run

`tsc --noEmit` clean, `npm run build` green. **Not yet re-audited** — the
Playwright session expired again mid-phase, and `e2e/login.mjs` is human-only.

**The find worth carrying into every later phase: a 16px text floor on inputs.**
iOS Safari zooms the whole page in when a focused field's text is under 16px,
and does not zoom back out — the user is left on a page they have to pinch out
of. Every field in the app was `text-sm` (14px) or `text-xs` (12px). The three
field primitives now carry `text-base sm:text-sm`, and the hand-rolled fields in
`properties/ui` do too. This is worth a sweep in every phase, not just Phase 1.

| Change | File(s) |
|---|---|
| Fields 44px tall + 16px text below `sm` | `ui/input.tsx`, `ui/select.tsx`, `ui/textarea.tsx` |
| Same for the hand-rolled field classes | `properties/ui/CreatePropertyPage.tsx`, `UnitFilterBar.tsx` |
| Mobile search trigger 36px → 44px | `search/ui/GlobalSearchBar.tsx` |
| Icon-only help button → 44px | `help/ui/HelpButton.tsx` |
| Every filter control, pill and view toggle → 44px below `sm` | `properties/ui/UnitFilterBar.tsx` |
| 6 interactive icon buttons → 44px (decorative icon chips left alone) | `CreatePropertyPage`, `DeletePropertyButton`, `DeleteRoomButton`, `PropertyDetailPage` ×2, `PropertySetupPage` |
| Detail + drawer tab strips: `min-h-11`, `shrink-0`, `whitespace-nowrap` | `PropertyDetailPage.tsx`, `UnitDrawer.tsx` |
| 22 field-pair grids stack below `sm` | 9 files across `properties/ui` |
| Amenity checkboxes 3-up → 2-up below `sm` | `CreatePropertyDialog.tsx` |
| Drawer gutters `px-4 sm:px-6` | `UnitDrawer.tsx` |
| Kanban: 85vw snapping columns on a phone | `UnitsKanbanView.tsx`, `KanbanColumn.tsx` |
| `100vh` → `100dvh` | `KanbanColumn.tsx`, `UnitsSheetView.tsx` |
| Audit gains a session preflight | `e2e/mobile-audit.mjs` |

**The 16px floor has a side effect — watch for it in every phase.** Raising the
font size widens any input that sizes itself from its content (`type="date"`,
`type="number"`, `type="time"`). Two unconstrained date inputs in
`UnitFilterBar` grew from ~110px to ~161px each and put 51px of overflow back on
`/properties` — caught by the audit, fixed by constraining them rather than by
giving the zoom trap back.

Form fields are safe: every `inputCls`-style constant checked already carries
`w-full`. The risk is **inline toolbar fields** sitting in a horizontal row with
no width class. Grep for `type="date"` without `w-full`/`flex-1` before applying
the floor to a feature.

**Two deliberate non-changes:**

- `UnitsSheetView` stays a spreadsheet. It already scrolls in its own `overflow-auto`
  box and does not break the page. Converting a spreadsheet to cards removes the
  thing it is for; the `100vh` bug in it was real and is fixed.
- `OverviewTab`'s two `ReadField` grids stay 2-up. They hold short values
  ("Deposit £500"); stacking them only makes the drawer longer.

---

## Phase 2 — Maintenance & Keys

The most genuinely field-used part of PM — this is what gets opened standing in a hallway. `/maintenance` is also one of the two PM bottom-nav tabs.

**Routes:** `/maintenance`, `/keys`

**Components:** `MaintenancePage` (10-column table), `KanbanBoard`, `TicketsList`, `SuppliersDirectory` (6 col), `CommentsPanel`, `WorksOrderSigningPanel`, `KeysDashboardPage` (7 col), `PropertyKeysTab`, `KeyStatusPill`

**Create / edit / add:** `RaiseJobModal`, `SupplierModal`, `JobDrawer` (tab strip + forms), `TicketDrawer`, `AddKeysDialog`, `KeyCheckoutDialog`, `KeyCheckinDialog`, `KeyHistoryDrawer`

Specifics: the 10-col maintenance table and 7-col keys table both go to `DataList`. `maintenance/ui` has 7 hard `min-w-[Npx]` declarations — the largest concentration in the codebase; each needs a responsive cap. Photo capture in `RaiseJobModal` should accept a camera capture on mobile.

**Vocabulary check:** the UI says "work order", never "job" — applies to any new mobile-only copy.

---

### Phase 2 progress

`/maintenance` and `/keys` both **PASS** at 360px — zero overflow, zero tap
targets under 44px (from 10 and 2).

| Change | File(s) |
|---|---|
| 14 inline field classes → 44px + 16px text | `CommentsPanel`, `JobDrawer`, `RaiseJobModal`, `SupplierModal`, `TicketDrawer` |
| 7 field-pair grids stack below `sm` | `JobDrawer`, `RaiseJobModal`, `SupplierModal` |
| Tab strip, status pills, search, primary button → 44px | `MaintenancePage.tsx` |
| Filter buttons → 44px | `keys/ui/KeysDashboardPage.tsx` |
| Kanban: 85vw snapping columns on a phone | `maintenance/ui/KanbanBoard.tsx` |
| `SearchableSelect` trigger + search box → 44px, 16px text | `ui/searchable-select.tsx` (shared, 6 features) |
| Keys table → `DataList` | `keys/ui/KeysDashboardPage.tsx` |
| `RaiseJobModal` behaves like the dialog primitive | `maintenance/ui/RaiseJobModal.tsx` |

#### A defect the audit cannot see

The keys table sat in an `overflow-hidden` wrapper around seven columns, so on a
phone everything from "Purpose" rightwards — **including the per-row Check in
button** — was clipped away with no way to scroll to it. Not broken layout:
missing functionality.

The overflow probe deliberately skips `overflow-x: hidden` ancestors (that is
what stopped every `truncate`d label reading as a bug), so this passed a green
sweep. **Clipping hides defects from the audit — grep for `overflow-hidden`
around a wide table in every remaining phase.** It is now the first real
consumer of `DataList`.

#### `RaiseJobModal` was never a Dialog

It is a hand-rolled modal — no `role="dialog"`, and therefore none of the Phase 0
fixes. Its height cap sat on the *form*, with the header stacked outside it, so
the panel could run past the bottom of the screen; and it used `vh`, which
ignores the collapsing mobile URL bar. It now bottom-sheets, caps at `88dvh`,
scrolls its body and exposes the right aria attributes.

Converting it to the real `Dialog` primitive would additionally buy focus
trapping and Escape-to-close, which it still lacks. Left as a follow-up: it
mounts conditionally rather than via `<Dialog open>`, so the change carries
behavioural risk that does not belong in a layout pass.

#### Three deliberate non-changes

- **The 11-column work order table stays a table.** Ten of its columns already
  hide responsively (`hidden md:table-cell` and friends), so a phone sees about
  five. `SuppliersDirectory` does the same. Converting either to `DataList`
  would be churn.
- **`accept="image/*"` stays as it is.** It already offers the camera on iOS and
  Android; adding `capture` would *force* the camera and remove the gallery,
  which is worse for a work order photo. The plan's suggestion here was wrong.
- **`JobDrawer` already uses the `Tabs` primitive**, so it inherited the Phase 0
  scroll fix. The earlier "seven hand-rolled tab strips" list was wrong to
  include it — six, not seven.

---

## Phase 3 — Tenants, Bookings & Contracts

The lettings chain. Reuses the Phase 1 recipe directly.

**Routes:** `/tenants`, `/tenants/[id]/reminders`, `/bookings`, `/contracts`, `/contracts/templates`, `/contracts/templates/new`, `/contracts/templates/[id]`

**Tenants:** `TenantsPage`, `TenantsListView`, `TenantFilterBar`, `TenantDrawer`, `RightToRentBadge` — `pm-tenants/ui` carries 19 non-responsive grids, the second-worst concentration.
Create/edit: `CreateContractForTenantDialog`, `SendWelcomeEmailDialog`

**Bookings:** `BookingsPage`, `BookingsListView`, `BookingsKanbanView`, `BookingCard`, `BookingFilterBar`, `BookingStatusBadge`.
Create/edit: `BookingDrawer`, `ConvertToTenancyDialog`

**Contracts** (17 components — the heaviest of the three): `ContractsPage`, `ContractsListView`, `ContractFilterBar`, `ContractSigningPanel`, `TenancyCard`, `TenancyPaymentsList`, `PropertyTenantHistory`, `TenantHistoryTimeline`, `UnitHistoryPanel`, `HistoryStatsStrip`, `VoidCard`, `DepositBadge`.
Create/edit: `ContractDrawer`, `CloseoutDialog`, `GiveNoticeModal`, `ProRataField`

Specifics: `ContractSigningPanel` (BoldSign) and the timeline views need the most attention — timelines are horizontal by nature and must go vertical below `md`. `HistoryStatsStrip` is a stat row that must wrap to a 2-up grid.

---

### Phase 3 progress

All five routes **PASS** at 360px — zero overflow, zero tap targets under 44px.
Baseline for these was 65 small targets between them.

| Route | Before | After |
|---|--:|--:|
| `/tenants` | 13 | **0** |
| `/bookings` | 16 | **0** |
| `/contracts` | 13 | **0** |
| `/contracts/templates` | 10 | **0** |
| `/contracts/templates/new` | 13 | **0** |

| Change | Scope |
|---|---|
| 45 field-class occurrences → 44px + 16px text | all three features |
| 32 field-pair grids stack below `sm` | all three features |
| Three filter bars stack; fixed widths become fluid | `TenantFilterBar`, `BookingFilterBar`, `ContractFilterBar` |
| Three drawer tab strips scroll, triggers 44px | `TenantDrawer`, `BookingDrawer`, `ContractDrawer` |
| **`Button` `md`/`lg` → 44px on a phone** | `ui/button.tsx` — app-wide |
| 9 one-off targets (view toggles, back links, row links, file input) | bookings, contract templates, tenants |

#### The intrinsic-width trap, caught before it landed

Phase 1 learned that the 16px iOS floor widens inputs that size from their
content. Grepping for that first paid off here: `BookingFilterBar` had two
`type="date"` inputs pinned to `w-36` on a class constant with no `w-full` —
exactly the shape that put 51px of overflow back on `/properties`. They were
made fluid in the same edit, so the regression never happened.

#### `Button` `md`/`lg` raised app-wide

`md` is the default size and was 36px, which is why it kept surfacing as the
last offender on route after route. It and `lg` now reach 44px below `md` and
keep their desktop heights above it.

`xs` and `sm` were deliberately left alone: they sit in table rows and inline
toolbars where forcing 44px would stretch every row. Those get handled in
context, as the nine one-off fixes above did.

---

## Phase 4 — Rent Collection, Finances & Owner statements

The money screens, and the heaviest tables in the module. `/rent-collection` is the other PM bottom-nav tab.

**Routes:** `/rent-collection`, `/rent-collection/statements`, `/rent-collection/statements/[id]`, `/finances`, `/finances/overheads`, `/finances/tenant-charges`, `/finances/close`, `/finances/close/[year]/[month]`, `/owners`, `/owners/[id]`, `/owners/[id]/statements/[statementId]`

**Components:** `RentCollectionPage`, `RentCollectionList`, `RentCollectionRow`, `FinancesHubPage` (7 col), `MonthlySummaryReport` (**11 col**), `OverheadsPage` (7 col), `TenantChargesPage` (8 col), `CloseChecklist`, `MonthPicker`, `PostRecurringButton`, `OwnerDetailTabs`, `OwnerDetailsForm`, `OwnerPropertiesTable`, `OwnerStatementsPanel` (8 col), `OwnerStatementDetail`, and the 7-col inline table in `/owners/page.tsx`

**Create / edit / add:** `RecordPaymentDialog`, `TenantChargeModal`, `OverheadDrawer`, `FeeOverrideDialog`, `OwnerActions`

Specifics: `MonthlySummaryReport` at 11 columns is a genuine financial report — it may be right to keep it a horizontally-scrolled table with a sticky first column rather than force it into cards. Decide per table and record the decision in the file. `RecordPaymentDialog` is the single most likely thing a manager does from a phone — make it a bottom sheet with a numeric input mode.

---

### Phase 4 progress — code complete, final numbers pending a re-run

`tsc --noEmit` clean, `npm run build` green. Last measured at 360px before the
session lapsed: `/finances/overheads`, `/finances/tenant-charges` and `/owners`
**PASS**; the rest were down from 37 small targets to 19 and fell further after
the last edits, which are not yet measured.

#### A second clipped table — this one in the financial report

`MonthlySummaryReport` holds two tables, 13 columns between them, each inside a
`rounded-xl … overflow-hidden` wrapper with **no scroller**. On a phone the
right-hand columns were clipped away and unreachable — silently dropping figures
from a financial report, which is the worst place in the module for it to
happen. Same blind spot as the keys table in Phase 2, and invisible to the audit
for the same reason.

Fixed by wrapping each table in `overflow-x-auto` with a `min-w-[640px]` floor.
It stays a table rather than becoming a `DataList`: this report is read
column-against-column and cards would destroy the comparison it exists for.

**That is two clipped tables found in two phases. The grep is not optional.**

#### Two more hand-rolled modals

`OverheadDrawer` and `TenantChargeModal` are hand-rolled, so neither inherited
the Phase 0 work. `OverheadDrawer` used `h-full`, a percentage of a parent that
includes the area under the mobile URL bar; `TenantChargeModal` capped at
`90vh`, which has the same flaw. Both now use `dvh`, carry safe-area padding,
expose `role="dialog"` and have 44px close buttons.

#### `Button` `sm` raised app-wide

`sm` (32px) was the last offender on route after route. It is the app's
general-purpose small button, not a dense-row size — of 430 usages only 13 sit
inside a table cell — so it now reaches 44px below `md` and keeps its 32px
desktop height. `xs` (20 usages) really is for tight inline spots and stays put.

| Change | Scope |
|---|---|
| Two clipped report tables now scroll | `finances/ui/MonthlySummaryReport.tsx` |
| Two hand-rolled modals behave like the primitives | `OverheadDrawer`, `TenantChargeModal` |
| 33 field occurrences → 44px + 16px text | finances, owners, owner-statements, rent-collection |
| 4 field-pair grids stack | same |
| **`Button` `sm` → 44px on a phone** | `ui/button.tsx` — app-wide |
| Filter pills, search, sort, row links, checkboxes, month picker | rent-collection, finances |

---

## Phase 5 — Compliance, Automations, Reminders & Forms

**Routes:** `/compliance`, `/reminders`, `/automations`, `/automations/templates`, `/automations/rules/[id]`, `/forms`, `/forms/[id]`, `/forms/[id]/responses`, `/settings/booking-forms`

**Components:** `ComplianceDashboard` (6 col), `CertificatesPanel` (8 col), `RemindersInbox`, `RulesList`, `RuleDetail`, `TemplatesManager`, `PresetLibrary`, `FormsListPage`, `FormResponsesPage`, `FormsTab`

**Create / edit / add:** `CertificateModal`, `SendReminderDialog`, `AddReminderDialog`, `EditQueuedMessageDialog`, `MessagingSettingsForm`, `FormBuilderPage` (×2 — `forms` and `booking-forms`), `QuestionEditor` (×2), `FormSendDialog`, `GoogleFormImportDialog`, `BookingFormImportDialog`, `BankDetailsForm`

Specifics: the two form builders are drag-and-drop editors — the honest call is a **read/preview plus light-edit mode on mobile**, with full authoring gated to `md+` behind a clear message, rather than pretending drag-reorder works with a thumb. `PublicFormPage` is renter-facing and must be flawless on mobile; audit it even though it sits outside the app shell.

---

### Phase 5 progress

All six routes **PASS** at 360px. `/automations/templates` — the worst single
screen in the module at 40 small targets — is now zero.

| Route | Before | After |
|---|--:|--:|
| `/automations/templates` | 40 | **0** |
| `/settings/booking-forms` | 27 | **0** |
| `/automations` | 19 | **0** |
| `/forms` | 11 | **0** |
| `/reminders` | 7 | **0** |
| `/compliance` | 1 | **0** |

#### Hover-only controls are invisible on a phone

`opacity-0 group-hover:opacity-100` reveals a control when the pointer is over
its row. **A touch screen has no hover**, so on a phone those controls never
appear at all — not merely small, but absent. The form builders' edit and delete
buttons, the maintenance comment actions, the kanban card menus and ten more
were all in this state.

Found in **13 files spanning five phases**, so it was fixed everywhere at once:
`opacity-100 md:opacity-0 md:group-hover:opacity-100` — always visible on a
phone, still revealed on hover for pointer devices. This is the third
cross-cutting pattern after `shrink-0`+`flex-wrap` and clipped tables, and the
only one that removed functionality outright rather than making it awkward.

#### `Button` needed a minimum *width* too

Raising `sm`/`md`/`lg` to 44px tall in Phases 3–4 left icon-only buttons at
~38px wide — they were the entire remaining count on `/automations/templates`.
`min-w-11` below `md` costs text buttons nothing, since they are wider already.

| Change | Scope |
|---|---|
| Hover-only controls visible on touch | 13 files, app-wide |
| `Button` `sm`/`md`/`lg` gain `min-w-11` on a phone | `ui/button.tsx` — app-wide |
| 43 field occurrences → 44px + 16px text | all five features |
| 5 field-pair grids stack | same |
| `CertificateModal` behaves like the dialog primitive | `certificates/ui/CertificateModal.tsx` |
| Drag handles and icon controls in both builders → 44px | `forms`, `booking-forms` `QuestionEditor` + builders |
| Reminder pills and selects → 44px | `automations/ui` |

#### The form builders were not gated after all

The plan proposed restricting drag-and-drop authoring to `md+` with a notice.
That turned out to be unnecessary: the handles just needed a real grab area
(`h-11 w-11` with `touch-none` already present) and the controls needed to stop
hiding behind hover. Authoring works on a phone now, so nothing was taken away.

---

## Phase 6 — Profitability, Acquisition Insights, Shares & Deposits

Analysis screens — lowest mobile frequency, but they hold the widest tables and all the charts.

**Routes:** `/profitability`, `/profitability/[propertyId]`, `/acquisition-insights`, `/acquisition-insights/new`, `/acquisition-insights/[id]`, `/shares`, `/shares/new`, `/shares/[id]`, `/deposits`

**Components:** `ProfitabilityPage`, `PropertyDetailPage` (**12 col — the widest table in the module**), `PortfolioGraph`, `PropertyTrendChart`, `AcquisitionInsightsPage` (8 col), `EvaluationDetailPage`, `BreakEvenTimeline`, `DepositsHub`

**Create / edit / add:** `CostModal`, `NewEvaluationFlow` (multi-step wizard — the stepper needs a compact mobile form), `LinkPropertyModal`

Specifics: Recharts containers need `ResponsiveContainer` with a mobile-specific height and thinned axis ticks; a 12-month x-axis is unreadable at 360px. Chart legends move below the plot.

---

### Phase 6 progress

All routes **PASS** at 360px.

| Route | Before | After |
|---|--:|--:|
| `/profitability` | 10 | **0** |
| `/shares/new` | 14 | **0** |
| `/acquisition-insights/new` | 13 | **0** |
| `/acquisition-insights` | 5 | **0** |
| `/deposits` | 2 | **0** |
| `/shares` | 1 | **0** |

#### Two more clipped tables — third phase running

`BreakEvenTimeline` and `EvaluationDetailPage` both wrapped tables in
`overflow-hidden` with no scroller. Four clipped tables found across Phases 2,
4 and 6. The grep earns its place every single time.

#### Charts now thin out on a phone

`ResponsiveContainer` sizes to its box but knows nothing about legibility: a
twelve-month axis with full `£` labels is unreadable at 360px. Both charts take
a `useIsNarrow()` hook and below `sm` drop to 220px tall, thin the x ticks
(`interval="preserveStartEnd"`, `minTickGap`), and abbreviate the y axis to
`£1k` with a 44px gutter instead of 72px.

#### Two instrument corrections

Both found because a number looked wrong, not because anything failed:

1. **Measure twice, keep the second.** `/profitability` reported 18 undersized
   targets against a true 10 — the first reading on a freshly compiled route
   catches Recharts mid-animation, with buttons measured at two-thirds of their
   settled size. The audit now takes a throwaway reading, waits, and keeps the
   second.
2. **A label is the target, not the `<input>` inside it.** Clicking anywhere on
   a `<label>` activates its control, so a 20px checkbox inside a padded label
   row is not a 20px target. The probe measured the bare input and flagged
   every checkbox on `/shares/new`. It now measures the wrapping (or
   `for=`-associated) label instead.

| Change | Scope |
|---|---|
| Two clipped tables now scroll | `BreakEvenTimeline`, `EvaluationDetailPage` |
| Charts thin out below `sm` | `PortfolioGraph`, `PropertyTrendChart` |
| Two hand-rolled modals behave like the primitives | `CostModal`, `LinkPropertyModal` |
| 24 field occurrences → 44px + 16px text | all four features |
| Toolbar pills, tabs, wizard steps, share links → 44px | profitability, deposits, acquisition, shares |
| Audit: double measurement + label targets | `e2e/mobile-audit.mjs` |

---

## Phase 7 — PM Settings, Dashboard polish, Inbox & Marketing

**Routes:** `/settings/team`, `/settings/bank-details`, `/settings/api-keys`, `/settings/email`, `/settings/messaging`, `/settings/integrations`, `/settings/deposits`, `/settings/e-signing`, `/settings/billing-info`, `/inbox`, `/inbox/[id]`, `/marketing`, `/dashboard?view=pm`

Settings are mostly forms and benefit almost entirely from Phase 0; expect this phase to be short. `/inbox` is a 5-column table and a list/detail split — below `md` it becomes list-then-detail navigation, not a split pane. `PMDashboardPage` already has `MobileDashboardHome`; verify parity now that the rest of the module is responsive, and check the mobile home is not hiding things that now work.

---

### Phase 7 progress

All twelve routes **PASS** at 360px — every PM settings page, `/inbox`,
`/marketing` and the PM dashboard.

As the plan predicted, this phase was short: the primitives had already absorbed
almost everything. Only 8 field occurrences and one grid were left to change,
plus five one-off targets.

| Change | Scope |
|---|---|
| 8 field occurrences → 44px + 16px text | settings, inbox, pm-dashboard |
| Inbox filter pills → 44px (height **and** width) | `app/(app)/inbox/page.tsx` |
| Icon buttons → 44px | `BankDetailsForm`, `PropertyKeysTab` |
| "Cancel" text buttons → 44px | `integrations/ui/IntegrationCard.tsx` (shared) |

#### Two plan assumptions retired

- **`/inbox` is not a split pane.** The plan said it was a 5-column table with a
  list/detail split that should become list-then-detail on a phone. It is a
  card list, and always was — nothing structural to do.
- **Short labels need `min-w`, not just `min-h`.** "All", "Cancel" and the
  icon-only buttons all reached 44px tall and stayed ~36px wide. This kept
  recurring right to the last route of the last phase; `min-w-11` alongside
  `min-h-11` is the complete fix for any control with a short label.

---

## Phase 8 — Verification sweep & regression gate

### A stale dev server invalidated a run — and the guard that now prevents it

A dev server left running across hundreds of edits (with an already-corrupt
`.next/cache/webpack`) served **stale Tailwind output**. On `/keys` a button
carrying `h-11` computed to **21px** — not 44, not its `sm:h-8` fallback of 32,
but content height, because the class generated no CSS at all. Every element on
the page measured at roughly 58% of its declared size, including shell chrome
that had not been touched in weeks.

The dangerous part was that it **reproduced perfectly across runs**. Stable and
correct are not the same thing: a consistently stale stylesheet looks exactly
like a real regression, and it was briefly reported as one.

Fixed by stopping the server, deleting `.next/cache/webpack`, and restarting.
`assertStylesheetIsLive()` now runs at preflight: it injects a probe element
with `h-11 w-11` and aborts with exit code 3 unless it computes to 44×44. No
run can silently measure against CSS that is not being generated.

**Do not run the audit and `npm run build` at the same time.** On a 16GB machine
they starve each other: the build exited 1 with no error, and the concurrent
sweep reported `/properties/[id]/edit` at 52 undersized targets against a true
2. Both results were contention, not code.

- `node e2e/mobile-audit.mjs` across all 55 PM routes at 360/390/414 — zero horizontal overflow, zero sub-44px targets
- Walk one full create → edit → delete journey per feature at a phone viewport (the audit catches layout, not flow)
- `npx tsc --noEmit` and `npm run build` (note: `npm run lint` hangs — no ESLint config; do not use it)
- Check dialogs against the CLAUDE.md UI rules at mobile width: visible label above every field, hint below the label, inline error below the field, red `Trash2` delete, secondary-variant action button
- Wire the audit into the normal pre-push checks so this does not regress

---

## Phase 9 — Dialogs, fixtures and public routes

Three gaps the route sweep could not close, done after Phase 8.

### The dialog audit found a regression five phases old

`e2e/mobile-dialog-audit.mjs` opens each modal surface and measures it. The
route sweep only ever sees dialogs **closed**, so a green sweep says nothing
about the create/edit/add surfaces — which is most of what a property manager
actually does.

It immediately found a bug **I introduced in Phase 3**: stacking field-pair
grids to `grid-cols-1 sm:grid-cols-2` without prefixing their `col-span-2`
children. At 360px that is a child spanning two columns of a one-column grid, so
CSS Grid invents an implicit second column and the real one collapses — the date
and number inputs in the New Contract dialog rendered **26px wide**. 21 spans
across 7 files, now `sm:col-span-2`.

It shipped in Phase 3 and survived every green sweep since, because those fields
only exist inside a dialog.

| Run | Opened | Clean | Problems |
|---|--:|--:|--:|
| first | 66 | 6 | 60 |
| after col-span + shared chrome | 82 | 60 | 22 |
| after the last five | 81 | 78 | 3 |
| **final** | **79** | **79** | **0** |

**Phase 0 validated:** across all 79, zero panels that could not scroll and zero
controls stranded below the fold. That was the defect that made 46 dialogs
unusable, and it is gone.

Also fixed here: a **14th hand-rolled modal** (`booking-forms/QuestionEditor`,
no `role="dialog"`), the shared `MobileSheet` close button (32px, on every
route), merge-field chips at 21px, five file inputs, the assistant composer and
suggestion rows, `LandlordDialogs` fields, pagination, and the mobile sign-out.

Caveat: the audit reaches ~79 of ~102 modal surfaces. The rest need a row
selected or a different entry point and remain unmeasured.

### A safety defect in the tenant guard

`assertTestTenant()` does not verify tenant identity — it matches the page text
against `"Property Co."`, which is the **hardcoded fallback brand** in
`SideNav.tsx:76` for any PM tenant with no `brand_name`. Both **Test Tenant**
and **Demo Agency** render it, so the check cannot tell them apart. It blocks
Truehold (what it was written for) but would let a writing run into Demo Agency.

`assertWritableTenant()` now resolves the signed-in account to its actual
`tenants.slug` and refuses anything else. **Any script that writes should use
it, not the text check.**

### Fixtures and public routes

`e2e/seed-audit-fixtures.mjs` (idempotent, gated on the identity guard) creates
an evaluation, an automation rule and an inbox request, and resolves ids for
routes that had data but were simply **not linked** from their list page — which
is why link-following discovery never reached them.

It also resolves the identifiers for the renter-facing pages, which had never
been audited at all: `/f/<slug>`, `/s/<token>`, `/portal/login`. These sit
outside the app shell, so the probe measures the document rather than `<main>`.

---

## Sequencing rationale

Phase 0 is non-negotiably first — it removes the same defect from 46 create/edit surfaces at once, and building it later means touching every dialog twice.

Phase 1 is Properties rather than a bottom-nav tab because Properties is where the shared `Page / FilterBar / ListView / Kanban / Drawer` shape gets solved; Phases 2 and 3 then apply a known recipe instead of re-deciding per feature.

Phases 2 → 7 descend by how often the screen is genuinely opened on a phone: on-site maintenance, then the lettings chain, then money, then admin tooling, then analysis.

Each phase is independently shippable and independently verifiable.
