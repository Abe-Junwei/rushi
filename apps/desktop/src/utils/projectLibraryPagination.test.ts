import { describe, expect, it } from "vitest";
import {
  LEDGER_LIST_ROW_BUDGET_PX,
  LEDGER_LIST_ROW_CONTENT_PX,
  LEDGER_PAGE_SIZE_FALLBACK,
  LEDGER_PAGE_SIZE_MAX,
  LEDGER_PAGE_SIZE_MIN,
  clampProjectLibraryPage,
  projectLibraryFilePageSizeForHeight,
  projectLibraryPageCount,
  projectLibraryPageForId,
  projectLibraryPageSizeForHeight,
  sliceProjectLibraryPage,
  welcomeRecentPageSizeForHeight,
} from "./projectLibraryPagination";

describe("projectLibraryPagination", () => {
  it("derives row budget from title/meta/pad (typography-driven)", () => {
    // 20 + 2 + 16 + 16 = 54；预算 +2
    expect(LEDGER_LIST_ROW_CONTENT_PX).toBe(54);
    expect(LEDGER_LIST_ROW_BUDGET_PX).toBe(56);
  });

  it("counts pages from total", () => {
    expect(projectLibraryPageCount(0)).toBe(1);
    expect(projectLibraryPageCount(8)).toBe(1);
    expect(projectLibraryPageCount(9)).toBe(2);
    expect(projectLibraryPageCount(25, 10)).toBe(3);
  });

  it("clamps page index", () => {
    expect(clampProjectLibraryPage(-1, 25, 10)).toBe(0);
    expect(clampProjectLibraryPage(99, 25, 10)).toBe(2);
    expect(clampProjectLibraryPage(1.7, 25, 10)).toBe(1);
  });

  it("slices items for the page", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    expect(sliceProjectLibraryPage(ids, 0, 8)).toEqual(ids.slice(0, 8));
    expect(sliceProjectLibraryPage(ids, 1, 8)).toEqual(["p8", "p9", "p10", "p11"]);
  });

  it("resolves page for project id", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
    expect(projectLibraryPageForId(ids, "p0", 8)).toBe(0);
    expect(projectLibraryPageForId(ids, "p10", 8)).toBe(1);
    expect(projectLibraryPageForId(ids, "missing")).toBe(0);
    expect(projectLibraryPageForId(ids, null)).toBe(0);
  });

  it("uses fallback page size when height unknown; clamps to 6–12 when known", () => {
    expect(projectLibraryPageSizeForHeight(0)).toBe(LEDGER_PAGE_SIZE_FALLBACK);
    expect(projectLibraryPageSizeForHeight(200)).toBe(LEDGER_PAGE_SIZE_MIN);
    // 12 * 56 + pager ≈ 足够触达上限
    expect(projectLibraryPageSizeForHeight(2000)).toBe(LEDGER_PAGE_SIZE_MAX);
  });

  it("derives file page size with chrome reserved", () => {
    expect(projectLibraryFilePageSizeForHeight(0)).toBe(LEDGER_PAGE_SIZE_FALLBACK);
    expect(projectLibraryFilePageSizeForHeight(400)).toBeGreaterThanOrEqual(1);
    expect(projectLibraryFilePageSizeForHeight(400)).toBeLessThanOrEqual(LEDGER_PAGE_SIZE_MAX);
  });

  it("aligns recent page size with project list density", () => {
    expect(welcomeRecentPageSizeForHeight(0)).toBe(LEDGER_PAGE_SIZE_FALLBACK);
    expect(welcomeRecentPageSizeForHeight(800)).toBe(projectLibraryPageSizeForHeight(800));
  });
});
