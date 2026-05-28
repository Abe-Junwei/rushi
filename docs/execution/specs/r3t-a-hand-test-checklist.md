# R3t-A — 声学分段手测清单

> **前置**：R3g **⑤c** ✅；`segmentation.py` 已合并 `main`  
> **自动化**：`npm run asr:test -- tests/test_funasr_engine.py`；`node scripts/check-internal-doc-links.mjs`  
> **关联**：[`recording-transcribe-llm-refine-plan.md`](./recording-transcribe-llm-refine-plan.md) §2.4

## 0. 侧车必须用「当前 Python 源码」

内置 PyInstaller 包**不含**本次 `segmentation.py` 变更，手测前二选一：

| 方式 | 命令 |
|------|------|
| **A（推荐）开发侧车** | 仓库根目录：`npm run asr:dev`（自动绑定桌面 `models` 缓存目录） |
| **B 重建内置包** | `npm run asr:build-sidecar-unix` 后重启桌面 |

桌面开发时若 8741 已被 A 占用，设 **`RUSHI_SKIP_BUNDLED_ASR=1`** 再 `npm run desktop:dev`，避免壳再拉起旧包。

```bash
# 终端 1 — 侧车（源码，含 RUSHI_MODELS_ROOT）
cd /path/to/Rushi
export RUSHI_FUNASR_MODEL="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
npm run asr:dev

# 终端 2 — 预检 + 桌面
cd /path/to/Rushi
bash scripts/r3g-s3-preflight.sh    # 侧车起来后
RUSHI_SKIP_BUNDLED_ASR=1 npm run desktop:dev
```

---

## 1. Paraformer — 长音频（~13min，与 ⑤c 同素材）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 环境 → 本机 ASR：选 **Paraformer 长音频** → **应用并重启侧车**（或确认 `preflight` D1=D2） | `/health` 的 `funasr_model_id` 为 Paraformer hub id；`funasr_punc_model_cached: true` |
| 2 | 打开含 **~13min** 音频的项目 → **拉取语段** | 等待完成（注意 R3e-A 动态超时，勿中途杀进程） |
| 3 | 语段列表 | **≥10** 条；时间轴覆盖全片 |
| 4 | 提示/日志 | **无** `funasr_whole_track_fallback` 横幅；`warnings` 无整轨 fallback 文案 |
| 5 | （可选）`curl` 或日志 | 响应含 `segmentation_mode: "sentence_info"`（若桌面已透传） |
| 6 | 截图 | `r3t-a-paraformer-13min-segments.png` |

- [ ] 场景 1 通过

---

## 2. SenseVoice — 长音频（同素材或 ≥3min）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 环境 → 选 **SenseVoice 轻量** → **应用并重启侧车** | D1=D2；模型已缓存 |
| 2 | 同一项目 **拉取语段** | **≥3** 条（VAD 段级即可，可弱于 Paraformer 句级） |
| 3 | 提示 | 长音频**不得**仅 1 条整轨 + `funasr_whole_track_fallback` |
| 4 | 若仅全文无分句 | 应出现 `funasr_long_audio_no_segments` 类提示，**不是**整轨占位语段 |
| 5 | 截图 | `r3t-a-sensevoice-long-segments.png` |

- [ ] 场景 2 通过

---

## 3. 短音频对照（<30s，可选）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | ≤30s 测试 clip → 拉取 | 允许 **1** 条整轨 + `funasr_whole_track_fallback` warning |

- [ ] 场景 3 通过或 **N/A**

---

## 签收

| 项 | 日期 | 执行人 | 备注 |
|----|------|--------|------|
| Paraformer 13min ≥10 段 | | | |
| SenseVoice 长音频 ≥3 段 | | | |
| **R3t-A 签收** | | | |

**3 行日志模板**：

```text
改动：R3t-A 声学分段手测（Paraformer 13min + SenseVoice 长音频）
验证：语段数 / warnings / preflight；asr pytest + desktop test
下一轮：R3t-B 转写任务状态与原子写库
```
