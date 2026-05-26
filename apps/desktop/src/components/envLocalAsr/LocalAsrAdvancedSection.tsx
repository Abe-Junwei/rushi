import { Wrench } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { funasrManualSetupCommands } from "../../pages/useProjectController";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";

type Props = {
  asrHealth: string;
  asrCaps: AsrHealthCapabilities | null;
  funasrInstallMessage: string;
  busy: boolean;
  installFunasrDepsInteractive: () => Promise<void>;
  copyFunasrManualCommands: () => Promise<void>;
};

export function LocalAsrAdvancedSection({
  asrHealth,
  asrCaps,
  funasrInstallMessage,
  busy,
  installFunasrDepsInteractive,
  copyFunasrManualCommands,
}: Props) {
  const showFunasrStubHelp =
    asrHealth === "ok" && asrCaps != null && asrCaps.ffmpeg_ok && !asrCaps.funasr_ready;

  return (
    <details className="rounded bg-notion-sidebar px-3 py-2">
      <summary className={`cursor-pointer select-none ${PANEL_TYPOGRAPHY.fieldLabel}`}>
        高级 / 开发者（pip 与手动 ASR）
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className={PANEL_TYPOGRAPHY.meta}>
          主路径请使用上方「一键准备」。仅在开发环境或内置侧车不可用时，才需要 pip 安装 FunASR 依赖或手动启动
          <code className="mx-1 rounded bg-notion-bg px-1 font-mono text-[11px]">python -m rushi_asr</code>。
        </p>
        <div className="flex flex-wrap gap-2">
          <SmallButton
            disabled={busy}
            onClick={() => void installFunasrDepsInteractive()}
            icon={<Wrench className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}
          >
            安装 FunASR 依赖（pip）
          </SmallButton>
          <SmallButton disabled={busy} onClick={() => void copyFunasrManualCommands()}>
            复制手动命令
          </SmallButton>
        </div>
        {funasrInstallMessage ? (
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-notion-callout-bg p-3 font-mono text-[11px] text-zen-indigo">
            {funasrInstallMessage}
          </pre>
        ) : null}
        {showFunasrStubHelp ? (
          <div className="space-y-2 rounded bg-notion-callout-bg px-3 py-2 text-sm">
            <p>
              <strong className="text-notion-text">FunASR 未就绪</strong>
              <span className="text-notion-text-muted">
                （stub：中文正文常为空）。可尝试安装依赖并重启 ASR；可选{" "}
              </span>
              <code className="rounded bg-notion-bg px-1 font-mono text-[11px]">RUSHI_FUNASR_MODEL</code>。
            </p>
            <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-notion-bg p-2 font-mono text-[12px] text-zen-indigo">
              {funasrManualSetupCommands()}
            </pre>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function SmallButton({
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
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded border border-notion-divider bg-notion-bg px-2.5 py-1 ${PANEL_TYPOGRAPHY.button} text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
