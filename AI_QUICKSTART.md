# Rushi — AI Quickstart

## 项目结构

| 路径 | 职责 |
|------|------|
| `apps/desktop/src/pages/use*Controller.ts` | 页面级状态协调 |
| `apps/desktop/src/services/` | 领域服务与外部接口 |
| `apps/desktop/src/utils/` | 纯函数、格式化、规则判断 |
| `apps/desktop/src/hooks/use*.ts` | 通用 React hook |
| `apps/desktop/src/components/` | UI 组件 |
| `apps/desktop/src/config/` | 设计 token、环境配置 |
| 仓库根 `DESIGN.md` | 桌面端视觉意图（**Notion Zen**；Stitch 上传包由 `prepare-stitch-upload.sh` 同步为 `docs/stitch-upload/01-DESIGN.md`） |
| `apps/desktop/src-tauri/src/*.rs` | Tauri 命令与数据层 |
| `services/asr/rushi_asr/` | Python ASR 侧车 |
| `docs/architecture/` | 架构真源 |
| `docs/adr/` | 架构决策记录 |
| `docs/execution/specs/` | 非 trivial feature 三件套 |
| 仓库根 `CONTEXT.md` | 领域词汇表（Agent 对话与命名真源） |
| `.cursor/skills/` | 手动触发的 Agent 技能（见 `docs/agents/skills.md`） |

## 当前热点（自动同步，2026-06-19）

**§10.4 v1.1+ 主序 ✅**（Step 5–12 · REL-1.1 2026-06-18）。**ACC-STT-IFLYTEK ✅** · **P2 架构热点 / T-010 ✅**（`9612aae` · guard **0** 警告）。**下一刀 → §10.5 P3 Win 发行资产** 或 **CLN-066 Release parity L3 手测**（[`parallel-backlog-2026-06.md`](./docs/execution/specs/parallel-backlog-2026-06.md)）。

**发行 / 工程雷达（并行）**

- **Win release 资产** 🟡 ← **现在** — **macOS + Windows**（**无 Linux 桌面包**）；Release CI `tauri-windows`：瘦 NSIS + `*_离线安装包.zip`（便携版已退役）
- **CLN-066 Release parity L3** 🟡 — L2 机器 ✅；[`release-parity-evidence-2026-06-14.md`](./docs/execution/release-parity-evidence-2026-06-14.md) L3 UI 手测 ☐（建议用 **v0.1.1** DMG 重跑）

**已闭合（2026-06-18～19）**

- **ACC-STT-IFLYTEK** ✅ — [`acc-stt-iflytek-acceptance.md`](./docs/execution/specs/acc-stt-iflytek-acceptance.md)
- **T-010 / 架构热点回收** ✅ — `run_transcribe_cmd/` · `online_segment_normalize/` 目录化；`useEnvOnlineSttPanel` 拆分；Wave A–H 清理（`9612aae`）；guard **0** · lint **0**
- **Welcome 全文检索** ✅ — `3973acb` + Hub/Search 组件拆分
- **活动 Inbox 铃铛** ✅ — `3795f53`
- **CSP style-src-attr v1.2** ✅ — `3b3c2fa`

**暂不做 / Defer / 废弃**

- **R3g-B-Align**（Qwen3 + ForcedAligner）❌ **废弃**（2026-06-18）— spike Defer 2026-06-11（CPU ~8× Paraformer）；**不再做**本机第三 SKU — [`r3g-b-align-forced-aligner-spike-results.md`](./docs/execution/specs/r3g-b-align-forced-aligner-spike-results.md)

- **R3g-C Fun-ASR-Nano PyTorch** ❌ **Defer**（2026-06-17）— 不上 catalog — [`r3g-c-funasr-nano-acceptance.md`](./docs/execution/specs/r3g-c-funasr-nano-acceptance.md)
- **R3g-C Nano + vLLM** ❌ **Defer**（2026-06-18）— 无 CUDA 环境 · **目前不做** spike；research 保留 — [`r3g-c-funasr-nano-vllm-research.md`](./docs/execution/specs/r3g-c-funasr-nano-vllm-research.md)

**v1 后主序：LLM-LOC**

- **4a Ollama** ✅ · **4b LRC 自管** ❌ Gate-B No-Go — [`llm-loc-gate-b-decision-2026-06.md`](./docs/execution/specs/llm-loc-gate-b-decision-2026-06.md)

**并行索引**：[`parallel-backlog-2026-06.md`](./docs/execution/specs/parallel-backlog-2026-06.md)

**已降温（勿再当 R0 阻塞）**

- `useProjectLifecycleController.ts` ~261 行 → **T-005 已解决**（原 ~381 行）
- `project_bundle_cmd.rs` 277 行 + tests 252 行；`transcribe.rs` ~300 行 + `transcribe_native_online.rs`
- `useProjectWaveform.ts` 275 行；`SegmentTextListRow.tsx` ~110 行（**R3-003 已缓解**）

