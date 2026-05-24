import { useMemo, useState } from "react";
import { CLAY_BTN_PRIMARY, CLAY_BTN_SECONDARY, CLAY_SELECT } from "../config/controlStyles";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { ProjectSummary } from "../tauri/projectApi";
import { CreateProjectModal } from "./CreateProjectModal";

const RECENT_PROJECT_LIMIT = 8;

function sortRecentProjects(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => b.updated_at_ms - a.updated_at_ms).slice(0, RECENT_PROJECT_LIMIT);
}

const welcomePrimaryBtn = CLAY_BTN_PRIMARY;

interface WelcomeViewProps {
  controller: ProjectControllerApi;
  onOpenOnlineStt: () => void;
  reserveTopSpace?: boolean;
}

function AudioFileIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      <path d="M12 15V9h3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg className="mb-2 h-8 w-8 text-zen-stone/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 4h16v12H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16h5l1.5 2h3L15 16h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zen-stone transition-colors group-hover:text-zen-saffron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4h8v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m6 6 1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v5" strokeLinecap="round" />
      <path d="M14 11v5" strokeLinecap="round" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-zen-stone" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatRecentProjectDate(ms: number): string {
  const d = new Date(ms);
  const date = d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).split("/").join("-");
  const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} ${time}`;
}

export function WelcomeView({ controller: c, reserveTopSpace = false }: WelcomeViewProps) {
  const recentProjects = useMemo(() => sortRecentProjects(c.projects), [c.projects]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div
      className={`flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-6 pb-12 lg:px-8 ${reserveTopSpace ? "justify-start pt-32" : "justify-center py-12"}`}
      data-purpose="welcome-canvas"
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <section className="mb-8 text-center" data-purpose="hero-content">
          <h1 className="mb-3 font-serif text-[40px] font-medium leading-tight text-zen-ink sm:text-[48px]">开始校对</h1>
          <p className="mx-auto max-w-md font-sans text-sm leading-relaxed text-zen-stone">
            新建项目或打开已有项目。
          </p>
        </section>
        <div className="grid w-full max-w-md grid-cols-1 gap-4 sm:grid-cols-2" data-purpose="welcome-actions">
          <button
            type="button"
            className={`${welcomePrimaryBtn} group relative w-full gap-3 rounded-xl px-4 py-3 text-sm shadow-md shadow-zen-saffron/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-zen-saffron/40`}
            data-purpose="main-action-button"
            disabled={c.busy}
            onClick={() => setShowCreateModal(true)}
          >
            <span className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            <AudioFileIcon />
            <span className="relative">新建项目</span>
          </button>
          <label className="min-w-0">
            <span className="sr-only">打开已有项目</span>
            <select
              className={`${CLAY_SELECT} h-full min-h-12 w-full rounded-xl px-4 py-3 text-center font-sans text-sm font-semibold`}
              value=""
              disabled={c.busy}
              onChange={(e) => {
                const id = e.target.value;
                if (id) void c.loadProject(id);
                e.target.value = "";
              }}
            >
              <option value="">打开已有项目...</option>
              {c.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatRecentProjectDate(p.updated_at_ms)})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex w-full max-w-md justify-center">
          <button
            type="button"
            className={`${CLAY_BTN_SECONDARY} w-full sm:w-auto`}
            disabled={c.busy}
            onClick={() => void c.importProjectBundle()}
          >
            导入项目包（zip）
          </button>
        </div>

        <div className="my-8 h-px w-full max-w-md bg-zen-gray-200" aria-hidden />

        <section className="w-full max-w-lg" data-purpose="projects-list-container">
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 text-zen-stone">
              <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em]">最近项目</h2>
              {recentProjects.length > 0 ? <HistoryIcon /> : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-zen-gray-300 bg-serene-surface-card p-3">
            {recentProjects.length > 0 ? (
              <div className="flex max-h-[min(24rem,50vh)] flex-col gap-2 overflow-y-auto" data-purpose="project-items">
                {recentProjects.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-stretch gap-2 rounded-xl border border-transparent p-1 transition-colors hover:border-zen-gray-200 hover:bg-serene-surface-container-low"
                    data-purpose="project-item"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 rounded-lg border-0 bg-transparent p-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={c.busy}
                      onClick={() => void c.loadProject(p.id)}
                    >
                      <span className="block min-w-0">
                        <span className="block truncate font-sans text-sm font-semibold text-zen-ink transition-colors group-hover:text-zen-saffron-mid">{p.name}</span>
                        <span className="mt-1 block font-mono text-[12px] tabular-nums text-zen-stone">{formatRecentProjectDate(p.updated_at_ms)}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1 self-stretch opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border-0 bg-transparent text-zen-stone transition-colors hover:bg-zen-saffron/10 hover:text-zen-saffron focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`打开项目 ${p.name}`}
                        title="打开项目"
                        disabled={c.busy}
                        onClick={() => void c.loadProject(p.id)}
                      >
                        <ChevronRightIcon />
                      </button>
                      <button
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border-0 bg-transparent text-zen-stone transition-colors hover:bg-zen-cinnabar/10 hover:text-zen-cinnabar focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-cinnabar/30 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`删除项目 ${p.name}`}
                        title="删除项目"
                        disabled={c.busy}
                        onClick={() => void c.deleteProject(p.id)}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-[20px] border border-dashed border-zen-gray-300 bg-serene-surface-container-low p-8 text-center">
                <InboxIcon />
                <p className="font-sans text-[12px] leading-relaxed text-zen-stone">暂无项目，请先新建。</p>
              </div>
            )}
          </div>

          {recentProjects.length > 5 ? (
            <button
              type="button"
              className="mt-4 w-full border-0 bg-transparent py-2 text-center font-sans text-[12px] text-zen-stone transition-colors hover:text-zen-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={c.busy}
              onClick={() => void c.refreshProjects()}
            >
              查看全部项目
            </button>
          ) : null}
        </section>
      </div>

      {showCreateModal ? (
        <CreateProjectModal controller={c} onClose={() => setShowCreateModal(false)} />
      ) : null}
    </div>
  );
}
