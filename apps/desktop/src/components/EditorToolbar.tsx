import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import { CLAY_BTN_PRIMARY, CLAY_BTN_SECONDARY } from "../config/controlStyles";

const btnPrimary = CLAY_BTN_PRIMARY;
const btnSecondary = CLAY_BTN_SECONDARY;

interface EditorToolbarProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
}

export function EditorToolbar({ controller: c, tx, exportKey, onExportSelect }: EditorToolbarProps) {
  const projectName = c.current?.name ?? "未命名项目";
  const projectShortId = c.current?.id ? `${c.current.id.slice(0, 8)}…` : "";

  return (
    <div className="shrink-0 border-b border-zen-gray-300 bg-zen-paper px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 border-b border-zen-gray-300/80 pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">项目工作台</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zen-ink">
            <span className="font-medium">{projectName}</span>
            {projectShortId ? <span className="text-zen-stone">·</span> : null}
            {projectShortId ? <code className="font-mono text-[11px] text-zen-indigo">{projectShortId}</code> : null}
          </div>
        </div>
        <p className="max-w-2xl text-[10px] leading-relaxed text-zen-stone lg:text-right">
          横向滚动查看全长；左侧为文本与时间，右侧色块与上方波形保持同一像素标尺对齐。
        </p>
      </div>

      <div className="flex flex-col gap-3 border-b border-zen-gray-300/80 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnPrimary}
            disabled={c.busy || c.prepareModelBusy}
            onClick={() => void c.runTranscribe()}
          >
            {c.prepareModelBusy ? "模型准备中…" : "从 ASR 拉取语段"}
          </button>
          <button type="button" className={btnPrimary} disabled={c.busy} onClick={() => void c.saveSegments()}>
            保存到 SQLite
          </button>
          <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => c.undo()}>
            撤销一步
          </button>
          <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => c.redo()}>
            重做一步
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <select
            className={`${btnSecondary} max-w-[10rem] shrink-0 cursor-pointer`}
            value={exportKey}
            disabled={c.busy}
            onChange={(e) => {
              const v = e.target.value;
              if (v) onExportSelect(v);
            }}
          >
            <option value="">导出…</option>
            <option value="txt">TXT</option>
            <option value="srt">SRT</option>
            <option value="docx_verbatim">DOCX 逐字稿</option>
            <option value="docx_lecture">DOCX 讲稿</option>
          </select>
          <details className="relative">
            <summary
              className={`${btnSecondary} cursor-pointer list-none text-center marker:content-none [&::-webkit-details-marker]:hidden`}
            >
              项目…
            </summary>
            <div className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded-xl border border-zen-gray-300 bg-app-bg py-1">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[12px] text-zen-ink hover:bg-zen-ochre"
                disabled={c.busy}
                onClick={() => void c.exportProjectBundle()}
              >
                导出项目包（zip）
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[12px] text-zen-ink hover:bg-zen-ochre"
                disabled={c.busy}
                onClick={() => void c.importProjectBundle()}
              >
                导入项目包（zip）
              </button>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[12px] text-zen-cinnabar hover:bg-zen-cinnabar/10"
                disabled={c.busy}
                onClick={() => {
                  const id = c.current?.id;
                  if (id) void c.deleteProject(id);
                }}
              >
                删除项目
              </button>
            </div>
          </details>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-[10px] text-zen-stone">
          {c.prepareModelBusy ? "首次使用需下载模型，后台进行中，可继续编辑。" : "从 ASR 拉取语段可能需要数分钟。"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnSecondary}
            disabled={tx.segmentToolbar.splitDisabled}
            onClick={() => tx.segmentToolbar.splitAtSelection()}
          >
            拆分当前语段
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={tx.segmentToolbar.mergePrevDisabled}
            onClick={() => tx.segmentToolbar.mergeWithPrev()}
          >
            与上一条合并
          </button>
          <button
            type="button"
            className={btnSecondary}
            disabled={tx.segmentToolbar.mergeDisabled}
            onClick={() => tx.segmentToolbar.mergeWithNext()}
          >
            与下一条合并
          </button>
        </div>
      </div>
    </div>
  );
}
