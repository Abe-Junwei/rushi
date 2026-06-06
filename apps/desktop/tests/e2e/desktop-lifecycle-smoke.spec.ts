import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tauriMockInit = readFileSync(join(__dirname, "support/tauri-mock-init.js"), "utf8");

test.describe("desktop shell smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMockInit);
  });

  test("welcome shell renders in browser with Tauri mock", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /新建项目/ })).toBeVisible();
  });
});
