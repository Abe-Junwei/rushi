import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { FloatingPanelTemplate } from "./PanelTemplate";

const PANEL_ID = "transcribe-overwrite-confirm-v1";
const DEFAULT_SIZE = { width: 320, height: 260 } as const;
const MIN_SIZE = { width: 280, height: 240 } as const;

type Props = {
  open: boolean;
  busy: boolean;
  segmentCount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TranscribeOverwriteConfirmDialog({
  open,
  busy,
  segmentCount,
  onCancel,
  onConfirm,
}: Props) {
  if (!open || typeof document === "undefined") return null;

  const handleClose = () => {
    if (!busy) onCancel();
  };

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={PANEL_ID}
        title="覆盖现有语段？"
        preset="compactDialog"
        minWidth={MIN_SIZE.width}
        minHeight={MIN_SIZE.height}
        defaultSize={DEFAULT_SIZE}
        persistState
        onClose={handleClose}
      >
        <div className="flex flex-col px-5 py-3" role="alertdialog" aria-modal="true">
          <p className="text-sm leading-relaxed text-zen-stone">
            当前文件已有 {segmentCount} 条语段且含正文。从 ASR 拉取将<strong className="font-medium">替换</strong>
            全部语段，未保存的手改将丢失。
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-notion-text-muted">
            建议先保存或导出；确认后继续转写。
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
              {busy ? "转写中…" : "覆盖并拉取"}
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}
