import type { SegmentDto } from "../tauri/projectApi";
import type { DocxExportMode, DocxExportOptions } from "../tauri/exportDocxApi";
import {
  resolveDocxDeliveryTimeBlocks,
  toDocxDeliveryTimeBlockPayload,
  type DocxDeliveryTimeBlockPayload,
} from "../utils/exportDocxDeliveryBlocks";

export type DocxExportLayoutInput = {
  mode: DocxExportMode;
  /** Delivery segments (frozen already excluded). */
  segments: SegmentDto[];
  /** Full snapshot before `segmentsForDeliveryExport`. */
  allSegments: SegmentDto[];
  recordingFileName: string;
  transcriber?: string | null;
  /** Cover meta includes transcriber when true and transcriber non-empty. */
  includeProjectMetadata: boolean;
  /** 润色自然段按块 unitCount（与 `deliveryTimeBlocks` 等长）；无则用语段数。 */
  polishBlockUnitCounts?: readonly number[] | null;
  /** 导出时刻；用于文末转录时间（精确到天）。默认 `new Date()`。 */
  exportedAt?: Date;
};

/** 文末转录时间：本地日历日 `YYYY-MM-DD`。 */
export function formatDocxFooterTranscribedDay(exportedAt = new Date()): string {
  const y = exportedAt.getFullYear();
  const m = String(exportedAt.getMonth() + 1).padStart(2, "0");
  const d = String(exportedAt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Lecture/clean: 连续块左上/右下起止时码；冻结打断为多块；文末录音名/转录人/转录时间。
 * Verbatim: 仅文末 footer。
 */
export function buildDocxExportLayoutOptions(input: DocxExportLayoutInput): Pick<
  DocxExportOptions,
  | "deliveryTimeBlocks"
  | "recordingFileName"
  | "footerTranscriberName"
  | "footerTranscribedAt"
> {
  const isLectureOrClean = input.mode === "lecture" || input.mode === "clean";
  const blocks = isLectureOrClean ? resolveDocxDeliveryTimeBlocks(input.allSegments) : [];
  const unitCounts =
    input.polishBlockUnitCounts ??
    blocks.map((b) => b.segmentCount);
  const deliveryTimeBlocks: DocxDeliveryTimeBlockPayload[] | null = isLectureOrClean
    ? toDocxDeliveryTimeBlockPayload(blocks, unitCounts)
    : null;
  const coverHasTranscriber =
    Boolean(input.includeProjectMetadata) && Boolean(input.transcriber?.trim());

  return {
    deliveryTimeBlocks,
    recordingFileName: input.recordingFileName,
    footerTranscriberName: coverHasTranscriber ? null : (input.transcriber?.trim() ?? ""),
    footerTranscribedAt: formatDocxFooterTranscribedDay(input.exportedAt ?? new Date()),
  };
}
