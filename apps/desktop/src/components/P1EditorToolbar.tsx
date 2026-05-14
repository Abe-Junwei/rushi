import type { ProjectP1ControllerApi } from "../pages/useProjectP1Controller";
import type { P1TranscriptionLayerApi } from "../pages/useP1TranscriptionLayer";
import { P1_CLAY_BTN_PRIMARY, P1_CLAY_BTN_SECONDARY } from "../config/p1ControlStyles";

const btnPrimary = P1_CLAY_BTN_PRIMARY;
const btnSecondary = P1_CLAY_BTN_SECONDARY;

interface P1EditorToolbarProps {
  controller: ProjectP1ControllerApi;
  tx: P1TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
}

export function P1EditorToolbar({ controller: c, tx, exportKey, onExportSelect }: P1EditorToolbarProps) {
  return (
    <div className="shrink-0 space-y-2 border-b border-zen-gray-300 bg-zen-paper px-3 py-3 sm:px-4">
      <p className="text-center text-sm text-zen-ink">
        <span className="font-medium">{c.current?.name}</span>
        <span className="text-zen-stone"> · </span>
        <code className="font-mono text-[11px] text-zen-indigo">{c.current?.id.slice(0, 8)}…</code>
      </p>
      <p className="text-center text-[10px] text-zen-stone">
        横向滚动与上方波形对齐；所有语段在同一条时间轨上按起止时间摆放，时间重叠则自动分行错开。
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className={btnPrimary}
          disabled={c.busy || c.prepareModelBusy}
          onClick={() => void c.runTranscribe()}
        >
          {c.prepareModelBusy ? "模型准备中…" : "从 ASR 拉取语段"}
        </button>
        <span className="self-center text-[10px] text-zen-stone">
          {c.prepareModelBusy ? "首次使用需下载模型，后台进行中，可继续编辑" : "（可能需数分钟）"}
        </span>
        <button type="button" className={btnPrimary} disabled={c.busy} onClick={() => void c.saveSegments()}>
          保存到 SQLite
        </button>
        <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => c.undo()}>
          撤销一步
        </button>
        <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => c.redo()}>
          重做一步
        </button>
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
      <div className="flex flex-wrap justify-center gap-2">
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
  );
}
