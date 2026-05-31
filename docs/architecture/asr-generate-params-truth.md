# FunASR `generate()` 参数真源（R3g-C）

> **状态**：✅ v1（2026-05-31 手测签收）  
> **验收**：[`r3g-c-asr-generate-profile-acceptance.md`](../execution/specs/r3g-c-asr-generate-profile-acceptance.md)  
> **实现**：`services/asr/rushi_asr/asr_model_profile.py`、`funasr_engine.py`

用户 **不** 在桌面端填写 FunASR `generate()` 固有参数；由 **AsrModelProfile** 按 SKU + 音频时长生成。用户控件：**模型（hub id）**、**识别语言**、**全局术语表（hotwords）**。

## 1. Profile 解析

| `model_id` 特征 | `profile_id` | `sku_family` |
|-----------------|--------------|--------------|
| 含 `sensevoice` | `sensevoice_small_v1` | `sensevoice` |
| Paraformer + VAD+punc 管道 | `paraformer_vad_punc_v1` | `paraformer` |
| 其他 | `generic_funasr_v1` | `generic` |

长音频阈值：`duration_sec >= 180`（与 `segmentation.LONG_AUDIO_SEC` 一致）。

## 2. 各 SKU 默认 kwargs

| 字段 | Paraformer | SenseVoice | generic |
|------|------------|------------|---------|
| `language` | 来自 `RUSHI_FUNASR_LANGUAGE`（默认 `zh`） | 同左 | 同左 |
| `sentence_timestamp` | `true` | — | — |
| `merge_vad` | `false` | 短音频 `true` / 长音频 `false` | 同 SenseVoice |
| `batch_size_s` / `batch_size_threshold_s` | 长音频 `60` / `30` | 长音频同上 | 长音频同上 |
| `use_itn` | **不传**（走 punc 管道） | 默认 **`true`** | **不传** |
| `rich_transcription_postprocess` | — | 与 `use_itn` 同开 | — |
| `hotword` | 有术语时传入 | 同左 | 同左 |

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

## 5. 不支持参数时的行为（C3）

`funasr_engine._run_generate` 按顺序尝试 `generate`，遇 `TypeError` 剥除：

`hotword` → `rich_transcription_postprocess` → `use_itn` → `output_timestamp` → `sentence_timestamp` → `batch_size_*` → `merge_vad`

并写入 `warnings`（如 `funasr_use_itn_unsupported`、`sentence_timestamp_param_unsupported`）。

## 6. 与分段 / 长音频的关系

- **kwargs 真源**：仅 `asr_model_profile.build_generate_kwargs`（`segmentation.funasr_generate_kwargs` 为薄委托）。
- **分段解析**：仍由 `segment_funasr_generate_result`（R3t-A）；Profile **不** fork 第二套 VAD。
- **长音频分窗**：R3e-B/C 在 `transcribe_windows.py`；每窗仍用同一 Profile kwargs。

## 7. SKU 文案（C4，非 generate 参数）

| catalog_id | 显示名规则 |
|------------|------------|
| `paraformer-long-vad-punc` | 含 **「推荐转写」** |
| `sensevoice-small` | **不含**「推荐」；可为「默认」 |

见 `model_catalog.py` / `localAsrModelCatalog.ts`。
