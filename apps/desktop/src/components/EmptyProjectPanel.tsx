import * as fileApi from "../tauri/fileApi";
import { CLAY_BTN_SECONDARY } from "../config/controlStyles";
import type { ProjectControllerApi } from "../pages/useProjectController";

function InboxIcon() {
  return (
    <svg className="mb-3 h-12 w-12 text-zen-stone/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 4h16v12H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16h5l1.5 2h3L15 16h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EmptyProjectPanel({ controller: c }: { controller: ProjectControllerApi }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-12">
      <InboxIcon />
      <p className="mb-1 text-center font-sans text-sm text-zen-ink">项目为空</p>
      <p className="mb-6 text-center font-sans text-[12px] text-zen-stone">导入音频或文本文件开始工作</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className={CLAY_BTN_SECONDARY}
          disabled={c.busy}
          onClick={() => {
            void (async () => {
              if (!c.current) return;
              try {
                const srcPath = await fileApi.pickAudioPath();
                if (!srcPath) return;
                const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名音频";
                await fileApi.importAudioToProject(c.current.id, name, srcPath);
                await c.refreshCurrentProject();
              } catch (e) {
                c.setError(e instanceof Error ? e.message : String(e));
              }
            })();
          }}
        >
          导入音频
        </button>
        <button
          type="button"
          className={CLAY_BTN_SECONDARY}
          disabled={c.busy}
          onClick={() => {
            void (async () => {
              if (!c.current) return;
              try {
                const srcPath = await fileApi.pickTextPath();
                if (!srcPath) return;
                const name = srcPath.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "") || "未命名文本";
                await fileApi.importTextToProject(c.current.id, name, srcPath);
                await c.refreshCurrentProject();
              } catch (e) {
                c.setError(e instanceof Error ? e.message : String(e));
              }
            })();
          }}
        >
          导入文本文件
        </button>
      </div>
    </div>
  );
}
