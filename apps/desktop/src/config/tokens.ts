/**
 * 设计 token — hex 真源见 styles/tokens.css；Tailwind 映射见 zen-tailwind.css @theme。
 * 供 TS 侧内联样式、Rust 侧 docx 导出等引用。
 * 对齐仓库根 DESIGN.md（Notion Zen）。
 */

export const COLORS = {
  ink: "#2C2C2C",
  paper: "#F2EFE8",
  saffron: "#C58A43",
  saffronLight: "#ffddba",
  saffronMid: "#85530f",
  saffronDeep: "#452800",
  /** 实心 Primary CTA（WCAG AA 白字）；见 tokens.css --zen-primary-action-* */
  primaryActionBg: "#C58A43",
  primaryActionBgHover: "#85530f",
  primaryActionFg: "#ffffff",
  primaryActionFgHover: "#ffffff",
  ochre: "#EAE0C5",
  stone: "#8E8E8E",
  cinnabar: "#963530",

  success: "#1e463a",
  successAction: "#2e6153",
  successSurface: "#eff3f1",
  successBorder: "#e2e9e6",
  saffronSurface: "#f9f3ec",
  saffronBorder: "#eedcc7",
  cinnabarSurface: "#f5ebea",
  cinnabarBorder: "#dab8b7",
  /** 环境状态 warn（固定品牌 saffron，不随 accent 主题变化） */
  statusWarn: "#C58A43",
  statusWarnAction: "#85530f",
  statusWarnSurface: "#f9f3ec",
  statusWarnBorder: "#eedcc7",
  danger: "#963530",
  warning: "#f59e0b",

  /** Notion 风格令牌 */
  notionBg: "#ffffff",
  notionSidebar: "#f7f7f5",
  notionSidebarHover: "#efefef",
  notionSidebarActive: "#ebebea",
  secondaryContainer: "#e7e2d9",
  notionDivider: "#e3e2e0",
  notionBorder: "#e3e2e0",
  notionText: "#37352f",
  /** Stitch on-surface-variant */
  notionTextVariant: "#514538",
  notionTextMuted: "#6b6b6b",
  notionTextLight: "#9ca3af",
  notionCalloutBg: "#f1f1ef",
  notionCalloutBorder: "#e3e2e0",

  /** 主壳层 — 对齐 tokens.css --main-shell-* */
  mainShellBg: "#ffffff",
  mainShellSidebarBg: "#f7f7f5",
  mainShellBorder: "#e3e2e0",
  mainShellMinimapBg: "#f7f7f5",
  /** 内容装饰面 — 不进导航壳 */
  contentDecorationPaper: "#F2EFE8",
  contentDecorationCard: "#f5f0e0",
  /** Shell accent — 对齐 tokens.css --accent-action*；--accent-edit 为兼容别名 */
  accentEdit: "#C58A43",
  accentAction: "#C58A43",
  accentActionStrong: "#85530f",
  shellElevationShadow: "none",

  /** WaveSurfer 白底波形条（与 tailwind `zen-wf-*` 同源） */
  waveformSurface: "#ffffff",
  /** 未播放 peaks — 偏深中性灰（往黑靠；壳层主题不另盖） */
  waveformWave: "#5a5a5f",
  /** 已播放 peaks 淡化色（中性，不锁 accent） */
  waveformProgress: "#8e8e93",
  /**
   * 已播放 peaks 淡色 — CSS 真源 `--zen-wf-progress-played`。
   * 视口已播放区视觉以 `--zen-wf-played-wash` 淡化罩为主。
   */
  waveformProgressPlayed: "#a8a8ad",
  waveformCursor: "#6a6a6f",
  /** Global playback playhead — fixed black; CSS `--waveform-playhead-global`. */
  waveformPlayheadGlobal: "#000000",
} as const;
