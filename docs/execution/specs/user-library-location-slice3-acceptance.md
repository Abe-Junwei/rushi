# Acceptance：换机矩阵 + 网盘占位 / 受控 symlink（薄片 3）

> **状态**：已落地（自动化 ✅；换机手测 ☐）  


> **调研**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md) §4.2  
> **Intent**：[`user-library-location-slice3-intent.md`](./user-library-location-slice3-intent.md)

## 做

| 项 | 说明 |
|----|------|
| 受控 symlink | 目标在允许根内 → resolve 成功；根外 → 拒绝 |
| On-Demand 文案 | Windows `RECALL_ON_DATA_ACCESS` / 相关属性 → 明确提示始终保留本地 |
| 换机矩阵 | 下文手测清单（文档交付） |
| lifecycle | 补媒体基准与相对路径一句契约 |

## 不做

自动下载占位文件；DB 上云；新 ADR（除非后续需要）。

## 自动化

- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml media_base`（9+ passed；Unix 含 symlink 两测）
- [x] `npm run typecheck`
- [x] `node scripts/check-architecture-guard.mjs`（0 错误）

## Focused tests

- [x] symlink 指向根内 / 根外（`#[cfg(unix)]`）
- [x] 占位错误文案含「始终保留」

## 换机手测矩阵（人工）

| # | 步骤 | 期望 |
|---|------|------|
| H1 | 机 A：媒体基准设为网盘「始终保留」文件夹；导入音频并转写 | 相对路径落库；可播放 |
| H2 | 机 A：导出项目包；确认 DB 仍在本机 app_data | 包含语段；sqlite 不在网盘 |
| H3 | 等待网盘同步媒体到机 B；机 B 安装同版；导入项目包；媒体基准指到同一网盘逻辑文件夹 | 相对路径可 resolve；可播放 |
| H4 | 机 B：将某音频设为「仅联机」后再打开 | 清晰错误，提示始终保留/等待下载（非含糊 IO） |
| H5 | 确认 models/secrets/sqlite 未出现在网盘媒体基准下 | 通过 |
