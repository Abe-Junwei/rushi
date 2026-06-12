import { Download, FileSpreadsheet } from "lucide-react";
import { CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import {
  ENV_COLLAPSIBLE_DETAILS,
  EnvCollapsibleSectionSummary,
} from "../envLocalAsr/envLocalAsrPanelUi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { GLOSSARY_ERROR_TEXT } from "./glossaryPanelStyles";

type Props = Pick<GlossaryPageController, "lex" | "disabled" | "bundleStatus" | "bundleError">;

export function GlossaryLexiconBundleSection({
  lex,
  disabled,
  bundleStatus,
  bundleError,
}: Props) {
  return (
    <section className="border-t border-notion-divider pt-6">
      <details className={ENV_COLLAPSIBLE_DETAILS} open={Boolean(bundleStatus || bundleError)}>
        <EnvCollapsibleSectionSummary title="词表包（小团队交换）" />
        <div className="flex flex-col gap-2 pl-5 pt-2">
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            导出/导入 <code className="font-mono text-[11px]">rushi_lexicon_bundle.v1.json</code>
            ，仅含术语表与纠错记忆，不含语段正文。导出前可预览条数并检查噪声记忆。
          </p>
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
        </div>
      </details>
    </section>
  );
}
