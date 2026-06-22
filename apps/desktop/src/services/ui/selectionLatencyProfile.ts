import { logDesktopUi } from "../desktopUiLog";

/** localStorage key — default off. DevTools: `__rushiSelectionProfile.enable()` */
export const SELECTION_LATENCY_PROFILE_STORAGE_KEY = "rushi.dev.selectionLatencyProfile";

/** F-SPLIT：CI 闸门（V-CI）— 同步路径 span 之和上限。 */
export const SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS = 80;

/** F-SPLIT：发版手测证据 — firstPaint / listChrome 单项上限。 */
export const SELECTION_PROFILE_HAND_CHROME_MAX_MS = 50;

/** 193 段级 profile 基准语段数（与手测素材对齐）。 */
export const SELECTION_PROFILE_BASELINE_SEGMENT_COUNT = 193;

/** 计入 syncPathTotal 的 span（不含 listCommit / listScroll / firstPaint 等 transition 成本）。 */
export const SELECTION_PROFILE_SYNC_PATH_SPANS: readonly SelectionLatencyProfileSpan[] = [
  "flushSelectedIdx",
  "listChrome",
  "resolvePlan",
  "viewport",
  "seek",
  "focus",
] as const;

export type ParsedSelectionProfileLine = {
  seq: number;
  label: string;
  spans: Partial<Record<SelectionLatencyProfileSpan, number>>;
  syncPathTotalMs: number;
  totalMs: number;
};

export function computeSelectionProfileSyncPathMs(
  spans: Partial<Record<SelectionLatencyProfileSpan, number>>,
): number {
  const flush = spans.flushSelectedIdx ?? 0;
  const listChrome = spans.listChrome ?? 0;
  let sum = flush;
  // listChrome may nest inside flushSelectedIdx — avoid double-counting.
  // firstPaint is SC1/layout wall clock; hand-test only (see selectionProfileMeetsHandChromeGate).
  if (listChrome > flush) sum += listChrome;
  for (const key of ["resolvePlan", "viewport", "seek", "focus"] as const) {
    sum += spans[key] ?? 0;
  }
  return sum;
}

export function parseSelectionProfileLine(line: string): ParsedSelectionProfileLine | null {
  const prefix = line.match(/^\[selection-profile\] #(\d+) /);
  if (!prefix) return null;
  const seq = Number(prefix[1]);
  const rest = line.slice(prefix[0].length);
  const totalMatch = rest.match(/total=([\d.]+)ms/);
  if (!totalMatch) return null;

  const spanStart = rest.search(
    /\b(flushSelectedIdx|firstPaint|listChrome|resolvePlan|listScroll|listScrollCorrect|listCommit|viewport|seek|focus|syncPathTotal)=/,
  );
  const label =
    spanStart > 0 ? rest.slice(0, spanStart).trim() : rest.replace(/\s*total=[\d.]+ms.*$/, "").trim();

  const spans: Partial<Record<SelectionLatencyProfileSpan, number>> = {};
  for (const match of rest.matchAll(
    /\b(flushSelectedIdx|firstPaint|listChrome|resolvePlan|listScroll|listScrollCorrect|listCommit|viewport|seek|focus)=([\d.]+)ms/g,
  )) {
    spans[match[1] as SelectionLatencyProfileSpan] = Number(match[2]);
  }

  const syncPathMatch = rest.match(/syncPathTotal=([\d.]+)ms/);
  const syncPathTotalMs = syncPathMatch
    ? Number(syncPathMatch[1])
    : computeSelectionProfileSyncPathMs(spans);

  return {
    seq,
    label,
    spans,
    syncPathTotalMs,
    totalMs: Number(totalMatch[1]),
  };
}

export function selectionProfileMeetsCiGate(parsed: ParsedSelectionProfileLine): boolean {
  return parsed.syncPathTotalMs <= SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS;
}

export function selectionProfileMeetsHandChromeGate(parsed: ParsedSelectionProfileLine): boolean {
  const firstPaint = parsed.spans.firstPaint ?? 0;
  const listChrome = parsed.spans.listChrome ?? 0;
  return (
    firstPaint <= SELECTION_PROFILE_HAND_CHROME_MAX_MS &&
    listChrome <= SELECTION_PROFILE_HAND_CHROME_MAX_MS
  );
}

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
  const syncPathTotalMs = computeSelectionProfileSyncPathMs(frame.spans);
  const detail =
    spanText.length > 0
      ? ` ${spanText} syncPathTotal=${syncPathTotalMs.toFixed(1)}ms`
      : ` syncPathTotal=${syncPathTotalMs.toFixed(1)}ms`;
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

/** rAF flush; waveform also marks listCommit when scroll effect settles. */
export function selectionProfileScheduleFlush(source: "list" | "waveform"): void {
  if (!isSelectionLatencyProfileEnabled()) return;
  window.clearTimeout(waveformProfileFlushTimer);
  waveformProfileFlushTimer = 0;
  if (source === "waveform") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => selectionProfileFlush());
    });
    return;
  }
  requestAnimationFrame(() => selectionProfileFlush());
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
