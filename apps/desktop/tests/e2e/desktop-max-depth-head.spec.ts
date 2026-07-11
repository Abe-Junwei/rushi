import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tauriMockInit = readFileSync(join(__dirname, "support/tauri-mock-init.js"), "utf8");

async function openEditorWorkspace(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible({ timeout: 20_000 });
  await page.locator('[data-purpose="welcome-actions"]').click();
  await expect(page.getByRole("heading", { name: "新建项目" })).toBeVisible();
  await page
    .locator('[data-panel-id="create-project-modal-v2"]')
    .getByRole("button", { name: "创建空项目" })
    .dispatchEvent("click");
  await expect(page.getByRole("heading", { name: "项目信息" })).toBeVisible({ timeout: 20_000 });
  await page
    .locator('[data-panel-id="project-metadata-dialog-v1"]')
    .getByRole("button", { name: "稍后填写" })
    .dispatchEvent("click");
  await expect(page.locator('[data-purpose="project-files-hub-page"]')).toBeVisible({ timeout: 20_000 });
  await page
    .locator('[data-purpose="project-files-hub-page"] button[title="未命名项目"]')
    .dispatchEvent("click");
  await expect(page.locator('[data-purpose="editor-workspace"]')).toBeVisible({ timeout: 20_000 });
}

test.describe("editor maximum update depth guard", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMockInit);
  });

  test("does not loop on welcome", async ({ page }) => {
    const maxDepth: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Maximum update depth exceeded")) maxDepth.push(msg.text());
    });
    await page.addInitScript(tauriMockInit);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    expect(maxDepth).toEqual([]);
  });

  test("does not loop after create project", async ({ page }) => {
    const maxDepth: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Maximum update depth exceeded")) maxDepth.push(msg.text());
    });
    await page.addInitScript(tauriMockInit);
    await page.goto("/");
    await page.locator('[data-purpose="welcome-actions"]').click();
    await page.locator('[data-panel-id="create-project-modal-v2"]').getByRole("button", { name: "创建空项目" }).dispatchEvent("click");
    await expect(page.getByRole("heading", { name: "项目信息" })).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    expect(maxDepth).toEqual([]);
  });

  test("does not loop on files hub", async ({ page }) => {
    const maxDepth: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Maximum update depth exceeded")) maxDepth.push(msg.text());
    });
    await page.addInitScript(tauriMockInit);
    await page.goto("/");
    await page.locator('[data-purpose="welcome-actions"]').click();
    await page.locator('[data-panel-id="create-project-modal-v2"]').getByRole("button", { name: "创建空项目" }).dispatchEvent("click");
    await page.locator('[data-panel-id="project-metadata-dialog-v1"]').getByRole("button", { name: "稍后填写" }).dispatchEvent("click");
    await expect(page.locator('[data-purpose="project-files-hub-page"]')).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(300);
    expect(maxDepth).toEqual([]);
  });

  test("does not loop on editor open", async ({ page }) => {
    const maxDepth: string[] = [];
    page.on("console", (msg) => {
      if (msg.text().includes("Maximum update depth exceeded")) maxDepth.push(msg.text());
    });
    await openEditorWorkspace(page);
    await expect(page.locator('.cm-content[aria-label="语段正文"]').first()).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(300);
    expect(maxDepth).toEqual([]);
  });
});
