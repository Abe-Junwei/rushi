import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PostTranscribeStageBDialogState } from "../../pages/usePostTranscribeStageBController";
import { FloatingPanelDialogHeader } from "../FloatingPanelDialogLayout";
import { PackTruncationHint, PendingStageAHint } from "./PostTranscribeStageBHints";

type EmptyState = Extract<PostTranscribeStageBDialogState, { phase: "empty" }>;

type Props = {
  state: EmptyState;
  pendingHint: string | null;
  packTruncationHint: string | null;
};

export function PostTranscribeStageBEmptyPanel({ state, pendingHint, packTruncationHint }: Props) {
  return (
    <FloatingPanelDialogHeader>
      {pendingHint ? <PendingStageAHint message={pendingHint} /> : null}
      {packTruncationHint ? <PackTruncationHint message={packTruncationHint} /> : null}
      <p className={PANEL_TYPOGRAPHY.dialogBody}>
        {state.stepError
          ? state.stepError
          : "LLM 未对当前语段提出可写回的标点或改字建议。"}
      </p>
    </FloatingPanelDialogHeader>
  );
}
