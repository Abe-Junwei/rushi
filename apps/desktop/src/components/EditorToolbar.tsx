import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import * as fileApi from "../tauri/fileApi";
import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const ghostBtn =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-2.5 text-[12px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";
const solidBtn =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-zen-saffron px-4 text-[12px] font-medium text-white transition-colors hover:bg-zen-saffron-mid disabled:cursor-not-allowed disabled:opacity-40";
const saveBtn =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-4 text-[12px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";
const actionBtn =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-2 text-[12px] font-medium text-notion-text-light transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:text-notion-text-light/70";
const menuItem =
  "dropdown-item w-full px-3 py-2 text-left text-[12px] text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light";
const divider = "h-[18px] w-px shrink-0 bg-notion-divider";

interface EditorToolbarProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  projectName: string;
  currentFileName: string;
  onBack: () => void;
  onOpenEnvironment: () => void;
}

export function EditorToolbar({
  controller: c,
  tx,
  exportKey,
  onExportSelect,
  projectName,
  currentFileName,
  onBack,
  onOpenEnvironment,
}: EditorToolbarProps) {
  const [pendingImport, setPendingImport] = useState<null | "audio" | "text" | "bundle">(null);

  const importAudioToCurrentProject = async () => {
    if (!c.current) return;
    setPendingImport("audio");
    try {
      const srcPath = await fileApi.pickAudioPath();
      if (!srcPath) return;
      const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名音频";
      await fileApi.importAudioToProject(c.current.id, name, srcPath);
      await c.loadProject(c.current.id);
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
      const srcPath = await fileApi.pickTextPath();
      if (!srcPath) return;
      const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名文本";
      await fileApi.importTextToProject(c.current.id, name, srcPath);
      await c.loadProject(c.current.id);
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
    <div className="toolbar-popover-root z-30 shrink-0 border-b border-notion-divider bg-notion-bg px-page-margin">
      <div className="flex h-16 flex-nowrap items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-0 items-center gap-2.5 pr-2">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-notion-text-muted transition-colors hover:border-notion-border hover:bg-notion-sidebar-hover hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40"
            disabled={c.busy}
            onClick={onBack}
            aria-label="返回 Dashboard"
          >
            ←
          </button>
          <div className="min-w-0 max-w-[14rem] sm:max-w-[18rem] lg:max-w-[24rem] xl:max-w-[28rem]">
            <p className="truncate text-[14px] font-semibold tracking-tight text-notion-text">
              <span>{projectName}</span>
              <span className="px-1 text-notion-text-light">\</span>
              <span className="text-[13px] font-medium text-notion-text-muted">{currentFileName}</span>
            </p>
          </div>
          <button
            type="button"
            className={ghostBtn}
            onClick={onOpenEnvironment}
          >
            <span className="sm:hidden">环境</span>
            <span className="hidden sm:inline">环境与 ASR</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <details className="dropdown-anchor">
            <summary
              className={`${ghostBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden ${
                c.busy || pendingImport !== null ? "pointer-events-none opacity-40" : ""
              }`}
              aria-disabled={c.busy || pendingImport !== null}
              onClick={(e) => {
                if (c.busy || pendingImport !== null) e.preventDefault();
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                {pendingImport ? "导入中..." : "导入素材"}
                <ChevronDown className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              </span>
            </summary>
              <div className="dropdown-surface absolute left-0 top-full mt-1 min-w-[11.5rem] py-1">
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
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className={ghostBtn}
            disabled={c.busy || c.prepareModelBusy}
            onClick={() => void c.runTranscribe()}
          >
            <span className="inline-flex items-center gap-1.5">
              <Download className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              {c.prepareModelBusy ? "模型准备中..." : "从 ASR 拉取语段"}
            </span>
          </button>

          <div className="flex items-center rounded-md bg-notion-sidebar-hover p-0.5">
            <details className="dropdown-anchor">
              <summary className={`${solidBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden`}>
                <span className="inline-flex items-center gap-1.5">
                  导出
                  <ChevronDown className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                </span>
              </summary>
              <div className="dropdown-surface absolute right-0 top-full mt-1 min-w-[12rem] py-1">
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("txt")}>导出 TXT</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("srt")}>导出 SRT</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("docx_verbatim")}>导出 DOCX 逐字稿</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => onExportSelect("docx_lecture")}>导出 DOCX 讲稿</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => void c.exportProjectBundle()}>导出项目包（zip）</button>
                <button type="button" className={menuItem} disabled={c.busy} onClick={() => void c.exportDiagnosticBundle()}>导出诊断包（zip）</button>
              </div>
            </details>

            <button type="button" className={saveBtn} disabled={c.busy} onClick={() => void c.saveSegments()}>
              保存
            </button>
          </div>
        </div>

        <span className={divider} aria-hidden />

        <div className="hidden shrink-0 items-center gap-1.5 xl:flex">
          <button
            type="button"
            className={actionBtn}
            disabled={tx.segmentToolbar.splitDisabled}
            onClick={() => tx.segmentToolbar.splitAtSelection()}
          >
            拆分
          </button>
          <button
            type="button"
            className={actionBtn}
            disabled={tx.segmentToolbar.mergePrevDisabled}
            onClick={() => tx.segmentToolbar.mergeWithPrev()}
          >
            合并上一条
          </button>
          <button
            type="button"
            className={actionBtn}
            disabled={tx.segmentToolbar.mergeDisabled}
            onClick={() => tx.segmentToolbar.mergeWithNext()}
          >
            合并下一条
          </button>
        </div>

        <details className="dropdown-anchor xl:hidden">
          <summary className={`${ghostBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden`}>
            <span className="inline-flex items-center gap-1.5">
              编辑
              <ChevronDown className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </span>
          </summary>
          <div className="dropdown-surface absolute right-0 top-full mt-1 min-w-[9.5rem] py-1">
            <button
              type="button"
              className={menuItem}
              disabled={tx.segmentToolbar.splitDisabled}
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                tx.segmentToolbar.splitAtSelection();
              }}
            >
              拆分
            </button>
            <button
              type="button"
              className={menuItem}
              disabled={tx.segmentToolbar.mergePrevDisabled}
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                tx.segmentToolbar.mergeWithPrev();
              }}
            >
              合并上一条
            </button>
            <button
              type="button"
              className={menuItem}
              disabled={tx.segmentToolbar.mergeDisabled}
              onClick={(e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                tx.segmentToolbar.mergeWithNext();
              }}
            >
              合并下一条
            </button>
          </div>
        </details>

        <span className="ml-auto whitespace-nowrap text-[11px] text-notion-text-muted">
          {c.prepareModelBusy ? "模型准备中，可继续编辑" : "双击波形语段仅播该段"}
        </span>
      </div>

      <input type="hidden" value={exportKey} readOnly aria-hidden />
    </div>
  );
}
