import { defineConfig } from "@playwright/test";

/**
 * API-only checks against loopback rushi-asr (no browser download when possible).
 * Run from repo root after ASR is up: `npm run desktop:test:e2e`
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:8741",
  },
  webServer: {
    command: "bash -lc 'cd services/asr && source .venv/bin/activate && python -m rushi_asr'",
    url: "http://127.0.0.1:8741/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
