# 调研：R3s-A — Qwen3 + VAD + 热词 + 中文标点硬化

> **状态**：已采纳（2026-07-19）  
> **关联路线图**：`rushi-execution-roadmap.md` §4.1.1 R3s-A  
> **关联 spec**：[intent](./r3s-a-qwen3-pipeline-hardening-intent.md) · [plan](./r3s-a-qwen3-pipeline-hardening-plan.md) · [acceptance](./r3s-a-qwen3-pipeline-hardening-acceptance.md)  
> **门禁**：本薄片只硬化 `spike/sherpa_qwen3` 与离线评测；不解冻 ADR-0007 的产品接入。

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 中文长课、远场、专名密集；需本机 CPU 可跑、语段可编辑、术语可提示、正文有标点 |
| 本仓现状 | Qwen3 spike 已有 Silero VAD 与 `hotwords`，但固定 `max_new_tokens=128`、VAD threshold=0.5、max speech=30s；无标点；交叉 CER 不能裁定质量 |
| 成功标准 | 官方 Qwen3 ONNX + 可调 VAD + 512 token + Qwen hotwords + CT-Transformer 标点可由一条命令跑金标，输出文本 CER、标点后 CER、术语命中与截断诊断 |

## 2. 业内成熟路线

| # | 路线 | 核心机制 | 可验证来源 |
|---|------|----------|------------|
| A | Sherpa Qwen3 长音频 | Silero VAD 后逐段 Qwen3；官方示例 `max_new_tokens=512`；Qwen 配置支持 hotwords | [Qwen3 pretrained](https://k2-fsa.github.io/sherpa/onnx/qwen3-asr/pretrained.html) |
| B | Sherpa 独立中文标点 | ASR 裸文本后接离线 CT-Transformer；Rust `OfflinePunctuation` 原生 API | [punctuation](https://k2-fsa.github.io/sherpa/onnx/punctuation/index.html) |
| C | FunASR Paraformer 产品基线 | FSMN VAD + Paraformer + ct-punc + sentence_info | `services/asr/`、ADR-0006 |

## 3. 可复用评估

| 路线 | 复用度 | 可直接复用 | 冲突 / 缺口 | 资源影响 |
|------|--------|------------|-------------|----------|
| Sherpa Qwen3 | 高 | `spike/sherpa_qwen3`、Qwen hotwords、Silero VAD | 参数写死；无段边界 padding；历史模型来源不唯一 | Qwen INT8 约 1GB；CPU 已实测约 7.7x realtime |
| Sherpa punctuation | 高 | 同一个 `sherpa-onnx` crate 的 `OfflinePunctuation` | 需独立模型；逐段标点需保留 raw text | 模型单独下载；线程和耗时单独记录 |
| FunASR baseline | 高 | 现有 `eval-run.py`、gold、term metrics | 不能作为 Sherpa 运行时；保留为对照 | 不新增 |

**本仓直接复用**：`fixtures/eval` 金标、`eval_metrics.py`、Qwen spike JSON、Silero VAD、现有 hotwords 字符串；不新增 SQLite 写入或第二套产品分段真源。

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 官方 Qwen3-0.6B INT8 + Silero VAD + Qwen hotwords + Sherpa CT-Transformer 标点 |
| 默认参数 | `max_new_tokens=512`；threshold=0.3；min speech=0.2s；max speech=20s；边界 padding=0.3s；均可由 CLI 覆盖 |
| 评测口径 | 主裁定用去空白、去 Unicode 标点的内容 CER；同时保留带标点 CER；统计术语命中、VAD 覆盖率、token 触顶段 |
| 不做什么 | 不改产品默认引擎、catalog、环境页、SQLite；不删除 FunASR；不以交叉 CER 作 Go 结论 |
| 与 ADR | ADR-0007 继续 `proposed + Defer`；本薄片只补齐其 G1/G4 前置证据能力 |

## 5. 落位预告

| 层 | 文件 / 模块 | 变更 |
|----|-------------|------|
| Rust spike | `spike/sherpa_qwen3/src/` | 参数对象、VAD padding、token 诊断、可选标点 |
| Scripts | `r3s-a-download-*`、`eval-sherpa-run.py` | 官方模型来源、标点模型、金标一键评测 |
| Metrics | `eval_metrics.py` | 新增去 Unicode 标点的内容 CER，不改变旧 CER |
| Tests | Rust + Python 定向测试 | 默认参数、padding、标点无模型纯函数、CER 归一化 |

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 链接本文
- [x] 用户选择 A 路线，可进入 spike 编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-19 | 初版：修正历史评测暴露的长音频、token、VAD、标点与 CER 问题 |
