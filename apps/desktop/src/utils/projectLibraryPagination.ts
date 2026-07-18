/**
 * 欢迎页 ledger 分页 — 字号驱动行高 + 业内密列表页容量。
 *
 * 对照：
 * - Linear / VS Code：compact–comfortable，双行信息行约 48–56px
 * - 桌面表格惯例：每页约 10 行（常见 6–12）；用视口高度 ÷ 行高，而非拍脑袋固定 10
 *
 * 行高预算（与 DESIGN text-title 14/leading-5、text-label 11/leading-4、py-2 对齐）：
 *   20 + 2 + 16 + 16 = 54 → 预算 56（余量防末行裁切）
 */

/** 字号行高（px，未乘 ui-scale；分页用整数预算） */
export const LEDGER_ROW_TITLE_LINE_PX = 20;
export const LEDGER_ROW_META_LINE_PX = 16;
export const LEDGER_ROW_META_GAP_PX = 2;
/** 上下各 8px（py-2） */
export const LEDGER_ROW_PAD_Y_PX = 16;

/** 内容盒高度（无余量） */
export const LEDGER_LIST_ROW_CONTENT_PX =
  LEDGER_ROW_TITLE_LINE_PX +
  LEDGER_ROW_META_GAP_PX +
  LEDGER_ROW_META_LINE_PX +
  LEDGER_ROW_PAD_Y_PX;

/** 分页除数：内容 + 2px 防裁切 */
export const LEDGER_LIST_ROW_BUDGET_PX = LEDGER_LIST_ROW_CONTENT_PX + 2;

export const LEDGER_PAGER_PX = 40;
export const LEDGER_ACTION_BAR_PX = 36;
/** 视口测量失败时的回退每页条数（接近业内默认 10） */
export const LEDGER_PAGE_SIZE_FALLBACK = 8;
/** 短视口至少展示条数 */
export const LEDGER_PAGE_SIZE_MIN = 6;
/** 单页上限：扫描舒适区（避免一页塞满像电子表格） */
export const LEDGER_PAGE_SIZE_MAX = 12;

/** @deprecated 使用 LEDGER_PAGE_SIZE_MAX；保留别名以免外部引用断裂 */
export const PROJECT_LIBRARY_PAGE_SIZE = LEDGER_PAGE_SIZE_MAX;
/** @deprecated */
export const PROJECT_LIBRARY_PAGE_SIZE_MIN = LEDGER_PAGE_SIZE_MIN;

export const PROJECT_LIBRARY_PROJECT_ROW_PX = LEDGER_LIST_ROW_BUDGET_PX;
export const PROJECT_LIBRARY_FILE_ROW_PX = LEDGER_LIST_ROW_BUDGET_PX;
export const PROJECT_LIBRARY_ACTION_BAR_PX = LEDGER_ACTION_BAR_PX;
export const PROJECT_LIBRARY_PAGER_PX = LEDGER_PAGER_PX;
export const WELCOME_RECENT_FILE_ROW_PX = LEDGER_LIST_ROW_BUDGET_PX;
export const WELCOME_RECENT_PAGE_SIZE_MIN = LEDGER_PAGE_SIZE_MIN;
export const WELCOME_RECENT_PAGE_SIZE_MAX = LEDGER_PAGE_SIZE_MAX;

function clampPageSize(n: number): number {
  return Math.min(LEDGER_PAGE_SIZE_MAX, Math.max(LEDGER_PAGE_SIZE_MIN, n));
}

export function projectLibraryPageCount(
  total: number,
  pageSize: number = LEDGER_PAGE_SIZE_FALLBACK,
): number {
  if (total <= 0) return 1;
  const size = Math.max(1, pageSize);
  return Math.max(1, Math.ceil(total / size));
}

/** 0-based page index，钳到合法范围 */
export function clampProjectLibraryPage(
  page: number,
  total: number,
  pageSize: number = LEDGER_PAGE_SIZE_FALLBACK,
): number {
  const pages = projectLibraryPageCount(total, pageSize);
  if (!Number.isFinite(page)) return 0;
  return Math.min(Math.max(0, Math.floor(page)), pages - 1);
}

export function sliceProjectLibraryPage<T>(
  items: readonly T[],
  page: number,
  pageSize: number = LEDGER_PAGE_SIZE_FALLBACK,
): T[] {
  const size = Math.max(1, pageSize);
  const p = clampProjectLibraryPage(page, items.length, size);
  const start = p * size;
  return items.slice(start, start + size);
}

/** 项目在列表中的下标 → 所在页（0-based）；找不到返回 0 */
export function projectLibraryPageForId(
  projectIds: readonly string[],
  projectId: string | null | undefined,
  pageSize: number = LEDGER_PAGE_SIZE_FALLBACK,
): number {
  if (!projectId) return 0;
  const index = projectIds.indexOf(projectId);
  if (index < 0) return 0;
  return Math.floor(index / Math.max(1, pageSize));
}

/**
 * 折叠态每页项目数：floor((H - 翻页条 - 安全边) / 行预算)，夹在 [6, 12]。
 */
export function projectLibraryPageSizeForHeight(availablePx: number): number {
  if (!Number.isFinite(availablePx) || availablePx <= 0) {
    return LEDGER_PAGE_SIZE_FALLBACK;
  }
  const forList = Math.max(0, availablePx - LEDGER_PAGER_PX - 4);
  const n = Math.floor(forList / LEDGER_LIST_ROW_BUDGET_PX);
  if (n < 1) return LEDGER_PAGE_SIZE_MIN;
  return clampPageSize(n);
}

/**
 * 展开态文件每页条数：扣除项目头 + 动作条 + 翻页条。
 */
export function projectLibraryFilePageSizeForHeight(availablePx: number): number {
  if (!Number.isFinite(availablePx) || availablePx <= 0) {
    return LEDGER_PAGE_SIZE_FALLBACK;
  }
  const chrome = LEDGER_LIST_ROW_BUDGET_PX + LEDGER_ACTION_BAR_PX + LEDGER_PAGER_PX + 4;
  const forFiles = Math.max(0, availablePx - chrome);
  const n = Math.floor(forFiles / LEDGER_LIST_ROW_BUDGET_PX);
  return Math.max(1, Math.min(LEDGER_PAGE_SIZE_MAX, n || 1));
}

/** 最近文件每页条数（与项目行同密度） */
export function welcomeRecentPageSizeForHeight(availablePx: number): number {
  return projectLibraryPageSizeForHeight(availablePx);
}
