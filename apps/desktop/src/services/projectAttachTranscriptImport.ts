import * as fileApi from "../tauri/fileApi";
import {
  countStemAttachCandidates,
  hasImportDuplicate,
  importFileDisplayName,
  pickDuplicateOpenExistingFileId,
  type ImportDuplicateCheck,
} from "../utils/projectImportDuplicate";

type DuplicateDecision = "cancel" | "open_existing" | "import_copy";

type HubDuplicateDeps = {
  projectFiles: readonly { name: string; file_type: string }[] | undefined;
  openFile: (fileId: string) => Promise<void>;
  checkDuplicate: (projectId: string, srcPath: string) => Promise<ImportDuplicateCheck>;
  askDuplicateImport: (check: ImportDuplicateCheck) => Promise<DuplicateDecision>;
};

export async function confirmHubTextDuplicateIfNeeded(
  projectId: string,
  srcPath: string,
  deps: HubDuplicateDeps,
): Promise<boolean> {
  const stem = importFileDisplayName(srcPath, "text");
  if (countStemAttachCandidates(deps.projectFiles, stem) > 0) {
    return true;
  }
  const check = await deps.checkDuplicate(projectId, srcPath);
  if (!hasImportDuplicate(check)) return true;
  const decision = await deps.askDuplicateImport(check);
  if (decision === "cancel") return false;
  if (decision === "open_existing") {
    const fileId = pickDuplicateOpenExistingFileId(check);
    if (fileId) await deps.openFile(fileId);
    return false;
  }
  return true;
}

export async function resolveTranscriptImport(
  projectId: string,
  srcPath: string,
  askAttachImportTarget: (prompt: {
    srcPath: string;
    candidates: import("../tauri/projectTypes").FileSummary[];
    transcriptStem: string;
  }) => Promise<string | null>,
  targetFileId?: string | null,
): Promise<{ ok: boolean; fileId?: string }> {
  const outcome = await fileApi.importTranscriptToProject(projectId, srcPath, targetFileId);
  switch (outcome.outcome) {
    case "attached":
    case "created_text":
      return { ok: true, fileId: outcome.file_id };
    case "need_target": {
      const picked = await askAttachImportTarget({
        srcPath,
        candidates: outcome.candidates,
        transcriptStem: outcome.transcript_stem,
      });
      if (!picked) return { ok: false };
      return resolveTranscriptImport(projectId, srcPath, askAttachImportTarget, picked);
    }
    default:
      return { ok: false };
  }
}
