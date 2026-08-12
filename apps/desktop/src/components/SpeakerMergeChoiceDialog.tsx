import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import type { SpeakerMergeChoice } from "../pages/segmentListHelpers";
import type { PendingSpeakerMerge } from "../pages/segmentMutationMergeDelete";
import { CompactFloatingDialog } from "./CompactFloatingDialog";

type Props = {
  pending: PendingSpeakerMerge | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (choice: SpeakerMergeChoice) => void;
};

export function SpeakerMergeChoiceDialog({ pending, busy, onCancel, onConfirm }: Props) {
  if (!pending) return null;
  const isRange = pending.kind === "range";
  return (
    <CompactFloatingDialog
      id="speaker-merge-choice-v1"
      title="选择合段后的说话人"
      open
      onClose={onCancel}
      fitKind="staticFit"
      fallbackHeight={190}
      defaultWidth={420}
      bounds={{ minWidth: 340, minHeight: 170, maxWidthCap: 480 }}
      rootRole="alertdialog"
      footer={
        <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
          取消合段
        </button>
      }
      footerJustify="end"
    >
      <div className="space-y-3 px-4 py-3 text-sm text-notion-text">
        <p className="text-notion-text-muted">
          所选语段属于不同说话人。请选择合并后保留哪一方；关闭窗口不会修改文稿。
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={() => onConfirm("left")}>
            保留{isRange ? "首段" : "前一段"}
          </button>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={() => onConfirm("right")}>
            保留{isRange ? "末段" : "后一段"}
          </button>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={() => onConfirm("unassigned")}>
            设为未标注
          </button>
        </div>
      </div>
    </CompactFloatingDialog>
  );
}
