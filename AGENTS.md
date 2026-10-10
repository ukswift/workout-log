# AGENTS.md — WorkoutLog maintainer context

**Read this file before reading any source.** It is the compressed working memory of this
project: what the app is, every feature it ships, the invariants that must not break, where
each thing lives in code, and the traps previous sessions already hit.

**Audience: AI agents only.** Optimised for fast, accurate context — not for human prose.

---

## 0. The protocol (read this part every time)

### When you start a session
1. Read this file top to bottom. It is ~400 lines and replaces reading ~3,400 lines of
   `index.html` plus every config file.
2. Jump straight to the **§12 change log** at the bottom to see what changed most recently.
3. Go to the specific code for the feature you were asked about using the **§4 code map** —
   grep the *function name*, not the line number (line numbers drift every commit).
4. Only read `index.html` in full if the task is a broad refactor with no clear entry point.

### When you finish a change
**You must update this file in the same commit.** A stale AGENTS.md is worse than none.
- Add a dated entry to **§12 change log** (newest first): what changed, which functions moved,
  any new storage key, any new invariant, any test added.
- Update the **§7 feature table** if you added/changed/removed a feature.
- Update the **§6 data model** if you added/changed a storage key or entity field.
- Update the **§4 code map** if you added a function worth finding again.
- Update **§10 known debt** if you fixed or discovered a landmine.
- Fix any line-number references you touched.

### Versioning rule
Every commit auto-bumps a patch version (see §9). Never hand-edit the version.

---

## 1. What this app is

**WorkoutLog** — a single-file, offline-first, installable PWA for logging gym workouts.

- Users log exercises → sets → (weight × reps) against a calendar day.
- Zero backend. All data lives in the browser's `localStorage` scoped to the origin.
- Zero build step. Zero dependencies at runtime except Chart.js from a CDN.
- Target feel: **fast and frictionless on a phone**, one-handed, no sign-up.

Live: <https://ukswift.github.io/workout-log/> · Repo: `github.com/ukswift/workout-log`

---

## 2. Hard constraints — breaking these breaks the app

These are non-negotiable. If a request requires violating one, flag it before proceeding.

| # | Constraint | Why |
|---|---|---|
| 1 | **Everything stays in `index.html`** — HTML, `<style>`, `<script>`. No modules, no bundler, no build step, no `import`/`export` syntax. | Deployment is "copy static files to Pages". A build step would break §9 entirely. |
| 2 | **All JS is global scope.** No `type="module"`. Inline `onclick="fnName()"` handlers are used everywhere and require globals. | Hundreds of inline handlers; converting to modules silently breaks them all. |
| 3 | **Must be served over HTTP, never `file://`.** | `fetch('./defaults.json')` and service-worker registration both fail on `file://`. Tests run a `python3 -m http.server`. |
| 4 | **All storage access goes through `safeGet` / `safeSet`.** Never call `localStorage` directly to read/write app data. | `safeSet` mirrors into `memStorage` so the app still works when storage is blocked or full. Direct calls lose that fallback and the quota toast. |
| 5 | **Storage keys are namespaced `workoutlog:`** via `STORAGE_PREFIX`. The *only* exception is the `memStorage` keys, which are stored unprefixed in memory by design. | Avoids collisions with anything else on the origin. |
| 6 | **Dates are `YYYY-MM-DD` local strings**, produced by `fmtDate()`. Never `toISOString()` for a day key. | `toISOString()` is UTC and shifts the day near midnight. `fmtDate` uses local components. |
| 7 | **Wheel picker geometry must come from the DOM**, not constants. | See §10 landmine #1 — a hardcoded 44px assumption caused a real production bug. |
| 8 | **`chartRange` and `detailRange` are the same setting.** | The chart range selector mutates `state.settings.chartRange` and persists it. |
| 9 | **Any destructive action needs a confirmation.** | Import, delete tag, delete preset, delete workout log, clear logs. Deleting a *set* or a *workout card* uses Undo instead. |
| 10 | **`index.html` must keep `const APP_VERSION = "x.y.z";` on one line in that exact form.** | `scripts/bump-version.js` regex-replaces it and `exit 1`s if not found, which blocks every commit. |

---

## 3. Repository map

```
index.html                     ← THE APP. ~3,400 lines. Everything lives here.
defaults.json                  ← Seed data shipped to new users: 33 exercises, 26 tags, 11 presets.
manifest.json                  ← PWA manifest (standalone, portrait, icons).
sw.js                          ← Service worker. Cache name "workoutlog-v5".
icons/                         ← icon-192, icon-512, icon-maskable-512, favicon-32.
scripts/bump-version.js        ← Version bumper. Syncs package.json + index.html + README.
.githooks/pre-commit           ← Runs the bumper on every commit, then `git add`s the 3 files.
tests/e2e/workout-log.spec.js  ← All 9 Playwright specs (×2 viewports = 18 tests).
playwright.config.js           ← Test config; auto-starts the static server.
.github/workflows/test.yml     ← CI: e2e job, then a GATED deploy job.
package.json                   ← Only devDep is @playwright/test. Scripts are the dev interface.
README.md                      ← User-facing. Has a "### Current version: x.y.z" line the bumper rewrites.
.cursor/rules, .github/*       ← See §11 if present.
```

