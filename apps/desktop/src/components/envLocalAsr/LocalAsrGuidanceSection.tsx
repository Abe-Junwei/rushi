import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import type { AsrHealthState } from "../../pages/useProjectController";

type Props = {
  asrHealth: AsrHealthState;
  asrCaps: AsrHealthCapabilities | null;
};

export function LocalAsrGuidanceSection({ asrHealth, asrCaps }: Props) {
  const steps = [
    {
      label: "检测本机 ASR 服务",
      done: asrHealth === "ok",
      detail:
        asrHealth === "ok"
          ? "已读到 /health 响应。"
          : "先让本机 ASR 或安装包内侧车可达，再继续后续步骤。",
    },
    {
      label: "安装 FunASR 依赖",
      done: asrCaps?.funasr_import_ok === true,
      detail:
        asrCaps?.funasr_import_ok === true
          ? "FunASR 依赖已就绪。"
          : "若当前仍是 stub，请先安装依赖并重启 ASR。",
    },
    {
      label: "准备默认模型",
      done: asrCaps?.funasr_default_model_cached === true,
      detail:
        asrCaps?.funasr_default_model_cached === true
          ? "默认 SenseVoiceSmall 权重已缓存。"
          : "建议先预下载默认模型，减少首次转写等待。",
    },
  ];

  const nextAction =
    asrHealth !== "ok"
      ? "先点击“刷新状态”，若使用安装包侧车可再试“重试内置侧车”。"
      : asrCaps?.funasr_import_ok !== true
        ? "先安装 FunASR 依赖并重启 ASR。"
        : asrCaps?.funasr_default_model_cached !== true
          ? "建议现在预先下载默认模型。"
          : "本机 ASR 已准备完毕，可直接用于转写。";

  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>首次引导</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>按「检测服务 → 安装依赖 → 准备模型」完成本机 ASR。</p>
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((step) => (
          <div key={step.label} className="rounded bg-notion-callout-bg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${step.done ? "bg-zen-success" : "bg-zen-saffron"}`} aria-hidden />
              <span className={PANEL_TYPOGRAPHY.fieldLabel}>{step.label}</span>
            </div>
            <p className="mt-1 text-[12px] text-notion-text-muted">{step.detail}</p>
          </div>
        ))}
      </div>
      <p className={PANEL_TYPOGRAPHY.meta}>当前下一步：{nextAction}</p>
    </section>
  );
}
