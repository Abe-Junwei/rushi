import { BookOpen } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { useGlossaryPageController } from "../pages/useGlossaryPageController";
import { GlossaryCorrectionMemorySection } from "./glossary/GlossaryCorrectionMemorySection";
import { GlossaryHotwordsSummarySection } from "./glossary/GlossaryHotwordsSummarySection";
import { GlossaryLexiconBundleSection } from "./glossary/GlossaryLexiconBundleSection";
import { GlossaryMineSection } from "./glossary/GlossaryMineSection";
import { GlossaryTermManagementSection } from "./glossary/GlossaryTermManagementSection";
import { LexiconBundleExportDialog } from "./glossary/LexiconBundleExportDialog";
import { LexiconBundleImportDialog } from "./glossary/LexiconBundleImportDialog";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type GlossaryPageProps = {
  busy: boolean;
};

export function GlossaryPage({ busy }: GlossaryPageProps) {
  const page = useGlossaryPageController(busy);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-notion-bg px-10 py-8"
      data-purpose="hotwords-memory-page"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-2 border-b border-notion-divider pb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zen-saffron/15 text-zen-saffron">
              <BookOpen className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <h1 className={PANEL_TYPOGRAPHY.envPageTitle}>热词与记忆</h1>
              <p className={PANEL_TYPOGRAPHY.envPageSubtitle}>
                <strong className="font-medium text-notion-text">转写词汇表（Custom Vocabulary）</strong>
                ：只收录希望听成的正形，纳入热词后在下次 ASR 拉取时提交。
                <strong className="font-medium text-notion-text">纠错记忆</strong>
                ：错→对，用于改正建议与编辑内规则，错形不会进入转写热词。
              </p>
            </div>
          </div>
        </header>

        <GlossaryHotwordsSummarySection g={page.g} />

        <GlossaryTermManagementSection
          g={page.g}
          disabled={page.disabled}
          deleteConfirmId={page.deleteConfirmId}
          headerCheckboxRef={page.headerCheckboxRef}
          termEditorRef={page.termEditorRef}
          termEditorOpen={page.termEditorOpen}
          openTermEditor={page.openTermEditor}
          closeTermEditor={page.closeTermEditor}
          handleSelectTerm={page.handleSelectTerm}
          handleDeleteFromEditor={page.handleDeleteFromEditor}
          handleRowDelete={page.handleRowDelete}
        />

        <GlossaryMineSection mine={page.mine} disabled={page.disabled} />

        <GlossaryCorrectionMemorySection
          mem={page.mem}
          disabled={page.disabled}
          memoryHeaderCheckboxRef={page.memoryHeaderCheckboxRef}
          memoryEditorRef={page.memoryEditorRef}
          memEditorOpen={page.memEditorOpen}
          openMemEditor={page.openMemEditor}
          closeMemEditor={page.closeMemEditor}
          handleSelectMemoryRow={page.handleSelectMemoryRow}
          memoryConflicts={page.memoryConflicts}
        />

        <GlossaryLexiconBundleSection
          lex={page.lex}
          disabled={page.disabled}
          bundleStatus={page.bundleStatus}
          bundleError={page.bundleError}
        />

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
    </div>
  );
}
