export type EnvNavId =
  | "local-asr"
  | "online-stt"
  | "llm"
  | "preferences"
  | "profile"
  | "shortcuts"
  | "quality"
  | "about";

export const ENV_NAV_BTN_BASE =
  "mb-1 flex w-full appearance-none items-center border-0 px-4 py-3 text-left shadow-none outline-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/30";

export type EnvNavItemDef = {
  id: EnvNavId;
  label: string;
  description: string;
  /** 贴底（如「关于」） */
  pinBottom?: boolean;
};

/** 顺序：转写能力 → 编辑 → 数据/维护 → 关于（贴底） */
export const ENV_NAV_ITEM_DEFS: EnvNavItemDef[] = [
  { id: "local-asr", label: "本机 ASR", description: "侧车、模型与诊断" },
  { id: "online-stt", label: "在线 STT", description: "厂商与 API Key" },
  { id: "llm", label: "LLM 配置", description: "云端或本机 Ollama" },
  { id: "preferences", label: "偏好设置", description: "外观与转写编辑体验" },
  { id: "shortcuts", label: "快捷键", description: "编辑器键盘操作" },
  { id: "profile", label: "配置迁移", description: "导入 / 导出偏好" },
  { id: "quality", label: "质量评测", description: "CER / 发版门禁" },
  { id: "about", label: "关于", description: "版本与第三方许可", pinBottom: true },
];

export function envMainPaddingClass(layoutCompact: boolean): string {
  return layoutCompact ? "px-4 py-4" : "px-6 py-5";
}

/** 各子页根容器：统一宽度、居中；子区块以间距分隔（无分隔线） */
export const ENV_PANEL_PAGE_CLASS = "mx-auto flex w-full max-w-[860px] flex-col gap-8";

/** 环境页 section 纵向节奏（标题 / 正文 / 控件） */
export const ENV_PANEL_SECTION_CLASS = "flex flex-col gap-3";

/** 含多按钮工具行的 section（正文与按钮组略松） */
export const ENV_PANEL_SECTION_TOOLS_CLASS = "flex flex-col gap-4";

/** 表单区与 CTA 按钮行之间（无上分隔线；仅用于表单项容器内，勿嵌在 `gap-*` 父级下） */
export const ENV_PANEL_ACTION_ROW_CLASS = "mt-4 flex flex-wrap items-center gap-2";

/** 配置栈底栏 / `gap-*` 列内按钮行（间距由父级 gap 承担，禁止再加 mt） */
export const ENV_PANEL_BUTTON_ROW_CLASS = "flex flex-wrap items-center gap-2";

/** 扁平配置栈（banner / middle / form / footer / trailing） */
export const ENV_FLAT_STACK_CLASS = "flex flex-col gap-5";

/** 配置页表单外壳：字段区与 CTA 分行，CTA 用 `ENV_PANEL_ACTION_ROW_CLASS`（勿与字段区共用 gap-5） */
export const ENV_PANEL_FORM_CLASS = "flex flex-col";

/** 表单字段区纵向节奏（无 py-5 / border-t） */
export const ENV_PANEL_FORM_FIELDS_CLASS = "flex flex-col gap-5";

/** 标签 + 控件 + 字段内 hint */
export const ENV_PANEL_FORM_FIELD_CLASS = "flex flex-col gap-2";

/** 配置页内多块纵向编排（如 LLM 模式切换 + flat stack） */
export const ENV_PANEL_CONFIG_FLOW_CLASS = "mx-auto flex w-full max-w-[860px] flex-col gap-5";

/** 设置页能力状态条外壳（本机 ASR / 在线 STT / LLM 共用；Stitch F1 · rounded-lg） */
export const ENV_STATUS_BANNER_SHELL_CLASS = "rounded-lg px-4 py-3";
