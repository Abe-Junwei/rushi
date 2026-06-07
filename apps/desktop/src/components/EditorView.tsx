import { useEffect, useMemo, useCallback } from "react";
import { useTranscriptFooterStats } from "../hooks/useTranscriptFooterStats";
import { clearToastBottomInset, syncToastBottomInset } from "../services/ui/toastLayout";
import { EditorToolbar } from "./EditorToolbar";
import { LlmTopStatusChip } from "./LlmTopStatusChip";
import { SegmentContextMenu } from "./SegmentContextMenu";
import { EditorWorkspaceNav } from "./EditorWorkspaceNav";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import { EmptyProjectPanel } from "./EmptyProjectPanel";
import { ProjectFilesHubPanel } from "./ProjectFilesHubPanel";
import {
  type SegmentContextMenuKey,
  type SegmentContextMenuOpen,
} from "../utils/segmentContextMenuModel";
import {
  clampTranscriptFontPx,
  TRANSCRIPT_FONT_MAX,
  TRANSCRIPT_FONT_MIN,
} from "../utils/waveformPrefs";
import {
  buildSegmentRowContextMenuItems,
  isSegmentTextContextMenuKey,
  parseFontFamilyFromContextMenuKey,
  type SegmentTextContextMenuKey,
} from "../utils/segmentTextContextMenuModel";
import { EditorStatusFooter } from "./editor/EditorStatusFooter";
import { EditorSegmentWorkbench } from "./editor/EditorSegmentWorkbench";
import { SegmentCorrectPopover } from "./segmentRow/SegmentCorrectPopover";
import { EditorWaveformPane } from "./editor/EditorWaveformPane";
import { EditorWorkbenchToolbar } from "./editor/EditorWorkbenchToolbar";
import { RestoreEditLogConfirmDialog } from "./editor/RestoreEditLogConfirmDialog";
import { DeleteSegmentConfirmDialog } from "./editor/DeleteSegmentConfirmDialog";
import { useEditorEditHistory } from "./editor/useEditorEditHistory";
import { useEditorTranscriptAppearance } from "./editor/useEditorTranscriptAppearance";
import { useEditorFooterShortcutHintRotation } from "../hooks/useEditorFooterShortcutHintRotation";

interface EditorViewProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  onOpenEnvironment: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
  segmentCtxMenu: SegmentContextMenuOpen | null;
  setSegmentCtxMenu: (v: SegmentContextMenuOpen | null) => void;
}

