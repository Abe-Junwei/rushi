import type { SegmentRefineDialogState } from "../pages/useSegmentRefineController";
import { useDialogEscapeClose } from "../hooks/useDialogEscapeClose";
import { PANEL_TYPOGRAPHY } from "../config/typography";

type SegmentRefinePreviewDialogProps = {
  state: SegmentRefineDialogState;
  onCancel: () => void;
  onConfirmConsent: () => void;
  onConfirmWriteback: () => void;
};

export function SegmentRefinePreviewDialog({
  state,
  onCancel,
  onConfirmConsent,
  onConfirmWriteback,
}: SegmentRefinePreviewDialogProps) {
  useDialogEscapeClose(state.phase !== "closed", onCancel, () => state.phase !== "loading");

  if (state.phase === "closed") return null;

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
        aria-labelledby="segment-refine-title"
        className="w-full max-w-xl rounded-md border border-notion-divider bg-notion-bg px-6 py-5 font-sans antialiased shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="segment-refine-title" className={`${PANEL_TYPOGRAPHY.dialogTitle} text-base`}>
          {state.phase === "consent"
            ? "将语段发送至云端 LLM"
            : state.phase === "loading"
              ? "正在生成段界建议"
              : "段界整理预览"}
        </h2>

        {state.phase === "consent" ? (
          <>
            <p className={`mt-3 ${PANEL_TYPOGRAPHY.dialogBody}`}>
              将把当前选中语段及相邻语段（共 {state.segmentCount} 条）发送至 LLM，生成合并/拆分/改字建议。确认前不会修改数据库。
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
          <p className={`mt-4 ${PANEL_TYPOGRAPHY.dialogBody}`}>正在请求远程 provider，请稍候…</p>
        ) : null}

        {state.phase === "preview" ? (
          <>
            <p className="mt-2 text-xs text-notion-text-muted">
              {state.provider}
              {state.latencyMs > 0 ? ` · ${state.latencyMs}ms` : ""} · 语段 {state.beforeCount} →{" "}
              {state.afterCount}
            </p>
            {state.rationale ? (
              <p className={`mt-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>{state.rationale}</p>
            ) : null}
            {state.opLabels.length > 0 ? (
              <ul className={`mt-3 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 ${PANEL_TYPOGRAPHY.dialogText}`}>
                {state.opLabels.map((label, i) => (
                  <li key={`${i}-${label.slice(0, 24)}`}>{label}</li>
                ))}
              </ul>
            ) : (
              <p className={`mt-3 ${PANEL_TYPOGRAPHY.dialogBody}`}>模型未返回调整建议（空 ops）。</p>
            )}
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
                disabled={state.opLabels.length === 0}
                onClick={onConfirmWriteback}
              >
                确认写回
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
