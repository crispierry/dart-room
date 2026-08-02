import { defineConfig, devices } from "@playwright/test";

const testServerPort = process.env.PLAYWRIGHT_PORT ?? "4174";
const testServerUrl = `http://localhost:${testServerPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: testServerUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 5"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${testServerPort}`,
    url: testServerUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
