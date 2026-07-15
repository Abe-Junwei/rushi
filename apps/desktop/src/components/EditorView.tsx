import { useEffect } from "react";
import { useTranscriptFooterStats } from "../hooks/useTranscriptFooterStats";
import { clearToastBottomInset, syncToastBottomInset } from "../services/ui/toastLayout";
import { resolveLegacyWaveformFallbackFile } from "../utils/legacyWaveformFallback";
import { SegmentContextMenu } from "./SegmentContextMenu";
import { useTranscriptionLayer } from "../pages/useTranscriptionLayer";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { SegmentContextMenuOpen } from "../utils/segmentContextMenuModel";
import { clampTranscriptFontPx } from "../utils/waveformPrefs";
import { SegmentCorrectPopover } from "./segmentRow/SegmentCorrectPopover";
import { RestoreEditLogConfirmDialog } from "./editor/RestoreEditLogConfirmDialog";
import { DeleteSegmentConfirmDialog } from "./editor/DeleteSegmentConfirmDialog";
import { useEditorEditHistory } from "./editor/useEditorEditHistory";
import { useEditorTranscriptAppearance } from "./editor/useEditorTranscriptAppearance";
import { useEditorFooterShortcutHintRotation } from "../hooks/useEditorFooterShortcutHintRotation";
import { useSegmentListFilter } from "../hooks/useSegmentListFilter";
import { useEditorViewContextMenu } from "./editor/useEditorViewContextMenu";
import { EditorViewLayout } from "./editor/EditorViewLayout";

interface EditorViewProps {
  controller: ProjectControllerApi;
  txInput: TranscriptionLayerInput;
  exportKey: string;
  onExportSelect: (key: string) => void;
  onOpenEnvironment: () => void;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
  segmentCtxMenu: SegmentContextMenuOpen | null;
  setSegmentCtxMenu: (v: SegmentContextMenuOpen | null) => void;
}

export function EditorView({
  controller: c,
  txInput,
  exportKey,
  onExportSelect,
  onOpenEnvironment,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
  segmentCtxMenu,
  setSegmentCtxMenu,
}: EditorViewProps) {
  const tx = useTranscriptionLayer(txInput);
  const appearance = useEditorTranscriptAppearance(c.busy, Boolean(c.currentFileId));
  const transcriptFontPx = clampTranscriptFontPx(tx.transcriptFontPx);

  const { segmentCtxMenuItemsForRender, onSegmentCtxMenuSelect } = useEditorViewContextMenu({
    controller: c,
    tx,
    segmentCtxMenu,
    appearance,
    transcriptFontPx,
  });

  const transcriptStats = useTranscriptFooterStats(c.segments);
  const editHistory = useEditorEditHistory({
    projectId: c.current?.id,
    fileId: c.currentFileId ?? undefined,
    projectBusy: c.busy,
    onRestoreVersion: c.restoreEditorFromEditLog,
  });

  const projectName = c.current?.name ?? "未命名项目";
  const projectFiles = c.current?.files ?? [];
  const hasProjectFiles = projectFiles.length > 0;
  const currentFileName = c.currentFileId
    ? (c.current?.files.find((f) => f.id === c.currentFileId)?.name ?? "未命名文件")
    : hasProjectFiles
      ? "选择文件"
      : "未选择文件";
  const fallbackWaveFile = resolveLegacyWaveformFallbackFile(
    c.currentFileId,
    projectFiles,
    Boolean(c.audioSrc),
  );

  useEffect(() => {
    syncToastBottomInset(Boolean(c.currentFileId));
    return () => clearToastBottomInset();
  }, [c.currentFileId]);

  // Waveform load/generate status outranks transient editor hints and shortcut rotation.
  const statusCenterLabel = tx.waveformFooterStatusLabel || tx.editorHint || "";
  const shortcutHint = useEditorFooterShortcutHintRotation(
    Boolean(c.currentFileId) && !statusCenterLabel,
  );
  const footerCenterLabel = statusCenterLabel || shortcutHint;
  const footerCenterHintKind = statusCenterLabel ? "status" : shortcutHint ? "shortcut" : "none";
  const segmentFilter = useSegmentListFilter(c.currentFileId, c.segments);

  const editorDialogs = (
    <>
      {segmentCtxMenu ? (
        <SegmentContextMenu
          x={segmentCtxMenu.x}
          y={segmentCtxMenu.y}
          items={segmentCtxMenuItemsForRender}
          onSelect={onSegmentCtxMenuSelect}
          onClose={() => setSegmentCtxMenu(null)}
        />
      ) : null}
      <SegmentCorrectPopover
        state={c.editorCorrectPopover}
        suggestions={c.editorCorrectPopoverSuggestions}
        onClose={c.closeEditorCorrectPopover}
        onApply={c.applyEditorInlineCorrection}
      />
      <RestoreEditLogConfirmDialog
        open={editHistory.restoreTarget != null}
        busy={editHistory.restoreBusy}
        row={editHistory.restoreTarget}
        onCancel={editHistory.cancelRestore}
        onConfirm={() => void editHistory.confirmRestore()}
      />
      <DeleteSegmentConfirmDialog
        open={c.segmentDeleteConfirmOpen}
        deleteCount={c.pendingDeleteCount}
        onCancel={c.cancelDeleteSegment}
        onConfirm={c.confirmDeleteSegment}
      />
    </>
  );

  if (!c.currentFileId) {
    return null;
  }

  return (
    <EditorViewLayout
      controller={c}
      tx={tx}
      exportKey={exportKey}
      onExportSelect={onExportSelect}
      onOpenEnvironment={onOpenEnvironment}
      onOpenAsrSettings={onOpenAsrSettings}
      onOpenOnlineSttSettings={onOpenOnlineSttSettings}
      onOpenLlmSettings={onOpenLlmSettings}
      llmStatusRefreshSeq={llmStatusRefreshSeq}
      projectName={projectName}
      currentFileName={currentFileName}
      fallbackWaveFile={fallbackWaveFile}
      appearance={appearance}
      segmentFilter={segmentFilter}
      editHistory={editHistory}
      footerCenterLabel={footerCenterLabel}
      footerCenterHintKind={footerCenterHintKind}
      transcriptStats={transcriptStats}
      editorDialogs={editorDialogs}
      onOpenSegmentAnnotationDialog={c.openSegmentAnnotationDialog}
    />
  );
}
