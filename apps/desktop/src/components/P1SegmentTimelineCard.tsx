import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type { SegmentDto } from "../tauri/p1Api";
import { formatMediaTime } from "../utils/formatMediaTime";
import { p1SegmentCardChrome } from "../utils/p1SegmentChrome";

export type P1SegmentTimelineCardProps = {
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
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLInputElement>) => void;
};

const vPad = 6;

export const P1SegmentTimelineCard = memo(function P1SegmentTimelineCard({
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
}: P1SegmentTimelineCardProps) {
  /** 本地草稿：避免每键 `setSegments` 触发整页（含波形）重绘导致的闪动；props 在撤销/合并等时同步。 */
  const [draft, setDraft] = useState(() => (s.text ?? "").replace(/\r\n|\r|\n/g, ""));
  useEffect(() => {
    setDraft((s.text ?? "").replace(/\r\n|\r|\n/g, ""));
  }, [s.text]);

  const { cardBg, cardRing } = useMemo(() => p1SegmentCardChrome(s, sel), [s, sel]);

  const { style, title, cardInnerWidthPx } = useMemo(() => {
    const twSafe = Math.max(0, Math.floor(Number.isFinite(tw) ? tw : 0));
    const rawLeft = s.start_sec * px;
    const rawW = Math.max((s.end_sec - s.start_sec) * px, 8);
    const left = Math.max(0, Math.min(Math.floor(rawLeft + 1e-9), Math.max(0, twSafe - 1)));
    const maxW = Math.max(0, twSafe - left);
    const minBar = Math.min(72, maxW);
    const width = Math.floor(Math.min(Math.max(rawW, minBar), maxW));
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
    const cardInnerWidthPx = Math.max(1, width - 16);
    return { style: st, title: ttl, cardInnerWidthPx };
  }, [s.start_sec, s.end_sec, s.detail, s.low_confidence, s.confidence, px, tw, lane, rowH, sel]);

  const shellRef = useRef<HTMLDivElement>(null);
  const measRef = useRef<HTMLSpanElement>(null);
  const [textScale, setTextScale] = useState(1);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const meas = measRef.current;
    if (!shell || !meas) return;
    const avail = shell.clientWidth;
    const textW = meas.scrollWidth;
    const next =
      avail > 0 && textW > avail ? Math.max(0.18, Math.min(1, avail / textW)) : 1;
    setTextScale((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
  }, [draft, transcriptFontPx, cardInnerWidthPx]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value.replace(/\r\n|\r|\n/g, ""));
  }, []);

  const onBlurText = useCallback(() => {
    const normSeg = (s.text ?? "").replace(/\r\n|\r|\n/g, "");
    if (draft !== normSeg) updateSegmentText(i, draft);
  }, [draft, i, s.text, updateSegmentText]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        return;
      }
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
        lineHeight: 1.45,
      }) as const,
    [transcriptFontPx],
  );

  return (
    <div
      data-p1-seg-row={i}
      className={[
        "absolute z-10 flex min-h-0 min-w-0 max-w-full items-center overflow-hidden rounded-md px-2 py-2 shadow-sm ring-1 ring-inset select-text hover:brightness-[1.01]",
        cardBg,
        cardRing,
      ].join(" ")}
      style={style}
      title={title}
      onClick={onClickCard}
    >
      <div ref={shellRef} className="relative flex min-h-0 w-full min-w-0 max-w-full flex-1 items-center overflow-hidden">
        <span
          ref={measRef}
          className="pointer-events-none fixed top-0 left-[-9999px] whitespace-nowrap font-serif text-zen-ink"
          style={lineStyle}
          aria-hidden
        >
          {draft || "\u00a0"}
        </span>
        <input
          type="text"
          className="p1-seg-text max-w-full min-h-0 min-w-0 rounded border-0 bg-transparent px-0 font-serif text-zen-ink outline-none ring-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-zen-saffron/30 disabled:opacity-40"
          style={{
            ...lineStyle,
            width: textScale < 1 ? `${100 / textScale}%` : "100%",
            transform: textScale < 1 ? `scale(${textScale})` : undefined,
            transformOrigin: "left center",
          }}
          value={draft}
          disabled={busy}
          onChange={onChange}
          onBlur={onBlurText}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="语段正文"
        />
      </div>
    </div>
  );
});
