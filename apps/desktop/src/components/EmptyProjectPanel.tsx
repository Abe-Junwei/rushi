import { useEffect, useRef, useState } from "react";
import { FileAudio, FileInput, FileText } from "lucide-react";
import { CONTROL_BTN_WORKSPACE_IMPORT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { WORKSPACE_PAGE_PANEL_CLASS } from "../config/workspaceShellLayout";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { importDroppedPathsToProject } from "../services/projectBatchImport";
import { toast } from "../services/ui/toast";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const DROP_IMPORT_UNSUPPORTED_MSG =
  "拖入失败：仅支持音频（.mp3/.wav/.m4a）或转录文本（.txt/.srt/.vtt）文件。";

const IMPORT_ACTION_BTN = CONTROL_BTN_WORKSPACE_IMPORT;

export function EmptyProjectPanel({ controller: c }: { controller: ProjectControllerApi }) {
  const [pendingImport, setPendingImport] = useState<"audio" | "transcript" | "drop" | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const isImportBusy = c.busy || pendingImport !== null;
  const projectName = c.current?.name ?? "当前项目";

  const controllerRef = useRef(c);
  const importBusyRef = useRef(isImportBusy);

  useEffect(() => {
    controllerRef.current = c;
  }, [c]);

  useEffect(() => {
    importBusyRef.current = isImportBusy;
  }, [isImportBusy]);

  const runImport = (kind: "audio" | "transcript" | "drop", action: () => Promise<void>) => {
    if (isImportBusy) return;
    setPendingImport(kind);
    void (async () => {
      try {
        await action();
      } catch (e) {
        c.setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPendingImport((prev) => (prev === kind ? null : prev));
      }
    })();
  };

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;

    void (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const webview = getCurrentWebview();
        const off = await webview.onDragDropEvent((event) => {
          const payload = event.payload;
          if (payload.type === "enter" || payload.type === "over") {
            setIsDragActive(true);
            return;
          }

          if (payload.type === "leave") {
            setIsDragActive(false);
            return;
          }

          setIsDragActive(false);
          if (importBusyRef.current) return;
          if (payload.type !== "drop" || payload.paths.length === 0) return;

          const droppedPaths = payload.paths;
          setPendingImport("drop");
          void (async () => {
            const controller = controllerRef.current;
            try {
              const projectId = controller.current?.id;
              if (!projectId) return;
              const result = await importDroppedPathsToProject(
                controller.importFileToProject,
                droppedPaths,
                async () => controller.loadProjectAfterImport(projectId),
              );
              if (result.imported === 0 && result.unsupported > 0) {
                toast.error(DROP_IMPORT_UNSUPPORTED_MSG);
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : String(e));
            } finally {
              setPendingImport((prev) => (prev === "drop" ? null : prev));
            }
          })();
        });

        if (disposed) {
          off();
          return;
        }
        unlisten = off;
      } catch {
        setIsDragActive(false);
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const statusMessage =
    pendingImport === "audio"
      ? "正在导入音频，请稍候..."
      : pendingImport === "transcript"
        ? "正在导入转录文本，请稍候..."
        : pendingImport === "drop"
          ? "正在处理拖入文件，请稍候..."
          : c.busy
            ? "正在处理任务，请稍候..."
            : "";

  return (
    <section
      className={`${WORKSPACE_PAGE_PANEL_CLASS} gap-6 transition-colors ${
        isDragActive ? "rounded-xl bg-zen-saffron/5" : ""
      }`}
      data-purpose="empty-project-page"
    >
      <header>
        <h1 className="truncate text-display font-semibold leading-[1.25] tracking-[-0.015em] text-notion-text">
          {projectName}
        </h1>
      </header>

      <section className="flex flex-col gap-2" aria-label="项目文件">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-title font-medium text-notion-text-muted">项目文件</h2>
          <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-muted`}>
            0 个文件
          </span>
        </div>
        <p className="rounded-md bg-notion-sidebar/55 px-2.5 py-4 text-sm text-notion-text-muted">
          暂无文件。请导入音频或转录文本以开始。
        </p>
      </section>

      <section className="flex flex-col gap-2 pt-1" aria-label="继续导入">
        <p className={`${PANEL_TYPOGRAPHY.fieldLabel} text-notion-text-muted`}>继续导入</p>
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className={`${IMPORT_ACTION_BTN} w-full justify-start sm:w-auto`}
            disabled={isImportBusy}
            onClick={() =>
              runImport("audio", () =>
                c.pickAndImportAudioPathsToProject().then(() => undefined),
              )
            }
          >
            <FileAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            导入音频
          </button>
          <button
            type="button"
            className={`${IMPORT_ACTION_BTN} w-full justify-start sm:w-auto`}
            disabled={isImportBusy}
            onClick={() =>
              runImport("transcript", () => c.pickAndImportFileToProject("text").then(() => undefined))
            }
          >
            <FileText className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            导入转录文本
          </button>
        </div>
      </section>

      <div
        className={`flex min-h-[4rem] flex-col items-center justify-center gap-1.5 rounded-lg px-4 py-3 transition-colors sm:min-h-[4.5rem] sm:gap-2 sm:px-5 sm:py-4 ${
          isDragActive
            ? "border border-dashed border-zen-saffron bg-zen-saffron/10 text-zen-saffron"
            : "bg-notion-sidebar/60 text-notion-text-muted"
        }`}
        aria-live="polite"
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors sm:h-10 sm:w-10 ${
            isDragActive ? "bg-zen-saffron/15 text-zen-saffron" : "bg-notion-bg text-notion-text-muted"
          }`}
          aria-hidden
        >
          <FileInput className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} />
        </span>
        <p className="text-body font-medium text-notion-text sm:text-title">
          {isDragActive ? (
            <span className="text-zen-saffron">释放鼠标即可导入</span>
          ) : (
            "直接将文件拖放到此工作区"
          )}
        </p>
        <p className="text-label leading-4 text-notion-text-muted sm:text-label sm:leading-5">
          音频 .mp3 · .wav · .m4a  文本 .txt · .srt · .vtt
        </p>
      </div>

      {statusMessage ? (
        <p className="w-full text-center text-label text-notion-text-muted" aria-live="polite">
          {statusMessage}
        </p>
      ) : null}
    </section>
  );
}
