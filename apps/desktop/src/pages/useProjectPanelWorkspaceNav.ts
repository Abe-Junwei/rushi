import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GlossaryWorkspaceId } from "../components/glossary/glossaryWorkspaceTypes";
import type { WelcomeLedgerTabId } from "../components/WelcomeFileLedger";
import type { WelcomePageId } from "../components/WelcomeView";
import { resolveWorkspaceShellVariant } from "./resolveWorkspaceShellVariant";
import type { useProjectController } from "./useProjectController";

type ProjectController = ReturnType<typeof useProjectController>;

/** Welcome / hub / editor shell routing (sidebar collapse is scoped to CollapsibleWorkspaceShell). */
export function useProjectPanelWorkspaceNav(c: ProjectController) {
  const [welcomePage, setWelcomePage] = useState<WelcomePageId>("home");
  const [welcomeLedgerTab, setWelcomeLedgerTab] = useState<WelcomeLedgerTabId>("recent");
  const [glossaryWorkspaceId, setGlossaryWorkspaceId] = useState<GlossaryWorkspaceId>("vocabulary");
  const pendingWelcomePageRef = useRef<WelcomePageId | null>(null);
  const pendingGlossaryWorkspaceRef = useRef<GlossaryWorkspaceId | null>(null);
  const pendingLedgerTabRef = useRef<WelcomeLedgerTabId | null>(null);

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
    if (workspaceShellVariant === "editor") setWelcomePage("home");
    // hub 旁路欢迎库：强制 home +「所有文件」
    if (workspaceShellVariant === "hub") {
      setWelcomePage("home");
      setWelcomeLedgerTab("all");
    }
  }, [workspaceShellVariant]);

  useEffect(() => {
    const onWelcomeSurface =
      workspaceShellVariant === "welcome" || workspaceShellVariant === "hub";
    if (onWelcomeSurface && pendingWelcomePageRef.current) {
      const page = pendingWelcomePageRef.current;
      pendingWelcomePageRef.current = null;
      setWelcomePage(page);
      if (pendingGlossaryWorkspaceRef.current) {
        setGlossaryWorkspaceId(pendingGlossaryWorkspaceRef.current);
        pendingGlossaryWorkspaceRef.current = null;
      }
    }
    if (onWelcomeSurface && pendingLedgerTabRef.current) {
      setWelcomeLedgerTab(pendingLedgerTabRef.current);
      pendingLedgerTabRef.current = null;
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

  /** 侧栏「主页」→ 欢迎 home +「所有文件」tab（编辑器先关项目；hub 旁路仅切 tab）。 */
  const onGoProjectsLibrary = useCallback(() => {
    if (workspaceShellVariant === "editor") {
      pendingLedgerTabRef.current = "all";
      pendingWelcomePageRef.current = "home";
      c.closeProject();
      return;
    }
    setWelcomePage("home");
    setWelcomeLedgerTab("all");
  }, [c, workspaceShellVariant]);

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
    welcomeLedgerTab,
    setWelcomeLedgerTab,
    glossaryWorkspaceId,
    setGlossaryWorkspaceId,
    workspaceShellVariant,
    onLeaveProjectForWelcome,
    onGoProjectsLibrary,
    openGlossaryFromTranscribe,
    stayAfterCloseAttempt,
  };
}
