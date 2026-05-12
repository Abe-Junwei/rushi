/** P1: TXT / SRT export from segment rows (UTF-8, LF). */

export interface ExportSegment {
  idx: number;
  start_sec: number;
  end_sec: number;
  text: string;
}

function pad(n: number, w: number): string {
  return String(Math.floor(n)).padStart(w, "0");
}

/** SRT timestamp `HH:MM:SS,mmm` */
export function formatSrtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const total = Math.floor(totalMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
}

/** Plain text: one segment per line (no timestamps). */
export function formatTxt(segments: ExportSegment[]): string {
  return segments.map((s) => s.text ?? "").join("\n");
}

/** SubRip: index + timestamps + blank line between cues. */
export function formatSrt(segments: ExportSegment[]): string {
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const n = i + 1;
    const start = formatSrtTime(s.start_sec);
    const end = formatSrtTime(s.end_sec);
    parts.push(`${n}\n${start} --> ${end}\n${(s.text ?? "").replace(/\r\n/g, "\n").trimEnd()}\n`);
  }
  return parts.join("\n");
}
