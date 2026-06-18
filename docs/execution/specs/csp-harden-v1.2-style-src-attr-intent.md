# Spec(intent): CSP-HARDEN v1.2 — `style-src-attr` 去 inline

> **Research brief**：[`csp-harden-v1.2-style-src-attr-research.md`](./csp-harden-v1.2-style-src-attr-research.md)
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.5 v1.2 候选

## 目标

闭合 Q-CSP-1 最后一环：生产 CSP 禁止 **元素行内样式**（含 React `style=` 与 `element.style`  imperative），使 XSS 无法经 `style` 属性注入；用户可见行为与 v1.1 一致。

## 切片划分（单人 2–4h/片 · 一轮一薄片）

| Step | ID | 范围 | 交付 |
|------|-----|------|------|
| **0** | **CSP-ATTR-0** | Release 探针（可选） | violation 基线清单或 Go |
| **1** | **CSP-ATTR-1** | `cspNonceStyleRegistry` + 守卫 allowlist 骨架 | 工具 + 单测；**不改 CSP** |
| **2** | **CSP-ATTR-2** | 主题 + 环境页 + 进度条 + 静态尺寸 | 无 `style={{` 的「低动态」组件 |
| **3** | **CSP-ATTR-3** | 语段列表虚拟窗 + 行高 | Editor 列表 scroll 回归绿 |
| **4** | **CSP-ATTR-4** | 波形 imperative 层（stretch / surfer / mount） | 波形 resize/zoom 单测 + perf gate |
| **5** | **CSP-ATTR-5** | 波形 + minimap + ruler + overlay 组件 JSX | H-CSP-3 波形手测 |
| **6** | **CSP-ATTR-6** | Popover / menu / draggable panel 定位 | H-CSP-4 手测 |
| **7** | **CSP-ATTR-7** | 生产 CSP 切换 + 守卫收紧 + allowlist 清空 | guard 0 error；H-CSP-5～7 |

## 边界（不做）

- 不改 v1.1 已闭合的 `style-src` / WaveSurfer nonce 链路（仅扩展复用）。
- 不改 `devCsp` 的 Vite HMR 策略（dev 保留 attr inline 例外）。
- 不做富文本 / HTML 渲染（本 Epic 仅为 CSP 前置）。
- 不拆无关架构热点（T-010 已闭合）。

## 验证方式

- 每片：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- 动波形片：既有 perf gate / `useWaveformViewportController.test.ts` 回归
- 收官：Release 包 H-CSP-3～7（见 acceptance）
