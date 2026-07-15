import type { DocxExportMode } from "../tauri/exportDocxApi";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { SegmentDto } from "../tauri/projectApi";
import { AutoTranscribeStartDialog } from "./AutoTranscribeStartDialog";
import { CorrectionRulesPreviewDialog } from "./CorrectionRulesPreviewDialog";
import { DeliveryExportDialog } from "./DeliveryExportDialog";
import { DeliveryModeDialog } from "./DeliveryModeDialog";
import { DuplicateImportConfirmDialog } from "./DuplicateImportConfirmDialog";
import { AttachImportTargetDialog } from "./AttachImportTargetDialog";
import { BatchTranscribeQueueDialog } from "./BatchTranscribeQueueDialog";
import { DeleteProjectFileConfirmDialog } from "./DeleteProjectFileConfirmDialog";
import { DeleteProjectConfirmDialog } from "./DeleteProjectConfirmDialog";
import { MoveProjectFileConfirmDialog } from "./MoveProjectFileConfirmDialog";
import { CopyProjectFileConfirmDialog } from "./CopyProjectFileConfirmDialog";
import { ProjectMetadataDialog } from "./ProjectMetadataDialog";
import { FindReplaceDialog } from "./FindReplaceDialog";
import { GlossaryLearnPromptDialog } from "./GlossaryLearnPromptDialog";
import { PostTranscribeStageBDialog } from "./PostTranscribeStageBDialog";
import { SegmentAnnotationDialog } from "./SegmentAnnotationDialog";
import { ManualCorrectionMemoryDialog } from "./segmentRow/ManualCorrectionMemoryDialog";
import { TranscribeNavBlockDialog } from "./TranscribeNavBlockDialog";
import { UnsavedCloseDialog } from "./UnsavedCloseDialog";
import { transcribeCancelStoppingLabel } from "./projectStatusFeedbackCopy";

export type ProjectPanelDialogsProps = {
  c: ProjectControllerApi;
  deliveryModeOpen: boolean;
  deliveryExportOpen: boolean;
  llmStatusRefreshSeq: number;
  segments: SegmentDto[];
  hasRecordedMetadata: boolean;
  showTranscribeGlossaryLink: boolean;
  onOpenLlmSettings: () => void;
  onOpenGlossaryFromTranscribe: () => void;
  onStayAfterCloseAttempt: () => void;
  onDeliveryModeClose: () => void;
  onDeliveryModeContinue: () => void;
  onDeliveryExportClose: () => void;
  onDeliveryExport: (
    mode: DocxExportMode,
    includeRevisionAppendix: boolean,
    includeProjectMetadata: boolean,
    llmPolish: boolean,
  ) => void;
};

