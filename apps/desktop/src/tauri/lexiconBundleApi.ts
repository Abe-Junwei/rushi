import { invoke } from "@tauri-apps/api/core";

export type LexiconBundleImportPreview = {
  insertGlossary: number;
  skipGlossary: number;
  insertRules: number;
  skipRules: number;
  autoResolvedRules: number;
  conflicts: LexiconBundleConflict[];
};

export type LexiconBundleConflict = {
  id: string;
  kind: string;
  beforeText?: string;
  localAfterText?: string;
  bundleAfterText?: string;
  term?: string;
  localAliases?: string;
  bundleAliases?: string;
  message: string;
};

export type LexiconBundleConflictResolution = {
  id: string;
  choice: "local" | "bundle" | "merge_aliases" | "skip";
};

export type LexiconBundleImportPreviewResult = {
  preview: LexiconBundleImportPreview;
  bundleJson: string;
};

export type LexiconBundleImportApplyResult = {
  insertedGlossary: number;
  skippedGlossary: number;
  insertedRules: number;
  mergedRules: number;
  replacedRules: number;
};

function readNum(raw: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function readStr(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function mapConflict(raw: Record<string, unknown>): LexiconBundleConflict {
  return {
    id: readStr(raw, "id") ?? "",
    kind: readStr(raw, "kind") ?? "",
    beforeText: readStr(raw, "beforeText", "before_text"),
    localAfterText: readStr(raw, "localAfterText", "local_after_text"),
    bundleAfterText: readStr(raw, "bundleAfterText", "bundle_after_text"),
    term: readStr(raw, "term"),
    localAliases: readStr(raw, "localAliases", "local_aliases"),
    bundleAliases: readStr(raw, "bundleAliases", "bundle_aliases"),
    message: readStr(raw, "message") ?? "",
  };
}

function mapPreview(raw: Record<string, unknown>): LexiconBundleImportPreview {
  const conflictsRaw = raw.conflicts;
  const conflicts = Array.isArray(conflictsRaw)
    ? conflictsRaw
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c != null)
        .map(mapConflict)
    : [];
  return {
    insertGlossary: readNum(raw, "insertGlossary", "insert_glossary"),
    skipGlossary: readNum(raw, "skipGlossary", "skip_glossary"),
    insertRules: readNum(raw, "insertRules", "insert_rules"),
    skipRules: readNum(raw, "skipRules", "skip_rules"),
    autoResolvedRules: readNum(raw, "autoResolvedRules", "auto_resolved_rules"),
    conflicts,
  };
}

export async function lexiconBundleExport(
  stableOnly: boolean,
  optionalLabel?: string,
): Promise<string | null> {
  return invoke<string | null>("lexicon_bundle_export", {
    stableOnly,
    optionalLabel: optionalLabel?.trim() || null,
  });
}

export async function lexiconBundleImportPreview(): Promise<LexiconBundleImportPreviewResult | null> {
  const raw = await invoke<Record<string, unknown> | null>("lexicon_bundle_import_preview");
  if (raw == null) return null;
  const previewRaw = raw.preview;
  const bundleJson = readStr(raw, "bundleJson", "bundle_json") ?? "";
  if (typeof previewRaw !== "object" || previewRaw == null) {
    throw new Error("词表包预览数据无效");
  }
  return {
    preview: mapPreview(previewRaw as Record<string, unknown>),
    bundleJson,
  };
}

export async function lexiconBundleImportApply(
  bundleJson: string,
  resolutions: LexiconBundleConflictResolution[],
): Promise<LexiconBundleImportApplyResult> {
  const raw = await invoke<Record<string, unknown>>("lexicon_bundle_import_apply", {
    bundleJson,
    resolutions,
  });
  return {
    insertedGlossary: readNum(raw, "insertedGlossary", "inserted_glossary"),
    skippedGlossary: readNum(raw, "skippedGlossary", "skipped_glossary"),
    insertedRules: readNum(raw, "insertedRules", "inserted_rules"),
    mergedRules: readNum(raw, "mergedRules", "merged_rules"),
    replacedRules: readNum(raw, "replacedRules", "replaced_rules"),
  };
}

export function formatLexiconBundlePreviewSummary(preview: LexiconBundleImportPreview): string {
  const parts = [
    `新增术语 ${preview.insertGlossary} 条`,
    `跳过术语 ${preview.skipGlossary} 条`,
    `新增规则 ${preview.insertRules} 条`,
    `跳过规则 ${preview.skipRules} 条`,
  ];
  if (preview.autoResolvedRules > 0) {
    parts.push(`自动合并规则 ${preview.autoResolvedRules} 条`);
  }
  if (preview.conflicts.length > 0) {
    parts.push(`待处理冲突 ${preview.conflicts.length} 项`);
  }
  return parts.join("；");
}