**Not in the repo on purpose:** tests, configs, `node_modules`, `_site` are never published —
the CI deploy job copies only `index.html manifest.json sw.js defaults.json icons LICENSE README.md`.
`test-results/`, `playwright-report/`, `_site/`, `playwright/.cache/` are gitignored.
`package-lock.json` **is** tracked (CI needs it for `npm ci`) — do not re-ignore it.

---

## 4. Code map — `index.html`

One file, ordered top → bottom. **Line numbers are hints only; grep the function name.**
Registered global function names are the real API — inline handlers depend on them.

### CSS (`<style>`, lines ~20–500)
Theme tokens on `:root` (colours, `--radius`, `--wheel-*` geometry, `--card-gap`).
Layout sections in order: base/reset → `#app` shell → `#log-list` → cards → set pills →
modals (`.modal-overlay` / `.modal` / `.fullscreen-panel`) → toast → onboarding → charts → calendar.
A `@media(min-width:680px)` block converts full-screen modals into centred 500px dialogs.

Key layout variables: `--app-viewport-height` (set from `visualViewport`), `--action-footer-height`
(measured from the footer element), `env(safe-area-inset-*)` for notches.

### Constants & state (lines ~518–610)
| Symbol | Notes |
|---|---|
| `APP_VERSION` | Rewritten by the bumper. Constraint #10. |
| `PICKER_LIMITS` | Default min/max/step for weight & reps wheels. |
| `PROGRESSION_TARGET_REPS` | 12. The dashed target line on the rep chart. |
| `UI_CONSTANTS` | Only `undoStackMaxSize` and `wheelItemHeightPx` are actually read — see §10. |
| `STORAGE_PREFIX` | `"workoutlog:"` |
| `STORAGE_KEYS` | **Dead code.** Defined, never referenced. |
| `$`, `uid`, `fmtDate`, `displayDate` | Core utils. `uid()` = time36 + random36. |
| `state` | The single mutable UI+data object. See §5. |
| `historyStack` | Undo stack, JSON strings of `currentLog`. In-memory only. |

### Storage layer (lines ~612–705)
`pushHistory()` / `undo()` · `memStorage` · `safeGet()` · `safeSet()` ·
`restoreOnboardingReplay()` · `repairLogDates()` · `triggerHaptic()` · `showToast()`

### Boot & loading (lines ~720–930)
`loadAll()` — the real entry point. Calls `restoreOnboardingReplay` if a tour replay was
interrupted, then loads every key, `repairLogDates()`, merges `settings`, fetches
`defaults.json` for picker limits, seeds defaults once (`defaultsLoaded`), seeds the
onboarding sample data on first run, then `loadLogForDate()` + `render()`.
Also: `seedOnboardingSampleData()` · `loadChartDemoData()` (dev-only `?demo=chart|30d`) ·
`loadDefaults()` · `loadLogForDate()` · `saveCurrentLog()` · `getLastUsedSetValues()` ·
`getPreviousExerciseSession()` · `tagName()` · `sortedTagIds()`.

### Navigation & swipe (lines ~960–1064)
`changeDate()` · `setupTouchNavigation()` (swipe `#log-list`) · `slideView()` (the shared
slide animation, guarded by `viewTransitionBusy`, respects `prefers-reduced-motion`) ·
`loadCalendarMonthLogs()` · `changeCalendarMonth()` · `setupCalendarSwipe()`.

### Card reordering (lines ~1064–1120)
`handleDragStart/DragOver/Drop/DragEnd` + `cleanupDrag()`. HTML5 drag-and-drop; the grip
handle toggles `draggable` on pointerdown so text selection elsewhere still works.

### Exercises, tags, presets (lines ~1120–1655)
`openPicker` · `closeModal` · `openCreateFromSearch` · `isExerciseNameExists` ·
`findExerciseByName` · `saveNewExercise` · `normalizeTagName` · `createAndApplyTag` ·
`openTagManager` · `createTagFromManager` · `saveManagedTag` · `deleteManagedTag` ·
`openTagExercisePicker` · `setManagedTagExercise` · `togglePickerExerciseTag` ·
`renderTagManagerList` · `addExerciseToLog` · `deleteEntry` · `deleteSet` ·
`openDatePicker` · `selectDate` · `goToToday` · `renderDatePicker` ·
`openRoutinesModal` · `openEditRoutineModal` · `toggleRoutineEx` · `setRoutineSearch` ·
`openCreatePresetFromCurrentLog` · `saveRoutine` · `deleteRoutine` · `applyRoutine`

