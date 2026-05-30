import { History, Minus, Plus, Redo2, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { footerActionIconBtn } from "./editorSegmentToolbarStyles";
import { summarizeHistoryDetail } from "./useEditorEditHistory";
import type { useEditorEditHistory } from "./useEditorEditHistory";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";

type EditHistoryApi = ReturnType<typeof useEditorEditHistory>;
type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

interface EditorSegmentToolbarProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  editHistory: EditHistoryApi;
}

export function EditorSegmentToolbar({
  controller: c,
  tx,
  appearance: a,
  editHistory: h,
}: EditorSegmentToolbarProps) {
  const fontEntryRef = useRef<HTMLDivElement | null>(null);
  const appearanceBtnBase =
    "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-3 text-[12px] font-medium leading-none transition-colors";

  useEffect(() => {
    if (!a.fontPanelOpen) return;
    const onWindowPointerDown = (event: PointerEvent) => {
      const root = fontEntryRef.current;
      if (!root) return;
      if (root.contains(event.target as Node)) return;
      a.setFontPanelOpen(false);
    };
    window.addEventListener("pointerdown", onWindowPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onWindowPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.fontPanelOpen, a.setFontPanelOpen]);

  return (
    <div className="flex h-14 shrink-0 items-center justify-between bg-notion-bg px-6">
      <div className="relative flex items-center gap-1.5">
        <button
          type="button"
          className={[
            appearanceBtnBase,
            "px-2.5",
            c.autoPunctuateDialog.phase === "loading"
              ? "bg-notion-sidebar text-notion-text"
              : "text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
          ].join(" ")}
          disabled={!c.canAutoPunctuate || c.autoPunctuateDialog.phase === "loading"}
          onClick={() => void c.requestAutoPunctuate()}
          aria-label="自动标点"
          title={
            c.canAutoPunctuate
              ? "自动标点"
              : "请先在设置 → LLM 配置 中保存 API Key"
          }
        >
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {c.autoPunctuateDialog.phase === "loading" ? "处理中..." : "自动标点"}
          </span>
        </button>
        <button
          type="button"
          className={footerActionIconBtn}
          disabled={c.busy}
          onClick={() => c.undo()}
          aria-label="撤销"
          title="撤销"
        >
          <Undo2 className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className={footerActionIconBtn}
          disabled={c.busy}
          onClick={() => c.redo()}
          aria-label="重做"
          title="重做"
        >
          <Redo2 className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className={footerActionIconBtn}
          disabled={h.historyDisabled}
          onClick={() => void h.toggleHistory()}
          aria-label="编辑历史"
          title="编辑历史"
        >
          <History className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>

        {h.historyOpen ? (
          <div className="dropdown-surface absolute left-0 top-full z-[90] mt-2 w-[24rem] max-w-[calc(100vw-1rem)] p-2">
            <div className="mb-2 flex items-center justify-between border-b border-notion-divider px-1 pb-1">
              <span className="text-[11px] font-semibold text-notion-text">编辑历史</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-6 items-center justify-center rounded-md border border-notion-border px-2 text-[11px] text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover"
                  onClick={() => void h.loadEditHistory()}
                  disabled={h.historyBusy}
                >
                  刷新
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 items-center justify-center rounded-md border border-notion-border px-2 text-[11px] text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover"
                  onClick={() => h.setHistoryOpen(false)}
                >
                  关闭
                </button>
              </div>
            </div>
            {h.historyBusy ? (
              <div className="px-1 py-2 text-[11px] text-notion-text-muted">正在加载...</div>
            ) : h.historyError ? (
              <div className="px-1 py-2 text-[11px] text-zen-cinnabar">{h.historyError}</div>
            ) : h.historyRows.length === 0 ? (
              <div className="px-1 py-2 text-[11px] text-notion-text-muted">暂无记录</div>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto px-1 py-1">
                {h.historyRows.map((row) => (
                  <li key={row.id} className="rounded-md border border-notion-divider bg-notion-bg px-2 py-1.5">
                    <p className="text-[11px] font-medium text-notion-text">
                      {new Date(row.at_ms).toLocaleString()} · {row.kind}
                    </p>
                    <p className="mt-0.5 text-[11px] text-notion-text-muted">{summarizeHistoryDetail(row.detail)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div ref={fontEntryRef} className="relative flex items-center gap-1">
        <button
          type="button"
          className={[
            appearanceBtnBase,
            a.fontPanelOpen
              ? "bg-notion-sidebar text-notion-text"
              : "text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
          ].join(" ")}
          disabled={a.transcriptFontControlDisabled}
          onClick={() => a.setFontPanelOpen((v) => !v)}
          aria-label="打开字体设置"
          aria-expanded={a.fontPanelOpen}
          aria-haspopup="dialog"
        >
          字体
        </button>
        <button
          type="button"
          className={[
            appearanceBtnBase,
            a.transcriptFontWeight >= 700
              ? "bg-notion-sidebar text-notion-text"
              : "text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
          ].join(" ")}
          disabled={a.transcriptFontControlDisabled}
          onClick={() => a.setTranscriptFontWeight((v) => (v >= 700 ? 500 : 700))}
          aria-label="切换粗体"
          title="加粗"
        >
          <span className="font-semibold">加粗</span>
        </button>
        <button
          type="button"
          className={[
            appearanceBtnBase,
            a.transcriptFontItalic
              ? "bg-notion-sidebar text-notion-text"
              : "text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text",
          ].join(" ")}
          disabled={a.transcriptFontControlDisabled}
          onClick={() => a.setTranscriptFontItalic((v) => !v)}
          aria-label="切换斜体"
          title="斜体"
        >
          <span className="font-medium">斜体</span>
        </button>

        {a.fontPanelOpen ? (
          <div
            role="dialog"
            aria-label="字体调整面板"
            className="absolute right-0 top-10 z-50 w-[18.5rem] rounded-md border border-notion-divider bg-notion-bg p-2.5 shadow-lg"
          >
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-notion-text-muted">
              文本排版
            </div>

            <div className="grid gap-2">
              <label className="grid gap-1 text-[11px] text-notion-text-muted">
                <span>系统字体</span>
                <select
                  className="h-7 w-full rounded-md border border-notion-divider bg-notion-bg px-2 text-[11px] text-notion-text-muted outline-none focus:border-zen-saffron/45"
                  value={a.transcriptFontFamily}
                  disabled={a.transcriptFontControlDisabled}
                  onChange={(e) => a.setTranscriptFontFamily(a.normalizeFontFamily(e.target.value))}
                  aria-label="选择系统字体"
                  title="系统字体"
                >
                  {a.fontOptions.map((family) => (
                    <option key={family} value={family}>
                      {family}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 text-[11px] text-notion-text-muted">
                <span>字号</span>
                <div className="inline-flex h-7 items-center justify-between rounded-md border border-notion-divider bg-notion-bg px-1 text-[11px] text-notion-text-muted">
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-notion-divider bg-notion-sidebar text-[11px] leading-none text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover"
                    disabled={a.transcriptFontControlDisabled}
                    onClick={() => tx.nudgeTranscriptFontPx(-1)}
                    aria-label="减小字号"
                  >
                    <Minus className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  </button>
                  <span className="px-2 tabular-nums">{Math.round(tx.transcriptFontPx)}px</span>
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-notion-divider bg-notion-sidebar text-[11px] leading-none text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover"
                    disabled={a.transcriptFontControlDisabled}
                    onClick={() => tx.nudgeTranscriptFontPx(1)}
                    aria-label="增大字号"
                  >
                    <Plus className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  </button>
                </div>

                <span>字体库</span>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-md border border-notion-divider bg-notion-sidebar px-2 text-[11px] text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light"
                  disabled={a.transcriptFontControlDisabled || a.fontLoadBusy}
                  onClick={() => {
                    void a.loadSystemFonts();
                  }}
                  aria-label="刷新系统字体"
                  title="刷新系统字体"
                >
                  {a.fontLoadBusy ? "读取中..." : "刷新系统字体"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
