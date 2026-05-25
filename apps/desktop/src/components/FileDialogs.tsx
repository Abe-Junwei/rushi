import { useState } from "react";
import { CLAY_BTN_PRIMARY, CLAY_BTN_SECONDARY, CLAY_TEXT_INPUT } from "../config/controlStyles";
import { FloatingPanelTemplate } from "./PanelTemplate";

const btnSecondary = CLAY_BTN_SECONDARY;

export function CreateTextFileDialog({
  open,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  if (!open) return null;
  return (
    <FloatingPanelTemplate id="create-text-file" title="新建文本文件" preset="compactDialog" onClose={onClose}>
      <div className="flex h-full flex-col px-5 py-4">
          <input
            type="text"
            className={`${CLAY_TEXT_INPUT} w-full`}
            placeholder="输入文件名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
            }}
            autoFocus
          />
          <div className="mt-auto flex justify-end gap-2">
            <button type="button" className={btnSecondary} disabled={busy} onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className={CLAY_BTN_PRIMARY}
              disabled={busy || !name.trim()}
              onClick={() => onConfirm(name.trim())}
            >
              {busy ? "创建中…" : "创建"}
            </button>
          </div>
        </div>
    </FloatingPanelTemplate>
  );
}

export function DeleteFileDialog({
  open,
  fileName,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  fileName: string;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (!open) return null;
  return (
    <FloatingPanelTemplate id="delete-file" title="删除文件" preset="compactDialog" onClose={onClose}>
      <div className="flex h-full flex-col px-5 py-4">
          <p className="mb-4 text-sm text-zen-stone">
            确定删除「<span className="font-medium text-zen-ink">{fileName}</span>」？
            <br />
            此操作将同时删除关联的语段数据，且不可撤销。
          </p>
          <div className="mt-auto flex justify-end gap-2">
            <button type="button" className={btnSecondary} disabled={busy} onClick={onClose}>
              取消
            </button>
            <button
              type="button"
                       className="rounded-xl border-0 bg-zen-cinnabar px-3 py-2 font-sans text-[11px] font-semibold text-notion-bg transition-colors hover:bg-zen-cinnabar/90 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? "删除中…" : "删除"}
            </button>
          </div>
        </div>
    </FloatingPanelTemplate>
  );
}
