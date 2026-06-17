import { CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PostTranscribeStageBDialogState } from "../../pages/usePostTranscribeStageBController";
import {
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
} from "../FloatingPanelDialogLayout";
import { PackTruncationHint, PendingStageAHint } from "./PostTranscribeStageBHints";

type EmptyState = Extract<PostTranscribeStageBDialogState, { phase: "empty" }>;

type Props = {
  state: EmptyState;
  pendingHint: string | null;
  packTruncationHint: string | null;
  onClose: () => void;
};

export function PostTranscribeStageBEmptyPanel({
  state,
  pendingHint,
  packTruncationHint,
  onClose,
}: Props) {
  return (
    <>
      <FloatingPanelDialogHeader>
        {pendingHint ? <PendingStageAHint message={pendingHint} /> : null}
        {packTruncationHint ? <PackTruncationHint message={packTruncationHint} /> : null}
        <p className={PANEL_TYPOGRAPHY.dialogBody}>
          {state.stepError
            ? state.stepError
            : "LLM 未对当前语段提出可写回的标点或改字建议。"}
        </p>
      </FloatingPanelDialogHeader>
      <FloatingPanelDialogFooter justify="end">
        <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onClose}>
          关闭
        </button>
      </FloatingPanelDialogFooter>
    </>
  );
}
