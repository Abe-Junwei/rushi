import { useCallback, useEffect, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import * as fileApi from "../tauri/fileApi";

/** Welcome「所有文件」项目库：展开 / 懒加载文件 / 打开文件。 */
export function useWelcomeProjectTree(c: ProjectControllerApi) {
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectFilesById, setProjectFilesById] = useState<Record<string, fileApi.FileSummary[]>>({});
  const [loadingFilesById, setLoadingFilesById] = useState<Record<string, boolean>>({});

  const ensureProjectFilesLoaded = useCallback(async (projectId: string, force = false) => {
    if (!force && (projectId in projectFilesById || loadingFilesById[projectId])) return;
    setLoadingFilesById((prev) => ({ ...prev, [projectId]: true }));
    try {
      const files = await fileApi.listFiles(projectId);
      setProjectFilesById((prev) => ({ ...prev, [projectId]: files ?? [] }));
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
      setProjectFilesById((prev) => ({ ...prev, [projectId]: [] }));
    } finally {
      setLoadingFilesById((prev) => ({ ...prev, [projectId]: false }));
    }
  }, [c, loadingFilesById, projectFilesById]);

  const handleOpenProjectFile = useCallback(async (projectId: string, fileId: string) => {
    if (c.current?.id !== projectId) {
      await c.loadProject(projectId);
    }
    await c.openFile(fileId);
  }, [c]);

  const toggleProjectExpanded = useCallback(
    (projectId: string, isExpanded: boolean) => {
      setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
      if (!isExpanded) void ensureProjectFilesLoaded(projectId);
    },
    [ensureProjectFilesLoaded],
  );

  /** Hub 旁路：当前项目存在时自动展开并拉文件列表。 */
  useEffect(() => {
    const currentId = c.current?.id;
    if (!currentId) return;
    setExpandedProjectId(currentId);
    let cancelled = false;
    setLoadingFilesById((prev) => ({ ...prev, [currentId]: true }));
    void (async () => {
      try {
        const files = await fileApi.listFiles(currentId);
        if (cancelled) return;
        setProjectFilesById((prev) => ({ ...prev, [currentId]: files ?? [] }));
      } catch (e) {
        if (cancelled) return;
        c.setError(e instanceof Error ? e.message : String(e));
        setProjectFilesById((prev) => ({ ...prev, [currentId]: [] }));
      } finally {
        if (!cancelled) {
          setLoadingFilesById((prev) => ({ ...prev, [currentId]: false }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [c, c.current?.id]);

  const invalidateProjectFilesCaches = useCallback((projectIds: string[]) => {
    setProjectFilesById((prev) => {
      const next = { ...prev };
      for (const id of projectIds) {
        delete next[id];
      }
      return next;
    });
    for (const id of projectIds) {
      void ensureProjectFilesLoaded(id, true);
    }
  }, [ensureProjectFilesLoaded]);

  return {
    expandedProjectId,
    projectFilesById,
    loadingFilesById,
    handleOpenProjectFile,
    toggleProjectExpanded,
    invalidateProjectFilesCaches,
  };
}
