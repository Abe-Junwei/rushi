import type { AutoPunctuateDialogState } from "../pages/useAutoPunctuateController";
import { highlightTextByDiff } from "../utils/textDiff";

type AutoPunctuatePreviewDialogProps = {
  state: AutoPunctuateDialogState;
  onCancel: () => void;
  onConfirmConsent: () => void;
  onConfirmWriteback: () => void;
};

export function AutoPunctuatePreviewDialog({
  state,
  onCancel,
  onConfirmConsent,
  onConfirmWriteback,
}: AutoPunctuatePreviewDialogProps) {
  if (state.phase === "closed") return null;

  const candidate =
    state.phase === "preview"
      ? highlightTextByDiff(state.candidateText, state.diff)
      : null;

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
        aria-labelledby="auto-punctuate-title"
        className="w-full max-w-2xl rounded-md border border-notion-divider bg-notion-bg px-6 py-5 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="auto-punctuate-title" className="text-base font-semibold text-notion-text">
          {state.phase === "consent"
            ? "将语段发送至云端 LLM"
            : state.phase === "loading"
              ? "正在生成标点候选"
              : "自动标点预览"}
        </h2>

        {state.phase === "consent" ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-notion-text-muted">
              当前语段将按「设置 → LLM 配置」中的厂商与模型发送，仅用于自动标点候选。正文不会在未经确认的情况下被改写。
            </p>
            <pre className="mt-4 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg border border-notion-divider bg-white px-3 py-3 text-sm text-notion-text">
              {state.originalText}
            </pre>
          </>
        ) : null}

        {state.phase === "loading" ? (
          <div className="mt-4 rounded-lg border border-notion-divider bg-white px-4 py-6 text-sm text-notion-text-muted">
            正在请求远程 provider 生成候选，请稍候...
          </div>
        ) : null}

        {state.phase === "preview" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="min-w-0">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-notion-text-muted">
                原文
              </p>
              <pre className="min-h-[10rem] whitespace-pre-wrap rounded-lg border border-notion-divider bg-white px-3 py-3 text-sm leading-relaxed text-notion-text">
                {state.originalText}
              </pre>
            </section>
            <section className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs text-notion-text-muted">
                <span className="font-semibold uppercase tracking-[0.08em]">候选</span>
                <span>
                  {state.provider} · {state.latencyMs} ms
                </span>
              </div>
              <div className="min-h-[10rem] whitespace-pre-wrap rounded-lg border border-notion-divider bg-white px-3 py-3 text-sm leading-relaxed text-notion-text">
                {candidate?.map((part, idx) => (
                  <span
                    key={`${idx}-${part.text}`}
                    className={part.highlight ? "rounded bg-zen-saffron/20 text-notion-text" : ""}
                  >
                    {part.text}
                  </span>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-notion-divider bg-notion-bg px-3 py-1.5 text-sm text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
            disabled={state.phase === "loading"}
          >
            {state.phase === "consent" ? "取消" : "关闭"}
          </button>
          {state.phase === "consent" ? (
            <button
              type="button"
              className="rounded-md border-0 bg-zen-saffron-mid px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              onClick={onConfirmConsent}
            >
              我已知晓，继续
            </button>
          ) : null}
          {state.phase === "preview" ? (
            <button
              type="button"
              className="rounded-md border-0 bg-zen-saffron-mid px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              onClick={onConfirmWriteback}
            >
              确认写回
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
