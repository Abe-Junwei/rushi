import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_SELECT, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type {
  BundleFileNameConflict,
  BundleFileNameResolution,
  ExchangeBundleImportPreview,
} from "../tauri/projectCrudApi";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelDialogHeader, FloatingPanelDialogScroll } from "./FloatingPanelDialogLayout";

const PANEL_ID = "bundle-import-name-conflict";
const FALLBACK_HEIGHT = 380;

export type BundleConflictDraft = {
  action: BundleFileNameResolution["action"];
  renameTo: string;
};

type Props = {
  pending: ExchangeBundleImportPreview;
  drafts: Record<string, BundleConflictDraft>;
  disabled: boolean;
  onDraftChange: (id: string, draft: BundleConflictDraft) => void;
  onApplyAllOverwrite: () => void;
  onApplyAllRename: () => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function occupantLine(c: BundleFileNameConflict): string {
  if (c.existingProjectName && c.existingFileId) {
    return `占用：${c.existingProjectName} · ${c.incomingName}`;
  }
  return "包内多项同名，须重命名以区分";
}

export function BundleImportNameConflictDialog({
  pending,
  drafts,
  disabled,
  onDraftChange,
  onApplyAllOverwrite,
  onApplyAllRename,
  onCancel,
  onConfirm,
}: Props) {
  const allResolved = pending.conflicts.every((c) => {
    const d = drafts[c.id];
    if (!d) return false;
    if (d.action === "overwrite") return Boolean(c.existingFileId);
    return d.renameTo.trim().length > 0;
  });
  const canOverwriteAny = pending.conflicts.some((c) => Boolean(c.existingFileId));

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="内容包文件名冲突"
      open
      onClose={() => {
        if (!disabled) onCancel();
      }}
      fallbackHeight={FALLBACK_HEIGHT}
      fitKind="fill"
      defaultWidth={520}
      bounds={{ minWidth: 400, minHeight: 280, maxWidthCap: 560, maxHeightCap: 640 }}
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={disabled} onClick={onCancel}>
            取消导入
          </button>
          <button
            type="button"
            className={CONTROL_BTN_PRIMARY}
            disabled={disabled || !allResolved}
            onClick={onConfirm}
          >
            确认导入
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogHeader>
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
          {pending.conflicts.length} 个文件名与库内或包内冲突。请为每项选择覆盖现有或重命名导入项。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={disabled || !canOverwriteAny}
            onClick={onApplyAllOverwrite}
          >
            全部覆盖
          </button>
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={disabled}
            onClick={onApplyAllRename}
          >
            全部按建议重命名
          </button>
        </div>
      </FloatingPanelDialogHeader>
      <FloatingPanelDialogScroll>
        <ul className="m-0 list-none space-y-3 p-0">
          {pending.conflicts.map((c) => {
            const draft = drafts[c.id] ?? {
              action: c.existingFileId ? ("overwrite" as const) : ("rename" as const),
              renameTo: c.suggestedName,
            };
            return (
              <li key={c.id} className="flex flex-col gap-2 rounded-md bg-notion-callout-bg px-3 py-2">
                <p className={`m-0 ${PANEL_TYPOGRAPHY.dialogText}`}>
                  「{c.incomingName}」
                  {c.sourceProjectLabel ? (
                    <span className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
                      {" "}
                      · 来自 {c.sourceProjectLabel}
                    </span>
                  ) : null}
                </p>
                <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
                  {occupantLine(c)}
                </p>
                <label className="block">
                  <span className={`mb-1 block ${PANEL_TYPOGRAPHY.fieldLabel}`}>处理方式</span>
                  <select
                    className={CONTROL_SELECT}
                    disabled={disabled}
                    value={draft.action}
                    aria-label={`冲突处理方式：${c.incomingName}`}
                    onChange={(e) => {
                      const action = e.target.value as BundleConflictDraft["action"];
                      onDraftChange(c.id, {
                        action,
                        renameTo: draft.renameTo || c.suggestedName,
                      });
                    }}
                  >
                    {c.existingFileId ? <option value="overwrite">覆盖现有</option> : null}
                    <option value="rename">重命名导入项</option>
                  </select>
                </label>
                {draft.action === "rename" ? (
                  <label className="block">
                    <span className={`mb-1 block ${PANEL_TYPOGRAPHY.fieldLabel}`}>新名称</span>
                    <input
                      type="text"
                      className={`${CONTROL_TEXT_INPUT} ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
                      disabled={disabled}
                      value={draft.renameTo}
                      aria-label={`重命名：${c.incomingName}`}
                      onChange={(e) =>
                        onDraftChange(c.id, { action: "rename", renameTo: e.target.value })
                      }
                    />
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
      </FloatingPanelDialogScroll>
    </CompactFloatingDialog>
  );
}

export function draftsFromPreview(
  preview: ExchangeBundleImportPreview,
): Record<string, BundleConflictDraft> {
  const out: Record<string, BundleConflictDraft> = {};
  for (const c of preview.conflicts) {
    out[c.id] = {
      action: c.existingFileId ? "overwrite" : "rename",
      renameTo: c.suggestedName,
    };
  }
  return out;
}

export function resolutionsFromDrafts(
  preview: ExchangeBundleImportPreview,
  drafts: Record<string, BundleConflictDraft>,
): BundleFileNameResolution[] {
  return preview.conflicts.map((c) => {
    const d = drafts[c.id];
    const action = d?.action ?? (c.existingFileId ? "overwrite" : "rename");
    return {
      id: c.id,
      action,
      renameTo: action === "rename" ? (d?.renameTo ?? c.suggestedName).trim() : null,
    };
  });
}
