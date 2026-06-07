import { useMemo } from "react";
import { FileAudio, FileText, FolderOpen, Pencil, Trash2 } from "lucide-react";
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
      await c.pickAndImportFileToProject(kind);
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main
      className="project-files-hub-stage flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8"
      data-purpose="project-files-hub"
    >
      <div className="project-files-hub-card mx-auto w-full max-w-2xl">
        <header className="mb-5 sm:mb-6">
          <h1 className="text-lg font-semibold tracking-tight text-notion-text sm:text-[22px]">{projectName}</h1>
          <p className="mt-1 text-[13px] text-notion-text-muted sm:text-sm">
            选择文件进入转写与编辑，或继续导入新媒体。
          </p>
        </header>

        <section
          className="w-full rounded-md border border-notion-divider bg-notion-bg/70 p-4 sm:p-5"
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
            {files.map((f) => {
              const isRenaming = c.renamingProjectFileId === f.id;

              return (
                <div
                  key={f.id}
                  className={`${FILE_ROW_CLASS} cursor-default hover:bg-notion-bg`}
                >
                  {isRenaming ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-2 pr-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        c.commitRenameProjectFile();
                      }}
                    >
                      <input
                        type="text"
                        className="min-w-0 flex-1 rounded-md border border-notion-divider bg-notion-bg px-2 py-1 text-sm text-notion-text"
                        value={c.renameProjectFileDraft}
                        disabled={busy}
                        autoFocus
                        onChange={(e) => c.setRenameProjectFileDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") c.cancelRenameProjectFile();
                        }}
                      />
                      <button
                        type="submit"
                        className="shrink-0 rounded-md border-0 bg-transparent text-[11px] font-semibold text-zen-saffron disabled:opacity-40"
                        disabled={busy || !c.renameProjectFileDraft.trim()}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="shrink-0 rounded-md border-0 bg-transparent text-[11px] text-notion-text-muted hover:text-notion-text"
                        disabled={busy}
                        onClick={() => c.cancelRenameProjectFile()}
                      >
                        取消
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center border-0 bg-transparent p-0 text-left disabled:opacity-40"
                        disabled={busy}
                        onClick={() => void c.openFile(f.id)}
                      >
                        <span className="min-w-0 flex-1 pr-3">
                          <span className="flex items-center gap-1.5 truncate text-sm font-medium text-notion-text">
                            <span className="truncate">{f.name}</span>
                          </span>
                          <span className="block text-[11px] text-notion-text-muted">
                            {formatProjectFileType(f.file_type)} · {formatFileUpdatedAt(f.updated_at_ms)}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-zen-saffron">打开</span>
                      </button>
                      <div className="ml-2 flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
                          disabled={busy}
                          aria-label={`重命名 ${f.name}`}
                          onClick={() => c.beginRenameProjectFile(f.id, f.name)}
                        >
                          <Pencil className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-zen-cinnabar disabled:opacity-40"
                          disabled={busy}
                          aria-label={`删除 ${f.name}`}
                          onClick={() => c.requestDeleteProjectFile(f.id, f.name)}
                        >
                          <Trash2 className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
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
