import { memo } from "react";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import { autoSaveFooterLabel } from "../../pages/useAutoSaveSegments";
import { EditorFooterHistoryActions } from "./EditorFooterHistoryActions";
import type { useEditorEditHistory } from "./useEditorEditHistory";

type EditHistoryApi = ReturnType<typeof useEditorEditHistory>;

export interface EditorStatusFooterProps {
  controller: ProjectControllerApi;
  editHistory: EditHistoryApi;
  centerLabel: string;
  centerHintKind?: "status" | "shortcut" | "none";
  showCenterLabel: boolean;
  segmentCount: number;
  charCount: number;
}

/** 编辑器底栏：撤销/自动保存 · 居中 hint · 语段/字数统计（三列 grid，窄窗不叠字）。 */
export const EditorStatusFooter = memo(function EditorStatusFooter({
  controller: c,
  editHistory,
  centerLabel,
  centerHintKind = "none",
  showCenterLabel,
  segmentCount,
  charCount,
}: EditorStatusFooterProps) {
  const autoSaveLabel = autoSaveFooterLabel(c.autoSaveFooterStatus);

  return (
    <footer className="editor-status-footer">
      <div className="editor-status-footer-start">
        <EditorFooterHistoryActions controller={c} editHistory={editHistory} />
        {autoSaveLabel ? (
          <span className="editor-status-footer-autosave" title={autoSaveLabel}>
            {autoSaveLabel}
          </span>
        ) : null}
      </div>

      <div className="editor-status-footer-center" aria-live="polite">
        {showCenterLabel && centerLabel ? (
          <span
            className={`editor-status-footer-hint${
              centerHintKind === "shortcut" ? " editor-status-footer-hint--shortcut" : ""
            }`}
            title={centerLabel}
          >
            {centerLabel}
          </span>
        ) : null}
      </div>

      <div className="editor-status-footer-end tabular-nums">
        <span className="editor-status-footer-stats">
          {segmentCount} 条语段
          <span className="editor-status-footer-stats-sep" aria-hidden>
            ·
          </span>
          {charCount.toLocaleString("zh-CN")} 字
        </span>
      </div>
    </footer>
  );
}, areEditorStatusFooterPropsEqual);

function areEditorStatusFooterPropsEqual(
  prev: EditorStatusFooterProps,
  next: EditorStatusFooterProps,
): boolean {
  if (prev.centerLabel !== next.centerLabel) return false;
  if (prev.centerHintKind !== next.centerHintKind) return false;
  if (prev.showCenterLabel !== next.showCenterLabel) return false;
  if (prev.segmentCount !== next.segmentCount) return false;
  if (prev.charCount !== next.charCount) return false;
  if (prev.controller.busy !== next.controller.busy) return false;
  if (prev.controller.autoSaveFooterStatus !== next.controller.autoSaveFooterStatus) return false;
  if (prev.controller.undo !== next.controller.undo) return false;
  if (prev.controller.redo !== next.controller.redo) return false;
  if (prev.editHistory.historyOpen !== next.editHistory.historyOpen) return false;
  if (prev.editHistory.historyDisabled !== next.editHistory.historyDisabled) return false;
  if (prev.editHistory.historyBusy !== next.editHistory.historyBusy) return false;
  if (prev.editHistory.historyError !== next.editHistory.historyError) return false;
  if (prev.editHistory.historyRows !== next.editHistory.historyRows) return false;
  if (prev.editHistory.restoreBusy !== next.editHistory.restoreBusy) return false;
  return true;
}
