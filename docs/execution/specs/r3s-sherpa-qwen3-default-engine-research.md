# 调研：R3s-A — Sherpa-ONNX Qwen3 为将来默认本机 ASR 引擎

> **状态**：已采纳（2026-06-11）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **R3s-A**（新增）  
> **前置 spike**：R3h-3.5 Partial Go（Paraformer ONNX）· R3g-B ForcedAligner 对照 [report](./r3g-b-qwen3-sherpa-funasr-compare-report.md) · spike 产物见 `docs/execution/spike-output/qwen3-sherpa-retest-2026-06-11/` · `docs/execution/spike-output/qwen3-0.6b-2026-06-11/`（本地手测目录，不入库）  
> **关联 spec**：[`r3s-sherpa-qwen3-default-engine-intent.md`](./r3s-sherpa-qwen3-default-engine-intent.md) · [plan](./r3s-sherpa-qwen3-default-engine-plan.md) · [acceptance](./r3s-sherpa-qwen3-default-engine-acceptance.md)  
> **门禁**：未完成本文 **不得** 改 `run_transcribe_cmd` 默认引擎或 catalog 默认 SKU  
> **执行模式（2026-06-11）**：**Defer** — [plan §Defer](./r3s-sherpa-qwen3-default-engine-plan.md)；G1 前 **不** 开 Phase 1–3 产品编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 个人 v1 本机长音频转写：要快、要多语段、要专名/热词可用；弱网安装侧车 ~2.5GB 成本高 |
| **本仓现状** | **默认** = FunASR PyInstaller 侧车 `8741` + **Paraformer vad-punc**（`localAsrModelCatalog.ts` 唯一 SKU）；转写经 `run_transcribe_cmd.rs` → HTTP multipart；Qwen3 FunASR+ForcedAligner **Defer**（慢、Aligner 轴差）；Sherpa **仅 spike**（`spike/sherpa_qwen3/`） |
| **战略选择（2026-06-11）** | 走 **将来默认** = 以 **Sherpa-ONNX Qwen3-ASR-0.6B + Silero VAD** 为 **目标默认本机引擎**；FunASR 侧车 ** phased 降级为兼容/回退**，非 v1 后立即删除 |
| **成功标准（产品 Go）** | 金标 CER/WER 不劣于 Paraformer 基线；长音频 RTFx ≥ Paraformer；`segments[]` 契约满足 R3t-A；LRC 可下载 ONNX；环境页默认指向 Sherpa SKU；FunASR 可 opt-in 回退 |

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表 | 机制 | 与 Rushi |
|---|------|------|------|----------|
| **A** | **Sherpa-ONNX 内嵌 Rust** | k2-fsa/sherpa-onnx v1.12.34+ Qwen3 offline | `OfflineQwen3ASR` + Silero VAD；INT8 ONNX；Rust crate 静态链 ORT | **选定** — spike 已证 制控 RTFx ~7.7、270 段 |
| **B** | **FunASR 侧车 + PyTorch Qwen3** | FunASR AutoModel + qwen-asr + ForcedAligner | HTTP 8741；双模型 CPU 慢；Aligner 语段塌缩（R3g-B） | **闭卷 No-go** — 不作默认、不进 G1–G4 |
| **C** | **FunASR 侧车 + Paraformer** | 当前 v1 默认 | vad+punc+`sentence_info`；~168s/21min | **过渡基线 + 回退轨** — ADR-0006 Partial Go |
| **D** | **Sherpa Paraformer ONNX** | R3h-3.5 P0 | 轻量但 13min CER ~67% vs FunASR | **不作默认** — 仅 R&D |

链接：[Qwen3-ASR sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/qwen3-asr/index.html) · [ADR-0006](../../adr/0006-sherpa-onnx-paraformer-spike-evaluation.md)

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 / 缺口 |
|------|--------|----------|-------------|
| **A Sherpa Qwen VAD** | **高**（引擎层） | `spike/sherpa_qwen3/`、`scripts/r3g-b-*` | 无 HTTP 面；无 punc；LRC 需 ONNX manifest；~4.4GB ONNX 包 |
| **B FunASR Qwen** | 中 | prepare、hotwords 逻辑 | CPU 8× 慢；ForcedAligner 分段不合格 |
| **C FunASR Paraformer** | **高** | 全产品链、ACC-EVAL-2 | 侧车体积；非「将来默认」目标 |

