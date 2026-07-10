/** 将秒数格式化为 m:ss 或 h:mm:ss（用于波形区时间码，对齐常见 DAW/字幕工具）。 */
export function formatMediaTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 语段时间范围起点（与播放/seek 对齐，容忍反序边界）。 */
export function segmentStartSec(seg: { start_sec: number; end_sec: number }): number {
  return Math.min(seg.start_sec, seg.end_sec);
}

/** 语段播放起点：段内从 playhead；已过段尾从 playhead；段前仍回段头。 */
export function resolveSegmentPlaybackStartSec(
  playheadSec: number,
  seg: { start_sec: number; end_sec: number },
): number {
  const start = segmentStartSec(seg);
  const end = Math.max(seg.start_sec, seg.end_sec);
  if (!Number.isFinite(playheadSec)) return start;
  if (playheadSec >= start && playheadSec < end) return playheadSec;
  if (playheadSec >= end) return playheadSec;
  return start;
}

/**
 * 解析跳转时间输入：`m:ss`、`mm:ss`、`h:mm:ss`；纯秒数也可。
 * 超出 `durationSec` 时钳制；无效返回 null。
 */
export function parseMediaTimeInput(raw: string, durationSec?: number): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const sec = Number(trimmed);
    if (!Number.isFinite(sec) || sec < 0) return null;
    return clampParsedMediaTime(sec, durationSec);
  }

  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((p) => p === "" || !/^\d+(\.\d+)?$/.test(p))) return null;

  const sec =
    parts.length === 2
      ? (() => {
          const [m, s] = parts.map(Number);
          if (!Number.isFinite(m) || !Number.isFinite(s) || m < 0 || s < 0) return null;
          return m * 60 + s;
        })()
      : (() => {
          const [h, m, s] = parts.map(Number);
          if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s) || h < 0 || m < 0 || s < 0) {
            return null;
          }
          return h * 3600 + m * 60 + s;
        })();
  if (sec == null) return null;

  return clampParsedMediaTime(sec, durationSec);
}

function clampParsedMediaTime(sec: number, durationSec?: number): number {
  const dur = durationSec ?? 0;
  if (!Number.isFinite(dur) || dur <= 0) return sec;
  return Math.max(0, Math.min(dur, sec));
}
