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

## 当前热点（自动同步，2026-05-30）

**R3h / LRC / ASR Setup（排期主战场）**

- **Rust T-010 ✅**：`install_support/`、`integrity/`、`installer/`、`catalog/`、`manifest/`、`recovery/`、`asr_sidecar/bundled/`；业务 `.rs` 均 &lt;320 行（测试模块除外）
- `apps/desktop/src/pages/useAsrSetupController.ts` ~122 行 + `useLocalRuntimeSetupSupport.ts` ~61 行（已拆分；**R3h-I3** Setup Machine 仍待收口）
- `apps/desktop/src/components/envLocalAsr/LocalAsrSetupWizard.tsx` ~166 行
- **R3t-A**：`services/asr/rushi_asr/segmentation.py` 已合入；**acceptance 手测待签**

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
| **波形区 Stitch 精修** | [`apps/desktop/docs/stitch-waveform-polish-spec.md`](./apps/desktop/docs/stitch-waveform-polish-spec.md) + [`stitch-waveform-polish-layout.html`](./apps/desktop/stitch-waveform-polish-layout.html) → `bash scripts/prepare-stitch-upload.sh` |
| 浮动确认/表单对话框 | `FloatingPanelTemplate` + `preset="compactDialog"`；`controlStyles.ts` 按钮；见 [`docs/architecture/desktop-floating-dialog-panels.md`](./docs/architecture/desktop-floating-dialog-panels.md) |
| **后续排期 / 下一刀** | [`rushi-execution-roadmap.md`](./docs/execution/plans/rushi-execution-roadmap.md) §10；**当前**：**R3g-C** → ACC-STT-UNIFY |
| **新功能 / 路线图薄片** | **先调研后编码**：`.cursor/rules/feature-research-gate.mdc` + `docs/execution/specs/*-research.md`；范例 [`r3-provider-configuration-research.md`](./docs/execution/specs/r3-provider-configuration-research.md) |
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
