import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import {
  parseSelectionProfileLine,
  SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS,
} from "../../src/services/ui/selectionLatencyProfile";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tauriMockInit = readFileSync(join(__dirname, "support/tauri-mock-init.js"), "utf8");

const SEGMENT_COUNT = 197;

function buildManySegmentMockInit(segmentCount: number): string {
  return `${tauriMockInit}
(() => {
  const segments = Array.from({ length: ${segmentCount} }, (_, idx) => ({
    idx,
    uid: \`seg-e2e-\${idx}\`,
    start_sec: idx * 2,
    end_sec: idx * 2 + 1.5,
    text: \`语段 \${idx + 1}\`,
    confidence: null,
    low_confidence: false,
    detail: null,
    kind: "speech",
  }));
  window.__RUSHI_E2E_SET_SEGMENTS__?.(segments);
})();
`;
}

declare global {
  interface Window {
    __rushiSelectionProfile?: {
      enable: () => { enabled: boolean; message: string };
      recent: () => string[];
      print: () => { lines: string[]; message?: string };
    };
  }
}

async function openEditorWorkspace(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "欢迎回来" })).toBeVisible({ timeout: 20_000 });

  await page.locator('[data-purpose="welcome-actions"]').click();
  await expect(page.getByRole("heading", { name: "新建项目" })).toBeVisible();

  const createButton = page
    .locator('[data-panel-id="create-project-modal-v2"]')
    .getByRole("button", { name: "创建空项目" });
  await createButton.dispatchEvent("click");

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
  await expect(page.locator('[data-seg-row="0"]')).toBeVisible({ timeout: 20_000 });
}

async function clickSegmentRow(
  page: import("@playwright/test").Page,
  segIdx: number,
): Promise<void> {
  const row = page.locator(`[data-seg-row="${segIdx}"]`);
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.dispatchEvent("click");
}

test.describe("selection latency profile (mocked Tauri, 197 segments)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(buildManySegmentMockInit(SEGMENT_COUNT));
  });

  test("records profile lines for list click and keyboard advance", async ({ page }) => {
    test.setTimeout(120_000);
    const profileLines: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("[selection-profile] #") && text.includes("total=")) {
        profileLines.push(text);
      }
    });

    await openEditorWorkspace(page);

    const enableResult = await page.evaluate(() => window.__rushiSelectionProfile?.enable());
    expect(enableResult?.enabled).toBe(true);

    await clickSegmentRow(page, 2);
    await clickSegmentRow(page, 5);

    const textarea = page.locator('[data-seg-row="5"] textarea.seg-text');
    await textarea.focus();
    await textarea.press("ArrowDown");
    await page.waitForTimeout(200);

    await page.waitForFunction(
      () =>
        (window.__rushiSelectionProfile?.recent() ?? []).filter(
          (line) => line.includes("[selection-profile] #") && line.includes("total="),
        ).length >= 2,
      undefined,
      { timeout: 10_000 },
    );

    const lines = await page.evaluate(() => window.__rushiSelectionProfile?.recent() ?? []);
    const selectionLines = lines.filter(
      (line) => line.includes("[selection-profile] #") && line.includes("total="),
    );
    expect(selectionLines.length).toBeGreaterThanOrEqual(2);

    for (const line of selectionLines) {
      const parsed = parseSelectionProfileLine(line);
      expect(parsed).not.toBeNull();
      expect(parsed!.syncPathTotalMs).toBeLessThanOrEqual(SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS);
      expect(parsed!.totalMs).toBeLessThan(5000);
    }

    console.info("[selection-profile e2e] captured lines:");
    for (const line of selectionLines) console.info(line);
    expect(profileLines.length).toBeGreaterThanOrEqual(2);
  });
});
