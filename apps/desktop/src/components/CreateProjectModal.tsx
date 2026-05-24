import { useState, useCallback } from "react";
import { CLAY_BTN_PRIMARY, CLAY_TEXT_INPUT } from "../config/controlStyles";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { DraggableResizablePanel } from "./DraggableResizablePanel";

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
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <DraggableResizablePanel
        id="create-project"
        title="新建项目"
        defaultPosition={{ x: Math.round(window.innerWidth / 2 - 192), y: Math.round(window.innerHeight / 2 - 160) }}
        defaultSize={{ width: 384, height: 320 }}
        minWidth={320}
        minHeight={280}
        onClose={onClose}
      >
        <div className="flex h-full flex-col px-5 py-4">
          <label className="mb-4 block">
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
              autoFocus
            />
          </label>

          <div className="mb-4">
            <button
              type="button"
              className={`w-full ${CLAY_BTN_PRIMARY}`}
              disabled={busy}
              onClick={() => void create()}
            >
              {busy ? "创建中…" : "创建项目"}
            </button>
          </div>

          <div className="mt-auto flex justify-end">
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
      </DraggableResizablePanel>
    </>
  );
}
