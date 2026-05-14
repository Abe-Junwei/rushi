import { useMemo } from "react";
import {
  CLAY_BTN_GHOST,
  CLAY_BTN_ONLINE_STT,
  CLAY_BTN_PRIMARY,
  CLAY_SELECT,
} from "../config/controlStyles";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { ProjectSummary } from "../tauri/projectApi";

const RECENT_PROJECT_LIMIT = 8;

function sortRecentProjects(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => b.updated_at_ms - a.updated_at_ms).slice(0, RECENT_PROJECT_LIMIT);
}

/** DESIGN.md `button-primary` */
const welcomePrimaryBtn = CLAY_BTN_PRIMARY;

const btnOnlineSttEntry = CLAY_BTN_ONLINE_STT;

const welcomeGhostBtn = CLAY_BTN_GHOST;

const welcomeSelect = CLAY_SELECT;

interface WelcomeViewProps {
  controller: ProjectControllerApi;
  onOpenOnlineStt: () => void;
}

export function WelcomeView({ controller: c, onOpenOnlineStt }: WelcomeViewProps) {
  const recentProjects = useMemo(() => sortRecentProjects(c.projects), [c.projects]);
  const latestProject = recentProjects[0];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto px-4 pb-16 pt-6 md:px-6">
      <section className="mb-6" data-purpose="hero-content">
        <div className="rounded-2xl border border-zen-gray-300 bg-app-highlight p-6 sm:p-8">
          <div className="mb-4 inline-flex items-center rounded-full border border-zen-gray-300 bg-zen-paper px-3 py-1 text-xs font-medium tracking-wide text-app-text-muted">
            P1 Workspace
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-app-text-main sm:text-5xl">开始校对</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-app-text-muted sm:text-lg">
            选择本地音频创建项目，或打开已有 SQLite 项目继续工作。在线 STT Provider 可用于实验性流程。
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={welcomePrimaryBtn}
              data-purpose="main-action-button"
              disabled={c.busy}
              onClick={() => void c.pickAudio()}
            >
              新建项目（选择音频）
            </button>
            <button
              type="button"
              className={btnOnlineSttEntry}
              disabled={c.busy}
              onClick={onOpenOnlineStt}
              aria-controls="online-stt-provider"
            >
              在线 STT Provider（实验）
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zen-gray-300 bg-zen-paper px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-app-text-muted">项目总数</p>
              <p className="mt-1 text-2xl font-semibold text-app-text-main">{c.projects.length}</p>
            </div>
            <div className="rounded-lg border border-zen-gray-300 bg-zen-paper px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-app-text-muted">最近更新</p>
              <p className="mt-1 truncate text-sm font-medium text-app-text-main">
                {latestProject ? latestProject.name : "暂无项目"}
              </p>
            </div>
            <div className="rounded-lg border border-zen-gray-300 bg-zen-paper px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-app-text-muted">环境提示</p>
              <p className="mt-1 text-sm font-medium text-app-text-main">ASR 依赖可在上方环境面板中准备</p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full" data-purpose="projects-list-container">
        <div className="rounded-2xl border border-zen-gray-300 bg-zen-ochre p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-zen-gray-300 pb-4">
            <div>
              <h2 className="text-xl font-semibold text-app-text-main">最近项目</h2>
              <p className="mt-1 text-sm text-app-text-muted">可快速打开最近使用的项目，继续编辑与导出。</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative inline-block min-w-[11rem] text-left">
                <select
                  className={welcomeSelect}
                  value=""
                  disabled={c.busy}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) void c.loadProject(id);
                    e.target.value = "";
                  }}
                  aria-label="打开已有项目"
                >
                  <option value="">打开已有项目…</option>
                  {c.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({new Date(p.updated_at_ms).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className={welcomeGhostBtn}
                disabled={c.busy}
                onClick={() => void c.refreshProjects()}
              >
                <svg className="mr-2 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                刷新
              </button>
            </div>
          </div>

          {recentProjects.length > 0 ? (
            <div data-purpose="project-items">
              <ul className="max-h-[min(24rem,50vh)] list-none overflow-y-auto rounded-lg border border-zen-gray-300 bg-zen-paper p-0">
                {recentProjects.map((p) => (
                  <li key={p.id} className="border-b border-zen-gray-200 last:border-b-0">
                    <button
                      type="button"
                      className="flex w-full cursor-pointer appearance-none items-center justify-between gap-3 border-0 bg-transparent px-4 py-4 text-left transition-colors hover:bg-zen-ochre focus-visible:bg-zen-ochre focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                      data-purpose="project-item"
                      disabled={c.busy}
                      onClick={() => void c.loadProject(p.id)}
                    >
                      <span className="min-w-0 truncate font-medium text-app-text-main">{p.name}</span>
                      <span className="shrink-0 font-sans text-sm text-app-text-muted">
                        {new Date(p.updated_at_ms).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="pt-2 text-center text-sm text-app-text-muted">暂无项目，请先新建。</p>
          )}
        </div>
      </section>
    </div>
  );
}