export function EditorView({
  controller: c,
  tx,
  exportKey,
  onExportSelect,
  onOpenEnvironment,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
  segmentCtxMenu,
  setSegmentCtxMenu,
}: EditorViewProps) {
  const appearance = useEditorTranscriptAppearance(c.busy, Boolean(c.currentFileId));
  const transcriptFontPx = clampTranscriptFontPx(tx.transcriptFontPx);
  const segmentCtxMenuItems = useMemo(
    () =>
      segmentCtxMenu
        ? buildSegmentRowContextMenuItems({
            segmentIdx: segmentCtxMenu.segmentIdx,
            segments: c.segments,
            busy: c.busy,
            pointerTimeSec: segmentCtxMenu.pointerTimeSec,
            origin: segmentCtxMenu.origin,
            selectionText: segmentCtxMenu.selectionText,
            appearance: {
              appearanceDisabled: appearance.transcriptFontControlDisabled,
              transcriptFontFamily: appearance.transcriptFontFamily,
              transcriptFontWeight: appearance.transcriptFontWeight,
              transcriptFontItalic: appearance.transcriptFontItalic,
              transcriptFontPx,
              fontSizeAtMin: transcriptFontPx <= TRANSCRIPT_FONT_MIN,
              fontSizeAtMax: transcriptFontPx >= TRANSCRIPT_FONT_MAX,
              fontOptions: appearance.fontOptions,
            },
          })
        : [],
    [
      segmentCtxMenu,
      c.segments,
      c.busy,
      appearance.transcriptFontControlDisabled,
      appearance.transcriptFontFamily,
      appearance.transcriptFontWeight,
      appearance.transcriptFontItalic,
      appearance.fontOptions,
      transcriptFontPx,
    ],
  );

  const onSegmentCtxMenuSelect = useCallback(
    (key: string) => {
      if (!segmentCtxMenu) return;

      if (isSegmentTextContextMenuKey(key)) {
        const actionKey: SegmentTextContextMenuKey = key;
        if (actionKey === "addCorrectionMemory") {
          c.openManualCorrectionMemoryDialog(segmentCtxMenu.selectionText);
          return;
        }
        if (actionKey === "toggleBold") {
          appearance.setTranscriptFontWeight((weight) => (weight >= 700 ? 500 : 700));
          return;
        }
        if (actionKey === "toggleItalic") {
          appearance.setTranscriptFontItalic((italic) => !italic);
          return;
        }
        if (actionKey === "fontSizeDecrease") {
          tx.nudgeTranscriptFontPx(-1);
          return;
        }
        if (actionKey === "fontSizeIncrease") {
          tx.nudgeTranscriptFontPx(1);
          return;
        }
        if (actionKey.startsWith("font:")) {
          const family = parseFontFamilyFromContextMenuKey(actionKey);
          if (family && family !== "__empty") {
            appearance.setTranscriptFontFamily(appearance.normalizeFontFamily(family));
          }
        }
        return;
      }

      const segmentKey = key as SegmentContextMenuKey;
      const i = segmentCtxMenu.segmentIdx;
      switch (segmentKey) {
        case "delete":
          tx.deleteSegmentAt(i);
          break;
        case "mergePrev":
          c.mergeWithPrevAt(i);
          break;
        case "mergeNext":
          c.mergeWithNextAt(i);
          break;
        case "splitAtPointer":
          tx.splitAtPlayhead(segmentCtxMenu.pointerTimeSec);
          break;
        case "markFinalized":
          void c.markSegmentFinalized(i);
          break;
        default:
          break;
      }
    },
    [appearance, c, segmentCtxMenu, tx],
  );
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
  const fallbackWaveFile =
    c.current?.files.find((f) => f.id !== c.currentFileId && f.file_type !== "text") ??
    c.current?.files.find((f) => f.id !== c.currentFileId) ??
    null;

  useEffect(() => {
    syncToastBottomInset(Boolean(c.currentFileId));
    return () => clearToastBottomInset();
  }, [c.currentFileId]);

  const statusCenterLabel = tx.editorHint || tx.waveformFooterStatusLabel || "";
  const shortcutHint = useEditorFooterShortcutHintRotation(
    Boolean(c.currentFileId) && !statusCenterLabel,
  );
  const footerCenterLabel = statusCenterLabel || shortcutHint;
  const footerCenterHintKind = statusCenterLabel ? "status" : shortcutHint ? "shortcut" : "none";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-notion-bg" data-purpose="editor-workspace">
      {!c.currentFileId ? (
        <div className="relative flex h-12 shrink-0 items-center justify-between gap-3 border-b border-notion-divider bg-notion-bg px-4 lg:px-10">
          <EditorWorkspaceNav
            projectName={projectName}
            currentLabel={currentFileName}
            fileOpen={false}
            onBack={() => c.closeProject()}
            disabled={c.busy}
          />

          <div className="flex items-center gap-2">
            {onOpenLlmSettings ? (
              <LlmTopStatusChip
                refreshSeq={llmStatusRefreshSeq}
                onOpenLlmSettings={onOpenLlmSettings}
                disabled={c.busy}
              />
            ) : null}
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-notion-border bg-notion-bg px-2.5 text-[12px] text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
              onClick={onOpenEnvironment}
            >
              环境与 ASR
            </button>
          </div>
        </div>
      ) : null}

      {c.currentFileId ? (
        <>
          <EditorToolbar
            controller={c}
            exportKey={exportKey}
            onExportSelect={onExportSelect}
            projectName={projectName}
            currentFileName={currentFileName}
            onOpenEnvironment={onOpenEnvironment}
            onOpenLlmSettings={onOpenLlmSettings}
            llmStatusRefreshSeq={llmStatusRefreshSeq}
            />

          <main className="flex h-0 min-h-0 min-w-0 flex-1 flex-col gap-0 bg-notion-bg pb-6">
            {c.audioSrc ? (
              <EditorWaveformPane
                controller={c}
                tx={tx}
              />
            ) : (
              <div className="shrink-0 px-4 py-6 text-center text-sm text-zen-stone">
                <p>当前文件不包含音频轨道，因此无法显示波形。</p>
                {fallbackWaveFile ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex h-8 items-center justify-center rounded-md border border-notion-border bg-notion-bg px-3 text-[11px] text-notion-text transition-colors hover:bg-notion-sidebar-hover"
                    disabled={c.busy}
                    onClick={() => void c.openFile(fallbackWaveFile.id)}
                  >
                    切换到可显示波形的文件
                  </button>
                ) : (
                  <p className="mt-2 text-xs text-notion-text-muted">当前项目暂无可显示波形的文件。</p>
                )}
              </div>
            )}

            <EditorWorkbenchToolbar controller={c} tx={tx} hasAudio={Boolean(c.audioSrc)} />

            <EditorSegmentWorkbench
              controller={c}
              tx={tx}
              appearance={appearance}
              onOpenSegmentContextMenu={setSegmentCtxMenu}
            />
          </main>

          {c.currentFileId ? (
            <EditorStatusFooter
              controller={c}
              editHistory={editHistory}
              centerLabel={footerCenterLabel}
              centerHintKind={footerCenterHintKind}
              showCenterLabel={Boolean(c.currentFileId && footerCenterLabel)}
              segmentCount={transcriptStats.segmentCount}
              charCount={transcriptStats.charCount}
            />
          ) : null}
        </>
      ) : hasProjectFiles ? (
        <ProjectFilesHubPanel controller={c} />
      ) : (
        <EmptyProjectPanel controller={c} />
      )}
      {segmentCtxMenu ? (
        <SegmentContextMenu
          x={segmentCtxMenu.x}
          y={segmentCtxMenu.y}
          items={segmentCtxMenuItems}
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
        onCancel={c.cancelDeleteSegment}
        onConfirm={c.confirmDeleteSegment}
      />
    </div>
  );
}
