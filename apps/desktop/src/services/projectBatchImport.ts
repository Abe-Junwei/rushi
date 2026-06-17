const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a"]);
const TRANSCRIPT_EXTENSIONS = new Set(["txt", "srt", "vtt"]);

export type DroppedFileKind = "audio" | "transcript";

export type BatchImportResult = {
  imported: number;
  skipped: number;
  unsupported: number;
};

export type ImportFileToProjectFn = (
  kind: "audio" | "text",
  srcPath: string,
  options?: { skipReload?: boolean },
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
): Promise<BatchImportResult> {
  const uniquePaths = [...new Set(paths)];
  let imported = 0;
  let skipped = 0;
  let unsupported = 0;

  for (const srcPath of uniquePaths) {
    const kind = resolveDroppedFileKind(srcPath);
    if (!kind) {
      skipped += 1;
      unsupported += 1;
      continue;
    }

    const importedOk = await importFileToProject(
      kind === "audio" ? "audio" : "text",
      srcPath,
      { skipReload: true },
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
): Promise<Pick<BatchImportResult, "imported" | "skipped">> {
  const uniquePaths = [...new Set(paths)];
  let imported = 0;
  let skipped = 0;

  for (const srcPath of uniquePaths) {
    const importedOk = await importFileToProject("audio", srcPath, { skipReload: true });
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
