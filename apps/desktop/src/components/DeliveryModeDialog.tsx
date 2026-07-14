import { useMemo } from "react";
import {
  IconCheck as Check,
  IconAlertCircle as CircleAlert,
} from "@tabler/icons-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import {
  buildDeliveryFinalChecklist,
  deliveryFinalChecklistBlockingReason,
  deliveryFinalChecklistReady,
} from "../services/deliveryModeChecklist";
import { DELIVERY_MODE_PREP_STEPS } from "../services/deliveryModeSteps";
import type { SegmentDto } from "../tauri/projectApi";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const PANEL_ID = "delivery-mode-v1";
const DEFAULT_WIDTH = 400;
/** 首帧兜底；staticFit 下实际高度由内容 CSS 自动贴合。 */
const FALLBACK_HEIGHT = 280;

const INTRO_CLASS = `${PANEL_TYPOGRAPHY.dialogBody} m-0 leading-snug text-notion-text-muted`;
const SECTION_LABEL_CLASS = "m-0 text-label font-medium leading-snug text-notion-text-muted";
const CARD_CLASS = "flex flex-col gap-0.5 rounded-md bg-notion-sidebar/50 px-2.5 py-1.5";
const CARD_TITLE_CLASS = "m-0 text-body font-medium leading-snug text-notion-text";
const CARD_BODY_CLASS = "m-0 text-body leading-snug text-notion-text-muted";
const ACTION_LINK_CLASS = `${CONTROL_BTN_LINK} self-start text-label leading-snug text-accent-action hover:text-accent-action-strong hover:underline`;
const ACTION_UNAVAILABLE_LABEL_CLASS = "m-0 text-label leading-snug text-notion-text-muted";
const ACTION_UNAVAILABLE_REASON_CLASS = "m-0 text-label leading-snug text-notion-text-light";

function DeliveryPrepAction({
  label,
  available,
  unavailableReason,
  onClick,
}: {
  label: string;
  available: boolean;
  unavailableReason: string | null;
  onClick: () => void;
}) {
  if (!available) {
    return (
      <div className="flex flex-col gap-0.5 self-start">
        <p className={ACTION_UNAVAILABLE_LABEL_CLASS}>{label}</p>
        {unavailableReason ? (
          <p className={ACTION_UNAVAILABLE_REASON_CLASS} role="status">
            {unavailableReason}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <button type="button" className={ACTION_LINK_CLASS} onClick={onClick}>
      {label}
    </button>
  );
}

function resolvePrepActionUnavailableReason(
  available: boolean,
  blockReason: string | null,
  busy: boolean,
): string | null {
  if (available) return null;
  if (busy) return "处理中，请稍候";
  return blockReason ?? "暂不可用";
}

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

  const rulesUnavailableReason = resolvePrepActionUnavailableReason(
    canApplyCorrectionRules,
    correctionRulesBlockReason,
    busy,
  );
  const stageBUnavailableReason = resolvePrepActionUnavailableReason(
    canOfferPostTranscribeStageB,
    postTranscribeStageBBlockReason,
    busy,
  );

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="定稿模式"
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      fallbackHeight={FALLBACK_HEIGHT}
      fitKind="staticFit"
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 320, minHeight: 200, maxWidthCap: 480 }}
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
      <div className="flex flex-col gap-2.5">
        <p className={INTRO_CLASS}>
          定稿向导 · 项目「{projectName || "未命名"}」：可选规则纠错与智能改稿 → 终检 → 交付导出 Word。
        </p>

        <section className="flex flex-col gap-1" aria-label="转写后处理">
          <h3 className={SECTION_LABEL_CLASS}>转写后处理（可选）</h3>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {rulesStep ? (
              <li className={CARD_CLASS}>
                <p className={CARD_TITLE_CLASS}>{rulesStep.title}</p>
                <p className={CARD_BODY_CLASS}>{rulesStep.description}</p>
                <DeliveryPrepAction
                  label="打开规则纠错预览…"
                  available={!busy && canApplyCorrectionRules}
                  unavailableReason={rulesUnavailableReason}
                  onClick={onOpenPostTranscribeRules}
                />
              </li>
            ) : null}
            {stageBStep ? (
              <li className={CARD_CLASS}>
                <p className={CARD_TITLE_CLASS}>{stageBStep.title}</p>
                <p className={CARD_BODY_CLASS}>{stageBStep.description}</p>
                <DeliveryPrepAction
                  label="打开智能改稿…"
                  available={!busy && canOfferPostTranscribeStageB}
                  unavailableReason={stageBUnavailableReason}
                  onClick={onOpenPostTranscribeStageB}
                />
              </li>
            ) : null}
          </ul>
        </section>

        <section className="flex flex-col gap-1" aria-label="终检">
          <h3 className={SECTION_LABEL_CLASS}>终检</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {items.map((item) => (
              <li
                key={item.id}
                className={[
                  "flex items-start gap-1.5 rounded-md px-2.5 py-1.5",
                  item.ok ? "bg-notion-sidebar/50 text-notion-text" : "bg-zen-cinnabar/8 text-notion-text",
                ].join(" ")}
              >
                <span className="mt-px shrink-0" aria-hidden>
                  {item.ok ? (
                    <Check
                      className={`${LUCIDE_ICON_SIZE_SM} text-zen-success`}
                      strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                    />
                  ) : (
                    <CircleAlert
                      className={`${LUCIDE_ICON_SIZE_SM} text-zen-cinnabar`}
                      strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                    />
                  )}
                </span>
                <div className="flex min-w-0 flex-col gap-0">
                  <p className="m-0 text-body font-medium leading-snug">{item.label}</p>
                  {item.hint ? (
                    <p className="m-0 text-body leading-snug text-notion-text-muted">{item.hint}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {!ready && blockReason ? (
          <p className="m-0 text-body leading-snug text-zen-cinnabar" role="status">
            {blockReason}
          </p>
        ) : null}
      </div>
    </CompactFloatingDialog>
  );
}
