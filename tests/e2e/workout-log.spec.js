const { test, expect } = require("@playwright/test");

// ---- Test setup -----------------------------------------------------------
// Default picker limits (see PICKER_LIMITS in index.html)
const WEIGHT_MIN = 5;
const WEIGHT_STEP = 5;
const REPS_MIN = 1;
const REPS_STEP = 1;

// Simulate a returning user so the first-run onboarding tour does not cover
// the UI. Exercises/tags still load from defaults.json on first boot.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("workoutlog:onboardingCompleted", "true");
  });
});

async function openApp(page) {
  await page.goto("/index.html");
  await expect(
    page.getByRole("button", { name: /log workout/i }),
  ).toBeVisible();
}

// Mimic a user spinning the wheel to a value by setting the scroll offset that
// scroll-snap would land on, then firing the scroll handler the wheel listens to.
async function scrollWheelTo(wheel, value, min, step) {
  await wheel.evaluate(
    (el, { value, min, step }) => {
      const option = el.querySelector(".wheel-option");
      const height = option ? option.getBoundingClientRect().height : 44;
      const index = Math.round((value - min) / step);
      el.scrollTop = index * height;
      el.dispatchEvent(new Event("scroll"));
    },
    { value, min, step },
  );
}

async function logSet(page, { exercise = "Bench Press", weight, reps }) {
  await page.getByRole("button", { name: /log workout/i }).click();
  await page.locator(".list-item", { hasText: exercise }).first().click();

  const weightWheel = page.locator("#setPickerWeight");
  const repsWheel = page.locator("#setPickerReps");
  await expect(weightWheel).toBeVisible();
  await expect(repsWheel).toBeVisible();

  // Wait for the picker's own initial scroll positioning to settle first.
  await page.waitForTimeout(250);

  await scrollWheelTo(weightWheel, weight, WEIGHT_MIN, WEIGHT_STEP);
  await scrollWheelTo(repsWheel, reps, REPS_MIN, REPS_STEP);

  await page.getByRole("button", { name: "Save set" }).click();
}

// ---- Tests ----------------------------------------------------------------

test("home screen shows the core controls", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("heading", { name: "WorkoutLog" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /log workout/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile" })).toBeVisible();
});

test("logging a set through the wheel saves the chosen weight and reps", async ({
  page,
}) => {
  await openApp(page);
  await logSet(page, { weight: 90, reps: 8 });
  await expect(page.locator(".set-pill").first()).toHaveText("90 lb × 8");
});

test("a logged set survives a page reload", async ({ page }) => {
  await openApp(page);
  await logSet(page, { weight: 100, reps: 10 });
  await expect(page.locator(".set-pill").first()).toHaveText("100 lb × 10");

  await page.reload();
  await expect(page.locator(".set-pill").first()).toHaveText("100 lb × 10");
});

test("moving to another day shows that day\u2019s log", async ({ page }) => {
  await openApp(page);
  await logSet(page, { weight: 90, reps: 8 });
  await expect(page.locator(".set-pill").first()).toHaveText("90 lb × 8");

  await page.getByRole("button", { name: "Previous day" }).click();
  await expect(page.locator("#log-list")).toContainText(
    "No workouts logged for this day.",
  );

  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.locator(".set-pill").first()).toHaveText("90 lb × 8");
});

test("profile panel opens with its options", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Profile" }).click();
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Presets" })).toBeVisible();
  await expect(page.getByText("Source")).toBeVisible();
});

// ---- Import ---------------------------------------------------------------

const LOG_KEY_PREFIX = "workoutlog:log:";

async function storedLogKeys(page) {
  return page.evaluate((prefix) => {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .sort();
  }, LOG_KEY_PREFIX);
}

function backupFile({
  logs,
  exercises = [],
  tags = [],
  exportedAt = "2026-01-05T10:00:00.000Z",
}) {
  return {
    name: "workout-app-log.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        exportedAt,
        version: "2.0",
        exercises,
        tags,
        routines: [],
        logDates: Object.keys(logs),
        logs,
      }),
    ),
  };
}

async function openImport(page, payload) {
  await page.getByRole("button", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.setInputFiles("#importInput", backupFile(payload));
  await expect(
    page.getByRole("heading", { name: "Restore from backup?" }),
  ).toBeVisible();
}

test("cancelling an import leaves existing data untouched", async ({
  page,
}) => {
  await openApp(page);
  await logSet(page, { weight: 90, reps: 8 });
  const before = await storedLogKeys(page);
  expect(before).toHaveLength(1);

  await openImport(page, {
    logs: {
      "2026-04-01": [
        {
          id: "e-1",
          exerciseId: "other",
          sets: [{ id: "s-1", weight: 45, reps: 12 }],
        },
      ],
    },
  });
  await page.getByRole("button", { name: "Cancel" }).click();

  expect(await storedLogKeys(page)).toEqual(before);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator(".set-pill").first()).toHaveText("90 lb × 8");
});

test("an empty backup is rejected instead of wiping data", async ({ page }) => {
  await openApp(page);
  await logSet(page, { weight: 90, reps: 8 });

  await page.getByRole("button", { name: "Profile" }).click();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.setInputFiles("#importInput", backupFile({ logs: {} }));

  await expect(page.locator(".toast")).toContainText("nothing to restore");
  await expect(
    page.getByRole("heading", { name: "Restore from backup?" }),
  ).toHaveCount(0);
  expect(await storedLogKeys(page)).toHaveLength(1);
});

test("importing a backup merges only the days that are missing", async ({
  page,
}) => {
  await openApp(page);
  await logSet(page, { weight: 90, reps: 8 });
  const existingKey = (await storedLogKeys(page))[0];
  const existingDate = existingKey.replace(LOG_KEY_PREFIX, "");

  await openImport(page, {
    logs: {
      [existingDate]: [
        {
          id: "dup",
          exerciseId: "other",
          sets: [{ id: "s-9", weight: 10, reps: 3 }],
        },
      ],
      "2026-03-03": [
        {
          id: "e-1",
          exerciseId: "other",
          sets: [{ id: "s-1", weight: 135, reps: 5 }],
        },
      ],
    },
  });
  await page.getByRole("button", { name: "Merge into my data" }).click();

  await expect(page.locator(".toast")).toContainText(
    "skipped 1 you already had",
  );
  expect(await storedLogKeys(page)).toEqual(
    [existingKey, `${LOG_KEY_PREFIX}2026-03-03`].sort(),
  );
  await expect(page.locator(".set-pill").first()).toHaveText("90 lb × 8");
});

test("replacing with a smaller backup sweeps orphaned days", async ({
  page,
}) => {
  await openApp(page);
  await logSet(page, { weight: 90, reps: 8 });
  expect(await storedLogKeys(page)).toHaveLength(1);

  await openImport(page, {
    logs: {
      "2026-02-01": [
        {
          id: "e-1",
          exerciseId: "other",
          sets: [{ id: "s-1", weight: 135, reps: 5 }],
        },
      ],
    },
  });
  await page.getByRole("button", { name: "Replace everything" }).click();

  await expect(page.locator(".toast")).toContainText("Restored 1 day (1 set)");
  expect(await storedLogKeys(page)).toEqual([`${LOG_KEY_PREFIX}2026-02-01`]);
  await expect(page.locator("#log-list")).toContainText(
    "No workouts logged for this day.",
  );
});
