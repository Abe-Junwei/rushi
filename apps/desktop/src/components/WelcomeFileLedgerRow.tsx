import { useState } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  WELCOME_LEDGER_INSET_X,
  WELCOME_LEDGER_ROW_Y,
  WORKSPACE_FILE_ROW_CLASS,
} from "../config/workspaceShellLayout";
import type { RecentWorkspaceFile } from "../services/lastWorkspace";
import { formatHubFileAudioMetaLine } from "../utils/projectFileDisplay";
import { HoverRevealText } from "./HoverRevealText";
import { HubFileStageMeter } from "./HubFileStageMeter";

type Props = {
  file: RecentWorkspaceFile;
  busy?: boolean;
  onOpen: () => void;
};

/** 欢迎页最近文件 ledger 行：左标题+meta · 右图例+细轨；与 tab 栏同水平内边距。 */
export function WelcomeFileLedgerRow({ file, busy, onOpen }: Props) {
  const [rowHovered, setRowHovered] = useState(false);
  const meta = formatHubFileAudioMetaLine(file.summary);
  const warning = file.summary.media_missing;

  return (
    <div className={WORKSPACE_FILE_ROW_CLASS}>
      <button
        type="button"
        className={`flex w-full min-w-0 items-start gap-6 border-0 bg-transparent text-left disabled:opacity-40 ${WELCOME_LEDGER_INSET_X} ${WELCOME_LEDGER_ROW_Y}`}
        disabled={busy}
        onClick={() => void onOpen()}
        title={file.name}
        onMouseEnter={() => setRowHovered(true)}
        onMouseLeave={() => setRowHovered(false)}
        onFocus={() => setRowHovered(true)}
        onBlur={() => setRowHovered(false)}
      >
        <span className="min-w-0 flex-1">
          <HoverRevealText
            text={file.name}
            revealed={rowHovered}
            className="text-sm font-medium text-notion-text"
          />
          <span
            className={[
              "mt-2 block truncate",
              PANEL_TYPOGRAPHY.meta,
              warning ? "text-zen-cinnabar" : "text-notion-text-muted",
            ].join(" ")}
          >
            {meta}
          </span>
        </span>
        <span className="w-[12rem] shrink-0 pt-0.5">
          <HubFileStageMeter file={file.summary} variant="ledger" />
        </span>
      </button>
    </div>
  );
}
