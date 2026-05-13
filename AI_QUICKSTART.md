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
| `apps/desktop/src-tauri/src/*.rs` | Tauri 命令与数据层 |
| `services/asr/rushi_asr/` | Python ASR 侧车 |
| `docs/architecture/` | 架构真源 |
| `docs/adr/` | 架构决策记录 |
| `docs/execution/specs/` | 非 trivial feature 三件套 |

## 当前热点（自动同步）

- `useProjectP1Controller.ts` 946 行 / 46 hooks → 待拆分
- `ProjectP1Panel.tsx` 1050 行 → 待拆 controller
- `p1.rs` 1385 行 → 待拆模块
- `useP1TranscriptionLayer.ts` 645 行 / 34 hooks → 待拆分

## 任务路由

| 改动目标 | 先读 |
|----------|------|
| 时间轴 / 波形 | `useProjectWaveform.ts` + `docs/architecture/asr-hotword-bias-truth.md` |
| ASR 侧车 / 模型 | `services/asr/README.md` + `docs/architecture/asr-sidecar-funasr-policy.md` |
| 在线 STT Provider | `docs/architecture/p1-stt-online-providers.md` |
| 数据层 / SQLite | `src-tauri/src/db.rs` + ADR-0001 |
| 新增颜色 / 样式 | `tailwind.config.js` + `src/config/tokens.ts` |
| 导出格式 | `src/services/exportFormatters.ts` |

## 典型模式（好 / 坏）

- ✅ 好：`useP1TranscriptionLayer.ts` — 专注转写业务逻辑
- ❌ 坏：`useProjectP1Controller.ts` — 945 行上帝 hook（项目 CRUD + 语段 + ASR + 导出）
- ✅ 好：`p1SegmentListHelpers.ts` — 纯函数，无 React 依赖
- ❌ 坏：`ProjectP1Panel.tsx` — 1048 行（渲染 / 样式常量 / 交互混合）
- ✅ 好：`db.rs` — 专注迁移和 schema
- ❌ 坏：`p1.rs` — 1385 行（HTTP / DB / 业务逻辑 / 日志混合）

## 验证命令

```bash
# L0 daily（每次提交前）
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs

# L1 pre-merge（改架构 / 数据层 / Rust 时）
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --all-targets -- -D warnings
```

## 跨工具子 agent 决策

- **Cursor**：已有 Task tool；广搜代码、并行调研用 explore
- **Kimi**：默认 agent 足够；需专门 system prompt 隔离时才启子 agent
- **Copilot**：当前无 explicit subagent，主 chat 直接处理

共同规则：**不引入多 agent 编排**，单 agent + 上下文工程即可。
