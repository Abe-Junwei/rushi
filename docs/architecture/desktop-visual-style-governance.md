# 桌面端视觉样式治理

> **实施 plan**：[`desktop-visual-style-governance-plan.md`](../execution/specs/desktop-visual-style-governance-plan.md)  
> **Tailwind v4 真源**：[`desktop-tailwind-v4.md`](./desktop-tailwind-v4.md)  
> **产品视觉**：仓库根 [`DESIGN.md`](../../DESIGN.md)

---

## 真源分层

| 层 | 文件 | 职责 |
|----|------|------|
| 颜色 / 间距 scale | `apps/desktop/tailwind.config.js` → `tokens.css` → `@theme` | hex 与 Tailwind 主题 |
| Primary CTA 对比度 | `tokens.css` `--zen-primary-action-*` → `bg-zen-primary-action-bg` | 实心白字按钮 / 工作条 toggle；**勿** `bg-zen-saffron` + 白字 |
| 暗色骨架 | `tokens.css` `[data-theme="dark"]` | 覆盖 `--notion-*` / `--zen-*`；**无**自动 `prefers-color-scheme`（待 UI 切换） |
| 字号 scale（5 级） | `tokens.css` `:root --text-*` → `@theme` → `text-display/heading/title/body/label` | display 28 / heading 18 / title 14 / body 12 / label 11 |
| 控件外观 | `apps/desktop/src/config/controlStyles.ts` | 按钮、输入、分段 toggle |
| 排版 | `apps/desktop/src/config/typography.ts` | 面板标题、对话框 layout token |
| 环境页 spacing | `apps/desktop/src/utils/environmentPanelNav.ts` | 表单区 / CTA 行 / 状态条 shell |
| 环境状态色 | `apps/desktop/src/services/llm/llmEnvStatusTokens.ts` | `ENV_STATUS_*`（LLM + ASR 共用） |
| 浮动对话框 | `FloatingPanelDialogLayout.tsx` + `COMPACT_DIALOG_LAYOUT` | footer / body padding |
| **主壳层 / 扁平浮层** | `apps/desktop/src/config/shellVisualTokens.ts` + `tokens.css` `--main-shell-*` / `--overlay-panel-*` | 单 accent + 固定语义色、无 shadow 壳层串 |

**禁止**：业务组件内复制 `rounded-md border border-notion-border bg-notion-bg` 等 ad-hoc 控件串；禁止 `bg-[#...]`；禁止 `text-[Npx]` 与 CSS 裸 `font-size: Npx`（用 `text-*` 工具类或 `var(--text-*)`；行内 `0.85em` 相对值除外）；**禁止**在壳层/浮层壳使用 `shadow-md` 及以上（须 `shadow-none` + `border-notion-border`）。

---

## 主壳层与 accent（Round 1+）

| Token / 常量 | 含义 |
|--------------|------|
| `--main-shell-bg` / `MAIN_SHELL_SURFACE_CLASS.pageBg` | Welcome · Hub · Editor 主区白底 |
| `--main-shell-sidebar-bg` | 侧栏、波形 tier 外壳、**minimap 条（R2 接线）** |
| `--main-shell-border` | 壳层 hairline（侧栏右边线等） |
| `--content-decoration-paper` | 仅内容装饰；**禁止**导航壳 |
| `--accent-action` / `--accent-action-strong` | 语段选中 / 多选、CTA、进度、播放头（**随 Office 主题色**） |
| `--accent-edit` | **兼容别名** = `--accent-action`（新代码用 `accent-action`） |
| `--zen-status-warn*` | 顶栏 warn、**手动转写 stage chip** — 固定暖橙，不随主题色 |
| `FLAT_OVERLAY_PANEL_SHELL_CLASS` | 对话框 / 菜单 / Toast 壳：`rounded-lg border … shadow-none` |
| `--shell-elevation-shadow: none` | 全局扁平 elevation 声明 |

**Tailwind 别名（@theme）**：`accent-action-mid` → strong；`accent-action-surface` / `accent-action-border` → `zen-saffron-surface` / `zen-saffron-border`（随主题 remap）。

**组件落码**：`accent-action` / `accent-action-strong`；**禁止**直引 `zen-saffron*`（守卫 **R8 warning**）。

### 语段 / 波形 fill

| CSS 变量 | 语义 | 典型 mix |
|----------|------|----------|
| `--segment-fill-selected` | 列表主选 / overlay 单选 | action **28%** |
| `--segment-fill-in-selection-waveform` | overlay 多选 | action 12% |
| `--segment-fill-in-selection-list` | 列表多选行 | action 8% |
| `--segment-fill-visited` | band 已播放 | action-strong **14%** |
| `--segment-fill-idle` | band 未播放 | ink 11% |
| `--zen-wf-progress-played` | WS 已播 peaks | action-strong 32% × progress 基色 |

