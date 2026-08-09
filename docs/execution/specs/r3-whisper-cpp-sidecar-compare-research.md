# 调研：whisper.cpp（ggml-large-v3）本机第二引擎 C1 对照

> **状态**：**No-go**（2026-08-07）· 实测见 [`r3-whisper-cpp-sidecar-compare-results.md`](./r3-whisper-cpp-sidecar-compare-results.md)  
> **关联计划**：Cursor plan `Whisper引擎路线C评估`  
> **关联旧测**：[`r3g-whisper-funasr-sku-compare-research.md`](./r3g-whisper-funasr-sku-compare-research.md)（FunASR **内嵌** Whisper — **No-go**，栈不同）  
> **门禁**：未过 G1–G4 **不得**改 `LOCAL_ASR_MODEL_CATALOG` / 删 FunASR / 接主转写路径

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | EasyWhisperUI + `ggml-large-v3` 主观优于 FunASR；希望评估是否可进 Rushi |
| **本仓现状** | 默认 FunASR Paraformer；无 whisper.cpp 引擎 |
| **成功标准** | 同金标 D3：多语段 + content_cer 可接受 + wall 可控 |

## 2. 业内路线（摘要）

| # | 路线 | 结论 |
|---|------|------|
| C1 | whisper.cpp 子进程 | **本 spike** |
| C3 | FunASR 内嵌 Whisper | 已 No-go（0 语段） |
| 维持 | Paraformer | 默认主线 |

## 3. 与旧 Whisper 测的边界

| | C1（本测） | 2026-07 Phase 0 |
|--|-----------|-----------------|
| 权重 | ggml-large-v3 完整版 | large-v3-turbo（FunASR） |
| 运行时 | whisper-cli Metal | FunASR + openai-whisper MPS |
| 证据 | **新测** | 不可直接否决/通过 C1 |

## 4. 不做什么

- 不改 catalog / 默认引擎  
- 不删除 FunASR  
- 不把 EasyWhisperUI 工作区当产品真源  

## 5. 落位

| 层 | 路径 |
|----|------|
| 脚本 | [`scripts/r3-whisper-cpp-compare-run.py`](../../../scripts/r3-whisper-cpp-compare-run.py) |
| 产出 | `docs/execution/spike-output/whisper-cpp-compare/`（gitignore） |
| 结果 | [`r3-whisper-cpp-sidecar-compare-results.md`](./r3-whisper-cpp-sidecar-compare-results.md) |
