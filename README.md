# WorkoutLog

A lightweight, installable workout logger PWA — log exercises, sets, reps and weight with zero friction. No sign-up, works offline, your data stays on your device.

## Features

- Add exercises, tag them, and log sets (weight × reps) with minimal taps
- Reusable exercise bundles/presets (e.g. "Push day", "Leg day")
- Drag-to-reorder today's exercises
- Multi-level undo
- Works offline once installed; installable to your phone's home screen
- Export/import your full log as JSON for backup or moving between devices

## 🚀 Planned Features & Improvements

### High-impact next steps

Prioritized for the largest phone and gym usability gains relative to implementation effort:

1. [ ] **Rest Timer** — Start a configurable 60/90/120-second timer after saving a set, with pause, reset, background-safe timing, and vibration when complete.
2. [ ] **One-tap Repeat Set** — Add the previous set again without opening the picker.
3. [ ] **Screen Wake Lock** — Keep the phone awake while the user is actively logging a workout, and release it when the app is backgrounded or the workout ends.
4. [ ] **Recent Exercises** — Show the last four to six exercises at the top of the exercise picker.
5. [ ] **Save Status** — Show a small `Saved`, `Saving...`, or `Saved offline` status so users know their action was recorded.
6. [ ] **Workout Notes** — Add a short note to a day or exercise for form, pain, or effort observations.
7. [ ] **Weight Units** — Support lb and kg with one canonical stored value and converted display values.
8. [ ] **Backup Reminder** — Remind users to export a JSON backup periodically without requiring cloud sync.
9. [ ] **Clear Empty-day Start** — Show a prominent start-workout action, recent exercises, and presets when a selected day has no logs.
10. [ ] **Delete Recovery** — Keep the existing undo action highly visible and long enough to recover accidental mobile taps.

Avoid prioritizing cloud sync, social features, leaderboards, voice input, or progress photos until the core logging workflow is faster and more reliable. They add maintenance and privacy complexity without improving the main gym workflow as much as the items above.

### Core Features

- [ ] **Timezone Selection** — Allow users to select their preferred timezone instead of using device timezone
- [ ] **Rest Timer** — Add a timer between sets to track recovery time
- [ ] **Exercise Notes** — Add notes/comments to individual sets (e.g., "felt easy", "form was off")
- [ ] **Weight Unit Selection** — Support lbs, kg, and other weight units with automatic conversion
- [ ] **Rep Range Goals** — Set target rep ranges and notify when achieved

### Analytics & History

- [ ] **Progress Charts** — Visualize weight/rep progression over time for each exercise
- [ ] **Workout Stats** — Show total volume, avg reps, max weight per exercise
- [ ] **Workout History Timeline** — Browse past workouts by date with filtering
- [ ] **Personal Records** — Track and highlight personal bests

### User Experience

- [ ] **Undo/Redo** — Full undo/redo stack (currently limited to 20 actions)
- [ ] **Dark Mode** — Support system dark mode preference
- [ ] **Custom Themes** — Allow users to customize accent colors
- [ ] **Keyboard Shortcuts** — Add CMD/CTRL shortcuts for power users
- [ ] **Voice Input** — Log exercises via voice commands

### Data & Sync

- [ ] **Cloud Sync** — Optional sync across devices (Firebase/Supabase)
- [ ] **Backup Scheduling** — Auto-backup to cloud storage
- [ ] **Import from Other Apps** — Support importing from Strong, JEFIT, etc.
- [ ] **CSV Export** — Export workouts as CSV for spreadsheet analysis

### Social & Sharing

- [ ] **Workout Sharing** — Share completed workouts with friends
- [ ] **Progress Photos** — Attach photos to workout logs
- [ ] **Leaderboards** — Optional friendly competition with other users

### Technical Improvements

- [ ] **PWA Installation** — Improve install experience on all platforms
- [ ] **Offline Sync Queue** — Queue actions when offline, sync when online
- [ ] **Performance** — Optimize rendering for 100+ exercises
- [ ] **Accessibility** — Improve WCAG compliance
- [ ] **Unit Tests** — Add comprehensive test suite

## Deploying to GitHub Pages

1. Create a new GitHub repo named `workout-log` (public).
2. Add all the files in this folder to the repo root:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `icons/` (icon-192.png, icon-512.png, icon-maskable-512.png, favicon-32.png)
   - `README.md`, `LICENSE`, `.gitignore`
3. Commit and push to the `main` branch.
4. In the repo settings, go to **Settings → Pages**.
5. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
6. Save. GitHub will give you a URL like `https://<your-username>.github.io/workout-log/`.
7. Open that URL on your phone's browser, then use **"Add to Home Screen"** (iOS Safari) or the **Install** prompt (Android Chrome).

## Data & privacy

All data is stored locally in your browser (`localStorage`), scoped to this app's origin. Nothing is sent to a server — each device/browser has its own independent copy. Use the **Export JSON** button to back up your data or move it to another device, and **Import JSON** to restore it.

## Versioning

WorkoutLog uses **semantic versioning** (MAJOR.MINOR.PATCH):

- **MAJOR** — Breaking changes (e.g., data structure changes, removed features)
- **MINOR** — New features (e.g., new analytics, new filters, UI improvements)
- **PATCH** — Bug fixes (e.g., keyboard fixes, performance tweaks)

### How to bump version:

1. Run `npm run version:patch`, `npm run version:minor`, or `npm run version:major`.
2. Commit the version changes with a release message.
3. Create a git tag: `git tag v1.2.3 && git push origin v1.2.3`

The canonical version is stored in `package.json`; the bump script synchronizes the app and README display versions. This repository includes a tracked `.githooks/pre-commit` hook. Enable it once per clone with:

```bash
git config core.hooksPath .githooks
```

Before each commit, the hook creates the next patch version and stages the synchronized version files into that same commit. To skip the automatic bump for one commit, use `WORKOUTLOG_SKIP_VERSION_BUMP=1 git commit`.

The version displays in the app under **Profile → About → Version**.

### Current version: 1.0.14

## Local development

No build step required — it's plain HTML/CSS/JS. Just open `index.html` in a browser, or serve the folder with any static file server for full PWA behavior (service workers require `http(s)://`, not `file://`):

```bash
npx serve .
```

## License

MIT — see [LICENSE](LICENSE).
