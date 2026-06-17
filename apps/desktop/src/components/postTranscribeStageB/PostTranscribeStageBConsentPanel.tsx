import { ENV_NAV } from "../../config/environmentNavCopy";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PostTranscribeStageBDialogState } from "../../pages/usePostTranscribeStageBController";
import {
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
} from "../FloatingPanelDialogLayout";
import { PendingStageAHint } from "./PostTranscribeStageBHints";

type ConsentState = Extract<PostTranscribeStageBDialogState, { phase: "consent" }>;

type Props = {
  state: ConsentState;
  busy: boolean;
  pendingHint: string | null;
  onCancel: () => void;
  onConfirmConsent: () => void;
};

export function PostTranscribeStageBConsentPanel({
  state,
  busy,
  pendingHint,
  onCancel,
  onConfirmConsent,
}: Props) {
  return (
    <>
      <FloatingPanelDialogHeader>
        {pendingHint ? <PendingStageAHint message={pendingHint} /> : null}
        <p className={PANEL_TYPOGRAPHY.dialogBody}>
          将对当前文件最多 {state.segmentCount} 条有正文的语段请求标点与改字候选（按「{ENV_NAV.llm}」发送；一次请求合并标点与词表有据改字）。正文不会在未经确认的情况下被改写；不会合并或拆分语段。
        </p>
      </FloatingPanelDialogHeader>
      <FloatingPanelDialogFooter justify="end">
        <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
          取消
        </button>
        <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirmConsent}>
          我已知晓，继续
        </button>
      </FloatingPanelDialogFooter>
    </>
  );
}
