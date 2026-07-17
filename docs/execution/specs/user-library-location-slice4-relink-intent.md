# Spec(intent)：媒体基准目录不可达时的重连（薄片 4）

> **调研门禁**：[`user-library-location-slice4-relink-research.md`](./user-library-location-slice4-relink-research.md)
> **验收**：[`user-library-location-slice4-relink-acceptance.md`](./user-library-location-slice4-relink-acceptance.md)
> **前序**：薄片 1 · 2 · 3

## 目标

1. **`get_media_base_dir_info` 不再因源目录不可达而整体失败**：返回 `unavailable: true` + 原始配置路径，settings UI 始终有数据可渲染。
2. **「恢复默认」永远可点、永远能成功**：目标是 app_data 根（不会丢），即使旧自定义目录已删除/移动，切回默认这一步不能被卡死。
3. **「选择新目录」在旧目录不可达时走 Tier 1 结构化重连**：不要求旧目录可解析；按 `files.audio_path` 的相对结构在新目录下逐一探测，命中则重指针（零文件搬迁），未命中的行保持不变，留给后续单独诊断。
4. **播放不因媒体基准不可达而整体断流**：`resolve_audio_path` 对不依赖媒体基准的路径（legacy 绝对路径、relocate-allow 内路径）继续解析，只有真正依赖已失效基准的相对路径才报错。

## 边界（不做）

- 不做 Tier 2（按文件名深度搜索的批量重连向导 + 逐条确认 UI）——留待后续薄片。
- 不做项目列表/编辑器级「媒体缺失」主动 badge。
- 不放宽 `resolve_audio_path` 现有 scoped 校验规则（app_data / 媒体基准 / relocate-allow 三选一）。
- 不新增外置盘/网盘插拔的后台自动重连 watcher。
- 不改动 `relocate_all_to`（源可达时的常规搬迁）现有逻辑。

## 能力—UI

| 场景 | 维度 | 真源 |
|------|------|------|
| 自定义媒体基准目录被删除/移动后设置页展示 | L1 内容库位置可用性 | `get_media_base_dir_info().unavailable` |
| 「恢复默认」按钮可点性 | L1 内容库位置可用性 | `info.isCustom`（不再依赖目录是否存在） |
| 播放/转写读取音频路径失败 | L1 媒体可读性 | `resolve_audio_path` 错误串 |

## 落位

- `media_base_dir.rs`：`MediaBaseDirInfo.unavailable`、`media_base_dir_info()`、`resolve_audio_path` / `resolve_candidate_under_roots` 的 `media_base: Option<&Path>` 化。
- `media_base_relocate.rs`：`commit_media_base_dir_change_inner` 拆出 `apply_media_base_dir_change`（`AppHandle` 无关，可直接单测）；按源是否可解析分支到 `relocate_all_to` 或 `media_base_relink::relink_from_missing_source`。
- 新文件 `media_base_relink.rs`：`relink_from_missing_source`（Tier 1 结构化重连，见调研 §4）。
- `EnvLibraryLocationSection.tsx` + `projectAsrMaintenanceApi.ts`：展示不可达提示；确认弹窗文案按「重连」vs「搬迁」区分。

## 验证

见 acceptance（Rust 单测 + typecheck + 架构守卫 + 手测）。
