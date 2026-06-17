import { ENV_NAV } from "../../config/environmentNavCopy";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PostTranscribeStageBDialogState } from "../../pages/usePostTranscribeStageBController";
import { FloatingPanelDialogHeader } from "../FloatingPanelDialogLayout";
import { PendingStageAHint } from "./PostTranscribeStageBHints";

type ConsentState = Extract<PostTranscribeStageBDialogState, { phase: "consent" }>;

type Props = {
  state: ConsentState;
  pendingHint: string | null;
};

export function PostTranscribeStageBConsentPanel({ state, pendingHint }: Props) {
  return (
    <FloatingPanelDialogHeader>
      {pendingHint ? <PendingStageAHint message={pendingHint} /> : null}
      <p className={PANEL_TYPOGRAPHY.dialogBody}>
        将对当前文件最多 {state.segmentCount} 条有正文的语段请求标点与改字候选（按「{ENV_NAV.llm}」发送；一次请求合并标点与词表有据改字）。正文不会在未经确认的情况下被改写；不会合并或拆分语段。
      </p>
    </FloatingPanelDialogHeader>
  );
}
