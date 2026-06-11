import { ENV_COMPACT_BTN } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { funasrManualSetupCommands } from "../../pages/useProjectController";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import {
  EnvLocalAsrCollapsibleSection,
  EnvUtilitiesActionRow,
  EnvUtilitiesSubsection,
} from "./envLocalAsrPanelUi";

type Props = {
  asrHealth: string;
  asrCaps: AsrHealthCapabilities | null;
  funasrInstallMessage: string;
  busy: boolean;
  copyFunasrManualCommands: () => Promise<void>;
  /** 外层 utilities 折叠内：不再套 details */
  embedded?: boolean;
};

export function LocalAsrAdvancedSection({
  asrHealth,
  asrCaps,
  funasrInstallMessage,
  busy,
  copyFunasrManualCommands,
  embedded = false,
}: Props) {
  const showFunasrStubHelp =
    asrHealth === "ok" && asrCaps != null && asrCaps.ffmpeg_ok && !asrCaps.funasr_ready;

  const body = (
    <EnvUtilitiesSubsection
      title="手动调试"
      description={
        <p className="m-0">
          主路径请使用上方「一键准备」。仅在开发环境或内置侧车不可用时，才需要 pip 安装 FunASR 依赖或手动启动
          <code className="mx-1 rounded bg-notion-bg px-1 font-mono text-[11px]">python -m rushi_asr</code>。
        </p>
      }
    >
      <EnvUtilitiesActionRow>
        <EnvCompactButton disabled={busy} onClick={() => void copyFunasrManualCommands()}>
          复制手动命令
        </EnvCompactButton>
      </EnvUtilitiesActionRow>
      {funasrInstallMessage ? (
        <pre className="m-0 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-zen-indigo">
          {funasrInstallMessage}
        </pre>
      ) : null}
      {showFunasrStubHelp ? (
        <div className="flex flex-col gap-2">
          <p className={`m-0 ${PANEL_TYPOGRAPHY.meta}`}>
            FunASR 未就绪（stub：中文正文常为空）。可尝试安装依赖并重启 ASR；可选{" "}
            <code className="font-mono text-[11px]">RUSHI_FUNASR_MODEL</code>。
          </p>
          <pre className="m-0 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-zen-indigo">
            {funasrManualSetupCommands()}
          </pre>
        </div>
      ) : null}
    </EnvUtilitiesSubsection>
  );

  if (embedded) return body;

  return <EnvLocalAsrCollapsibleSection title="高级诊断">{body}</EnvLocalAsrCollapsibleSection>;
}

function EnvCompactButton({
  children,
  disabled,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button type="button" className={ENV_COMPACT_BTN} disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}
