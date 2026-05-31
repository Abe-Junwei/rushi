# R3g-C 调研：FunASR Generate Profile（Preset-first）

> **状态**：已采纳（2026-05-31）  
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤g**  
> **关联验收**：[`r3g-c-asr-generate-profile-acceptance.md`](./r3g-c-asr-generate-profile-acceptance.md)  
> **架构真源**：[`asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 非技术用户只选「模型 + 识别语言 + 术语表」，期望中文 ITN、长音频多语段、专名偏置；不应面对 FunASR `merge_vad` / `batch_size_s` 等参数 |
| **本仓现状** | R3g-A 双 SKU 目录、R3t-A 分段内核、`funasr_engine.py` 已有 TypeError 剥参；`funasr_generate_kwargs` 曾散落在 `segmentation.py` |
| **成功标准** | SenseVoice 默认 `use_itn`；Paraformer 保持 `sentence_timestamp` 路径；环境页可选 `zh`/`auto` 等；`/health.funasr_language` 与 UI 一致；`test_asr_model_profile.py` + 制控 eval 样例可回归 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| A | **Preset / Profile-first** | FunASR Runtime SDK CLI、`--use_itn`；Azure Speech「识别语言」下拉 | 厂商维护 SKU 默认参数；用户只选语言/领域 | [FunASR docs](https://github.com/modelscope/FunASR) |
| B | **全参数暴露** | 部分开源 WebUI、Notebook 示例直接传 `generate(**kwargs)` | 灵活但误配率高、与桌面 C 端目标冲突 | — |
| C | **后处理 ITN 外挂** | 独立标点/逆文本规范化服务 | 与 ASR 引擎解耦；Rushi v1 已由 SenseVoice 内置 ITN 覆盖主路径 | — |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 冲突 | 备注 |
|------|--------|----------|---------------|------|
| A Profile-first | **高** | SKU 表 + 时长分支 + env 排障 override | 须与 R3t-A **同一** `segment_funasr_generate_result` | 峰值内存靠 R3e-B/C 分窗，不靠用户调 batch |
| B 全参数 UI | 低 | — | 违反 Q-ACC-1、路线图 §8 | **不做** |
| C 外挂 ITN | 中 | R2/R3t-C 标点 | 重复 SenseVoice `use_itn` | Paraformer 仍走 punc 管道 |

**本仓可复用模块**：

- `services/asr/rushi_asr/asr_model_profile.py` — Profile 真源（新建）
- `funasr_engine._run_generate` — 剥参顺序与 warnings
- `apps/desktop/.../localAsrRecognitionLanguage.ts` + `local_asr_language.rs` — C4 识别语言
- `fixtures/eval` — ACC-EVAL-1 `制控` term_hit

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **AsrModelProfile** 按 `sku_family` + `duration_sec` 生成 kwargs；用户控件仅模型/语言/术语表 |
| **不做什么** | FunASR 全参数表单；`GENERATE_OVERRIDES` JSON（v1 仅 `RUSHI_FUNASR_USE_ITN` 排障）；从 catalog 删除 SenseVoice |
| **ADR / architecture** | 对齐 ADR-0003 FunASR 先行；[`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) 热词不变 |
| **风险** | 旧 FunASR 版本不支持 `use_itn` → 剥参 + warning；SenseVoice 平台弃用 → C4 文案不加「推荐」 |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| Python | `asr_model_profile.py` | C1–C3 Profile + `build_generate_kwargs` |
| Python | `segmentation.py` | 委托 Profile，禁止第二套 kwargs |
| Python | `funasr_engine.py` | 剥参 + `effective_funasr_language` |
| Rust | `local_asr_language.rs`、`app_data_paths.rs` | pref + spawn env |
| UI | `LocalAsrModelSection.tsx`、`localAsrRecognitionLanguage.ts` | C4 语言下拉 + mismatch |
| 测试 | `test_asr_model_profile.py`、`localAsrRecognitionLanguage.test.ts` | 快照与 allowlist |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] acceptance 已链接本文
- [x] 编码与自动化验证（见 acceptance §自动化）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-05-31 | 初版；吸收路线图 Q-ACC-7、§4.1.1 ⑤g 子片 |
