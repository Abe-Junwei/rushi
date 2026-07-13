# 调研：Obsidian 式主题色（自由取色）

> **状态**：已采纳  
> **关联**：设置 → 偏好 → 主题色 UX；落地见 `officeAccentTheme` / `deriveAccentRamp`  
> **门禁**：本文签收后进入编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户希望像 Obsidian Appearance → Accent color 一样，用色圆 + 系统取色器选任意强调色，并可一键重置到品牌色。 |
| 本仓现状 | Fluent 命名预设下拉（`EnvPanelSelect`）→ `rushi.office-accent-theme.v1`（preset id）→ `data-accent-theme` → [`office-accent-tokens.css`](../../../apps/desktop/src/styles/office-accent-tokens.css) 静态表 remap `--zen-saffron*` / `--accent-action*`。入口：[`EnvAppearanceSections.tsx`](../../../apps/desktop/src/components/EnvAppearanceSections.tsx)、[`officeAccentTheme.ts`](../../../apps/desktop/src/services/ui/officeAccentTheme.ts)。 |
| 成功标准 | 取任意色后 CTA / 语段选中 / 播放头即时跟色；重置回 `#C58A43`；刷新保留；旧 v1 preset id 启动迁移到 hex。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | HSL 三元组 + CSS 派生 | Obsidian | 存 `--accent-h/s/l`；UI 色圆 + 取色器 + 重置；shade 用 `hsl()` / calc | [Obsidian Colors](https://docs.obsidian.md/Reference/CSS+variables/Foundations/Colors) |
| B | 离散 accent 预设表 | Fluent / 本仓现状 | 命名色板 + CSS attribute 选择器 | 本仓 `officeAccentThemes.ts` + `office-accent-tokens.css` |
| C | 单 hex + JS 派生 ramp | 多数桌面设置页 | `<input type="color">` 存 `#RRGGBB`；运行时算 mid/deep/tint 写 CSS 变量 | MDN `input type=color` |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A | 中 | UX 与 `--accent-h/s/l` 命名 | 现网大量 `color-mix` / canvas 读 **hex** token；纯 HSL 要改消费者 | 低 |
| B | 高（现状） | 完整 token 链、profile、波形订阅 | 无法满足「任意色」 | — |
| C | 高 | 复用现有变量名（`--zen-saffron*` / `--accent-action*`）；`<input type="color">` 无新依赖 | 需迁移 v1 id；派生算法与手调 Fluent 表不完全一致 | 低 |

**本仓已有可复用模块**：

- `officeAccentTheme` 订阅 / `subscribeAppAppearance` 波形重绘
- `BRAND_OFFICE_ACCENT` 与 tokens.css 默认藏红花
- Profile `editor.accent_theme` 导入导出（须扩 `accent_color`）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **C + A 的命名对齐**：存 `#RRGGBB`（v2）；JS `deriveAccentRamp` 写现有 hex 变量；同步写 `--accent-h/s/l`；UI 色圆 + 重置 |
| 不做什么 | 不引入第三方取色器；不按 light/dark 分存 accent；不改 success/cinnabar/status-warn；不做预设色圆横排 |
| 与 ADR / architecture 关系 | 仍走 accent-action 链；语义状态色固定（见 CONTEXT / visual governance） |
| 风险与 spike 项 | 极浅色 accent 时白字 CTA 对比度不足（与现预设同策略，后续单开）；低彩度时 waveform in-selection 可能偏淡（原 indigo CSS 特例不再按 id 保留，靠 color-mix 默认） |

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 纯函数 | `utils/deriveAccentRamp.ts` | 新建 |
| 服务 | `services/ui/officeAccentTheme.ts` | v2 hex + apply/reset/migrate |
| 配置 | `config/officeAccentThemes.ts` | 保留 preset 表作迁移查表 |
| UI | `EnvAppearanceSections.tsx` | 色圆 + 重置 |
| CSS | `office-accent-tokens.css` | 删 preset / swatch 运行时块 |
| Profile | `profileContract.ts` | `accent_color` + 兼容旧 id |
| 测试 | derive / officeAccent / EnvPreferencesPanel | 更新 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] 用户选定方案 2（自由取色）可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 初版；采纳 hex 存储 + JS 派生 |
