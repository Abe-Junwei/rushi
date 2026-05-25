import { EditorToolbar } from "./EditorToolbar";
import { SegmentContextMenu } from "./SegmentContextMenu";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import { TIMELINE_PX_PER_SEC } from "../utils/pxPerSec";
import { EmptyProjectPanel } from "./EmptyProjectPanel";
import { type SegmentContextMenuItem, type SegmentContextMenuKey } from "../utils/segmentContextMenuModel";
import { EditorSegmentWorkbench } from "./editor/EditorSegmentWorkbench";
import { EditorWaveformPane } from "./editor/EditorWaveformPane";
import { useEditorEditHistory } from "./editor/useEditorEditHistory";
import { useEditorTranscriptAppearance } from "./editor/useEditorTranscriptAppearance";

interface SegmentCtxMenuState {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
}

interface EditorViewProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  onOpenEnvironment: () => void;
  segmentCtxMenu: SegmentCtxMenuState | null;
  setSegmentCtxMenu: (v: SegmentCtxMenuState | null) => void;
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
  const appearance = useEditorTranscriptAppearance(c.busy, Boolean(c.currentFileId));
  const editHistory = useEditorEditHistory(c.current?.id, c.busy);

  const projectName = c.current?.name ?? "未命名项目";
  const currentFileName = c.currentFileId
    ? (c.current?.files.find((f) => f.id === c.currentFileId)?.name ?? "未命名文件")
    : "未选择文件";
  const fallbackWaveFile =
    c.current?.files.find((f) => f.id !== c.currentFileId && f.file_type !== "text") ??
    c.current?.files.find((f) => f.id !== c.currentFileId) ??
    null;
  const zoomPercent = Math.round((tx.pxPerSec / TIMELINE_PX_PER_SEC) * 100);
  const rulerViewportWidthPx = Math.max(1, tx.tierScrollLayout.clientWidth);
  const rulerScrollLeftPx = tx.tierScrollLayout.scrollLeft;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-notion-bg" data-purpose="editor-workspace">
      {!c.currentFileId ? (
        <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-notion-divider bg-white px-4 lg:px-10">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-notion-text-muted transition-colors hover:border-notion-border hover:bg-notion-sidebar-hover hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40"
              disabled={c.busy}
              onClick={() => c.closeProject()}
              aria-label="返回 Dashboard"
            >
              ←
            </button>
            <div className="min-w-0 max-w-[70vw]">
              <p className="truncate text-[14px] font-semibold tracking-tight text-notion-text">
                <span>{projectName}</span>
                <span className="px-1 text-notion-text-light">\</span>
                <span className="text-[13px] font-medium text-notion-text-muted">{currentFileName}</span>
              </p>
            </div>
          </div>

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
            tx={tx}
            exportKey={exportKey}
            onExportSelect={onExportSelect}
            projectName={projectName}
            currentFileName={currentFileName}
            onBack={() => c.closeProject()}
            onOpenEnvironment={onOpenEnvironment}
          />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 bg-notion-bg pb-6">
            {c.audioSrc ? (
              <EditorWaveformPane
                controller={c}
                tx={tx}
                rulerViewportWidthPx={rulerViewportWidthPx}
                rulerScrollLeftPx={rulerScrollLeftPx}
                onOpenSegmentContextMenu={setSegmentCtxMenu}
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
            <footer className="z-40 flex h-10 shrink-0 items-center justify-between gap-2 border-t border-notion-divider bg-notion-bg px-page-margin pb-2 text-[12px] text-notion-text-muted">
              <div className="flex min-w-0 items-center gap-2">
                <span className="font-medium text-notion-text">{zoomPercent}% Zoom</span>
                <span className="h-1 w-1 rounded-full bg-notion-divider" aria-hidden />
                <span>{tx.pxPerSec.toFixed(0)} px/s</span>
                <span className="h-1 w-1 rounded-full bg-notion-divider" aria-hidden />
                <span>自动保存已激活</span>
              </div>
              <span className="truncate text-[11px] text-notion-text-muted">双击波形进行切片</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-full border-0 bg-transparent px-3 text-[12px] text-notion-text-muted transition-colors hover:bg-notion-sidebar hover:text-notion-text"
                >
                  快捷键
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-full border-0 bg-transparent px-3 text-[12px] text-notion-text-muted transition-colors hover:bg-notion-sidebar hover:text-notion-text"
                >
                  文档
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-full border-0 bg-transparent px-3 text-[12px] text-notion-text-muted transition-colors hover:bg-notion-sidebar hover:text-notion-text"
                >
                  支持
                </button>
              </div>
            </footer>
          ) : null}
        </>
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
    </div>
  );
}
