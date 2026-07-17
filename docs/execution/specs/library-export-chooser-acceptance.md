# Acceptance：导出范围选择（当前项目 / 整库）

> **调研**：[`library-export-chooser-research.md`](./library-export-chooser-research.md)

## 能力—UI 状态矩阵

| UI | 维度 | 真源 |
|----|------|------|
| 导出范围对话框 | L1 | 用户选择 project \| library |
| 编辑器「导入 / 导出」菜单 | L1 | 导入内容包；导出内容包打开范围对话框 |
| 当前项目 | L1 | 需已打开项目+文件（flush 语段） |
| 整库 | L1 | DB 枚举全部 projects；打开中项目可 flush |
| 导入 zip | L1 | `manifest.kind` → project / library |

## 自动化

- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml bundle`（含 library + project）
- [x] `npm run typecheck`

## Focused

- [x] 整库 2 项目 + 词表往返
- [x] 嵌套项目包不含重复 lexicon（顶层一份）
- [x] 导入按 kind 分流（export_cmd）
