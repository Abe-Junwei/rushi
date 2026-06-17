# Research：Tailwind CSS v4 彻底迁移

> **Plan**：[`tailwind-v4-full-migration-plan.md`](./tailwind-v4-full-migration-plan.md)

---

## 1. 问题陈述

Dependabot 将 Tailwind 3.4 → 4.3 后，旧 `@tailwind utilities` + `@config` 桥接导致主题类（`bg-zen-saffron`、`rounded-sm` 等）未生成；紧急修复（`8f04e35`）用 **未分层 utilities** 绕过 `shell.css` button reset 级联反超。

**成功标准**：无 `@config` 时主题类仍生成；`.bg-zen-saffron` 在 `<button>` 上生效；guard + tests 通过。

## 2. 业内对照

| 路线 | 说明 |
|------|------|
| Tailwind v4 `@theme` + CSS-first | 官方迁移路径；`@import "tailwindcss"` 拆分 theme/utilities |
| `@config` legacy bridge | 过渡方案；本仓目标移除 |

## 3. 决策

- **选定**：`tokens.css` hex 真源 → `@theme` → `layer(utilities)`；`shell.css` reset → `@layer base`
- **策略 A**：接受 v4 默认 `rounded-sm` / `shadow-sm`
- **不做什么**：不启用 preflight；本片不强制 `@tailwindcss/vite`

## 4. 落位

| 层 | 文件 |
|----|------|
| CSS 入口 | `apps/desktop/src/zen-tailwind.css` |
| Hex 真源 | `apps/desktop/src/styles/tokens.css` |
| 壳层 reset | `apps/desktop/src/styles/shell.css` |
| TS 对账 | `apps/desktop/src/config/tokens.ts` |
| 遮罩常量 | `apps/desktop/src/config/overlayStyles.ts` |
| Guard | `scripts/check-architecture-guard.mjs` |
