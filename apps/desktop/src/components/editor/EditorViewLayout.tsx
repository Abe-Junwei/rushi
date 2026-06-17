import type { ReactNode } from "react";
import { CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { EditorToolbar } from "../EditorToolbar";
import { EditorStatusFooter } from "./EditorStatusFooter";
import { EditorSegmentWorkbench } from "./EditorSegmentWorkbench";
import { EditorWaveformPane } from "./EditorWaveformPane";
import { EditorWorkbenchToolbar } from "./EditorWorkbenchToolbar";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import type { useEditorEditHistory } from "./useEditorEditHistory";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";
import type { useSegmentListFilter } from "../../hooks/useSegmentListFilter";

type EditHistory = ReturnType<typeof useEditorEditHistory>;
type TranscriptAppearance = ReturnType<typeof useEditorTranscriptAppearance>;
type SegmentFilter = ReturnType<typeof useSegmentListFilter>;

export type EditorViewLayoutProps = {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  onOpenEnvironment: () => void;
  onOpenAsrSettings?: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
  projectName: string;
  currentFileName: string;
  fallbackWaveFile: { id: string } | null;
  appearance: TranscriptAppearance;
  segmentFilter: SegmentFilter;
  editHistory: EditHistory;
  footerCenterLabel: string;
  footerCenterHintKind: "status" | "shortcut" | "none";
  transcriptStats: { segmentCount: number; charCount: number };
  onOpenSegmentContextMenu: (menu: import("../../utils/segmentContextMenuModel").SegmentContextMenuOpen) => void;
  editorDialogs: ReactNode;
};

export function EditorViewLayout({
  controller: c,
  tx,
  exportKey,
  onExportSelect,
  onOpenEnvironment,
  onOpenAsrSettings,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
  projectName,
  currentFileName,
  fallbackWaveFile,
  appearance,
  segmentFilter,
  editHistory,
  footerCenterLabel,
  footerCenterHintKind,
  transcriptStats,
  onOpenSegmentContextMenu,
  editorDialogs,
}: EditorViewLayoutProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-notion-bg" data-purpose="editor-workspace">
      <EditorToolbar
        controller={c}
        exportKey={exportKey}
        onExportSelect={onExportSelect}
        projectName={projectName}
        currentFileName={currentFileName}
        onOpenEnvironment={onOpenEnvironment}
        onOpenAsrSettings={onOpenAsrSettings}
        onOpenLlmSettings={onOpenLlmSettings}
        llmStatusRefreshSeq={llmStatusRefreshSeq}
      />

      <main className="flex h-0 min-h-0 min-w-0 flex-1 flex-col gap-0 bg-notion-bg pb-6">
        {c.audioSrc ? (
          <EditorWaveformPane controller={c} tx={tx} />
        ) : (
          <div className="shrink-0 px-4 py-6 text-center text-sm text-zen-stone">
            <p>当前文件不包含音频轨道，因此无法显示波形。</p>
            {fallbackWaveFile ? (
              <button
                type="button"
                className={`mt-2 ${CONTROL_BTN_SECONDARY} text-[11px]`}
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

        <EditorWorkbenchToolbar
          controller={c}
          tx={tx}
          hasAudio={Boolean(c.audioSrc)}
          segmentFilter={segmentFilter}
        />

        <EditorSegmentWorkbench
          controller={c}
          tx={tx}
          appearance={appearance}
          filteredIndices={segmentFilter.filteredIndices}
          filterActive={segmentFilter.isActive}
          onOpenSegmentContextMenu={onOpenSegmentContextMenu}
        />
      </main>

      <EditorStatusFooter
        controller={c}
        editHistory={editHistory}
        centerLabel={footerCenterLabel}
        centerHintKind={footerCenterHintKind}
        showCenterLabel={Boolean(footerCenterLabel)}
        segmentCount={transcriptStats.segmentCount}
        charCount={transcriptStats.charCount}
      />
      {editorDialogs}
    </div>
  );
}
