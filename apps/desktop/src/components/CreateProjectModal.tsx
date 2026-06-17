import { useCallback, useMemo, useState } from "react";
import { FileAudio, FileText } from "lucide-react";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type { ProjectControllerApi } from "../pages/useProjectController";
import * as fileApi from "../tauri/fileApi";
import { findDuplicateProjectNames, suggestUniqueProjectName } from "../utils/projectDuplicateName";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import {
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_TEXT_INPUT,
} from "../config/controlStyles";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const PANEL_ID = "create-project-modal-v2";
const FORM_ID = "create-project-form";
const PANEL_WIDTH = 392;
/** 含页脚按钮行；重名提示多一行时由 layoutRev 触发实测对齐。 */
const FALLBACK_HEIGHT = { base: 340, duplicate: 372 } as const;

interface CreateProjectModalProps {
  controller: ProjectControllerApi;
  onClose: () => void;
}

export function CreateProjectModal({ controller: c, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState(c.newName);
  const [busy, setBusy] = useState(false);
  const isBusy = busy || c.busy;
  const projectName = name.trim() || "未命名项目";
  const duplicateProjects = useMemo(
    () => findDuplicateProjectNames(c.projects, projectName),
    [c.projects, projectName],
  );
  const hasDuplicateWarning = duplicateProjects.length > 0;
  const suggestedName = useMemo(
    () => suggestUniqueProjectName(c.projects, projectName),
    [c.projects, projectName],
  );
  const estimatedFitHeight = hasDuplicateWarning ? FALLBACK_HEIGHT.duplicate : FALLBACK_HEIGHT.base;

  const runCreate = useCallback(async (action: () => Promise<boolean>) => {
    setBusy(true);
    c.setNewName(name);
    try {
      const created = await action();
      if (created) {
        c.openProjectMetadataDialog({ afterCreate: true });
        onClose();
      }
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [c, name, onClose]);

  const createEmpty = useCallback(async () => {
    await runCreate(async () => {
      const raw = await fileApi.createEmptyProject(projectName);
      const detail = await fileApi.adaptToLegacyProjectDetail(raw);
      c.applyDetail(detail);
      await c.refreshProjects();
      return true;
    });
  }, [c, projectName, runCreate]);

  const createFromAudio = useCallback(async () => {
    await runCreate(async () => {
      const srcPath = await fileApi.pickAudioPath();
      if (!srcPath) return false;
      const raw = await fileApi.createProjectFromAudio(projectName, srcPath);
      const detail = await fileApi.adaptToLegacyProjectDetail(raw);
      c.applyDetail(detail);
      await c.refreshProjects();
      return true;
    });
  }, [c, projectName, runCreate]);

  const createFromText = useCallback(async () => {
    await runCreate(async () => {
      const srcPath = await fileApi.pickTextPath();
      if (!srcPath) return false;
      const raw = await fileApi.createProjectFromText(projectName, srcPath);
      const detail = await fileApi.adaptToLegacyProjectDetail(raw);
      c.applyDetail(detail);
      await c.refreshProjects();
      return true;
    });
  }, [c, projectName, runCreate]);

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="新建项目"
      open
      onClose={onClose}
      fallbackHeight={FALLBACK_HEIGHT.base}
      estimatedFitHeight={estimatedFitHeight}
      layoutRev={hasDuplicateWarning ? 1 : 0}
      measureBody
      fillHeight={false}
      defaultWidth={PANEL_WIDTH}
      bounds={{ minWidth: 340, minHeight: 260, maxWidthCap: 440, maxHeightCap: 480 }}
      footer={
        <>
          <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onClose} disabled={isBusy}>
            取消
          </button>
          <button type="submit" form={FORM_ID} className={CONTROL_BTN_PRIMARY} disabled={isBusy}>
            {busy ? "创建中…" : "创建空项目"}
          </button>
        </>
      }
      footerJustify="end"
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void createEmpty();
        }}
      >
        <label className="block shrink-0">
          <span className={`mb-1 block ${PANEL_TYPOGRAPHY.fieldLabel}`}>项目名称</span>
          <input
            type="text"
            className={`${CONTROL_TEXT_INPUT} ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
            placeholder="未命名项目"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isBusy}
            autoComplete="off"
            autoFocus
          />
        </label>

        {hasDuplicateWarning ? (
          <p className={`shrink-0 ${PANEL_TYPOGRAPHY.meta} leading-snug text-zen-saffron`}>
            已有同名项目「{duplicateProjects[0].name}」。仍可创建，或使用
            <button
              type="button"
              className="mx-1 border-0 bg-transparent p-0 font-semibold text-zen-saffron underline"
              disabled={isBusy}
              onClick={() => setName(suggestedName)}
            >
              {suggestedName}
            </button>
          </p>
        ) : (
          <p className={`shrink-0 ${PANEL_TYPOGRAPHY.meta} leading-snug text-notion-text-muted`}>
            可先建空项目，或导入首个音频 / 文本文件。
          </p>
        )}

        <div className="relative shrink-0">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-notion-divider" />
          </div>
          <div className="relative flex justify-center">
            <span className={`bg-notion-bg px-2 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
              导入首个文件
            </span>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            className={`${CONTROL_BTN_SECONDARY} w-full gap-1.5 px-3`}
            disabled={isBusy}
            onClick={() => void createFromAudio()}
          >
            <FileAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            <span>导入音频</span>
          </button>
          <button
            type="button"
            className={`${CONTROL_BTN_SECONDARY} w-full gap-1.5 px-3`}
            disabled={isBusy}
            onClick={() => void createFromText()}
          >
            <FileText className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            <span>导入文本</span>
          </button>
        </div>
      </form>
    </CompactFloatingDialog>
  );
}
