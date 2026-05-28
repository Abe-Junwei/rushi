import { RefreshCw } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { EnvLocalAsrSmallButton, EnvLocalAsrStatusRow } from "./envLocalAsrPanelUi";

type Props = {
  envOk: boolean;
  ffmpegOk: boolean;
  runtimeReady: boolean;
  transcribeReady: boolean;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
};

export function EnvLocalAsrStatusSection({
  envOk,
  ffmpegOk,
  runtimeReady,
  transcribeReady,
  busy,
  refreshAsrHealth,
}: Props) {
  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>ASR 状态</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>当前系统的 ASR 环境检测结果</p>
      </div>

      <div className="flex flex-col">
        <EnvLocalAsrStatusRow label="环境" ok={envOk} text={envOk ? "正常" : "异常"} />
        <EnvLocalAsrStatusRow label="FFmpeg" ok={ffmpegOk} text={ffmpegOk ? "已安装" : "未安装"} />
        <EnvLocalAsrStatusRow label="FunASR 运行时" ok={runtimeReady} text={runtimeReady ? "就绪" : "未就绪"} />
        <EnvLocalAsrStatusRow label="可直接转写" ok={transcribeReady} text={transcribeReady ? "就绪" : "未就绪"} last />
      </div>

      <div className="flex justify-start gap-3">
        <EnvLocalAsrSmallButton
          disabled={busy}
          onClick={() => void refreshAsrHealth()}
          icon={<RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}
        >
          刷新状态
        </EnvLocalAsrSmallButton>
      </div>
    </section>
  );
}
