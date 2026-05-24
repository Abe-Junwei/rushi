import { useState } from "react";
import { CLAY_BTN_PRIMARY, CLAY_BTN_SECONDARY, CLAY_TEXT_INPUT } from "../config/controlStyles";

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-zen-gray-300 bg-zen-paper p-5 shadow-xl">
        <h3 className="mb-3 font-serif text-lg font-medium text-zen-ink">新建文本文件</h3>
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
        <div className="mt-4 flex justify-end gap-2">
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
    </div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-zen-gray-300 bg-zen-paper p-5 shadow-xl">
        <h3 className="mb-2 font-serif text-lg font-medium text-zen-ink">删除文件</h3>
        <p className="mb-4 text-sm text-zen-stone">
          确定删除「<span className="font-medium text-zen-ink">{fileName}</span>」？
          <br />
          此操作将同时删除关联的语段数据，且不可撤销。
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="rounded-xl border-0 bg-zen-cinnabar px-3 py-2 font-sans text-[11px] font-semibold text-white transition-colors hover:bg-zen-cinnabar/90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "删除中…" : "删除"}
          </button>
        </div>
      </div>
    </div>
  );
}
