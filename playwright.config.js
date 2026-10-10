const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;

// Set PW_RECORD=always to capture screenshots/video/trace for EVERY test run
// (slower and heavier — useful when you want to watch passing tests too).
// Default: only keep artifacts for tests that fail.
const recordAlways = process.env.PW_RECORD === "always";

// Set PW_SLOW_MO=<ms> to delay each Playwright action (for demos/live viewing).
// Only visible in headed mode (--headed). 0 = off (default).
const slowMo = Number(process.env.PW_SLOW_MO || 0);

module.exports = defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Slowed-down runs take far longer, so give them more headroom.
  timeout: slowMo ? 300_000 : 30_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: { slowMo },
    screenshot: recordAlways ? "on" : "only-on-failure",
    video: recordAlways ? "on" : "retain-on-failure",
    trace: recordAlways ? "on" : "retain-on-failure",
  },
  // The wheel bug was a real-layout mismatch (44px assumed vs 38px rendered on
  // narrow screens), so every test runs at a mobile AND a desktop viewport.
  projects: [
    { name: "mobile", use: { ...devices["Pixel 5"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    stdout: "ignore",
    stderr: "ignore",
  },
});
