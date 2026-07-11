import { memo, useEffect, useRef, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { FileInput, FileOutput, Settings } from "lucide-react";
import { CONTROL_BTN_TOOLBAR_GHOST } from "../config/controlStyles";
import { EditorWorkspaceNav } from "./EditorWorkspaceNav";
import { TranscribeTopStatusChips } from "./TranscribeTopStatusChips";
import { LlmTopStatusChip } from "./LlmTopStatusChip";
import { WelcomeActivityBell } from "./WelcomeActivityBell";
import { runDeliveryModeTranscribeAction } from "../services/deliveryModeTranscribeToast";
import { isTranscribeBusy } from "../pages/closeGateDecision";
import { toast } from "../services/ui/toast";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { editorShortcutMenuHint } from "../utils/editorShortcutMenuHint";
const ghostBtn = CONTROL_BTN_TOOLBAR_GHOST;
const saveBtn = ghostBtn;
const menuItem =
  "dropdown-item w-full px-3 py-2 text-left text-body text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light";
const subtitleMenuItemMuted = `${menuItem} opacity-40`;
interface EditorToolbarProps {
  controller: ProjectControllerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  projectName: string;
  currentFileName: string;
  onOpenEnvironment: () => void;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
}
export const EditorToolbar = memo(function EditorToolbar({
  controller: c,
  exportKey,
  onExportSelect,
  projectName,
  currentFileName,
  onOpenEnvironment,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
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
    if (c.currentFileId && isTranscribeBusy(c.busy, c.busyReason)) {
      toast.error("转写进行中，请稍后再导入字幕。");
      return;
    }
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
  const importBlocked = c.busy || pendingImport !== null;
  const transcribeSubtitleBlocked =
    Boolean(c.currentFileId) && isTranscribeBusy(c.busy, c.busyReason);
  const subtitleImportHardBlocked = importBlocked && !transcribeSubtitleBlocked;
  const exportBlocked = c.busy;
  useEffect(() => {
    if (exportBlocked) exportMenuRef.current?.removeAttribute("open");
  }, [exportBlocked]);

  return (
    <div className="toolbar-popover-root z-[90] shrink-0 border-b border-notion-divider bg-notion-sidebar px-page-margin">
      <div className="flex h-12 w-full min-w-0 flex-nowrap items-center gap-2 overflow-visible">
        <EditorWorkspaceNav
          projectName={projectName}
          currentLabel={currentFileName}
          fileOpen
          hasUnsavedEdits={c.hasUnsavedFileEdits()}
          onBack={() => c.closeFile()}
          onProjectHome={() => c.closeFile()}
          disabled={c.busy}
        />

        <span className="hidden shrink-0 whitespace-nowrap text-label text-notion-text-muted sm:inline">
          {c.prepareModelBusy
            ? c.prepareModelCancelling
              ? "正在取消模型准备…"
              : "模型准备中，可继续编辑"
            : ""}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {(onOpenAsrSettings || onOpenOnlineSttSettings) ? (
            <TranscribeTopStatusChips
              transcribeSource={c.transcribeSource}
              asrPresentation={c.asrPresentation}
              sttOnlineRefreshSeq={c.sttOnlineRuntimeEpoch}
              onOpenAsrSettings={onOpenAsrSettings}
              onOpenOnlineSttSettings={onOpenOnlineSttSettings}
              disabled={c.busy}
              hideWhenReady
            />
          ) : null}
          {onOpenLlmSettings ? (
            <LlmTopStatusChip
              refreshSeq={llmStatusRefreshSeq}
              onOpenLlmSettings={onOpenLlmSettings}
              disabled={c.busy}
            />
          ) : null}
          <WelcomeActivityBell
            controller={c}
            disabled={c.busy}
            onOpenAsrSettings={onOpenAsrSettings}
            onOpenOnlineSttSettings={onOpenOnlineSttSettings}
            onStartTranscribe={() => void c.runTranscribe()}
            onOpenDeliveryMode={() => runDeliveryModeTranscribeAction()}
            inEditorFile={Boolean(c.currentFileId)}
            panelId="editor-activity-panel"
            variant="toolbar"
          />
          <div className="flex items-center gap-2">
            <details ref={importMenuRef} className="dropdown-anchor">
              <summary
                className={`${ghostBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden ${
                  importBlocked ? "pointer-events-none opacity-40" : ""
                }`}
                aria-disabled={importBlocked}
                onClick={(e) => {
                  if (importBlocked) {
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
                  disabled={importBlocked}
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    void importAudioToCurrentProject();
                  }}
                >
                  导入音频
                </button>
                <button
                  type="button"
                  className={transcribeSubtitleBlocked ? subtitleMenuItemMuted : menuItem}
                  disabled={subtitleImportHardBlocked}
                  title={
                    transcribeSubtitleBlocked
                      ? "转写进行中，请稍后再导入字幕"
                      : undefined
                  }
                  onClick={(e) => {
                    e.currentTarget.closest("details")?.removeAttribute("open");
                    void importTextToCurrentProject();
                  }}
                >
                  {c.currentFileId ? "导入字幕…" : "导入转录文本"}
                </button>
                <button
                  type="button"
                  className={menuItem}
                  disabled={importBlocked}
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
                className={`${ghostBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden ${
                  exportBlocked ? "pointer-events-none opacity-40" : ""
                }`}
                aria-disabled={exportBlocked}
                title={
                  exportBlocked && (c.busyReason === "transcribe" || c.busyReason === "batch_transcribe")
                    ? "转写进行中，请稍后再导出"
                    : exportBlocked
                      ? "处理中，请稍后再导出"
                      : undefined
                }
                onClick={(e) => {
                  if (exportBlocked) {
                    e.preventDefault();
                    return;
                  }
                  importMenuRef.current?.removeAttribute("open");
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileOutput className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  导出
                </span>
              </summary>
              <div className="dropdown-surface absolute right-0 top-full z-[100] mt-1 min-w-[12rem] py-1">
                <button type="button" className={menuItem} disabled={exportBlocked} onClick={() => onExportSelect("txt")}>导出 TXT</button>
                <button type="button" className={menuItem} disabled={exportBlocked} onClick={() => onExportSelect("srt")}>导出 SRT</button>
                <button type="button" className={menuItem} disabled={exportBlocked} onClick={() => onExportSelect("delivery_mode")}>
                  定稿模式…
                </button>
                <button type="button" className={menuItem} disabled={exportBlocked} onClick={() => onExportSelect("docx_delivery")}>
                  交付导出 Word…
                </button>
                <button type="button" className={menuItem} disabled={exportBlocked} onClick={() => void c.exportProjectBundle()}>导出项目包（zip）</button>
                <button type="button" className={menuItem} disabled={exportBlocked} onClick={() => void c.exportDiagnosticBundle()}>导出诊断包（zip）</button>
              </div>
            </details>

            <button type="button" className={saveBtn} disabled={c.busy} onClick={() => void c.saveSegments()}>
              保存
            </button>
          </div>

          <button
            type="button"
            className={ghostBtn}
            onClick={onOpenEnvironment}
            aria-label="设置"
            title={`设置 (${editorShortcutMenuHint("workflow.openSettings")})`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Settings className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              设置
            </span>
          </button>
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
    prev.onOpenAsrSettings === next.onOpenAsrSettings &&
    prev.onOpenOnlineSttSettings === next.onOpenOnlineSttSettings &&
    prev.onOpenLlmSettings === next.onOpenLlmSettings &&
    prev.llmStatusRefreshSeq === next.llmStatusRefreshSeq &&
    prev.controller.transcribeSource === next.controller.transcribeSource &&
    prev.controller.sttOnlineRuntimeEpoch === next.controller.sttOnlineRuntimeEpoch &&
    prev.controller.asrPresentation.chipOk === next.controller.asrPresentation.chipOk &&
    prev.controller.asrPresentation.chipLabel === next.controller.asrPresentation.chipLabel &&
    prev.controller.asrPresentation.tone === next.controller.asrPresentation.tone &&
    prev.controller.asrPresentation.ffmpegChipOk === next.controller.asrPresentation.ffmpegChipOk &&
    prev.controller.current?.id === next.controller.current?.id &&
    prev.controller.currentFileId === next.controller.currentFileId &&
    prev.controller.audioSrc === next.controller.audioSrc &&
    prev.controller.busy === next.controller.busy &&
    prev.controller.busyReason === next.controller.busyReason &&
    prev.controller.prepareModelBusy === next.controller.prepareModelBusy
  );
}
