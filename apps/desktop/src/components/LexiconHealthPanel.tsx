import type { LexiconHealthReport } from "../services/editor/lexiconHealthReport";
import { PANEL_TYPOGRAPHY } from "../config/typography";

type Props = {
  report: LexiconHealthReport;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

/** A9：词表卫生只读面板（不写回）。 */
export function LexiconHealthPanel({ report, expanded, onExpandedChange }: Props) {
  const defaultOpen = expanded ?? report.hasActionableIssues;

  return (
    <details
      className="shrink-0 rounded-md border border-notion-divider bg-notion-callout-bg"
      open={expanded ?? defaultOpen}
      onToggle={(e) => onExpandedChange?.(e.currentTarget.open)}
    >
      <summary
        className={`cursor-pointer list-none px-3 py-1.5 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text marker:content-none [&::-webkit-details-marker]:hidden`}
      >
        词表卫生
        {report.hasActionableIssues ? (
          <span className="ml-1 font-normal text-zen-saffron">· 有待关注项</span>
        ) : (
          <span className="ml-1 font-normal text-notion-text-muted">· 只读</span>
        )}
      </summary>
      <ul
        className={`m-0 list-disc space-y-1 border-t border-notion-divider px-3 py-2 pl-6 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}
      >
        {report.summaryLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
