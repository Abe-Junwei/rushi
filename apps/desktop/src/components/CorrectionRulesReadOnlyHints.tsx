import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { CorrectionRuleHintPair } from "../services/editor/correctionRuleHints";
import {
  CORRECTION_MEMORY_STABLE_HIT,
  type LearningCorrectionHint,
} from "../services/editor/learningCorrectionRuleHints";

const READ_ONLY_HINT_META_CLASS =
  "w-[4.25rem] shrink-0 truncate text-left text-xs leading-4 tabular-nums text-notion-text-muted";

function ReadOnlyHintChangeLine({ beforeText, afterText }: { beforeText: string; afterText: string }) {
  return (
    <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm leading-snug text-notion-text">
      <span className="text-notion-text-muted line-through decoration-notion-text-light/70">{beforeText}</span>
      <span className="px-1 text-notion-text-light" aria-hidden>
        →
      </span>
      <span>{afterText}</span>
    </span>
  );
}

function ReadOnlyHintRow({
  meta,
  metaTitle,
  beforeText,
  afterText,
}: {
  meta: string;
  metaTitle?: string;
  beforeText: string;
  afterText: string;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2 bg-notion-bg/50 px-3 py-1.5">
      <span className={READ_ONLY_HINT_META_CLASS} title={metaTitle}>
        {meta}
      </span>
      <ReadOnlyHintChangeLine beforeText={beforeText} afterText={afterText} />
    </li>
  );
}

function ReadOnlyHintGroupLabel({ children }: { children: string }) {
  return (
    <li
      className={`list-none bg-notion-callout-bg px-3 py-1 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text-muted`}
      aria-hidden
    >
      {children}
    </li>
  );
}

export function CorrectionRulesReadOnlyHintsDetails({
  learningHints,
  transcribeHints,
  expanded,
  onExpandedChange,
}: {
  learningHints: LearningCorrectionHint[];
  transcribeHints: CorrectionRuleHintPair[];
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const count = learningHints.length + transcribeHints.length;
  if (!count) return null;

  const showGroupLabels = learningHints.length > 0 && transcribeHints.length > 0;

  return (
    <details
      className="shrink-0 rounded-md border border-notion-divider bg-notion-callout-bg"
      open={expanded}
      onToggle={(e) => onExpandedChange?.(e.currentTarget.open)}
    >
      <summary
        className={`cursor-pointer list-none px-3 py-1.5 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text marker:content-none [&::-webkit-details-marker]:hidden`}
      >
        只读提示（{count}）
        <span className="ml-1 font-normal text-notion-text-muted">· 预览不会写回</span>
      </summary>
      <ul className="m-0 max-h-36 list-none divide-y divide-notion-divider/80 overflow-y-auto border-t border-notion-divider">
        {learningHints.length > 0 ? (
          <>
            {showGroupLabels ? <ReadOnlyHintGroupLabel>纠错记忆（学习中）</ReadOnlyHintGroupLabel> : null}
            {learningHints.map((hint) => (
              <ReadOnlyHintRow
                key={`learning:${hint.beforeText}\u0000${hint.afterText}`}
                meta={`${hint.hitCount}/${CORRECTION_MEMORY_STABLE_HIT}`}
                metaTitle={`学习中，满 ${CORRECTION_MEMORY_STABLE_HIT} 次可升为稳定规则`}
                beforeText={hint.beforeText}
                afterText={hint.afterText}
              />
            ))}
          </>
        ) : null}
        {transcribeHints.length > 0 ? (
          <>
            {showGroupLabels ? <ReadOnlyHintGroupLabel>转写规则提示</ReadOnlyHintGroupLabel> : null}
            {transcribeHints.map((hint) => (
              <ReadOnlyHintRow
                key={`transcribe:${hint.beforeText}\u0000${hint.afterText}`}
                meta="转写"
                metaTitle="转写附带提示，本预览不会写回"
                beforeText={hint.beforeText}
                afterText={hint.afterText}
              />
            ))}
          </>
        ) : null}
      </ul>
    </details>
  );
}
