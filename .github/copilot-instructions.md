# Copilot instructions for this repository

## Read `AGENTS.md` first

**[`/AGENTS.md`](../AGENTS.md) is the single source of truth for working on this project.**
Read it before opening `index.html` or any other file. It contains:

- What the app is and the hard constraints that must never be broken
- A code map of `index.html` (one 3,400-line file — everything lives there)
- The full feature inventory **with the invariants each feature must preserve**
- The storage keys and data model
- How to run, test, version, and deploy

Reading `AGENTS.md` replaces reading the entire codebase. Prefer it over grepping blindly.

## Update `AGENTS.md` after every change

`AGENTS.md` is a **living document**. It is only useful if it stays current, and it is the
only place a future session will look. In the same commit as any change:

1. **Always:** append a dated entry to the **§12 change log** in `AGENTS.md` describing what
   changed, which functions were added/moved, and any new invariant or storage key.
2. **Adding or changing a feature:** update the §7 feature table and its "must not break" column.
3. **Adding or changing a storage key or entity field:** update the §6 data model.
4. **Adding a function worth finding again:** add it to the §4 code map.
5. **Fixing or discovering a landmine:** update §10 known debt.
6. **Line-number references:** if your edit shifted code, correct any line hints you touched
   (line numbers are hints only — function names are the stable anchors).

Do not create separate documentation files. Keep everything in `AGENTS.md` so there is exactly
one place to read and one place to update.

## Fast facts

- The whole app is `index.html` (HTML + `<style>` + `<script>`). No modules, no build step,
  all globals, inline `onclick` handlers.
- It must be served over HTTP — `file://` breaks `fetch('./defaults.json')` and the service worker.
- All storage access goes through `safeGet`/`safeSet`. `safeSet` returns a boolean — check it
  when a write must be atomic.
- Dates are local `YYYY-MM-DD` strings from `fmtDate()`. Never `toISOString()` for a day key.
- Run `npm test` (Playwright, 18 tests across mobile + desktop) before committing.
- Every commit auto-bumps the patch version via a pre-commit hook. Don't hand-edit the version.
