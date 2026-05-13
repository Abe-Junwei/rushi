import type { ProjectP1ControllerApi } from "../pages/useProjectP1Controller";

const confirmProjectInput =
  "p1-confirm-project-input block w-full appearance-none rounded-xl border-2 border-solid border-brand-input-border bg-white px-4 py-3 font-sans text-base font-medium text-gray-800 outline-none transition-[border-color,box-shadow] placeholder:text-gray-400 focus:border-brand-orange focus:shadow-[0_0_0_3px_rgba(217,160,102,0.1)] disabled:cursor-not-allowed disabled:opacity-40";

const confirmSecondaryBtn =
  "inline-flex appearance-none items-center justify-center rounded-xl border-0 bg-zen-gray-200 px-6 py-3 font-sans text-sm font-semibold text-gray-700 transition-all active:scale-95 hover:bg-zen-gray-300 disabled:cursor-not-allowed disabled:opacity-40";

const confirmCreatePrimaryStyle: React.CSSProperties = {
  WebkitAppearance: "none",
  MozAppearance: "none",
  appearance: "none",
  borderStyle: "none",
  color: "#fff",
  backgroundColor: "#C69C6D",
  boxShadow: "0 2px 8px rgba(198, 156, 109, 0.35)",
};

interface P1ConfirmCreateViewProps {
  controller: ProjectP1ControllerApi;
  pickedBasename: string;
}

export function P1ConfirmCreateView({ controller: c, pickedBasename }: P1ConfirmCreateViewProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto p-4" data-purpose="modal-container">
      <div
        className="w-full max-w-[600px] rounded-2xl bg-white px-6 py-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:px-10 sm:py-14"
        data-purpose="confirm-project-card"
      >
        <h1 className="mb-8 font-serif text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" data-purpose="modal-title">
          确认创建项目
        </h1>
        <div className="mb-12 space-y-1.5" data-purpose="file-info">
          <p className="font-sans text-lg font-medium text-gray-800 sm:text-xl">{pickedBasename}</p>
          <p className="break-all font-sans text-xs leading-relaxed text-gray-400">{c.pickedPath}</p>
        </div>
        <section className="mx-auto max-w-md text-left" data-purpose="project-form">
          <label className="mb-2 block font-sans text-sm font-semibold text-gray-600" htmlFor="p1-confirm-project-name">
            项目名称
          </label>
          <input
            id="p1-confirm-project-name"
            type="text"
            className={`${confirmProjectInput} mb-10`}
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
              className="order-1 w-full rounded-xl py-3 px-6 font-sans text-sm font-bold transition-all hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem]"
              style={confirmCreatePrimaryStyle}
              disabled={c.busy}
              onClick={() => void c.createProject()}
            >
              创建项目
            </button>
            <button
              type="button"
              className={`order-2 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${confirmSecondaryBtn}`}
              disabled={c.busy}
              onClick={() => void c.pickAudio()}
            >
              重新选择
            </button>
            <button
              type="button"
              className={`order-3 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${confirmSecondaryBtn}`}
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
