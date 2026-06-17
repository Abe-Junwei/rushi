export type EnvNavId =
  | "local-asr"
  | "online-stt"
  | "llm"
  | "profile"
  | "shortcuts"
  | "quality"
  | "about"
  | "help";

export const ENV_NAV_BTN_BASE =
  "mb-1 flex w-full appearance-none items-center border-0 px-4 py-3 text-left shadow-none outline-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30";

export type EnvNavItemDef = {
  id: EnvNavId;
  label: string;
  description: string;
  /** 与下方说明类条目贴底（在「使用说明」首项上加 mt-auto） */
  pinBottom?: boolean;
};

/** 顺序：转写能力 → 编辑 → 数据/维护 → 说明与关于（贴底） */
export const ENV_NAV_ITEM_DEFS: EnvNavItemDef[] = [
  { id: "local-asr", label: "本机 ASR", description: "侧车、模型与诊断" },
  { id: "online-stt", label: "在线 STT", description: "厂商与 API Key" },
  { id: "llm", label: "LLM 配置", description: "云端或本机 Ollama" },
  { id: "shortcuts", label: "快捷键", description: "编辑器键盘操作" },
  { id: "profile", label: "配置迁移", description: "导入 / 导出偏好" },
  { id: "quality", label: "质量评测", description: "CER / 发版门禁" },
  { id: "help", label: "使用说明", description: "转写流程与 FAQ", pinBottom: true },
  { id: "about", label: "关于", description: "版本与第三方许可" },
];

export function envNavWidthClass(layoutCompact: boolean): string {
  return layoutCompact ? "w-48" : "w-60";
}

export function envMainPaddingClass(layoutCompact: boolean): string {
  return layoutCompact ? "px-4 py-4" : "px-6 py-5";
}
