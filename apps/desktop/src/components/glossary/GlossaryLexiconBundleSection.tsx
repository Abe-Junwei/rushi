import { Download, FileSpreadsheet } from "lucide-react";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../../config/typography";
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
        ，仅含术语表与稳定纠错记忆，不含语段正文。
      </p>
      <label className="flex items-center gap-2 text-sm text-notion-text">
        <input
          type="checkbox"
          checked={lex.exportStableOnly}
          onChange={(e) => lex.setExportStableOnly(e.target.checked)}
          disabled={disabled}
        />
        仅导出稳定记忆（hit≥2 或已采纳）
      </label>
      <label className="flex flex-col gap-1">
        <span className={PANEL_TYPOGRAPHY.meta}>来源标签（可选）</span>
        <input
          type="text"
          value={lex.exportLabel}
          onChange={(e) => lex.setExportLabel(e.target.value)}
          disabled={disabled}
          placeholder="例如：栏目 A / 用户 B"
          className={`min-h-[36px] rounded-lg border border-notion-border bg-notion-bg px-3 outline-none focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-50 ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-notion-border bg-notion-bg px-3 text-sm font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
          disabled={disabled}
          onClick={() => void lex.exportBundle()}
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
