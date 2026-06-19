import { useEffect, useMemo, useState } from "react";
import { WORKSPACE_PAGE_PANEL_CLASS } from "../config/workspaceShellLayout";
import { consumeWelcomeSearchHubFileTarget } from "../services/welcome/welcomeSearch";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { FileSummary } from "../tauri/projectTypes";
import { ProjectFilesHubFileList } from "./ProjectFilesHubFileList";
import { ProjectFilesHubHeader } from "./ProjectFilesHubHeader";
import { ProjectFilesHubImportSection } from "./ProjectFilesHubImportSection";

function sortFilesNewestFirst(files: FileSummary[]): FileSummary[] {
  return [...files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
}

export function ProjectFilesHubPanel({ controller: c }: { controller: ProjectControllerApi }) {
  const [highlightFileId, setHighlightFileId] = useState<string | null>(null);
  /* eslint-disable react-hooks/exhaustive-deps -- controller `c` is a stable ref; we only need to recompute when `c.current.files` changes */
  const files = useMemo(
    () => sortFilesNewestFirst(c.current?.files ?? []),
    [c.current?.files],
  );
  /* eslint-enable react-hooks/exhaustive-deps */
  const projectName = c.current?.name ?? "当前项目";
  const busy = c.busy;
  const projectId = c.current?.id;

  useEffect(() => {
    const pending = consumeWelcomeSearchHubFileTarget();
    if (pending) setHighlightFileId(pending);
  }, [projectId]);

  useEffect(() => {
    if (!highlightFileId) return;
    const el = document.querySelector(`[data-hub-file-id="${highlightFileId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const timer = window.setTimeout(() => setHighlightFileId(null), 2500);
    return () => window.clearTimeout(timer);
  }, [highlightFileId, files]);

  return (
    <section
      className={`${WORKSPACE_PAGE_PANEL_CLASS} gap-6`}
      aria-label={`${projectName} 工作区`}
      data-purpose="project-files-hub-page"
    >
      <ProjectFilesHubHeader
        controller={c}
        projectName={projectName}
        projectId={projectId}
        busy={busy}
      />
      <ProjectFilesHubFileList
        controller={c}
        files={files}
        highlightFileId={highlightFileId}
        busy={busy}
      />
      <ProjectFilesHubImportSection controller={c} busy={busy} />
    </section>
  );
}
