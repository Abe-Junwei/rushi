import { useEffect, useRef, useState } from "react";
import { FileAudio, FileText, FolderOpen, LoaderCircle, Upload } from "lucide-react";
import * as fileApi from "../tauri/fileApi";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a"]);
const TRANSCRIPT_EXTENSIONS = new Set(["txt", "srt", "vtt"]);

const tileButtonBase =
  "group flex min-w-[200px] flex-col items-center rounded-lg border border-notion-divider bg-notion-bg px-5 py-6 text-center transition-colors hover:border-notion-border hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-40";

const tileIconWrap =
  "mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-notion-sidebar text-notion-text-muted transition-colors group-hover:bg-zen-saffron/20 group-hover:text-zen-saffron";

async function importAudio(c: ProjectControllerApi) {
  if (!c.current) return;
  const srcPath = await fileApi.pickAudioPath();
  if (!srcPath) return;
  const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名音频";
  await fileApi.importAudioToProject(c.current.id, name, srcPath);
  await c.loadProject(c.current.id);
}

async function importTranscript(c: ProjectControllerApi) {
  if (!c.current) return;
  const srcPath = await fileApi.pickTextPath();
  if (!srcPath) return;
  const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名文本";
  await fileApi.importTextToProject(c.current.id, name, srcPath);
  await c.loadProject(c.current.id);
}

function getFileExtension(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot < 0) return "";
  return path.slice(dot + 1).toLowerCase();
}

function getFileBaseName(path: string): string {
  return path.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
}

function resolveDroppedFileKind(path: string): "audio" | "transcript" | null {
  const ext = getFileExtension(path);
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (TRANSCRIPT_EXTENSIONS.has(ext)) return "transcript";
  return null;
}

async function importDroppedFiles(c: ProjectControllerApi, paths: string[]): Promise<{ imported: number; skipped: number }> {
  if (!c.current) return { imported: 0, skipped: paths.length };

  const uniquePaths = [...new Set(paths)];
  let imported = 0;
  let skipped = 0;

  for (const srcPath of uniquePaths) {
    const kind = resolveDroppedFileKind(srcPath);
    if (!kind) {
      skipped += 1;
      continue;
    }

    const fallback = kind === "audio" ? "未命名音频" : "未命名文本";
    const name = getFileBaseName(srcPath) || fallback;

    if (kind === "audio") {
      await fileApi.importAudioToProject(c.current.id, name, srcPath);
    } else {
      await fileApi.importTextToProject(c.current.id, name, srcPath);
    }
    imported += 1;
  }

  if (imported > 0) {
    await c.loadProject(c.current.id);
  }

  return { imported, skipped };
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
              if (result.imported === 0) {
                controller.setError("拖入失败：仅支持音频（.mp3/.wav/.m4a）或转录文本（.txt/.srt/.vtt）文件。");
              }
            } catch (e) {
              controller.setError(e instanceof Error ? e.message : String(e));
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
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12">
      <section
        className={`relative w-full max-w-3xl overflow-hidden rounded-xl border bg-notion-bg p-8 text-center shadow-sm transition-colors ${
          isDragActive ? "border-zen-saffron bg-zen-saffron/5" : "border-notion-divider"
        }`}
      >
        <div className="absolute inset-x-0 top-0 h-1 bg-zen-saffron/70" aria-hidden />
        <div className="mb-4 flex justify-center text-notion-text-muted">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-notion-sidebar">
            <FolderOpen className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </span>
        </div>
        <h2 className="mb-2 text-[32px] font-semibold text-zen-ink">暂无媒体文件</h2>
        <p className="mx-auto mb-8 max-w-xl text-[13px] leading-6 text-notion-text-muted">
          要开始转录或编辑，请导入音频文件或现有的转录文本以映射到时间轴。
        </p>

        <div className="mt-2 border-t border-notion-divider pt-6">
          <p className="mb-4 text-[11px] font-semibold tracking-[0.08em] text-notion-text-muted">导入资源</p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <ImportTile
              title="导入音频"
              loadingTitle="导入音频中..."
              formats=".mp3, .wav, .m4a"
              disabled={isImportBusy}
              loading={pendingImport === "audio"}
              onClick={() => runImport("audio", () => importAudio(c))}
              icon={<FileAudio className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}
            />
            <ImportTile
              title="导入转录文本"
              loadingTitle="导入转录文本中..."
              formats=".txt, .srt, .vtt"
              disabled={isImportBusy}
              loading={pendingImport === "transcript"}
              onClick={() => runImport("transcript", () => importTranscript(c))}
              icon={<FileText className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}
            />
          </div>
        </div>

        <div
          className={`mt-8 flex items-center justify-center gap-2 border-t border-dashed pt-5 text-[12px] transition-colors ${
            isDragActive
              ? "border-zen-saffron text-zen-saffron"
              : "border-notion-divider text-notion-text-muted"
          }`}
        >
          <Upload className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          <span>{isDragActive ? "释放鼠标即可导入文件" : "或直接将文件拖放到此工作区"}</span>
        </div>
      </section>
      <div className="mt-4 text-[11px] text-notion-text-muted" aria-live="polite">
        {statusMessage}
      </div>
    </div>
  );
}
