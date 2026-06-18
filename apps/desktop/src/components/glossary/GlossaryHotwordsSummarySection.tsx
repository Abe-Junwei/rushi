import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { GlossaryPageController } from "../../pages/useGlossaryPageController";

type Props = Pick<GlossaryPageController, "g">;

export function GlossaryHotwordsSummarySection({ g }: Props) {
  return (
    <section
      className="flex flex-col gap-2 rounded-md border border-notion-divider bg-notion-callout-bg px-4 py-3"
      aria-labelledby="glossary-hotwords-heading"
    >
      <h2 id="glossary-hotwords-heading" className={PANEL_TYPOGRAPHY.sectionTitle}>
        转写词汇表（Custom Vocabulary）
      </h2>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>{g.hotwordsSummary}</p>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
        共 {g.terms.length} 条词条，{g.hotwordEnabledCount} 条已勾选「纳入下次转写（热词）」
        {g.hotwordsPreview
          ? `；将提交 ${g.hotwordsPreview.termCount} 个唯一热词 token。`
          : "。"}
        本表影响<strong className="font-medium text-notion-text">下次听写</strong>；纠错记忆影响
        <strong className="font-medium text-notion-text">当前稿改正</strong>，二者勿混用。
      </p>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
        本机 FunASR 使用空格串 <code className={`font-mono ${PANEL_TYPOGRAPHY.meta}`}>hotwords</code>；在线 STT 按厂商映射（见「环境与
        ASR → 在线 STT」）。
      </p>
      {g.hotwordsPreview?.truncated ? (
        <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-accent-action`}>
          全部热词 token 拼接约 {g.hotwordsPreview.joinedCharCount.toLocaleString()} 字符，超出上限；
          实际提交 {g.hotwordsPreview.includedTermCount} 个（约 {g.hotwordsPreview.submittedCharCount.toLocaleString()}{" "}
          字符），另有 {g.hotwordsPreview.droppedTermCount} 个未纳入。
        </p>
      ) : null}
      {g.hotwordsPreview?.preview ? (
        <pre className={`m-0 max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-md bg-notion-bg/80 px-2 py-1.5 font-mono ${PANEL_TYPOGRAPHY.meta}`}>
          {g.hotwordsPreview.preview}
        </pre>
      ) : null}
    </section>
  );
}
