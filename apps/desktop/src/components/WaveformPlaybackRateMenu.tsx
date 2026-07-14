import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  IconChevronDown as ChevronDown,
} from "@tabler/icons-react";
import { CspLayout } from "./CspLayout";
import { LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import {
  formatWaveformPlaybackRateLabel,
  formatWaveformPlaybackRatePresetMenuLabel,
  snapWaveformPlaybackRate,
  WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS,
  WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS,
  type WaveformPlaybackRatePreset,
} from "../utils/waveformPlaybackRate";

export type WaveformPlaybackRateMenuProps = {
  disabled: boolean;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
  /** `global` 底部工具栏；`segment` 语段浮层（下拉 portal 到 body，避免波形区 overflow 裁切）。 */
  variant?: "global" | "segment";
  /** 语段菜单：tier 横向滚动时同步锚点位置。 */
  tierScrollRef?: RefObject<HTMLElement | null>;
};

function RateOption({
  rate,
  active,
  onPick,
}: {
  rate: WaveformPlaybackRatePreset;
  active: boolean;
  onPick: (rate: WaveformPlaybackRatePreset) => void;
}) {
  return (
    <li role="presentation">
      <button
        type="button"
        role="option"
        aria-selected={active}
        className={`waveform-playback-rate-option${active ? " waveform-playback-rate-option-active" : ""}`}
        onClick={() => onPick(rate)}
      >
        {formatWaveformPlaybackRatePresetMenuLabel(rate)}×
      </button>
    </li>
  );
}

function PlaybackRatePopovers({
  listboxId,
  activeRate,
  onPick,
  portal,
  anchorRect,
}: {
  listboxId: string;
  activeRate: WaveformPlaybackRatePreset;
  onPick: (rate: WaveformPlaybackRatePreset) => void;
  portal: boolean;
  anchorRect?: DOMRect | null;
}) {
  const popoverClass = portal
    ? "waveform-playback-rate-popover waveform-playback-rate-popover-portal"
    : "waveform-playback-rate-popover";

  const aboveLayout =
    portal && anchorRect
      ? {
          left: anchorRect.left,
          width: anchorRect.width,
          bottom: window.innerHeight - anchorRect.top + 1,
        }
      : null;

  const belowLayout =
    portal && anchorRect
      ? {
          left: anchorRect.left,
          width: anchorRect.width,
          top: anchorRect.bottom - 1,
        }
      : null;

  return (
    <>
      {aboveLayout ? (
        <CspLayout
          as="ul"
          id={listboxId}
          role="listbox"
          aria-label="播放速度（更快）"
          className={`${popoverClass} waveform-playback-rate-popover-above`}
          layout={aboveLayout}
        >
          {WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS.map((rate) => (
            <RateOption key={rate} rate={rate} active={rate === activeRate} onPick={onPick} />
          ))}
        </CspLayout>
      ) : (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="播放速度（更快）"
          className={`${popoverClass} waveform-playback-rate-popover-above`}
        >
          {WAVEFORM_PLAYBACK_RATE_FASTER_PRESETS.map((rate) => (
            <RateOption key={rate} rate={rate} active={rate === activeRate} onPick={onPick} />
          ))}
        </ul>
      )}
      {belowLayout ? (
        <CspLayout
          as="ul"
          role="listbox"
          aria-label="播放速度（更慢）"
          className={`${popoverClass} waveform-playback-rate-popover-below`}
          layout={belowLayout}
        >
          {[...WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS].reverse().map((rate) => (
            <RateOption key={rate} rate={rate} active={rate === activeRate} onPick={onPick} />
          ))}
        </CspLayout>
      ) : (
        <ul
          role="listbox"
          aria-label="播放速度（更慢）"
          className={`${popoverClass} waveform-playback-rate-popover-below`}
        >
          {[...WAVEFORM_PLAYBACK_RATE_SLOWER_PRESETS].reverse().map((rate) => (
            <RateOption key={rate} rate={rate} active={rate === activeRate} onPick={onPick} />
          ))}
        </ul>
      )}
    </>
  );
}

/** 播放速度：1.0 锚定按钮，更快向上、更慢向下展开。 */
export const WaveformPlaybackRateMenu = memo(function WaveformPlaybackRateMenu({
  disabled,
  playbackRate,
  onPlaybackRateChange,
  variant = "global",
  tierScrollRef,
}: WaveformPlaybackRateMenuProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const activeRate = snapWaveformPlaybackRate(playbackRate);
  const label = formatWaveformPlaybackRateLabel(activeRate);
  const rateStateActive = activeRate !== 1;
  const menuEngaged = open && !rateStateActive;
  const usePortal = true;

  const close = useCallback(() => setOpen(false), []);

  const pick = useCallback(
    (rate: WaveformPlaybackRatePreset) => {
      onPlaybackRateChange(rate);
      close();
    },
    [close, onPlaybackRateChange],
  );

  const syncAnchorRect = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setAnchorRect(rect ?? null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    syncAnchorRect();
  }, [open, playbackRate, syncAnchorRect]);

  useEffect(() => {
    if (!open) return;
    const tier = tierScrollRef?.current;
    const onReposition = () => syncAnchorRect();
    tier?.addEventListener("scroll", onReposition, { passive: true });
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, { passive: true, capture: true });
    return () => {
      tier?.removeEventListener("scroll", onReposition);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, { capture: true });
    };
  }, [open, syncAnchorRect, tierScrollRef]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  const rootClass =
    variant === "segment"
      ? "waveform-playback-rate-menu waveform-playback-rate-menu-segment"
      : "waveform-playback-rate-menu waveform-playback-rate-menu-global";

  const popovers =
    open && anchorRect ? (
      <PlaybackRatePopovers
        listboxId={listboxId}
        activeRate={activeRate}
        onPick={pick}
        portal={usePortal}
        anchorRect={anchorRect}
      />
    ) : null;

  const portalNode =
    usePortal && popovers && typeof document !== "undefined"
      ? createPortal(
          <div ref={portalRef} className="waveform-playback-rate-portal-host">
            {popovers}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`${rootClass}${open ? " waveform-playback-rate-menu-open" : ""}`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          ref={triggerRef}
          type="button"
          className={`waveform-playback-rate-trigger${
            rateStateActive ? " waveform-playback-rate-trigger-state-active" : ""
          }${menuEngaged ? " workbench-action-btn-engaged" : ""}`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          title={`播放速度 ${label}`}
          onClick={() => {
            if (disabled) return;
            if (open) {
              if (activeRate === 1) close();
              else pick(1);
              return;
            }
            setOpen(true);
          }}
        >
          <span className="waveform-playback-rate-trigger-label">{open ? "1.0×" : label}</span>
          <ChevronDown
            className={`waveform-playback-rate-chevron${open ? " waveform-playback-rate-chevron-open" : ""}`}
            size={14}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
        </button>
      </div>
      {portalNode}
    </>
  );
});
