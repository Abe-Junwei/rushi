export const UI_DISPLAY_SCALE_STORAGE_KEY = "rushi.ui-scale.v1";
export const UI_DISPLAY_SCALE_DATA_ATTR = "uiScale";
export const UI_DISPLAY_SCALE_CSS_VAR = "--rushi-ui-scale";
export const DEFAULT_UI_DISPLAY_SCALE = 1;

export const UI_DISPLAY_SCALE_PRESETS = [1, 1.1, 1.25, 1.5] as const;
export type UiDisplayScale = (typeof UI_DISPLAY_SCALE_PRESETS)[number];

const listeners = new Set<() => void>();

function notifyUiDisplayScaleChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function formatUiDisplayScaleLabel(scale: UiDisplayScale): string {
  return `${Math.round(scale * 100)}%`;
}

export function snapUiDisplayScale(value: unknown): UiDisplayScale {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_UI_DISPLAY_SCALE;
  }
  let closest: UiDisplayScale = UI_DISPLAY_SCALE_PRESETS[0];
  let minDiff = Math.abs(value - closest);
  for (const preset of UI_DISPLAY_SCALE_PRESETS) {
    const diff = Math.abs(value - preset);
    if (diff < minDiff) {
      minDiff = diff;
      closest = preset;
    }
  }
  return closest;
}

export function readStoredUiDisplayScale(): UiDisplayScale {
  if (typeof window === "undefined") return DEFAULT_UI_DISPLAY_SCALE;
  const raw = window.localStorage.getItem(UI_DISPLAY_SCALE_STORAGE_KEY);
  if (raw == null || raw.trim() === "") return DEFAULT_UI_DISPLAY_SCALE;
  return snapUiDisplayScale(Number(raw));
}

function writeStoredUiDisplayScale(scale: UiDisplayScale): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(UI_DISPLAY_SCALE_STORAGE_KEY, String(scale));
}

function applyUiDisplayScaleToRoot(root: HTMLElement, scale: UiDisplayScale): void {
  if (scale === DEFAULT_UI_DISPLAY_SCALE) {
    delete root.dataset.uiScale;
  } else {
    root.dataset.uiScale = String(scale);
  }
}

export function initUiDisplayScale(): UiDisplayScale {
  const scale = readStoredUiDisplayScale();
  if (typeof document !== "undefined") {
    applyUiDisplayScaleToRoot(document.documentElement, scale);
  }
  return scale;
}

export function applyUiDisplayScale(scale: UiDisplayScale): void {
  if (typeof document === "undefined") return;
  const valid = snapUiDisplayScale(scale);
  applyUiDisplayScaleToRoot(document.documentElement, valid);
  writeStoredUiDisplayScale(valid);
  notifyUiDisplayScaleChanged();
}

export function subscribeUiDisplayScale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUiDisplayScaleSnapshot(): UiDisplayScale {
  return readStoredUiDisplayScale();
}

/** 浮动面板默认/边界 px — 随界面缩放同比放大（100% 为基准）。 */
export function scaleUiPanelPx(px: number, scale: UiDisplayScale = readStoredUiDisplayScale()): number {
  return Math.round(px * scale);
}
