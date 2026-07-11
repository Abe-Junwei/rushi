# 调研：波形高频动态样式性能根因与 CSP 直写回归

> **状态**：调研完成（待 plan/acceptance 定稿 → 实施）
> **关联**：[`waveform-playhead-single-clock-research.md`](./waveform-playhead-single-clock-research.md)（时钟真源，终态）、[`csp-harden-v1.2-style-src-attr-research.md`](./csp-harden-v1.2-style-src-attr-research.md)（本调研纠正其一处错误断言）、[`../architecture/desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)
> **门禁**：`.cursor/rules/feature-research-gate.mdc`

## 0. 一句话结论

播放头「一卡一卡」、点击语段「全链路慢」的根因**不是**删了外推，而是 **CSP 硬化 v1.2 把本该用 `element.style.*`（CSP 合法）的高频几何写入，错误地改成了每帧重写 nonce `<style>.textContent`（触发全文档 style recalc）**。正解是高频路径回归 `element.style` 直写，与 WaveSurfer v7 / Peaks.js 完全同构。

## 1. 问题陈述

- **用户场景**：Editor 波形区，播放时播放头步进不平滑；按空格续播往前卡一小段；点击语段后播放头定位 / 语段渲染 / 一切交互反应慢。
- **本仓现状（链路透 + 文件路径）**：
  - 播放头写入：[`WaveformViewportPlayhead.tsx`](../../../apps/desktop/src/components/WaveformViewportPlayhead.tsx) `writePosition` → `setCspLayoutRules(el, { transform })`。
  - band / ruler：[`WaveformSegmentBandCanvas.tsx`](../../../apps/desktop/src/components/WaveformSegmentBandCanvas.tsx)、[`WaveformTimeRulerCanvas.tsx`](../../../apps/desktop/src/components/WaveformTimeRulerCanvas.tsx) 的 `left/width/height` → `setCspLayoutRules`。
  - `setCspLayoutRules`（[`cspElementLayout.ts`](../../../apps/desktop/src/utils/cspElementLayout.ts)）→ `upsertCspScopeRules`（[`cspNonceStyleRegistry.ts`](../../../apps/desktop/src/utils/cspNonceStyleRegistry.ts)）→ **每次改 `<style>.textContent`**（属性选择器规则 `[data-csp-layout-id="…"] { … }`）。

## 2. 实测证据（本轮亲测）

| 测法 | 结果 |
|---|---|
| e2e `desktop-selection-latency-profile`（197 段） | selection 本身 26–82ms，非最大瓶颈 |
| 浏览器 probe：4 次可见语段点击 | 捕获 **1123 次** `HTMLStyleElement.textContent` 写入，全部 `data-csp-layout-id` 规则 |
| microbench：连续更新 | `<style>.textContent` ≈ `el.style.transform` 的 **~10×**（压力下 1.69ms vs 0.16ms/次） |
| **CSP probe（`style-src 'self'`，无 unsafe-inline）** | `el.style.transform=` ✅ 无 violation；`el.style.setProperty` ✅ 无 violation；`setAttribute('style')` ❌ style-src-attr 拦；nonce-less `<style>.textContent` ❌ style-src-elem 拦；`adoptedStyleSheets`+`replaceSync` ✅ 无 violation |

> **关键**：CSP probe 证明 `element.style.*`（direct DOM property）**永不被 CSP 拦**（不经 HTML parser）。被拦的只有 `style="…"` attribute、`setAttribute('style')`、`cssText`、以及 **nonce-less 动态 `<style>` 元素**。

## 3. 业内对照（≥2 条成熟路线）

| 产品 | 播放头/进度写入 | 高频动态样式手段 | 与 Rushi 约束冲突 |
|---|---|---|---|
| **WaveSurfer v7**（本仓 `node_modules`，实证真源） | `renderer.js` 每帧 `cursor.style.left` / `cursor.style.transform` / `canvasWrapper.style.clipPath` / `progressWrapper.style.width`（`node_modules/wavesurfer.js/dist/renderer.js:637-641`） | **direct `el.style.*`** | 无——且它在 Rushi 生产 CSP 下正常工作（波形能显示/播放），即 direct style 未被拦 |
| **Peaks.js**（bbc） | rAF 每帧读 `audio.currentTime`，canvas 上更新 playhead x 坐标（issue #205 / PR #206-207） | canvas 重绘 + Konva | 无 |
| **MDN / W3C CSP WG / morphdom #287** | — | `el.style.prop=` / `setProperty` 恒合法；大规模用 `adoptedStyleSheets` constructable stylesheet | `insertRule`/`cssText` 按 CSP3 2025 draft **gated on `unsafe-eval`** → 应避免 |

## 4. 可复用评估表

| 路线 | 复用度 | 依赖 | 与 Rushi CSP 约束 | 峰值开销 |
|---|---|---|---|---|
| **A. `element.style.*` 直写（选定）** | 高 | 无 | ✅ 合法（probe 实证） | 零 style recalc，GPU 合成 |
| B. `adoptedStyleSheets` + `replaceSync` | 中 | constructable stylesheet | ✅ 合法 | 低，但每次 replaceSync 仍 re-parse 该表 |
| C. CSSOM `insertRule` + `rule.style` | 低 | — | ⚠ `insertRule` 可能需 `unsafe-eval` | 中，且有合规风险 |
| D. 现状 nonce `<style>.textContent` | — | nonce registry | ✅ 合法但 | **每帧全文档 recalc** ← 根因 |

## 5. 决策

- **选定 A**：波形高频几何值（playhead transform、band/ruler `left/width/height`）回归 `element.style.*` 直写。
- **单点封装**：新增 `setDirectLayoutStyle`（`cspElementLayout.ts`），成为 src 中**唯一**允许 `el.style` 的封装点（守卫 allowlist），复用现有 kebab/单位格式化；组件不散落 `.style.`。
- **registry 保留低频**：`cspNonceStyleRegistry` / `setCspLayoutRules` 仍服务**需要选择器/伪类/媒体查询**的动态 `<style>` 场景（这类确实会被 style-src-elem 拦，需 nonce），但**退出所有每帧路径**。
- **不做什么**：
  - 不恢复播放头外推（single-clock 决策不变）。
  - 不引入 `insertRule`/`cssText`（CSP3 合规风险）。
  - 不改生产 CSP 配置（`style-src` 保持去 unsafe-inline）。
  - 不新建「dynamic style engine + scheduler」大基础设施（相对开源过度工程）。
- **纠错**：`csp-harden-v1.2-style-src-attr-research.md` 中「`root.style.setProperty('--x', v)` 同样被拦」为**错误断言**，本轮 probe 证伪；须留档更正，并放开架构守卫对 direct style 的一刀切封禁。

## 6. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| 基础设施 | `utils/cspElementLayout.ts` | 新增 `setDirectLayoutStyle`（direct `el.style`，唯一封装点） |
| 高频组件 | `WaveformViewportPlayhead.tsx`、`WaveformSegmentBandCanvas.tsx`、`WaveformTimeRulerCanvas.tsx`、`utils/waveformSegmentBandCanvasScroll.ts` | `setCspLayoutRules` → `setDirectLayoutStyle` |
| 守卫 | `scripts/check-architecture-guard.mjs` | `.style.` 封禁改为 allowlist（封装点例外）；仍禁 `style={{}}` / `setAttribute('style')` / `cssText` |
| 纠错 | `csp-harden-v1.2-style-src-attr-research.md` | 更正 setProperty 断言 |
| 播放语义 | `useWaveformSegmentPlaybackControls.ts` | 续播时 raw media time 在段内 → 不回退 seek |
| 文档 | `architecture/desktop-waveform-engine.md` | 记录高频 direct style + registry 边界 |

## 7. 落地前必测

- Release 包（macOS WKWebView / Windows WebView2）实测 `el.style.transform` 无 CSP violation（H-CSP 手测）。dev CSP 有 style-src-attr unsafe-inline，测不出，须 Release 验证。
