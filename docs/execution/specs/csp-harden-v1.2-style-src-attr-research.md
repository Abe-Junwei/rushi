# 调研：CSP-HARDEN v1.2 — 生产 `style-src-attr` 去 `unsafe-inline`

> **状态**：规划门禁（待用户确认进入编码）
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §1.7 Q-CSP-1 · §10.5 v1.2 候选
> **前置**：[`csp-harden-v1.1-research.md`](./csp-harden-v1.1-research.md) Step 6a–6b ✅
> **关联 spec**：`csp-harden-v1.2-style-src-attr-{intent,plan,acceptance}.md`
> **门禁**：未完成本文不得进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 桌面端 Tauri v2 生产包；v1.1 已硬化 `<style>` / 外链 CSS（`style-src` nonce），但 **HTML 元素行内样式** 仍允许任意 inline。路线图要求「引入富文本/HTML 渲染前须完成 hardened CSP」。 |
| 本仓现状 | `tauri.conf.json` 生产 CSP 仍含 `"style-src-attr": "'unsafe-inline'"`。全仓 **~35 处** React `style={{…}}`（25 文件）+ **~15 处** 生产路径 `element.style.*` / `setProperty`（波形、主题、toast 布局等）。v1.1 已就位：`readTauriStyleCspNonce()`、`waveSurferShadowCspNonce`、守卫 `checkTauriProductionCsp()`（仅检 `style-src` / 禁 `style-src-elem`）。 |
| 成功标准 | 生产 CSP **不含** `style-src-attr: 'unsafe-inline'`（删除该键或显式 `'none'`）；Release 包全应用无 `style-src-attr` CSP violation；守卫拦截 React `style={{` 与 `.style.` 回归；H-CSP-3～7 手测签收。 |

### 1.1 CSP 机制（决策依据）

| 指令 | 管什么 | v1.1 后生产态 |
|------|--------|---------------|
| `style-src` | `<style>`、`<link rel=stylesheet>`、Tauri 注入 nonce | `'self'` + fonts + **runtime nonce** ✅ |
| `style-src-attr` | `style="…"` 属性、React `style={{}}`、`setAttribute('style')`、`el.style.cssText` | **`'unsafe-inline'`** ← v1.2 目标去掉 |

> **关键**：去掉 `style-src-attr` 的 `unsafe-inline` 后，**HTML 内联样式属性**（`style="…"`、React `style={{}}`、`setAttribute('style')`、`cssText`）被拦——须迁 React JSX 内联样式。
>
> **⚠ 更正（2026-07-09，见 [`waveform-csp-dynamic-style-performance-research.md`](./waveform-csp-dynamic-style-performance-research.md) §2 CSP probe 实测）**：本行早前称「`root.style.setProperty('--x', v)` / `element.style.x = …` 同样被拦」为**错误**。**逐属性 DOM 写入**（`element.style.transform = …`、`element.style.setProperty('--x', v)`）**不经 HTML parser，永不被 `style-src`/`style-src-attr` 拦**（probe 实证：`style-src 'self'` 下无 violation）。因此 `officeAccentTheme.ts`、`waveformViewportStretch.ts` 等的 `setProperty` **并非因 CSP 必须迁移**；高频几何路径反而应回归 `element.style`（见 single-clock 性能调研）。被 CSP 拦的只有：内联 `style` 属性、`setAttribute('style')`、`cssText`、以及 **nonce-less 动态 `<style>` 元素**（`style-src-elem`）。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 机制 | 链接 |
|---|------|------|------|------|
| A | **静态 CSS + class/data 属性** | Tailwind、设计系统 | 动态态用有限 class 切换；连续值用 `@property` + `attr()`（支持有限） | MDN `style-src-attr` |
| B | **Nonce `<style>` 运行时规则表** | Strict CSP + React 社区实践 | 动态规则写入带 `nonce` 的 `<style id=…>`，`textContent` 更新；走 `style-src` 而非 `style-src-attr` | 本仓 v1.1 WaveSurfer 先例 |
| C | **Constructable Stylesheets** | `document.adoptedStyleSheets` | `new CSSStyleSheet()` + `replaceSync()` | MDN CSSStyleSheet；**须 WebView spike** |
| D | **保留 attr 例外** | 多数 Electron/React 应用 | 长期保留 `style-src-attr: unsafe-inline` | 当前 v1.1 态 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 备注 |
|------|--------|----------|------|------|
| A | **高** | Tailwind 静态层；`officeAccentThemes` 有限 preset → 静态 CSS | 连续像素定位（波形、虚拟列表）不适用 | 主题 / 进度 / 固定高度优先 |
| B | **高** | `readTauriStyleCspNonce()` + WaveSurfer shadow 模式 | 高频更新须防抖/按 scope 合并 | **默认动态真源** |
| C | 中 | — | Tauri WKWebView / WebView2 行为未验 | **Step 0 spike 可选**；不阻塞主方案 |
| D | — | 零成本 | 不满足路线图 v1.2 安全闭环 | 不采纳 |

**本仓可复用（禁止第二套 nonce 工具）**

- `apps/desktop/src/utils/tauriStyleCspNonce.ts`
- `apps/desktop/src/utils/waveSurferShadowCspNonce.ts`
- `scripts/check-architecture-guard.mjs` → `checkTauriProductionCsp()`

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A + B 组合**：有限离散态 → 静态 CSS / class；连续动态态 → **单一** `cspNonceStyleRegistry`（nonce `<style>` scope 表） |
| 生产 CSP | **删除** `style-src-attr` 键（回退 `style-src`，与 nonce 一致）或显式 `"style-src-attr": "'none'"`；**仅改生产 `csp`** |
| devCsp | **保留** `style-src-attr: 'unsafe-inline'`（或维持 dev 全链路可开发）；守卫**只检生产** |
| 不做什么 | 不改 `script-src` / 生产 `style-src`；不引入富文本 UI；不新造第二套 nonce 读取；不与 DELIV/BATCH 大 UI 同 PR |
| 风险 | **R1 波形 resize 回归**（imperative width 最多）；**R2 虚拟列表 scroll 跳变**；**R3 accent 主题色**；**R4 仅 dev 可测** → Release H-CSP 手测 |
| Spike | Step 0（≤0.5d）：Release 包临时删 `style-src-attr`，DevTools 扫主路径 violation 清单（可选，降风险） |

---

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| 基础设施 | `apps/desktop/src/utils/cspNonceStyleRegistry.ts` | scope id → nonce `<style>` upsert/remove |
| 基础设施 | `apps/desktop/src/utils/cspLayoutProps.ts` | `data-csp-layout` + registry 绑定 helper（可选薄封装） |
| 主题 | `officeAccentTheme.ts` + `styles/office-accent-themes.css` | preset → 静态 CSS，删 `root.style.setProperty` |
| 波形 | `waveformViewportStretch.ts`、`waveformSurferProgressCoverage.ts`、`useProjectWaveformMount.ts` | registry 或 CSS 变量经 registry 写 `:root` 规则 |
| UI 组件 | 见 plan §清单 | 去 `style={{` |
| Tauri | `tauri.conf.json` | 生产去 `style-src-attr`；devCsp 加 attr 例外 |
| 守卫 | `check-architecture-guard.mjs` | 生产禁止 attr unsafe-inline；src 禁 `style={{` / `.style.`（迁移期 allowlist） |
| 测试 | `cspNonceStyleRegistry.test.ts` + 既有波形/主题单测 | 回归 |

---

## 6. 签收

- [x] 调研 brief 完成（2026-06-18）
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-18 | 初版：全仓 style 盘点 + A/B 组合决策 |
