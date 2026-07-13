import type { ExportPolishResult } from "./exportDocxPolish";
import { segmentLinesFromSegments } from "./exportPolishPipeline";
import type { SegmentDto } from "../tauri/projectApi";

type CacheEntry = {
  fingerprint: string;
  result: ExportPolishResult;
};

let entry: CacheEntry | null = null;

/** 指纹修订：口语本地压缩已移除。 */
const EXPORT_POLISH_FINGERPRINT_REV = "p2";

/** 语段正文指纹（行数 + 滚动哈希，用于润色结果对齐）。 */
export function fingerprintExportPolishSegments(segments: SegmentDto[]): string {
  const lines = segmentLinesFromSegments(segments);
  const body = lines.join("\n");
  let hash = 5381;
  for (let i = 0; i < body.length; i += 1) {
    hash = ((hash << 5) + hash) ^ body.charCodeAt(i);
  }
  return `${EXPORT_POLISH_FINGERPRINT_REV}:${lines.length}:${body.length}:${(hash >>> 0).toString(16)}`;
}

export function setExportPolishPreviewCache(
  segments: SegmentDto[],
  result: ExportPolishResult,
): void {
  entry = {
    fingerprint: fingerprintExportPolishSegments(segments),
    result,
  };
}

export function getExportPolishPreviewCache(segments: SegmentDto[]): ExportPolishResult | null {
  if (!entry) return null;
  if (entry.fingerprint !== fingerprintExportPolishSegments(segments)) {
    return null;
  }
  return entry.result;
}

export function clearExportPolishPreviewCache(): void {
  entry = null;
}

/** 若缓存指纹与当前语段一致则返回缓存结果。 */
export function tryAdoptExportPolishPreview(
  segments: SegmentDto[],
  polishPreview?: ExportPolishResult | null,
): ExportPolishResult | null {
  const fp = fingerprintExportPolishSegments(segments);
  if (!entry || entry.fingerprint !== fp) return null;
  return polishPreview ?? entry.result;
}
