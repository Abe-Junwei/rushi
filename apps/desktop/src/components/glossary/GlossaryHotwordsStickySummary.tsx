import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";
import { ENV_COLLAPSIBLE_DETAILS, EnvCollapsibleMetaSummary } from "../envLocalAsr/envLocalAsrPanelUi";

type Props = Pick<GlossaryPageController, "g">;

export function GlossaryHotwordsStickySummary({ g }: Props) {
  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-notion-divider bg-notion-callout-bg">
      <div className="flex items-center justify-between gap-3 px-4 py-2">
        <p
          className={`m-0 min-w-0 flex-1 truncate ${PANEL_TYPOGRAPHY.body} text-notion-text`}
          title={g.hotwordsSummary}
        >
          {g.hotwordsSummary}
        </p>
        <span
          className={`shrink-0 whitespace-nowrap tabular-nums ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}
          title={`${g.hotwordEnabledCount} 条已纳入热词，共 ${g.terms.length} 条词条`}
        >
          {g.hotwordEnabledCount}/{g.terms.length} 热词
        </span>
      </div>
      {g.hotwordsPreview?.truncated ? (
        <p className={`m-0 border-t border-notion-divider/60 px-4 py-1.5 ${PANEL_TYPOGRAPHY.meta} text-accent-action`}>
          超出上限；实际提交 {g.hotwordsPreview.includedTermCount} 个（约{" "}
          {g.hotwordsPreview.submittedCharCount.toLocaleString()} 字），另有 {g.hotwordsPreview.droppedTermCount}{" "}
          个未纳入。
        </p>
      ) : null}
      <details className={`${ENV_COLLAPSIBLE_DETAILS} border-t border-notion-divider/60 px-4 py-1`}>
        <EnvCollapsibleMetaSummary>机制说明与热词预览</EnvCollapsibleMetaSummary>
        <div className="flex flex-col gap-1.5 pb-2 pl-5 pt-1">
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            共 {g.terms.length} 条词条，{g.hotwordEnabledCount} 条已勾选「纳入下次转写（热词）」
            {g.hotwordsPreview ? `；共 ${g.hotwordsPreview.termCount} 个不重复热词。` : "。"}
            本表影响下次听写；纠错记忆影响当前稿改正。
          </p>
          {g.hotwordsPreview?.preview ? (
            <pre className="m-0 max-h-20 overflow-auto whitespace-pre-wrap break-all rounded-md bg-notion-bg/80 px-2 py-1.5 font-mono text-label text-notion-text-muted">
              {g.hotwordsPreview.preview}
            </pre>
          ) : null}
        </div>
      </details>
    </div>
  );
}
