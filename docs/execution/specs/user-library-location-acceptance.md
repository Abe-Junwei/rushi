# Acceptance：用户库位置与跨设备同步（媒体基准目录 · 薄片 1）

> **状态**：薄片 1 已落地（自动化门禁绿；手测 ☐）  

> **调研门禁**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md)（已采纳）  
> **Intent**：[`user-library-location-intent.md`](./user-library-location-intent.md)

## 目标

- 用户可在环境 → 偏好设置中查看/更改**媒体基准目录**。
- 新导入音频落在该基准下的 `projects/{id}/`，DB 存**相对媒体基准**的路径。
- 旧绝对路径仍可 resolve（dual-read）。
- UI 明确：DB/模型/密钥留本机；**不要把数据库目录放进网盘**。

## 范围

### 做（薄片 1）

| 项 | 说明 |
|----|------|
| Pref | `prefs/media_base_dir.txt`；空 = 默认 `DbState.root` |
| Resolve | 相对路径 join 基准；绝对路径接受「在媒体基准下」或「在 app_data 根下（legacy）」 |
| 写入 | create/import/bundle 新音频：copy 到 `{media_base}/projects/…`，持久化相对路径 |
| UI | 偏好设置：媒体路径 + 选择 / 恢复默认（纪律说明不进 prefs，见 research） |
| 命令 | `get_media_base_dir_info` / `set_media_base_dir_pref` / `pick_media_base_dir` / `get_app_data_root_path` |
| asset scope | 切换媒体基准时即时 `allow_directory`（无需重启即可继续访问新目录下的媒体） |

### 不做（本片）

- 存量路径 bulk 相对化、媒体搬迁向导
- peaks 随媒体上云
- symlink / Files On-Demand 完整策略（仍拒危险 symlink；占位文件可后续片）
- 自研 sync

## 能力—UI 状态矩阵

| UI | 维度 | 真源 |
|----|------|------|
| 媒体基准目录 | L1 | `prefs/media_base_dir.txt` |
| 数据库与模型（本机） | L2 | `DbState.root` |
| 网盘警告 | L3 | 静态文案 |

## 落位文件

| 层 | 路径 |
|----|------|
| Rust | `apps/desktop/src-tauri/src/media_base_dir.rs`；`project/utils.rs`；`project_create_cmd.rs`；`project_bundle_cmd.rs`；`lib.rs` |
| API | `apps/desktop/src/tauri/projectAsrMaintenanceApi.ts`（或并列 media API） |
| UI | `apps/desktop/src/components/EnvPreferencesPanel.tsx`（或 `EnvLibraryLocationSection.tsx`） |
| 测试 | `media_base_dir.rs` focused tests；utils dual-read |

## 自动化验收

- [x] `npm run typecheck`
- [x] `npm run test`
- [x] `node scripts/check-architecture-guard.mjs`（无新增 error；既有 hotspot 警告仍在）
- [x] `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml media_base`（4 passed）

## Focused tests

- [x] 空 pref → media base = app_data root
- [x] 相对路径 join 基准后 resolve 成功
- [x] 旧绝对路径（在 app_data 根下）仍 resolve
- [x] 根外绝对路径拒绝
- [x] 写入相对化：文件在基准下时 DB 存相对段

## 手测清单

1. 打开环境 → 偏好设置：可见「内容库位置」；路径 + 选择 / 恢复默认，无长篇说明堆叠。
2. 选择一非默认本地目录为媒体基准 → 导入音频 → 文件出现在该目录 `projects/…` → 可播放/转写。
3. 恢复默认媒体基准后，旧项目（绝对路径）仍可打开。
4. （可选）将媒体基准指到网盘「始终保留本地」文件夹冒烟；**不要**把 app_data 整库放进网盘。
