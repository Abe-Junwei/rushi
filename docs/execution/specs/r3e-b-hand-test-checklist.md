# R3e-B — 长音频分窗转写手测清单

> **前置**：R3e-A ✅；R3t-A 分段内核 ✅；[`r3e-b-long-audio-chunking-research.md`](./r3e-b-long-audio-chunking-research.md) 调研签收  
> **自动化**：`bash scripts/r3e-b-hand-test.sh`

## 0. 环境

| 项 | 要求 |
|----|------|
| 模型 | Paraformer 长音频（VAD+标点）已缓存 |
| 素材 | **≥30min** 中文音频（手测 **~48.6min / 2918s**） |
| 侧车 | `/health` → `ready_for_transcribe: true` |

---

## 1. 自动化

- [x] `test_transcribe_windows.py` + Profile + funasr_engine（2026-05-30）

---

## 2. 长音频主路径（≥30min → 5min 窗）

| 步 | 操作 | 通过标准 |
|----|------|----------|
| 1 | 打开 ~48min 项目 → **从 ASR 拉取语段** | 不 OOM；等待至完成 |
| 2 | `desktop.log` | `audio_duration_sec=Some(2918…)` + `timeout_s=7200` + `transcribe_stage=preflight→parse→save` |
| 3 | 响应 / UI | 多语段、时间轴覆盖全长；可保存 |
| 4 | 侧车 | API `segmentation_mode=transcribe_windowed`；warnings 含 `transcribe_windowed:windows=10`（2918s÷300s） |

**日志复验（2026-05-30 手测）**

```text
1780154994908  INFO transcribe_stage=preflight
1780154994928  INFO transcribe local audio_duration_sec=Some(2918.24325) timeout_s=7200
1780155056240  INFO transcribe_stage=parse
1780155056242  INFO transcribe_stage=save
```

- 墙钟 **~61s**（5056240−4994928 ms）；较 R3e-B 前整轨 OOM **显著改善**
- [x] 用户手测：流程跑通 ✅
- [x] Agent 复验：`desktop.log` 全链路 ✅

**侧车 Python 日志说明**：bundled 侧车 `stdout/stderr=null`，`transcribe_window i=N` **不会**写入 `desktop.log`；以 API warnings + 桌面 `INFO transcribe_windowed …`（R3e-B 编码后）为准；开发模式 `bash scripts/run-asr-dev.sh` 可在终端看到 INFO。

---

## 3. 回归

| 步 | 场景 | 标准 |
|----|------|------|
| 1 | ≤10min 短音频 | 仍整轨一次完成，无回归 |
| 2 | R3e-A | 动态超时、失败文案仍有效 |

- [x] 同会话短音频 / 21min 素材此前已多次 `parse→save`（`desktop.log`）

---

## 签收

| 项 | 日期 | 执行人 | 备注 |
|----|------|--------|------|
| 自动化 | 2026-05-30 | Agent | `r3e-b-hand-test.sh` |
| ~48.6min 主路径 | 2026-05-30 | 用户+Agent | 用户确认跑通；log 61s 完成 |
| **R3e-B 签收** | **2026-05-30** | **✅** | R9 REL-1 长音频可勾选 |

**3 行日志**

```text
改动：R3e-B 侧车 5min 窗 + FunASR batch 调参
验证：48.6min desktop.log preflight→save；warnings transcribe_windowed:windows=10
下一轮：R3t-D / ACC-EVAL-1
```
