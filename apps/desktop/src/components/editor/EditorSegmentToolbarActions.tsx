import {
  ListChecks,
  Mic,
  Replace,
  Sparkles,
} from "lucide-react";
import { useRef } from "react";
import { useWorkbenchToolbarCompact } from "../../hooks/useWorkbenchToolbarCompact";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import {
  captureTranscriptTextareaSelection,
  readTranscriptTextareaSelection,
} from "../../utils/transcriptSelection";
import { editorShortcutMenuHint } from "../../utils/editorShortcutMenuHint";
import {
  workbenchDropdownItem,
  workbenchLabelBtnClass,
  workbenchTranscribePrimaryClass,
} from "./editorSegmentToolbarStyles";
import { WorkbenchOverflowMenu } from "./WorkbenchOverflowMenu";

interface EditorSegmentToolbarActionsProps {
  controller: ProjectControllerApi;
  /** 测试/Story 覆盖：`true` 强制紧凑菜单，`false` 强制展开。 */
  compactLayout?: boolean;
}

/** 工作条居中：自动转录 / 规则纠错 / 智能改稿 / 查找替换。 */
export function EditorSegmentTranscribeActions({
  controller: c,
  compactLayout,
}: EditorSegmentToolbarActionsProps) {
  const toolbarTextSelectionRef = useRef("");
  const compactFromMedia = useWorkbenchToolbarCompact();
  const compact = compactLayout ?? compactFromMedia;

  const stageBPhase = c.postTranscribeStageBDialog.phase;
  const stageBInFlight = stageBPhase === "loading";
  const stageBDialogOccupied =
    stageBPhase === "consent" || stageBPhase === "preview" || stageBPhase === "empty";
  const stageBButtonDisabled = c.busy || stageBInFlight || stageBDialogOccupied;
  const stageBHint = c.busy
    ? "处理中"
    : stageBInFlight
      ? "智能改稿处理中…"
      : (c.postTranscribeStageBBlockReason ??
        (c.canOfferPostTranscribeStageB
          ? "词表有据：LLM 标点与改字（一次请求，预览后写回）"
          : "智能改稿不可用"));

  const isTranscribing = c.busy && c.busyReason === "transcribe";
  const transcribePrimary =
    c.segments.length === 0 && !isTranscribing && !c.prepareModelBusy && !c.busy;

  const findReplaceTitle =
    c.busy ? "处理中" : c.canFindReplace
      ? `查找替换（${editorShortcutMenuHint("workflow.find")}）`
      : (c.findReplaceBlockReason ?? "查找替换不可用");

  const editMenuEngaged =
    c.correctionRulesDialog.phase !== "closed" ||
    stageBPhase !== "closed" ||
    c.findReplaceDialog.phase !== "closed";

  if (compact) {
    return (
      <div className="waveform-toolbar-subzone waveform-toolbar-transcribe" role="group" aria-label="转录与编辑">
        <WorkbenchOverflowMenu label="编辑" ariaLabel="编辑菜单" engaged={editMenuEngaged} align="center">
          {(close) => (
            <>
              <button
                type="button"
                className={
                  transcribePrimary
                    ? [workbenchDropdownItem, "font-semibold text-accent-action-strong"].join(" ")
                    : workbenchDropdownItem
                }
                disabled={c.busy || c.prepareModelBusy}
                title={
                  c.prepareModelBusy
                    ? "模型准备中，请稍候"
                    : "打开对话框：选择本机或在线来源并开始转录"
                }
                onClick={() => {
                  close();
                  void c.runTranscribe();
                }}
              >
                <Mic className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                {c.prepareModelBusy ? "模型准备中..." : "自动转录"}
              </button>
              <button
                type="button"
                className={workbenchDropdownItem}
                disabled={!c.canApplyCorrectionRules || c.correctionRulesDialog.phase === "loading"}
                title={
                  c.busy
                    ? "处理中"
                    : c.canApplyCorrectionRules
                      ? "按稳定纠错规则全文替换（预览后写回，不含 LLM）"
                      : (c.correctionRulesBlockReason ?? "规则纠错不可用")
                }
                onClick={() => {
                  close();
                  void c.openCorrectionRulesManual();
                }}
              >
                <ListChecks className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                {c.correctionRulesDialog.phase === "loading" ? "处理中..." : "规则纠错"}
              </button>
              <button
                type="button"
                className={workbenchDropdownItem}
                disabled={stageBButtonDisabled}
                title={stageBHint}
                onClick={() => {
                  close();
                  c.openPostTranscribeStageB();
                }}
              >
                <Sparkles className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                {stageBInFlight ? "处理中..." : "智能改稿"}
              </button>
              <button
                type="button"
                className={workbenchDropdownItem}
                disabled={!c.canFindReplace}
                title={findReplaceTitle}
                onPointerDown={() => {
                  toolbarTextSelectionRef.current = captureTranscriptTextareaSelection();
                }}
                onClick={() => {
                  close();
                  const sel =
                    toolbarTextSelectionRef.current || readTranscriptTextareaSelection();
                  c.openFindReplace(sel || undefined);
                }}
              >
                <Replace className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                查找替换
              </button>
            </>
          )}
        </WorkbenchOverflowMenu>
      </div>
    );
  }

  return (
    <div className="waveform-toolbar-subzone waveform-toolbar-transcribe" role="group" aria-label="转录与编辑">
      <button
        type="button"
        className={transcribePrimary ? workbenchTranscribePrimaryClass() : workbenchLabelBtnClass(false)}
        disabled={c.busy || c.prepareModelBusy}
        onClick={() => void c.runTranscribe()}
        aria-label="自动转录"
        title={
          c.prepareModelBusy
            ? "模型准备中，请稍候"
            : "打开对话框：选择本机或在线来源并开始转录"
        }
      >
        <Mic className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        {c.prepareModelBusy ? "模型准备中..." : "自动转录"}
      </button>
      <button
        type="button"
        className={workbenchLabelBtnClass(c.correctionRulesDialog.phase !== "closed")}
        disabled={!c.canApplyCorrectionRules || c.correctionRulesDialog.phase === "loading"}
        onClick={() => void c.openCorrectionRulesManual()}
        aria-label="规则纠错"
        title={
          c.busy
            ? "处理中"
            : c.canApplyCorrectionRules
              ? "按稳定纠错规则全文替换（预览后写回，不含 LLM）"
              : (c.correctionRulesBlockReason ?? "规则纠错不可用")
        }
      >
        <ListChecks className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        {c.correctionRulesDialog.phase === "loading" ? "处理中..." : "规则纠错"}
      </button>
      <button
        type="button"
        className={[
          workbenchLabelBtnClass(stageBPhase !== "closed"),
          !c.canOfferPostTranscribeStageB && !stageBButtonDisabled
            ? "opacity-75 hover:opacity-100"
            : "",
        ].join(" ")}
        disabled={stageBButtonDisabled}
        onClick={() => c.openPostTranscribeStageB()}
        aria-label="智能改稿"
        title={stageBHint}
      >
        <Sparkles className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        {stageBInFlight ? "处理中..." : "智能改稿"}
      </button>
      <button
        type="button"
        className={workbenchLabelBtnClass(c.findReplaceDialog.phase !== "closed")}
        disabled={!c.canFindReplace}
        onPointerDown={() => {
          toolbarTextSelectionRef.current = captureTranscriptTextareaSelection();
        }}
        onClick={() => {
          const sel =
            toolbarTextSelectionRef.current || readTranscriptTextareaSelection();
          c.openFindReplace(sel || undefined);
        }}
        aria-label="查找替换"
        title={findReplaceTitle}
      >
        <Replace className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        查找替换
      </button>
    </div>
  );
}
