import type { FileSummary } from "../tauri/projectTypes";
import {
  formatHubFileEmptyProgressLabel,
  formatHubFileStageLegend,
  hubFileStageCounts,
  type HubFileRowLiveState,
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

function stageParts(counts: ReturnType<typeof hubFileStageCounts>): StagePart[] {
  return [
    { key: "draft", label: "生稿", count: counts.draft, trackClass: "bg-notion-text-light/50" },
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
    ? "flex h-0.5 w-full min-w-[8rem] max-w-[12rem] overflow-hidden rounded-full bg-notion-sidebar"
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

/**
 * Hub 进度状态条：色块比例 + 完整「生稿 a · 一校 b · 定稿 c」图例
 * （小份额色块装不下数字时仍可读，对齐 GitHub language bar 用法）。
 */
export function HubFileStageMeter({
  file,
  live = { kind: "idle" },
  className = "",
  variant = "default",
}: Props) {
  const ledger = variant === "ledger";
  const shell = [ledger ? "flex w-full flex-col items-end gap-2" : "mt-0.5", className]
    .filter(Boolean)
    .join(" ");
  const labelClass = ledger
    ? "text-label font-medium tabular-nums text-notion-text-muted"
    : "mt-0.5 text-label font-medium tabular-nums text-notion-text-muted";

  if (live.kind === "transcribing") {
    const label =
      live.percent != null && Number.isFinite(live.percent)
        ? `转写中 ${Math.round(live.percent)}%`
        : "转写中";
    const track = (
      <div
        className={`relative ${
          ledger
            ? "h-0.5 w-full min-w-[8rem] max-w-[12rem] overflow-hidden rounded-full bg-notion-sidebar"
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
            <p className={`${labelClass} text-accent-action`}>{label}</p>
            {track}
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
            ? "h-0.5 w-full min-w-[8rem] max-w-[12rem] rounded-full bg-notion-sidebar"
            : "h-2 max-w-[16rem] rounded-full bg-notion-sidebar"
        }
      />
    );
    return (
      <div className={shell} role="status">
        {ledger ? (
          <>
            <p className={labelClass}>排队中</p>
            {track}
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
          <>
            <p className="text-label text-notion-text-muted">{empty}</p>
            <EmptyTrack ledger />
          </>
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
  const legend = formatHubFileStageLegend(counts);

  return (
    <div className={shell} role="img" aria-label={legend} title={legend}>
      {ledger ? (
        <>
          <p className={`truncate ${labelClass}`}>{legend}</p>
          <StageTrack parts={parts} ledger />
        </>
      ) : (
        <>
          <StageTrack parts={parts} ledger={false} />
          <p className="mt-0.5 truncate text-label font-medium tabular-nums text-notion-text-muted">
            {legend}
          </p>
        </>
      )}
    </div>
  );
}
