import { formatTranscriptTimestamp } from "./segmentRowFormatting";

interface SegmentRowTimestampColumnProps {
  index: number;
  startSec: number;
  metaWidth: number;
  selected: boolean;
  busy: boolean;
  onMetaWidthPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export function SegmentRowTimestampColumn({
  index,
  startSec,
  metaWidth,
  selected,
  busy,
  onMetaWidthPointerDown,
}: SegmentRowTimestampColumnProps) {
  const timestampLabel = formatTranscriptTimestamp(startSec);

  return (
    <>
      <div style={{ width: metaWidth }} className="shrink-0 pt-2 pr-3 text-right">
        <div className="flex flex-col gap-1">
          <span
            className={[
              "font-mono text-[10px] font-medium tabular-nums tracking-[0.01em]",
              selected ? "text-notion-text-muted" : "text-notion-text-light group-hover:text-notion-text-muted",
            ].join(" ")}
          >
            {index + 1}.
          </span>
          <span
            className={[
              "font-mono text-[10px] font-medium tabular-nums tracking-[0.01em]",
              selected ? "text-notion-text-muted" : "text-notion-text-light group-hover:text-notion-text-muted",
            ].join(" ")}
          >
            {timestampLabel}
          </span>
        </div>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整语段信息列宽度"
        className={[
          "group/resize relative my-1.5 w-2.5 shrink-0 rounded-full",
          busy ? "cursor-not-allowed" : "cursor-col-resize hover:bg-notion-sidebar-hover/70",
        ].join(" ")}
        onPointerDown={onMetaWidthPointerDown}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover/resize:bg-notion-divider" />
      </div>
    </>
  );
}
