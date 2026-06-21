import { logDesktopUi } from "../desktopUiLog";

/** localStorage key — default off. DevTools: `__rushiSelectionProfile.enable()` */
export const SELECTION_LATENCY_PROFILE_STORAGE_KEY = "rushi.dev.selectionLatencyProfile";

const RECENT_PROFILE_LINES_MAX = 48;

export type SelectionLatencyProfileSpan =
  | "flushSelectedIdx"
  | "firstPaint"
  | "resolvePlan"
  | "viewport"
  | "focus"
  | "listScroll"
  | "listScrollCorrect"
  | "listCommit"
  | "listChrome"
  | "seek";

type ActiveSelectionProfile = {
  label: string;
  startedAt: number;
  spans: Partial<Record<SelectionLatencyProfileSpan, number>>;
};

let activeProfile: ActiveSelectionProfile | null = null;
let profileSeq = 0;
let waveformProfileFlushTimer = 0;
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

export function isSelectionLatencyProfileEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SELECTION_LATENCY_PROFILE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSelectionLatencyProfileEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(SELECTION_LATENCY_PROFILE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(SELECTION_LATENCY_PROFILE_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function selectionProfileIsActive(): boolean {
  return activeProfile != null && isSelectionLatencyProfileEnabled();
}

export function selectionProfileBegin(label: string): void {
  if (!isSelectionLatencyProfileEnabled()) return;
  profileSeq += 1;
  activeProfile = {
    label,
    startedAt: performance.now(),
    spans: {},
  };
  if (typeof performance.mark === "function") {
    performance.mark(`selection-profile:s${profileSeq}:start`);
  }
}

export function selectionProfileAdd(span: SelectionLatencyProfileSpan, ms: number): void {
  if (!activeProfile) return;
  activeProfile.spans[span] = (activeProfile.spans[span] ?? 0) + ms;
}

/** 记录自 selectionProfileBegin 到首帧 paint 的耗时（每轮仅一次）。 */
export function selectionProfileMarkFirstPaint(): void {
  if (!activeProfile || activeProfile.spans.firstPaint != null) return;
  selectionProfileAdd("firstPaint", performance.now() - activeProfile.startedAt);
}

export function selectionProfileTime<T>(span: SelectionLatencyProfileSpan, fn: () => T): T {
  if (!selectionProfileIsActive()) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    selectionProfileAdd(span, performance.now() - t0);
  }
}

function formatSpanParts(spans: ActiveSelectionProfile["spans"]): string {
  const order: SelectionLatencyProfileSpan[] = [
    "flushSelectedIdx",
    "firstPaint",
    "listChrome",
    "resolvePlan",
    "listScroll",
    "listScrollCorrect",
    "listCommit",
    "viewport",
    "seek",
    "focus",
  ];
  return order
    .filter((key) => (spans[key] ?? 0) > 0)
    .map((key) => `${key}=${spans[key]!.toFixed(1)}ms`)
    .join(" ");
}

export function selectionProfileFlush(): void {
  if (!activeProfile || !isSelectionLatencyProfileEnabled()) return;
  window.clearTimeout(waveformProfileFlushTimer);
  waveformProfileFlushTimer = 0;
  const frame = activeProfile;
  activeProfile = null;
  const totalMs = performance.now() - frame.startedAt;
  const spanText = formatSpanParts(frame.spans);
  const detail = spanText.length > 0 ? ` ${spanText}` : "";
  emitProfileLine(
    `[selection-profile] #${profileSeq} ${frame.label}${detail} total=${totalMs.toFixed(1)}ms`,
  );
  if (typeof performance.mark === "function") {
    performance.mark(`selection-profile:s${profileSeq}:end`);
    if (typeof performance.measure === "function") {
      try {
        performance.measure(
          `selection-profile:s${profileSeq}`,
          `selection-profile:s${profileSeq}:start`,
          `selection-profile:s${profileSeq}:end`,
        );
      } catch {
        /* duplicate measure during rapid navigation */
      }
    }
  }
}

/** Waveform：等列表 layout commit 后再 flush，使 total/listCommit 反映 transition 成本。 */
export function selectionProfileMarkListCommit(): void {
  if (!activeProfile || !isSelectionLatencyProfileEnabled()) return;
  if (activeProfile.spans.listCommit != null) return;
  selectionProfileAdd("listCommit", performance.now() - activeProfile.startedAt);
  selectionProfileFlush();
}

/** List：rAF 后 flush（含 firstPaint）。Waveform：defer 至 listCommit 或超时。 */
export function selectionProfileScheduleFlush(source: "list" | "waveform"): void {
  if (!isSelectionLatencyProfileEnabled()) return;
  window.clearTimeout(waveformProfileFlushTimer);
  if (source === "list") {
    requestAnimationFrame(() => selectionProfileFlush());
    return;
  }
  waveformProfileFlushTimer = window.setTimeout(() => {
    waveformProfileFlushTimer = 0;
    selectionProfileFlush();
  }, 3000);
}

export function readRecentSelectionLatencyProfileLines(): readonly string[] {
  return recentProfileLines;
}

export function installSelectionLatencyProfileDevTools(): void {
  if (typeof window === "undefined") return;
  const api = {
    enable: () => {
      setSelectionLatencyProfileEnabled(true);
      const message =
        "[selection-profile] enabled — select segments; lines appear here (also desktop.log in Tauri)";
      emitProfileLine(message);
      return { enabled: true, message };
    },
    disable: () => {
      setSelectionLatencyProfileEnabled(false);
      activeProfile = null;
      const message = "[selection-profile] disabled";
      emitProfileLine(message);
      return { enabled: false, message };
    },
    enabled: () => isSelectionLatencyProfileEnabled(),
    recent: () => [...recentProfileLines],
    print: () => {
      if (recentProfileLines.length === 0) {
        const message = "[selection-profile] (no lines yet — run enable(), then select a segment)";
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
  Object.defineProperty(window, "__rushiSelectionProfile", {
    value: api,
    configurable: true,
    writable: true,
  });
}

export function resetSelectionLatencyProfileForTests(): void {
  activeProfile = null;
  profileSeq = 0;
  window.clearTimeout(waveformProfileFlushTimer);
  waveformProfileFlushTimer = 0;
  recentProfileLines.length = 0;
}

declare global {
  interface Window {
    __rushiSelectionProfile?: {
      enable: () => { enabled: true; message: string };
      disable: () => { enabled: false; message: string };
      enabled: () => boolean;
      recent: () => string[];
      print: () => { lines: string[]; message?: string };
    };
  }
}
