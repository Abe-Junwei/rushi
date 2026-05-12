/**
 * Transcription API contract (Rushi as source of truth).
 * Keep field names aligned with `services/asr/rushi_asr/schemas.py`.
 */

export const TRANSCRIPTION_RESULT_SCHEMA_VERSION = "1" as const;

/** One timed segment of recognized text. */
export interface TranscriptionSegment {
  /** Start time in seconds (inclusive), relative to normalized audio. */
  start_sec: number;
  /** End time in seconds (exclusive or inclusive per engine; UI treats as display span). */
  end_sec: number;
  text: string;
  /**
   * Engine confidence in [0, 1] when known; `null` when unknown or not applicable (e.g. stub).
   * May be omitted in JSON (Rust / serde default).
   */
  confidence?: number | null;
  /** True when engine marks low confidence or heuristic fallback. */
  low_confidence?: boolean;
  /** Optional per-segment note (e.g. stub / post-process). May serialize as JSON `null`. */
  detail?: string | null;
}

export interface TranscriptionError {
  code: string;
  message: string;
}

/**
 * Normalized response for `POST /v1/transcribe`.
 * On hard failure, `segments` may be empty and `error` set; `warnings` collects non-fatal notes.
 */
export interface TranscriptionResult {
  schema_version: typeof TRANSCRIPTION_RESULT_SCHEMA_VERSION;
  segments: TranscriptionSegment[];
  /** Concatenation of segment texts (convenience; not authoritative over segments). */
  full_text: string;
  /** e.g. `stub`, `funasr`, `funasr+iic/SenseVoiceSmall`. */
  engine: string;
  /** Duration of normalized audio in seconds, if known. */
  duration_sec: number | null;
  error?: TranscriptionError | null;
  warnings: string[];
}

/** Client-side contract for calling a local or remote ASR HTTP service. */
export interface TranscriptionProvider {
  readonly id: string;
  /** Whether this provider can consume hotword bias directly in recognition requests. */
  readonly supportsHotwordBias: boolean;
  /** Lightweight reachability probe for environment diagnostics. */
  isAvailable?(): Promise<boolean>;
  transcribeFile(file: File, signal?: AbortSignal): Promise<TranscriptionResult>;
}

function isTranscriptionError(v: unknown): v is TranscriptionError {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return typeof e.code === "string" && typeof e.message === "string";
}

function isTranscriptionSegment(v: unknown): v is TranscriptionSegment {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (typeof s.start_sec !== "number" || !Number.isFinite(s.start_sec)) return false;
  if (typeof s.end_sec !== "number" || !Number.isFinite(s.end_sec)) return false;
  if (typeof s.text !== "string") return false;
  const c = s.confidence;
  if (c !== undefined && c !== null && typeof c !== "number") return false;
  if (s.low_confidence !== undefined && typeof s.low_confidence !== "boolean") return false;
  const d = s.detail;
  if (d !== undefined && d !== null && typeof d !== "string") return false;
  return true;
}

export function isTranscriptionResult(value: unknown): value is TranscriptionResult {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (o.schema_version !== TRANSCRIPTION_RESULT_SCHEMA_VERSION) return false;
  if (!Array.isArray(o.segments) || !o.segments.every(isTranscriptionSegment)) return false;
  if (typeof o.full_text !== "string") return false;
  if (typeof o.engine !== "string") return false;
  if (o.duration_sec !== null && typeof o.duration_sec !== "number") return false;
  if (o.error !== undefined && o.error !== null && !isTranscriptionError(o.error)) return false;
  if (!Array.isArray(o.warnings) || !o.warnings.every((w) => typeof w === "string")) return false;
  return true;
}
