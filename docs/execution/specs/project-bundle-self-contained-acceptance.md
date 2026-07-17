# Acceptance：自包含项目包 v2

> **调研**：[`project-bundle-self-contained-research.md`](./project-bundle-self-contained-research.md)

## 能力—UI 状态矩阵

| UI | 维度 | 真源 |
|----|------|------|
| 导出项目包 | L1 | 当前项目全部 files + 语段 + peaks（有则）+ 元数据 + edit_log + 全局词表 |
| 导入项目包 | L1 | v1/v2 zip → 新 project id；词表合并（冲突 skip 本机） |

## 自动化

- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml project_bundle`
- [x] `npm run typecheck`

## Focused tests

- [x] 多文件 + 当前文件语段覆盖
- [x] peaks 有则打包并导入
- [x] v1 zip 仍可导入
- [x] 导出走 `resolve_audio_path`（相对/绝对均可解析时）
- [x] 元数据（narrator 等）+ edit_log 往返
- [x] 全局词表（`lexicon.json`）嵌入与导入
