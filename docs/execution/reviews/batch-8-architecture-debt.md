# Batch 8 — 架构债汇总

## 守卫

0 errors / 8 warnings（见 [batch-0-inventory.md](./batch-0-inventory.md)）

## 技术债优先级

| 优先级 | 项 | 动作 |
|--------|-----|------|
| P0 | R2-001, R2-002 | 完成 file-container 转写切片 + 前端刷新 |
| P1 | R1-001, R3-002, R7-001, R8-001 | 拆模块 + lifecycle 测试 |
| P2 | R1-002, R2-003, R5-001 | 删除顺序 / 确认对话框 / bundle v2 |
| P3 | R3-001, R3-004, R4-001 | 清理死代码、token、拆 transcribe/export |

## 建议实施顺序

1. 修 R2-001 + R2-002（单 PR，加 Rust/TS 集成测）
2. 删 R3-001 死 API
3. lifecycle 拆分 + 单测（2025 Round 3）
4. `project_cmd` / `EditorView` 拆分（可并行）

## 文档同步

- 修复后更新 [issues.md](./issues.md) 状态
- 关闭 R2 时更新 [file-container-refactor.md](../specs/file-container-refactor.md) 验收勾选
