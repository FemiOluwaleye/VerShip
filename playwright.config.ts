import { defineConfig, devices } from "@playwright/test";

// Replit pre-provisions Chromium; point Playwright at it instead of downloading a browser.
const executablePath = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    launchOptions: executablePath ? { executablePath } : {},
  },
  // Later phases can add a `webServer` block here to boot the app for live validation, e.g.:
  //   webServer: { command: "pnpm --filter @workspace/hello-world run dev", url: "http://localhost:23537", reuseExistingServer: true, env: { PORT: "23537", BASE_PATH: "/" } }
});
