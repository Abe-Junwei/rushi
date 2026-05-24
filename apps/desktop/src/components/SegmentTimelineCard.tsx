import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { formatMediaTime } from "../utils/formatMediaTime";
import { segmentCardChrome } from "../utils/segmentChrome";

export type SegmentTimelineCardProps = {
  segment: SegmentDto;
  index: number;
  selected: boolean;
  busy: boolean;
  timelineWidthPx: number;
  pxPerSec: number;
  lane: number;
  rowH: number;
  transcriptFontPx: number;
  selectSegmentAt: (idx: number) => void;
  updateSegmentText: (idx: number, text: string) => void;
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void;
};

const vPad = 6;

export const SegmentTimelineCard = memo(function SegmentTimelineCard({
  segment: s,
  index: i,
  selected: sel,
  busy,
  timelineWidthPx: tw,
  pxPerSec: px,
  lane,
  rowH,
  transcriptFontPx,
  selectSegmentAt,
  updateSegmentText,
  onTextareaKeyDown,
}: SegmentTimelineCardProps) {
  /** 本地草稿：避免每键 `setSegments` 触发整页（含波形）重绘导致的闪动；props 在撤销/合并等时同步。 */
  const [draft, setDraft] = useState(() => (s.text ?? "").replace(/\r\n|\r|\n/g, ""));

  useEffect(() => {
    setDraft((s.text ?? "").replace(/\r\n|\r|\n/g, ""));
  }, [s.text]);

  const { slabBg, slabBorder, railFill, railAccent, outerShadow } = useMemo(() => segmentCardChrome(s, sel), [s, sel]);

  const { style, title, barWidthPx } = useMemo(() => {
    const twSafe = Math.max(0, Math.floor(Number.isFinite(tw) ? tw : 0));
    const rawLeft = s.start_sec * px;
    const rawW = Math.max((s.end_sec - s.start_sec) * px, 8);
    const left = Math.max(0, Math.min(Math.floor(rawLeft + 1e-9), Math.max(0, twSafe - 1)));
    const maxW = Math.max(0, twSafe - left);
    const width = Math.floor(Math.min(rawW, maxW));
    const st: CSSProperties = {
      left,
      width,
      maxWidth: maxW,
      boxSizing: "border-box",
      top: lane * rowH + vPad,
      height: rowH - vPad * 2,
      zIndex: sel ? 30 : 10 + lane,
    };
    const lowNote = s.low_confidence ? " · 低置信" : "";
    const confNote =
      s.confidence != null && Number.isFinite(s.confidence) ? ` · 置信 ${s.confidence.toFixed(2)}` : "";
    const ttl = `${formatMediaTime(s.start_sec)} → ${formatMediaTime(s.end_sec)}${s.detail ? ` · ${s.detail}` : ""}${lowNote}${confNote}`;
    const barWidthPx = Math.max(8, width - 8);
    return { style: st, title: ttl, barWidthPx };
  }, [s.start_sec, s.end_sec, s.detail, s.low_confidence, s.confidence, px, tw, lane, rowH, sel]);

  const onTextAreaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value.replace(/\r\n|\r|\n/g, " "));
  }, []);

  const onBlurText = useCallback(() => {
    const normSeg = (s.text ?? "").replace(/\r\n|\r|\n/g, "");
    if (draft !== normSeg) updateSegmentText(i, draft);
  }, [draft, i, s.text, updateSegmentText]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      onTextareaKeyDown(i, e);
    },
    [i, onTextareaKeyDown],
  );

  const onClickCard = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (!busy) selectSegmentAt(i);
    },
    [busy, i, selectSegmentAt],
  );

  const lineStyle = useMemo(
    () =>
      ({
        fontSize: transcriptFontPx,
        lineHeight: 1.55,
      }) as const,
    [transcriptFontPx],
  );

  const confidenceLabel = useMemo(() => {
    if (s.low_confidence) return "低置信";
    if (s.confidence != null && Number.isFinite(s.confidence)) return `置信 ${s.confidence.toFixed(2)}`;
    return "待确认";
  }, [s.confidence, s.low_confidence]);

  return (
    <div
      data-seg-row={i}
      className={[
        "absolute z-10 min-h-0 min-w-0 max-w-full overflow-hidden rounded-2xl px-1 py-1 select-text transition-colors hover:brightness-[1.01]",
        outerShadow,
      ].join(" ")}
      style={style}
      title={title}
      onClick={onClickCard}
    >
      <div className="relative h-full w-full">
        <div className={`absolute inset-y-1 left-1 rounded-2xl ${railFill}`} style={{ width: barWidthPx }} />
        <div
          className={[
            "relative z-10 flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-2xl px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.65)]",
            slabBg,
            slabBorder,
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-white/78 px-2 font-mono text-[10px] text-zen-indigo">
              #{i + 1}
            </span>
            <span
              className={[
                "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium",
                s.low_confidence ? "bg-amber-100 text-amber-900" : sel ? "bg-zen-saffron/12 text-zen-saffron-mid" : "bg-white/72 text-zen-stone",
              ].join(" ")}
            >
              {confidenceLabel}
            </span>
            <span className="ml-auto truncate font-mono text-[10px] text-zen-stone">
              {formatMediaTime(s.start_sec)} - {formatMediaTime(s.end_sec)}
            </span>
          </div>

          <textarea
            className="seg-text min-h-[2.8rem] w-full resize-none rounded-xl border border-black/5 bg-white/52 px-2 py-1.5 font-serif text-zen-ink shadow-none outline-none ring-0 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-zen-ink/25 disabled:opacity-40"
            style={lineStyle}
            value={draft}
            disabled={busy}
            rows={2}
            onFocus={() => !busy && selectSegmentAt(i)}
            onChange={onTextAreaChange}
            onBlur={onBlurText}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="语段正文"
          />

          {s.detail ? <p className="max-h-[2.5rem] overflow-hidden text-[10px] leading-relaxed text-zen-stone">{s.detail}</p> : null}

          <div className="mt-auto h-1.5 w-full rounded-full bg-black/5">
            <div className={`h-full rounded-full ${railAccent}`} style={{ width: `${Math.max(12, Math.min(100, (barWidthPx / Math.max(style.width ? Number(style.width) : barWidthPx, 1)) * 100))}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
});
