import { useEffect, useRef } from "react";
import { isTauriRuntime } from "../config/env";
import {
  registerEnvironmentCapabilityRefreshDeps,
  runEnvironmentCapabilityRefresh,
  syncEnvironmentCapabilityRefreshDeps,
  type EnvironmentCapabilityRefreshDeps,
} from "../services/environmentCapabilityCoordinator";

export type EnvironmentCapabilitySyncDeps = EnvironmentCapabilityRefreshDeps & {
  projectId: string | null | undefined;
};

const PROJECT_OPEN_DEBOUNCE_MS = 300;

/** Single entry: app init, debounced project-open, and focus/visibility refresh. */
export function useEnvironmentCapabilitySync(deps: EnvironmentCapabilitySyncDeps): void {
  const depsRef = useRef(deps);
  depsRef.current = deps;
  syncEnvironmentCapabilityRefreshDeps(depsRef.current);

  const lastProjectIdRef = useRef<string | null>(null);
  const projectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    return registerEnvironmentCapabilityRefreshDeps(depsRef.current);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime() || initRef.current) return;
    initRef.current = true;
    void runEnvironmentCapabilityRefresh("app-init", depsRef.current, { touchUi: true });
  }, []);

  useEffect(() => {
    const projectId = deps.projectId ?? null;
    if (!projectId) {
      lastProjectIdRef.current = null;
      return;
    }
    if (!isTauriRuntime()) return;
    if (lastProjectIdRef.current === projectId) return;
    lastProjectIdRef.current = projectId;

    if (projectDebounceRef.current) clearTimeout(projectDebounceRef.current);
    projectDebounceRef.current = setTimeout(() => {
      void runEnvironmentCapabilityRefresh("project-open", depsRef.current);
    }, PROJECT_OPEN_DEBOUNCE_MS);

    return () => {
      if (projectDebounceRef.current) {
        clearTimeout(projectDebounceRef.current);
        projectDebounceRef.current = null;
      }
    };
  }, [deps.projectId]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void runEnvironmentCapabilityRefresh("app-focus", depsRef.current, { touchUi: false });
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
