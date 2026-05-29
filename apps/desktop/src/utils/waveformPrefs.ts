import { clampWaveformPlaybackRate } from "./waveformPlaybackRate";
import { clampPxPerSec, TIMELINE_PX_PER_SEC } from "./pxPerSec";

const LS_KEY = "rushi.p1.waveformPxPerSec";
const LS_HEIGHT = "rushi.p1.waveformHeightPx";
const LS_FONT = "rushi.p1.transcriptFontPx";
const LS_GLOBAL_STRIP_COLLAPSED = "rushi.p1.waveformGlobalStripCollapsed";
const LS_GLOBAL_PLAYBACK_RATE = "rushi.p1.waveformGlobalPlaybackRate";
const LS_TAB_ADVANCE_LOOP = "rushi.p1.tabAdvanceLoopsSegment";

export const WAVEFORM_HEIGHT_MIN = 56;
export const WAVEFORM_HEIGHT_MAX = 280;
export const WAVEFORM_HEIGHT_DEFAULT = 96;

export const TRANSCRIPT_FONT_MIN = 11;
export const TRANSCRIPT_FONT_MAX = 44;
export const TRANSCRIPT_FONT_DEFAULT = 13;

/** 波形区纵向高度（px），与解语工作区「波形高度」一致：可拖调并持久化。 */
export function clampWaveformHeight(px: number): number {
  return Math.min(WAVEFORM_HEIGHT_MAX, Math.max(WAVEFORM_HEIGHT_MIN, Math.round(px)));
}

/** 语段正文字号（px），与行高联动（见 `computeSegmentLaneRowPx`）。 */
export function clampTranscriptFontPx(px: number): number {
  return Math.min(TRANSCRIPT_FONT_MAX, Math.max(TRANSCRIPT_FONT_MIN, Math.round(px)));
}

export function readStoredWaveformHeightPx(): number | null {
  try {
    const raw = localStorage.getItem(LS_HEIGHT);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampWaveformHeight(n);
  } catch {
    return null;
  }
}

export function writeStoredWaveformHeightPx(px: number): void {
  try {
    localStorage.setItem(LS_HEIGHT, String(clampWaveformHeight(px)));
  } catch {
    /* noop */
  }
}

export function readStoredP1TranscriptFontPx(): number | null {
  try {
    const raw = localStorage.getItem(LS_FONT);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampTranscriptFontPx(n);
  } catch {
    return null;
  }
}

export function writeStoredP1TranscriptFontPx(px: number): void {
  try {
    localStorage.setItem(LS_FONT, String(clampTranscriptFontPx(px)));
  } catch {
    /* noop */
  }
}

/** 上次波形横向缩放（px/s），供下次打开项目时恢复手感。 */
export function readStoredWaveformPxPerSec(): number | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampPxPerSec(n);
  } catch {
    return null;
  }
}

export function writeStoredWaveformPxPerSec(pxPerSec: number): void {
  try {
    localStorage.setItem(LS_KEY, String(Math.round(pxPerSec * 1000) / 1000));
  } catch {
    /* private mode / quota */
  }
}

export function readStoredWaveformGlobalStripCollapsed(): boolean {
  try {
    return localStorage.getItem(LS_GLOBAL_STRIP_COLLAPSED) === "1";
  } catch {
    return false;
  }
}

export function writeStoredWaveformGlobalStripCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(LS_GLOBAL_STRIP_COLLAPSED, collapsed ? "1" : "0");
  } catch {
    /* noop */
  }
}

export function readStoredWaveformGlobalPlaybackRate(): number {
  try {
    const raw = localStorage.getItem(LS_GLOBAL_PLAYBACK_RATE);
    if (!raw) return 1;
    const value = Number(raw);
    return Number.isFinite(value) ? clampWaveformPlaybackRate(value) : 1;
  } catch {
    return 1;
  }
}

export function writeStoredWaveformGlobalPlaybackRate(rate: number): void {
  try {
    localStorage.setItem(LS_GLOBAL_PLAYBACK_RATE, String(clampWaveformPlaybackRate(rate)));
  } catch {
    /* noop */
  }
}

/** Tab 切下一段并播放时是否自动开启语段循环（听打默认开）。 */
export function readStoredTabAdvanceLoopsSegment(): boolean {
  try {
    const raw = localStorage.getItem(LS_TAB_ADVANCE_LOOP);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* noop */
  }
  return true;
}

export function writeStoredTabAdvanceLoopsSegment(enabled: boolean): void {
  try {
    localStorage.setItem(LS_TAB_ADVANCE_LOOP, enabled ? "1" : "0");
  } catch {
    /* noop */
  }
}

/** 换音频文件时写入默认横向缩放（决策 B：100% / 56 px/s）。 */
export function writeStoredWaveformPxPerSecDefault(): void {
  try {
    localStorage.setItem(LS_KEY, String(TIMELINE_PX_PER_SEC));
  } catch {
    /* noop */
  }
}
