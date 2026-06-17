import { useMemo } from "react";
import { Check, CircleAlert } from "lucide-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelDialogHeader } from "./FloatingPanelDialogLayout";
import {
  buildDeliveryFinalChecklist,
  deliveryFinalChecklistBlockingReason,
  deliveryFinalChecklistReady,
} from "../services/deliveryModeChecklist";
import { DELIVERY_MODE_PREP_STEPS } from "../services/deliveryModeSteps";
import type { SegmentDto } from "../tauri/projectApi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const PANEL_ID = "delivery-mode-v1";
const DEFAULT_WIDTH = 420;
const FALLBACK_HEIGHT = 420;

type Props = {
  open: boolean;
  busy: boolean;
  segments: SegmentDto[];
  projectName: string;
  hasRecordedMetadata: boolean;
  canApplyCorrectionRules: boolean;
  correctionRulesBlockReason: string | null;
  onOpenPostTranscribeRules: () => void;
  canOfferPostTranscribeStageB: boolean;
  postTranscribeStageBBlockReason: string | null;
  onOpenPostTranscribeStageB: () => void;
  onClose: () => void;
  onContinueToExport: () => void;
};

export function DeliveryModeDialog({
  open,
  busy,
  segments,
  projectName,
  hasRecordedMetadata,
  canApplyCorrectionRules,
  correctionRulesBlockReason,
  onOpenPostTranscribeRules,
  canOfferPostTranscribeStageB,
  postTranscribeStageBBlockReason,
  onOpenPostTranscribeStageB,
  onClose,
  onContinueToExport,
}: Props) {
  const items = useMemo(
    () =>
      buildDeliveryFinalChecklist({
        segments,
        hasRecordedMetadata,
      }),
    [segments, hasRecordedMetadata],
  );
  const ready = deliveryFinalChecklistReady(items);
  const blockReason = deliveryFinalChecklistBlockingReason(items);

  const rulesStep = DELIVERY_MODE_PREP_STEPS.find((s) => s.id === "rules");
  const stageBStep = DELIVERY_MODE_PREP_STEPS.find((s) => s.id === "stage_b");

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="定稿模式"
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fallbackHeight={FALLBACK_HEIGHT}
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 320, minHeight: 320, maxWidthCap: 480 }}
      persistState
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className={CONTROL_BTN_PRIMARY}
            disabled={busy || !ready}
            onClick={onContinueToExport}
          >
            继续 → 交付导出 Word
          </button>
        </>
      }
      footerJustify="end"
    >
      <FloatingPanelDialogHeader>
        <p className="text-sm leading-relaxed text-notion-text-muted">
          定稿向导 · 项目「{projectName || "未命名"}」：可选规则纠错与智能改稿 → 终检 → 交付导出 Word。
        </p>
      </FloatingPanelDialogHeader>

      <section className="mb-3 px-1" aria-label="转写后处理">
        <h3 className="mb-2 text-body font-semibold uppercase tracking-wide text-notion-text-muted">
          转写后处理（可选）
        </h3>
        <ul className="flex flex-col gap-2">
          {rulesStep ? (
            <li className="flex flex-col gap-1.5 rounded-md bg-notion-sidebar/50 px-2.5 py-2 text-title">
              <p className="font-medium text-notion-text">{rulesStep.title}</p>
              <p className="text-body leading-relaxed text-notion-text-muted">{rulesStep.description}</p>
              <button
                type="button"
                className={`${CONTROL_BTN_LINK} self-start text-body`}
                disabled={busy || !canApplyCorrectionRules}
                title={canApplyCorrectionRules ? undefined : (correctionRulesBlockReason ?? "不可用")}
                onClick={onOpenPostTranscribeRules}
              >
                打开规则纠错预览…
              </button>
            </li>
          ) : null}
          {stageBStep ? (
            <li className="flex flex-col gap-1.5 rounded-md bg-notion-sidebar/50 px-2.5 py-2 text-title">
              <p className="font-medium text-notion-text">{stageBStep.title}</p>
              <p className="text-body leading-relaxed text-notion-text-muted">{stageBStep.description}</p>
              <button
                type="button"
                className={`${CONTROL_BTN_LINK} self-start text-body`}
                disabled={busy || !canOfferPostTranscribeStageB}
                title={
                  canOfferPostTranscribeStageB ? undefined : (postTranscribeStageBBlockReason ?? "不可用")
                }
                onClick={onOpenPostTranscribeStageB}
              >
                打开智能改稿…
              </button>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="px-1" aria-label="终检">
        <h3 className="mb-2 text-body font-semibold uppercase tracking-wide text-notion-text-muted">终检</h3>
        <ul className="flex flex-col gap-2 pb-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={[
                "flex items-start gap-2 rounded-md px-2.5 py-2 text-title",
                item.ok ? "bg-notion-sidebar/50 text-notion-text" : "bg-zen-cinnabar/8 text-notion-text",
              ].join(" ")}
            >
              <span className="shrink-0" aria-hidden>
                {item.ok ? (
                  <Check className={`${LUCIDE_ICON_SIZE_SM} text-zen-forest`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} />
                ) : (
                  <CircleAlert
                    className={`${LUCIDE_ICON_SIZE_SM} text-zen-cinnabar`}
                    strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                  />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="font-medium">{item.label}</p>
                {item.hint ? (
                  <p className="text-body leading-relaxed text-notion-text-muted">{item.hint}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {!ready && blockReason ? (
        <p className="px-1 text-body text-zen-cinnabar" role="status">
          {blockReason}
        </p>
      ) : null}
    </CompactFloatingDialog>
  );
}
