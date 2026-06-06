/** 单行语段预览行高（与 FloatingPanelSegmentRow py-1.5 + text-sm 对齐）。 */
export const FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX = 32;

/** 语段列表最多展示高度；超出后列表内滚动。 */
export const FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX = 256;

export function resolveFloatingPanelSegmentListHeight(
  rowCount: number,
  maxListPx: number = FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
): number {
  if (rowCount <= 0) return 0;
  const natural = rowCount * FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX;
  return Math.min(natural, maxListPx);
}

/** 查找替换主面板：标题栏 + 表单 + 状态 + 底栏（不含语段列表）。 */
export const FIND_REPLACE_PANEL_STATIC_BODY_PX = 281;

/** 全部替换预览：说明文案 + 底栏（不含语段列表）。 */
export const FIND_REPLACE_PREVIEW_STATIC_BODY_PX = 132;

/** 规则纠错 preview：摘要 + 底栏（不含语段列表 / 词表卫生 / hints）。 */
export const CORRECTION_RULES_PREVIEW_STATIC_BODY_PX = 168;

/** 智能改稿预览：摘要 + 操作说明 + 底栏（不含语段列表）。 */
export const POST_TRANSCRIBE_STAGE_B_PREVIEW_STATIC_BODY_PX = 188;

/** 智能改稿预览：语段列表区上限（首次展开略紧凑）。 */
export const POST_TRANSCRIBE_STAGE_B_PREVIEW_LIST_MAX_HEIGHT_PX = 192;

/** 智能改稿预览：面板总高度上限（含标题栏）。 */
export const POST_TRANSCRIBE_STAGE_B_PREVIEW_MAX_PANEL_HEIGHT_PX = 420;

/** 智能改稿 consent：说明文案 + 按钮行（不含 A→B 黄条）。 */
export const POST_TRANSCRIBE_STAGE_B_CONSENT_STATIC_BODY_PX = 168;

/** 智能改稿 empty：说明文案 + 关闭按钮（不含提示条）。 */
export const POST_TRANSCRIBE_STAGE_B_EMPTY_STATIC_BODY_PX = 132;

/** consent / empty 顶部每条提示（A→B 软提示 / pack 截断）的额外高度。 */
export const POST_TRANSCRIBE_STAGE_B_HINT_EXTRA_PX = 56;

/** 紧凑态面板壳层 minHeight（empty / consent / loading）。 */
export const FLOATING_PANEL_COMPACT_MIN_HEIGHT = 200;

/** 折叠 `<details>` 摘要行（如只读提示 header）。 */
export const FLOATING_PANEL_DETAILS_SUMMARY_PX = 36;

/** 额外一行 muted 说明。 */
export const FLOATING_PANEL_MUTED_LINE_PX = 36;

/** spinner loading 区（含 padding）。 */
export const FLOATING_PANEL_SPINNER_BODY_PX = 88;

/** 规则纠错 empty：说明 + 关闭按钮（不含 hints / 词表卫生 / 额外说明）。 */
export const CORRECTION_RULES_EMPTY_STATIC_BODY_PX = 160;

/** A9 词表卫生 `<details>` 摘要行（折叠态）。 */
export const LEXICON_HEALTH_PANEL_SUMMARY_PX = 40;

/** A9 词表卫生每条摘要 bullet 行。 */
export const LEXICON_HEALTH_PANEL_LINE_PX = 26;

/** A9 词表卫生列表区 padding + border。 */
export const LEXICON_HEALTH_PANEL_BODY_CHROME_PX = 20;

/** 规则纠错 loading。 */
export const CORRECTION_RULES_LOADING_BODY_PX = 88;

export const FLOATING_PANEL_TITLE_BAR_PX = 57;

export function resolveFloatingPanelFitHeight(staticBodyPx: number, rowCount: number): number {
  const listHeight = resolveFloatingPanelSegmentListHeight(rowCount);
  return FLOATING_PANEL_TITLE_BAR_PX + staticBodyPx + listHeight;
}

