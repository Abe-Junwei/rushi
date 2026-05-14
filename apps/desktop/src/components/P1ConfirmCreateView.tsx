import type { ProjectP1ControllerApi } from "../pages/useProjectP1Controller";
import { P1_CLAY_BTN_PRIMARY, P1_CLAY_BTN_SECONDARY, P1_CLAY_TEXT_INPUT } from "../config/p1ControlStyles";

interface P1ConfirmCreateViewProps {
  controller: ProjectP1ControllerApi;
  pickedBasename: string;
}

export function P1ConfirmCreateView({ controller: c, pickedBasename }: P1ConfirmCreateViewProps) {
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
          <label className="mb-2 block font-sans text-sm font-semibold text-gray-600" htmlFor="p1-confirm-project-name">
            项目名称
          </label>
          <input
            id="p1-confirm-project-name"
            type="text"
            className={`p1-confirm-project-input ${P1_CLAY_TEXT_INPUT} mb-10`}
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
              className={`order-1 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${P1_CLAY_BTN_PRIMARY}`}
              disabled={c.busy}
              onClick={() => void c.createProject()}
            >
              创建项目
            </button>
            <button
              type="button"
              className={`order-2 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${P1_CLAY_BTN_SECONDARY}`}
              disabled={c.busy}
              onClick={() => void c.pickAudio()}
            >
              重新选择
            </button>
            <button
              type="button"
              className={`order-3 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${P1_CLAY_BTN_SECONDARY}`}
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
