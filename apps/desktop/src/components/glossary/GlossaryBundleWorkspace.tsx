import { Download, FileSpreadsheet } from "lucide-react";
import { CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_ERROR_TEXT } from "./glossaryPanelStyles";

type Props = Pick<GlossaryPageController, "lex" | "disabled" | "bundleStatus" | "bundleError">;

export function GlossaryBundleWorkspace({ lex, disabled, bundleStatus, bundleError }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-notion-divider bg-notion-callout-bg px-6 py-4">
        <h2 className={`m-0 ${PANEL_TYPOGRAPHY.envSectionTitle}`}>词表包</h2>
        <p className={`m-0 mt-1 max-w-2xl ${PANEL_TYPOGRAPHY.meta}`}>
          导出/导入 <code className="font-mono text-[11px]">rushi_lexicon_bundle.v1.json</code>
          ，仅含术语表与纠错记忆，不含语段正文。适合小团队交换词表。
        </p>
      </div>

      <div className="flex flex-col gap-4 px-6 py-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`${CONTROL_BTN_SECONDARY} gap-1.5`}
            disabled={disabled}
            onClick={() => void lex.openExportDialog()}
          >
            <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            导出词表包…
          </button>
          <button
            type="button"
            className={`${CONTROL_BTN_SECONDARY} gap-1.5`}
            disabled={disabled}
            onClick={() => void lex.startImportPreview()}
          >
            <FileSpreadsheet className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            导入词表包…
          </button>
        </div>

        {bundleStatus ? (
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{bundleStatus}</p>
        ) : null}
        {bundleError ? <p className={GLOSSARY_ERROR_TEXT}>{bundleError}</p> : null}

        <p className={`m-0 max-w-2xl ${PANEL_TYPOGRAPHY.helper}`}>
          导出前可预览条数并过滤不稳定记忆；导入时若与本地词条冲突，将提示逐条选择保留或覆盖。
        </p>
      </div>
    </div>
  );
}
