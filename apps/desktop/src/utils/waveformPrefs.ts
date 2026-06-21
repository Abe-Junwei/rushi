import { clampWaveformPlaybackRate } from "./waveformPlaybackRate";
import { clampPxPerSec, resolveDefaultEditingPxPerSec, TIMELINE_PX_PER_SEC } from "./pxPerSec";
import type { WaveformPlaybackScrollFollowMode } from "./waveformPlaybackScrollFollow";

const LS_KEY = "rushi.p1.waveformPxPerSec";
const LS_HEIGHT = "rushi.p1.waveformHeightPx";
const LS_FONT = "rushi.p1.transcriptFontPx";
const LS_GLOBAL_PLAYBACK_RATE = "rushi.p1.waveformGlobalPlaybackRate";
/** @deprecated 已合并至 global；仅用于一次性迁移 */
const LS_SEGMENT_PLAYBACK_RATE_LEGACY = "rushi.p1.segmentPlaybackRate";
const LS_TAB_ADVANCE_LOOP = "rushi.p1.tabAdvanceLoopsSegment";
const LS_MINIMAP = "rushi.p1.waveformMinimap";
const LS_PLAYBACK_SCROLL_FOLLOW = "rushi.p1.waveformPlaybackScrollFollow";

const waveformPrefListeners = new Set<() => void>();

/** 设置页与工具条共用 storage；写入后通知转写页 hooks 刷新。 */
export function subscribeWaveformPrefs(listener: () => void): () => void {
  waveformPrefListeners.add(listener);
  return () => {
    waveformPrefListeners.delete(listener);
  };
}

export function notifyWaveformPrefsChanged(): void {
  for (const listener of waveformPrefListeners) {
    listener();
  }
}

function notifyAfterWaveformPrefWrite(): void {
  notifyWaveformPrefsChanged();
}

/** 程序内设定：后台预热/生成 peaks（Route C2）。 */
export const WAVEFORM_BACKGROUND_PEAKS_ENABLED = true;

/** 程序内设定：peaks 就绪时在播放中立即热切换（否则暂停后切换）。 */
export const WAVEFORM_HOT_SWITCH_WHILE_PLAYING = true;

export const WAVEFORM_HEIGHT_MIN = 56;
export const WAVEFORM_HEIGHT_MAX = 280;
/** 与 Stitch 波形区默认视觉高度一致（`19-stitch-waveform-polish-spec` §4.2）。 */
export const WAVEFORM_HEIGHT_DEFAULT = 220;
/** 旧默认过矮；读存储时视为未设定，以便升到 {@link WAVEFORM_HEIGHT_DEFAULT}。 */
export const WAVEFORM_HEIGHT_LEGACY_DEFAULT = 96;

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

/** 语段正文字号菜单选项（11–44px，步进 1）。 */
export function listTranscriptFontPxOptions(): number[] {
  const options: number[] = [];
  for (let px = TRANSCRIPT_FONT_MIN; px <= TRANSCRIPT_FONT_MAX; px += 1) {
    options.push(px);
  }
  return options;
}

export function readStoredWaveformHeightPx(): number | null {
  try {
    const raw = localStorage.getItem(LS_HEIGHT);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const clamped = clampWaveformHeight(n);
    if (clamped === WAVEFORM_HEIGHT_LEGACY_DEFAULT) return null;
    return clamped;
  } catch {
    return null;
  }
}

export function writeStoredWaveformHeightPx(px: number): void {
  try {
    localStorage.setItem(LS_HEIGHT, String(clampWaveformHeight(px)));
    notifyAfterWaveformPrefWrite();
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
    notifyAfterWaveformPrefWrite();
  } catch {
    /* noop */
  }
}

export function resolveStoredTranscriptFontPx(): number {
  return readStoredP1TranscriptFontPx() ?? TRANSCRIPT_FONT_DEFAULT;
}

export function resolveStoredWaveformHeightPx(): number {
  return readStoredWaveformHeightPx() ?? WAVEFORM_HEIGHT_DEFAULT;
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
    notifyAfterWaveformPrefWrite();
  } catch {
    /* noop */
  }
}

/**
 * 语段倍速已废弃：若 global 仍为默认 1× 而 legacy segment key 有值，则迁移并删除旧 key。
 * @returns 迁移后的倍速；无迁移时 null
 */
export function migrateLegacySegmentPlaybackRateToGlobal(): number | null {
  try {
    const segmentRaw = localStorage.getItem(LS_SEGMENT_PLAYBACK_RATE_LEGACY);
    if (segmentRaw == null || segmentRaw === "") return null;
    const segmentValue = Number(segmentRaw);
    localStorage.removeItem(LS_SEGMENT_PLAYBACK_RATE_LEGACY);
    if (!Number.isFinite(segmentValue)) return null;
    const segmentRate = clampWaveformPlaybackRate(segmentValue);
    const globalRaw = localStorage.getItem(LS_GLOBAL_PLAYBACK_RATE);
    const globalIsDefault =
      globalRaw == null || globalRaw === "" || Number(globalRaw) === 1;
    if (globalIsDefault && segmentRate !== 1) {
      writeStoredWaveformGlobalPlaybackRate(segmentRate);
      return segmentRate;
    }
    return null;
  } catch {
    return null;
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
    notifyAfterWaveformPrefWrite();
  } catch {
    /* noop */
  }
}

/** 主波形下方 L0 minimap 条。 */
export function readStoredWaveformMinimapEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LS_MINIMAP);
    if (raw === "0") return false;
    if (raw === "1") return true;
  } catch {
    /* noop */
  }
  return true;
}

export function writeStoredWaveformMinimapEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(LS_MINIMAP, enabled ? "1" : "0");
    notifyAfterWaveformPrefWrite();
  } catch {
    /* noop */
  }
}

/** 播放跟随：center = 居中固定（历史默认）；edge = 边缘跟随。 */
export function readStoredWaveformPlaybackScrollFollowMode(): WaveformPlaybackScrollFollowMode {
  try {
    const raw = localStorage.getItem(LS_PLAYBACK_SCROLL_FOLLOW);
    if (raw === "center") return "center";
    if (raw === "edge") return "edge";
  } catch {
    /* noop */
  }
  return "center";
}

export function writeStoredWaveformPlaybackScrollFollowMode(
  mode: WaveformPlaybackScrollFollowMode,
): void {
  try {
    localStorage.setItem(LS_PLAYBACK_SCROLL_FOLLOW, mode);
    notifyAfterWaveformPrefWrite();
  } catch {
    /* noop */
  }
}

/** 恢复语段字号与波形高度为产品默认（不影响 Tab loop / minimap 等工作流开关）。 */
export function resetStoredEditorLayoutDefaults(): void {
  writeStoredP1TranscriptFontPx(TRANSCRIPT_FONT_DEFAULT);
  writeStoredWaveformHeightPx(WAVEFORM_HEIGHT_DEFAULT);
}

/** 换音频文件时写入该媒体的 per-file 默认 px/s。 */
export function writeStoredWaveformPxPerSecForMedia(
  viewportWidthPx: number,
  durationSec: number,
): void {
  try {
    localStorage.setItem(LS_KEY, String(resolveDefaultEditingPxPerSec(viewportWidthPx, durationSec)));
  } catch {
    /* noop */
  }
}

/** 无媒体上下文时写入 56 px/s 回退。 */
export function writeStoredWaveformPxPerSecDefault(): void {
  try {
    localStorage.setItem(LS_KEY, String(TIMELINE_PX_PER_SEC));
  } catch {
    /* noop */
  }
}
