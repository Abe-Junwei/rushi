import type { CSSProperties, ReactNode } from "react";
import { computeRevisionSpans, type RevisionSpan } from "../../services/revisionDiff";

type Props = {
  /** 聚焦时的已提交正文（Word 修订前） */
  before: string;
  /** 当前草稿（修订后） */
  after: string;
  className?: string;
  style?: CSSProperties;
};

function RevisionSpanNode({ span, keyId }: { span: RevisionSpan; keyId: string }) {
  if (span.kind === "equal") {
    return <span key={keyId}>{span.text}</span>;
  }
  if (span.kind === "delete") {
    return (
      <span key={keyId} className="seg-learn-diff-removed text-notion-text-muted">
        {span.text}
      </span>
    );
  }
  return (
    <span key={keyId} className="seg-learn-diff-inserted text-notion-text">
      {span.text}
    </span>
  );
}

/** 待纳入记忆：基线 vs 草稿只读 diff（对比对话框；编辑区仅显示 after）。 */
export function PendingLearnDiffText({ before, after, className, style }: Props) {
  const spans = computeRevisionSpans(before, after);
  if (spans.length === 0) {
    return (
      <div className={className} style={style}>
        {after}
      </div>
    );
  }

  const nodes: ReactNode[] = spans.map((span, idx) => (
    <RevisionSpanNode key={`${span.kind}-${idx}`} span={span} keyId={`${span.kind}-${idx}`} />
  ));

  return (
    <div className={className} style={style}>
      {nodes}
    </div>
  );
}
