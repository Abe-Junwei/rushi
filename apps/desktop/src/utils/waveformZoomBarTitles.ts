import { FIT_SELECTION_VIEWPORT_RATIO } from "./pxPerSec";

export function fitSelectionPercentLabel(): string {
  return `${Math.round(FIT_SELECTION_VIEWPORT_RATIO * 100)}%`;
}

export function resolveFitSelectionTitle(hasSelection: boolean, active: boolean): string {
  if (!hasSelection) {
    return "请先在语段列表或波形上选中一条语段";
  }
  const pct = fitSelectionPercentLabel();
  if (active) {
    return `语段适配（已激活）：选中语段约占视口 ${pct} 宽，并已滚入可见区域`;
  }
  return `语段适配：将选中语段缩放到约占视口 ${pct} 宽，并滚入可见区域`;
}

export function resolveFitAllTitle(active: boolean): string {
  if (active) {
    return "整段可见（已激活）：整段音频时间轴已贴满视口宽度";
  }
  return "整段可见：缩小至整段音频贴满视口宽度（本文件最宽可见）";
}

export function resolveZoomOutTitle(atMinZoom: boolean): string {
  if (atMinZoom) {
    return "已为本文件最宽可见（整段贴满视口）";
  }
  return "缩小一级";
}

export function resolveZoomInTitle(atMaxZoom: boolean): string {
  if (atMaxZoom) {
    return "已为本文件最大缩放";
  }
  return "放大一级";
}

export function resolveResetTitle(active: boolean): string {
  if (active) {
    return "默认比例（已激活）：当前为本文件编辑默认缩放（标签约 100%）";
  }
  return "默认比例：恢复本文件编辑默认（几何中点；±5 步可达最宽/最大）";
}

export function hasWaveformSegmentSelection(
  selectedStartSec?: number,
  selectedEndSec?: number,
): boolean {
  return (
    selectedStartSec != null &&
    selectedEndSec != null &&
    Number.isFinite(selectedStartSec) &&
    Number.isFinite(selectedEndSec)
  );
}
