import { useCallback, useEffect, useState } from "react";
import type { ProjectSummary } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";

export interface ProjectListApi {
  projects: ProjectSummary[];
  refreshProjects: () => Promise<void>;
}

export function useProjectListState(setError: (msg: string) => void): ProjectListApi {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  const refreshProjects = useCallback(async () => {
    try {
      setError("");
      const list = await p1.projectList();
      setProjects(list);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("reading 'invoke'")) {
        setProjects([]);
        return;
      }
      setError(message);
    }
  }, [setError]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  return { projects, refreshProjects };
}
