import { useEffect, useRef, useState } from "react";
import { FileAudio, FileInput, FileText, FolderOpen, LoaderCircle } from "lucide-react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { toast } from "../services/ui/toast";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const DROP_IMPORT_UNSUPPORTED_MSG =
  "拖入失败：仅支持音频（.mp3/.wav/.m4a）或转录文本（.txt/.srt/.vtt）文件。";

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a"]);
const TRANSCRIPT_EXTENSIONS = new Set(["txt", "srt", "vtt"]);

const tileButtonBase =
  "group flex min-w-0 flex-1 flex-col items-center rounded-lg border border-notion-divider bg-notion-bg px-4 py-4 text-center transition-colors hover:border-notion-border hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[168px] sm:flex-none sm:px-5 sm:py-5";

const tileIconWrap =
  "mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-notion-sidebar text-notion-text-muted transition-colors group-hover:bg-zen-saffron/20 group-hover:text-zen-saffron sm:mb-3 sm:h-11 sm:w-11";

async function importDroppedFiles(
  c: ProjectControllerApi,
  paths: string[],
): Promise<{ imported: number; skipped: number; unsupported: number }> {
  if (!c.current) return { imported: 0, skipped: paths.length, unsupported: paths.length };

  const uniquePaths = [...new Set(paths)];
  let imported = 0;
  let skipped = 0;
  let unsupported = 0;

  for (const srcPath of uniquePaths) {
    const kind = resolveDroppedFileKind(srcPath);
    if (!kind) {
      skipped += 1;
      unsupported += 1;
      continue;
    }

    const importedOk = await c.importFileToProject(
      kind === "audio" ? "audio" : "text",
      srcPath,
      { skipReload: true },
    );
    if (importedOk) {
      imported += 1;
    } else {
      skipped += 1;
    }
  }

  if (imported > 0 && c.current) {
    await c.loadProjectAfterImport(c.current.id);
  }

  return { imported, skipped, unsupported };
}

function getFileExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "";
  return path.slice(dot + 1).toLowerCase();
}

function resolveDroppedFileKind(path: string): "audio" | "transcript" | null {
  const ext = getFileExtension(path);
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (TRANSCRIPT_EXTENSIONS.has(ext)) return "transcript";
  return null;
}

function ImportTile({
  title,
  loadingTitle,
  formats,
  disabled,
  loading,
  onClick,
  icon,
}: {
  title: string;
  loadingTitle: string;
  formats: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button type="button" className={tileButtonBase} disabled={disabled} onClick={onClick}>
      <span className={tileIconWrap}>
        {loading ? <LoaderCircle className={`${LUCIDE_ICON_SIZE_MD} animate-spin`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden /> : icon}
      </span>
      <span className="text-[14px] font-semibold text-notion-text">{loading ? loadingTitle : title}</span>
      <span className="mt-1 text-[11px] text-notion-text-muted">{formats}</span>
    </button>
  );
}

export function EmptyProjectPanel({ controller: c }: { controller: ProjectControllerApi }) {
  const [pendingImport, setPendingImport] = useState<"audio" | "transcript" | "drop" | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const isImportBusy = c.busy || pendingImport !== null;

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
              const result = await importDroppedFiles(controller, droppedPaths);
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
    <div
      className="empty-project-stage flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8"
      data-purpose="empty-project"
    >
      <div className="empty-project-card mx-auto w-full max-w-2xl">
        <section
          className={`relative w-full overflow-hidden rounded-md border bg-notion-bg p-5 text-center transition-colors sm:p-6 ${
            isDragActive ? "border-zen-saffron bg-zen-saffron/5" : "border-notion-divider"
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-zen-saffron/70" aria-hidden />
          <div className="mb-3 flex justify-center text-notion-text-muted">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-notion-sidebar sm:h-12 sm:w-12">
              <FolderOpen className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </span>
          </div>
          <h2 className="mb-1.5 text-xl font-semibold text-zen-ink sm:text-2xl">暂无媒体文件</h2>
          <p className="mx-auto mb-5 max-w-md text-[13px] leading-5 text-notion-text-muted sm:mb-6 sm:text-[14px] sm:leading-6">
            要开始转录或编辑，请导入音频文件或现有的转录文本以映射到时间轴。
          </p>

          <div className="border-t border-notion-divider pt-4 sm:pt-5">
            <p className="mb-3 text-[11px] font-semibold tracking-[0.1em] text-notion-text-muted sm:mb-4">
              导入资源
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-4">
              <ImportTile
                title="导入音频"
                loadingTitle="导入音频中..."
                formats=".mp3, .wav, .m4a"
                disabled={isImportBusy}
                loading={pendingImport === "audio"}
                onClick={() =>
                  runImport("audio", () => c.pickAndImportFileToProject("audio").then(() => undefined))
                }
                icon={<FileAudio className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}
              />
              <ImportTile
                title="导入转录文本"
                loadingTitle="导入转录文本中..."
                formats=".txt, .srt, .vtt"
                disabled={isImportBusy}
                loading={pendingImport === "transcript"}
                onClick={() =>
                  runImport("transcript", () => c.pickAndImportFileToProject("text").then(() => undefined))
                }
                icon={<FileText className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}
              />
            </div>
          </div>

          <p className="my-3 text-[11px] font-medium tracking-wide text-notion-text-light sm:my-4">或</p>

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
            <p className="text-[12px] font-medium text-notion-text sm:text-[13px]">
              {isDragActive ? (
                <span className="text-zen-saffron">释放鼠标即可导入</span>
              ) : (
                "直接将文件拖放到此工作区"
              )}
            </p>
            <p className="text-[10px] leading-4 text-notion-text-muted sm:text-[11px] sm:leading-5">
              音频 .mp3 · .wav · .m4a　文本 .txt · .srt · .vtt
            </p>
          </div>
        </section>
        {statusMessage ? (
          <p className="mt-3 text-center text-[11px] text-notion-text-muted" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