### Render pipeline (lines ~1655–1710)
**`render()`** — the single re-render path. Wipes `#app`, rebuilds it from
`renderLogListContent()` + `renderActionFooter()` + `renderModal()`, restores
`#log-list` scroll position, then re-binds swipe handlers, re-measures the footer, and
schedules the onboarding overlay. The hidden `<input id="importInput">` is recreated here
on every render. Also `openProfile` / `openSettings` / `openDayActions` / `updateSetting` /
`renderTipBanner`.

### Onboarding (lines ~1713–1955)
`ONBOARDING_STEPS` (9 spotlight steps) · `startOnboardingTour()` · `finishOnboardingTour()` ·
`advanceOnboardingTour()` · `prepareOnboardingStep()` · `backOnboardingTour()` ·
`renderOnboardingTour()` · `renderOnboardingChoice()` · `continueWithSampleData()` ·
`clearWorkoutLogsAndStartFresh()` · `dismissTip()`.

### Progress charts (lines ~1958–2160)
`openExerciseDetails()` · `closeExerciseDetails()` · `destroyExerciseDetailCharts()` ·
`detailRangeStart()` · `collectExerciseHistory()` · `loadExerciseDetails()` (draws both
Chart.js instances and the history list) · `setDetailRange()` · `renderExerciseDetailRanges()` ·
`savePickerLimits()` · `formatRangeHint()` · `updateRangeHint()`.

### Log list & set pills (lines ~2192–2510)
`renderLogListContent()` (builds cards, set pills, inline editor, empty states) ·
`renderActionFooter()` · set reordering: `handlePillPointerDown()` → `beginPillDrag()` →
`updatePillDrag()` → `endPillDrag()` with `LONG_PRESS_MS`/`MOVE_CANCEL_PX` ·
`toggleEditSet()` · `saveSetPicker()` · `cancelSetPicker()` · `deleteSetFromPicker()` ·
`addSetInline()` · `updateSetField()`.

### Wheel picker (lines ~2428–2455, 2652–2723)
`getWheelItemHeight()` · `updatePickerValue()` · `initSetPickerWheels()` ·
`buildWheelValues()` · `storedPickerValue()` · `renderSetPickerModal()`.

### Modal router (lines ~2511–2530)
`renderModal()` — an if-chain on `state.modal`. **Any new modal must get a branch here.**

### Modal renderers (lines ~2529–3030)
`renderExerciseDetailsModal` · `renderProfileModal` · `renderTagManager` ·
`renderSettingsModal` · `renderSetPickerModal` · `renderDayActionsModal` ·
`renderPickerModal` · `renderPickerList` · `renderNewExerciseModal` · `renderTagOptions` ·
`renderRoutinesModal` · `renderNewRoutineModal` · `renderImportConfirmModal`.

### Data in/out (lines ~3031–3360)
`updateSetField` · `exportData()` · `triggerImport()` · `summarizeLogs()` ·
`getCurrentDataStats()` · `validateBackup()` · `restoreLogKey()` · `collectLogKeys()` ·
`handleImportFile()` · `cancelImport()` · `applyImport()` · `sweepOrphanLogKeys()`.

### Helpers & boot tail (lines ~3361–3396)
`escapeHtml` / `escapeAttr` (use them for **all** interpolated user data) ·
`syncMobileViewport` · `syncActionFooterHeight` · then the boot block: standalone-PWA
class, `visualViewport` resize listener, `loadAll()`, service-worker registration.

---

## 5. `state` — the single mutable object

Initial shape at line ~565. Fields added at runtime (not declared upfront):
`state.pickerWheelValues`, `state.pendingImport`, `state.pendingImportStats`,
`state.formError`, `state.formErrorExerciseId`, `state.editingTagId`,
`state.editingTagExercisesId`.

**There is no reactive framework.** The rule is: mutate `state`, then call `render()`.
For persistence also call the relevant `safeSet`, or `saveCurrentLog()` for day data.

Important groups:
- `currentDate` / `currentLog` / `logDates` — what's on screen vs. what exists.
- `calendarLogDates` — a `Set`, populated by `loadCalendarMonthLogs()`, used only by the calendar.
- `modal` — drives `renderModal()`. `null` = no modal.
- `editingSet` — `{entryId, setId, isNew, initialValues}` powers the wheel picker; `isNew:true`
  means the set is a draft that `cancelSetPicker()` deletes.
- `settings` — persisted; see §6.
- Onboarding flags: `onboardingActive` (tour running), `onboardingCompleted` (seen forever),
  `onboardingDemoActive` (sample data is loaded), `onboardingReplayActive` (a replay is using a
  temporary backup), `onboardingFinishPrompt` (show the "keep samples or clear" choice).

