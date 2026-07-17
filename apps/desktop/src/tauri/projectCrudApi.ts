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

export async function importProjectBundle(): Promise<ProjectDetail | null> {
  return invokeStructured<ProjectDetail | null>("import_project_bundle");
}

/** 系统另存为；用户取消时返回 `null`。 */
export async function exportTextFile(defaultFilename: string, content: string): Promise<string | null> {
  return invokeStructured<string | null>("export_text_file", { defaultFilename, content });
}

export type { FileDetail, ProjectDetail, ProjectSummary, SegmentDto };
