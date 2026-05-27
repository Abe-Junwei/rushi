/** Shared project/file DTO types (breaks projectApi ↔ fileApi import cycle). */

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at_ms: number;
}

export interface SegmentDto {
  /** 稳定语段 id；旧数据可为空，打开文件时由前端补全。 */
  uid?: string;
  idx: number;
  start_sec: number;
  end_sec: number;
  text: string;
  /** ASR 置信度 [0,1]，stub 等可为 null */
  confidence?: number | null;
  /** 引擎或 stub 标记的低置信 / 占位 */
  low_confidence?: boolean;
  /** 如 stub 说明、引擎附注 */
  detail?: string | null;
}

export interface FileSummary {
  id: string;
  name: string;
  file_type: string;
  updated_at_ms: number;
}

export interface FileDetail {
  id: string;
  project_id: string;
  name: string;
  file_type: string;
  audio_path: string | null;
  segments: SegmentDto[];
  created_at_ms: number;
  updated_at_ms: number;
}

/** Project container returned by create/import commands (no inline segments). */
export interface RawProjectDetail {
  id: string;
  name: string;
  files: FileSummary[];
  created_at_ms: number;
  updated_at_ms: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  audio_storage_path: string;
  created_at_ms: number;
  updated_at_ms: number;
  segments: SegmentDto[];
  /** File container schema: list of files in the project */
  files: FileSummary[];
}
