import type { ProjectControllerApi } from "../pages/useProjectController";
import { CLAY_BTN_PRIMARY, CLAY_BTN_SECONDARY, CLAY_TEXT_INPUT } from "../config/controlStyles";

interface ConfirmCreateViewProps {
  controller: ProjectControllerApi;
  pickedBasename: string;
}

export function ConfirmCreateView({ controller: c, pickedBasename }: ConfirmCreateViewProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto p-4" data-purpose="modal-container">
      <div
        className="w-full max-w-[600px] rounded-xl border border-zen-gray-300 bg-zen-paper px-6 py-12 text-center sm:px-10 sm:py-14"
        data-purpose="confirm-project-card"
      >
        <h1 className="mb-8 text-3xl font-semibold tracking-tight text-zen-ink sm:text-4xl" data-purpose="modal-title">
          确认创建项目
        </h1>
        <div className="mb-12 space-y-1.5" data-purpose="file-info">
          <p className="font-sans text-lg font-semibold text-zen-ink sm:text-xl">{pickedBasename}</p>
          <p className="break-all font-mono text-xs leading-relaxed text-zen-gray-400">{c.pickedPath}</p>
        </div>
        <section className="mx-auto max-w-md text-left" data-purpose="project-form">
          <label className="mb-2 block font-sans text-sm font-semibold text-gray-600" htmlFor="confirm-project-name">
            项目名称
          </label>
          <input
            id="confirm-project-name"
            type="text"
            className={`confirm-project-input ${CLAY_TEXT_INPUT} mb-10`}
            placeholder="输入项目名称"
            value={c.newName}
            onChange={(e) => c.setNewName(e.target.value)}
            disabled={c.busy}
          />
          <div
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4"
            data-purpose="action-buttons"
          >
            <button
              type="button"
              className={`order-1 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${CLAY_BTN_PRIMARY}`}
              disabled={c.busy}
              onClick={() => void c.createProject()}
            >
              创建项目
            </button>
            <button
              type="button"
              className={`order-2 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${CLAY_BTN_SECONDARY}`}
              disabled={c.busy}
              onClick={() => void c.pickAudio()}
            >
              重新选择
            </button>
            <button
              type="button"
              className={`order-3 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${CLAY_BTN_SECONDARY}`}
              disabled={c.busy}
              onClick={() => c.clearPickedAudio()}
            >
              取消
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
