import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelDialogScroll } from "./FloatingPanelDialogLayout";

export type ExportBundleScope = "project" | "library";

type Props = {
  open: boolean;
  busy?: boolean;
  canExportProject: boolean;
  scope: ExportBundleScope;
  onScopeChange: (scope: ExportBundleScope) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

const PANEL_ID = "export-bundle-scope-v1";

export function ExportBundleScopeDialog({
  open,
  busy = false,
  canExportProject,
  scope,
  onScopeChange,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="导出内容包"
      open
      onClose={() => {
        if (!busy) onCancel();
      }}
      fitKind="staticFit"
      fallbackHeight={240}
      defaultWidth={420}
      bounds={{ minWidth: 360, minHeight: 200, maxWidthCap: 480, maxHeightCap: 380 }}
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={CONTROL_BTN_PRIMARY}
            disabled={busy || (scope === "project" && !canExportProject)}
            onClick={onConfirm}
          >
            {busy ? "导出中…" : "选择保存位置…"}
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogScroll>
        <div className="flex flex-col gap-3 text-sm text-notion-text">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="export-bundle-scope"
              className="mt-1"
              checked={scope === "project"}
              disabled={busy || !canExportProject}
              onChange={() => onScopeChange("project")}
            />
            <span>
              <span className="font-medium">当前项目</span>
              <span className={`mt-0.5 block ${PANEL_TYPOGRAPHY.meta}`}>
                {canExportProject
                  ? "打包整个当前项目：全部音轨、语段、peaks 与词表。"
                  : "请先打开项目里的一个文件，以便带上正在编辑的语段。"}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name="export-bundle-scope"
              className="mt-1"
              checked={scope === "library"}
              disabled={busy}
              onChange={() => onScopeChange("library")}
            />
            <span>
              <span className="font-medium">整库（全部项目）</span>
              <span className={`mt-0.5 block ${PANEL_TYPOGRAPHY.meta}`}>
                打包库内全部项目，并带一份全局词表。
              </span>
            </span>
          </label>
        </div>
      </FloatingPanelDialogScroll>
    </CompactFloatingDialog>
  );
}
