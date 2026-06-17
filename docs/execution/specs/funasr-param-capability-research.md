# 调研：FunASR generate 参数能力与静默 strip 降级治理

> **状态**：规划门禁（2026-06-17）  
> **关联进度**：[`full-code-review-remediation-progress-2026-06-16.md`](./full-code-review-remediation-progress-2026-06-16.md) #17  
> **关联调研**：[`r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md`](./r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md)  
> **门禁**：未完成本文不得改 `funasr_engine.py` 的参数降级主路径；后续 plan / acceptance 须链接本文。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户选择 Paraformer / SenseVoice / Qwen / 后续 Nano 等本地 SKU 转写时，Rushi 应清楚说明哪些高级能力启用或不可用，不能因为参数被运行时剥除而静默降低时间轴、标点、热词或 ITN 行为。 |
| 本仓现状 | `services/asr/rushi_asr/asr_model_profile.py` 已按 SKU family 生成 `generate_kwargs`；但 `services/asr/rushi_asr/funasr_engine.py` 的 `_run_generate()` 仍在 `TypeError` 后按 `strip_order` 逐个删除 `hotword`、`use_itn`、`sentence_timestamp`、`batch_size_s`、`merge_vad` 等参数并重试。 |
| 成功标准 | 每个 profile 的 generate 参数由显式白名单决定；首个请求前完成参数裁剪并记录 warning；`TypeError` 剥参仅保留为兜底且可观测；Paraformer / SenseVoice / Qwen / Nano 相关单测覆盖参数集合与 warning。 |

---

## 2. 业内成熟路线（>=2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | 宽 API + `**cfg` 透传 | FunASR `AutoModel.generate(input, ..., **cfg)` | 官方 API 接受 `hotword`、`language`、`batch_size_s`、`sentence_timestamp`、`use_itn` 等宽参数；具体模型/管线选择性消费 | https://modelscope.github.io/FunASR/api.html |
| B | SKU profile / preset-first | Rushi 当前 `asr_model_profile.py`、FunASR README 示例 | 按模型家族预设参数：Paraformer 开 `sentence_timestamp`，SenseVoice 开 `use_itn`，Qwen 仅在 forced aligner 开 `return_time_stamps` | `services/asr/rushi_asr/asr_model_profile.py` |
| C | 启动或加载后能力探测 | 常见 SDK capability negotiation / feature probing | 对模型实例发最小请求或 introspection，生成 `supported_params`，再裁剪请求参数 | 后续 spike；不作为首版主路径 |

公开参考：

- FunASR API：`https://modelscope.github.io/FunASR/api.html`
- FunASR AutoModel 源码：`https://github.com/modelscope/FunASR/blob/36656aa8/funasr/auto/auto_model.py`
- Fun-ASR-Nano 示例：`https://huggingface.co/FunAudioLLM/Fun-ASR-Nano-2512`
- Fun-ASR-Nano quickstart：`https://github.com/FunAudioLLM/Fun-ASR/blob/main/examples/colab/fun_asr_nano_quickstart.ipynb`

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A 宽 API 透传 | 中 | 继续使用 FunASR `AutoModel.generate`，无需第二推理栈 | 单靠运行时错误重试会隐藏质量退化；不满足能力—UI 可观测要求 | 运行时重试浪费首包时间，warning 粒度不稳定 |
| B profile 白名单 | 高 | `AsrModelProfile`、`build_generate_kwargs()`、现有 pytest mock | 需要补明确的 profile 参数表；未知模型必须保守降级并提示 | 无额外模型加载；适合 CI 单测和文档验收 |
| C 能力探测 | 中 | 可复用 `_get_model()` 与 warmup 流程 | 探测需真实模型、真实音频或 mock；冷启动可能变慢；PyInstaller/CPU 上不可把探测失败等同模型不可用 | 适合 SKU spike，不适合首版兜底 |

**本仓已有可复用模块**：

- `services/asr/rushi_asr/asr_model_profile.py`：SKU family 与 generate kwargs 真源。
- `services/asr/rushi_asr/funasr_engine.py`：当前 `_run_generate()` warning / fallback 集中点。
- `services/asr/rushi_asr/segmentation.py`：输出 `sentence_info` / `timestamp` 的唯一分段解析真源。
- `docs/execution/specs/r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md`：Nano / MiMo 可行性结论；MiMo 不进入现有 FunASR 栈。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **B profile 白名单为主，A 运行时 strip 仅作兜底**。在 `asr_model_profile.py` 为每个 profile 定义允许参数与“被裁剪 warning”，`funasr_engine.py` 在调用前裁剪；`TypeError` 后剥参保留 1 个版本作为兼容保险，但 warning 必须明确写入转写结果。 |
| 不做什么 | 不在首版做真实模型启动探测；不新增第二套 provider / 参数真源；不为 MiMo 写参数适配（已判定不进入 FunASR 侧车）。 |
| 与 ADR / architecture 关系 | 对齐 [`asr-sidecar-funasr-policy.md`](../../architecture/asr-sidecar-funasr-policy.md) 的 FunASR 侧车策略；继续以 `segmentation.py` 为分段真源；不改变 HTTP `TranscriptionResult v1` 契约。 |
| 风险与 spike 项 | Nano 的 `hotwords` / `language="中文"` / `itn` 与 Paraformer 的 `hotword` / `sentence_timestamp` 命名不同，需在 R3g-C spike 中用真实模型验证；未知模型 fallback 到保守参数集时需提示“部分高级功能不可用”。 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Python ASR | `services/asr/rushi_asr/asr_model_profile.py` | 扩展 `AsrModelProfile`：参数白名单、默认 kwargs、裁剪 warning 映射 |
| Python ASR | `services/asr/rushi_asr/funasr_engine.py` | 调用前裁剪不支持参数；将 strip fallback 降级为兜底并记录明确 warning |
| Python ASR | `services/asr/rushi_asr/segmentation.py` | 不改真源；仅用测试验证参数改变后仍走既有解析 |
| 测试 | `services/asr/tests/test_asr_model_profile.py` / `test_funasr_engine.py` | 覆盖 Paraformer、SenseVoice、Qwen、generic；Nano 用 mock profile 或后续 spike fixture |
| 文档 | `services/asr/README.md` / `docs/architecture/asr-generate-params-truth.md` | 若实现改变参数真源，同步记录 profile-first 规则 |

---

## 6. 签收

- [x] 调研 brief 完成
- [ ] intent / plan / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-17 | 初版：确认以 profile 白名单治理 #17，运行时 strip 仅保留为可观测兜底 |
