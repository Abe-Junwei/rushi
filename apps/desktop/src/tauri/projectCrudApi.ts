import { invoke } from "@tauri-apps/api/core";
import { parseTauriCommandError, TauriCommandError } from "./commandError";
import type { FileDetail, ProjectDetail, ProjectSummary, SegmentDto } from "./projectTypes";

async function invokeStructured<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    throw new TauriCommandError(parseTauriCommandError(error));
  }
}

export interface EditLogEntryDto {
  id: number;
  project_id: string;
  at_ms: number;
  kind: string;
  detail: string;
  has_snapshot: boolean;
}

export async function pickAudioPath(): Promise<string | null> {
  return invoke<string | null>("pick_audio_path");
}

export async function projectCreate(name: string, srcPath: string): Promise<ProjectDetail> {
  // Tauri 2：invoke 顶层参数名使用 camelCase，与 Rust 形参 snake_case 对应。
  return invoke<ProjectDetail>("project_create_from_audio", { name, srcPath });
}

export async function projectList(): Promise<ProjectSummary[]> {
  return invoke<ProjectSummary[]>("project_list");
}

export async function projectLoad(projectId: string): Promise<ProjectDetail> {
  return invoke<ProjectDetail>("project_load", { projectId });
}

export async function projectListEditLog(projectId: string, limit = 40): Promise<EditLogEntryDto[]> {
  return invoke<EditLogEntryDto[]>("project_list_edit_log", { projectId, limit });
}

export async function projectRecordEditLog(
  projectId: string,
  kind: string,
  detail: string,
): Promise<void> {
  return invoke<void>("project_record_edit_log", { projectId, kind, detail });
}

export async function fileRestoreSegmentsFromEditLog(
  fileId: string,
  editLogId: number,
): Promise<void> {
  return invoke<void>("file_restore_segments_from_edit_log", { fileId, editLogId });
}

export async function projectDelete(projectId: string): Promise<void> {
  return invokeStructured<void>("project_delete", { projectId });
}

export async function renameProject(projectId: string, name: string): Promise<ProjectDetail> {
  return invokeStructured<ProjectDetail>("rename_project", { projectId, name });
}

export type ProjectMetadataInput = {
  narrator?: string | null;
  recorded_at?: string | null;
  location?: string | null;
  subject?: string | null;
  transcriber?: string | null;
};

export async function updateProjectMetadata(
  projectId: string,
  metadata: ProjectMetadataInput,
): Promise<ProjectDetail> {
  return invokeStructured<ProjectDetail>("update_project_metadata", {
    projectId,
    narrator: metadata.narrator ?? null,
    recordedAt: metadata.recorded_at ?? null,
    location: metadata.location ?? null,
    subject: metadata.subject ?? null,
    transcriber: metadata.transcriber ?? null,
  });
}

export async function exportProjectBundle(
  projectId: string,
  fileId: string,
  defaultFilename: string,
  segments: SegmentDto[],
): Promise<string | null> {
  return invokeStructured<string | null>("export_project_bundle", {
    projectId,
    fileId,
    defaultFilename,
    segments,
  });
}

export async function exportLibraryBundle(
  defaultFilename: string,
  overrideProjectId: string | null,
  overrideFileId: string | null,
  overrideSegments: SegmentDto[],
): Promise<string | null> {
  return invokeStructured<string | null>("export_library_bundle", {
    defaultFilename,
    overrideProjectId,
    overrideFileId,
    overrideSegments,
  });
}

export type ImportExchangeBundleResult = {
  project: ProjectDetail;
  importedCount: number;
  failedCount: number;
  failedLabels: string[];
  lexiconWarning?: string | null;
};

export type BundleFileNameConflict = {
  id: string;
  incomingName: string;
  suggestedName: string;
  existingFileId?: string | null;
  existingProjectId?: string | null;
  existingProjectName?: string | null;
  sourceProjectLabel: string;
  sourceKey: string;
};

export type BundleFileNameResolution = {
  id: string;
  action: "overwrite" | "rename";
  renameTo?: string | null;
};

