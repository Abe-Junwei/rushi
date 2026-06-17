# Acceptance：Tailwind CSS v4 彻底迁移

> **Plan**：[`tailwind-v4-full-migration-plan.md`](./tailwind-v4-full-migration-plan.md)

---

## 已签收

- [x] **策略 A**（2026-06-17）：v4 默认 `rounded-sm`=4px、`shadow-sm`；`@theme` 不 pin

---

## 机器闸门（每薄片）

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
cd apps/desktop && npm run build
```

---

## T4-1

- [x] `shell.css` reset 在 `@layer base`
- [x] utilities 在 `@layer utilities`
- [x] `button.bg-zen-saffron` → `rgb(197, 138, 67)`

## T4-2

- [x] `tokens.css` 覆盖原 config 全部 color
- [x] `@theme` 无裸 hex；**无** `--radius-sm` / `--shadow-sm` 覆写（策略 A）
- [x] `tailwind.config.js` 无 `theme.extend.colors`

## T4-3

- [x] 无 `@config`（或 animation-only  documented 例外）
- [x] `OVERLAY_SCRIM_*` 单点常量

## T4-4

- [x] `desktop-tailwind-v4.md` + README 索引
- [x] guard 禁 `@tailwind utilities`

---

## 手测 H1–H5

| # | 路径 | 预期 |
|---|------|------|
| H1 | 欢迎页 | 双栏正常；saffron CTA |
| H2 | 设置浮层 | 极淡遮罩、无 blur |
| H3 | 热词与记忆 | 按钮/子 nav 正常 |
| H4 | 编辑页侧栏折叠 | 无 layout 异常 |
| H5 | 确认 dialog | 遮罩一致；按钮 h-8 |
