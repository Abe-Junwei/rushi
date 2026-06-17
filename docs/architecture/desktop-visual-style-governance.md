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
| **主壳层 / 扁平浮层** | `apps/desktop/src/config/shellVisualTokens.ts` + `tokens.css` `--main-shell-*` / `--overlay-panel-*` | 双 accent、无 shadow 壳层串 |

**禁止**：业务组件内复制 `rounded-md border border-notion-border bg-notion-bg` 等 ad-hoc 控件串；禁止 `bg-[#...]`；禁止 `text-[Npx]` 与 CSS 裸 `font-size: Npx`（用 `text-*` 工具类或 `var(--text-*)`；行内 `0.85em` 相对值除外）；**禁止**在壳层/浮层壳使用 `shadow-md` 及以上（须 `shadow-none` + `border-notion-border`）。

---

## 主壳层与双 accent（Round 1+）

| Token / 常量 | 含义 |
|--------------|------|
| `--main-shell-bg` / `MAIN_SHELL_SURFACE_CLASS.pageBg` | Welcome · Hub · Editor 主区白底 |
| `--main-shell-sidebar-bg` | 侧栏、波形 tier 外壳、**minimap 条（R2 接线）** |
| `--main-shell-border` | 壳层 hairline（侧栏右边线等） |
| `--content-decoration-paper` | 仅内容装饰；**禁止**导航壳 |
| `--accent-edit`（`zen-indigo`） | 语段/波形 **编辑选中** |
| `--accent-action`（`zen-saffron`） | CTA / 进度 / 播放头强调 |
| `FLAT_OVERLAY_PANEL_SHELL_CLASS` | 对话框 / 菜单 / Toast 壳：`rounded-lg border … shadow-none` |
| `--shell-elevation-shadow: none` | 全局扁平 elevation 声明 |

**R7 UI 债务（守卫 warning）**：已全部接线 — 见 `SHELL_SURFACE_MIGRATION_MAP` 与 `shellVisualTokens.ts`。

---

## 控件约定（Notion Zen）

- **标准按钮**：`h-8` · `rounded-sm` (4px) · `text-[12px]` semibold · `shadow-none`
- **Prominent CTA**：`h-10` · 仍 `rounded-sm` · `text-sm`
- **输入**：`CONTROL_TEXT_INPUT` / `CONTROL_SELECT` / `CONTROL_TEXTAREA`（须含 `box-border`；portal 对话框不在 `.workspace` 内）
- **图标 ghost**：`CONTROL_BTN_ICON_GHOST`（28px 方块，Hub / 历史 / 顶栏）
- **分段 toggle**：`envSegmentedToggleTrackClass` + `envSegmentedToggleBtnClass`（compact 用于对话框）

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

---

## 新增控件 checklist

1. 先查 `controlStyles.ts` 是否已有 token
2. 对话框 footer 用 `FLOATING_PANEL_DIALOG_FOOTER_CLASS` 或 `COMPACT_DIALOG_LAYOUT.actionRowEnd`
3. 环境页表单遵循 `environmentPanelNav.ts` spacing 真源
4. 补 `controlStyles.test.ts`；跑 `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
