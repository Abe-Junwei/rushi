# 调研：Release Parity Program — dev 与打包程序表现差异治理

> **状态**：已采纳  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) v1 release / packaging follow-up  
> **关联 spec**：[`release-parity-program-2026-06.md`](./release-parity-program-2026-06.md)  
> **门禁**：本文完成后才进入主控 program 文档与后续实现；见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 维护者在 `npm run desktop:dev` 中验证正常，但 `.app` / DMG 安装副本出现波形、ASR、文案、权限、路径、旧数据等 release-only 问题。用户需要一套可复现、可审查、可签收的 release parity 机制，而不是逐个症状临时排查。 |
| 本仓现状 | 已有局部能力：[`dmg-vs-dev-parity-checklist.md`](./dmg-vs-dev-parity-checklist.md)、[`release-packaging-audit-2026-06.md`](./release-packaging-audit-2026-06.md)、[`release-zero-terminal-hand-test.md`](../release-zero-terminal-hand-test.md)、`scripts/release-postbuild-verify.sh`、`scripts/v1-release-installed-smoke.sh`、`scripts/check-architecture-guard.mjs`、`apps/desktop/src/services/runtimeParity.ts`、`apps/desktop/src/services/packagedUserHints.ts`。缺口是这些能力尚未形成统一风险域、门禁层级、证据格式和 go/no-go 规则。 |
| 成功标准 | 任何 dev/release 差异都能归入固定风险域，并通过 parity 日志、诊断包、postbuild verify、installed smoke 或手测 evidence 定位；release 结论必须来自真实 `.app` / DMG 安装副本。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | Release artifact smoke gate | Tauri / desktop app release workflow | CI 或本地 release 流程在构建后启动真实打包产物，验证窗口启动、非白屏、基础交互、日志/截图 artifact；smoke 保持 5–10 条、小而硬。 | [Tauri testing strategy](https://deepwiki.com/tauri-apps/tauri/10.2-testing-strategy-and-ci-pipeline), [Papillon E2E plan](https://github.com/Baur-Software/pap/blob/main/E2E_TESTING_PLAN.md), [Harness smoke testing guide](https://www.harness.io/harness-devops-academy/integrating-smoke-testing-into-your-ci-cd-pipeline-what-devops-needs-to-know) |
| B | Production diagnostics first | Electron / Sentry / desktop logging ecosystem | release app 初始化早期日志、crash dump、version/build stamp、system info、diagnostic bundle；失败时以结构化证据而非用户描述定位。 | [Electron crashReporter](https://electronjs.org/docs/latest/api/crash-reporter), [electron-log](https://www.npmjs.com/package/electron-log), [Sentry Electron](https://docs.sentry.io/platforms/javascript/guides/electron.md) |
| C | Native WebView E2E（后置增强） | Tauri WebDriver / tauri-playwright | 在真实 WKWebView / WebView2 / WebKitGTK 中驱动少量关键路径，截图和视频作为 artifact；不替代 unit/component tests。 | [tauri-playwright](https://github.com/srsholmes/tauri-playwright), [Victauri testing docs](https://github.com/runyourempire/victauri/blob/main/docs/testing-tauri-apps.md) |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A Release artifact smoke gate | 高 | 直接升级 `release-postbuild-verify.sh` 与 `v1-release-installed-smoke.sh`；将 `.app` 启动、日志增长、bundle resource、ASR health、诊断包生成列为机器门禁。 | UI 自动化不应一开始过重；Playwright Chrome mock 不能被误认为 WKWebView 签收。 | 小 smoke 可在数分钟内运行；适合作为本地 release go/no-go。 |
| B Production diagnostics first | 高 | 扩展 `runtimeParity.ts` domain；诊断包包含 build-info、environment、capabilities、parity-log、project-summary、redaction note。 | 不能上传用户音频/文本；本地 token 和路径须脱敏；个人 v1 不引入远程 crash 上报。 | 低运行成本；最大收益是减少 release-only 问题的猜测成本。 |
| C Native WebView E2E | 中 | 后续可对 macOS WKWebView 做“启动非白屏 + Welcome 基础点击 + 诊断包生成”级 smoke。 | Tauri WebView 自动化依赖和 CI 环境复杂；当前不应作为 Phase 0/1 阻塞项。 | 适合 Phase 4；先用脚本 smoke 和手测 evidence 稳住主线。 |

**本仓已有可复用模块**：

- `scripts/release-postbuild-verify.sh` — 构建后 `.app` resource sanity。
- `scripts/v1-release-installed-smoke.sh` — 安装包启动与本机冒烟证据。
- `scripts/check-architecture-guard.mjs` — release 文案、CSP、行为分叉、invoke ACL 静态门禁。
- `apps/desktop/src/services/runtimeParity.ts` — dev/release parity 日志入口。
- `apps/desktop/src/services/packagedUserHints.ts` — shell-managed vs dev 文案分流。
- `docs/architecture/desktop-capability-ui-state-alignment.md` — ASR / 环境 UI 状态维度纪律。
- `docs/execution/specs/dmg-vs-dev-parity-checklist.md` — macOS WKWebView 专项验收清单。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 采用“Release artifact first + 小而硬 smoke gate + 本地诊断包 + 风险域矩阵”的组合路线。Phase 0/1 先文档化与观测扩展；Phase 2 强化机器门禁；Phase 3 fixture 化 fresh/upgrade 验收；Phase 4 再评估 Native WebView E2E。 |
| 不做什么 | 不把 dev 硬伪装成 release；不把 Chrome Playwright mock 当 packaged WKWebView 证据；不引入大而脆的端到端套件作为第一步；不通过绕过 `asset://`、吞错误、散落文案来掩盖 release-only 问题。 |
| 与 ADR / architecture 关系 | 延续 `dmg-vs-dev-parity-checklist.md` 的“业务逻辑单路径，差异只在部署层”；ASR 能力状态继续遵守 `desktop-capability-ui-state-alignment.md`；波形仍以 `desktop-waveform-engine.md` 为真源。 |
| 风险与 spike 项 | Native WebView 自动化工具选择需另开 spike；诊断包脱敏边界须保守；旧 App Data fixture 需要手工脱敏，不能直接纳入真实用户内容。 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Docs | `docs/execution/specs/release-parity-program-2026-06.md` | 新增主控 program 文档 |
| Docs | `docs/execution/specs/dmg-vs-dev-parity-checklist.md`、`docs/execution/release-zero-terminal-hand-test.md` | 改为引用主控 program，并保留各自子清单职责 |
| TS | `apps/desktop/src/services/runtimeParity.ts` | 后续扩展 parity domain 与日志格式 |
| TS / Rust | 诊断包与 build-info 相关模块 | 后续统一 diagnostic bundle 字段 |
| Scripts | `scripts/release-postbuild-verify.sh`、`scripts/v1-release-installed-smoke.sh`、`scripts/check-architecture-guard.mjs` | 后续扩展 L1/L2/L0 门禁 |
| 测试 | Vitest / shell smoke / doc link check | 后续补覆盖 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] program 文档链接本文
- [ ] 用户确认进入 Phase 1/2 编码与脚本强化

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-13 | 初版：统一 release parity 调研，采纳 artifact smoke + diagnostics + risk matrix 路线 |
