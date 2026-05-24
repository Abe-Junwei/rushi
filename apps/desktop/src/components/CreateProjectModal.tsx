import { useState, useCallback } from "react";
import { CLAY_BTN_PRIMARY, CLAY_TEXT_INPUT } from "../config/controlStyles";
import type { ProjectControllerApi } from "../pages/useProjectController";

interface CreateProjectModalProps {
  controller: ProjectControllerApi;
  onClose: () => void;
}

export function CreateProjectModal({ controller: c, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState(c.newName);
  const [busy, setBusy] = useState(false);

  const create = useCallback(async () => {
    setBusy(true);
    c.setNewName(name);
    try {
      await c.createEmptyProject();
      onClose();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [c, name, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zen-gray-300 bg-zen-paper p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif text-xl font-medium text-zen-ink">新建项目</h2>
          <button
            type="button"
            className="rounded-lg border-0 bg-transparent p-1 text-zen-stone transition-colors hover:text-zen-ink"
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </div>

        <label className="mb-5 block">
          <span className="mb-1.5 block font-sans text-[11px] font-semibold tracking-[0.08em] text-zen-ink">
            项目名称
          </span>
          <input
            type="text"
            className={`${CLAY_TEXT_INPUT} w-full`}
            placeholder="输入项目名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </label>

        <div className="mb-5">
          <button
            type="button"
            className={`w-full ${CLAY_BTN_PRIMARY}`}
            disabled={busy}
            onClick={() => void create()}
          >
            {busy ? "创建中…" : "创建项目"}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="font-sans text-sm text-zen-stone transition-colors hover:text-zen-ink disabled:opacity-40"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
