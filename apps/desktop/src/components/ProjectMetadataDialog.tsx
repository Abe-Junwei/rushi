import { useEffect, useMemo, useState } from "react";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type { ProjectDetail, ProjectSummary } from "../tauri/projectApi";
import type { ProjectMetadataForm } from "../pages/useProjectMutationController";
import { findDuplicateProjectNames, suggestUniqueProjectName } from "../utils/projectDuplicateName";
import { normalizeRecordedAtForSave } from "../utils/projectRecordedAt";
import { ProjectRecordedAtField } from "./ProjectRecordedAtField";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelDialogHeader, FloatingPanelDialogScroll } from "./FloatingPanelDialogLayout";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";

const PANEL_ID = "project-metadata-dialog-v1";
const FORM_ID = "project-metadata-form";
const PANEL_WIDTH = 440;
/** 标题栏 + 固定页脚 + 表单区保守估算。 */
const FALLBACK_HEIGHT = { base: 560, afterCreate: 584, duplicate: 628 } as const;
const PANEL_MIN = { width: 360, height: 420 } as const;

const METADATA_FIELDS: Array<{
  key: Exclude<keyof ProjectMetadataForm, "name">;
  label: string;
  placeholder: string;
}> = [
  { key: "narrator", label: "讲述人", placeholder: "主要说话人 / 被访者" },
  { key: "location", label: "地点", placeholder: "采集或内容相关地点" },
  { key: "subject", label: "主题", placeholder: "场次主题（可与项目名区分）" },
  { key: "transcriber", label: "转录人", placeholder: "转写 / 校对负责人" },
];

type ProjectMetadataDialogProps = {
  open: boolean;
  afterCreate?: boolean;
  project: ProjectDetail | null;
  projects: ProjectSummary[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: ProjectMetadataForm) => void | Promise<void>;
};

function formFromProject(project: ProjectDetail | null): ProjectMetadataForm {
  if (!project) {
    return { name: "", narrator: "", recorded_at: "", location: "", subject: "", transcriber: "" };
  }
  return {
    name: project.name ?? "",
    narrator: project.narrator ?? "",
    recorded_at: project.recorded_at ?? "",
    location: project.location ?? "",
    subject: project.subject ?? "",
    transcriber: project.transcriber ?? "",
  };
}

export function ProjectMetadataDialog({
  open,
  afterCreate = false,
  project,
  projects,
  busy,
  onClose,
  onSave,
}: ProjectMetadataDialogProps) {
  const initial = useMemo(() => formFromProject(project), [project, open]);
  const [draft, setDraft] = useState<ProjectMetadataForm>(initial);

  useEffect(() => {
    if (open) setDraft(formFromProject(project));
  }, [open, project]);

  const duplicateProjects = useMemo(
    () => findDuplicateProjectNames(projects, draft.name, project?.id),
    [draft.name, project?.id, projects],
  );
  const hasDuplicateWarning = duplicateProjects.length > 0;
  const estimatedFitHeight = hasDuplicateWarning
    ? FALLBACK_HEIGHT.duplicate
    : afterCreate
      ? FALLBACK_HEIGHT.afterCreate
      : FALLBACK_HEIGHT.base;
  const layoutRev = (afterCreate ? 1 : 0) + (hasDuplicateWarning ? 2 : 0);

  if (!open || !project) return null;

  const intro = afterCreate
    ? "项目已创建。请填写项目名称与场次信息，便于归档与导出（全部可选，可稍后在 Hub 补充）。"
    : "记录场次元信息，便于归档与导出抬头。全部字段可选。";

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="项目信息"
      open={open}
      onClose={onClose}
      fallbackHeight={FALLBACK_HEIGHT.base}
      estimatedFitHeight={estimatedFitHeight}
      layoutRev={layoutRev}
      measureBody
      fillHeight
      defaultWidth={PANEL_WIDTH}
      bounds={{ minWidth: PANEL_MIN.width, minHeight: PANEL_MIN.height, maxWidthCap: 520, maxHeightCap: 720 }}
      panelZIndex={110}
      footer={
        <>
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={busy}
            onClick={onClose}
          >
            {afterCreate ? "稍后填写" : "取消"}
          </button>
          <button type="submit" form={FORM_ID} className={CONTROL_BTN_PRIMARY} disabled={busy}>
            {busy ? "保存中…" : "保存"}
          </button>
        </>
      }
      footerJustify="end"
    >
      <form
        id={FORM_ID}
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void onSave({
            ...draft,
            recorded_at: normalizeRecordedAtForSave(draft.recorded_at),
          });
        }}
      >
        <FloatingPanelDialogHeader>
          <p className={PANEL_TYPOGRAPHY.dialogBody}>{intro}</p>
        </FloatingPanelDialogHeader>
        <FloatingPanelDialogScroll className="space-y-4">
          <label className="block">
            <span className={`mb-1.5 block ${PANEL_TYPOGRAPHY.fieldLabel}`}>项目名称</span>
            <input
              type="text"
              className={`w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 ${PANEL_CONTROL_TYPOGRAPHY.compactInput} shadow-none outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-40`}
              placeholder="未命名项目"
              value={draft.name}
              disabled={busy}
              autoComplete="off"
              autoFocus={afterCreate}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
            />
            {hasDuplicateWarning ? (
              <p className={`mt-1.5 ${PANEL_TYPOGRAPHY.meta} text-zen-saffron`}>
                已有同名项目「{duplicateProjects[0].name}」。仍可保存，或使用建议名称：
                <button
                  type="button"
                  className="ml-1 border-0 bg-transparent p-0 font-semibold text-zen-saffron underline"
                  disabled={busy}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      name: suggestUniqueProjectName(projects, prev.name),
                    }))
                  }
                >
                  {suggestUniqueProjectName(projects, draft.name)}
                </button>
              </p>
            ) : null}
          </label>

          <ProjectRecordedAtField
            key={project.id}
            value={draft.recorded_at ?? ""}
            disabled={busy}
            onChange={(recorded_at) => setDraft((prev) => ({ ...prev, recorded_at }))}
          />

          {METADATA_FIELDS.map(({ key, label, placeholder }) => (
            <label key={key} className="block">
              <span className={`mb-1.5 block ${PANEL_TYPOGRAPHY.fieldLabel}`}>{label}</span>
              <input
                type="text"
                className={`w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 ${PANEL_CONTROL_TYPOGRAPHY.compactInput} shadow-none outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-40`}
                placeholder={placeholder}
                value={draft[key] ?? ""}
                disabled={busy}
                autoComplete="off"
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
        </FloatingPanelDialogScroll>
      </form>
    </CompactFloatingDialog>
  );
}
