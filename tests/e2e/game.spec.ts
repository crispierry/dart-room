import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function prepareGame(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
}

async function completeVisit(page: Page) {
  const throwButton = page.getByRole("button", { name: "Throw", exact: true });

  for (const expectedDarts of ["1 of 3 darts thrown", "2 of 3 darts thrown", "3 of 3 darts thrown"]) {
    await throwButton.click({ force: true });
    await expect(page.getByLabel(expectedDarts)).toBeVisible({ timeout: 7_500 });
  }
}

async function viewportLockState(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector("aside");
    const canvas = document.querySelector("canvas");
    if (!panel || !canvas) throw new Error("Game layout did not render.");
    const htmlStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const panelStyle = getComputedStyle(panel);
    const canvasStyle = getComputedStyle(canvas);
    return {
      windowScrollY: window.scrollY,
      documentClientHeight: document.documentElement.clientHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
      htmlOverflow: htmlStyle.overflow,
      bodyOverflow: bodyStyle.overflow,
      bodyPosition: bodyStyle.position,
      bodyOverscroll: bodyStyle.overscrollBehavior,
      panelOverflowY: panelStyle.overflowY,
      panelTouchAction: panelStyle.touchAction,
      panelClientHeight: panel.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      canvasTouchAction: canvasStyle.touchAction,
    };
  });
}

function expectLockedViewport(viewport: Awaited<ReturnType<typeof viewportLockState>>) {
  expect(viewport.windowScrollY).toBe(0);
  expect(viewport.documentScrollHeight).toBeLessThanOrEqual(viewport.documentClientHeight);
  expect(viewport.htmlOverflow).toBe("hidden");
  expect(viewport.bodyOverflow).toBe("hidden");
  expect(viewport.bodyPosition).toBe("fixed");
  expect(viewport.bodyOverscroll).toBe("none");
  expect(viewport.panelOverflowY).toBe("auto");
  expect(viewport.panelTouchAction).toBe("pan-y");
  expect(viewport.panelScrollHeight).toBeGreaterThan(viewport.panelClientHeight);
  expect(viewport.canvasTouchAction).toBe("none");
}

test("the 3D darts game completes a real three-dart visit", async ({ page }) => {
  test.setTimeout(90_000);
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

test("menu controls preserve focus visibility and the board always owns touch gestures", async ({ page }) => {
  await prepareGame(page);
  const playerName = page.getByLabel("Your name");
  await playerName.focus();
  await expect(playerName).toBeFocused();
  expect(await playerName.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe("none");

  const canvas = page.locator("canvas");
  expect(await canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
  await page.getByRole("button", { name: "Solo" }).click();
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  expect(await canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
});

test("mobile layouts keep the document fixed and scroll controls internally", async ({ page }, testInfo) => {
  test.skip(
    !["mobile-chromium", "mobile-webkit"].includes(testInfo.project.name),
    "The viewport-lock contract runs in the touch profiles.",
  );
  await prepareGame(page);

  expectLockedViewport(await viewportLockState(page));

  const touchMovePrevented = await page.locator("canvas").evaluate((canvas) => {
    const event = new Event("touchmove", { bubbles: true, cancelable: true });
    canvas.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(touchMovePrevented).toBe(true);

  await page.locator("aside").evaluate((panel) => {
    panel.scrollTop = Math.min(160, panel.scrollHeight - panel.clientHeight);
  });
  expect(await page.locator("aside").evaluate((panel) => panel.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  if (testInfo.project.name === "mobile-webkit") {
    await page.setViewportSize({ width: 820, height: 1180 });
    await page.reload();
    await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
    expectLockedViewport(await viewportLockState(page));
  }
});

test("the completion dialog contains focus and restores it on close", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The full eight-round completion flow runs once.");
  test.setTimeout(120_000);
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
