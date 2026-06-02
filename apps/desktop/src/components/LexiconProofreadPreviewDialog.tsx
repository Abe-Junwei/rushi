import type { LexiconProofreadDialogState } from "../pages/useLexiconProofreadController";

type LexiconProofreadPreviewDialogProps = {
  state: LexiconProofreadDialogState;
  onCancel: () => void;
  onConfirmConsent: () => void;
  onConfirmWriteback: () => void;
  onAcceptRulesChange: (value: boolean) => void;
  onToggleOp: (index: number, selected: boolean) => void;
  onSelectAllOps: (selected: boolean) => void;
};

export function LexiconProofreadPreviewDialog({
  state,
  onCancel,
  onConfirmConsent,
  onConfirmWriteback,
  onAcceptRulesChange,
  onToggleOp,
  onSelectAllOps,
}: LexiconProofreadPreviewDialogProps) {
  if (state.phase === "closed") return null;

  const preview = state.phase === "preview" ? state : null;
  const selectedCount =
    preview?.selectedOpIndexes.filter(Boolean).length ?? 0;
  const totalCount = preview?.opLabels.length ?? 0;
  const hasRuleItems =
    preview?.items.some((i) => String(i.evidence.type).toLowerCase() === "rule") ?? false;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-zen-ink/25 p-6 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && state.phase !== "loading") onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lexicon-proofread-title"
        className="w-full max-w-xl rounded-md border border-notion-divider bg-notion-bg px-6 py-5 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="lexicon-proofread-title" className="text-base font-semibold text-notion-text">
          {state.phase === "consent"
            ? "将语段与词表发送至云端 LLM"
            : state.phase === "loading"
              ? "正在生成词表校对建议"
              : "词表校对预览"}
        </h2>

        {state.phase === "consent" ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-notion-text-muted">
              将把当前选中语段及相邻语段（共 {state.segmentCount} 条）连同术语表条目与纠错规则发送至
              LLM，生成有据改字建议。确认前不会修改数据库。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="min-h-[36px] rounded-md border border-notion-border px-3 text-sm text-notion-text-muted hover:bg-notion-sidebar-hover"
                onClick={onCancel}
              >
                取消
              </button>
              <button
                type="button"
                className="min-h-[36px] rounded-md border-0 bg-zen-saffron px-4 text-sm font-semibold text-notion-bg hover:opacity-90"
                onClick={onConfirmConsent}
              >
                继续
              </button>
            </div>
          </>
        ) : null}

        {state.phase === "loading" ? (
          <p className="mt-4 text-sm text-notion-text-muted">正在请求远程 provider，请稍候…</p>
        ) : null}

        {preview ? (
          <>
            <p className="mt-2 text-xs text-notion-text-muted">
              {preview.provider}
              {preview.latencyMs > 0 ? ` · ${preview.latencyMs}ms` : ""}
              {preview.packTruncated ? " · 词表已截断（仅发送部分条目）" : ""}
            </p>
            {preview.rationale ? (
              <p className="mt-2 text-sm text-notion-text-muted">{preview.rationale}</p>
            ) : null}
            {preview.warnings.length > 0 ? (
              <div className="mt-2 text-xs text-notion-text-muted">
                <p>已丢弃 {preview.warnings.length} 条无依据或无效建议（无法写回）：</p>
                <ul className="mt-1 list-disc pl-4">
                  {preview.warnings.slice(0, 3).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {totalCount > 0 ? (
              <>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs text-notion-text-muted">
                  <span>勾选要写入语段的建议（未勾选视为不采纳）</span>
                  <span className="shrink-0">
                    <button
                      type="button"
                      className="text-zen-saffron hover:underline"
                      onClick={() => onSelectAllOps(true)}
                    >
                      全选
                    </button>
                    <span className="mx-1">·</span>
                    <button
                      type="button"
                      className="text-zen-saffron hover:underline"
                      onClick={() => onSelectAllOps(false)}
                    >
                      全不选
                    </button>
                  </span>
                </div>
                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm text-notion-text">
                  {preview.opLabels.map((label, i) => (
                    <li key={`${i}-${label.slice(0, 24)}`}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md bg-notion-sidebar/40 px-2 py-1.5">
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0"
                          checked={preview.selectedOpIndexes[i] ?? false}
                          onChange={(e) => onToggleOp(i, e.target.checked)}
                        />
                        <span className="leading-snug">{label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-notion-text-muted">模型未返回可采纳的改字建议。</p>
            )}
            {hasRuleItems ? (
              <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-notion-text">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={preview.acceptRulesOnWriteback}
                  onChange={(e) => onAcceptRulesChange(e.target.checked)}
                />
                <span>将已勾选且含纠错记忆的替换，采纳为纠错规则</span>
              </label>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="min-h-[36px] rounded-md border border-notion-border px-3 text-sm text-notion-text-muted hover:bg-notion-sidebar-hover"
                onClick={onCancel}
              >
                取消
              </button>
              <button
                type="button"
                className="min-h-[36px] rounded-md border-0 bg-zen-saffron px-4 text-sm font-semibold text-notion-bg hover:opacity-90 disabled:opacity-40"
                disabled={selectedCount === 0}
                onClick={onConfirmWriteback}
              >
                {selectedCount > 0 && selectedCount < totalCount
                  ? `写回已选 ${selectedCount} 条`
                  : "确认写回"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
