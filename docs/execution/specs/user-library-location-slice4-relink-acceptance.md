# Acceptance：媒体基准目录不可达时的重连（薄片 4）

> **状态**：已落地（自动化 ✅；手测 ☐）

> **调研**：[`user-library-location-slice4-relink-research.md`](./user-library-location-slice4-relink-research.md)
> **Intent**：[`user-library-location-slice4-relink-intent.md`](./user-library-location-slice4-relink-intent.md)

## 做

| 项 | 说明 |
|----|------|
| `get_media_base_dir_info` 不再整体失败 | 源目录不可达时返回 `unavailable: true` + 原始配置路径；`isCustom` 仍为 true |
| 「恢复默认」永远可用 | `apply_media_base_dir_change(None, true, st)` 在源不可达时走 `relink_from_missing_source`，不要求旧目录可解析，永远能切回 app_data 根 |
| 「选择新目录」Tier 1 结构化重连 | 源不可达时对新目录按 `projects/{id}/{filename}` 结构逐一探测；命中则重指针（零文件搬迁），未命中保持原状 |
| `resolve_audio_path` 不因基准不可达整体失败 | legacy 绝对路径 / relocate-allow 内路径继续解析；仅相对路径依赖已失效基准时才报错，错误文案含「恢复默认」 |
| UI 提示 | 目录不可达时设置页展示提示文案；确认弹窗按「重新连接」vs「搬迁」区分文案 |
| 架构守卫 | 新逻辑拆入独立文件 `media_base_relink.rs`，避免 `media_base_relocate.rs` 无上限叠加 |

## 不做

Tier 2（按文件名深度搜索的批量重连向导）；项目列表级「媒体缺失」主动 badge；放宽 `resolve_audio_path` scoped 校验规则；外置盘/网盘插拔后台自动重连；改动 `relocate_all_to` 现有搬迁逻辑。

## 自动化

- [x] `cargo build --lib`（0 错误）
- [x] `cargo test --lib media_base`（21 passed，含 6 条新测试）
- [x] `cargo clippy --lib --tests -- -D warnings`（0 警告）
- [x] `npm run typecheck`（0 错误）
- [x] `npm run lint`（0 错误；33 条既有告警与本次改动无关）
- [x] `node scripts/check-architecture-guard.mjs`（0 错误；`media_base_relocate.rs` 793 行告警为改动前已存在的既有 hotspot，本次已将新增逻辑拆入独立文件而非继续叠加）

## Focused tests（新增，均在 `media_base_dir.rs` / `media_base_relink.rs`）

- [x] `info_reports_unavailable_instead_of_failing_when_custom_dir_missing`
- [x] `legacy_absolute_resolves_even_when_custom_base_missing`
- [x] `relative_path_fails_clearly_when_custom_base_missing`
- [x] `restore_default_relinks_when_custom_base_deleted_but_files_already_at_dest`
- [x] `restore_default_succeeds_even_when_file_unrecoverable_at_dest`
- [x] `pick_new_dir_relinks_when_old_custom_base_deleted`

## 已知无关失败

`project::cmd_integration_tests::copy_file_to_project_duplicates_segments_and_keeps_source`、`move_file_to_project_relocates_db_and_managed_audio` 在改动前（`git stash` 验证）即失败，与本片无关，不在本次修复范围。

## 手测清单（人工）

| # | 步骤 | 期望 |
|---|------|------|
| H1 | 设自定义媒体基准目录，导入音频；在 Finder/Explorer 中删除该目录；回到偏好设置 | 展示「目录不可达」提示；「恢复默认」按钮可点（不再永久禁用） |
| H2 | H1 场景下点击「恢复默认」 | 成功切回 app_data 根；不再报错卡死；若文件确实丢失，仅该文件后续打开时报错，设置页操作本身成功 |
| H3 | 自定义目录被移动（非删除）到新位置；点击「选择…」指向新位置 | 识别到 `projects/{id}/{filename}` 结构后直接重指针（无需等待搬迁进度），可正常播放 |
| H4 | 自定义目录不可达，但某音频文件本身存的是 legacy 绝对路径（早期版本遗留） | 该文件不受目录不可达影响，仍可正常播放 |

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-17 | 初版；实现 Tier 1 结构化重连 + `get_media_base_dir_info` / `resolve_audio_path` 容错，拆出 `media_base_relink.rs` |
