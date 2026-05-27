# Acceptance: R3g — 本机 ASR 模型目录（FunASR v1）

> **状态**：**R3g-A** ✅（2026-05-27）：**⑤a** 后端/侧车、**⑤b** UI + **S3**、**⑤c** Paraformer 13min 多语段手测均已签收  
> **切片**：**R3g-A** = SenseVoice + Paraformer（路线图 §4.1 优先）；**R3g-B** = Nano 等扩展 SKU  
> **关联**：[`r3f-asr-setup-wizard-acceptance.md`](./r3f-asr-setup-wizard-acceptance.md)、[`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md)

## 产品决策

- v1 **仅 FunASR/ModelScope** 引擎，不接入本机 Whisper / FireRed（见 R3g-C 远期）。
- 与 R3f 共用：侧车 `prepare` 按**选中** `hub_model_id` 下载；壳启动 bundled 侧车时注入 `RUSHI_FUNASR_MODEL`。
- **R3-STATE**：本 spec 必须通过路线图 §4.1.4 闸门后再签收 ⑤c。

## v1 Curated 目录（R3g-A 两项）

| catalog_id | 显示名 | hub_model_id | 定位 | 磁盘提示（约） |
|------------|--------|--------------|------|----------------|
| `sensevoice-small` | SenseVoice 轻量（默认） | `iic/SenseVoiceSmall` | 快、省资源；长音频可能无分句 | ~0.5–1 GB |
| `paraformer-long-vad-punc` | Paraformer 长音频（推荐转写） | `iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch` | VAD+标点+时间戳，适合要语段 | ~1–2 GB |

（`funasr-nano-mtl` 留 **R3g-B**。）

**磁盘策略**：同一 `RUSHI_MODELS_ROOT` 下多模型并存；总额仍受 policy **~5GB** 约束；UI 展示占用 + 清理（沿用 R3c）。

## 能力—UI 状态矩阵（R3-STATE 必填）

| UI 控件 / 文案 | 应对齐维度 | 数据源 | ⑤b 状态 |
|----------------|------------|--------|---------|
| 模型下拉 + SKU 列表「已缓存/未下载」 | D1 + D4 | `buildLocalAsrCatalogView` / catalog API | ✅ |
| 「应用并重启侧车」后侧车报告 | D2 | `/health.funasr_model_id` vs D1 | ✅ + mismatch 提示 |
| 模型下载进度 / 「已缓存」 | D1 + D4（禁止 D5） | `selectedModelPrepareState` | ✅ |
| stale 侧车提示 | D3 | `/` 或 `/health.local_asr_model_catalog` | ✅ |
| 环境页「可直接转写」 | D2 一致时用 D5；否则降级 | `computeLocalAsrTranscribeReady` | ✅ P1 |
| 顶栏 / Header 转写绿点 | 同上 | 同上 | ✅ P1 |
| 一键准备 model 步 | D1 pref + prepare(model_id) | `localAsrSetupModelStep` + setup flow | ✅ P1 |

维度定义见 architecture §2。

## 范围

### 做（R3g-A）

- TS `LOCAL_ASR_MODEL_CATALOG` + 持久化（localStorage + Tauri `prefs/funasr_hub_model_id.txt`）。
- 环境面板：模型下拉 + 简短说明 +「已缓存 / 未下载」+「应用并重启侧车」。
- 侧车：`POST /v1/models/prepare` / `prepare/async` body `{ "model_id": "..." }`（兼容 prepare-default）。
- 切换模型后：写偏好 + **`force_restart_bundled`**（杀 8741 旧进程 + `RUSHI_FUNASR_MODEL`）。
- `GET /health` + `GET /v1/models/catalog`：当前 `funasr_model_id` + 每项缓存探测。

### 不做（v1）

- 本机 Whisper、FireRed、WeNet
- profile v1 强制带 `local_asr`（可 R3g-B 再接 profile）

### P0 — 模型下载真取消（Q-R3g-3，⑤c 前阻塞）

| 现状 | 目标 |
|------|------|
| ~~仅 abort 前端轮询~~ | ✅ `POST /v1/models/prepare-cancel` + 进度回调 cooperative cancel |
| 单文件 `snapshot_download` 中途 | 当前文件传完后停止；阶段间立即停；UI 文案已区分 |

- [x] 取消后 `prepare_status` → `phase: cancelled` / `error_code: model_prepare_cancelled`
- [ ] 手测：下载中点取消 → 状态为 cancelled；可重新下载（断点续传）
- [x] pytest：`test_prepare_cancel_*`（见 `test_model_prepare.py`）

## 验收

### ⑤a 后端（已编码）

- [x] catalog / prepare(model_id) / sidecar pref
- [x] `force_restart_bundled` + stale 侧车检测

### ⑤b UI 状态 + S3（2026-05-27 签收）

- [x] 模型区 P0 疏漏（下载进度、侧车报告、mismatch）
- [x] P1 疏漏清零（architecture §4 表）
- [x] **S3** 场景 1–2（[`r3g-a-s3-hand-test-checklist.md`](./r3g-a-s3-hand-test-checklist.md)）
- [x] `localAsrModelCatalog.test.ts` mismatch + `computeLocalAsrTranscribeReady` 用例

### ⑤c 产品手测

- [x] 两项模型可切换；侧车报告与所选一致（preflight 2026-05-27）
- [x] 预下载 / 校验缓存（Paraformer + VAD cached）
- [x] **13min Paraformer 多语段** — 2026-05-27 复测通过：≥10 语段，无 `funasr_whole_track_fallback`
- [x] 硬闸门全绿（`r3g-s3-preflight.sh` + 转写主路径）

#### ⑤c 复测门禁（2026-05-27 已通过；留存备查）

1. **重建内置侧车**（源码已含 `sentence_timestamp` + punc，旧 PyInstaller 包不会自动更新）：
   ```bash
   npm run asr:build-sidecar-unix   # 或本机对应脚本
   ```
2. **完全退出应用** → 再 `npm run desktop:dev`（或安装包重装侧车）。
3. 环境页 **校验/刷新缓存** Paraformer；`prepare-status.result` 应含 **`punc_path`**（无则侧车仍旧）。
4. 再转写 13min；**通过**：≥10 语段，无 `funasr_whole_track_fallback`（或仅极短样本允许）。
5. 可选：转写响应 `warnings` 中无 `funasr_generate_typeerror` / `sentence_timestamp_param_unsupported`。

## 建议顺序

**R3f** 与 **R3g-A ⑤a** 可共享侧车改动；**⑤b 必须在 ⑤c 手测签收之前完成**。

**R3-STATE S3（路线图 Q-R3g-2）**：§5「2 组矛盾场景手测」**签收前不得进入 ⑤c**（见路线图 §4.1.4、§10）。
