import { defineConfig } from "@playwright/test";

/**
 * E2E projects:
 * - asr-api: loopback rushi-asr contract (CI starts stub sidecar)
 * - desktop-ui: Vite shell smoke with injected Tauri mock
 *
 * Run from repo root: `npm run desktop:test:e2e`
 * Desktop UI smoke sets PW_DESKTOP_WEBSERVER=1 (top-level webServer; project-level is ignored by Playwright).
 */
const desktopWebServer = process.env.PW_DESKTOP_WEBSERVER
  ? {
      webServer: {
        command: "npm run dev",
        url: "http://127.0.0.1:1421",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
    }
  : {};

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  ...desktopWebServer,
  projects: [
    {
      name: "asr-api",
      testMatch: "**/asr-health.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:8741",
      },
    },
    {
      name: "desktop-ui",
      testMatch: "**/desktop-lifecycle-smoke.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:1421",
      },
    },
  ],
});
