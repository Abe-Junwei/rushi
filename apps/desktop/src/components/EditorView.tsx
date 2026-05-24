import { EditorToolbar } from "./EditorToolbar";
import { ResizeBottomHit } from "./ResizeBottomHit";
import { SegmentContextMenu } from "./SegmentContextMenu";
import { SegmentTimelineCard } from "./SegmentTimelineCard";
import { WaveformTimeRuler } from "./WaveformTimeRuler";
import { WaveformZoomBar } from "./WaveformZoomBar";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import * as fileApi from "../tauri/fileApi";
import { CLAY_BTN_SECONDARY } from "../config/controlStyles";
import { pointerTimeFromSegmentCard, type SegmentContextMenuItem, type SegmentContextMenuKey } from "../utils/segmentContextMenuModel";



interface SegmentCtxMenuState {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
}

function InboxIcon() {
  return (
    <svg className="mb-3 h-12 w-12 text-zen-stone/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 4h16v12H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16h5l1.5 2h3L15 16h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmptyProjectPanel({ controller: c }: { controller: ProjectControllerApi }) {
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

interface EditorViewProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  exportKey: string;
  onExportSelect: (key: string) => void;
  segmentCtxMenu: SegmentCtxMenuState | null;
  setSegmentCtxMenu: (v: SegmentCtxMenuState | null) => void;
  segmentCtxMenuItems: SegmentContextMenuItem[];
  onSegmentCtxMenuSelect: (key: SegmentContextMenuKey) => void;
}

export function EditorView({
  controller: c,
  tx,
  exportKey,
  onExportSelect,
  segmentCtxMenu,
  setSegmentCtxMenu,
  segmentCtxMenuItems,
  onSegmentCtxMenuSelect,
}: EditorViewProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Navigation bar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-zen-gray-300 px-4">
        <button
          type="button"
          className="text-[12px] text-zen-stone transition-colors hover:text-zen-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={c.busy}
          onClick={() => c.closeProject()}
        >
          ← 返回 Dashboard
        </button>
        <span className="text-sm text-zen-stone">
          <span className="font-medium text-zen-ink">{c.current?.name}</span>
          {c.currentFileId ? (
            <>
              <span className="mx-1.5 text-zen-gray-300">/</span>
              <span>{c.current?.files.find((f) => f.id === c.currentFileId)?.name ?? "未命名文件"}</span>
            </>
          ) : null}
        </span>
        <span className="w-20" />
      </div>

      {c.currentFileId ? (
        <>
          <EditorToolbar controller={c} tx={tx} exportKey={exportKey} onExportSelect={onExportSelect} />

      {c.transcribeHints.length > 0 ? (
        <ul className="shrink-0 space-y-1 border-b border-zen-gray-300 bg-zen-ochre/80 px-4 py-2 text-[12px] leading-relaxed text-zen-indigo">
          {c.transcribeHints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}

      {c.audioSrc ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-serene-surface-container-low px-2 pb-2 pt-2 sm:px-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-zen-stone">
            <span>时间轴工作区</span>
            <span className="text-right">波形、时间尺与语段轨同一比例对齐</span>
          </div>
          <div
            ref={tx.tierScrollRef}
            onScroll={tx.onTierScroll}
            className="min-h-0 flex-1 overflow-auto rounded-[1.25rem] border border-zen-gray-300 bg-app-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] [overflow-anchor:none]"
          >
            <div
              style={{ width: tx.timelineWidthPx }}
              className={`inline-block align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
            >
              <div
                className="sticky top-0 z-30 overflow-hidden rounded-t-[1.25rem] border-b border-black/10 bg-zen-ink"
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
                  <p className="border-b border-white/10 bg-zen-cinnabar/20 px-3 py-2 text-center text-[12px] text-zen-paper">
                    {tx.loadError}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 bg-zen-ink px-3 py-2 text-zen-paper">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 bg-white/10 p-2 text-zen-paper transition-colors hover:border-white/30 hover:bg-white/15 disabled:opacity-40"
                    disabled={c.busy || !tx.isReady}
                    onClick={() => void tx.togglePlay()}
                    aria-label={tx.isPlaying ? "暂停" : "播放"}
                  >
                    {tx.isPlaying ? (
                      <span className="flex h-3 w-3 items-center justify-center gap-0.5" aria-hidden>
                        <span className="h-2.5 w-0.5 bg-zen-paper" />
                        <span className="h-2.5 w-0.5 bg-zen-paper" />
                      </span>
                    ) : (
                      <span
                        className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-zen-paper"
                        aria-hidden
                      />
                    )}
                  </button>
                  <span className="font-mono text-[11px] tabular-nums tracking-tight text-zen-paper">
                    {tx.formatMediaTime(tx.currentTime)} / {tx.formatMediaTime(tx.duration || 0)}
                  </span>
                  <span className="text-[10px] text-white/55" title="拖动波形区下边缘调节高度">
                    波形
                  </span>
                  <span className="min-w-[2.25rem] text-center font-mono text-[10px] text-white/70">
                    {tx.waveformHeightPx}px
                  </span>
                  <span className="text-[10px] text-white/55" title="拖动语段轨下边缘调节字号">
                    语段
                  </span>
                  <span className="min-w-[1.75rem] text-center font-mono text-[10px] text-white/70">
                    {tx.transcriptFontPx}px
                  </span>
                  <span className="ml-auto text-[10px] text-white/55">波形与下方色块同一水平标尺</span>
                </div>
                <div className="relative overflow-x-hidden bg-zen-ink">
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
                      className="w-full shrink-0 bg-zen-ink"
                      role="img"
                      aria-label="转写波形与语段时间范围"
                    />
                  </div>
                  <ResizeBottomHit
                    busy={c.busy}
                    ariaLabel="拖动下边缘调节波形高度"
                    onPointerDown={tx.beginWaveformHeightDrag}
                  />
                </div>
                <div
                  className="sticky left-0 z-[25] shrink-0 bg-zen-ink"
                  style={{ width: Math.max(1, tx.tierScrollLayout.clientWidth) }}
                >
                  <WaveformTimeRuler
                    appearance="ink"
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
                  className="relative mt-0 shrink-0 overflow-x-hidden border-b border-zen-gray-300 bg-serene-surface-container-low"
                  style={{ width: tx.timelineWidthPx }}
                >
                  <div className="relative z-0 px-3 py-4 text-center text-xs leading-relaxed text-zen-stone">
                    尚未有语段：请先「从 ASR 拉取语段」。
                  </div>
                  <ResizeBottomHit
                    busy={c.busy}
                    ariaLabel="拖动下边缘调节语段字号"
                    onPointerDown={tx.beginTranscriptFontDrag}
                  />
                </div>
              ) : (
                <div
                  className="relative mt-0 shrink-0 overflow-x-hidden border-b border-zen-gray-300 bg-serene-surface-container-low"
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
                      const row = (e.target as HTMLElement).closest("[data-seg-row]");
                      if (!row) return;
                      const i = Number(row.getAttribute("data-seg-row"));
                      if (!Number.isInteger(i) || i < 0 || i >= c.segments.length) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const seg = c.segments[i];
                      if (!seg) return;
                      const pointerTimeSec = pointerTimeFromSegmentCard(e.clientX, row.getBoundingClientRect(), seg);
                      setSegmentCtxMenu({ x: e.clientX, y: e.clientY, segmentIdx: i, pointerTimeSec });
                    }}
                  >
                    {c.segments.map((s, i) => (
                      <SegmentTimelineCard
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
                  <ResizeBottomHit
                    busy={c.busy}
                    ariaLabel="拖动下边缘调节语段字号"
                    onPointerDown={tx.beginTranscriptFontDrag}
                  />
                </div>
              )}
            </div>
          </div>
          <WaveformZoomBar
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
            <span>双击波形语段仅播该段。</span>
            <span>修改后请保存到 SQLite。</span>
          </footer>
        </>
      ) : (
        <EmptyProjectPanel controller={c} />
      )}
      {segmentCtxMenu ? (
        <SegmentContextMenu
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
