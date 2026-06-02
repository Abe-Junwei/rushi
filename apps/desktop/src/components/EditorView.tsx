import { useState } from "react";
import { EditorToolbar } from "./EditorToolbar";
import { SegmentContextMenu } from "./SegmentContextMenu";
import { EditorWorkspaceNav } from "./EditorWorkspaceNav";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import { EmptyProjectPanel } from "./EmptyProjectPanel";
import { ProjectFilesHubPanel } from "./ProjectFilesHubPanel";
import {
  type SegmentContextMenuItem,
  type SegmentContextMenuKey,
  type SegmentContextMenuOpen,
} from "../utils/segmentContextMenuModel";
import { EditorSegmentWorkbench } from "./editor/EditorSegmentWorkbench";
import { EditorShortcutsDialog } from "./EditorShortcutsDialog";
import { SegmentCorrectPopover } from "./segmentRow/SegmentCorrectPopover";
import { EditorWaveformPane } from "./editor/EditorWaveformPane";
import { useEditorEditHistory } from "./editor/useEditorEditHistory";
import { useEditorTranscriptAppearance } from "./editor/useEditorTranscriptAppearance";
import { autoSaveFooterLabel } from "../pages/useAutoSaveSegments";

interface EditorViewProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  onOpenEnvironment: () => void;
  segmentCtxMenu: SegmentContextMenuOpen | null;
  setSegmentCtxMenu: (v: SegmentContextMenuOpen | null) => void;
  segmentCtxMenuItems: SegmentContextMenuItem[];
  onSegmentCtxMenuSelect: (key: SegmentContextMenuKey) => void;
}

export function EditorView({
  controller: c,
  tx,
  exportKey,
  onExportSelect,
  onOpenEnvironment,
  segmentCtxMenu,
  setSegmentCtxMenu,
  segmentCtxMenuItems,
  onSegmentCtxMenuSelect,
}: EditorViewProps) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const appearance = useEditorTranscriptAppearance(c.busy, Boolean(c.currentFileId));
  const editHistory = useEditorEditHistory(c.current?.id, c.busy);

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

          <div className="flex items-center gap-1.5">
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
          />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 bg-notion-bg pb-6">
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

            <EditorSegmentWorkbench
              controller={c}
              tx={tx}
              appearance={appearance}
              editHistory={editHistory}
              onOpenSegmentContextMenu={setSegmentCtxMenu}
            />
          </main>

          {c.audioSrc ? (
            <footer className="relative z-40 flex h-[30px] shrink-0 items-center border-t border-notion-divider bg-notion-bg px-2.5 text-[11px] text-notion-text-muted">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span>{autoSaveFooterLabel(c.autoSaveFooterStatus)}</span>
              </div>
              <span className="pointer-events-none absolute left-1/2 max-w-[50%] -translate-x-1/2 truncate text-center text-[11px] text-notion-text-muted" aria-live="polite">
                {tx.waveformFooterStatusLabel ?? ""}
              </span>
              <div className="flex flex-1 items-center justify-end gap-1.5">
                <button
                  type="button"
                  className="inline-flex h-6 items-center justify-center rounded-md border-0 bg-transparent px-2 text-[11px] text-notion-text-muted transition-colors hover:bg-notion-sidebar hover:text-notion-text"
                  onClick={() => setShortcutsOpen(true)}
                >
                  快捷键
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 items-center justify-center rounded-md border-0 bg-transparent px-2 text-[11px] text-notion-text-muted transition-colors hover:bg-notion-sidebar hover:text-notion-text"
                >
                  文档
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 items-center justify-center rounded-md border-0 bg-transparent px-2 text-[11px] text-notion-text-muted transition-colors hover:bg-notion-sidebar hover:text-notion-text"
                >
                  支持
                </button>
              </div>
            </footer>
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
      <EditorShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <SegmentCorrectPopover
        state={c.editorCorrectPopover}
        suggestions={c.editorCorrectPopoverSuggestions}
        onClose={c.closeEditorCorrectPopover}
        onApply={c.applyEditorInlineCorrection}
      />
    </div>
  );
}
