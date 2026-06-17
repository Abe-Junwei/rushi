# Rushi — `docs/architecture`

本目录预留架构真源；当前 **权威对齐说明** 仍在 sibling 仓库 Jieyu 中维护，避免双份文档漂移。

跨仓参考（CI 不校验 sibling 仓库链接）：

- Jieyu sibling：`docs/architecture/如是我闻-独立新仓库与-Jieyu-对齐策略.md`
- Jieyu sibling：`docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md`

本仓 ADR 索引见 [`../adr/README.md`](../adr/README.md)。

**领域词汇表**：[`../../CONTEXT.md`](../../CONTEXT.md)（Agent 命名与对话真源；细节见下表 architecture 文档）。

## 本仓独立架构说明

- [`desktop-waveform-engine.md`](./desktop-waveform-engine.md) — 桌面端波形引擎真源（WaveSurfer-only；**Canvas 语段 bands + DOM interaction**，2026-05-30）。
- [`../execution/specs/segment-overlay-virtualization.md`](../execution/specs/segment-overlay-virtualization.md) — 密集语段 display/interaction 分离（**禁止** scroll viewport React cull）。
- [`desktop-floating-dialog-panels.md`](./desktop-floating-dialog-panels.md) — 可拖动浮动对话框：默认 `compactDialog` + Notion/Zen + `controlStyles` 约定。
- [`desktop-tailwind-v4.md`](./desktop-tailwind-v4.md) — Tailwind v4 入口、token 链、级联与尺度（策略 A）；[`tailwind-v4-full-migration-plan.md`](../execution/specs/tailwind-v4-full-migration-plan.md)。
- [`desktop-visual-style-governance.md`](./desktop-visual-style-governance.md) — 控件 token、环境页 spacing、guard 约定；[`desktop-visual-style-governance-plan.md`](../execution/specs/desktop-visual-style-governance-plan.md)。
- [`desktop-capability-ui-state-alignment.md`](./desktop-capability-ui-state-alignment.md) — **能力字段与 UI 状态对齐**（R3-STATE 闸门、维度假设、R3 疏漏台账）。
- [`desktop-project-file-lifecycle.md`](./desktop-project-file-lifecycle.md) — 项目/文件生命周期、Close Gate、导入去重与 Hub CRUD。
- [`../execution/specs/project-hub-metadata-research.md`](../execution/specs/project-hub-metadata-research.md) — **Phase 10 规划门禁**：项目 Hub 导航、项目 CRUD、场次元信息（讲述人/时间/地点等）。
- [`r3f-asr-setup-wizard-acceptance.md`](../execution/specs/r3f-asr-setup-wizard-acceptance.md) — 本机 ASR 一键环境准备（诊断 + 编排）验收。
- [`r3d-settings-ia-acceptance.md`](../execution/specs/r3d-settings-ia-acceptance.md) — 环境面板轻量 IA 收口（非全站重设计）。
- [`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md) — rushi-asr 热词是否进模型、`warnings` 与前端 `supportsHotwordBias` 占位说明（计划书 §4.3 / §6.1 对齐）。
- [`asr-vocabulary-bias-practices.md`](./asr-vocabulary-bias-practices.md) — ASR 阶段词汇偏置业内对照 + **Rushi 落地评估**（ASR-VOC-0～5）。
- [`stt-online-providers.md`](./stt-online-providers.md) — 在线 STT Provider 调研、与解语式合约对齐及后续接线说明。
- [`asr-sidecar-funasr-policy.md`](./asr-sidecar-funasr-policy.md) — ASR 侧车 + FunASR：目标用户、联网与磁盘预算、CPU/GPU（MPS + CUDA）策略。
- [`recording-transcribe-llm-pipeline.md`](./recording-transcribe-llm-pipeline.md) — **R3t 管线真源**
- [`lexicon-guided-llm-refine.md`](./lexicon-guided-llm-refine.md) — **R3t-E 词表有据校对**
- [`../execution/specs/lexicon-mining-backlog.md`](../execution/specs/lexicon-mining-backlog.md) — **候选** LEX-MINE / ASR-FT（词表挖掘与训练数据 backlog）
- [`../execution/specs/recording-transcribe-llm-refine-intent.md`](../execution/specs/recording-transcribe-llm-refine-intent.md) — R3t intent（未实施）
- [`../execution/specs/r3e-b-long-audio-chunking-research.md`](../execution/specs/r3e-b-long-audio-chunking-research.md) — **R3e-B 规划门禁**：长音频分片/进度业内调研与落位决策（先调研后编码）。
- [`../execution/specs/r3-provider-configuration-research.md`](../execution/specs/r3-provider-configuration-research.md) — R3 规划：LLM/STT Provider 业内共识与本仓配置策略（先调研后实施）。
- [`../execution/specs/r3c-local-asr-cache-manifest-acceptance.md`](../execution/specs/r3c-local-asr-cache-manifest-acceptance.md) — R3c：本机 ASR 首次引导、缓存管理与 manifest 展示的验收边界。
- [`../execution/specs/r3e-long-audio-transcribe-acceptance.md`](../execution/specs/r3e-long-audio-transcribe-acceptance.md) — R3e：长音频（**R3e-A/B/C ✅**；C 2026-05-31 — [`r3e-c-incremental-transcribe-hand-test-checklist.md`](../execution/specs/r3e-c-incremental-transcribe-hand-test-checklist.md)）。
- [`../execution/specs/r3-asr-landscape-2026-05-improvement-backlog.md`](../execution/specs/r3-asr-landscape-2026-05-improvement-backlog.md) — **ASR 生态改进 backlog**（路线图 §4.1.8）。
- [`../execution/specs/r3g-b-qwen3-asr-sku-spike-research.md`](../execution/specs/r3g-b-qwen3-asr-sku-spike-research.md) — R3g-B Qwen3 SKU spike（Go/No-go）。
- [`../execution/specs/r3f-asr-setup-wizard-acceptance.md`](../execution/specs/r3f-asr-setup-wizard-acceptance.md) — R3f：本机 ASR 一键环境准备（内置侧车编排）。
- [`../execution/specs/r3g-local-asr-model-catalog-acceptance.md`](../execution/specs/r3g-local-asr-model-catalog-acceptance.md) — R3g：本机 FunASR 模型目录（v1 三 SKU）。
- [`../execution/plans/rushi-execution-roadmap.md`](../execution/plans/rushi-execution-roadmap.md) — **排期真源**（§1.7 产品决策、§4.1 R3/R3t、§8.2 待拍板）
- [`../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md`](../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) — ASR 引擎方案 A（FunASR 先行 + Sherpa 门控）
- [`../execution/specs/rushi-local-runtime-catalog-remediation-plan.md`](../execution/specs/rushi-local-runtime-catalog-remediation-plan.md) — **R3h 实施真源**：LRC 整改方案（v1.1）。
- [`../execution/specs/rushi-local-runtime-catalog-remediation-plan-review.md`](../execution/specs/rushi-local-runtime-catalog-remediation-plan-review.md) — R3h 方案审查报告（已吸收至 v1.1）。
- [`asr-pyinstaller-collect-notes.md`](./asr-pyinstaller-collect-notes.md) — PyInstaller `collect-submodules` 取舍与 nightly 构建说明。
- [`collaboration-storage-schema.md`](./collaboration-storage-schema.md) — 联机协作版服务端真源、PostgreSQL schema、事件流与本地缓存/项目包分层草案。
- [`collaboration-review-domain-api.md`](./collaboration-review-domain-api.md) — 批注、审阅、建议修改、活动流与 Word 导出的领域模型和 API 草案。
- [`self-hosted-collab-deployment.md`](./self-hosted-collab-deployment.md) — 用户自购协作服务器时的单节点部署建议、职责边界、备份与安全基线。
- [`../../deploy/self-hosted-collab/README.md`](../../deploy/self-hosted-collab/README.md) — 单节点协作部署包目录、启动步骤与备份说明。

当 Rushi 出现更多独立于 Jieyu 的架构说明文件时，于本目录追加并在此索引。
