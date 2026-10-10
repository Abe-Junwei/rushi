import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY, CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import { CompactFloatingDialog } from "./CompactFloatingDialog";

type Props = {
  open: boolean;
  busy: boolean;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SpeakerRenameDialog({
  open,
  busy,
  value,
  placeholder,
  onChange,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;
  return (
    <CompactFloatingDialog
      id="speaker-rename-v1"
      title="重命名说话人"
      open
      onClose={onCancel}
      fitKind="staticFit"
      fallbackHeight={180}
      defaultWidth={400}
      bounds={{ minWidth: 320, minHeight: 160, maxWidthCap: 460 }}
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
            取消
          </button>
          <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
            保存
          </button>
        </>
      }
      footerJustify="end"
    >
      <div className="space-y-3 px-4 py-3">
        <label className={`flex flex-col gap-1 ${PANEL_TYPOGRAPHY.dialogBody}`}>
          <span className={PANEL_TYPOGRAPHY.fieldLabel}>显示名</span>
          <input
            type="text"
            className={`${CONTROL_TEXT_INPUT} ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
            value={value}
            disabled={busy}
            autoFocus
            placeholder={placeholder}
            aria-label="说话人显示名"
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                onConfirm();
              }
            }}
          />
        </label>
        <p className={PANEL_TYPOGRAPHY.meta}>留空则显示默认「说话人 N」。</p>
      </div>
    </CompactFloatingDialog>
  );
}
