# Plan：Tailwind CSS v4 彻底迁移

> **Research**：[`tailwind-v4-full-migration-research.md`](./tailwind-v4-full-migration-research.md)  
> **Acceptance**：[`tailwind-v4-full-migration-acceptance.md`](./tailwind-v4-full-migration-acceptance.md)  
> **Architecture**：[`docs/architecture/desktop-tailwind-v4.md`](../../architecture/desktop-tailwind-v4.md)  
> **基线**：`8f04e35`（`@config` + utilities 未分层）

---

## 已签收决策

| 项 | 结论 | 日期 |
|----|------|------|
| **v4 尺度策略** | **策略 A**：接受 v4 默认 `rounded-sm`（4px）与 `shadow-sm`；`@theme` **不** pin radius/shadow | 2026-06-17 |

---

## 1. 目标

1. `@theme` ← `tokens.css`；移除 JS config 中的 colors
2. utilities `@layer utilities`；shell reset `@layer base`
3. `OVERLAY_SCRIM_*` 单点常量
4. guard + architecture 防复发

**非目标**：preflight、全站重设计、本片强制 `@tailwindcss/vite`

---

## 2. 四轮薄片

| 轮次 | 内容 | 验证 |
|------|------|------|
| **T4-1** | `shell.css` → `@layer base`；utilities → `layer(utilities)` | CDP button saffron bg |
| **T4-2** | `tokens.css` 对账 + `@theme`（仅 color 映射，**策略 A 不 pin scale**）；删 config colors | build 含 `.bg-zen-saffron` |
| **T4-3** | 去 `@config`；`overlayStyles.ts`；统一 `BlockingProgressCard` | 无 `@config` |
| **T4-4** | `desktop-tailwind-v4.md`、guard、AGENTS 索引；手测 H1–H5 | acceptance 全勾 |

依赖：T4-1 → T4-2 → T4-3 → T4-4

---

## 3. T4-2 `@theme`（策略 A）

```css
@theme {
  --color-zen-saffron: var(--zen-saffron);
  --color-notion-bg: var(--notion-bg);
  /* …全部 color 映射 var(--*)，禁止裸 hex */
  /* 策略 A：不定义 --radius-sm / --shadow-sm */
}
```

阴影若 H2/H5 手测仍偏重 → **follow-up** 单点 pin，不在 T4-2 预防性覆写。

---

## 4. 每轮闸门

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
cd apps/desktop && npm run build
```

回滚：每轮独立 commit；T4-3 前 tag `pre-tailwind-v4-native`。
