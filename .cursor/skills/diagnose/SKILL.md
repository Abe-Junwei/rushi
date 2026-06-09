---
name: diagnose
description: >-
  Disciplined diagnosis loop for Rushi bugs and performance regressions across
  Tauri, React, Rust, and Python ASR sidecar. Use when the user says diagnose,
  debug this, fix this bug, flaky test, sidecar not ready, or performance regression.
disable-model-invocation: true
---

# Diagnose（Rushi）

硬 bug 专用纪律。跳过阶段须有明确理由。

先读 [`CONTEXT.md`](../../../CONTEXT.md) 与相关 `docs/architecture/`、`docs/adr/`。

## Phase 1 — 建反馈环（最重要）

没有可重复 pass/fail 信号，**停止**——不要猜代码。

### Rushi 优先尝试顺序

1. **定向 Vitest** — `npm run test -- path/to.test.ts`
2. **Rust 单测** — `cargo test name_fragment --manifest-path apps/desktop/src-tauri/Cargo.toml --lib`
3. **typecheck** — `npm run typecheck`（类型回归）
4. **侧车 HTTP** — `curl localhost:8741/health`（对照 D1–D6，见 `desktop-capability-ui-state-alignment.md`）
5. **E2E** — `npm run test:e2e:chromium`（浏览器敏感路径）
6. **最小复现脚本** — curl 上传、fixture 音频、replay 捕获 payload
7. **Throwaway harness** — 单函数 / 单侧车 endpoint 隔离

环本身也要迭代：更快、信号更尖、更确定（pin 时间、固定 fixture、窄 scope）。

非确定性 bug：目标**提高复现率**（循环 100×、并行、stress），不是强求 100%。

** genuinely 无法建环**：列出已试项；向用户要环境访问、HAR/log dump、或临时插桩许可。**不要**进入假设阶段。

## Phase 2 — 复现

- [ ] 与用户描述的症状一致（不是邻近错误）
- [ ] 多次运行稳定或 flake 率够高
- [ ] 已记录精确症状（报错、错误输出、慢多少）

## Phase 3 — 假设

生成 **3–5 条可 falsify 假设**，排序后再测：

> 若 {原因} 成立，则 {操作} 会使 bug 消失/恶化。

**展示列表给用户**后再测（用户可能立刻重排）。

## Phase 4 — 插桩

一次只改一个变量。优先：debugger/REPL →  targeted log（前缀 `[DEBUG-xxxx]`）→ 禁止 log everything。

性能问题：先 baseline 测量（`performance.now()`、profiler、SQL explain），再 bisect。

## Phase 5 — 修复 + 回归

**有正确 seam 时**：先写 failing test → 修复 → pass → 重跑 Phase 1 原始场景。

**无正确 seam**：记录为架构发现；修复后建议用户跑 `/improve-architecture`。

Rushi 提交前：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`

## Phase 6 — 清理

- [ ] 移除 `[DEBUG-...]` 插桩
- [ ] 删除 throwaway 脚本
- [ ] commit/PR 说明写清**哪条假设成立**

Rushi 特有反馈环细节见 [feedback-loops.md](feedback-loops.md)。
