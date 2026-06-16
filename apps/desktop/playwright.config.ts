import { defineConfig } from "@playwright/test";

/**
 * E2E projects:
 * - asr-api: loopback rushi-asr contract (script starts isolated mock sidecar)
 * - desktop-ui: Vite shell smoke with injected Tauri mock
 *
 * Run from repo root: `npm run desktop:test:e2e`
 * Desktop UI smoke sets PW_DESKTOP_WEBSERVER=1 (top-level webServer; project-level is ignored by Playwright).
 */
const webServers = [
  ...(process.env.PW_ASR_MOCK_WEBSERVER
    ? [
        {
          command: "node tests/e2e/support/asr-mock-server.mjs",
          url: `${process.env.PW_ASR_BASE_URL ?? "http://127.0.0.1:18741"}/health`,
          reuseExistingServer: false,
          timeout: 30_000,
        },
      ]
    : []),
  ...(process.env.PW_DESKTOP_WEBSERVER
    ? [
        {
          command: "npx vite --host 127.0.0.1 --port 1421 --strictPort",
          url: "http://127.0.0.1:1421",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ]
    : []),
];

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  ...(webServers.length ? { webServer: webServers } : {}),
  projects: [
    {
      name: "asr-api",
      testMatch: "**/asr-health.spec.ts",
      use: {
        baseURL: process.env.PW_ASR_BASE_URL ?? "http://127.0.0.1:8741",
      },
    },
    {
      name: "desktop-ui",
      testMatch: "**/desktop-*.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:1421",
      },
    },
  ],
});
