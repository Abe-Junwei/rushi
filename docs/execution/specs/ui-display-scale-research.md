# 调研：界面 UI 缩放（ui-display-scale）

> **状态**：已采纳  
> **关联 spec**：本文即 intent + acceptance 签收基线  
> **门禁**：见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 偏好设置中调大界面；当前 12px body / 11px label 为**最小基准**；放大时按钮、间距、图标等 chrome 一并适配 |
| 本仓现状 | 字号真源 [`tokens.css`](../../../apps/desktop/src/styles/tokens.css) `--text-*` 固定 px；控件 [`controlStyles.ts`](../../../apps/desktop/src/config/controlStyles.ts) 使用 `h-8` + `min-h-[32px]`；已有**语段**字号 `rushi.p1.transcriptFontPx`（编辑器内容，非全局 UI） |
| 成功标准 | 偏好选 125% 后欢迎页/环境页/`text-body` 与标准按钮高度明显变大；刷新后保持；语段字号控件仍独立 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| A | WebView / 浏览器 zoom | VS Code 类 | 整页 CSS 像素比缩放 | — |
| B | `--display-scale` × token | zudo-tauri | 根 CSS 变量 + `calc(Npx * var(--scale))`；CM6 等 JS 侧乘系数；离散档 | [display-scale-system](https://takazudomodular.com/pj/zudo-tauri/docs/recipes/display-scale-system/) |
| C | `html` font-size + rem | Airbnb Font Scaling、a11y 通用 | rem 全文缩放 | [Airbnb 文](https://medium.com/airbnb-engineering/rethinking-text-resizing-on-web-1047b12d2881) |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 |
|------|--------|----------------|-------------------|
| A | 低 | 用户心智（100% 基准） | 破坏波形/拖拽 `getBoundingClientRect`、CM6 度量；难持久化 |
| B | 高 | CSS 变量真源链、离散档、localStorage 偏好 | 须同步 programmatic UI（CM6 语段字号保持独立） |
| C | 中 | rem 布局随根字号放大 | 本仓 `--text-*` 为 px，须与 B 组合 |

**本仓已有可复用模块**：

- [`officeShellTheme.ts`](../../../apps/desktop/src/services/ui/officeShellTheme.ts) — init / apply / subscribe / localStorage 模式
- [`tokens.css`](../../../apps/desktop/src/styles/tokens.css) + [`zen-tailwind.css`](../../../apps/desktop/src/zen-tailwind.css) — type scale 真源
- [`EnvAppearanceSections.tsx`](../../../apps/desktop/src/components/EnvAppearanceSections.tsx) — 外观偏好入口

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **B + 有限 rem 根缩放**：`--rushi-ui-scale`（1 / 1.1 / 1.25 / 1.5）；`--text-*` 用 `calc`；`html { font-size: calc(16px * var(--rushi-ui-scale)) }` |
| 不做什么 | 不用 `zoom` / `transform: scale`；不合并语段正文字号；不改写已存波形高度 px；首版无 Ctrl± 拦截；无 &lt;100% |
| 与 ADR / architecture 关系 | 延续 [`desktop-tailwind-v4.md`](../../architecture/desktop-tailwind-v4.md) token 链；1px 边框不乘 scale |
| 风险 | 150% 时部分面板换行；arbitrary px 漏网 — 首版只修 controlStyles / lucideIconSpec |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| UI service | `services/ui/uiDisplayScale.ts` | 读写 / apply / subscribe |
| 启动 | `main.tsx` | `initUiDisplayScale()` |
| CSS | `tokens.css`, `zen-tailwind.css`, `shell.css` | scale 变量 + calc |
| Chrome | `controlStyles.ts`, `lucideIconSpec.ts` | arbitrary px → rem |
| 偏好 UI | `EnvAppearanceSections.tsx` | 界面缩放选择器 |
| 测试 | `uiDisplayScale.test.ts`, `EnvPreferencesPanel.test.tsx` | 单测 + 控件存在 |

---

## 6. 签收 / Acceptance

- [x] 调研 brief 完成
- [x] 默认 100% 与现网一致
- [x] 125% / 150% 下 `--text-body` 与按钮高度同比增大
- [x] `rushi.ui-scale.v1` 持久化
- [x] 语段正文字号与界面缩放解耦

**手测清单**

1. 设置 → 偏好 → 外观 → 界面缩放 100% → 125% → 150%
2. 欢迎页、环境页、转写工具条肉眼变大
3. 重启应用后档位保持
4. 「语段正文字号」单独改 18px，界面缩放不变

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 初版 — 采纳 B+C 混合方案 |
