import { invoke } from "@tauri-apps/api/core";
import type {
  FileDetail,
  FileSummary,
  ProjectDetail,
  RawProjectDetail,
  SegmentDto,
} from "./projectTypes";
import type { ImportDuplicateCheck } from "../utils/projectImportDuplicate";

export type { FileDetail, FileSummary, RawProjectDetail, SegmentDto } from "./projectTypes";

export async function createEmptyProject(name: string): Promise<RawProjectDetail> {
  return invoke<RawProjectDetail>("create_empty_project", { name });
}

export async function pickAudioPath(): Promise<string | null> {
  return invoke<string | null>("pick_audio_path");
}

export async function pickAudioPaths(): Promise<string[]> {
  return invoke<string[]>("pick_audio_paths");
}

export async function createProjectFromAudio(
  name: string,
  srcPath: string,
): Promise<RawProjectDetail> {
  return invoke<RawProjectDetail>("project_create_from_audio", { name, srcPath });
}

export async function createEmptyTextFile(
  projectId: string,
  name: string,
): Promise<RawProjectDetail> {
  return invoke<RawProjectDetail>("create_empty_text_file", { projectId, name });
}

export async function importAudioToProject(
  projectId: string,
  name: string,
  srcPath: string,
): Promise<RawProjectDetail> {
  return invoke<RawProjectDetail>("import_audio_to_project", { projectId, name, srcPath });
}

export async function importTextToProject(
  projectId: string,
  name: string,
  srcPath: string,
): Promise<RawProjectDetail> {
  return invoke<RawProjectDetail>("import_text_to_project", { projectId, name, srcPath });
}

export async function checkProjectImportDuplicate(
  projectId: string,
  srcPath: string,
): Promise<ImportDuplicateCheck> {
  return invoke<ImportDuplicateCheck>("check_project_import_duplicate", { projectId, srcPath });
}

export async function pickTextPath(): Promise<string | null> {
  return invoke<string | null>("pick_text_path");
}

export async function createProjectFromText(
  name: string,
  srcPath: string,
): Promise<RawProjectDetail> {
  return invoke<RawProjectDetail>("create_project_from_text", { name, srcPath });
}

export async function listFiles(projectId: string): Promise<FileSummary[]> {
  return invoke<FileSummary[]>("list_files", { projectId });
}

export async function loadFile(fileId: string): Promise<FileDetail> {
  return invoke<FileDetail>("load_file", { fileId });
}

export async function renameFile(fileId: string, name: string): Promise<void> {
  return invoke<void>("rename_file", { fileId, name });
}

export async function deleteFile(fileId: string): Promise<void> {
  return invoke<void>("delete_file", { fileId });
}

export type CorrectionExplicitPair = { beforeText: string; afterText: string };

export type LearnBaselineText = { uid: string; text: string };

export type FileSaveSegmentsOptions = {
  /** When false, skip diff-based hit learning on save (explicit_pairs still apply). Default true. */
  countHits?: boolean;
  explicitPairs?: CorrectionExplicitPair[];
  /** Pre-save snapshot texts by uid; required when auto-save already persisted edits. */
  learnBaselineTexts?: LearnBaselineText[];
};

export async function fileSaveSegments(
  fileId: string,
  segments: SegmentDto[],
  options?: FileSaveSegmentsOptions,
): Promise<void> {
  return invoke<void>("file_save_segments", {
    fileId,
    segments,
    countHits: options?.countHits ?? true,
    explicitPairs: options?.explicitPairs ?? [],
    learnBaselineTexts: options?.learnBaselineTexts ?? [],
  });
}

/** 将新格式 ProjectDetail 适配为旧格式（含 audio_storage_path + segments + files）。
 *  如果项目有文件，取第一个文件的音频路径和语段；否则返回空。 */
export async function adaptToLegacyProjectDetail(
  detail: RawProjectDetail,
): Promise<ProjectDetail> {
  if (detail.files.length > 0) {
    const firstFile = detail.files[0];
    const fileDetail = await loadFile(firstFile.id);
    return {
      id: detail.id,
      name: detail.name,
      audio_storage_path: fileDetail.audio_path ?? "",
      created_at_ms: detail.created_at_ms,
      updated_at_ms: detail.updated_at_ms,
      segments: fileDetail.segments,
      files: detail.files,
      narrator: detail.narrator,
      recorded_at: detail.recorded_at,
      location: detail.location,
      subject: detail.subject,
      transcriber: detail.transcriber,
    };
  }
  return {
    id: detail.id,
    name: detail.name,
    audio_storage_path: "",
    created_at_ms: detail.created_at_ms,
    updated_at_ms: detail.updated_at_ms,
    segments: [],
    files: detail.files,
    narrator: detail.narrator,
    recorded_at: detail.recorded_at,
    location: detail.location,
    subject: detail.subject,
    transcriber: detail.transcriber,
  };
}
