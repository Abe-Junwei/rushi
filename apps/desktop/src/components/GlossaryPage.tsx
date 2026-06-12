import type { GlossaryWorkspaceId } from "./glossary/glossaryWorkspaceTypes";
import { useGlossaryPageCompactFromElement } from "../hooks/useGlossaryPageCompact";
import { useGlossaryPageController } from "../pages/useGlossaryPageController";
import { GlossaryBundleWorkspace } from "./glossary/GlossaryBundleWorkspace";
import { GlossaryBulkAddDialog } from "./glossary/GlossaryBulkAddDialog";
import { GlossaryCorrectionMemorySection } from "./glossary/GlossaryCorrectionMemorySection";
import { GlossaryTermManagementSection } from "./glossary/GlossaryTermManagementSection";
import { GlossaryWorkspaceSegmentedNav } from "./glossary/GlossaryWorkspaceSegmentedNav";
import { LexiconBundleExportDialog } from "./glossary/LexiconBundleExportDialog";
import { LexiconBundleImportDialog } from "./glossary/LexiconBundleImportDialog";

type GlossaryPageProps = {
  busy: boolean;
  workspaceId: GlossaryWorkspaceId;
  onWorkspaceChange: (id: GlossaryWorkspaceId) => void;
};

export function GlossaryPage({ busy, workspaceId, onWorkspaceChange }: GlossaryPageProps) {
  const page = useGlossaryPageController(busy, workspaceId);
  const { rootRef, compact } = useGlossaryPageCompactFromElement();

  return (
    <div
      ref={rootRef}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-notion-bg"
      data-purpose="hotwords-memory-page"
    >
      {compact ? (
        <GlossaryWorkspaceSegmentedNav
          value={workspaceId}
          disabled={page.disabled}
          onChange={onWorkspaceChange}
        />
      ) : null}

      {workspaceId === "vocabulary" ? (
        <GlossaryTermManagementSection
          g={page.g}
          disabled={page.disabled}
          compact={compact}
          headerCheckboxRef={page.headerCheckboxRef}
          termEditorOpen={page.termEditorOpen}
          openTermEditor={page.openTermEditor}
          closeTermEditor={page.closeTermEditor}
          openBulkAddDialog={page.openBulkAddDialog}
          handleSelectTerm={page.handleSelectTerm}
          handleDeleteFromEditor={page.handleDeleteFromEditor}
          mine={page.mine}
        />
      ) : null}

      {workspaceId === "memory" ? (
        <GlossaryCorrectionMemorySection
          mem={page.mem}
          disabled={page.disabled}
          compact={compact}
          memoryHeaderCheckboxRef={page.memoryHeaderCheckboxRef}
          memEditorOpen={page.memEditorOpen}
          openMemEditor={page.openMemEditor}
          closeMemEditor={page.closeMemEditor}
          handleSelectMemoryRow={page.handleSelectMemoryRow}
          memoryConflicts={page.memoryConflicts}
        />
      ) : null}

      {workspaceId === "bundle" ? (
        <GlossaryBundleWorkspace
          lex={page.lex}
          disabled={page.disabled}
          bundleStatus={page.bundleStatus}
          bundleError={page.bundleError}
        />
      ) : null}

      {page.bulkAddDialogOpen ? (
        <GlossaryBulkAddDialog
          bulkPaste={page.g.bulkPaste}
          disabled={page.disabled}
          busy={page.g.busy}
          onBulkPasteChange={page.g.setBulkPaste}
          onCancel={page.closeBulkAddDialog}
          onConfirm={() => void page.handleBulkAddConfirm()}
          onImportFromFile={page.handleBulkImportFromFile}
        />
      ) : null}

      {page.lex.exportDialogOpen ? (
        <LexiconBundleExportDialog
          preview={page.lex.exportPreview}
          previewLoading={page.lex.exportPreviewLoading}
          stableOnly={page.lex.exportStableOnly}
          exportLabel={page.lex.exportLabel}
          disabled={page.disabled}
          onStableOnlyChange={(checked) => void page.lex.setExportStableOnly(checked)}
          onExportLabelChange={page.lex.setExportLabel}
          onCancel={page.lex.cancelExport}
          onConfirm={() => void page.lex.confirmExport()}
        />
      ) : null}

      {page.lex.pendingImport ? (
        <LexiconBundleImportDialog
          pending={page.lex.pendingImport}
          resolutions={page.lex.resolutions}
          disabled={page.disabled}
          onChoice={page.lex.setConflictChoice}
          onCancel={page.lex.cancelImport}
          onConfirm={() => void page.lex.confirmImportWithResolutions()}
        />
      ) : null}
    </div>
  );
}
