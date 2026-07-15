/** P1: TXT / SRT export from segment rows (UTF-8, LF). */

export interface ExportSegment {
  idx: number;
  start_sec: number;
  end_sec: number;
  text: string;
  /** 语段备注；非空时以内联 `（…）` 追加在正文后。 */
  annotation?: string | null;
}

function pad(n: number, w: number): string {
  return String(Math.floor(n)).padStart(w, "0");
}

function trimmedAnnotation(annotation: string | null | undefined): string | null {
  const t = annotation?.trim();
  return t ? t : null;
}

/** 正文 + 可选备注（全角括号，与 DOCX 修订轨展示一致）。 */
export function formatSegmentTextWithAnnotation(
  text: string,
  annotation?: string | null,
): string {
  const note = trimmedAnnotation(annotation);
  if (!note) return text ?? "";
  return `${text ?? ""}（${note}）`;
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
  return segments
    .map((s) => formatSegmentTextWithAnnotation(s.text, s.annotation))
    .join("\n");
}

/** SubRip: index + timestamps + blank line between cues. */
export function formatSrt(segments: ExportSegment[]): string {
  const parts: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const n = i + 1;
    const start = formatSrtTime(s.start_sec);
    const end = formatSrtTime(s.end_sec);
    const cueText = formatSegmentTextWithAnnotation(s.text, s.annotation)
      .replace(/\r\n/g, "\n")
      .trimEnd();
    parts.push(`${n}\n${start} --> ${end}\n${cueText}\n`);
  }
  return parts.join("\n");
}