/** Floating dialogs owned by the project shell — extracted from ProjectPanel orchestration. */
export function ProjectPanelDialogs({
  c,
  deliveryModeOpen,
  deliveryExportOpen,
  llmStatusRefreshSeq,
  segments,
  hasRecordedMetadata,
  showTranscribeGlossaryLink,
  onOpenLlmSettings,
  onOpenGlossaryFromTranscribe,
  onStayAfterCloseAttempt,
  onDeliveryModeClose,
  onDeliveryModeContinue,
  onDeliveryExportClose,
  onDeliveryExport,
}: ProjectPanelDialogsProps) {
  const annotationDialog = c.segmentAnnotationDialog;
  const annotationSegment =
    annotationDialog.phase === "edit" ? (segments[annotationDialog.segmentIdx] ?? null) : null;
  const annotationSegmentIdx =
    annotationDialog.phase === "edit" ? annotationDialog.segmentIdx : 0;

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
        prepareModelBusy={c.prepareModelBusy}
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

      <DeliveryModeDialog
        open={deliveryModeOpen}
        busy={c.busy}
        segments={segments}
        projectName={c.current?.name ?? ""}
        hasRecordedMetadata={hasRecordedMetadata}
        canApplyCorrectionRules={c.canApplyCorrectionRules}
        correctionRulesBlockReason={c.correctionRulesBlockReason}
        onOpenPostTranscribeRules={() => {
          onDeliveryModeClose();
          c.requestPostTranscribeProcessing();
        }}
        canOfferPostTranscribeStageB={c.canOfferPostTranscribeStageB}
        postTranscribeStageBBlockReason={c.postTranscribeStageBBlockReason}
        onOpenPostTranscribeStageB={() => {
          onDeliveryModeClose();
          c.openPostTranscribeStageB();
        }}
        onClose={onDeliveryModeClose}
        onContinueToExport={onDeliveryModeContinue}
      />

      <DeliveryExportDialog
        open={deliveryExportOpen}
        busy={c.busy}
        segments={segments}
        projectName={c.current?.name ?? ""}
        documentTitle={
          (c.currentFileId
            ? c.current?.files?.find((f) => f.id === c.currentFileId)?.name
            : undefined)?.trim() ||
          c.current?.name ||
          ""
        }
        projectMetadata={{
          narrator: c.current?.narrator,
          recorded_at: c.current?.recorded_at,
          location: c.current?.location,
          subject: c.current?.subject,
          transcriber: c.current?.transcriber,
        }}
        llmStatusRefreshSeq={llmStatusRefreshSeq}
        onOpenLlmSettings={onOpenLlmSettings}
        onClose={onDeliveryExportClose}
        onExport={(mode, includeRevisionAppendix, includeProjectMetadata, llmPolish) => {
          onDeliveryExportClose();
          onDeliveryExport(mode, includeRevisionAppendix, includeProjectMetadata, llmPolish);
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

      <BatchTranscribeQueueDialog
        open={c.batchQueueOpen}
        running={c.batchTranscribeRunning}
        items={c.batchQueueItems}
        transcribeProgress={c.transcribeProgress}
        onClose={c.closeBatchQueueDialog}
        onStop={() => void c.cancelBatchTranscribe()}
      />

      <DuplicateImportConfirmDialog
        open={c.duplicateImportConfirmOpen}
        checking={c.duplicateImportChecking}
        check={c.duplicateImportCheck}
        onCancel={c.cancelDuplicateImport}
        onOpenExisting={c.openExistingDuplicateImport}
        onConfirmCopy={c.confirmDuplicateImportCopy}
      />

      <AttachImportTargetDialog
        open={c.attachImportTargetOpen}
        candidates={c.attachImportTargetCandidates}
        transcriptStem={c.attachImportTargetStem}
        onCancel={c.cancelAttachImportTarget}
        onSelect={c.confirmAttachImportTarget}
      />

      <TranscribeNavBlockDialog
        open={c.transcribeNavBlockOpen}
        stopping={c.transcribeNavBlockStopping}
        stoppingLabel={
          c.busyReason === "batch_transcribe"
            ? "正在停止…"
            : transcribeCancelStoppingLabel(c.transcribeSource)
        }
        mode={c.busyReason === "batch_transcribe" ? "batch" : "single"}
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

      <MoveProjectFileConfirmDialog
        open={c.pendingProjectFileMove != null}
        fileName={c.pendingProjectFileMove?.fileName ?? null}
        destProjectName={c.pendingProjectFileMove?.destProjectName ?? null}
        busy={c.busy}
        onCancel={c.cancelMoveProjectFile}
        onConfirm={() => void c.confirmMoveProjectFile()}
      />

      <CopyProjectFileConfirmDialog
        open={c.pendingProjectFileCopy != null}
        fileName={c.pendingProjectFileCopy?.fileName ?? null}
        destProjectName={c.pendingProjectFileCopy?.destProjectName ?? null}
        busy={c.busy}
        onCancel={c.cancelCopyProjectFile}
        onConfirm={() => void c.confirmCopyProjectFile()}
      />

      <DeleteProjectConfirmDialog
        open={c.pendingProjectDelete != null}
        projectName={c.pendingProjectDelete?.projectName ?? null}
        busy={c.busy}
        onCancel={c.cancelDeleteProject}
        onConfirm={() => void c.confirmDeleteProject()}
      />

      <ProjectMetadataDialog
        open={c.projectMetadataDialogOpen}
        afterCreate={c.projectMetadataAfterCreate}
        project={c.current}
        projects={c.projects}
        busy={c.busy}
        onClose={c.closeProjectMetadataDialog}
        onSave={(form) => void c.saveProjectMetadata(form)}
      />

      <SegmentAnnotationDialog
        state={annotationDialog}
        segment={annotationSegment}
        segmentIdx={annotationSegmentIdx}
        busy={c.busy || c.segmentAnnotationSaving}
        onClose={c.closeSegmentAnnotationDialog}
        onSave={(draft) => void c.saveSegmentAnnotation(draft)}
        onClear={() => void c.clearSegmentAnnotation()}
      />
    </>
  );
}
