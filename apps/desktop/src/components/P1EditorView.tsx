import { P1ResizeBottomHit } from "./P1ResizeBottomHit";
import { P1SegmentContextMenu } from "./P1SegmentContextMenu";
import { P1SegmentTimelineCard } from "./P1SegmentTimelineCard";
import { P1WaveformTimeRuler } from "./P1WaveformTimeRuler";
import { P1WaveformZoomBar } from "./P1WaveformZoomBar";
import type { ProjectP1ControllerApi } from "../pages/useProjectP1Controller";
import type { P1TranscriptionLayerApi } from "../pages/useP1TranscriptionLayer";
import { p1PointerTimeFromSegmentCard, type P1SegmentContextMenuItem, type P1SegmentContextMenuKey } from "../utils/p1SegmentContextMenuModel";

const btnPrimary =
  "rounded px-3 py-1.5 text-xs font-medium bg-zen-saffron text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const btnSecondary =
  "rounded border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-zen-ink transition-colors hover:border-zen-saffron/35 hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40";

interface SegmentCtxMenuState {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
}

interface P1EditorViewProps {
  controller: ProjectP1ControllerApi;
  tx: P1TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  segmentCtxMenu: SegmentCtxMenuState | null;
  setSegmentCtxMenu: (v: SegmentCtxMenuState | null) => void;
  segmentCtxMenuItems: P1SegmentContextMenuItem[];
  onSegmentCtxMenuSelect: (key: P1SegmentContextMenuKey) => void;
}

