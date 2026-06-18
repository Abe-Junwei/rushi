import type { PointerEvent as ReactPointerEvent } from "react";
import { CspLayout } from "../CspLayout";
import { formatTranscriptTimestamp } from "./segmentRowFormatting";

interface SegmentRowTimestampColumnProps {
  index: number;
  startSec: number;
  metaWidth: number;
  selected: boolean;
  inSelection?: boolean;
  busy: boolean;
  onMetaWidthPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onTimestampPointerDown?: (index: number, e: ReactPointerEvent<HTMLElement>) => void;
}

export function SegmentRowTimestampColumn({
  index,
  startSec,
  metaWidth,
  selected,
  inSelection = false,
  busy,
  onMetaWidthPointerDown,
  onTimestampPointerDown,
}: SegmentRowTimestampColumnProps) {
  const timestampLabel = formatTranscriptTimestamp(startSec);
  const highlight = selected || inSelection;

  return (
    <>
      <CspLayout
        layout={{ width: metaWidth }}
        className={[
          "shrink-0 touch-none select-none pt-2 pr-3 text-right",
          busy ? "cursor-not-allowed" : "cursor-cell",
        ].join(" ")}
        onPointerDown={(e) => onTimestampPointerDown?.(index, e)}
      >
        <div className="flex flex-col gap-1">
          <span
            className={[
              "font-mono text-label font-medium tabular-nums tracking-[0.01em]",
              highlight ? "text-notion-text-muted" : "text-notion-text-light group-hover:text-accent-action-strong",
            ].join(" ")}
          >
            {index + 1}.
          </span>
          <span
            className={[
              "font-mono text-label font-medium tabular-nums tracking-[0.01em]",
              highlight ? "text-notion-text-muted" : "text-notion-text-light group-hover:text-accent-action-strong",
            ].join(" ")}
          >
            {timestampLabel}
          </span>
        </div>
      </CspLayout>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="拖拽调整语段信息列宽度"
        className={[
          "group/resize relative my-1.5 w-2.5 shrink-0 rounded-full",
          busy
            ? "cursor-not-allowed"
            : selected
              ? "cursor-col-resize hover:bg-accent-action/12"
              : "cursor-col-resize hover:bg-notion-sidebar-hover/70",
        ].join(" ")}
        onPointerDown={onMetaWidthPointerDown}
      >
        <span
          className={[
            "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors",
            selected ? "group-hover/resize:bg-accent-action/30" : "group-hover/resize:bg-notion-divider",
          ].join(" ")}
        />
      </div>
    </>
  );
}
