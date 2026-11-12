import { defineConfig, devices } from "@playwright/test";

const PORT = 4002; // separate from preview (4001) so both can run at once

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI, // a leftover test.only fails CI instead of silently skipping tests
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure", // open with `pnpm exec playwright show-trace` when a test fails
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Test what customers get: the minified, hashed, integrity-checked production build.
    command: "node scripts/build.mjs && cp public/*.html dist/ && node scripts/serve.mjs",
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
