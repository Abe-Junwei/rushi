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
| 仓库根 `DESIGN.md` | 桌面端视觉意图（Stitch DESIGN.md；与 `tailwind` / `tokens.ts` 配合使用） |
| `apps/desktop/src-tauri/src/*.rs` | Tauri 命令与数据层 |
| `services/asr/rushi_asr/` | Python ASR 侧车 |
| `docs/architecture/` | 架构真源 |
| `docs/adr/` | 架构决策记录 |
| `docs/execution/specs/` | 非 trivial feature 三件套 |

## 当前热点（自动同步）

- `apps/desktop/src-tauri/src/project/export_cmd.rs` 485 行 → 待拆模块
- `apps/desktop/src-tauri/src/project/transcribe.rs` 478 行 → 待拆模块
- `apps/desktop/src/hooks/useProjectWaveform.ts` 275 行 / 13 hooks → 接近阈值
- `apps/desktop/src/components/ProjectPanel.tsx` 241 行 → 已拆 controller，当前健康

## 任务路由

| 改动目标 | 先读 |
|----------|------|
| 时间轴 / 波形 | `useProjectWaveform.ts` + `docs/architecture/asr-hotword-bias-truth.md` |
| ASR 侧车 / 模型 | `services/asr/README.md` + `docs/architecture/asr-sidecar-funasr-policy.md` |
| 在线 STT Provider | `docs/architecture/p1-stt-online-providers.md` |
| 数据层 / SQLite | `src-tauri/src/db.rs` + ADR-0001 |
| 新增颜色 / 样式 | `tailwind.config.js` + `src/config/tokens.ts` |
| 新 UI / 整页重设计 / Stitch 对齐 | 仓库根 `DESIGN.md` → 再映射到 `tailwind.config.js` + `apps/desktop/src/config/tokens.ts` |
| 单人 UI 重设计迭代 | `docs/execution/specs/ui-redesign-parallel-dev.md` + `bash scripts/prepare-stitch-upload.sh` |
| 更换或更新 `DESIGN.md` 基底 | 仓库根执行 `npm run design:add -- <站点>`（站点名见 [awesome-design-md](https://github.com/VoltAgent/awesome-design-md) / [getdesign.md](https://getdesign.md/)，例：`npm run design:add -- cal`） |
| 导出格式 | `src/services/exportFormatters.ts` |

## 典型模式（好 / 坏）

- ✅ 好：`useTranscriptionLayer.ts` — 专注转写业务逻辑（185 行 / 11 hooks）
- ❌ 坏：`useProjectWaveform.ts` — 275 行 / 13 hooks，波形 + 播放 + 区域混合
- ✅ 好：`segmentListHelpers.ts` — 纯函数，无 React 依赖
- ❌ 坏：`transcribe.rs` — 478 行（HTTP 客户端 / 多厂商适配 / 热词 / 模型调用混合）
- ✅ 好：`db.rs` — 专注迁移和 schema
- ❌ 坏：`export_cmd.rs` — 485 行（导入/导出/项目包/路径校验混合）

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
