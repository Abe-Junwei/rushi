import { PRODUCT_ICON } from "../config/productIcons";
import { BrandLockup } from "./BrandLockup";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { GlossaryWorkspaceId } from "./glossary/glossaryWorkspaceTypes";
import { GLOSSARY_WORKSPACE_NAV_ITEMS } from "./glossary/glossaryWorkspaceNav";
import type { WelcomePageId } from "./welcomeTypes";
import {
  WORKSPACE_SIDEBAR_NAV_STACK,
  workspaceSidebarNavItemClass,
  workspaceSidebarSubNavItemClass,
} from "../config/workspaceShellLayout";

export type WelcomeSidebarNavProps = {
  controller: ProjectControllerApi;
  page: WelcomePageId;
  inProjectContext: boolean;
  editorMode: boolean;
  glossaryWorkspaceId: GlossaryWorkspaceId;
  onPageChange: (page: WelcomePageId) => void;
  onLeaveProjectForWelcome?: (page: WelcomePageId, glossaryWorkspace?: GlossaryWorkspaceId) => void;
  onGlossaryWorkspaceChange?: (id: GlossaryWorkspaceId) => void;
  onOpenEditor: () => void;
  onGoProjectsLibrary: () => void;
};

export function WelcomeSidebarNav({
  controller: c,
  page,
  inProjectContext,
  editorMode,
  glossaryWorkspaceId,
  onPageChange,
  onLeaveProjectForWelcome,
  onGlossaryWorkspaceChange,
  onOpenEditor,
  onGoProjectsLibrary,
}: WelcomeSidebarNavProps) {
  const navigateWelcomePage = (nextPage: WelcomePageId, glossaryWorkspace?: GlossaryWorkspaceId) => {
    if (inProjectContext && onLeaveProjectForWelcome) {
      onLeaveProjectForWelcome(nextPage, glossaryWorkspace);
      return;
    }
    onPageChange(nextPage);
    if (nextPage === "glossary" && glossaryWorkspace) {
      onGlossaryWorkspaceChange?.(glossaryWorkspace);
    }
  };

  const navItems = [
    {
      icon: (
        <PRODUCT_ICON.navHome
          className={`${LUCIDE_ICON_SIZE_MD} shrink-0`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      ),
      label: "主页",
      active: page === "home" || inProjectContext,
      onClick: () => {
        onGoProjectsLibrary();
      },
      title: "项目与文件",
    },
    {
      icon: (
        <PRODUCT_ICON.navTranscript
          className={`${LUCIDE_ICON_SIZE_MD} shrink-0`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      ),
      label: "转录",
      active: false,
      disabled: false,
      onClick: onOpenEditor,
      title: "打开上次校对的文件",
      hidden: editorMode,
    },
    {
      icon: (
        <PRODUCT_ICON.navGlossary
          className={`${LUCIDE_ICON_SIZE_MD} shrink-0`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      ),
      label: "词表",
      active: page === "glossary",
      onClick: () => navigateWelcomePage("glossary", glossaryWorkspaceId),
      title: "热词、纠错记忆与词表包",
      showGlossarySubnav: true,
    },
  ];

  return (
    <div>
      {!editorMode ? (
        <div className="px-5 pb-8 pt-8">
          <BrandLockup size="sidebar" />
        </div>
      ) : null}
      <nav aria-label="主工作区">
        <div
          className={[WORKSPACE_SIDEBAR_NAV_STACK, editorMode ? "pt-4" : ""].filter(Boolean).join(" ")}
        >
          {navItems
            .filter((item) => !("hidden" in item && item.hidden))
            .map((item) => (
              <div key={item.label} className="flex flex-col gap-1">
                <button
                  type="button"
                  disabled={Boolean(item.disabled) || c.busy}
                  title={item.title}
                  aria-current={item.active ? "page" : undefined}
                  onClick={() => item.onClick?.()}
                  className={workspaceSidebarNavItemClass({
                    active: item.active,
                    disabled: Boolean(item.disabled) || c.busy,
                  })}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
                {"showGlossarySubnav" in item && item.showGlossarySubnav && page === "glossary" ? (
                  <ul className="m-0 flex list-none flex-col gap-0.5 p-0 pt-1" aria-label="词表子工作区">
                    {GLOSSARY_WORKSPACE_NAV_ITEMS.map((sub) => {
                      const selected = glossaryWorkspaceId === sub.id;
                      return (
                        <li key={sub.id}>
                          <button
                            type="button"
                            disabled={c.busy}
                            aria-current={selected ? "page" : undefined}
                            onClick={() => {
                              onGlossaryWorkspaceChange?.(sub.id);
                              if (page !== "glossary") {
                                navigateWelcomePage("glossary", sub.id);
                              }
                            }}
                            className={workspaceSidebarSubNavItemClass(selected)}
                          >
                            <span className="shrink-0 opacity-80">{sub.icon}</span>
                            <span>{sub.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ))}
        </div>
      </nav>
    </div>
  );
}
