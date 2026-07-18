import {
  IconArrowsUpDown as ArrowDownUp,
  IconChartBar as BarChart3,
  IconBookmarks as BookMarked,
  IconBook as BookOpen,
  IconBooks as Books,
  IconRobot as Bot,
  IconBrain as Brain,
  IconCircleCheck as CircleCheck,
  IconCircleNumber1 as CircleNumber1,
  IconCircleCaretRight as CirclePlay,
  IconCloud as Cloud,
  IconCpu as Cpu,
  IconFileSpreadsheet as FileSpreadsheet,
  IconFileText as FileText,
  IconHome as Home,
  IconInfoCircle as Info,
  IconKeyboard as Keyboard,
  IconListCheck as ListChecks,
  IconMessage as MessageSquare,
  IconMicrophone as Mic,
  IconPalette as Palette,
  IconPlayerPause as Pause,
  IconEdit as PenLine,
  IconPlayerPlay as Play,
  IconReplace as Replace,
  IconTextSpellcheck as SpellCheck2,
  IconTarget as Target,
  IconWand as Wand2,
  type TablerIcon,
} from "@tabler/icons-react";

/**
 * 产品语义图标真源 — 按能力域分配 Tabler 形，避免 Sparkles/Play 等跨域混用。
 * 平台动词（Trash、Refresh、Chevron*）仍可在业务文件直接 import。
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

  /** 侧栏 · 主页（项目与文件库） */
  navHome: Home,
  /** 侧栏 · 转录（文档形，对齐设计稿「转录列表」） */
  navTranscript: FileText,
  /** 侧栏 · 词表（书册叠放，区别于子页单书 BookOpen） */
  navGlossary: Books,
  /** 侧栏 · 转写词汇表（词表子页） */
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
  /** 语段 stage · 一校 */
  stageFirstProof: CircleNumber1,
  /** 语段 stage · 已定稿 */
  stageFinalized: CircleCheck,

  /** 波形 / 语段 · 播放与暂停 */
  playAudio: Play,
  pauseAudio: Pause,
  /** 非音频「启动任务」（质量 eval 等） */
  runJob: CirclePlay,
  /** 质量评测 · R4-GATE（制控专名） */
  qualityGate: Target,

  /** 语段行备注（非导入文本 FileText） */
  segmentAnnotation: MessageSquare,
} as const satisfies Record<string, TablerIcon>;
