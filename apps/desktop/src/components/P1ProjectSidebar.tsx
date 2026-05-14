import type { ProjectP1ControllerApi } from "../pages/useProjectP1Controller";
import type { GlossaryP2ControllerApi } from "../pages/useGlossaryP2Controller";
import {
  P1_CLAY_BTN_ONLINE_STT,
  P1_CLAY_BTN_PRIMARY,
  P1_CLAY_BTN_SECONDARY,
  P1_CLAY_SELECT,
  P1_CLAY_TEXT_INPUT,
} from "../config/p1ControlStyles";

const btnPrimary = P1_CLAY_BTN_PRIMARY;
const btnSecondary = P1_CLAY_BTN_SECONDARY;
const btnOnlineSttEntry = P1_CLAY_BTN_ONLINE_STT;

interface P1ProjectSidebarProps {
  controller: ProjectP1ControllerApi;
  glossary: GlossaryP2ControllerApi;
  workspacePhase: "A" | "B" | "C";
  onOpenOnlineStt: () => void;
}

export function P1ProjectSidebar({ controller: c, glossary: gl, workspacePhase, onOpenOnlineStt }: P1ProjectSidebarProps) {
  return (
    <aside className="min-h-0 min-w-0 space-y-4 overflow-y-auto border-zen-gray-300 bg-zen-ochre px-4 py-4 lg:h-auto lg:w-[min(16rem,28vw)] lg:max-w-[18rem] lg:shrink-0 lg:self-stretch lg:border-b-0 lg:border-r border-b">
      <div>
        <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">项目</h3>
        <div className="flex flex-wrap gap-2">
          <select
            className={`${P1_CLAY_SELECT} max-w-full flex-1 min-w-[8rem]`}
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
      </div>

      {workspacePhase === "C" ? (
        <div className="rounded-lg border border-zen-gray-300 bg-zen-paper p-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zen-stone">在线转写</p>
          <button
            type="button"
            className={`${btnOnlineSttEntry} w-full`}
            disabled={c.busy}
            onClick={onOpenOnlineStt}
            aria-controls="p1-online-stt-provider"
          >
            在线 STT Provider
          </button>
        </div>
      ) : null}

      {workspacePhase === "C" ? (
        <>
          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">新建另一项目</h3>
            <label className="mb-2 block text-[12px] text-zen-stone">
              项目名称
              <input
                className={`${P1_CLAY_TEXT_INPUT} mt-1`}
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

          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">术语库</h3>
            <p className="mb-2 text-[11px] leading-relaxed text-zen-stone">拉取语段时一并提交 hotwords（空格拼接）。</p>
            {gl.error ? <p className="mb-2 text-sm text-zen-cinnabar">{gl.error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <input
                className={`${P1_CLAY_TEXT_INPUT} min-w-0 flex-1`}
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
            <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[12px]">
              {gl.terms.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 rounded bg-zen-paper/60 px-2 py-1">
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

          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">诊断</h3>
            <button
              type="button"
              className={btnSecondary}
              disabled={c.busy}
              onClick={() => void c.exportDiagnosticBundle()}
            >
              导出诊断包（zip）
            </button>
          </div>
        </>
      ) : (
        <p className="text-[11px] leading-relaxed text-zen-stone">
          新建项目请使用主区「选择音频」；打开项目请使用上方下拉或最近列表。
        </p>
      )}
    </aside>
  );
}
