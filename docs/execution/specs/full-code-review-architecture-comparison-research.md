# 调研：Rushi 全量代码审查与核心模块业内外部方案对比

> **状态**：已整合（2026-06-16）  
> **说明**：本文件保留为规划门禁入口，完整调研内容、代码对比、可复用评估、决策摘要、可执行建议均已并入 [`full-code-review-architecture-comparison-report.md`](./full-code-review-architecture-comparison-report.md)。  
> **关联**：[`AI_QUICKSTART.md`](../../../AI_QUICKSTART.md)、[`CONTEXT.md`](../../../CONTEXT.md)、[`docs/architecture/README.md`](../../architecture/README.md)、[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)  
> **门禁**：完整调研与对比结论见报告 §3–§6；未完成报告前 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 快速索引

| 内容 | 在报告中的位置 |
|------|----------------|
| 问题陈述与本仓现状 | [`full-code-review-architecture-comparison-report.md` §3](./full-code-review-architecture-comparison-report.md#3-问题陈述) |
| 业内成熟路线（前端 / Rust / ASR / 波形 / 测试） | [`full-code-review-architecture-comparison-report.md` §4](./full-code-review-architecture-comparison-report.md#4-业内成熟路线2) |
| 可复用评估 | [`full-code-review-architecture-comparison-report.md` §5](./full-code-review-architecture-comparison-report.md#5-可复用评估) |
| 决策摘要（做/不做/风险） | [`full-code-review-architecture-comparison-report.md` §6](./full-code-review-architecture-comparison-report.md#6-决策摘要) |
| 模块逐项对比与风险清单 | [`full-code-review-architecture-comparison-report.md` §7](./full-code-review-architecture-comparison-report.md#7-模块逐项对比) |
| 差距矩阵与优先级 | [`full-code-review-architecture-comparison-report.md` §8–§9](./full-code-review-architecture-comparison-report.md#8-综合差距矩阵) |
| 可执行建议与验证命令 | [`full-code-review-architecture-comparison-report.md` §10](./full-code-review-architecture-comparison-report.md#10-可执行建议与验证方式) |
| 复查核实记录 | [`full-code-review-architecture-comparison-report.md` 附录 D](./full-code-review-architecture-comparison-report.md#附录-d复查核实记录) |

---

## 决策摘要（精简版）

| 问题 | 结论 |
|------|------|
| 是否需要全局状态库？ | **v1 维持现状**；v1.1 **渐进**引入 Jotai/Zustand，**第一批**迁模块 singleton，**暂缓** `segments`；保留 controller；不引入 TanStack Query |
| Rust 后端是否需要池化+WAL？ | 是，P0；分 Phase 1（pool+WAL）→ Phase 2（3 重 IO async）→ Phase 3（其余） |
| ASR 是否需要替换 FunASR Python？ | v1.1 不替换；侧车 overlap 为转写阶段识别质量（Rust trim 不能替代）；v1.2 Sherpa ONNX spike |
| 波形引擎是否需要重写？ | 否，修复 `peakCacheGeneration` 导致的 remount bug |
| 测试是否需要补强？ | 是，**P1**：coverage + 核心旅程 E2E；P2：pre-commit 瘦身、Dependabot |
| 不做什么 | 不引入 ORM、不大规模重写 controller、不替换 WaveSurfer、不引入 LiteLLM 网关 |

---

## 签收

- [x] 调研 brief 完成
- [x] 完整调研与对比报告已链接并整合
- [ ] 用户或路线图确认可进入编码/重构实施

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-16 | 初版：完成 5 大模块业内外部方案调研与可复用评估 |
| 2026-06-16 | 整合：将详细内容并入报告，本文件转为精简索引与门禁入口 |
| 2026-06-16 | 同步：决策摘要与报告修订版（P1 测试、store 渐进、Rust Phase、ASR overlap nuance）对齐 |
