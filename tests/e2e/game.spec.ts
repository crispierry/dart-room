import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function prepareGame(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
}

async function completeVisit(page: Page) {
  const throwButton = page.getByRole("button", { name: "Throw", exact: true });

  for (const expectedDarts of ["1 of 3 darts thrown", "2 of 3 darts thrown", "3 of 3 darts thrown"]) {
    await throwButton.click({ force: true });
    await expect(page.getByLabel(expectedDarts)).toBeVisible({ timeout: 7_500 });
  }
}

test("the 3D darts game completes a real three-dart visit", async ({ page }) => {
  await prepareGame(page);

  await expect(page.getByRole("heading", { name: "Step up to the oche." })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /three-dimensional regulation dartboard/i }),
  ).toBeVisible();

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  expect(
    await canvas.evaluate((element) => {
      const drawingSurface = element as HTMLCanvasElement;
      return Boolean(drawingSurface.getContext("webgl2") || drawingSurface.getContext("webgl"));
    }),
  ).toBe(true);

  await page.getByRole("button", { name: "Solo" }).click();
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  await expect(page.getByRole("heading", { name: "Match live" })).toBeVisible();

  const visit = page.locator("aside").getByText("This visit").locator("..");
  await completeVisit(page);

  await expect(page.getByText("Round 2 / 8")).toBeVisible({ timeout: 5_000 });
  await expect(visit).toContainText("0");
  await expect(page.getByText("180", { exact: true })).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(
    accessibility.violations.filter((violation) =>
      ["serious", "critical"].includes(violation.impact ?? ""),
    ),
  ).toEqual([]);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("menu controls preserve focus visibility and disabled-board scrolling", async ({ page }) => {
  await prepareGame(page);
  const playerName = page.getByLabel("Your name");
  await playerName.focus();
  await expect(playerName).toBeFocused();
  expect(await playerName.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");

  const canvas = page.locator("canvas");
  expect(await canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe("pan-y");
  await page.getByRole("button", { name: "Solo" }).click();
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  expect(await canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
});

test("the completion dialog contains focus and restores it on close", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The full eight-round completion flow runs once.");
  test.setTimeout(45_000);
  await prepareGame(page);
  await page.getByRole("button", { name: "Solo" }).click();
  await page.getByRole("button", { name: /Start Count Up/i }).click();

  for (let round = 1; round <= 8; round += 1) {
    await completeVisit(page);
    if (round < 8) {
      await expect(page.getByText(`Round ${round + 1} / 8`, { exact: true })).toBeVisible({ timeout: 5_000 });
    }
  }

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  await expect(page.locator("[inert]")).toHaveCount(1);
  const playAgain = dialog.getByRole("button", { name: /Play again/i });
  const challenge = dialog.getByRole("button", { name: "Challenge a friend" });
  await expect(playAgain).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(challenge).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Step up to the oche." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start Count Up/i })).toBeFocused();
});

test("the game exposes all modes and local multiplayer", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Long turn-flow checks run once in Chromium.");
  await prepareGame(page);
  await expect(page.getByRole("button", { name: /^Count Up Eight/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^301 Race/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cricket Close/i })).toBeVisible();
  await page.getByRole("button", { name: "Two players" }).click();
  await expect(page.getByLabel("Friend's name")).toBeVisible();
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  await completeVisit(page);
  await expect(page.getByText("Player 2 at the oche")).toBeVisible({ timeout: 5_000 });
});

test("the CPU completes its own visit", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Long turn-flow checks run once in Chromium.");
  await prepareGame(page);
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  await completeVisit(page);

  await expect(page.getByText("Round 2 / 8")).toBeVisible({ timeout: 12_000 });
  const cpuScore = page.getByRole("article").filter({ hasText: "Casey" }).locator("strong");
  await expect(cpuScore).not.toHaveText("0");
});
