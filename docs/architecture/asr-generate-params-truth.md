# FunASR `generate()` 参数真源（R3g-C / #17 v2）

> **状态**：✅ v2（2026-06-17：profile-first 参数白名单）  
> **验收**：[`r3g-c-asr-generate-profile-acceptance.md`](../execution/specs/r3g-c-asr-generate-profile-acceptance.md)  
> **实现**：`services/asr/rushi_asr/asr_model_profile.py`、`funasr_engine.py`

用户 **不** 在桌面端填写 FunASR `generate()` 固有参数；由 **AsrModelProfile** 按 SKU + 音频时长生成。用户控件：**模型（hub id）**、**识别语言**、**全局术语表（hotwords）**。

## 1. Profile 解析

| `model_id` 特征 | `profile_id` | `sku_family` |
|-----------------|--------------|--------------|
| 含 `sensevoice` | `sensevoice_small_v1` | `sensevoice` |
| 含 `qwen` | `qwen3_asr_0_6b_v1` | `qwen` |
| Paraformer + VAD+punc 管道 | `paraformer_vad_punc_v1` | `paraformer` |
| 其他 | `generic_funasr_v1` | `generic` |

长音频阈值：`duration_sec >= 180`（与 `segmentation.LONG_AUDIO_SEC` 一致）。

## 2. 各 SKU 默认 kwargs

| 字段 | Paraformer | SenseVoice | Qwen | generic |
|------|------------|------------|------|---------|
| `language` | 来自 `RUSHI_FUNASR_LANGUAGE`（默认 `zh`） | 同左 | 映射为 `Chinese` 等全称 | 同左 |
| `sentence_timestamp` | `true` | — | — | — |
| `merge_vad` | `false` | 短音频 `true` / 长音频 `false` | 同 SenseVoice | 同 SenseVoice |
| `batch_size_s` / `batch_size_threshold_s` | 长音频 `60` / `30` | 长音频同上 | 长音频同上 | 长音频同上 |
| `return_time_stamps` | — | — | 配置 forced aligner 时传入 | — |
| `use_itn` | **不传**（走 punc 管道） | 默认 **`true`** | — | **不传** |
| `rich_transcription_postprocess` | — | 与 `use_itn` 同开 | — | — |
| `hotword` | 有术语时传入 | 同左 | 同左 | 同左 |

## 3. 识别语言（C4）

| 层 | 真源 |
|----|------|
| 侧车运行时 | `RUSHI_FUNASR_LANGUAGE` env |
| 桌面持久化 | `prefs/funasr_language.txt`（Tauri）+ `localStorage` `rushi.localAsr.recognitionLanguage` |
| Allowlist | `zh`、`auto`、`en`、`ja`、`ko`、`yue`（非法值回落 `zh`） |
| `/health` | `funasr_language`（`runtime_caps.py`） |

壳启动 bundled 侧车：`apply_asr_model_env(..., language: read_language_pref)`。

## 4. 排障 override（非产品 UI）

| 变量 | 作用 |
|------|------|
| `RUSHI_FUNASR_USE_ITN` | `0`/`false` 关闭 SenseVoice ITN；`1`/`true` 强制开启 |
| `RUSHI_FUNASR_LANGUAGE` | 覆盖识别语言（须为 allowlist 内） |

v1 **不做** `RUSHI_FUNASR_GENERATE_OVERRIDES` JSON 合并。

## 5. 不支持参数时的行为（#17 v2）

`asr_model_profile.supported_generate_param_keys()` 按 profile 定义允许参数；`funasr_engine._run_generate` 在第一次调用 FunASR 前先执行 `filter_generate_kwargs_for_model()`：

- 允许参数保留；
- profile 外参数剔除，并写入 `warnings`：`funasr_generate_param_filtered:<key>`；
- 未知 / generic profile 使用最保守集合：`language`、`merge_vad`、`batch_size_s`、`batch_size_threshold_s`、`hotword`。

运行时 `TypeError` strip 仍保留为兼容兜底，顺序为：

`hotword` → `rich_transcription_postprocess` → `use_itn` → `output_timestamp` → `sentence_timestamp` → `batch_size_*` → `merge_vad`

兜底 strip 仍写入既有 `warnings`（如 `funasr_use_itn_unsupported`、`sentence_timestamp_param_unsupported`），但不再作为正常参数适配路径。

## 6. 与分段 / 长音频的关系

- **kwargs 真源**：仅 `asr_model_profile.build_generate_kwargs` + `filter_generate_kwargs_for_model`（`segmentation.funasr_generate_kwargs` 为薄委托）。
- **分段解析**：仍由 `segment_funasr_generate_result`（R3t-A）；Profile **不** fork 第二套 VAD。
- **长音频分窗**：R3e-B/C 在 `transcribe_windows.py`；每窗仍用同一 Profile kwargs。

## 7. SKU 文案（C4，非 generate 参数）

| catalog_id | 显示名规则 |
|------------|------------|
| `paraformer-long-vad-punc` | 含 **「推荐转写」** |
| `sensevoice-small` | **不含**「推荐」；可为「默认」 |

见 `model_catalog.py` / `localAsrModelCatalog.ts`。
