/**
 * P0 spike: real Chromium scroll FPS + gutter lockstep for CM6 transcript editor.
 * Requires Vite on :1421 (PW_DESKTOP_WEBSERVER=1).
 */
import { test, expect } from "@playwright/test";

test.describe("P0 spike CM6 scroll + gutter", () => {
  test("2000 segments: FPS >= 50 and gutter lockstep <= 2px", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/spike-transcript-editor.html", { waitUntil: "networkidle" });
    await page.waitForFunction(() => typeof window.__spikeBench === "function");

    const result = await page.evaluate(async () => {
      return window.__spikeBench!();
    });

    // eslint-disable-next-line no-console
    console.log("[spike-scroll-bench]", JSON.stringify(result));

    expect(result.segmentCount).toBe(2000);
    expect(result.fps).toBeGreaterThanOrEqual(50);
    expect(result.gutterPass).toBe(true);
    expect(result.gutterMaxAbsDeltaPx).toBeLessThanOrEqual(2);
    expect(result.selectionP95Ms).toBeLessThan(50);
  });
});
