/** 浮动对话框壳层贴合种类（见 CONTEXT.md · FLOAT-FIT spec）。 */
export type PanelFitKind = "autoFit" | "fill" | "staticFit";

/**
 * 高度真源模式：
 * - autoFit / staticFit → CSS 自动高度（随内容贴合 + 视口封顶内滚）
 * - fill → 固定 px 高度（正文区填充并内滚）
 */
export function resolvePanelAutoHeight(fitKind: PanelFitKind): boolean {
  return fitKind !== "fill";
}

export function resolveEffectivePanelFitKind(fitKind: PanelFitKind | undefined): PanelFitKind {
  return fitKind ?? "staticFit";
}
