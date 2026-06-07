import type { ExportPolishResult } from "../services/exportDocxPolish";
import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { SegmentDto } from "../tauri/projectApi";
import { AutoTranscribeStartDialog } from "./AutoTranscribeStartDialog";
import { CorrectionRulesPreviewDialog } from "./CorrectionRulesPreviewDialog";
import { DeliveryExportDialog } from "./DeliveryExportDialog";
import { DuplicateImportConfirmDialog } from "./DuplicateImportConfirmDialog";
import { DeleteProjectFileConfirmDialog } from "./DeleteProjectFileConfirmDialog";
import { FindReplaceDialog } from "./FindReplaceDialog";
import { GlossaryLearnPromptDialog } from "./GlossaryLearnPromptDialog";
import { PostTranscribeStageBDialog } from "./PostTranscribeStageBDialog";
import { ManualCorrectionMemoryDialog } from "./segmentRow/ManualCorrectionMemoryDialog";
import { TranscribeNavBlockDialog } from "./TranscribeNavBlockDialog";
import { UnsavedCloseDialog } from "./UnsavedCloseDialog";

export type ProjectPanelDialogsProps = {
  c: ProjectControllerApi;
  deliveryExportOpen: boolean;
  llmStatusRefreshSeq: number;
  segments: SegmentDto[];
  showTranscribeGlossaryLink: boolean;
  onOpenLlmSettings: () => void;
  onOpenGlossaryFromTranscribe: () => void;
  onStayAfterCloseAttempt: () => void;
  onDeliveryExportClose: () => void;
  onDeliveryExport: (
    mode: DocxExportMode,
    includeRevisionAppendix: boolean,
    llmPolish: boolean,
    polishPreview: ExportPolishResult | null,
  ) => void;
};

/** Floating dialogs owned by the project shell — extracted from ProjectPanel orchestration. */
export function ProjectPanelDialogs({
  c,
  deliveryExportOpen,
  llmStatusRefreshSeq,
  segments,
  showTranscribeGlossaryLink,
  onOpenLlmSettings,
  onOpenGlossaryFromTranscribe,
  onStayAfterCloseAttempt,
  onDeliveryExportClose,
  onDeliveryExport,
}: ProjectPanelDialogsProps) {
  return (
    <>
      <FindReplaceDialog
        state={c.findReplaceDialog}
        busy={c.busy}
        onClose={c.closeFindReplace}
        onFindChange={c.setFindReplaceFindText}
        onReplaceChange={c.setFindReplaceReplaceText}
        onRunSearch={c.findReplaceRunSearch}
        onSelectMatch={c.findReplaceSelectMatch}
        onPrev={c.findReplaceGoPrev}
        onNext={c.findReplaceGoNext}
        onReplaceCurrent={c.findReplaceCurrent}
        onReplaceAndNext={c.findReplaceReplaceAndNext}
        onRequestReplaceAll={() => void c.findReplaceRequestReplaceAll()}
        onConfirmReplaceAll={() => void c.findReplaceConfirmReplaceAll()}
        onCancelReplaceAllPreview={c.findReplaceCancelReplaceAllPreview}
      />

      <CorrectionRulesPreviewDialog
        state={c.correctionRulesDialog}
        busy={c.busy}
        stableConflictMessage={c.correctionRulesStableConflictMessage ?? null}
        onCancel={c.cancelCorrectionRules}
        onCloseEmpty={c.closeCorrectionRulesEmpty}
        onConfirm={() => void c.confirmCorrectionRulesWriteback()}
        onToggleSegment={c.toggleCorrectionRulesSegment}
        onFocusSegment={c.focusCorrectionRulesPreviewSegment}
        previewFocusSegmentIdx={c.correctionRulesEditorHighlight?.segmentIdx ?? null}
      />

      <PostTranscribeStageBDialog
        state={c.postTranscribeStageBDialog}
        busy={c.busy}
        previewFocusSegmentIdx={c.postTranscribeStageBPreviewFocusSegmentIdx}
        onCancel={c.cancelPostTranscribeStageB}
        onConfirmConsent={c.confirmPostTranscribeStageBConsent}
        onConfirmWriteback={() => void c.confirmPostTranscribeStageBWriteback()}
        onToggleSegment={c.togglePostTranscribeStageBSegment}
        onFocusSegment={c.focusPostTranscribeStageBSegment}
      />

      <GlossaryLearnPromptDialog
        state={c.glossaryLearnDialog}
        busy={c.busy}
        onClose={c.closeGlossaryLearnPrompt}
        onDismiss={c.dismissGlossaryLearnPrompt}
        onConfirm={(row) => void c.confirmAddToGlossary(row)}
      />

      <ManualCorrectionMemoryDialog
        state={c.manualCorrectionMemoryDialog}
        busy={c.busy}
        onClose={c.closeManualCorrectionMemoryDialog}
        onRightChange={c.setManualCorrectionRight}
        onAlsoAddToGlossaryChange={c.setManualCorrectionAlsoGlossary}
        onConfirm={() => c.confirmManualCorrectionMemory()}
      />

      <AutoTranscribeStartDialog
        open={c.transcribeStartDialogOpen && !c.busy}
        busy={c.busy}
        source={c.transcribeSource}
        onlineReady={c.onlineTranscribeReady}
        onSelectLocal={() => c.setTranscribeSource("local")}
        onSelectOnline={() => c.setTranscribeSource("online")}
        hasExistingSegmentText={c.transcribeStartHasExistingText}
        segmentCount={c.transcribeOverwriteSegmentCount}
        vocabularyLines={c.transcribeVocabularyPreflightLines}
        showOpenGlossaryLink={showTranscribeGlossaryLink}
        onOpenGlossary={onOpenGlossaryFromTranscribe}
        onCancel={c.cancelTranscribeStart}
        onConfirm={() => void c.confirmTranscribeStart()}
      />

      <DeliveryExportDialog
        open={deliveryExportOpen}
        busy={c.busy}
        segments={segments}
        llmStatusRefreshSeq={llmStatusRefreshSeq}
        onOpenLlmSettings={onOpenLlmSettings}
        onClose={onDeliveryExportClose}
        onExport={(mode, includeRevisionAppendix, llmPolish, polishPreview) => {
          onDeliveryExportClose();
          onDeliveryExport(mode, includeRevisionAppendix, llmPolish, polishPreview);
        }}
      />

      <UnsavedCloseDialog
        open={c.closeGateOpen}
        intent={c.closeGateIntent}
        busy={c.busy}
        onStay={onStayAfterCloseAttempt}
        onDiscardAndClose={() => void c.discardUnsavedAndClose()}
        onSaveAndClose={() => void c.saveAndClose()}
      />

      <DuplicateImportConfirmDialog
        open={c.duplicateImportConfirmOpen}
        checking={c.duplicateImportChecking}
        check={c.duplicateImportCheck}
        onCancel={c.cancelDuplicateImport}
        onOpenExisting={c.openExistingDuplicateImport}
        onConfirmCopy={c.confirmDuplicateImportCopy}
      />

      <TranscribeNavBlockDialog
        open={c.transcribeNavBlockOpen}
        busy={c.busy}
        onStay={c.cancelTranscribeNavBlock}
        onStopAndLeave={() => void c.confirmTranscribeNavBlock()}
      />

      <DeleteProjectFileConfirmDialog
        open={c.pendingProjectFileDelete != null}
        fileName={c.pendingProjectFileDelete?.fileName ?? null}
        busy={c.busy}
        onCancel={c.cancelDeleteProjectFile}
        onConfirm={() => void c.confirmDeleteProjectFile()}
      />
    </>
  );
}
