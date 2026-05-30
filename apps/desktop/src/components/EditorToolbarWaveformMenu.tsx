import type { RefObject } from "react";
import { Activity } from "lucide-react";
import type { TranscriptionLayerApi } from "../pages/useTranscriptionLayer";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { isTauriRuntime } from "../config/env";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const ghostBtn =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-2.5 text-[12px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40";
const menuItem =
  "dropdown-item w-full px-3 py-2 text-left text-[12px] text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light";

type EditorToolbarWaveformMenuProps = {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  menuRef: RefObject<HTMLDetailsElement | null>;
  clearPeaksDisabled: boolean;
  clearingPeaks: boolean;
  onCloseSiblingMenus: () => void;
  onClearWaveformPeaks: () => void | Promise<void>;
};

export function EditorToolbarWaveformMenu({
  tx,
  menuRef,
  clearPeaksDisabled,
  clearingPeaks,
  onCloseSiblingMenus,
  onClearWaveformPeaks,
}: EditorToolbarWaveformMenuProps) {
  return (
    <details ref={menuRef} className="dropdown-anchor">
      <summary
        className={`${ghostBtn} list-none cursor-pointer marker:content-none [&::-webkit-details-marker]:hidden ${
          clearPeaksDisabled ? "pointer-events-none opacity-40" : ""
        }`}
        aria-disabled={clearPeaksDisabled}
        onClick={(e) => {
          if (clearPeaksDisabled) {
            e.preventDefault();
            return;
          }
          onCloseSiblingMenus();
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Activity className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          {clearingPeaks || tx.peaksLoading ? "波形…" : "波形"}
        </span>
      </summary>
      <div className="dropdown-surface absolute right-0 top-full z-[100] mt-1 min-w-[13rem] py-1">
        <button
          type="button"
          className={menuItem}
          disabled={clearPeaksDisabled}
          title={!isTauriRuntime() ? "需在桌面应用中运行" : undefined}
          onClick={() => void onClearWaveformPeaks()}
        >
          重新生成波形
        </button>
        <button
          type="button"
          className={menuItem}
          onClick={() => tx.setBackgroundPeaksEnabled(!tx.backgroundPeaksEnabled)}
        >
          {tx.backgroundPeaksEnabled ? "✓ " : ""}后台生成波形
        </button>
        <button
          type="button"
          className={menuItem}
          onClick={() => tx.setMinimapEnabled(!tx.minimapEnabled)}
        >
          {tx.minimapEnabled ? "✓ " : ""}显示波形总览
        </button>
        <button
          type="button"
          className={menuItem}
          onClick={() => tx.setHotSwitchWhilePlaying(!tx.hotSwitchWhilePlaying)}
        >
          {tx.hotSwitchWhilePlaying ? "✓ " : ""}播放中热切换
        </button>
      </div>
    </details>
  );
}
