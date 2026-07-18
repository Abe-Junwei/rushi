import type { FileSummary } from "../tauri/projectTypes";
import {
  formatHubFileEmptyProgressLabel,
  formatHubFileStageLegend,
  hubFileStageCounts,
  hubFileStageLegendParts,
  type HubFileRowLiveState,
  type HubFileStageLegendPart,
} from "../utils/projectFileDisplay";
import { CspLayout } from "./CspLayout";
import {
  PANEL_PROGRESS_INDETERMINATE_CLASS,
  PANEL_PROGRESS_TRACK_CLASS,
} from "./panelProgressStyles";

type Props = {
  file: FileSummary;
  live?: HubFileRowLiveState;
  className?: string;
  /** default：轨上图例下；ledger：图例上、细轨下（欢迎最近文件） */
  variant?: "default" | "ledger";
};

type StagePart = {
  key: string;
  label: string;
  count: number;
  trackClass: string;
};

/** Track fills use the same semantic tokens as stage chips / legend. */
function stageParts(counts: ReturnType<typeof hubFileStageCounts>): StagePart[] {
  return [
    { key: "draft", label: "草稿", count: counts.draft, trackClass: "bg-notion-text-light/55" },
    {
      key: "first",
      label: "一校",
      count: counts.firstProof,
      trackClass: "bg-zen-status-warn",
    },
    { key: "final", label: "定稿", count: counts.finalized, trackClass: "bg-zen-success" },
  ].filter((p) => p.count > 0);
}

function StageTrack({ parts, ledger }: { parts: StagePart[]; ledger: boolean }) {
  const trackClass = ledger
    ? "flex h-0.5 min-w-[4.5rem] max-w-[7rem] flex-1 overflow-hidden rounded-full bg-notion-sidebar"
    : "flex h-2 max-w-[16rem] min-w-[8rem] overflow-hidden rounded-full bg-notion-sidebar";
  return (
    <div className={trackClass}>
      {parts.map((p) => (
        <CspLayout
          key={p.key}
          as="span"
          className={["h-full min-w-px", p.trackClass].join(" ")}
          layout={{ flexGrow: p.count, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

function EmptyTrack({ ledger }: { ledger: boolean }) {
  return (
    <div
      className={[
        ledger
          ? "h-0.5 w-full min-w-[8rem] max-w-[12rem] rounded-full"
          : "h-2 max-w-[16rem] rounded-full",
        "border border-dashed border-notion-border bg-notion-sidebar/80",
      ].join(" ")}
    />
  );
}

function StageLegend({
  parts,
  className,
}: {
  parts: HubFileStageLegendPart[];
  className: string;
}) {
  return (
    <p className={`truncate ${className}`}>
      {parts.map((part, i) => (
        <span key={part.key}>
          {i > 0 ? <span className="text-notion-text-muted"> · </span> : null}
          <span className={part.textClass}>
            {part.label} {part.count}
          </span>
        </span>
      ))}
    </p>
  );
}

/** ledger 短标签：定稿优先，否则一校/草稿（不展示语段总数）。 */
function formatLedgerCompactLabel(counts: ReturnType<typeof hubFileStageCounts>): string {
  if (counts.finalized > 0) return `定稿 ${counts.finalized}`;
  if (counts.firstProof > 0) return `一校 ${counts.firstProof}`;
  if (counts.draft > 0) return `草稿 ${counts.draft}`;
  return "未转录";
}

/**
 * Hub 进度状态条：色块比例 +「草稿 · 一校 · 定稿」分色图例（不含语段总数）。
 * ledger：单行细轨 + 短标签，完整图例进 title（欢迎最近/所有文件）。
 */
export function HubFileStageMeter({
  file,
  live = { kind: "idle" },
  className = "",
  variant = "default",
}: Props) {
  const ledger = variant === "ledger";
  const shell = [
    ledger ? "flex w-full min-w-0 items-center justify-end gap-2" : "mt-0.5",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const labelClass = ledger
    ? "shrink-0 text-label font-medium tabular-nums text-notion-text-muted"
    : "mt-0.5 text-label font-medium tabular-nums";

  if (live.kind === "transcribing") {
    const label =
      live.percent != null && Number.isFinite(live.percent)
        ? `转写中 ${Math.round(live.percent)}%`
        : "转写中";
    const track = (
      <div
        className={`relative ${
          ledger
            ? "h-0.5 min-w-0 flex-1 max-w-[7rem] overflow-hidden rounded-full bg-notion-sidebar"
            : `max-w-[16rem] ${PANEL_PROGRESS_TRACK_CLASS}`
        }`}
      >
        <div className={PANEL_PROGRESS_INDETERMINATE_CLASS} />
      </div>
    );
    return (
      <div className={shell} role="status">
        {ledger ? (
          <>
            {track}
            <p className={`${labelClass} text-accent-action`}>{label}</p>
          </>
        ) : (
          <>
            {track}
            <p className="mt-0.5 text-label font-medium tabular-nums text-accent-action">{label}</p>
          </>
        )}
      </div>
    );
  }
  if (live.kind === "queued") {
    const track = (
      <div
        className={
          ledger
            ? "h-0.5 min-w-0 flex-1 max-w-[7rem] rounded-full bg-notion-sidebar"
            : "h-2 max-w-[16rem] rounded-full bg-notion-sidebar"
        }
      />
    );
    return (
      <div className={shell} role="status">
        {ledger ? (
          <>
            {track}
            <p className={labelClass}>排队中</p>
          </>
        ) : (
          <>
            {track}
            <p className="mt-0.5 text-label font-medium text-notion-text-muted">排队中</p>
          </>
        )}
      </div>
    );
  }

  const counts = hubFileStageCounts(file);
  if (counts.total <= 0) {
    const empty = formatHubFileEmptyProgressLabel(file);
    return (
      <div className={shell} role="status" aria-label={empty}>
        {ledger ? (
          <p className="text-label text-notion-text-muted">{empty}</p>
        ) : (
          <>
            <EmptyTrack ledger={false} />
            <p className="mt-0.5 text-label text-notion-text-muted">{empty}</p>
          </>
        )}
      </div>
    );
  }

  const parts = stageParts(counts);
  const legendParts = hubFileStageLegendParts(counts);
  const legend = formatHubFileStageLegend(counts);
  const compact = formatLedgerCompactLabel(counts);

  return (
    <div className={shell} role="img" aria-label={legend} title={legend}>
      {ledger ? (
        <>
          <StageTrack parts={parts} ledger />
          <p className={labelClass}>{compact}</p>
        </>
      ) : (
        <>
          <StageTrack parts={parts} ledger={false} />
          <StageLegend parts={legendParts} className={labelClass} />
        </>
      )}
    </div>
  );
}
