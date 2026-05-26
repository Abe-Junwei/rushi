# Acceptance: R3g — 本机 ASR 模型目录（FunASR v1）

> **状态**：规划已定，待实施  
> **切片**：**R3g-A** = SenseVoice + Paraformer（路线图 §4.1 优先）；**R3g-B** = Nano 等扩展 SKU  
> **关联**：[`r3f-asr-setup-wizard-acceptance.md`](./r3f-asr-setup-wizard-acceptance.md)、[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)

## 产品决策

- v1 **仅 FunASR/ModelScope** 引擎，不接入本机 Whisper / FireRed（见 R3g-C 远期）。
- 与 R3f 共用：侧车 `prepare` 按**选中** `hub_model_id` 下载；壳启动 bundled 侧车时注入 `RUSHI_FUNASR_MODEL`。

## v1 Curated 目录（3 项）

| catalog_id | 显示名 | hub_model_id | 定位 | 磁盘提示（约） |
|------------|--------|--------------|------|----------------|
| `sensevoice-small` | SenseVoice 轻量（默认） | `iic/SenseVoiceSmall` | 快、省资源；长音频可能无分句 | ~0.5–1 GB |
| `paraformer-long-vad-punc` | Paraformer 长音频（推荐转写） | `iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch` | VAD+标点+时间戳，适合要语段 | ~1–2 GB |
| `funasr-nano-mtl` | Fun-ASR Nano 多方言 | `FunAudioLLM/Fun-ASR-Nano-2512` | 7 方言 + 26 口音（实施时 smoke 验证） | ~1 GB |

**磁盘策略**：同一 `RUSHI_MODELS_ROOT` 下多模型并存；总额仍受 policy **~5GB** 约束；UI 展示占用 + 清理（沿用 R3c）。

## 范围

### 做（R3g-A）

- TS `LOCAL_ASR_MODEL_CATALOG` + 持久化（localStorage 或 SQLite `app_prefs`）。
- 环境面板：模型下拉 + 简短说明 +「已缓存 / 未下载」。
- 侧车：`POST /v1/models/prepare` body `{ "model_id": "..." }`（兼容现有 prepare-default）。
- 切换模型后：**重启 bundled 侧车** 或热更新 env（v1 可重启侧车）。
- `GET /health` 或诊断：当前 `funasr_model_id` + 每项缓存探测（泛化 `default_model_cached_guess`）。

### 不做（v1）

- 本机 Whisper、FireRed、WeNet
- profile v1 强制带 `local_asr`（可 R3g-B 再接 profile）

## 验收

- 三项模型可切换；对未缓存项点「预下载」成功。
- 选 Paraformer 长音频后拉取 13min 样本：**优先出现多语段**（非仅整轨兜底）。
- 硬闸门全绿 + focused tests。

## 建议顺序

**R3f-B 之后**或与其共享「按 model_id prepare」侧车改动时一并做（减少重复改 `model_prepare.py`）。
