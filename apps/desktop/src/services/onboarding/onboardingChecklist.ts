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
    description: "讲者、录制时间、地点等（可选，便于交付导出）。",
    optional: true,
  },
  {
    id: "export",
    title: "导出 Word / 定稿",
    description: "终检后导出讲稿或逐字稿，或进入定稿模式。",
  },
];

export function onboardingStepLabel(id: OnboardingStepId): string {
  return ONBOARDING_STEPS.find((s) => s.id === id)?.title ?? id;
}
