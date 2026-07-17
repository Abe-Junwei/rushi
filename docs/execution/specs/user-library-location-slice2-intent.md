# Spec(intent)：媒体基准搬迁向导 + peaks 随媒体（薄片 2）

> **调研门禁**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md) §4.1（**已签收**）  
> **验收**：[`user-library-location-slice2-acceptance.md`](./user-library-location-slice2-acceptance.md)  
> **前序**：薄片 1 — [`user-library-location-intent.md`](./user-library-location-intent.md)

## 目标

改媒体基准时：有受管媒体则弹窗仅 **搬迁 / 取消**；搬迁把 **音频 + peaks** 挪到新基准并回写相对路径，**全部成功后才切 pref**。新 peaks 写入 `{media_base}/projects/{id}/peaks/`。

## 边界（不做 · 本片）

- 不提供「仅改路径」/ previous-base 白名单。
- 不把 DB/models/secrets 搬迁或上云。
- 不做 Files On-Demand / symlink 完整策略（薄片 3）。
- 不做「强制切换残缺库」。

## 能力—UI 状态矩阵

| UI | 维度 | 真源 | 禁止误绑 |
|----|------|------|----------|
| 选择… / 恢复默认 | L1 将变基准 | 用户挑选的目标路径（尚未写 pref） | 禁止未确认就写 pref（有受管媒体时） |
| 确认搬迁弹窗 | L1 需搬迁 | `media_base_managed_summary`（file_count>0） | 禁止空库仍逼弹窗 |
| 搬迁进行中 | L1 relocating | Rust 搬迁命令进行中 | 禁止用 `/health` 表示进度 |
| 内容库路径展示 | L1 当前基准 | `prefs/media_base_dir.txt` + resolve | 禁止显示未剥离的 `\\?\` |

## 落位预告

| 层 | 路径 |
|----|------|
| Rust | `media_base_dir.rs`；新建 `media_base_relocate.rs`；`waveform_peaks_cmd` / gc / diag / `project_storage` peaks 根 |
| UI | `EnvLibraryLocationSection.tsx` + `CompactConfirmDialog` |
| API | `projectAsrMaintenanceApi.ts` |

## 验证

见 acceptance；自动门禁 + 定向 `cargo test` media_base / relocate。
