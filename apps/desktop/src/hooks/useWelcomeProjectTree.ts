import { useCallback, useEffect, useRef, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import * as fileApi from "../tauri/fileApi";

/** Welcome「所有文件」项目库：展开 / 懒加载文件 / 打开文件。 */
export function useWelcomeProjectTree(c: ProjectControllerApi) {
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectFilesById, setProjectFilesById] = useState<Record<string, fileApi.FileSummary[]>>({});
  const [loadingFilesById, setLoadingFilesById] = useState<Record<string, boolean>>({});
  const projectFilesByIdRef = useRef(projectFilesById);
  const loadingFilesByIdRef = useRef(loadingFilesById);
  projectFilesByIdRef.current = projectFilesById;
  loadingFilesByIdRef.current = loadingFilesById;

  const setError = c.setError;
  const loadProject = c.loadProject;
  const openFile = c.openFile;
  const currentId = c.current?.id ?? null;
  const currentUpdatedAtMs = c.current?.updated_at_ms;
  const currentRef = useRef(c.current);
  currentRef.current = c.current;

  const ensureProjectFilesLoaded = useCallback(
    async (projectId: string, force = false) => {
      if (
        !force &&
        (projectId in projectFilesByIdRef.current || loadingFilesByIdRef.current[projectId])
      ) {
        return;
      }
      setLoadingFilesById((prev) => ({ ...prev, [projectId]: true }));
      try {
        const files = await fileApi.listFiles(projectId);
        setProjectFilesById((prev) => ({ ...prev, [projectId]: files ?? [] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setProjectFilesById((prev) => ({ ...prev, [projectId]: [] }));
      } finally {
        setLoadingFilesById((prev) => ({ ...prev, [projectId]: false }));
      }
    },
    [setError],
  );

  const handleOpenProjectFile = useCallback(
    async (projectId: string, fileId: string) => {
      if (currentId !== projectId) {
        await loadProject(projectId);
      }
      await openFile(fileId);
    },
    [currentId, loadProject, openFile],
  );

  const toggleProjectExpanded = useCallback(
    (projectId: string, isExpanded: boolean) => {
      setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
      if (!isExpanded) void ensureProjectFilesLoaded(projectId);
    },
    [ensureProjectFilesLoaded],
  );

  /**
   * Hub 旁路：当前项目自动展开；优先用 projectLoad 已带的 files（含语段 stage）。
   * 依赖 updated_at_ms（非整个 controller），避免父级 rerender 反复取消 listFiles。
   */
  useEffect(() => {
    if (!currentId) return;
    setExpandedProjectId(currentId);
    const files = currentRef.current?.files;
    if (Array.isArray(files)) {
      setProjectFilesById((prev) => ({ ...prev, [currentId]: files }));
      setLoadingFilesById((prev) => ({ ...prev, [currentId]: false }));
      return;
    }
    let cancelled = false;
    setLoadingFilesById((prev) => ({ ...prev, [currentId]: true }));
    void (async () => {
      try {
        const listed = await fileApi.listFiles(currentId);
        if (cancelled) return;
        setProjectFilesById((prev) => ({ ...prev, [currentId]: listed ?? [] }));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
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
  }, [currentId, currentUpdatedAtMs, setError]);
  const invalidateProjectFilesCaches = useCallback(
    (projectIds: string[]) => {
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
    },
    [ensureProjectFilesLoaded],
  );

  return {
    expandedProjectId,
    projectFilesById,
    loadingFilesById,
    handleOpenProjectFile,
    toggleProjectExpanded,
    invalidateProjectFilesCaches,
  };
}
