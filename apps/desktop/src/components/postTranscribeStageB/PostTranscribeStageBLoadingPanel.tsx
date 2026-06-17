import { describeStageBProgress } from "../../services/postprocess/postTranscribeStageB";
import { PanelAsyncProgress } from "../PanelAsyncProgress";
import { PendingStageAHint } from "./PostTranscribeStageBHints";

type Props = {
  done: number;
  total: number;
  providerLabel: string;
  pendingStageAHint: string | null;
  onCancel: () => void;
};

export function PostTranscribeStageBLoadingPanel({
  done,
  total,
  providerLabel,
  pendingStageAHint,
  onCancel,
}: Props) {
  const progress = describeStageBProgress({ done, total });
  return (
    <div className="space-y-3">
      {pendingStageAHint ? <PendingStageAHint message={pendingStageAHint} /> : null}
      <PanelAsyncProgress
        mode="determinate"
        title="正在生成标点与改字候选…"
        stepDetail={progress.detail}
        providerLabel={providerLabel}
        done={progress.stepDone}
        total={progress.stepTotal}
        percent={progress.percent}
        onCancel={onCancel}
        cancelDisabled={false}
      />
    </div>
  );
}
