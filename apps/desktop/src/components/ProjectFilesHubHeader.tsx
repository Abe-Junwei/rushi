import { NotebookText, Trash2 } from "lucide-react";
import { CONTROL_BTN_LINK, CONTROL_BTN_ICON_GHOST } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { formatProjectHubMetadataLine } from "../utils/projectFileDisplay";
import { findDuplicateProjectNames, suggestUniqueProjectName } from "../utils/projectDuplicateName";
import type { ProjectControllerApi } from "../pages/useProjectController";

const HUB_ICON_BTN = CONTROL_BTN_ICON_GHOST;

type Props = {
  controller: ProjectControllerApi;
  projectName: string;
  projectId: string | undefined;
  busy: boolean;
};

export function ProjectFilesHubHeader({ controller: c, projectName, projectId, busy }: Props) {
  const projectMetadataLine = formatProjectHubMetadataLine({
    recorded_at: c.current?.recorded_at,
    subject: c.current?.subject,
    narrator: c.current?.narrator,
  });

  const renameDuplicates = c.isRenamingProject
    ? findDuplicateProjectNames(c.projects, c.renameProjectDraft, projectId)
    : [];

  if (c.isRenamingProject) {
    return (
      <header className="relative">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void c.commitRenameProject();
          }}
        >
          <input
            type="text"
            className="w-full rounded-sm border border-notion-border bg-notion-bg px-3 py-2 text-lg font-semibold text-notion-text"
            value={c.renameProjectDraft}
            disabled={busy}
            autoFocus
            onChange={(e) => c.setRenameProjectDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") c.cancelRenameProject();
            }}
          />
          {renameDuplicates.length > 0 ? (
            <p className={`${PANEL_TYPOGRAPHY.meta} text-accent-action`}>
              已有同名项目「{renameDuplicates[0].name}」。仍可保存，或改用
              <button
                type="button"
                className={`${CONTROL_BTN_LINK} ml-1 text-accent-action`}
                disabled={busy}
                onClick={() =>
                  c.setRenameProjectDraft(
                    suggestUniqueProjectName(c.projects, c.renameProjectDraft),
                  )
                }
              >
                {suggestUniqueProjectName(c.projects, c.renameProjectDraft)}
              </button>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              className={`${CONTROL_BTN_LINK} text-accent-action`}
              disabled={busy || !c.renameProjectDraft.trim()}
            >
              保存名称
            </button>
            <button
              type="button"
              className={`${CONTROL_BTN_LINK} text-notion-text-muted`}
              disabled={busy}
              onClick={() => c.cancelRenameProject()}
            >
              取消
            </button>
          </div>
        </form>
      </header>
    );
  }

  return (
    <header className="relative">
      <div className="relative flex items-start">
        <div className="min-w-0 flex flex-1 flex-col gap-1 pr-16">
          <h1 className="truncate text-display font-semibold leading-[1.25] tracking-[-0.015em] text-notion-text">
            {projectName}
          </h1>
          {projectMetadataLine ? (
            <p
              className={`truncate ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}
              title={projectMetadataLine}
            >
              {projectMetadataLine}
            </p>
          ) : null}
        </div>
        <div className="absolute right-0 top-0 flex shrink-0 items-center gap-1">
          <button
            type="button"
            className={HUB_ICON_BTN}
            disabled={busy}
            aria-label="项目信息"
            onClick={() => c.openProjectMetadataDialog()}
          >
            <NotebookText
              className={LUCIDE_ICON_SIZE_MD}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
          </button>
          {projectId ? (
            <button
              type="button"
              className={`${HUB_ICON_BTN} hover:text-zen-cinnabar`}
              disabled={busy}
              aria-label="删除项目"
              onClick={() => c.requestDeleteProject(projectId, projectName)}
            >
              <Trash2
                className={LUCIDE_ICON_SIZE_MD}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
