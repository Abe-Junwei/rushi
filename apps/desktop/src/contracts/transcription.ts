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
   */
  confidence: number | null;
  /** True when engine marks low confidence or heuristic fallback. */
  low_confidence?: boolean;
  /** Optional per-segment note (e.g. stub / post-process). */
  detail?: string;
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
  error?: TranscriptionError;
  warnings: string[];
}

/** Client-side contract for calling a local or remote ASR HTTP service. */
export interface TranscriptionProvider {
  readonly id: string;
  transcribeFile(file: File, signal?: AbortSignal): Promise<TranscriptionResult>;
}

export function isTranscriptionResult(value: unknown): value is TranscriptionResult {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    o.schema_version === TRANSCRIPTION_RESULT_SCHEMA_VERSION &&
    Array.isArray(o.segments) &&
    typeof o.full_text === "string" &&
    typeof o.engine === "string" &&
    (o.duration_sec === null || typeof o.duration_sec === "number") &&
    Array.isArray(o.warnings)
  );
}