---

## 6. Data model

### Storage keys (authoritative)
Everything is `"workoutlog:" + key`. Keys in **bold** are part of the user's real data and
must survive an import round-trip.

| Key | Shape | Notes |
|---|---|---|
| **`exercises`** | `[{id, name, tagIds:[]}]` | id = slug for seeded (e.g. `bench-press`), `uid()` for created |
| **`tags`** | `[{id, name}]` | `id` = slug for seeded, `uid()` for created |
| **`routines`** | `[{id, name, exerciseIds:[]}]` | "Presets" in the UI. Order of `exerciseIds` is meaningful |
| **`logDates`** | `["YYYY-MM-DD", …]` | Denormalised index of days that have a log |
| **`log:<date>`** | `[{id, exerciseId, sets:[{id, weight, reps}], updatedAt}]` | One per day. `weight`/`reps` may be `""` while incomplete |
| `settings` | `{showTags, chartRange, pickerLimits:{…}, tipsDismissed:{}}` | Merged over defaults on load |
| `defaultsLoaded` | `true` | Guard so `defaults.json` seeds exactly once |
| `onboardingCompleted` | `true` | Tour never auto-starts again |
| `onboardingDemoActive` | `true` | Sample data is currently loaded |
| `onboardingDemoDates` | `["YYYY-MM-DD"]` | Which sample days were seeded |
| `onboardingReplayBackup` | `{exercises,tags,routines,logs,logDates,onboardingDemoDates,onboardingDemoActive}` | Temporary; the whole user dataset while replaying the tour |
| `onboardingReplayRestoring` | `true` | Crash marker so an interrupted replay gets restored on next boot |

`memStorage` keys: the same key names but **without** the `workoutlog:` prefix (e.g. `log:2026-01-05`).

### Invariants (violating these corrupts user data)
1. **Every date in `logDates` has a `log:<date>` key, and vice versa.** Day keys holding an
   empty array are deleted rather than stored empty — `saveCurrentLog()` enforces this and
   `repairLogDates()` retro-fixes violations on boot.
2. **`logDates` is always sorted** ascending when persisted.
3. **An orphan is a `log:<date>` key with no entry in `logDates`.** Orphans are invisible to the
   UI (which renders from `logDates`) but still occupy storage and can resurface. Import and the
   tour replay must both sweep them — see `sweepOrphanLogKeys()` and `clearWorkoutLogsAndStartFresh()`.
4. **Entity ids are stable and referenced by id**, never by name. `state.exercises` is the
   lookup table; a `log` entry whose `exerciseId` no longer exists renders as `"(deleted workout)"`.
5. **Deleting a tag must also strip its id from every `exercise.tagIds`** (see `deleteManagedTag`).

### Backup file format (`exportData()` → `import` accepts)
```jsonc
{
  "exportedAt": "ISO-8601",
  "version": "2.0",          // written on export, read only for the import preview
  "exercises": [...], "tags": [...], "routines": [...],
  "logDates": ["YYYY-MM-DD"], // advisory — `logs` keys are treated as authoritative
  "logs": { "YYYY-MM-DD": [ entry, ... ] }
}
```
`validateBackup()` is the contract: must be a plain object, `logs` a plain object of arrays
keyed by `YYYY-MM-DD`, `exercises`/`tags` arrays, `routines` array-or-absent, and **not all
empty**. An empty-but-valid payload is a hard reject (this was a real data-loss bug).

---

## 7. Feature inventory — what ships and what must not break

Grouped by area. "Entry points" = the functions/DOM to grep. "Invariant" = the thing a
regression would destroy.

