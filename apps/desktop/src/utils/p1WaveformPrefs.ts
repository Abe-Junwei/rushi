import { clampP1PxPerSec } from "./p1PxPerSec";

const LS_KEY = "rushi.p1.waveformPxPerSec";
const LS_HEIGHT = "rushi.p1.waveformHeightPx";
const LS_FONT = "rushi.p1.transcriptFontPx";

export const P1_WAVEFORM_HEIGHT_MIN = 56;
export const P1_WAVEFORM_HEIGHT_MAX = 280;
export const P1_WAVEFORM_HEIGHT_DEFAULT = 96;

export const P1_TRANSCRIPT_FONT_MIN = 11;
export const P1_TRANSCRIPT_FONT_MAX = 44;
export const P1_TRANSCRIPT_FONT_DEFAULT = 13;

/** 波形区纵向高度（px），与解语工作区「波形高度」一致：可拖调并持久化。 */
export function clampP1WaveformHeight(px: number): number {
  return Math.min(P1_WAVEFORM_HEIGHT_MAX, Math.max(P1_WAVEFORM_HEIGHT_MIN, Math.round(px)));
}

/** 语段正文字号（px），与行高联动（见 `computeP1SegmentLaneRowPx`）。 */
export function clampP1TranscriptFontPx(px: number): number {
  return Math.min(P1_TRANSCRIPT_FONT_MAX, Math.max(P1_TRANSCRIPT_FONT_MIN, Math.round(px)));
}

export function readStoredP1WaveformHeightPx(): number | null {
  try {
    const raw = localStorage.getItem(LS_HEIGHT);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampP1WaveformHeight(n);
  } catch {
    return null;
  }
}

export function writeStoredP1WaveformHeightPx(px: number): void {
  try {
    localStorage.setItem(LS_HEIGHT, String(clampP1WaveformHeight(px)));
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
    return clampP1TranscriptFontPx(n);
  } catch {
    return null;
  }
}

export function writeStoredP1TranscriptFontPx(px: number): void {
  try {
    localStorage.setItem(LS_FONT, String(clampP1TranscriptFontPx(px)));
  } catch {
    /* noop */
  }
}

/** 上次波形横向缩放（px/s），供下次打开项目时恢复手感。 */
export function readStoredP1WaveformPxPerSec(): number | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return clampP1PxPerSec(n);
  } catch {
    return null;
  }
}

export function writeStoredP1WaveformPxPerSec(pxPerSec: number): void {
  try {
    localStorage.setItem(LS_KEY, String(Math.round(pxPerSec * 1000) / 1000));
  } catch {
    /* private mode / quota */
  }
}