## 任务路由

| 改动目标 | 先读 |
|----------|------|
| 时间轴 / 波形 | `useProjectWaveform.ts` + [`desktop-waveform-engine.md`](./docs/architecture/desktop-waveform-engine.md)（minimap 56px、语段 tap seek、layoutIntent 缩放栏） |
| ASR 侧车 / 模型 | `services/asr/README.md` + `docs/architecture/asr-sidecar-funasr-policy.md` + **能力—UI 对齐** [`desktop-capability-ui-state-alignment.md`](./docs/architecture/desktop-capability-ui-state-alignment.md) |
| 在线 STT Provider | `docs/architecture/p1-stt-online-providers.md` |
| 数据层 / SQLite | `src-tauri/src/db.rs` + ADR-0001 |
| 新增颜色 / 样式 | `tailwind.config.js` + `src/config/tokens.ts` |
| 新 UI / 整页重设计 / Stitch 对齐 | 仓库根 `DESIGN.md` → 再映射到 `tailwind.config.js` + `apps/desktop/src/config/tokens.ts` |
| **波形区 Stitch 精修** | [`stitch-waveform-polish-layout.html`](./apps/desktop/stitch-waveform-polish-layout.html) + [`desktop-waveform-engine.md`](./docs/architecture/desktop-waveform-engine.md) → `bash scripts/prepare-stitch-upload.sh` |
| 浮动确认/表单对话框 | `FloatingPanelTemplate` + `preset="compactDialog"`；`controlStyles.ts` 按钮；见 [`docs/architecture/desktop-floating-dialog-panels.md`](./docs/architecture/desktop-floating-dialog-panels.md) |
| **后续排期 / 下一刀** | [`parallel-backlog-2026-06.md`](./docs/execution/specs/parallel-backlog-2026-06.md) — **§10.4 ✅** · **P2 T-010 ✅** · **P3 Win 资产 / CLN-066** · §10.5 并行轨 |
| **新功能 / 路线图薄片** | 可选先 **`grill-with-docs`** → **先调研后编码**：`.cursor/rules/feature-research-gate.mdc` + `docs/execution/specs/*-research.md`；范例 [`r3-provider-configuration-research.md`](./docs/execution/specs/r3-provider-configuration-research.md) |
| **难 bug / 侧车 / flaky** | `.cursor/skills/diagnose` 或对话中说「按 diagnose 查」 |
| **架构 hotspot / 定期体检** | `.cursor/skills/improve-architecture`；配合 `check-architecture-guard.mjs` |
| 单人 UI 重设计迭代（已验收） | `docs/execution/specs/ui-redesign-parallel-dev.md` + `bash scripts/prepare-stitch-upload.sh` |
| 更换或更新 `DESIGN.md` 基底 | 仓库根执行 `npm run design:add -- <站点>`（站点名见 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) / [getdesign.md](https://getdesign.md/)，例：`npm run design:add -- cal`） |
| 导出格式 | `src/services/exportFormatters.ts` |

## 典型模式（好 / 坏）

- ✅ 好：`useTranscriptionLayer.ts` — 专注转写业务逻辑（185 行 / 11 hooks）
- ✅ 好：`useProjectWaveform.ts` + `useWaveformPlayback.ts` + `WaveformSegmentOverlay` — 波形入口 + DOM 语段 overlay
- ✅ 好：`segmentListHelpers.ts` — 纯函数，无 React 依赖
- ✅ 好：`transcribe.rs` + `transcribe_native_online.rs` — 解析逻辑与 provider 调用分离
- ✅ 好：`db.rs` — 专注迁移和 schema
- ✅ 好：`project_bundle_cmd.rs` + `project_bundle_cmd_tests.rs` — 生产逻辑与回归测试分离

## 验证命令

```bash
# L0 daily（每次提交前）
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs

# L1 pre-merge（改架构 / 数据层 / Rust 时）
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --all-targets -- -D warnings
```

## 单人 AI 流程（UI 重设计阶段）

1. 每轮 2-4 小时，只做一个纵向薄片。
2. 每轮开始先执行：`bash scripts/prepare-stitch-upload.sh`。
3. Stitch 单目标出稿后，先改 token，再改页面组件。
4. 后端只接本轮 UI 需要的最小契约。
5. 每轮结束必须通过：
	- `npm run typecheck`
	- `npm run test`
	- `npm run lint`
	- `node scripts/check-architecture-guard.mjs`
6. 每轮至少手测 1 条主路径，并记录 3 行日志（改动 / 验证 / 下一轮）。

## 跨工具子 agent 决策

- **Cursor**：已有 Task tool；广搜代码、并行调研用 explore
- **Kimi**：默认 agent 足够；需专门 system prompt 隔离时才启子 agent
- **Copilot**：当前无 explicit subagent，主 chat 直接处理

共同规则：**不引入多 agent 编排**，单 agent + 上下文工程即可。
