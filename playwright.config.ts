import { defineConfig } from "@playwright/test";

/*
 * End-to-end demo scenarios. Run against a production build:
 *   npm run build && FD_REGISTER_LIMIT=1000 FD_INSECURE_COOKIES=1 npm start     then     npm run test:e2e
 * PW_CHROMIUM can point at a Chromium binary if Playwright's own download is unavailable.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.FD_BASE_URL || "http://localhost:3000",
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
});
