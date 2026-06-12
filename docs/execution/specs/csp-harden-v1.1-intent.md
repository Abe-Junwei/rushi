# Spec(intent): CSP-HARDEN（Q-CSP-1）

> **调研门禁**：见 [`csp-harden-v1.1-research.md`](./csp-harden-v1.1-research.md)（已采纳）。
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10.4 Step 6a–b。

**Research brief**：[`csp-harden-v1.1-research.md`](./csp-harden-v1.1-research.md)

## 目标

让 Tauri 生产 CSP 的 `style-src` 系去掉 `'unsafe-inline'`（改由 Tauri 自动 nonce/hash 覆盖），缩小 XSS 面，并加自动守卫防回归；保留 `style-src-attr`（React 行内样式）与 `devCsp`（Vite HMR）的 `unsafe-inline`。

## 切片划分

| 切片 | 范围 | 交付 |
|------|------|------|
| **6a（C-1，本片）** | 生产 `style-src` 去 `unsafe-inline` + 删除独立 `style-src-elem` + 守卫升级 + 波形 probe 就绪 | 配置 + 守卫 + 自动门禁（typecheck/test/guard）绿 |
| **6b（C-2）** | 全应用 CSP smoke（Editor 波形、交付导出 Dialog、环境页三盏灯）+ acceptance 手测签收（H-CSP-1/2） | Release 包 DevTools 无 style CSP violation |

## 边界（不做）

- 不改 `script-src`（v1 已 `'self'`）。
- 不去 `style-src-attr` 的 `unsafe-inline`（v1.2 再评估）。
- 不去 `devCsp` 的 `unsafe-inline`。
- 不引入富文本 / HTML 注入 UI。
- 不新造 nonce 工具，复用既有 `tauriStyleCspNonce` / `waveSurferShadowCspNonce`。
- 不与大规模 UI 重设计同 PR（路线图 §10.4.3 禁忌）。

## 验证方式

- 自动（6a）：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`；守卫须在 `style-src` 出现 `unsafe-inline` 时失败。
- 手测（6b/REL-1.1）：Release `.app` 打开 Editor + 交付导出 + 环境页，DevTools Console 无 `Refused to apply inline style` 类 violation。
