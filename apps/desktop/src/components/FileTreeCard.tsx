import { useState } from "react";
import * as fileApi from "../tauri/fileApi";
import { CLAY_BTN_SECONDARY } from "../config/controlStyles";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { CreateTextFileDialog, DeleteFileDialog } from "./FileDialogs";

const btnSecondary = CLAY_BTN_SECONDARY;
const sectionCard = "rounded-2xl border border-zen-gray-300 bg-serene-surface-container-low px-3 py-3";

/* ─── File icons & badges ─── */

function FileTypeBadge({ type }: { type: string }) {
  const label =
    type === "text" ? "文本" : type === "paired" ? "音视频" : type === "audio_only" ? "音频" : type;
  const style =
    type === "text"
      ? "bg-zen-indigo/10 text-zen-indigo"
      : type === "paired"
        ? "bg-zen-saffron/10 text-zen-saffron"
        : "bg-zen-stone/10 text-zen-stone";
  return (
    <span className={`rounded-full px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wide ${style}`}>
      {label}
    </span>
  );
}

function FileIcon({ type }: { type: string }) {
  if (type === "text") {
    return (
      <svg className="h-4 w-4 shrink-0 text-zen-indigo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 13H8" strokeLinecap="round" />
        <path d="M16 17H8" strokeLinecap="round" />
        <path d="M10 9H8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 shrink-0 text-zen-saffron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3 3 3 0 0 1-3-3V5a3 3 0 0 1 3-3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 19v3" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6 6 1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v5" strokeLinecap="round" />
      <path d="M14 11v5" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Main card ─── */

export function FileTreeCard({ controller: c }: { controller: ProjectControllerApi }) {
  const files = c.current?.files ?? [];
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreateTextFile = async (name: string) => {
    if (!c.current) return;
    try {
      await fileApi.createEmptyTextFile(c.current.id, name);
      await c.refreshCurrentProject();
      setShowCreateDialog(false);
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImportAudio = async () => {
    if (!c.current) return;
    try {
      const srcPath = await fileApi.pickAudioPath();
      if (!srcPath) return;
      const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名音频";
      await fileApi.importAudioToProject(c.current.id, name, srcPath);
      await c.refreshCurrentProject();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleImportText = async () => {
    if (!c.current) return;
    try {
      const srcPath = await fileApi.pickTextPath();
      if (!srcPath) return;
      const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名文本";
      await fileApi.importTextToProject(c.current.id, name, srcPath);
      await c.refreshCurrentProject();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fileApi.deleteFile(deleteTarget.id);
      await c.refreshCurrentProject();
      setDeleteTarget(null);
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className={sectionCard}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">文件</p>
        <span className="text-[10px] text-zen-stone">{files.length}</span>
      </div>

      {files.length > 0 ? (
        <div className="mb-2 flex flex-col gap-0.5">
          {files.map((f) => {
            const isActive = c.currentFileId === f.id;
            return (
              <div
                key={f.id}
                className={`group flex items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1 transition-colors ${
                  isActive
                    ? "border-zen-saffron/20 bg-serene-surface-container"
                    : "hover:border-zen-gray-200 hover:bg-serene-surface-container"
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border-0 bg-transparent p-0.5 text-left disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={c.busy}
                  onClick={() => {
                    if (!isActive) void c.openFile(f.id);
                  }}
                  title={f.name}
                >
                  <FileIcon type={f.file_type} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[11px] font-medium ${isActive ? "text-zen-saffron-mid" : "text-zen-ink"}`}>
                      {f.name}
                    </span>
                  </span>
                </button>
                <FileTypeBadge type={f.file_type} />
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-zen-stone opacity-0 transition-colors hover:bg-zen-cinnabar/10 hover:text-zen-cinnabar group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`删除文件 ${f.name}`}
                  title="删除文件"
                  disabled={c.busy}
                  onClick={() => setDeleteTarget({ id: f.id, name: f.name })}
                >
                  <TrashIcon />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mb-2 py-2 text-center text-[11px] text-zen-stone">项目为空</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`${btnSecondary} px-2 py-1 text-[10px]`}
          disabled={c.busy}
          onClick={() => setShowCreateDialog(true)}
        >
          + 文本
        </button>
        <button
          type="button"
          className={`${btnSecondary} px-2 py-1 text-[10px]`}
          disabled={c.busy}
          onClick={() => void handleImportAudio()}
        >
          + 音频
        </button>
        <button
          type="button"
          className={`${btnSecondary} px-2 py-1 text-[10px]`}
          disabled={c.busy}
          onClick={() => void handleImportText()}
        >
          + 文本文件
        </button>
      </div>

      <CreateTextFileDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onConfirm={(name) => void handleCreateTextFile(name)}
        busy={c.busy}
      />
      <DeleteFileDialog
        open={deleteTarget !== null}
        fileName={deleteTarget?.name ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        busy={c.busy}
      />
    </div>
  );
}
