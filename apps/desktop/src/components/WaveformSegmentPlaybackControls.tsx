import { memo, useLayoutEffect, useRef, type RefObject } from "react";
import { Repeat, Square } from "lucide-react";
import { PRODUCT_ICON } from "../config/productIcons";
import type { SegmentDto } from "../tauri/projectApi";
import { resolveSegmentPlaybackControlsOverlayLayout } from "../utils/waveformRegionActionOverlay";
import type { TierScrollLayoutMetrics, TierScrollLiveRefs } from "../utils/waveformViewport";
import { subscribeTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { subscribeSelectionChrome, getSelectionChromeSnapshot } from "../services/selection/selectionChromeStore";
import { clearCspLayoutRules, setCspLayoutRules } from "../utils/cspElementLayout";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type WaveformSegmentPlaybackControlsProps = {
  disabled: boolean;
  fileId: string | null;
  segments: SegmentDto[];
  /** 底部嵌入时间尺占用高度，控件在其上方居中 */
  rulerBandHeightPx?: number;
  isPlaying: boolean;
  timelineWidthPx: number;
  durationSec: number;
  tierScrollRef: RefObject<HTMLElement | null>;
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
  selectedSegment: SegmentDto | null;
  segmentLoopPlayback: boolean;
  onToggleLoop: () => void;
  onTogglePlay: () => void;
};

/**
 * 选中语段的播放/循环浮层。定位（left/width/可见性）随 tier 横向滚动变化，
 * 走 imperative tierScrollFrame + CSP-safe layout 写入，滚动期间不触发 React 重渲染。
 */
export const WaveformSegmentPlaybackControls = memo(function WaveformSegmentPlaybackControls({
  disabled,
  fileId,
  segments,
  rulerBandHeightPx = 0,
  isPlaying,
  timelineWidthPx,
  durationSec,
  tierScrollRef,
  tierScrollLive,
  tierScrollLayout,
  selectedSegment,
  segmentLoopPlayback,
  onToggleLoop,
  onTogglePlay,
}: WaveformSegmentPlaybackControlsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loopBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastOverlayLayoutRef = useRef<{
    left: number;
    width: number;
    display: string | null;
    loopDisplay: string | null;
  } | null>(null);

  const layoutArgsRef = useRef({
    fileId,
    segments,
    selectedSegment,
    timelineWidthPx,
    durationSec,
    rulerBandHeightPx,
    tierScrollRef,
    tierScrollLive,
    tierScrollLayout,
  });
  layoutArgsRef.current = {
    fileId,
    segments,
    selectedSegment,
    timelineWidthPx,
    durationSec,
    rulerBandHeightPx,
    tierScrollRef,
    tierScrollLive,
    tierScrollLayout,
  };

  const resolveLayoutSegment = (): SegmentDto | null => {
    const a = layoutArgsRef.current;
    const snap = getSelectionChromeSnapshot();
    if (a.fileId != null && snap.fileId === a.fileId && snap.primaryIdx >= 0) {
      return a.segments[snap.primaryIdx] ?? null;
    }
    return a.selectedSegment;
  };

  const segStartSec = selectedSegment
    ? Math.min(selectedSegment.start_sec, selectedSegment.end_sec)
    : 0;
  const segEndSec = selectedSegment
    ? Math.max(selectedSegment.start_sec, selectedSegment.end_sec)
    : 0;

  /* eslint-disable react-hooks/exhaustive-deps -- layoutArgsRef holds latest props; deps列出影响布局的标量，scroll 期由 tierScrollFrame 驱动 */
  useLayoutEffect(() => {
    const applyOverlayLayout = () => {
      const a = layoutArgsRef.current;
      const container = containerRef.current;
      if (!container) return;
      const seg = resolveLayoutSegment();
      if (!seg) {
        setCspLayoutRules(container, { display: "none" });
        return;
      }
      const tier = a.tierScrollRef.current;
      const liveScroll = a.tierScrollLive.scrollLeftRef.current;
      const scrollLeftPx = Number.isFinite(liveScroll) ? liveScroll : tier?.scrollLeft ?? 0;
      const liveWidth = a.tierScrollLive.clientWidthRef.current;
      const viewportWidthPx =
        liveWidth && liveWidth > 0
          ? liveWidth
          : tier?.clientWidth ?? a.tierScrollLayout.clientWidthPx;

      const layout = resolveSegmentPlaybackControlsOverlayLayout({
        segmentStartSec: Math.min(seg.start_sec, seg.end_sec),
        segmentEndSec: Math.max(seg.start_sec, seg.end_sec),
        timelineWidthPx: a.timelineWidthPx,
        durationSec: a.durationSec,
        scrollLeftPx,
        viewportWidthPx,
        coordinateSpace: "timeline",
      });

      if (!layout.visible) {
        const nextDisplay = "none";
        const prev = lastOverlayLayoutRef.current;
        if (prev?.display === nextDisplay) return;
        lastOverlayLayoutRef.current = { left: 0, width: 0, display: nextDisplay, loopDisplay: null };
        setCspLayoutRules(container, { display: nextDisplay });
        return;
      }
      const roundedLeft = Math.round(layout.overlayLeftPx * 1000) / 1000;
      const roundedWidth = Math.round(layout.overlayWidthPx * 1000) / 1000;
      const loopDisplay = layout.showLoopBtn ? null : "none";
      const prev = lastOverlayLayoutRef.current;
      if (
        prev &&
        prev.display === null &&
        prev.left === roundedLeft &&
        prev.width === roundedWidth &&
        prev.loopDisplay === loopDisplay
      ) {
        return;
      }
      lastOverlayLayoutRef.current = {
        left: roundedLeft,
        width: roundedWidth,
        display: null,
        loopDisplay,
      };
      // bottom 不随滚动变，单独在 effect 体写入一次；这里每帧只更新随滚动变化的 left/width/display。
      setCspLayoutRules(container, {
        display: null,
        left: layout.overlayLeftPx,
        width: layout.overlayWidthPx,
      });
      const loopBtn = loopBtnRef.current;
      if (loopBtn) {
        setCspLayoutRules(loopBtn, { display: loopDisplay });
      }
    };

    const container = containerRef.current;
    if (container) setCspLayoutRules(container, { bottom: rulerBandHeightPx + 4 });
    lastOverlayLayoutRef.current = null;
    applyOverlayLayout();
    const unsubScroll = subscribeTierScrollFrame(applyOverlayLayout);
    const unsubChrome = subscribeSelectionChrome(applyOverlayLayout);
    return () => {
      unsubScroll();
      unsubChrome();
      const container = containerRef.current;
      if (container) clearCspLayoutRules(container);
      const loopBtn = loopBtnRef.current;
      if (loopBtn) clearCspLayoutRules(loopBtn);
    };
    // tierScrollLayout.clientWidthPx 仅随视口 resize 变化（滚动 burst commit 不改），
    // 入 deps 以在窗口缩放后重算可见性/居中——补回移除 useTierViewportMetricsFrame 的 resize 监听。
  }, [
    fileId,
    segStartSec,
    segEndSec,
    timelineWidthPx,
    durationSec,
    rulerBandHeightPx,
    selectedSegment,
    segments,
    tierScrollLayout.clientWidthPx,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div ref={containerRef} className="region-action-overlay">
      <button
        ref={loopBtnRef}
        type="button"
        className={`region-action-btn${segmentLoopPlayback ? " region-action-btn-active workbench-state-btn-active" : ""}`}
        disabled={disabled}
        aria-pressed={segmentLoopPlayback}
        aria-label={segmentLoopPlayback ? "关闭语段循环播放" : "开启语段循环播放"}
        title={segmentLoopPlayback ? "关闭语段循环播放" : "开启语段循环播放"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLoop();
        }}
      >
        <Repeat className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <button
        type="button"
        className="region-action-btn"
        disabled={disabled}
        aria-label={isPlaying ? "停止语段播放" : "播放选中语段"}
        title={isPlaying ? "停止语段播放" : "播放选中语段"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
      >
        {isPlaying ? (
          <Square className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        ) : (
          <PRODUCT_ICON.playAudio className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        )}
      </button>
    </div>
  );
});
