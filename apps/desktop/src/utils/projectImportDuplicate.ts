export type ImportDuplicateFileMatch = {
  fileId: string;
  fileName: string;
};

export type ImportDuplicateCheck = {
  bySourcePath: ImportDuplicateFileMatch[];
  byContentHash: ImportDuplicateFileMatch[];
};

export function importFileDisplayName(srcPath: string, kind: "audio" | "text"): string {
  const fallback = kind === "audio" ? "未命名音频" : "未命名文本";
  return srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || fallback;
}

export function formatDuplicateFileNames(matches: Pick<ImportDuplicateFileMatch, "fileName">[]): string {
  const names = [...new Set(matches.map((m) => m.fileName))];
  if (names.length === 0) return "";
  if (names.length <= 3) {
    return names.map((name) => `「${name}」`).join("、");
  }
  return `「${names.slice(0, 3).join("」「")}」等 ${names.length} 个文件`;
}

export function buildDuplicateImportConfirmBody(check: ImportDuplicateCheck): string {
  const parts: string[] = [];
  if (check.bySourcePath.length > 0) {
    parts.push(
      `该文件路径已在当前项目中导入过（${formatDuplicateFileNames(check.bySourcePath)}）。`,
    );
  }
  if (check.byContentHash.length > 0) {
    parts.push(
      `检测到与所选文件内容相同的已有文件（${formatDuplicateFileNames(check.byContentHash)}）。`,
    );
  }
  parts.push("再次导入将创建新副本，不会覆盖已有语段或音频。");
  return parts.join("");
}

export function hasImportDuplicate(check: ImportDuplicateCheck): boolean {
  return check.bySourcePath.length > 0 || check.byContentHash.length > 0;
}

export function pickDuplicateOpenExistingFileId(check: ImportDuplicateCheck): string | null {
  if (check.bySourcePath.length > 0) return check.bySourcePath[0].fileId;
  if (check.byContentHash.length > 0) return check.byContentHash[0].fileId;
  return null;
}

export function canOpenExistingDuplicate(check: ImportDuplicateCheck): boolean {
  return pickDuplicateOpenExistingFileId(check) != null;
}