/** 无列表的紧凑面板高度（empty / consent / loading）。 */
export function resolveFloatingPanelCompactFitHeight(staticBodyPx: number, extraPx = 0): number {
  return resolveFloatingPanelFitHeight(staticBodyPx, 0) + extraPx;
}

export function resolveLexiconHealthPanelHeight(
  summaryLineCount: number,
  expanded: boolean,
): number {
  if (summaryLineCount <= 0) return 0;
  if (!expanded) return LEXICON_HEALTH_PANEL_SUMMARY_PX;
  return (
    LEXICON_HEALTH_PANEL_SUMMARY_PX +
    LEXICON_HEALTH_PANEL_BODY_CHROME_PX +
    summaryLineCount * LEXICON_HEALTH_PANEL_LINE_PX
  );
}

export function resolveCorrectionRulesEmptyFitHeight(input: {
  hasReadOnlyHints: boolean;
  postTranscribeExtra: boolean;
  lexiconHealthLineCount?: number;
  lexiconHealthExpanded?: boolean;
}): number {
  let extra = 0;
  if (input.hasReadOnlyHints) extra += FLOATING_PANEL_DETAILS_SUMMARY_PX;
  if (input.postTranscribeExtra) extra += FLOATING_PANEL_MUTED_LINE_PX;
  extra += resolveLexiconHealthPanelHeight(
    input.lexiconHealthLineCount ?? 0,
    input.lexiconHealthExpanded ?? false,
  );
  return resolveFloatingPanelCompactFitHeight(CORRECTION_RULES_EMPTY_STATIC_BODY_PX, extra);
}

export function resolveCorrectionRulesPreviewFitHeight(input: {
  rowCount: number;
  hasReadOnlyHints: boolean;
  lexiconHealthLineCount?: number;
  lexiconHealthExpanded?: boolean;
}): number {
  let staticExtra = resolveLexiconHealthPanelHeight(
    input.lexiconHealthLineCount ?? 0,
    input.lexiconHealthExpanded ?? false,
  );
  if (input.hasReadOnlyHints) staticExtra += FLOATING_PANEL_DETAILS_SUMMARY_PX;
  return resolveFloatingPanelFitHeight(
    CORRECTION_RULES_PREVIEW_STATIC_BODY_PX + staticExtra,
    input.rowCount,
  );
}

export function resolveStageBConsentFitHeight(hasPendingHint: boolean): number {
  const base = resolveFloatingPanelCompactFitHeight(POST_TRANSCRIBE_STAGE_B_CONSENT_STATIC_BODY_PX);
  return hasPendingHint ? base + POST_TRANSCRIBE_STAGE_B_HINT_EXTRA_PX : base;
}

export function resolveStageBEmptyFitHeight(hasPendingHint: boolean, hasPackHint: boolean): number {
  let extra = 0;
  if (hasPendingHint) extra += POST_TRANSCRIBE_STAGE_B_HINT_EXTRA_PX;
  if (hasPackHint) extra += POST_TRANSCRIBE_STAGE_B_HINT_EXTRA_PX;
  return resolveFloatingPanelCompactFitHeight(POST_TRANSCRIBE_STAGE_B_EMPTY_STATIC_BODY_PX, extra);
}

export function resolveStageBPreviewFitHeight(rowCount: number): number {
  const listHeight = resolveFloatingPanelSegmentListHeight(
    rowCount,
    POST_TRANSCRIBE_STAGE_B_PREVIEW_LIST_MAX_HEIGHT_PX,
  );
  const natural =
    FLOATING_PANEL_TITLE_BAR_PX + POST_TRANSCRIBE_STAGE_B_PREVIEW_STATIC_BODY_PX + listHeight;
  return Math.min(natural, POST_TRANSCRIBE_STAGE_B_PREVIEW_MAX_PANEL_HEIGHT_PX);
}