export type ExchangeBundleImportPreview = {
  zipPath: string;
  kind: string;
  conflicts: BundleFileNameConflict[];
};

function normalizeImportExchangeResult(raw: Record<string, unknown>): ImportExchangeBundleResult {
  const project = (raw.project ?? raw) as ProjectDetail;
  const importedCount =
    typeof raw.importedCount === "number"
      ? raw.importedCount
      : typeof raw.imported_count === "number"
        ? raw.imported_count
        : 1;
  const failedCount =
    typeof raw.failedCount === "number"
      ? raw.failedCount
      : typeof raw.failed_count === "number"
        ? raw.failed_count
        : 0;
  const failedLabelsRaw = raw.failedLabels ?? raw.failed_labels;
  const failedLabels = Array.isArray(failedLabelsRaw)
    ? failedLabelsRaw.filter((x): x is string => typeof x === "string")
    : [];
  const lexiconWarning =
    typeof raw.lexiconWarning === "string"
      ? raw.lexiconWarning
      : typeof raw.lexicon_warning === "string"
        ? raw.lexicon_warning
        : null;
  return {
    project,
    importedCount,
    failedCount,
    failedLabels,
    lexiconWarning,
  };
}

function stringField(raw: Record<string, unknown>, camelKey: string, snakeKey?: string): string {
  const primary = raw[camelKey];
  if (typeof primary === "string") return primary;
  const fallback = snakeKey ? raw[snakeKey] : undefined;
  if (typeof fallback === "string") return fallback;
  return "";
}

function normalizeConflict(raw: Record<string, unknown>): BundleFileNameConflict {
  return {
    id: stringField(raw, "id"),
    incomingName: stringField(raw, "incomingName", "incoming_name"),
    suggestedName: stringField(raw, "suggestedName", "suggested_name"),
    existingFileId:
      typeof raw.existingFileId === "string"
        ? raw.existingFileId
        : typeof raw.existing_file_id === "string"
          ? raw.existing_file_id
          : null,
    existingProjectId:
      typeof raw.existingProjectId === "string"
        ? raw.existingProjectId
        : typeof raw.existing_project_id === "string"
          ? raw.existing_project_id
          : null,
    existingProjectName:
      typeof raw.existingProjectName === "string"
        ? raw.existingProjectName
        : typeof raw.existing_project_name === "string"
          ? raw.existing_project_name
          : null,
    sourceProjectLabel: stringField(raw, "sourceProjectLabel", "source_project_label"),
    sourceKey: stringField(raw, "sourceKey", "source_key"),
  };
}

export async function importExchangeBundlePreview(): Promise<ExchangeBundleImportPreview | null> {
  const raw = await invokeStructured<Record<string, unknown> | null>(
    "import_exchange_bundle_preview",
  );
  if (!raw) return null;
  const conflictsRaw = raw.conflicts;
  const conflicts = Array.isArray(conflictsRaw)
    ? conflictsRaw
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .map(normalizeConflict)
    : [];
  return {
    zipPath: stringField(raw, "zipPath", "zip_path"),
    kind: stringField(raw, "kind"),
    conflicts,
  };
}

export async function importExchangeBundleApply(
  zipPath: string,
  resolutions: BundleFileNameResolution[],
): Promise<ImportExchangeBundleResult> {
  const raw = await invokeStructured<Record<string, unknown>>("import_exchange_bundle_apply", {
    zipPath,
    resolutions,
  });
  return normalizeImportExchangeResult(raw);
}

/** @deprecated Prefer preview + apply; kept for callers that expect one-shot (fails on conflicts). */
export async function importProjectBundle(): Promise<ImportExchangeBundleResult | null> {
  const raw = await invokeStructured<Record<string, unknown> | null>("import_project_bundle");
  if (!raw) return null;
  return normalizeImportExchangeResult(raw);
}

/** 系统另存为；用户取消时返回 `null`。 */
export async function exportTextFile(defaultFilename: string, content: string): Promise<string | null> {
  return invokeStructured<string | null>("export_text_file", { defaultFilename, content });
}

export type { FileDetail, ProjectDetail, ProjectSummary, SegmentDto };
