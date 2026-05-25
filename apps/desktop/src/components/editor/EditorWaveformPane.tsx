import { ResizeBottomHit } from "../ResizeBottomHit";
import { WaveformTimeRuler } from "../WaveformTimeRuler";
import { WaveformZoomBar } from "../WaveformZoomBar";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";

interface SegmentCtxMenuState {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
}

interface EditorWaveformPaneProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  rulerViewportWidthPx: number;
  rulerScrollLeftPx: number;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
}

export function EditorWaveformPane({
  controller: c,
  tx,
  rulerViewportWidthPx,
  rulerScrollLeftPx,
  onOpenSegmentContextMenu,
}: EditorWaveformPaneProps) {
  return (
    <div className="relative z-0 flex w-full shrink-0 flex-col overflow-hidden bg-notion-sidebar">
      <div
        ref={tx.tierScrollRef}
        onScroll={tx.onTierScroll}
        className="h-[180px] w-full shrink-0 overflow-x-auto overflow-y-hidden [overflow-anchor:none]"
      >
        <div
          style={{ width: tx.timelineWidthPx }}
          className={`inline-block align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <div
            className="relative h-[180px] overflow-hidden bg-notion-sidebar"
            onContextMenu={(e) => {
              if (c.busy) return;
              e.preventDefault();
              const t = tx.clientXToTimeSec(e.clientX);
              const hit = c.segments.findIndex((s) => t >= s.start_sec && t <= s.end_sec);
              const segmentIdx =
                hit >= 0 ? hit : c.segments.length > 0 ? Math.min(c.selectedIdx, c.segments.length - 1) : 0;
              onOpenSegmentContextMenu({ x: e.clientX, y: e.clientY, segmentIdx, pointerTimeSec: t });
            }}
          >
            {tx.loadError ? (
              <p className="absolute inset-x-4 top-4 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-[12px] text-zen-cinnabar">
                {tx.loadError}
              </p>
            ) : null}

            <div className="absolute left-4 top-4 z-20 flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-notion-bg text-notion-text-muted shadow-sm transition-colors hover:text-notion-text disabled:opacity-40"
                  disabled={c.busy || !tx.isReady}
                  onClick={() => void tx.togglePlay()}
                  aria-label={tx.isPlaying ? "暂停" : "播放"}
                >
                  {tx.isPlaying ? (
                    <span className="flex h-3 w-3 items-center justify-center gap-0.5" aria-hidden>
                      <span className="h-2.5 w-0.5 bg-notion-text" />
                      <span className="h-2.5 w-0.5 bg-notion-text" />
                    </span>
                  ) : (
                    <span
                      className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-notion-text"
                      aria-hidden
                    />
                  )}
                </button>
                <span className="rounded bg-notion-bg px-2 py-1 font-mono text-[12px] tabular-nums tracking-tight text-notion-text shadow-sm">
                  {tx.formatMediaTime(tx.currentTime)} / {tx.formatMediaTime(tx.duration || 0)}
                </span>
                <span className="inline-flex h-5 items-center rounded-full bg-notion-bg px-2 text-[10px] text-notion-text-muted shadow-sm">
                  {tx.isReady ? "波形就绪" : "正在加载波形"}
                </span>
            </div>

            <div className="relative flex h-full flex-col overflow-x-hidden bg-notion-sidebar pt-7">
              <div
                ref={tx.waveformShellRef}
                tabIndex={0}
                className="relative z-0 flex-1 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40"
                onKeyDown={tx.onWaveformMainKeyDown}
                onClick={() => tx.focusWaveformShell()}
              >
                <div
                  ref={tx.containerRef}
                  style={{ height: tx.waveformHeightPx }}
                  className="w-full shrink-0 bg-transparent"
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

            <div className="absolute inset-x-0 bottom-0 shrink-0 border-t border-notion-divider/70 bg-notion-sidebar/95">
              <WaveformTimeRuler
                appearance="light"
                durationSec={tx.duration || 0}
                timelineWidthPx={tx.timelineWidthPx}
                scrollLeftPx={rulerScrollLeftPx}
                viewportWidthPx={rulerViewportWidthPx}
                pxPerSec={tx.pxPerSec}
                rulerView={tx.rulerView}
                currentTimeSec={tx.currentTime}
                formatMediaTime={tx.formatMediaTime}
                disabled={c.busy || !tx.isReady}
                onSeekFromTierClientX={tx.seekFromTierClientX}
                onSetScrollLeftPx={tx.setTierScrollPx}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[48px] w-full shrink-0 items-center bg-notion-sidebar/80 px-6">
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
    </div>
  );
}
