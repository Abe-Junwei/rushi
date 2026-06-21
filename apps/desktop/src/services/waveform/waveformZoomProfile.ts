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
  // eslint-disable-next-line no-console -- typeof console.info guard itself references console.info
  if (typeof console !== "undefined" && typeof console.info === "function") {
    // eslint-disable-next-line no-console -- dev-only performance profile; kept for browser console ergonomics
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

export function installWaveformZoomProfileDevTools(): void {
  if (typeof window === "undefined") return;
  const api = {
    help: () => {
      const message = [
        "1. __rushiWfProfile.enable()",
        "2. 拖动 zoom ± 或切换 fit-all",
        "3. __rushiWfProfile.print() 或 __rushiWfProfile.recent()",
      ].join("\n");
      // eslint-disable-next-line no-console -- dev-only
      console.info(message);
      return { message };
    },
    enable: () => {
      setWaveformZoomProfileEnabled(true);
      const message =
        "[wf-profile] enabled — zoom the waveform; lines appear here (also desktop.log in Tauri)";
      emitProfileLine(message);
      return { enabled: true, message, next: "zoom then __rushiWfProfile.print()" };
    },
    disable: () => {
      setWaveformZoomProfileEnabled(false);
      activeProfile = null;
      const message = "[wf-profile] disabled";
      emitProfileLine(message);
      return { enabled: false, message };
    },
    enabled: () => isWaveformZoomProfileEnabled(),
    recent: () => [...recentProfileLines],
    print: () => {
      if (recentProfileLines.length === 0) {
        const message = "[wf-profile] (no lines yet — run enable(), then zoom)";
        // eslint-disable-next-line no-console -- dev-only performance profile
        console.info(message);
        return { lines: [] as string[], message };
      }
      for (const line of recentProfileLines) {
        // eslint-disable-next-line no-console -- dev-only performance profile
        console.info(line);
      }
      return { lines: [...recentProfileLines] };
    },
  };
  Object.defineProperty(window, "__rushiWfProfile", {
    value: api,
    configurable: true,
    writable: true,
  });
}

declare global {
  interface Window {
    __rushiWfProfile?: {
      help: () => { message: string };
      enable: () => { enabled: true; message: string; next: string };
      disable: () => { enabled: false; message: string };
      enabled: () => boolean;
      recent: () => string[];
      print: () => { lines: string[]; message?: string };
    };
  }
}

export function resetWaveformZoomProfileForTests(): void {
  activeProfile = null;
  profileFrameSeq = 0;
  recentProfileLines.length = 0;
}
