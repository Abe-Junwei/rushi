# Rushi 反馈环备忘

## ASR / 侧车

| 检查 | 命令 / 路径 |
|------|-------------|
| 侧车 health | `curl -s localhost:8741/health \| jq` |
| 模型 catalog | `curl -s localhost:8741/v1/models/catalog` |
| 能力维度 | 对照 D1–D6：`docs/architecture/desktop-capability-ui-state-alignment.md` |
| 侧车日志 | 侧车 stdout / Tauri 启动日志 |
| Force restart | Rust `asr_sidecar::force_restart_bundled` 路径 |

常见误判：用 D5 `ready_for_transcribe` 表示用户所选 SKU 就绪 — 须查 D1+D4。

## 桌面 UI

| 检查 | 命令 |
|------|------|
| 单元/组件 | `npm run test -- SegmentList` |
| E2E | `npm run test:e2e:chromium` |
| 浏览器策略 | `docs/architecture/桌面端浏览器支持策略.md` |

## 数据层

| 检查 | 命令 |
|------|------|
| Rust DB | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` |
| 迁移 | 查 `apps/desktop/src-tauri/src/db.rs` |

## Close Gate / 生命周期

手测矩阵：`docs/architecture/desktop-project-file-lifecycle.md`

自动化：`useProjectCloseGateController`、相关 controller 单测。

## 波形

真源：`docs/architecture/desktop-waveform-engine.md`  
滚动：`tierScrollRef.scrollLeft` 为 UI 真源。

## 诊断包

导出路径见 `diagnostic.rs`；含 `edit_log` 摘要，非逐键审计。
