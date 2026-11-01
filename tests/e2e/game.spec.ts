import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function prepareGame(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible({ timeout: 15_000 });
}

async function completeVisit(page: Page) {
  const throwButton = page.locator("button:visible", { hasText: "Throw" });

  for (const expectedDarts of ["1 of 3 darts thrown", "2 of 3 darts thrown", "3 of 3 darts thrown"]) {
    await throwButton.click({ force: true });
    await expect(page.locator(`[aria-label="${expectedDarts}"]:visible`)).toBeVisible({ timeout: 7_500 });
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
  const isMobile = (page.viewportSize()?.width ?? 1000) <= 620;
  if (isMobile) {
    await expect(page.getByText("Player 1 to throw", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { name: "Match live" })).toBeVisible();
  }

  const visit = isMobile
    ? page.locator('[aria-label="Mobile scoreboard"]')
    : page.locator("aside").getByText("This visit").locator("..");
  await completeVisit(page);

  await expect(page.getByText(isMobile ? "R2/8" : "Round 2 / 8", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(visit).toContainText("0");
  await expect(page.locator("strong:visible", { hasText: /^180$/ })).toBeVisible();

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

test("mobile play is immersive, compact, and exits through confirmation", async ({ page }, testInfo) => {
  test.skip(
    !["mobile-chromium", "mobile-webkit"].includes(testInfo.project.name),
    "The immersive layout runs in the touch profiles.",
  );
  await prepareGame(page);

  const setupBoard = page.locator(`section[aria-label="Darts playing area"]`);
  const setupPanel = page.locator("aside");
  const start = page.getByRole("button", { name: /Start Count Up/i });
  await expect(setupBoard).toBeVisible();
  await expect(start).toBeVisible();
  expect(await setupBoard.getByRole("img").evaluate((element) => getComputedStyle(element).pointerEvents)).toBe("none");

  await page.getByRole("button", { name: "Solo" }).click();
  await start.click();
  await expect(page.getByText("Player 1 to throw", { exact: true })).toBeVisible();
  await expect(setupPanel).toBeHidden();

  const layout = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!.getBoundingClientRect();
    const score = document.querySelector('[aria-label="Mobile scoreboard"]')!.getBoundingClientRect();
    const aim = document.querySelector('#aim-preset-mobile')!.closest("div")!.getBoundingClientRect();
    return {
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: document.documentElement.clientHeight,
      canvasBottom: canvas.bottom,
      scoreTop: score.top,
      scoreBottom: score.bottom,
      aimTop: aim.top,
      aimBottom: aim.bottom,
    };
  });
  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.canvasBottom).toBeLessThanOrEqual(layout.scoreTop + 1);
  expect(layout.scoreBottom).toBeLessThanOrEqual(layout.aimTop + 1);
  expect(layout.aimBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);

  await page.getByRole("button", { name: "Exit", exact: true }).click();
  const exitDialog = page.getByRole("dialog", { name: "Exit game?" });
  await expect(exitDialog).toBeVisible();
  await expect(exitDialog.getByRole("button", { name: /Keep playing/i })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(exitDialog).toBeHidden();
  await expect(page.getByText("Player 1 to throw", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await exitDialog.getByRole("button", { name: "Exit to game selection" }).click();
  await expect(page.getByRole("heading", { name: "Step up to the oche." })).toBeVisible();
  await expect(start).toBeFocused();
});

test("exit confirmation pauses CPU play and cannot interrupt turn resolution", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The timer regression runs once in desktop Chromium.");
  await page.clock.install();
  await prepareGame(page);
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  // Freeze before the first turn so a loaded runner cannot spend the CPU's
  // 820 ms thinking time between observing its turn and opening the dialog.
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  const throwButton = page.locator("button:visible", { hasText: "Throw" });
  for (const expectedDarts of ["1 of 3 darts thrown", "2 of 3 darts thrown", "3 of 3 darts thrown"]) {
    await throwButton.click({ force: true });
    await page.clock.runFor(150);
    await expect(page.locator(`[aria-label="${expectedDarts}"]:visible`)).toBeVisible();
  }

  const exit = page.getByRole("button", { name: "Exit", exact: true });
  await expect(exit).toBeDisabled();
  await page.clock.runFor(1_000);
  await expect(page.getByText("Casey at the oche", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(exit).toBeEnabled();
  await exit.click();

  const dialog = page.getByRole("dialog", { name: "Exit game?" });
  const cpuCard = page.locator("article:visible").filter({ hasText: "Casey" });
  await expect(dialog).toBeVisible();
  await page.clock.runFor(1_500);
  await expect(cpuCard).toContainText("0 darts");

  await dialog.getByRole("button", { name: /Keep playing/i }).click();
  await page.clock.runFor(5_000);
  await expect(page.getByText("Round 2 / 8", { exact: true })).toBeVisible({ timeout: 12_000 });
  await expect(cpuCard).not.toContainText("0 darts");
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
  await expect(page.getByRole("button", { name: /^Count Up/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^301/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Cricket/i })).toBeVisible();
  await page.getByRole("button", { name: "Two players" }).click();
  await expect(page.getByLabel("Friend's name")).toBeVisible();
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  await completeVisit(page);
  const isMobile = (page.viewportSize()?.width ?? 1000) <= 620;
  await expect(page.getByText(isMobile ? "Player 2 to throw" : "Player 2 at the oche", { exact: true })).toBeVisible({ timeout: 5_000 });
});

test("the CPU completes its own visit", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Long turn-flow checks run once in Chromium.");
  await prepareGame(page);
  await page.getByRole("button", { name: /Start Count Up/i }).click();
  await completeVisit(page);

  const isMobile = (page.viewportSize()?.width ?? 1000) <= 620;
  await expect(page.getByText(isMobile ? "R2/8" : "Round 2 / 8", { exact: true })).toBeVisible({ timeout: 12_000 });
  const cpuScore = page.locator("article:visible").filter({ hasText: "Casey" }).locator("strong");
  await expect(cpuScore).not.toHaveText("0");
});
