import { logDesktopUi } from "../desktopUiLog";

/** localStorage key — default off. DevTools: `__rushiWfProfile.enable()` */
export const WAVEFORM_ZOOM_PROFILE_STORAGE_KEY = "rushi.dev.waveformZoomProfile";

const RECENT_PROFILE_LINES_MAX = 48;

export type WaveformZoomProfileSpan =
  | "resample"
  | "wsLoad"
  | "wsZoom"
  | "reRender"
  | "segmentBands";

type ActiveProfile = {
  label: string;
  startedAt: number;
  spans: Partial<Record<WaveformZoomProfileSpan, number>>;
};

let activeProfile: ActiveProfile | null = null;
let profileFrameSeq = 0;
const recentProfileLines: string[] = [];

function emitProfileLine(line: string): void {
  recentProfileLines.push(line);
  if (recentProfileLines.length > RECENT_PROFILE_LINES_MAX) {
    recentProfileLines.shift();
  }
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(line);
  }
  logDesktopUi("INFO", line);
}

export function isWaveformZoomProfileEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WAVEFORM_ZOOM_PROFILE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setWaveformZoomProfileEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(WAVEFORM_ZOOM_PROFILE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(WAVEFORM_ZOOM_PROFILE_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function wfProfileIsActive(): boolean {
  return activeProfile != null && isWaveformZoomProfileEnabled();
}

export function wfProfileBegin(label: string): void {
  if (!isWaveformZoomProfileEnabled()) return;
  profileFrameSeq += 1;
  activeProfile = {
    label,
    startedAt: performance.now(),
    spans: {},
  };
  if (typeof performance.mark === "function") {
    performance.mark(`wf-profile:f${profileFrameSeq}:start`);
  }
}

export function wfProfileSetLabel(label: string): void {
  if (!activeProfile) return;
  activeProfile.label = label;
}

export function wfProfileAdd(span: WaveformZoomProfileSpan, ms: number): void {
  if (!activeProfile) return;
  activeProfile.spans[span] = (activeProfile.spans[span] ?? 0) + ms;
}

export function wfProfileTime<T>(span: WaveformZoomProfileSpan, fn: () => T): T {
  if (!isWaveformZoomProfileEnabled()) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    wfProfileAdd(span, performance.now() - t0);
  }
}

export async function wfProfileTimeAsync<T>(
  span: WaveformZoomProfileSpan,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isWaveformZoomProfileEnabled()) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    wfProfileAdd(span, performance.now() - t0);
  }
}

function formatSpanParts(spans: ActiveProfile["spans"]): string {
  const order: WaveformZoomProfileSpan[] = [
    "resample",
    "wsLoad",
    "wsZoom",
    "reRender",
    "segmentBands",
  ];
  return order
    .filter((key) => (spans[key] ?? 0) > 0)
    .map((key) => `${key}=${spans[key]!.toFixed(1)}ms`)
    .join(" ");
}

export function wfProfileFlush(): void {
  if (!activeProfile || !isWaveformZoomProfileEnabled()) return;
  const frame = activeProfile;
  activeProfile = null;
  const totalMs = performance.now() - frame.startedAt;
  const spanText = formatSpanParts(frame.spans);
  const detail = spanText.length > 0 ? ` ${spanText}` : "";
  emitProfileLine(
    `[wf-profile] #${profileFrameSeq} ${frame.label}${detail} total=${totalMs.toFixed(1)}ms`,
  );
  if (typeof performance.mark === "function") {
    performance.mark(`wf-profile:f${profileFrameSeq}:end`);
    if (typeof performance.measure === "function") {
      try {
        performance.measure(
          `wf-profile:f${profileFrameSeq}`,
          `wf-profile:f${profileFrameSeq}:start`,
          `wf-profile:f${profileFrameSeq}:end`,
        );
      } catch {
        /* duplicate measure between rapid zooms */
      }
    }
  }
}

/** Log standalone span when profiling is on but no zoom frame is active (e.g. resize reRender). */
export function wfProfileStandalone(span: WaveformZoomProfileSpan, ms: number, note?: string): void {
  if (!isWaveformZoomProfileEnabled()) return;
  if (wfProfileIsActive()) {
    wfProfileAdd(span, ms);
    return;
  }
  const suffix = note ? ` ${note}` : "";
  emitProfileLine(`[wf-profile] ${span}=${ms.toFixed(1)}ms${suffix}`);
}

export function readRecentWaveformZoomProfileLines(): readonly string[] {
  return recentProfileLines;
}

export function installWaveformZoomProfileDevTools(): void {
  if (typeof window === "undefined") return;
  const api = {
    enable: () => {
      setWaveformZoomProfileEnabled(true);
      emitProfileLine(
        "[wf-profile] enabled — zoom the waveform; lines appear here (also desktop.log in Tauri)",
      );
    },
    disable: () => {
      setWaveformZoomProfileEnabled(false);
      activeProfile = null;
      emitProfileLine("[wf-profile] disabled");
    },
    enabled: () => isWaveformZoomProfileEnabled(),
    recent: () => [...recentProfileLines],
    print: () => {
      if (recentProfileLines.length === 0) {
        console.info("[wf-profile] (no lines yet — run enable(), then zoom)");
        return;
      }
      for (const line of recentProfileLines) console.info(line);
    },
  };
  Object.defineProperty(window, "__rushiWfProfile", {
    value: api,
    configurable: true,
    writable: true,
  });
}

export function resetWaveformZoomProfileForTests(): void {
  activeProfile = null;
  profileFrameSeq = 0;
  recentProfileLines.length = 0;
}
