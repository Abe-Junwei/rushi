import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlossaryWorkspaceId } from "../components/glossary/glossaryWorkspaceTypes";
import type { WelcomePageId } from "../components/WelcomeView";
import { resolveWorkspaceShellVariant } from "./resolveWorkspaceShellVariant";
import type { useProjectController } from "./useProjectController";

type ProjectController = ReturnType<typeof useProjectController>;

/** Welcome / hub / editor shell routing (sidebar collapse is scoped to CollapsibleWorkspaceShell). */
export function useProjectPanelWorkspaceNav(c: ProjectController) {
  const [welcomePage, setWelcomePage] = useState<WelcomePageId>("home");
  const [glossaryWorkspaceId, setGlossaryWorkspaceId] = useState<GlossaryWorkspaceId>("vocabulary");
  const pendingWelcomePageRef = useRef<WelcomePageId | null>(null);
  const pendingGlossaryWorkspaceRef = useRef<GlossaryWorkspaceId | null>(null);

  const workspaceShellVariant = useMemo<"welcome" | "hub" | "editor">(
    () =>
      resolveWorkspaceShellVariant({
        hasCurrentProject: c.current != null,
        currentFileId: c.currentFileId,
        openingWorkspaceTarget: c.openingWorkspaceTarget,
      }),
    [c.current, c.currentFileId, c.openingWorkspaceTarget],
  );

  useEffect(() => {
    if (workspaceShellVariant !== "welcome") setWelcomePage("home");
  }, [workspaceShellVariant]);

  useEffect(() => {
    if (workspaceShellVariant === "welcome" && pendingWelcomePageRef.current) {
      const page = pendingWelcomePageRef.current;
      pendingWelcomePageRef.current = null;
      setWelcomePage(page);
      if (pendingGlossaryWorkspaceRef.current) {
        setGlossaryWorkspaceId(pendingGlossaryWorkspaceRef.current);
        pendingGlossaryWorkspaceRef.current = null;
      }
    }
  }, [workspaceShellVariant]);

  const onLeaveProjectForWelcome = useCallback(
    (page: WelcomePageId, glossaryWorkspace?: GlossaryWorkspaceId) => {
      pendingWelcomePageRef.current = page;
      if (glossaryWorkspace) {
        pendingGlossaryWorkspaceRef.current = glossaryWorkspace;
      }
      c.closeProject();
    },
    [c],
  );

  const openGlossaryFromTranscribe = useCallback(() => {
    c.cancelTranscribeStart();
    pendingWelcomePageRef.current = "glossary";
    if (c.current) {
      c.closeProject();
    } else {
      setWelcomePage("glossary");
    }
  }, [c]);

  const stayAfterCloseAttempt = useCallback(() => {
    pendingWelcomePageRef.current = null;
    c.stayAfterCloseAttempt();
  }, [c]);

  return {
    welcomePage,
    setWelcomePage,
    glossaryWorkspaceId,
    setGlossaryWorkspaceId,
    workspaceShellVariant,
    onLeaveProjectForWelcome,
    openGlossaryFromTranscribe,
    stayAfterCloseAttempt,
  };
}
