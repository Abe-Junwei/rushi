import type { ProjectControllerApi } from "../pages/useProjectController";
import { CLAY_BTN_PRIMARY, CLAY_BTN_SECONDARY, CLAY_TEXT_INPUT } from "../config/controlStyles";

interface ConfirmCreateViewProps {
  controller: ProjectControllerApi;
  pickedBasename: string;
}

export function ConfirmCreateView({ controller: c, pickedBasename }: ConfirmCreateViewProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10" data-purpose="modal-container">
      <div
        className="w-full max-w-2xl rounded-3xl border border-zen-gray-300 bg-serene-surface-card px-6 py-8 sm:px-8"
        data-purpose="confirm-project-card"
      >
        <h1 className="mb-7 text-center font-serif text-[28px] font-medium leading-tight text-zen-ink sm:text-[32px]" data-purpose="modal-title">
          确认创建项目
        </h1>
        <div className="mb-5 space-y-3" data-purpose="file-info">
          <div className="grid gap-2 border-b border-zen-gray-300 pb-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-5">
            <span className="font-sans text-[11px] font-semibold tracking-[0.08em] text-zen-ink">音频文件</span>
            <span className="break-all font-mono text-[12px] leading-relaxed text-zen-indigo">{pickedBasename}</span>
          </div>
          <div className="grid gap-2 border-b border-zen-gray-300 pb-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-5">
            <span className="font-sans text-[11px] font-semibold tracking-[0.08em] text-zen-ink">完整路径</span>
            <span className="break-all font-mono text-[12px] leading-relaxed text-zen-stone">{c.pickedPath}</span>
          </div>
        </div>
        <section className="text-left" data-purpose="project-form">
          <label className="mb-2 block font-sans text-[11px] font-semibold tracking-[0.08em] text-zen-ink" htmlFor="confirm-project-name">
            项目名称
          </label>
          <input
            id="confirm-project-name"
            type="text"
            className={`confirm-project-input ${CLAY_TEXT_INPUT} mb-8 bg-white`}
            placeholder="输入项目名称"
            value={c.newName}
            onChange={(e) => c.setNewName(e.target.value)}
            disabled={c.busy}
          />
          <div
            className="flex flex-col items-stretch justify-end gap-3 pt-1 sm:flex-row sm:items-center sm:gap-4"
            data-purpose="action-buttons"
          >
            <button
              type="button"
              className="h-11 px-3 font-sans text-sm text-zen-stone transition-colors hover:text-zen-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={c.busy}
              onClick={() => c.clearPickedAudio()}
            >
              取消
            </button>
            <button
              type="button"
              className={`w-full sm:w-auto sm:min-w-[9rem] ${CLAY_BTN_SECONDARY}`}
              disabled={c.busy}
              onClick={() => void c.pickAudio()}
            >
              重新选择音频
            </button>
            <button
              type="button"
              className={`w-full sm:w-auto sm:min-w-[8rem] ${CLAY_BTN_PRIMARY}`}
              disabled={c.busy}
              onClick={() => void c.createProject()}
            >
              创建项目
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
