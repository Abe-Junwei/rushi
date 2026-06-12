# Spec(plan): CSP-HARDEN Step 6a（C-1）

> **Research brief**：[`csp-harden-v1.1-research.md`](./csp-harden-v1.1-research.md)
> **Intent**：[`csp-harden-v1.1-intent.md`](./csp-harden-v1.1-intent.md)
> **Acceptance**：[`csp-harden-v1.1-acceptance.md`](./csp-harden-v1.1-acceptance.md)

## 目标

生产 CSP `style-src` 去 `unsafe-inline`，删除独立 `style-src-elem`，升级架构守卫拦截回归。

## 受影响代码地图

1. `apps/desktop/src-tauri/tauri.conf.json` — 生产 `app.security.csp`
2. `scripts/check-architecture-guard.mjs` — `checkTauriProductionCsp()`

## 改动方案

### 1. `tauri.conf.json`（生产 `csp`）

- `style-src`：`["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]` → `["'self'", "https://fonts.googleapis.com"]`
- `style-src-elem`：**整行删除**（回退到 `style-src`；Tauri nonce 仅注入 `style-src`，保留独立 elem 指令会拦截全部元素样式 —— 见 research §4）
- `style-src-attr`：`"'unsafe-inline'"` **不变**
- `script-src` / `connect-src` / `img-src` / `media-src` / `font-src` / `default-src`：**不变**
- `devCsp`：**不变**

### 2. `check-architecture-guard.mjs` `checkTauriProductionCsp()`

- 现仅检 `script-src`。新增：`style-src` 含 `'unsafe-inline'` → error；`style-src-elem` **一旦声明**（`'style-src-elem' in csp`，无论是否含 `unsafe-inline`）→ error（Tauri 不向该指令注 nonce，声明即拦 nonce'd 样式）。
- `style-src-attr` **不检**（React 行内样式合法保留）。
- 更新过时注释（移除「v1.1 硬化时再改」一段，改述当前策略）。

## 约束

- 仅改上述 2 文件；不动 nonce 运行时代码（已就位）。
- `style-src-attr` 与 `devCsp` 的 `unsafe-inline` 保留，守卫不得误伤。
- 守卫仅针对生产 `csp`（`conf.app.security.csp`），不检 `devCsp`。

## 验收标准

- [ ] `npm run typecheck` 通过
- [ ] `npm run test` 通过（含既有 `tauriStyleCspNonce.test.ts`）
- [ ] `node scripts/check-architecture-guard.mjs` 无 error
- [ ] 守卫负向自测：临时给 `style-src` 加回 `unsafe-inline` → 守卫报 error（验证后还原）
- [ ] 6b/REL-1.1 手测 H-CSP-1/2（Release 包，本片不阻塞）

## TDD 备注

CSP 自动 nonce 行为属 Release 运行时，vitest 无法覆盖（research §4 R2）；本片以守卫负向自测 + 既有 nonce 单测回归作为可验证闭环，端到端样式正确性由 6b H-CSP-1 手测兜底。