### A. Core logging
| Feature | Entry points | Invariant |
|---|---|---|
| Log a workout (add exercise to the day) | `openPicker`, `addExerciseToLog`, `renderPickerModal`, `renderPickerList` | Adding an exercise that already exists on the day appends a set to the existing entry instead of duplicating the card |
| Set picker (two scroll wheels) | `renderSetPickerModal`, `updatePickerValue`, `initSetPickerWheels`, `saveSetPicker` | Out-of-range/off-grid stored values are preserved as an extra wheel option, never silently clamped (§10 #1) |
| Prefill from last use | `getLastUsedSetValues` | A brand-new set starts at the last values used **on this day**, else blank |
| Previous-session reference | `getPreviousExerciseSession` | Walks back through `logDates` for the most recent completed sets of that exercise |
| Edit a set | `toggleEditSet`, `updateSetField`, `saveSetPicker` | Cancel restores `editingSet.initialValues` exactly |
| Delete a set / a workout card | `deleteSetFromPicker`, `deleteSet`, `deleteEntry` | Pushes Undo before mutating |
| Reorder sets | `handlePillPointerDown` → `endPillDrag` | Tap opens the editor; 350ms hold starts a drag — never both |
| Reorder exercise cards | `handleDragStart/Drop` | `pushHistory()` before the splice |
| Undo | `pushHistory`, `undo`, `showToast(msg, allowUndo)` | Max 20 steps, **current day only**, lost on reload; the Undo button only appears when the stack is non-empty |

### B. Dates
| Feature | Entry points | Invariant |
|---|---|---|
| Prev/next day | `changeDate`, `slideView` | The "next day" arrow is hidden on today — **the app cannot log the future** |
| Swipe between days | `setupTouchNavigation` | Ignores swipes starting on pills/buttons/inputs |
| Calendar | `openDatePicker`, `renderDatePicker`, `loadCalendarMonthLogs`, `changeCalendarMonth`, `setupCalendarSwipe`, `goToToday` | Green = logged, accent = today, outline = selected; swipe changes month |
| Day actions | `renderDayActionsModal`, `openCreatePresetFromCurrentLog` | "Save day as preset" needs ≥1 exercise on the day |

### C. Exercises & tags
| Feature | Entry points | Invariant |
|---|---|---|
| Library from `defaults.json` | `loadDefaults`, `defaultsLoaded` | Seeds exactly once, additively — never overwrites user data |
| Search & tag filter | `renderPickerList`, `setPickerTag` | Matches name **or** tag name; offers "+ Create" only when there's no exact name match |
| Create exercise | `openCreateFromSearch`, `saveNewExercise` | Duplicate names rejected case-insensitively and the error points at the existing one |
| Edit/delete exercise | `openEditExercise`, `saveEditExercise`, `deleteExercise` | Deleting keeps log entries, which render as `(deleted workout)` |
| Tag manager | `openTagManager`, `renderTagManagerList`, `createTagFromManager`, `saveManagedTag`, `deleteManagedTag`, `openTagExercisePicker`, `setManagedTagExercise` | Rename blocks duplicates; delete warns with the affected exercise list and strips the id everywhere |
| Show tags on cards | `updateSetting('showTags')` | Off by default to keep cards compact |

### D. Presets ("routines")
| Feature | Entry points | Invariant |
|---|---|---|
| List / create / edit / delete | `renderRoutinesModal`, `renderNewRoutineModal`, `saveRoutine`, `deleteRoutine` | Needs a name and ≥1 exercise; `alert()` validation is a known rough edge (§10) |
| Apply to day | `applyRoutine` | Appends a set to existing entries, creates entries for new ones |
| Save day as preset | `openCreatePresetFromCurrentLog` | De-dupes exercise ids, preserves order |

### E. Progress
| Feature | Entry points | Invariant |
|---|---|---|
| Details panel | `openExerciseDetails`, `renderExerciseDetailsModal` | Opens from the chart icon on a card |
| Max-weight chart | `loadExerciseDetails` (canvas `#exercise-chart`) | Custom `maxWeightLabels` plugin thins labels so they don't overlap |
| Rep-progression chart | `loadExerciseDetails` (canvas `#exercise-rep-chart`) | One x-slot per workout day; points coloured by weight; dashed line at `PROGRESSION_TARGET_REPS` (12) |
| History list | `collectExerciseHistory`, `loadExerciseDetails` | Sorted newest first; read-only pills |
| Range filter | `detailRangeStart`, `setDetailRange` | Persists to `settings.chartRange` (**constraint #8**) |
| Cleanup | `destroyExerciseDetailCharts` | Must be called before re-rendering or closing, or Chart.js leaks canvases |

### F. Data safety
| Feature | Entry points | Invariant |
|---|---|---|
| Export backup | `exportData` | Filename `workout-app-log-<YYYY-MM-DD-HHMMSS>.json` |
| Import — validate | `handleImportFile`, `validateBackup` | Malformed **and empty** payloads are rejected with a reason; nothing is written |
| Import — preview & choose | `renderImportConfirmModal`, `cancelImport` | Shows device-vs-backup counts; Cancel touches nothing |
| Import — merge | `applyImport('merge')` | Keeps local days, adds only missing ones, skips overlaps, de-dupes entities by id |
| Import — replace | `applyImport('replace')` | Exact restore; snapshots everything first and rolls back on any `safeSet` failure |
| Orphan sweep | `sweepOrphanLogKeys`, `collectLogKeys` | After import, `log:` keys not in `logDates` are deleted from `localStorage` **and** `memStorage` |
| Empty state | `renderLogListContent` | Offers "+ Log workout" and "Import log" when there's no data at all |
| Clear & start fresh | `clearWorkoutLogsAndStartFresh` | Confirm first; only surfaced while `onboardingDemoActive` |

### G. Settings
`renderSettingsModal`, `updateSetting`, `savePickerLimits`, `formatRangeHint`, `updateRangeHint`.
- Show tags · picker limits (min/max/step for weight and reps) · default chart range.
- `loadAll()` lets `defaults.json → pickerLimits` apply **only** if the user has never saved
  limits of their own.

### H. Onboarding
| Feature | Entry points | Invariant |
|---|---|---|
| First-run tour | `ONBOARDING_STEPS`, `startOnboardingTour`, `advanceOnboardingTour`, `prepareOnboardingStep`, `renderOnboardingTour` | Starts only when not completed, not demo-active, and no app data exists |
| Sample data | `seedOnboardingSampleData` | 18 days / ~3 weeks across a 6-day split with bench progression; records ids in `onboardingDemoDates` |
| Replay tour | `startOnboardingTour` (guarded by `onboardingActive`) | Stashes the **entire** user dataset in `onboardingReplayBackup` and restores it on finish — this is the riskiest code in the app |
| Finish choice | `renderOnboardingChoice`, `continueWithSampleData`, `clearWorkoutLogsAndStartFresh` | Either keeps sample data or wipes logs |
| Spotlight mechanics | `prepareOnboardingStep`, CSS `.onboarding-shade/.onboarding-spotlight/.onboarding-card` | Targets come from `data-onboarding-target="…"` attributes |
| Tip banners | `renderTipBanner`, `dismissTip`, `settings.tipsDismissed` | Keys: `log`, `calendar` |

### I. Platform
| Feature | Where | Invariant |
|---|---|---|
| PWA install | `manifest.json`, meta tags, `.standalone-pwa` class | Standalone detection must not change the layout of the top bar |
| Offline | `sw.js` | `CACHE_NAME` must be **bumped whenever cached shell files change** (§10 #5) |
| Worker strategy | `sw.js` fetch handler | Network-first for documents (`index.html`, `manifest.json`, `sw.js`), cache-first for assets |
| Haptics | `triggerHaptic()` | Guarded by `navigator.vibrate`; never throws |
| Reduced motion | `slideView` | Checks `prefers-reduced-motion: reduce` and skips the animation |
| Safe areas / keyboard | `syncMobileViewport`, `syncActionFooterHeight`, `--app-viewport-height` | Uses `visualViewport` because `100dvh` is wrong when the keyboard is open |

---

## 8. Cross-cutting systems you must understand before editing

### The render loop
`render()` is a **full teardown and rebuild** of `#app` innerHTML — there is no diffing.
Consequences:
- Never hold references to DOM nodes across a `render()`; re-query instead.
- All state that should survive must live in `state` or storage, not in the DOM.
- `#importInput` is recreated every render — that's why the file input is bound via `onchange`
  inline and why Playwright can `setInputFiles('#importInput', …)` after any render.
- Scroll position of `#log-list` is captured before and restored after.

### The modal system
`state.modal` is a string; `renderModal()` maps it to a renderer. Existing values:
`picker`, `tagExercisePicker`, `newExercise`, `editExercise`, `tagManager`, `routines`,
`newRoutine`, `profile`, `settings`, `exerciseDetails`, `setPicker`, `dayActions`,
`datepicker`, `importConfirm`.
- Two shells: `.modal-overlay` + `.modal` for compact dialogs, `.fullscreen-panel` for full pages.
- `closeModal()` resets modal-scoped fields — **add your new fields there** or they leak.
- On desktop everything becomes a centred ≤500px dialog via the 680px media query.
- **Layout landmine:** a flex child inside an auto-height desktop modal needs `flex: 1 1 auto`,
  not `1 1 0`, or it collapses to 0px height (§10 #2).

### The storage layer
- `safeSet(key, value)` always mirrors into `memStorage`, then tries `localStorage`, and
  **returns a boolean**. Use the return value when you need atomicity (§ F import).
- `safeGet(key)` reads `localStorage` first, falls back to `memStorage`, returns `null` if absent.
- There is **no `safeRemove`**. To delete, do it in both stores — the canonical snippet is in
  `clearWorkoutLogsAndStartFresh` / `sweepOrphanLogKeys`:
  iterate `localStorage.key(i)` for the prefix, `removeItem` each, then
  `Object.keys(memStorage).filter(k => k.startsWith(...)).forEach(k => delete memStorage[k])`.

### Undo
`pushHistory()` **before** mutating `currentLog`; `showToast(msg)` renders an Undo button only
when `allowUndo` is true *and* the stack is non-empty. Never pass `false` and expect undo;
never rely on undo surviving `loadLogForDate()` (which resets the stack) or a reload.

### Onboarding spotlight
Steps declare a CSS selector in `ONBOARDING_STEPS`; `prepareOnboardingStep` resolves it against
the live DOM and falls back to the log button if a target is missing. If you rename or remove a
`data-onboarding-target`, update the step array too or that step silently points at the wrong thing.

---

## 9. Development, testing, release

### Commands
```bash
npm test                      # all tests, both viewports (18)
npm run test:e2e:mobile       # mobile project only
npm run test:e2e:headed       # watch a real browser
npm run test:e2e:demo         # headed + slowMo 800ms + 1 worker + always record  (demos)
npm run test:e2e:ui           # interactive UI mode
npm run test:e2e:debug        # step debugger
npm run test:e2e:record       # keep screenshots/video/trace for passing runs too
npm run test:e2e:report       # open last HTML report (:9323)
npm run version:patch|minor|major
```
Playwright auto-starts `python3 -m http.server 4173 --bind 127.0.0.1`; the app **must** be
served over HTTP (constraint #3). Stray servers cause `EADDRINUSE` on the report port.

### Tests — `tests/e2e/workout-log.spec.js`
9 specs × {mobile Pixel 5, desktop Chrome} = 18. The comment in `playwright.config.js` explains
why both viewports exist: **the original wheel bug was a real-layout mismatch** (44px assumed
vs 38px rendered on narrow screens). Unit-free, DOM-level, real-browser layout.

| Spec | Guards |
|---|---|
| home screen shows the core controls | app boots and renders |
| logging a set through the wheel saves the chosen weight and reps | wheel → state → DOM |
| a logged set survives a page reload | persistence + `safeSet` |
| moving to another day shows that day's log | `changeDate` / `loadLogForDate` |
| profile panel opens with its options | profile modal contents |
| cancelling an import leaves existing data untouched | **data safety**: cancel is a no-op |
| an empty backup is rejected instead of wiping data | **data safety**: the empty-payload bug |
| importing a backup merges only the days that are missing | merge semantics + skip reporting |
| replacing with a smaller backup sweeps orphaned days | orphan sweep, verified in `localStorage` |

Setup conventions: `beforeEach` sets `workoutlog:onboardingCompleted`; helpers `openApp`,
`scrollWheelTo` (sets `scrollTop` to the snap index and dispatches `scroll` — mirrors a real
wheel spin), `logSet`.

**When you add a feature, add a spec.** Helpers `storedLogKeys(page)`, `backupFile({...})` and
`openImport(page, payload)` already exist for storage-level assertions. Assert on `localStorage`
for anything storage-related — DOM-only assertions missed the orphan bug.

### Release & CI — `.github/workflows/test.yml`
- Job `e2e`: checkout → node 20 → `npm ci` → read Playwright version from
  `package-lock.json` → cache `~/.cache/ms-playwright` keyed on that version → install browser
  only on cache miss → `install-deps` on cache hit → `npm test` → upload
  `playwright-report` and `test-results` artifacts (3-day retention, on pass or fail).
- Job `deploy`: `needs: e2e`, main-only, **gated on tests passing**, stages a `_site/` directory
  with only the static app files and publishes via Pages.
- Pages source is **"GitHub Actions"**, not a branch — so the repo root is not served and
  test/config files never leak.
- Concurrency: tests cancel-in-progress per branch; deploys queue and never cancel.

### Versioning
`.githooks/pre-commit` runs `scripts/bump-version.js patch` on every commit, then `git add`s
`package.json`, `index.html`, `README.md`. It regex-replaces `const APP_VERSION = "x";` in
`index.html` and `### Current version: x.y.z` in `README.md`, and exits 1 if the first is missing.
Skip it with `WORKOUTLOG_SKIP_VERSION_BUMP=1` (use for non-release commits such as docs-only or
empty commits, to avoid burning version numbers).

---

## 10. Known debt, landmines, and history

### Landmines (read before touching the area)
1. **Wheel geometry — already caused one production bug.** The wheel assumed a 44px row;
   narrow screens rendered 38px, so selection landed on the wrong value. Fix: always read
   geometry from the DOM (`getWheelItemHeight`) and preserve off-grid stored values as an extra
   option (`buildWheelValues`). Never reintroduce a hardcoded height.
2. **Desktop modal collapse.** An auto-height desktop modal gives `flex-basis:0` children zero
   height. Fixed for `.picker-list-container`/`.tag-available-box` with `flex: 1 1 auto`; apply
   the same rule to any new scrollable modal child.
3. **Import was destructive.** It had no confirmation, silently accepted empty backups, reported
   false success, disabled Undo, left orphaned `log:` keys, and had no rollback. All fixed — but
   preserve the properties: validate → preview → choose → snapshot → write → rollback on
   failure → sweep → report real counts.
4. **Undo is not global.** It only covers `currentLog` for the current day and dies on reload.
   Anything cross-day or cross-entity (import, tag delete, preset delete) must confirm instead.
5. **Service-worker staleness.** `CACHE_NAME` is `workoutlog-v5`. **If you add or rename a
   cached shell file, bump the cache name**, or installed users keep serving the old shell.
6. **No schema migration exists.** There is no `schemaVersion` on stored data and no upgrade
   path. Changing a stored shape means writing a migration in `loadAll()` (or tolerating both
   shapes) — and note `defaults.json`'s `"version": "1.0.0"` and the backup's `"version": "2.0"`
   are currently cosmetic and unenforced.

### Dead code (safe to delete, but don't be fooled into using it)
| Symbol | Status |
|---|---|
| `STORAGE_KEYS` | Defined, never referenced |
| `UI_CONSTANTS.cardGapPx` / `wheelPickerHeightPx` / `wheelCenterOffsetPx` / `scrollTopMarginPx` | Unread — CSS custom properties are the real source of truth for layout |
| `saveCurrentLog(recordHistory)` | Parameter is accepted and never used; history is pushed by callers via `pushHistory()` |
| `focusWeightInput()` | Defined, never called |
| `state.formErrorExerciseId` / `editingTagExercisesId` etc. | Declared at runtime, not in the initial `state` literal (fine, but grep before assuming a field exists) |

### Rough edges not yet addressed
- `saveRoutine()` uses `alert()` for validation instead of the inline error pattern.
- No `confirm()` on deleting a single set or workout card — it relies on Undo, which is
  session-only.
- Charts re-fetch every day's log from storage on each open (O(days) async reads).
- `PROGRESSION_TARGET_REPS` is a constant, not a per-user goal.
- No data-export scheduling, no cloud sync, no units other than lbs.

### History of this project (why things are the way they are)
- Started as a single-file PWA with a crude picker and no tests.
- Desktop layout bug (modal collapse) → fixed with `flex: 1 1 auto`.
- Wheel miscalculation bug → fixed by DOM-measured geometry + off-grid value preservation.
- Playwright e2e introduced (9 specs, dual viewport) because layout bugs were invisible to any
  logic-only check.
- CI added: tests gate the Pages deploy; browser caching cut the run from ~143s to ~54s
  (cache key is the Playwright version from `package-lock.json`, not a lockfile hash).
- Import hardened end to end (validation, preview, merge/replace, rollback, orphan sweep,
  honest reporting) plus 4 regression specs.
- Pages moved from "Deploy from a branch" to "GitHub Actions" so the repo root is never published.

---

## 11. Conventions to follow

- **Naming:** renderers are `renderX` / `renderXModal`; openers are `openX`; handlers are
  `handleX`; storage helpers are `safeX`.
- **Inline handlers are the norm** (`onclick="fn()"`). Any function referenced from HTML must be
  a top-level global declaration.
- **Escape everything interpolated:** `escapeHtml()` for text, `escapeAttr()` for attributes.
  Ids in string-interpolated handlers are unquoted-safe only because they're generated by `uid()`
  or slugs — don't interpolate user text into a handler.
- **Async storage:** persistence functions are `async`/`await`. Keep the `await` — a missing one
  means a lost write.
- **Confirm destructive, toast the result.** Success toasts should state real numbers.
- **Comments:** use `// ============ SECTION ============` banners for major regions and explain
  *why* for anything non-obvious, not *what*.
- **Never add a dependency.** Runtime is Chart.js from CDN; dev is Playwright only.

---

## 12. Change log (newest first — **append here, don't rewrite history**)

### 2026-10-10 — Import hardened + this document
- **Rewrote import** (`index.html` §Data in/out):
  - New `summarizeLogs`, `getCurrentDataStats`, `validateBackup`, `restoreLogKey`,
    `collectLogKeys`, `sweepOrphanLogKeys`, `renderImportConfirmModal`, `cancelImport`.
  - `handleImportFile` now validates then opens `state.modal = 'importConfirm'`.
  - `applyImport(mode)` supports `'merge'` | `'replace'`: snapshots every touched key,
    rolls back on any `safeSet` failure, sweeps orphaned `log:` keys, reports real counts.
  - Empty-but-valid backups are now a hard reject (was silent data loss + false success).
- **New state fields:** `state.pendingImport`, `state.pendingImportStats`. `closeModal()` resets them.
- **New modal value:** `importConfirm` (branch added to `renderModal()`).
- **New CSS:** `.import-confirm-overlay`, `.import-confirm-modal`, `.import-confirm-body`,
  `.import-compare`, `.import-confirm-actions`.
- **New renderer:** `renderImportConfirmModal` (~line 3324).
- **New invariant:** §6 invariants 1–5 are now enforced rather than assumed; orphan sweep is
  mandatory on import and on the onboarding replay.
- **Tests:** +4 import specs (cancel is a no-op, empty backup rejected, merge skips overlaps,
  replace sweeps orphans). Suite is now 9 specs × 2 viewports = 18.
- **README:** data & privacy section documents the two import modes.
- **This file created** to hold AI-maintainer context; replaces reading `index.html` wholesale.
