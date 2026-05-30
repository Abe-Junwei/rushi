# 波形区全方位排查（2026-05）

## 状态

| 轮次 | 主题 | 状态 |
|------|------|------|
| 0 | 基线清单 + 文档对照 | ✅ 完成 |
| 1 | 数据流与装配 | ✅ 完成 |
| 2 | 挂载与生命周期 | ✅ 完成 |
| 3 | Peaks 全链路 | ✅ 完成 |
| 4 | Zoom 与热切换 | ✅ 完成 |
| 5 | 滚动与 viewport fit | ✅ 完成（含 P0 修复） |
| 6 | 坐标与 Overlay | ✅ 完成（只读） |
| 7 | UI / 阶段 / 偏好 | ✅ 完成（含 P2 修复） |
| 8 | 测试缺口与 backlog | ✅ 完成 |

## 机器基线（2026-05-29）

| 命令 | 结果 |
|------|------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ 378 tests |
| `node scripts/check-architecture-guard.mjs` | ✅ 0 errors；2 warnings |
| `cargo test … waveform_peaks` | ✅ 9 tests |

## 产出物

- [inventory.md](./inventory.md) — 文件清单与覆盖图
- [audit-log.md](./audit-log.md) — 累积发现与处置
- [fix-backlog.md](./fix-backlog.md) — 未修复项排队
- [hand-test-matrix.md](./hand-test-matrix.md) — 手测矩阵（待填实测）

## 真源

- [`docs/architecture/desktop-waveform-engine.md`](../../../architecture/desktop-waveform-engine.md)
