import {
  BookOpen,
  ChevronRight,
  List,
  Pencil,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
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
  onScrollToProjectList: () => void;
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
  onScrollToProjectList,
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
      icon: <List className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "项目与文件",
      active: page === "home" || inProjectContext,
      onClick: () => {
        if (!inProjectContext) onPageChange("home");
        onScrollToProjectList();
      },
    },
    {
      icon: <Pencil className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />,
      label: "编辑器",
      active: false,
      disabled: false,
      onClick: onOpenEditor,
      title: "打开上次编辑的文件",
      hidden: editorMode,
    },
    ...(inProjectContext && onLeaveProjectForWelcome
      ? [
          {
            icon: (
              <ChevronRight
                className={`${LUCIDE_ICON_SIZE_MD} shrink-0 rotate-180`}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
            ),
            label: "返回欢迎页",
            active: false,
            disabled: false,
            onClick: () => onLeaveProjectForWelcome("home"),
          },
        ]
      : []),
  ];

  return (
    <div className="border-b border-notion-divider">
      {!editorMode ? (
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-zen-primary-action-bg text-zen-primary-action-fg">
              <BrandMark size={18} variant="onPrimary" />
            </div>
            <div>
              <h1 className="m-0 font-serif text-heading font-medium leading-[1.4] text-notion-text">如是我闻</h1>
              <p className="m-0 mt-0.5 text-label font-medium leading-snug text-notion-text-muted">
                本地课录音转写与校对
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <nav aria-label="主工作区">
        <div className={[WORKSPACE_SIDEBAR_NAV_STACK, editorMode ? "pt-3" : ""].filter(Boolean).join(" ")}>
          {navItems
            .filter((item) => !("hidden" in item && item.hidden))
            .map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.disabled || c.busy}
                title={item.title}
                aria-current={item.active ? "page" : undefined}
                onClick={() => item.onClick?.()}
                className={workspaceSidebarNavItemClass({
                  active: item.active,
                  disabled: item.disabled || c.busy,
                })}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}

          <div>
            <button
              type="button"
              disabled={c.busy}
              aria-current={page === "glossary" ? "page" : undefined}
              onClick={() => navigateWelcomePage("glossary", glossaryWorkspaceId)}
              className={workspaceSidebarNavItemClass({ active: page === "glossary", disabled: c.busy })}
            >
              <BookOpen className={`${LUCIDE_ICON_SIZE_MD} shrink-0`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
              <span>热词与记忆</span>
            </button>
            {page === "glossary" ? (
              <ul className="m-0 list-none flex flex-col gap-0.5 p-0 pt-0.5" aria-label="热词与记忆子工作区">
                {GLOSSARY_WORKSPACE_NAV_ITEMS.map((item) => {
                  const selected = glossaryWorkspaceId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={c.busy}
                        aria-current={selected ? "page" : undefined}
                        onClick={() => {
                          onGlossaryWorkspaceChange?.(item.id);
                          if (page !== "glossary") {
                            navigateWelcomePage("glossary", item.id);
                          }
                        }}
                        className={workspaceSidebarSubNavItemClass(selected)}
                      >
                        <span className="shrink-0 opacity-80">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </nav>
    </div>
  );
}