export function P1EditorView({
  controller: c,
  tx,
  exportKey,
  onExportSelect,
  segmentCtxMenu,
  setSegmentCtxMenu,
  segmentCtxMenuItems,
  onSegmentCtxMenuSelect,
}: P1EditorViewProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-black/[0.06] px-3 py-3 sm:px-4">
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
            className={`${btnSecondary} max-w-[10rem] cursor-pointer py-1.5`}
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
              className={`${btnSecondary} cursor-pointer list-none py-1.5 text-center marker:content-none [&::-webkit-details-marker]:hidden`}
            >
              项目…
            </summary>
            <div className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded border border-black/[0.08] bg-zen-paper py-1 shadow-md">
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

      {c.transcribeHints.length > 0 ? (
        <ul className="shrink-0 space-y-1 border-b border-black/[0.05] bg-zen-ochre/35 px-4 py-2 text-[12px] text-zen-indigo">
          {c.transcribeHints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}

      {c.audioSrc ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-2 sm:px-2">
          <div
            ref={tx.tierScrollRef}
            onScroll={tx.onTierScroll}
            className="min-h-0 flex-1 overflow-auto rounded-md border border-black/[0.08] bg-zen-paper shadow-inner [overflow-anchor:none]"
          >
            <div
              style={{ width: tx.timelineWidthPx }}
              className={`inline-block align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <div
                className="sticky top-0 z-30 border-b border-black/20 bg-zen-ink shadow-sm"
                onContextMenu={(e) => {
                  if (c.busy) return;
                  e.preventDefault();
                  const t = tx.clientXToTimeSec(e.clientX);
                  const hit = c.segments.findIndex((s) => t >= s.start_sec && t <= s.end_sec);
                  const segmentIdx =
                    hit >= 0 ? hit : c.segments.length > 0 ? Math.min(c.selectedIdx, c.segments.length - 1) : 0;
                  setSegmentCtxMenu({ x: e.clientX, y: e.clientY, segmentIdx, pointerTimeSec: t });
                }}
              >
                {tx.loadError ? (
                  <p className="px-3 py-2 text-center text-[12px] text-zen-ochre">{tx.loadError}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 px-2 py-1.5 text-white/85">
                  <button
                    type="button"
                    className="rounded-full border border-white/20 p-2 transition-colors hover:bg-white/10 disabled:opacity-40"
                    disabled={c.busy || !tx.isReady}
                    onClick={() => void tx.togglePlay()}
                    aria-label={tx.isPlaying ? "暂停" : "播放"}
                  >
                    {tx.isPlaying ? (
                      <span className="flex h-3 w-3 items-center justify-center gap-0.5" aria-hidden>
                        <span className="h-2.5 w-0.5 bg-white" />
                        <span className="h-2.5 w-0.5 bg-white" />
                      </span>
                    ) : (
                      <span
                        className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-white"
                        aria-hidden
                      />
                    )}
                  </button>
                  <span className="font-mono text-[11px] tabular-nums tracking-tight">
                    {tx.formatMediaTime(tx.currentTime)} / {tx.formatMediaTime(tx.duration || 0)}
                  </span>
                  <span className="text-[10px] text-white/45" title="拖动波形区下边缘调节高度">
                    波形
                  </span>
                  <span className="min-w-[2.25rem] text-center font-mono text-[10px] text-white/70">
                    {tx.waveformHeightPx}px
                  </span>
                  <span className="text-[10px] text-white/45" title="拖动语段轨下边缘调节字号">
                    语段
                  </span>
                  <span className="min-w-[1.75rem] text-center font-mono text-[10px] text-white/70">
                    {tx.transcriptFontPx}px
                  </span>
                </div>
                <div className="relative overflow-x-hidden bg-white">
                  <div
                    ref={tx.waveformShellRef}
                    tabIndex={0}
                    className="relative z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zen-saffron/35"
                    onKeyDown={tx.onWaveformMainKeyDown}
                    onClick={() => tx.focusWaveformShell()}
                  >
                    <div
                      ref={tx.containerRef}
                      style={{ height: tx.waveformHeightPx }}
                      className="w-full shrink-0 bg-white"
                      role="img"
                      aria-label="转写波形与语段时间范围"
                    />
                  </div>
                  <P1ResizeBottomHit
                    busy={c.busy}
                    ariaLabel="拖动下边缘调节波形高度"
                    onPointerDown={tx.beginWaveformHeightDrag}
                  />
                </div>
                <div
                  className="sticky left-0 z-[25] shrink-0 bg-white"
                  style={{ width: Math.max(1, tx.tierScrollLayout.clientWidth) }}
                >
                  <P1WaveformTimeRuler
                    appearance="light"
                    durationSec={tx.duration || 0}
                    timelineWidthPx={tx.timelineWidthPx}
                    scrollLeftPx={tx.tierScrollLayout.scrollLeft}
                    viewportWidthPx={tx.tierScrollLayout.clientWidth}
                    pxPerSec={tx.pxPerSec}
                    currentTimeSec={tx.currentTime}
                    formatMediaTime={tx.formatMediaTime}
                    disabled={c.busy || !tx.isReady}
                    onSeekFromTierClientX={tx.seekFromTierClientX}
                    onPickAbsoluteTime={tx.onPickAbsoluteTime}
                    onSetScrollLeftPx={tx.setTierScrollPx}
                  />
                </div>
              </div>

              {c.segments.length === 0 ? (
                <div
                  className="relative mt-0 shrink-0 overflow-x-hidden border-b border-black/[0.06] bg-black/[0.02]"
                  style={{ width: tx.timelineWidthPx }}
                >
                  <div className="relative z-0 px-3 py-4 text-center text-xs leading-relaxed text-zen-stone">
                    当前无语段。可在波形空白处拖选新建，或使用「从 ASR
                    拉取语段」。若模型只返回全文而无分句时间戳，不会自动创建整轨语段（与解语一致）。
                  </div>
                  <P1ResizeBottomHit
                    busy={c.busy}
                    ariaLabel="拖动下边缘调节语段字号"
                    onPointerDown={tx.beginTranscriptFontDrag}
                  />
                </div>
              ) : (
                <div
                  className="relative mt-0 shrink-0 overflow-x-hidden border-b border-black/[0.06] bg-black/[0.02]"
                  style={{ width: tx.timelineWidthPx }}
                >
                  <div
                    className="relative z-0"
                    role="list"
                    aria-label="语段时间轨"
                    style={{
                      width: tx.timelineWidthPx,
                      height:
                        (c.segments.length === 0 ? 1 : Math.max(tx.segmentLaneLayout.laneCount, 1)) *
                          tx.segmentLaneRowPx +
                        12,
                    }}
                    onContextMenu={(e) => {
                      if (c.busy) return;
                      const row = (e.target as HTMLElement).closest("[data-p1-seg-row]");
                      if (!row) return;
                      const i = Number(row.getAttribute("data-p1-seg-row"));
                      if (!Number.isInteger(i) || i < 0 || i >= c.segments.length) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const seg = c.segments[i];
                      if (!seg) return;
                      const pointerTimeSec = p1PointerTimeFromSegmentCard(e.clientX, row.getBoundingClientRect(), seg);
                      setSegmentCtxMenu({ x: e.clientX, y: e.clientY, segmentIdx: i, pointerTimeSec });
                    }}
                  >
                    {c.segments.map((s, i) => (
                      <P1SegmentTimelineCard
                        key={i}
                        segment={s}
                        index={i}
                        selected={i === c.selectedIdx}
                        busy={c.busy}
                        timelineWidthPx={tx.timelineWidthPx}
                        pxPerSec={tx.pxPerSec}
                        lane={tx.segmentLaneLayout.laneByIndex[i] ?? 0}
                        rowH={tx.segmentLaneRowPx}
                        transcriptFontPx={tx.transcriptFontPx}
                        selectSegmentAt={tx.selectSegmentAt}
                        updateSegmentText={c.updateSegmentText}
                        onTextareaKeyDown={tx.onSegmentTextareaKeyDown}
                      />
                    ))}
                  </div>
                  <P1ResizeBottomHit
                    busy={c.busy}
                    ariaLabel="拖动下边缘调节语段字号"
                    onPointerDown={tx.beginTranscriptFontDrag}
                  />
                </div>
              )}
            </div>
          </div>
          <P1WaveformZoomBar
            disabled={c.busy}
            isReady={tx.isReady}
            pxPerSec={tx.pxPerSec}
            hasSelectionSegment={c.segments.length > 0}
            onZoomToFitAll={() => tx.zoomToFitTier()}
            onZoomToFitSelection={() => tx.zoomToFitSelection()}
            onZoomOneToOne={() => tx.resetZoom()}
            onZoomIn={() => tx.zoomIn()}
            onZoomOut={() => tx.zoomOut()}
            onPxPerSecChange={tx.setPxPerSec}
          />
        </div>
      ) : (
        <p className="shrink-0 px-4 py-6 text-center text-sm text-zen-stone">
          无法生成音频预览 URL（仅 Tauri 壳内可用）。
        </p>
      )}

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-white/35 px-4 py-1.5 text-[10px] text-zen-stone">
        <span>
          全局：⌘/Ctrl+Z 撤销 · ⌘/Ctrl+Shift+Z 重做（输入框内不触发）。波形区快捷键：Space 播/停 · ←/→ 切条 ·
          Tab / Shift+Tab 切条并播段 · ⌘/Ctrl+M 并下 · ⌘/Ctrl+Shift+M 并上 · ⌘/Ctrl+Shift+S 指针拆分 · , / .
          帧移 · [ / ] 低置信 · 双击波形语段仅播该段 · 底部缩放条调节横向比例（与解语同款布局） · 波形白区下边缘拖调高度
          · 语段轨下边缘拖调字号 · 空白拖选新建 · 重叠语段同轨分行 · 修改后请保存
        </span>
      </footer>
      {segmentCtxMenu ? (
        <P1SegmentContextMenu
          x={segmentCtxMenu.x}
          y={segmentCtxMenu.y}
          items={segmentCtxMenuItems}
          onSelect={onSegmentCtxMenuSelect}
          onClose={() => setSegmentCtxMenu(null)}
        />
      ) : null}
    </div>
  );
}
