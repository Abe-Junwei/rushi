import { defineConfig } from "@playwright/test";

/**
 * E2E projects:
 * - asr-api: loopback rushi-asr contract (CI starts stub sidecar)
 * - desktop-ui: Vite shell smoke with injected Tauri mock
 *
 * Run from repo root: `npm run desktop:test:e2e`
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  projects: [
    {
      name: "asr-api",
      testMatch: "**/asr-health.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:8741",
      },
      webServer: {
        command: "bash -lc 'cd services/asr && source .venv/bin/activate && python -m rushi_asr'",
        url: "http://127.0.0.1:8741/health",
        reuseExistingServer: true,
        timeout: 120_000,
      },
    },
    {
      name: "desktop-ui",
      testMatch: "**/desktop-lifecycle-smoke.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:1421",
      },
      webServer: {
        command: "npm run dev",
        url: "http://127.0.0.1:1421",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
    },
  ],
});
