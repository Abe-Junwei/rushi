# 桌面端 Tailwind CSS v4

> **实施**：[`tailwind-v4-full-migration-plan.md`](../execution/specs/tailwind-v4-full-migration-plan.md)

---

## Token 真源链

```
DESIGN.md → tokens.css (:root hex) → @theme (zen-tailwind.css) → utilities → tokens.ts（TS 对账）
```

## 级联（终态）

- `@layer theme` — `@theme` 映射（`zen-tailwind.css`）
- `@layer base` — `shell.css` button reset
- `@layer utilities` — Tailwind utilities（`layer(utilities)`）
- **禁止** `@config`、未分层全局规则压过 utilities

## v4 尺度 — 策略 A ✅（2026-06-17）

| Token | 决策 |
|-------|------|
| `rounded-sm` | 接受 v4 默认 **4px**（与 DESIGN / `controlStyles` 一致） |
| `shadow-sm` | 接受 v4 默认；过重则 follow-up pin |
| 模态遮罩 | `bg-[var(--overlay-scrim-bg)]`（真源 `tokens.css`），无 blur |

## 结构 CSS 真源

`.workspace-shell-fixed` · `.workspace-shell-collapsible` · `.welcome-home-stage` · `--workspace-home-stage-offset-top`

## 遮罩

`OVERLAY_SCRIM_*`（`overlayStyles.ts`）