**本仓必须先复用（禁止 fork 第二套分段写入）**：

| 模块 | 路径 | R3s-A 用法 |
|------|------|------------|
| 段写入 / SQLite | `run_transcribe_cmd.rs`、`save_transcribe_segments` | Sherpa 输出映射为同一 `segments[]` JSON |
| 分段规则（解析） | `segmentation.py` 思路 | Rust `sherpa_segments.rs` 对齐字段；**不**再经 Python |
| LRC | `local_runtime/` | 新增 `sherpa-qwen3-asr-0.6B-int8` artifact |
| 能力—UI | `desktop-capability-ui-state-alignment.md` | D2/D3：`asr_engine` + SKU 双真源 |
| 评估 | `fixtures/eval/`、用户金标 | Go 闸门 |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **默认引擎** | **Sherpa-ONNX Qwen3-0.6B INT8 + Silero VAD**（whole 短音频 / vad 长音频） |
| **默认 SKU 名称（拟）** | `qwen3-asr-vad-0.6b`（catalog）；hub 显示为 ONNX pack，非 ModelScope PyTorch id |
| **FunASR 侧车** | **Phase 0–2 保留**；Phase 3 降为「高级/兼容」；最终可 PyInstaller optional component |
| **Paraformer** | 维持 catalog **回退 SKU** 直至 Sherpa 金标 Go |
| **标点** | Phase 1 可 **无标点 ship** + 文案说明；Phase 2 LLM 标点或 Sherpa 后续包 |
| **hotwords** | Phase 1 验证 `OfflineQwen3ASRModelConfig.hotwords`；不达标则 Phase 2 专名 spike |
| **不做什么** | 不用 Sherpa Paraformer 作默认；不删 `segmentation.py` 直到 FunASR 路径 EOL；不做 vLLM 第二 HTTP 服务 |
| **与 ADR** | 修订 [ADR-0003](../../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) 附录 → [ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md) 迁移计划 |

### Spike 证据（制控.mp3，2026-06-11）

| 指标 | Sherpa Qwen VAD | FunASR Paraformer | FunASR Qwen+Aligner |
|------|-----------------|-------------------|---------------------|
| 语段 | **270** | 198 | 211 |
| wall | **162s** | ~168s | ~1338s |
| RTFx | **~7.7** | ~7.4 | ~0.93 |
| term_hit 制控 | 1.0 | 1.0 | 1.0 |
| 标点 | ❌ | ✅ | ❌ |

产物：`docs/execution/spike-output/qwen3-sherpa-retest-2026-06-11/`

---

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| Rust | `apps/desktop/src-tauri/src/asr_sherpa/`（新） | Qwen3+VAD 转写、segments 映射 |
| Rust | `run_transcribe_cmd.rs` | `local_asr_engine` 路由：sherpa \| funasr-sidecar |
| Rust | `local_runtime/` manifest | ONNX 下载/校验 |
| Rust | `spike/sherpa_qwen3/` | 升格或迁入 `asr_sherpa` |
| Python | `services/asr/` | 短期保留；默认路径不再必经 |
| UI | `localAsrModelCatalog.ts`、环境页 | 新默认 SKU + 回退 Paraformer |
| 测试 | ACC-EVAL-2 + 金标 | Sherpa 列；架构守卫 `asr_engine` |

---

## 6. 签收

- [x] 调研 brief 完成（2026-06-11）
- [ ] intent / plan / acceptance 用户确认
- [ ] 金标 transcript 就绪（制控 + 至少 1 短样本）
- [ ] ADR-0007 采纳后 Phase 0 编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版：用户选择「将来默认」Sherpa Qwen3 路线 |
| 2026-06-11 | R3g-B：ForcedAligner 语段不合格；Sherpa 双 SKU 远期（Qwen → Paraformer on Sherpa） |
