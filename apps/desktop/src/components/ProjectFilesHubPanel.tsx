import { useEffect, useMemo, useState } from "react";
import { WORKSPACE_PAGE_PANEL_CLASS } from "../config/workspaceShellLayout";
import { consumeWelcomeSearchHubFileTarget } from "../services/welcome/welcomeSearch";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { FileSummary } from "../tauri/projectTypes";
import * as fileApi from "../tauri/fileApi";
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
    el?.scrollIntoView({ block: "nearest" });
    const timer = window.setTimeout(function clearHubFileHighlight() {
      setHighlightFileId(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [highlightFileId, files]);

  // Pull latest FileSummary (duration_sec after open/peaks) when Hub is shown.
  // Retry once: peaks may finish shortly after the user leaves the editor.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const files = await fileApi.listFiles(projectId);
        if (cancelled) return;
        const cur = c.current;
        if (cur?.id === projectId) {
          c.applyDetail({ ...cur, files });
        }
      } catch {
        /* best-effort */
      }
    };
    void pull();
    const timer = window.setTimeout(function retryHubFileListPull() {
      void pull();
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on Hub enter / project switch
  }, [projectId]);

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