真源：`tokens.css`；TS 常量：[`segmentFillTokens.ts`](../../apps/desktop/src/config/segmentFillTokens.ts)；Canvas 解析：[`waveformThemeColors.ts`](../../apps/desktop/src/utils/waveformThemeColors.ts)；DOM overlay：[`segmentChrome.ts`](../../apps/desktop/src/utils/segmentChrome.ts)。

**R7 UI 债务（守卫 warning）**：已全部接线 — 见 `SHELL_SURFACE_MIGRATION_MAP` 与 `shellVisualTokens.ts`。

---

## 控件约定（Notion Zen）

- **标准按钮**：`h-8` · `rounded-sm` (4px) · `text-[12px]` semibold · `shadow-none`
- **Prominent CTA**：`h-10` · 仍 `rounded-sm` · `text-sm`
- **输入**：`CONTROL_TEXT_INPUT` / `CONTROL_SELECT` / `CONTROL_TEXTAREA`（须含 `box-border`；portal 对话框不在 `.workspace` 内）
- **图标 ghost**：`CONTROL_BTN_ICON_GHOST`（28px 方块，Hub / 历史 / 顶栏 / 面板关闭）
- **顶栏专用**：`CONTROL_BTN_STATUS_CHIP`（状态点+文案）· `CONTROL_BTN_BREADCRUMB`（编辑页项目名）· `CONTROL_BTN_WELCOME_ICON`（欢迎页圆形图标 hit）
- **分段 toggle**：`envSegmentedToggleTrackClass` + `envSegmentedToggleBtnClass`（compact 用于对话框）

### 按钮真源与边界

| 场景 | 真源 | 勿用 |
|------|------|------|
| 对话框 / 环境页 / Hub | `controlStyles.ts` `CONTROL_BTN_*` | 手写 `bg-transparent hover:bg-notion-sidebar-hover` |
| 波形工作条 40px 行 | `waveform.css` `.icon-btn`、`.workbench-label-btn`、`.waveform-playback-btn` | 在工作条上套 `CONTROL_BTN_SECONDARY` |
| 侧栏页面切换 | `workspaceShellLayout.ts` `workspaceSidebarNavItemClass` | `CONTROL_BTN_GHOST`（圆角/高度规范不同：`rounded-md` · `min-h-10`） |
| 图标 | `lucide-react` + `lucideIconSpec.ts` | 混装 Tabler/Phosphor 整包；Lucide 为主，补缺仅单 SVG |

**Ghost 阶梯**（尺寸有意区分，禁止合并）：`GHOST` · `TOOLBAR_GHOST` · `WORKSPACE_IMPORT` · `ICON_GHOST`。

**Compact secondary 分工**：`CONTROL_BTN_COMPACT_SECONDARY` → 表格/列表（h-7 · label · sidebar 底）；`ENV_COMPACT_BTN` → 环境/热词工具行（py-1 · body · notion-bg 底）。

**图标库策略**：保持 Lucide（与 shadcn / Notion stroke 气质一致）；**产品语义图标**见 `apps/desktop/src/config/productIcons.ts`（环境 nav、LLM/改稿/记忆/stage、播放/暂停、质量 eval 等须从此取用）。`components/` / `pages/` 禁止直接 import 已登记语义名（含 `Play`/`Pause`/`Sparkles`/`Mic` 等）；守卫 `checkProductSemanticLucideImports`。平台动词（Trash2、RefreshCw、Chevron*、`Check` 勾选态、`Info` 提示）仍可直接 import。若需 Fill 活跃态可局部评估 Phosphor，禁止双库并行挂载。

#### `PRODUCT_ICON` 词汇表（真源：`productIcons.ts`）

| Key | Lucide | 用途 |
|-----|--------|------|
| `navLocalAsr` | Cpu | 环境页 · 本机 ASR |
| `navOnlineStt` | Cloud | 环境页 · 在线 STT |
| `navLlm` | Brain | 环境页 · LLM 配置 |
| `navAppearance` | Palette | 环境页 · 外观 |
| `navShortcuts` | Keyboard | 环境页 · 快捷键 |
| `navProfileMigrate` | ArrowDownUp | 环境页 · 配置迁移 |
| `navQuality` | BarChart3 | 环境页 · 质量评测 |
| `navAbout` | Info | 环境页 · 关于 |
| `navGlossaryVocabulary` | BookOpen | 侧栏 · 转写词汇表 |
| `navGlossaryMemory` | BookMarked | 侧栏 · 纠错记忆 |
| `navGlossaryBundle` | FileSpreadsheet | 侧栏 · 词表包 |
| `transcribeAction` | Mic | 工作条 · 自动转录（动作） |
| `aiRefine` | Wand2 | 工作条 · 智能改稿 |
| `correctionRules` | SpellCheck2 | 工作条 · 规则纠错 |
| `findReplace` | Replace | 工作条 · 查找替换 |
| `correctionRulesAccept` | ListChecks | 纠错记忆批量 · 采纳为规则 |
| `stageAutoTranscribe` | Bot | 语段 stage · 自动转写 |
| `stageAiRevised` | Wand2 | 语段 stage · AI 改稿后 |
| `stageManual` | PenLine | 语段 stage · 人工转写 |
| `stageFinalized` | Check | 语段 stage · 已定稿 |
| `playAudio` | Play | 波形 · 播放 |
| `pauseAudio` | Pause | 波形 · 暂停 |
| `runJob` | CirclePlay | 非音频任务启动（eval 等） |
| `qualityGate` | Target | 质量评测 · R4-GATE |
| `segmentAnnotation` | MessageSquare | 语段行备注 |

