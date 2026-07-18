import type { TranscribeSource } from "../../services/stt/transcribeSource";

export type OnboardingStepId =
  | "asr_ready"
  | "project_audio"
  | "transcribe"
  | "metadata"
  | "export";

export type OnboardingStepDef = {
  id: OnboardingStepId;
  title: string;
  description: string;
  optional?: boolean;
};

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    id: "asr_ready",
    title: "准备本机 ASR",
    description: "在环境页完成侧车与模型准备，确保可以转写。",
  },
  {
    id: "project_audio",
    title: "创建项目并导入音频",
    description: "新建项目或导入音频文件，打开编辑器。",
  },
  {
    id: "transcribe",
    title: "自动转录",
    description: "对音频执行一次自动转录，生成语段。",
  },
  {
    id: "metadata",
    title: "填写场次信息",
    description: "讲者、录制时间、地点等（可选，便于导出抬头）。",
    optional: true,
  },
  {
    id: "export",
    title: "导出 / 定稿",
    description: "导出交付 Word、文本或内容包，或进入定稿模式。",
  },
];

/** 上手清单第 1 步：随转写来源切换文案（步骤 id 仍为 asr_ready 以兼容进度）。 */
export function resolveOnboardingTranscribeEnvStep(source: TranscribeSource): Pick<
  OnboardingStepDef,
  "title" | "description"
> {
  if (source === "online") {
    return {
      title: "配置在线 STT",
      description: "在环境页选择服务商、保存密钥并探测连接。",
    };
  }
  return {
    title: ONBOARDING_STEPS[0].title,
    description: ONBOARDING_STEPS[0].description,
  };
}
