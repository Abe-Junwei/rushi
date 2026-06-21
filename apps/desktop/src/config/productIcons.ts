import {
  ArrowDownUp,
  BarChart3,
  BookMarked,
  BookOpen,
  Bot,
  Brain,
  Check,
  CirclePlay,
  Cloud,
  Cpu,
  FileSpreadsheet,
  Info,
  Keyboard,
  ListChecks,
  MessageSquare,
  Mic,
  Palette,
  Pause,
  PenLine,
  Play,
  Replace,
  SpellCheck2,
  Target,
  Wand2,
  type LucideIcon,
} from "lucide-react";

/**
 * 产品语义图标真源 — 按能力域分配 Lucide 形，避免 Sparkles/Play 等跨域混用。
 * 平台动词（Trash2、RefreshCw、Chevron*）仍可在业务文件直接 import。
 * 尺寸 / 描边：一律叠加 lucideIconSpec（LUCIDE_ICON_SIZE_*、LUCIDE_ICON_STROKE_WIDTH）。
 */
export const PRODUCT_ICON = {
  /** 环境页 · 本机 ASR */
  navLocalAsr: Cpu,
  /** 环境页 · 在线 STT */
  navOnlineStt: Cloud,
  /** 环境页 · LLM 配置 */
  navLlm: Brain,
  /** 环境页 · 偏好设置（外观 + 转写编辑） */
  navPreferences: Palette,
  /** 环境页 · 快捷键 */
  navShortcuts: Keyboard,
  /** 环境页 · 配置迁移（导入/导出偏好） */
  navProfileMigrate: ArrowDownUp,
  /** 环境页 · 质量评测 */
  navQuality: BarChart3,
  /** 环境页 · 关于 */
  navAbout: Info,

  /** 侧栏 · 转写词汇表 */
  navGlossaryVocabulary: BookOpen,
  /** 侧栏 · 纠错记忆 */
  navGlossaryMemory: BookMarked,
  /** 侧栏 · 词表包 */
  navGlossaryBundle: FileSpreadsheet,

  /** 工作条 · 自动转录（动作，非 stage chip） */
  transcribeAction: Mic,
  /** 工作条 · 智能改稿（Stage B / LLM 标点改字） */
  aiRefine: Wand2,
  /** 工作条 · 规则纠错（稳定规则全文替换，无 LLM） */
  correctionRules: SpellCheck2,
  /** 工作条 · 查找替换 */
  findReplace: Replace,
  /** glossary 批量 · 采纳为稳定规则 */
  correctionRulesAccept: ListChecks,

  /** 语段 stage · 自动转写 */
  stageAutoTranscribe: Bot,
  /** 语段 stage · AI 改稿后 */
  stageAiRevised: Wand2,
  /** 语段 stage · 人工转写/编辑 */
  stageManual: PenLine,
  /** 语段 stage · 已定稿 */
  stageFinalized: Check,

  /** 波形 / 语段 · 播放与暂停 */
  playAudio: Play,
  pauseAudio: Pause,
  /** 非音频「启动任务」（质量 eval 等） */
  runJob: CirclePlay,
  /** 质量评测 · R4-GATE（制控专名） */
  qualityGate: Target,

  /** 语段行备注（非导入文本 FileText） */
  segmentAnnotation: MessageSquare,
} as const satisfies Record<string, LucideIcon>;

export type ProductIconKey = keyof typeof PRODUCT_ICON;
