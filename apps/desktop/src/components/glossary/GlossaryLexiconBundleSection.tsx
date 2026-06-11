import { Download, FileSpreadsheet } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

type Props = Pick<GlossaryPageController, "lex" | "disabled" | "bundleStatus" | "bundleError">;

export function GlossaryLexiconBundleSection({
  lex,
  disabled,
  bundleStatus,
  bundleError,
}: Props) {
  return (
    <section
      className="flex flex-col gap-3 rounded-md bg-notion-callout-bg px-4 py-3"
      aria-labelledby="lexicon-bundle-heading"
    >
      <h2 id="lexicon-bundle-heading" className={PANEL_TYPOGRAPHY.sectionTitle}>
        词表包（小团队交换）
      </h2>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
        导出/导入 <code className="font-mono text-[11px]">rushi_lexicon_bundle.v1.json</code>
        ，仅含术语表与纠错记忆，不含语段正文。导出前可预览条数并检查噪声记忆。
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
          disabled={disabled}
          onClick={() => void lex.openExportDialog()}
        >
          <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          导出词表包…
        </button>
        <button
          type="button"
          className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
          disabled={disabled}
          onClick={() => void lex.startImportPreview()}
        >
          <FileSpreadsheet className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          导入词表包…
        </button>
      </div>
      {bundleStatus ? <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text`}>{bundleStatus}</p> : null}
      {bundleError ? (
        <p className="m-0 rounded-md border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          {bundleError}
        </p>
      ) : null}
    </section>
  );
}
