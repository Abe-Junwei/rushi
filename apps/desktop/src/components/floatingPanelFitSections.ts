import {
  FLOATING_PANEL_DETAILS_SUMMARY_PX,
  FLOATING_PANEL_MUTED_LINE_PX,
  FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
  FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX,
  FLOATING_PANEL_TITLE_BAR_PX,
  LEXICON_HEALTH_PANEL_BODY_CHROME_PX,
  LEXICON_HEALTH_PANEL_LINE_PX,
} from "./floatingPanelSegmentListLayout";

export type FloatingPanelFitSection =
  | { kind: "static"; px: number }
  | { kind: "mutedLine"; show: boolean }
  | {
      kind: "details";
      summaryPx?: number;
      linePx?: number;
      bodyChromePx?: number;
      lineCount: number;
      expanded: boolean;
    }
  | {
      kind: "segmentList";
      rowCount: number;
      rowPx?: number;
      maxListPx?: number;
    };

export function resolveDetailsSectionHeight(input: {
  lineCount: number;
  expanded: boolean;
  summaryPx?: number;
  linePx?: number;
  bodyChromePx?: number;
}): number {
  if (input.lineCount <= 0 && !input.expanded) return 0;
  const summaryPx = input.summaryPx ?? FLOATING_PANEL_DETAILS_SUMMARY_PX;
  if (!input.expanded) return summaryPx;
  const linePx = input.linePx ?? LEXICON_HEALTH_PANEL_LINE_PX;
  const bodyChromePx = input.bodyChromePx ?? LEXICON_HEALTH_PANEL_BODY_CHROME_PX;
  return summaryPx + bodyChromePx + Math.max(1, input.lineCount) * linePx;
}

export function resolveSegmentListSectionHeight(input: {
  rowCount: number;
  rowPx?: number;
  maxListPx?: number;
}): number {
  if (input.rowCount <= 0) return 0;
  const rowPx = input.rowPx ?? FLOATING_PANEL_SEGMENT_ROW_HEIGHT_PX;
  const maxListPx = input.maxListPx ?? FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX;
  return Math.min(input.rowCount * rowPx, maxListPx);
}

/** 正文区 px（不含标题栏）→ 面板总高度。 */
export function resolveFloatingPanelSectionsBodyPx(sections: FloatingPanelFitSection[]): number {
  let total = 0;
  for (const section of sections) {
    switch (section.kind) {
      case "static":
        total += section.px;
        break;
      case "mutedLine":
        if (section.show) total += FLOATING_PANEL_MUTED_LINE_PX;
        break;
      case "details":
        total += resolveDetailsSectionHeight({
          lineCount: section.lineCount,
          expanded: section.expanded,
          summaryPx: section.summaryPx,
          linePx: section.linePx,
          bodyChromePx: section.bodyChromePx,
        });
        break;
      case "segmentList":
        total += resolveSegmentListSectionHeight(section);
        break;
      default:
        break;
    }
  }
  return total;
}

export function resolveFloatingPanelSectionsFitHeight(sections: FloatingPanelFitSection[]): number {
  return FLOATING_PANEL_TITLE_BAR_PX + resolveFloatingPanelSectionsBodyPx(sections);
}

function measureFloatingPanelInlineStack(node: HTMLElement): number {
  const style = getComputedStyle(node);
  const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const gap = parseFloat(style.rowGap) || 0;
  const children = Array.from(node.children) as HTMLElement[];
  if (children.length === 0) return node.scrollHeight;

  let total = padding;
  for (let i = 0; i < children.length; i++) {
    if (i > 0) {
      total += gap + (parseFloat(getComputedStyle(children[i]).marginTop) || 0);
    }
    total += children[i].scrollHeight;
  }
  return total;
}

function measureFloatingPanelBodyChildHeight(child: HTMLElement): number {
  const childStyle = getComputedStyle(child);
  const flexGrow = parseFloat(childStyle.flexGrow);
  if (flexGrow > 0) {
    const list = child.querySelector("ul");
    if (list instanceof HTMLElement) return list.scrollHeight;
    return measureFloatingPanelInlineStack(child);
  }
  return child.scrollHeight;
}

/** 累加 flex 列直接子节点高度（不受 h-full 拉伸误导）。 */
export function measureFloatingPanelBodyStack(node: HTMLElement): number {
  const style = getComputedStyle(node);
  const gap = parseFloat(style.rowGap) || 0;
  const children = Array.from(node.children) as HTMLElement[];
  if (children.length === 0) return node.scrollHeight;

  let total = 0;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (i > 0) {
      total += parseFloat(getComputedStyle(child).marginTop) || 0;
    }
    total += measureFloatingPanelBodyChildHeight(child);
  }
  return total + Math.max(0, children.length - 1) * gap;
}

/** FloatingPanelDialogRoot 的 pt-3 pb-6（不含子节点 margin；footer mt-3 由 stack 测量计入）。 */
export const FLOATING_PANEL_DIALOG_ROOT_CHROME_PX = 36;

export function resolveMeasuredPanelFitHeight(bodyScrollHeight: number): number {
  return (
    FLOATING_PANEL_TITLE_BAR_PX + FLOATING_PANEL_DIALOG_ROOT_CHROME_PX + Math.ceil(bodyScrollHeight)
  );
}

/** 正文容器 scrollHeight（已含 padding）→ 面板总高度；用于 h-auto 静态表单。 */
export function resolveMeasuredPanelFitHeightFromBox(bodyBoxScrollHeight: number): number {
  return FLOATING_PANEL_TITLE_BAR_PX + Math.ceil(bodyBoxScrollHeight);
}

export function mergeContentFitHeights(
  estimated: number | undefined,
  measured: number | null,
): number | undefined {
  if (estimated == null && measured == null) return undefined;
  if (measured == null) return estimated;
  if (estimated == null) return measured;
  // 正文变短：以实测为准；测量误差（页脚 margin 等）不应把面板压到裁切
  if (measured < estimated) {
    const measurementSlackPx = 32;
    if (estimated - measured <= measurementSlackPx) return estimated;
    return measured;
  }
  return Math.max(estimated, measured);
}
