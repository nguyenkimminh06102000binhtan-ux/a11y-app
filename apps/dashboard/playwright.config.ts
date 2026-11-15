import { defineConfig, devices } from "@playwright/test";
import { localStack } from "./tests/local-stack";

/*
 * Dashboard tests: the production build against the local Supabase test stack (supabase/config.toml).
 * "setup" signs in for real (magic link from the test mailbox) and seeds the test account; the rest reuse that
 * signed-in browser state.
 */
const PORT = 3990; // matches site_url in supabase/config.toml
const stack = localStack();

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /setup\.ts/ },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /setup\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: "tests/.state/owner.json" },
    },
  ],
  webServer: {
    command: `next build && next start --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_DIST_DIR: ".next-test",
      AUTH_GOOGLE_ENABLED: "true", // the button is tested up to the hand-off to Google (no real Google in tests)
      DATABASE_URL: stack.dbUrl,
      NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
    },
  },
});