新增产品域图标时：**先登记 key** → 迁移调用点 → 把 Lucide 导出名加入守卫 `PRODUCT_SEMANTIC_LUCIDE_NAMES`。

**机器守卫**：`check-architecture-guard.mjs` 对内联 `<button className="…">` 含 `bg-transparent` + `hover:bg-notion-sidebar-hover` 且未用 `CONTROL_BTN_*` / 侧栏 token 的组件文件发出 **warning**（见 `checkControlBtnGhostDuplicates`）。

---

## 环境页 spacing 规则

| Token | 含义 | 约束 |
|-------|------|------|
| `ENV_PANEL_FORM_FIELDS_CLASS` | 字段列 `gap-5` | 与 CTA 分行 |
| `ENV_PANEL_ACTION_ROW_CLASS` | 仅 `mt-4` | 父级**不得**再有 `gap-*` |
| `ENV_PANEL_BUTTON_ROW_CLASS` | 按钮行 `gap-2` | 在 gap 列内，**禁止**再加 `mt-*` |
| `ENV_STATUS_BANNER_SHELL_CLASS` | `rounded-lg px-4 py-3` | LLM / ASR 状态条共用 |

---

## Portal 浮层与 v4 级联

| 场景 | 约束 |
|------|------|
| `DialogOverlay` / `SegmentContextMenu`（挂 `body`） | 无 `.workspace` 的 `box-sizing`；`CONTROL_TEXT_*` 必须 `box-border` |
| `.dropdown-item` | 须在 `@layer base`（`workspace.css`）；hover 用 base 规则或 utilities，**禁止**未分层 `background` 压过 `@layer utilities` |
| 右键菜单高亮 | `dropdown-item` + `hover:bg-notion-sidebar-hover`；子菜单展开态用 `bg-notion-sidebar-hover` |

---

## 架构守卫

`scripts/check-architecture-guard.mjs` 拦截：

1. 字面量 `<button className="…">` / `` className={`…`} `` 缺少 `bg-*` 或 `CONTROL_BTN_*`
2. `controlStyles.ts` 外出现 `bg-secondary-container` 或 `rounded-[5px]`（分段 toggle 漂移）
3. Tailwind arbitrary hex 颜色（warning，逐步收敛）
4. **`text-[Npx]` arbitrary 字号**（error → 用 `text-display/heading/title/body/label`）
5. **CSS 裸 `font-size: Npx`**（error → 用 `var(--text-*)`；`tokens.css` 与 `0.85em` 除外）
6. **壳层/浮层 `shadow-md|lg|xl|2xl`**（warning → 改 `FLAT_OVERLAY_PANEL_SHELL_CLASS` / `shadow-none`；见 `shellVisualTokens.ts`）
7. **壳层 CSS `box-shadow` 债务**（warning → `workspace.css` 侧栏、`panels.css` `.panel` 等）
8. **导航壳层 `bg-zen-paper`**（warning → `MAIN_SHELL_SURFACE_CLASS`；见 `shellVisualTokens.ts`）
9. **语义 accent R8**：`components/` / `pages/` / `styles/components/` 内 `zen-saffron`（warning → `accent-action*`）
10. **产品语义 Lucide**：`components/` / `pages/` 直接 import 已登记名（见 `PRODUCT_SEMANTIC_LUCIDE_NAMES` / `productIcons.ts`）（error → `PRODUCT_ICON.*`）

---

## 新增控件 checklist

1. 先查 `controlStyles.ts` 是否已有 token
2. 对话框 footer 用 `FLOATING_PANEL_DIALOG_FOOTER_CLASS` 或 `COMPACT_DIALOG_LAYOUT.actionRowEnd`
3. 环境页表单遵循 `environmentPanelNav.ts` spacing 真源
4. 补 `controlStyles.test.ts`；跑 `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
