import { useMemo } from "react";
import type { ProjectP1ControllerApi } from "../pages/useProjectP1Controller";
import type { ProjectSummary } from "../tauri/p1Api";

const RECENT_PROJECT_LIMIT = 8;

function sortRecentProjects(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => b.updated_at_ms - a.updated_at_ms).slice(0, RECENT_PROJECT_LIMIT);
}

const welcomePrimaryBtn =
  "rounded-lg px-12 py-3.5 text-[15px] font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100";

const welcomePrimaryInlineStyle: React.CSSProperties = {
  WebkitAppearance: "none",
  MozAppearance: "none",
  appearance: "none",
  borderStyle: "none",
  color: "#fff",
  backgroundColor: "#D49A5B",
  backgroundImage: "linear-gradient(to bottom, #E4B88A 0%, #D49A5B 100%)",
  boxShadow:
    "0 8px 24px -4px rgba(212, 163, 115, 0.5), 0 10px 15px -3px rgba(212, 163, 115, 0.3), 0 4px 6px -2px rgba(212, 163, 115, 0.18)",
};

const btnOnlineSttEntry =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-zen-saffron/35 bg-white/80 px-3 py-1.5 text-xs font-medium text-zen-saffron shadow-sm transition-colors hover:border-zen-saffron/55 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40 disabled:cursor-not-allowed disabled:opacity-40";

const welcomeGhostBtn =
  "inline-flex appearance-none items-center rounded-lg border-0 bg-black/5 px-4 py-2 text-sm font-medium text-app-text-muted transition-colors hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40";

const welcomeSelect =
  'cursor-pointer appearance-none rounded-lg border-0 bg-black/5 bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat py-2 pl-4 pr-10 text-sm font-medium text-app-text-muted transition-colors hover:bg-black/10 disabled:opacity-40 bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23666\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")]';

interface P1WelcomeViewProps {
  controller: ProjectP1ControllerApi;
  onOpenOnlineStt: () => void;
}

export function P1WelcomeView({ controller: c, onOpenOnlineStt }: P1WelcomeViewProps) {
  const recentProjects = useMemo(() => sortRecentProjects(c.projects), [c.projects]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto px-4 pb-16 pt-8 md:px-6">
      <section className="mb-12 text-center" data-purpose="hero-content">
        <h1 className="mb-6 font-serif text-4xl font-medium tracking-tight text-app-text-main sm:text-5xl">
          开始校对
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-app-text-muted">
          选择本地音频创建项目，或打开已有 SQLite 项目。ASR 需在另一终端运行。
        </p>
        <button
          type="button"
          className={welcomePrimaryBtn}
          style={welcomePrimaryInlineStyle}
          data-purpose="main-action-button"
          disabled={c.busy}
          onClick={() => void c.pickAudio()}
        >
          新建项目（选择音频）
        </button>
        <div className="mt-6 flex justify-center px-2">
          <button
            type="button"
            className={`${btnOnlineSttEntry} w-full max-w-sm sm:w-auto`}
            disabled={c.busy}
            onClick={onOpenOnlineStt}
            aria-controls="p1-online-stt-provider"
          >
            在线 STT Provider（实验）
          </button>
        </div>
      </section>

      <section className="w-full" data-purpose="projects-list-container">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-app-text-main">最近项目</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative inline-block min-w-[10rem] text-left">
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
          <div className="mt-4 border-t border-black/5" data-purpose="project-items">
            <ul className="max-h-[min(24rem,50vh)] list-none overflow-y-auto p-0">
              {recentProjects.map((p) => (
                <li key={p.id} className="border-b border-black/5 last:border-b-0">
                  <button
                    type="button"
                    className="flex w-full cursor-pointer appearance-none border-0 bg-transparent items-center justify-between gap-3 rounded-md px-4 py-5 text-left transition-colors hover:bg-zen-ochre hover:shadow-sm hover:shadow-black/5 focus-visible:bg-zen-ochre focus-visible:outline-none focus-visible:shadow-sm focus-visible:shadow-black/5 disabled:cursor-not-allowed disabled:opacity-40"
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
          <p className="mt-4 border-t border-black/5 pt-6 text-center text-sm text-app-text-muted">
            暂无项目，请先新建。
          </p>
        )}
      </section>
    </div>
  );
}
