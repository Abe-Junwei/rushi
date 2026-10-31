const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a"]);
const TRANSCRIPT_EXTENSIONS = new Set(["txt", "srt", "vtt"]);

export type DroppedFileKind = "audio" | "transcript";

export type BatchImportResult = {
  imported: number;
  skipped: number;
  unsupported: number;
};

/** 批量导入进度（current 从 1 起）。 */
export type BatchImportProgress = {
  current: number;
  total: number;
  kind: "audio" | "text" | "file";
};

export type ImportFileToProjectFn = (
  kind: "audio" | "text",
  srcPath: string,
  options?: { skipReload?: boolean; nestInBatch?: boolean },
) => Promise<boolean>;

function getFileExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "";
  return path.slice(dot + 1).toLowerCase();
}

export function resolveDroppedFileKind(path: string): DroppedFileKind | null {
  const ext = getFileExtension(path);
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (TRANSCRIPT_EXTENSIONS.has(ext)) return "transcript";
  return null;
}

/** 批量导入路径（拖放或多选）；末尾统一 reload。 */
export async function importDroppedPathsToProject(
  importFileToProject: ImportFileToProjectFn,
  paths: string[],
  reloadProject: () => Promise<void>,
  onProgress?: (progress: BatchImportProgress) => void,
): Promise<BatchImportResult> {
  const uniquePaths = [...new Set(paths)];
  const jobs = uniquePaths
    .map((srcPath) => {
      const kind = resolveDroppedFileKind(srcPath);
      if (!kind) return null;
      return { srcPath, kind };
    })
    .filter((j): j is { srcPath: string; kind: DroppedFileKind } => j != null);

  let imported = 0;
  let skipped = uniquePaths.length - jobs.length;
  let unsupported = skipped;
  const total = jobs.length;
  const mixed = jobs.some((j) => j.kind === "audio") && jobs.some((j) => j.kind === "transcript");

  for (let i = 0; i < jobs.length; i += 1) {
    const job = jobs[i]!;
    onProgress?.({
      current: i + 1,
      total,
      kind: mixed ? "file" : job.kind === "audio" ? "audio" : "text",
    });
    const importedOk = await importFileToProject(
      job.kind === "audio" ? "audio" : "text",
      job.srcPath,
      { skipReload: true, nestInBatch: true },
    );
    if (importedOk) {
      imported += 1;
    } else {
      skipped += 1;
    }
  }

  if (imported > 0) {
    await reloadProject();
  }

  return { imported, skipped, unsupported };
}

/** 多选音频导入（系统 picker）。 */
export async function importAudioPathsToProject(
  importFileToProject: ImportFileToProjectFn,
  paths: string[],
  reloadProject: () => Promise<void>,
  onProgress?: (progress: BatchImportProgress) => void,
): Promise<Pick<BatchImportResult, "imported" | "skipped">> {
  const uniquePaths = [...new Set(paths)];
  let imported = 0;
  let skipped = 0;
  const total = uniquePaths.length;

  for (let i = 0; i < uniquePaths.length; i += 1) {
    const srcPath = uniquePaths[i]!;
    onProgress?.({ current: i + 1, total, kind: "audio" });
    const importedOk = await importFileToProject("audio", srcPath, {
      skipReload: true,
      nestInBatch: true,
    });
    if (importedOk) {
      imported += 1;
    } else {
      skipped += 1;
    }
  }

  if (imported > 0) {
    await reloadProject();
  }

  return { imported, skipped };
}
