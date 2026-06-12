# 调研：CSP-HARDEN（Q-CSP-1）— 生产 `style-src` 去 `unsafe-inline`（nonce + WaveSurfer）

> **状态**：已采纳（进入 Step 6a 编码）
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §1.7 Q-CSP-1 · §10.4 Step 6a–b
> **关联 spec**：[`csp-harden-v1.1-intent.md`](./csp-harden-v1.1-intent.md) · [`csp-harden-v1.1-plan.md`](./csp-harden-v1.1-plan.md) · [`csp-harden-v1.1-acceptance.md`](./csp-harden-v1.1-acceptance.md)
> **门禁**：未完成本文不得进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 桌面端（Tauri v2）生产包加载本地音频 → Editor 波形渲染、字体、各面板样式。安全审查（[`code-review-report-2026-06-06-full.md`](../../code-review-report-2026-06-06-full.md) Round 9 P1 / [`fix-status-2026-06-03.md`](../../code-review/fix-status-2026-06-03.md) A1）指出生产 CSP `style-src` 含 `'unsafe-inline'`，引入富文本/HTML 渲染前是潜在 XSS 面。 |
| 本仓现状 | `apps/desktop/src-tauri/tauri.conf.json` 生产 `csp`：`script-src: 'self'`（v1 已闭合）；但 `style-src` / `style-src-elem` / `style-src-attr` 均含 `'unsafe-inline'`。运行时 nonce 链路已就位但被 `unsafe-inline` 掩盖：`apps/desktop/index.html` probe `<style nonce="__TAURI_STYLE_NONCE__">`；`apps/desktop/src/utils/tauriStyleCspNonce.ts`（`readTauriStyleCspNonce`）；`apps/desktop/src/utils/waveSurferShadowCspNonce.ts`（`withWaveSurferCspNonce` / `applyWaveSurferShadowCspNonce`）；`apps/desktop/src/hooks/useProjectWaveformMount.ts` 已接入。守卫 `scripts/check-architecture-guard.mjs` 仅拦 `script-src` 的 `unsafe-inline`。 |
| 成功标准 | 生产 CSP 不含 `style-src` 系 `unsafe-inline`（`style-src-attr` 除外，见决策）；守卫自动拦截回归；Release 包 Editor 波形与全应用样式正常、DevTools Console 无 style CSP violation（H-CSP-1，6b/REL-1.1 手测）。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **框架自动 nonce/hash（采纳）** | Tauri v2 内建 CSP 注入 | 编译期对本地 JS 生成 `'sha256-..'` 入 `script-src`；运行时为 `<style>` 与外部 `<script src=http>` 生成 `'nonce-..'` 并写入 `style-src`/`script-src`；HTML 中 `__TAURI_STYLE_NONCE__` token 被替换为随机 nonce | [v2.tauri.app/security/csp](https://v2.tauri.app/security/csp)；源码 `crates/tauri-utils/src/html.rs` `inject_nonce_token`、`crates/tauri/src/manager/mod.rs` `replace_csp_nonce` |
| B | **静态 hash 全量样式** | 一般 Web CSP 实践 | 构建期对每段 inline 样式算 hash 写入 `style-src` | MDN CSP `style-src` |
| C | **CSS-in-JS 运行时 nonce 透传** | styled-components / emotion `nonce` | 运行时把 nonce 注入到库生成的 `<style>` | 各库 nonce option |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A | **高** | Tauri 编译期 hash + 运行时 nonce 全自动；index.html token 与 `readTauriStyleCspNonce` 已就位 | 无：本仓样式来源为 Tailwind 静态 CSS（外链 `<link>` 走 `'self'`）+ 字体外链 + WaveSurfer shadow `<style>`（已手动补 nonce） | 零额外构建步骤；无运行时开销 |
| B | 低 | — | inline 样式随构建 hash 变动；Tailwind/Vite 产物无需 | 维护成本高 |
| C | 低 | — | 本仓未用 CSS-in-JS（仅 WaveSurfer shadow，已用 cspNonce option 透传） | — |

**本仓已有可复用模块**（先列再决定是否扩展，**不新造第二套**）：

- `apps/desktop/index.html` — `<style id="rushi-tauri-style-csp-nonce" nonce="__TAURI_STYLE_NONCE__">` probe
- `apps/desktop/src/utils/tauriStyleCspNonce.ts` — `readTauriStyleCspNonce()` + token 常量（已有单测 `tauriStyleCspNonce.test.ts`）
- `apps/desktop/src/utils/waveSurferShadowCspNonce.ts` — `withWaveSurferCspNonce()`（创建期透传 `cspNonce`）+ `applyWaveSurferShadowCspNonce()`（创建后补 nonce）
- `apps/desktop/src/hooks/useProjectWaveformMount.ts` — 已两处接入
- `scripts/check-architecture-guard.mjs` — `checkTauriProductionCsp()`（仅扩展，不新建守卫）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **路线 A**：依赖 Tauri 自动 nonce/hash。生产 `style-src` 去 `'unsafe-inline'`，保留 `'self'` + `https://fonts.googleapis.com`，由 Tauri 追加 `'nonce-..'` + style hash。 |
| **删除生产 `style-src-elem`**（关键） | 源码确认 `replace_csp_nonce` 仅向 **`script-src`** 与 **`style-src`** 两个指令追加 nonce/hash，**不**写 `style-src-elem`。若保留独立 `style-src-elem` 且去 `unsafe-inline`，浏览器对 `<style>`/字体 `<link>` 用 `style-src-elem`（无 nonce）判定 → **生产全样式被拦截**。故删除该独立指令，元素样式回退到已拿到 nonce 的 `style-src`。 |
| 不做什么 | ① 不动 `script-src`（v1 已 `'self'`）；② **保留** `style-src-attr: 'unsafe-inline'`（React 行内 `style=`；Tauri nonce 不覆盖 attr，v1.2 再评估）；③ **保留** `devCsp` 的 `unsafe-inline`（Vite HMR）；④ 不引入富文本/HTML 注入 UI；⑤ 不新造 nonce 工具（复用既有）。 |
| 与 ADR / architecture 关系 | 对齐 [`release-packaging-audit-2026-06.md`](./release-packaging-audit-2026-06.md) §4（WaveSurfer cspNonce probe）；无新 ADR。 |
| 风险与 spike 项 | **R1**（高爆炸半径）：运行时 JS 注入且未走 Tauri nonce 的 `<style>` 会被拦——本仓仅 WaveSurfer shadow（已补 nonce）；第三方库若运行时注入裸 `<style>` 需 6b 全应用 smoke 暴露。**R2**：纯 nonce 行为只能在 Release 包 + DevTools 验证（H-CSP-1），非 vitest 可覆盖 → 列入 6b/REL-1.1 手测，6a 仅交付配置 + 守卫 + 自动门禁。 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Tauri 配置 | `apps/desktop/src-tauri/tauri.conf.json` | 生产 `style-src` 去 `unsafe-inline`；**删除**生产 `style-src-elem`；`style-src-attr` / `devCsp` 不变 |
| 守卫 | `scripts/check-architecture-guard.mjs` `checkTauriProductionCsp()` | 新增：生产 `style-src` 含 `unsafe-inline` → error；`style-src-elem` 一旦声明 → error；更新过时注释 |
| 测试 | 既有 `tauriStyleCspNonce.test.ts` / `waveSurferShadowCspNonce`（无新增逻辑，回归保持绿） | 回归 |
| 手测（6b/12） | `npm run release:postbuild-verify` + `release:waveform-probe`；Release `.app` DevTools H-CSP-1/2 | 验证 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文
- [x] 用户或路线图确认可进入编码 → 路线图 Step 6a 标「调研 ✅」
- [x] **CSP-HARDEN 整体签收**：6a/6b 自动门禁 ✅ · H-CSP-1/2 mac 手测 ✅（2026-06-12）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-12 | 初版；读 Tauri 源码确认 nonce 仅注入 `script-src`/`style-src`，定 `style-src-elem` 删除策略 |
