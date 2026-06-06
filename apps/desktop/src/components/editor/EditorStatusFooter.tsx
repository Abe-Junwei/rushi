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
export function EditorStatusFooter({
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
}
