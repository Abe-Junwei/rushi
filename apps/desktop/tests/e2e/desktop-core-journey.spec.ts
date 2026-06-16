import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tauriMockInit = readFileSync(join(__dirname, "support/tauri-mock-init.js"), "utf8");

declare global {
  interface Window {
    __RUSHI_E2E_INVOKES__?: Array<{ cmd: string; args?: { segments?: Array<{ text?: string }>; content?: string } }>;
  }
}

test.describe("desktop core journey smoke (mocked Tauri)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMockInit);
  });

  test("creates empty project and reaches editor workspace", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator('[data-purpose="welcome-actions"]').click();
    await expect(page.getByRole("heading", { name: "新建项目" })).toBeVisible();

    const createButton = page
      .locator('form:has(button:text("创建空项目"))')
      .getByRole("button", { name: "创建空项目" });
    await expect(createButton).toBeVisible();
    await createButton.dispatchEvent("click");
    await expect(page.getByRole("heading", { name: "项目信息" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: "新建项目" })).toHaveCount(0);
    const dismissMetadata = page
      .locator('[data-panel-id="project-metadata-dialog-v1"]')
      .getByRole("button", { name: "稍后填写" });
    await expect(dismissMetadata).toBeVisible();
    await dismissMetadata.dispatchEvent("click");
    await expect(page.getByRole("heading", { name: "项目信息" })).toHaveCount(0, {
      timeout: 10_000,
    });

    await expect(page.locator('[data-purpose="project-files-hub-page"]')).toBeVisible({
      timeout: 20_000,
    });
    const fileOpenButton = page.locator(
      '[data-purpose="project-files-hub-page"] button[title="未命名项目"]',
    );
    await expect(fileOpenButton).toBeVisible();
    await fileOpenButton.dispatchEvent("click");

    await expect(page.locator('[data-purpose="editor-workspace"]')).toBeVisible({
      timeout: 20_000,
    });

    const textarea = page.locator('textarea[aria-label="语段正文"]').first();
    await expect(textarea).toBeVisible();
    await textarea.evaluate((node, value) => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(node, value);
      node.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
    }, "编辑后的核心旅程语段");

    await page.getByRole("button", { name: "保存" }).dispatchEvent("click");
    await page.waitForFunction(() =>
      window.__RUSHI_E2E_INVOKES__?.some(
        (entry) =>
          entry.cmd === "file_save_segments" &&
          entry.args?.segments?.[0]?.text === "编辑后的核心旅程语段",
      ),
    );

    await page.locator("details").filter({ hasText: "导出" }).locator("summary").dispatchEvent("click");
    await page.getByRole("button", { name: "导出 TXT" }).dispatchEvent("click");
    await page.waitForFunction(() =>
      window.__RUSHI_E2E_INVOKES__?.some(
        (entry) =>
          entry.cmd === "export_text_file" &&
          typeof entry.args?.content === "string" &&
          entry.args.content.includes("编辑后的核心旅程语段"),
      ),
    );
  });
});
