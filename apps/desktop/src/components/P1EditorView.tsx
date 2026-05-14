import { P1EditorToolbar } from "./P1EditorToolbar";
import { P1ResizeBottomHit } from "./P1ResizeBottomHit";
import { P1SegmentContextMenu } from "./P1SegmentContextMenu";
import { P1SegmentTimelineCard } from "./P1SegmentTimelineCard";
import { P1WaveformTimeRuler } from "./P1WaveformTimeRuler";
import { P1WaveformZoomBar } from "./P1WaveformZoomBar";
import type { ProjectP1ControllerApi } from "../pages/useProjectP1Controller";
import type { P1TranscriptionLayerApi } from "../pages/useP1TranscriptionLayer";
import { p1PointerTimeFromSegmentCard, type P1SegmentContextMenuItem, type P1SegmentContextMenuKey } from "../utils/p1SegmentContextMenuModel";



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
      <P1EditorToolbar controller={c} tx={tx} exportKey={exportKey} onExportSelect={onExportSelect} />

      {c.transcribeHints.length > 0 ? (
        <ul className="shrink-0 space-y-1 border-b border-zen-gray-300 bg-app-highlight px-4 py-2 text-[12px] text-gray-700">
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
            className="min-h-0 flex-1 overflow-auto rounded-lg border border-zen-gray-300 bg-zen-paper shadow-inner [overflow-anchor:none]"
          >
            <div
              style={{ width: tx.timelineWidthPx }}
              className={`inline-block align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <div
                className="sticky top-0 z-30 border-b border-zen-gray-300 bg-zen-ochre"
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
                  <p className="border-b border-zen-gray-300 bg-amber-50 px-3 py-2 text-center text-[12px] text-red-700">
                    {tx.loadError}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-zen-gray-300 bg-zen-paper px-2 py-1.5 text-zen-ink">
                  <button
                    type="button"
                    className="rounded-full border border-zen-gray-300 bg-zen-paper p-2 text-zen-ink transition-colors hover:border-zen-gray-400 hover:bg-zen-ochre disabled:opacity-40"
                    disabled={c.busy || !tx.isReady}
                    onClick={() => void tx.togglePlay()}
                    aria-label={tx.isPlaying ? "暂停" : "播放"}
                  >
                    {tx.isPlaying ? (
                      <span className="flex h-3 w-3 items-center justify-center gap-0.5" aria-hidden>
                        <span className="h-2.5 w-0.5 bg-zen-ink" />
                        <span className="h-2.5 w-0.5 bg-zen-ink" />
                      </span>
                    ) : (
                      <span
                        className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-zen-ink"
                        aria-hidden
                      />
                    )}
                  </button>
                  <span className="font-mono text-[11px] tabular-nums tracking-tight text-zen-ink">
                    {tx.formatMediaTime(tx.currentTime)} / {tx.formatMediaTime(tx.duration || 0)}
                  </span>
                  <span className="text-[10px] text-zen-stone" title="拖动波形区下边缘调节高度">
                    波形
                  </span>
                  <span className="min-w-[2.25rem] text-center font-mono text-[10px] text-zen-stone">
                    {tx.waveformHeightPx}px
                  </span>
                  <span className="text-[10px] text-zen-stone" title="拖动语段轨下边缘调节字号">
                    语段
                  </span>
                  <span className="min-w-[1.75rem] text-center font-mono text-[10px] text-zen-stone">
                    {tx.transcriptFontPx}px
                  </span>
                </div>
                <div className="relative overflow-x-hidden bg-zen-paper">
                  <div
                    ref={tx.waveformShellRef}
                    tabIndex={0}
                    className="relative z-0 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-ink/20"
                    onKeyDown={tx.onWaveformMainKeyDown}
                    onClick={() => tx.focusWaveformShell()}
                  >
                    <div
                      ref={tx.containerRef}
                      style={{ height: tx.waveformHeightPx }}
                      className="w-full shrink-0 bg-zen-paper"
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
                  className="sticky left-0 z-[25] shrink-0 bg-zen-paper"
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
                  className="relative mt-0 shrink-0 overflow-x-hidden border-b border-zen-gray-300 bg-zen-ochre"
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
                  className="relative mt-0 shrink-0 overflow-x-hidden border-b border-zen-gray-300 bg-zen-ochre"
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

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-zen-gray-300 bg-zen-ochre px-4 py-1.5 text-[10px] text-zen-stone">
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
