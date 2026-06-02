import { useMemo } from "react";
import { FileAudio, FileText, FolderOpen } from "lucide-react";
import * as fileApi from "../tauri/fileApi";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { FileSummary } from "../tauri/projectTypes";
import { formatProjectFileType } from "../utils/projectFileDisplay";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

/** 与 WelcomeView「最近文件」行一致 */
const FILE_ROW_CLASS =
  "flex w-full items-center justify-between rounded-lg border border-notion-divider bg-notion-bg px-3 py-2 text-left transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-40";

function sortFilesNewestFirst(files: FileSummary[]): FileSummary[] {
  return [...files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
}

function formatFileUpdatedAt(ms: number): string {
  return new Date(ms).toLocaleString();
}

export function ProjectFilesHubPanel({ controller: c }: { controller: ProjectControllerApi }) {
  const files = useMemo(
    () => sortFilesNewestFirst(c.current?.files ?? []),
    [c.current?.files],
  );
  const projectName = c.current?.name ?? "当前项目";
  const busy = c.busy;

  const runImport = async (kind: "audio" | "text") => {
    if (!c.current || busy) return;
    try {
      if (kind === "audio") {
        const srcPath = await fileApi.pickAudioPath();
        if (!srcPath) return;
        const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名音频";
        await fileApi.importAudioToProject(c.current.id, name, srcPath);
      } else {
        const srcPath = await fileApi.pickTextPath();
        if (!srcPath) return;
        const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名文本";
        await fileApi.importTextToProject(c.current.id, name, srcPath);
      }
      await c.loadProject(c.current.id);
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg px-4 py-10 lg:px-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8">
          <h1 className="text-[22px] font-semibold tracking-tight text-notion-text">{projectName}</h1>
          <p className="mt-1 text-sm text-notion-text-muted">
            选择文件进入转写与编辑，或继续导入新媒体。
          </p>
        </header>

        <section
          className="w-full rounded-md border border-notion-divider bg-notion-bg/70 p-6"
          aria-label="项目文件列表"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-zen-saffron">
                <FolderOpen
                  className={LUCIDE_ICON_SIZE_LG}
                  strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                  aria-hidden
                />
              </span>
              <h2 className="text-sm font-semibold text-notion-text">项目文件</h2>
            </div>
            <span className="text-[11px] text-notion-text-muted">{files.length} 个文件</span>
          </div>

          <div className="space-y-2">
            {files.map((f) => (
              <button
                key={f.id}
                type="button"
                className={FILE_ROW_CLASS}
                disabled={busy}
                onClick={() => void c.openFile(f.id)}
              >
                <span className="min-w-0 flex-1 pr-3">
                  <span className="block truncate text-sm font-medium text-notion-text">{f.name}</span>
                  <span className="block text-[11px] text-notion-text-muted">
                    {formatProjectFileType(f.file_type)} · {formatFileUpdatedAt(f.updated_at_ms)}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-zen-saffron">打开</span>
              </button>
            ))}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-notion-divider bg-notion-bg px-3 text-[12px] font-medium text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40"
            disabled={busy}
            onClick={() => void runImport("audio")}
          >
            <FileAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            导入音频
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-notion-divider bg-notion-bg px-3 text-[12px] font-medium text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40"
            disabled={busy}
            onClick={() => void runImport("text")}
          >
            <FileText className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            导入转录文本
          </button>
        </div>
      </div>
    </main>
  );
}
