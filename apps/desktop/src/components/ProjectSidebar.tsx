import type { ProjectControllerApi } from "../pages/useProjectController";
import type { GlossaryControllerApi } from "../pages/useGlossaryController";
import {
  CLAY_BTN_ONLINE_STT,
  CLAY_BTN_PRIMARY,
  CLAY_BTN_SECONDARY,
  CLAY_SELECT,
  CLAY_TEXT_INPUT,
} from "../config/controlStyles";
import { FileTreeCard } from "./FileTreeCard";

const btnPrimary = CLAY_BTN_PRIMARY;
const btnSecondary = CLAY_BTN_SECONDARY;
const btnOnlineSttEntry = CLAY_BTN_ONLINE_STT;
const sectionCard = "rounded-2xl border border-zen-gray-300 bg-serene-surface-container-low px-3 py-3";

interface ProjectSidebarProps {
  controller: ProjectControllerApi;
  glossary: GlossaryControllerApi;
  workspacePhase: "A" | "C";
  onOpenOnlineStt: () => void;
}

export function ProjectSidebar({ controller: c, glossary: gl, workspacePhase, onOpenOnlineStt }: ProjectSidebarProps) {
  const projectShortId = c.current?.id ? `${c.current.id.slice(0, 8)}…` : "";

  if (workspacePhase === "A") {
    return (
      <aside className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-zen-gray-300 bg-zen-paper px-4 py-5 lg:h-auto lg:w-[18rem] lg:shrink-0 lg:self-stretch lg:border-b-0 lg:border-r border-b">
        <div className="mb-7">
          <h2 className="font-sans text-sm font-semibold leading-snug text-zen-ink">项目管理</h2>
          <p className="mt-2 font-sans text-[11px] text-zen-stone">选择工作区</p>
        </div>
        <div className="flex-1 space-y-3">
          <label className="mb-7 block">
            <span className="sr-only">打开已有项目</span>
            <select
              className={`${CLAY_SELECT} max-w-full`}
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
                  {p.name} ({new Date(p.updated_at_ms).toLocaleString()})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="flex w-full appearance-none items-center gap-3 border-0 border-r-2 border-zen-saffron bg-serene-surface-container-low px-3 py-3 font-sans text-[12px] font-semibold text-zen-saffron transition-colors hover:bg-serene-surface-container disabled:cursor-not-allowed disabled:opacity-40"
            disabled={c.busy}
            aria-current="page"
          >
            <span aria-hidden className="text-[16px] leading-none">□</span>
            当前项目
          </button>
          <button
            type="button"
            className="flex w-full appearance-none items-center gap-3 rounded-lg border-0 bg-transparent px-3 py-3 font-sans text-[12px] text-zen-stone transition-colors hover:bg-serene-surface-container hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40"
            disabled={c.busy}
            onClick={() => void c.refreshProjects()}
          >
            <span aria-hidden className="text-[16px] leading-none">↻</span>
            刷新项目库
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="min-h-0 min-w-0 space-y-4 overflow-y-auto border-zen-gray-300 bg-zen-paper px-4 py-4 lg:h-auto lg:w-[min(16rem,28vw)] lg:max-w-[18rem] lg:shrink-0 lg:self-stretch lg:border-b-0 lg:border-r border-b">
      <div className={sectionCard}>
        <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">项目</p>
        <div className="mb-3 space-y-1">
          <p className="text-sm font-medium text-zen-ink">{c.current?.name ?? "未命名项目"}</p>
          {projectShortId ? <p className="font-mono text-[10px] text-zen-indigo">{projectShortId}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className={`${CLAY_SELECT} max-w-full flex-1 min-w-[8rem]`}
            value=""
            disabled={c.busy}
            onChange={(e) => {
              const id = e.target.value;
              if (id) void c.loadProject(id);
              e.target.value = "";
            }}
          >
            <option value="">打开已有项目…</option>
            {c.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({new Date(p.updated_at_ms).toLocaleString()})
              </option>
            ))}
          </select>
          <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => void c.refreshProjects()}>
            刷新
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-zen-stone">切换项目时将保留当前工作台结构，主区只替换为对应音频与语段。</p>
      </div>

      <FileTreeCard controller={c} />

      <div className={sectionCard}>
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">在线转写</p>
        <p className="mb-3 text-[11px] leading-relaxed text-zen-stone">需要切换在线 STT 提供方或校验连通性时，从这里进入。</p>
        <button
          type="button"
          className={`${btnOnlineSttEntry} w-full`}
          disabled={c.busy}
          onClick={onOpenOnlineStt}
          aria-controls="online-stt-provider"
        >
          在线 STT 提供方
        </button>
      </div>

      <div className={sectionCard}>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">新建另一项目</h3>
        <p className="mb-3 text-[11px] leading-relaxed text-zen-stone">在保留当前项目的同时，新建并切换到另一条音频工作流。</p>
        <label className="mb-2 block text-[12px] text-zen-stone">
          项目名称
          <input
            className={`${CLAY_TEXT_INPUT} mt-1`}
            value={c.newName}
            onChange={(e) => c.setNewName(e.target.value)}
            disabled={c.busy}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => void c.pickAudio()}>
            选择音频…
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={c.busy || !c.pickedPath}
            onClick={() => void c.createProject()}
          >
            创建项目
          </button>
        </div>
        {c.pickedPath ? (
          <p className="mt-2 break-all font-mono text-[10px] text-zen-indigo">{c.pickedPath}</p>
        ) : null}
      </div>

      <div className={sectionCard}>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">术语库</h3>
        <p className="mb-2 text-[11px] leading-relaxed text-zen-stone">拉取语段时一并提交 hotwords，适合人名、地名与专有术语统一。</p>
        {gl.error ? <p className="mb-2 text-sm text-zen-cinnabar">{gl.error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <input
            className={`${CLAY_TEXT_INPUT} min-w-0 flex-1`}
            placeholder="输入术语…"
            value={gl.newTerm}
            onChange={(e) => gl.setNewTerm(e.target.value)}
            disabled={gl.busy || c.busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") void gl.add();
            }}
          />
          <button
            type="button"
            className={btnSecondary}
            disabled={gl.busy || !gl.newTerm.trim() || c.busy}
            onClick={() => void gl.add()}
          >
            添加
          </button>
        </div>
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-[12px]">
          {gl.terms.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-zen-gray-300/80 bg-app-bg px-2 py-1.5">
              <span className="truncate text-zen-ink">{t.term}</span>
              <button
                type="button"
                className={btnSecondary}
                disabled={gl.busy || c.busy}
                onClick={() => void gl.remove(t.id)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className={sectionCard}>
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">诊断</h3>
        <p className="mb-3 text-[11px] leading-relaxed text-zen-stone">导出日志、数据库摘要与环境信息，便于定位桌面端问题。</p>
        <button
          type="button"
          className={`${btnSecondary} w-full`}
          disabled={c.busy}
          onClick={() => void c.exportDiagnosticBundle()}
        >
          导出诊断包（zip）
        </button>
      </div>
    </aside>
  );
}
