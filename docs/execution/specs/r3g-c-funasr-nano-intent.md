# Spec(intent): R3g-C — Fun-ASR-Nano-2512 SKU Spike

> **状态**：🟢 spike 执行中（Phase 0 代码就绪，待权重下载与实测）  
> **调研**：[`r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md`](./r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md)  
> **计划**：[`r3g-c-funasr-nano-plan.md`](./r3g-c-funasr-nano-plan.md)  
> **验收**：[`r3g-c-funasr-nano-acceptance.md`](./r3g-c-funasr-nano-acceptance.md)  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1 **R3g-C**（扩展 SKU）

---

## 目标

在现有 FunASR 侧车中接入 **FunAudioLLM/Fun-ASR-Nano-2512** 作为可选本地 ASR SKU，实测验证**多语段分段、速度、PyInstaller 打包、热词、标点**后，决定是否上架到用户模型面板。

## 背景

- R3g-A 已完成 Paraformer-long-vad-punc 与 SenseVoice 的 catalog 架构。
- R3g-C（Generate Profile）已建立 `AsrModelProfile`、`build_generate_kwargs`、无 punc 管道判定等机制。
- Fun-ASR-Nano-2512 为阿里官方新一代端到端 ASR（SenseVoice encoder + Qwen3-0.6B decoder），与现有 FunASR 侧车同栈，但加载参数和速度需实测。
- MiMo-V2.5-ASR 已确认不进入本路线（见调研 §4）。

## 范围

| 层 | 内容 |
|----|------|
| **Python 侧车** | `AutoModel` 加载、`generate()` 参数、`sentence_timestamp` / 热词 / 标点、prepare 缓存规则 |
| **前端 Catalog** | 新增 SKU 条目、diskHint、能力—UI 状态对齐 |
| **打包** | PyInstaller 侧车 `trust_remote_code` / `remote_code` 验证 |
| **测试** | 新增 Python 单测与手测样本对照 |

## 非目标

- **不替换**当前默认 Paraformer；仅在 spike 通过后作为新增 SKU。
- **不做** MiMo-V2.5-ASR、vLLM、独立推理栈、流式/Realtime WS。
- **不改** SQLite / L2–L3 真源。
- **不引入**新的引擎抽象层；复用现有 `funasr_engine.py`。

## 高层做法

1. **env-only 冒烟**：先通过 `RUSHI_FUNASR_MODEL=FunAudioLLM/Fun-ASR-Nano-2512` 在源码侧车跑通 `warmup` 与短音频 transcribe。
2. **长音频对照**：用 ~21min 制控样例验证语段数、时间轴、热词命中与 wall clock。
3. **打包探测**：升级/确认 funasr 版本，执行 `npm run asr:build-sidecar-unix`，验证 bundled 侧车 `/health` 不 500。
4. **Catalog 接入**：确认硬闸门全部通过后，新增 Python + TS catalog 条目、`funasr_nano` profile family。
5. **回归验证**：机器守卫 + 手测清单 + 结论签收。

## 关键风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| `trust_remote_code` + `remote_code` 在 PyInstaller 下失败 | 无法上架 bundled 包 | P0 源码通过后再 P2 打包；失败则 Defer |
| 长音频语段数 < 10 或整轨 fallback | 不满足多语段产品需求 | No-go，维持 Paraformer 默认 |
| wall clock > 3× Paraformer | 用户体验不可接受 | Defer，等待硬件/量化优化 |
| 热词/标点未达 baseline | 功能降级 | 记录差距，若核心场景不通过则 No-go |
| funasr 版本升级导致 Paraformer 回归 | 影响现有默认路径 | lock 升级单独评审；回归测试覆盖 Paraformer |

## 验收摘要

验收详情见 [`r3g-c-funasr-nano-acceptance.md`](./r3g-c-funasr-nano-acceptance.md)。核心硬闸门：

- 长音频语段数 ≥ 10，无 `funasr_whole_track_fallback`
- wall clock ≤ 2× Paraformer（Go），≤ 3×（Defer）
- 热词 `term_hit_rate` 不低于 Paraformer baseline
- bundled 侧车 `/health` import 不 500

## 关联文档

- [ADR-0003](../../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) — FunASR-first
- [ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md) — Sherpa 远期路线（不受影响）
- [`asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md)
- [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)
- [`r3g-local-asr-model-catalog-acceptance.md`](./r3g-local-asr-model-catalog-acceptance.md)
