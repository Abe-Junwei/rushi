import type { BundledSeedGateState } from "../hooks/useBundledAsrModelsSeed";
import { CspProgressFill } from "./CspProgressFill";
import { PANEL_PROGRESS_FILL_COMPACT_CLASS, PANEL_PROGRESS_TRACK_COMPACT_CLASS } from "./panelProgressStyles";

type Props = {
  gate: BundledSeedGateState;
  onRetry: () => void;
};

export function BundledAsrModelsSeedOverlay({ gate, onRetry }: Props) {
  if (gate.kind === "idle" || gate.kind === "ready") {
    return null;
  }

  const message =
    gate.kind === "error"
      ? gate.message
      : gate.kind === "seeding"
        ? gate.message
        : "正在准备内置语音模型…";

  const percent = gate.kind === "seeding" ? gate.percent : gate.kind === "checking" ? 0 : 0;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-bg-base/95 px-8 text-center"
      role="dialog"
      aria-modal="true"
      aria-busy={gate.kind !== "error"}
      aria-label="正在准备内置语音模型"
    >
      <p className="text-lg text-text-primary">{message}</p>
      {gate.kind !== "error" ? (
        <div className={PANEL_PROGRESS_TRACK_COMPACT_CLASS}>
          <CspProgressFill percent={percent} className={PANEL_PROGRESS_FILL_COMPACT_CLASS} />
        </div>
      ) : (
        <button
          type="button"
          className="rounded-md bg-accent-saffron px-4 py-2 text-sm text-text-on-accent"
          onClick={onRetry}
        >
          重试
        </button>
      )}
    </div>
  );
}
