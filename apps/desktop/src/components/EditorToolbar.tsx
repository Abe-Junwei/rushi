import { memo, useEffect, useRef, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { FileInput, FileOutput, PanelLeftOpen, Settings } from "lucide-react";
import { EditorWorkspaceNav } from "./EditorWorkspaceNav";
import { LlmTopStatusChip } from "./LlmTopStatusChip";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
const ghostBtn =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-2.5 text-[12px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";
const saveBtn = ghostBtn;
const menuItem =
  "dropdown-item w-full px-3 py-2 text-left text-[12px] text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light";
interface EditorToolbarProps {
  controller: ProjectControllerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  projectName: string;
  currentFileName: string;
  onOpenEnvironment: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
  workspaceSidebarCollapsed?: boolean;
  onExpandWorkspaceSidebar?: () => void;
}
export const EditorToolbar = memo(function EditorToolbar({
  controller: c,
  exportKey,
  onExportSelect,
  projectName,
  currentFileName,
  onOpenEnvironment,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
  workspaceSidebarCollapsed = false,
  onExpandWorkspaceSidebar,
}: EditorToolbarProps) {
  const [pendingImport, setPendingImport] = useState<null | "audio" | "text" | "bundle">(null);
  const importMenuRef = useRef<HTMLDetailsElement | null>(null);
  const exportMenuRef = useRef<HTMLDetailsElement | null>(null);

  useEffect(() => {
    const closeMenus = () => {
      importMenuRef.current?.removeAttribute("open");
      exportMenuRef.current?.removeAttribute("open");
    };
    const onWindowPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        importMenuRef.current?.contains(target) ||
        exportMenuRef.current?.contains(target)
      ) {
        return;
      }
      closeMenus();
    };
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenus();
    };
    window.addEventListener("pointerdown", onWindowPointerDown);
    window.addEventListener("keydown", onWindowKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onWindowPointerDown);
      window.removeEventListener("keydown", onWindowKeyDown);
    };
  }, []);

  const importAudioToCurrentProject = async () => {
    if (!c.current) return;
    setPendingImport("audio");
    try {
      await c.pickAndImportFileToProject("audio");
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingImport(null);
    }
  };
  const importTextToCurrentProject = async () => {
    if (!c.current) return;
    setPendingImport("text");
    try {
      await c.pickAndImportFileToProject("text");
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingImport(null);
    }
  };
  const importProjectBundleToWorkspace = async () => {
    setPendingImport("bundle");
    try {
      await c.importProjectBundle();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingImport(null);
    }
  };

  return (
    <div className="toolbar-popover-root z-[90] shrink-0 border-b border-notion-divider bg-notion-sidebar px-page-margin">
      <div className="flex h-12 min-w-0 flex-nowrap items-center gap-2 overflow-visible">
        {workspaceSidebarCollapsed && onExpandWorkspaceSidebar ? (
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-notion-border bg-notion-sidebar-active px-2.5 text-[12px] font-medium text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onExpandWorkspaceSidebar}
            aria-label="展开侧栏"
            title="展开项目侧栏"
            disabled={c.busy}
          >
            <PanelLeftOpen
              className={LUCIDE_ICON_SIZE_MD}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
            <span>侧栏</span>
          </button>
        ) : null}
        <EditorWorkspaceNav
          projectName={projectName}
          currentLabel={currentFileName}
          fileOpen
          hasUnsavedEdits={c.hasUnsavedFileEdits()}
          onBack={() => c.closeFile()}
          onProjectHome={() => c.closeFile()}
          disabled={c.busy}
        />

        <span className="hidden shrink-0 whitespace-nowrap text-[11px] text-notion-text-muted sm:inline">
          {c.prepareModelBusy ? "模型准备中，可继续编辑" : ""}
        </span>

        <div className="flex shrink-0 items-center gap-2">
          {onOpenLlmSettings ? (
            <LlmTopStatusChip
              refreshSeq={llmStatusRefreshSeq}
              onOpenLlmSettings={onOpenLlmSettings}
              disabled={c.busy}
            />
          ) : null}
          <button
            type="button"
            className={ghostBtn}
            onClick={onOpenEnvironment}
            aria-label="设置"
          >
            <span className="inline-flex items-center gap-1.5">
              <Settings className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              设置
            </span>
          </button>

          <div className="ml-1 flex items-center gap-2">
            <details ref={importMenuRef} className="dropdown-anchor">
              <summary
                className={`${ghostBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden ${
                  c.busy || pendingImport !== null ? "pointer-events-none opacity-40" : ""
                }`}
                aria-disabled={c.busy || pendingImport !== null}
                onClick={(e) => {
                  if (c.busy || pendingImport !== null) {
                    e.preventDefault();
                    return;
                  }
                  exportMenuRef.current?.removeAttribute("open");
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileInput className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  {pendingImport ? "导入中..." : "导入"}
                </span>
              </summary>
              <div className="dropdown-surface absolute right-0 top-full z-[100] mt-1 min-w-[11.5rem] py-1">
                <button
                  type="button"
                  className={menuItem}
                  disabled={c.busy || pendingImport !== null}
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    void importAudioToCurrentProject();
                  }}
                >
                  导入音频
                </button>
                <button
                  type="button"
                  className={menuItem}
                  disabled={c.busy || pendingImport !== null}
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    void importTextToCurrentProject();
                  }}
                >
                  导入转录文本
                </button>
                <button
                  type="button"
                  className={menuItem}
                  disabled={c.busy || pendingImport !== null}
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    void importProjectBundleToWorkspace();
                  }}
                >
                  导入项目包（zip）
                </button>
              </div>
            </details>

            <details ref={exportMenuRef} className="dropdown-anchor">
              <summary
                className={`${ghostBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden`}
                onClick={() => {
                  importMenuRef.current?.removeAttribute("open");
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileOutput className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  导出
                </span>
              </summary>
              <div className="dropdown-surface absolute right-0 top-full z-[100] mt-1 min-w-[12rem] py-1">
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("txt")}>导出 TXT</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("srt")}>导出 SRT</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("docx_delivery")}>
                  交付导出 Word…
                </button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("docx_verbatim")}>导出 DOCX 逐字稿</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("docx_lecture")}>导出 DOCX 讲稿</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("docx_clean")}>导出 DOCX 干净稿</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => void c.exportProjectBundle()}>导出项目包（zip）</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => void c.exportDiagnosticBundle()}>导出诊断包（zip）</button>
              </div>
            </details>

            <button type="button" className={saveBtn} disabled={c.busy} onClick={() => void c.saveSegments()}>
              保存
            </button>
          </div>
        </div>
      </div>

      <input type="hidden" value={exportKey} readOnly aria-hidden />
    </div>
  );
}, areEditorToolbarPropsEqual);

function areEditorToolbarPropsEqual(prev: EditorToolbarProps, next: EditorToolbarProps) {
  return (
    prev.exportKey === next.exportKey &&
    prev.projectName === next.projectName &&
    prev.currentFileName === next.currentFileName &&
    prev.onExportSelect === next.onExportSelect &&
    prev.onOpenEnvironment === next.onOpenEnvironment &&
    prev.controller.current?.id === next.controller.current?.id &&
    prev.controller.currentFileId === next.controller.currentFileId &&
    prev.controller.audioSrc === next.controller.audioSrc &&
    prev.controller.busy === next.controller.busy &&
    prev.controller.busyReason === next.controller.busyReason &&
    prev.controller.prepareModelBusy === next.controller.prepareModelBusy
  );
}
