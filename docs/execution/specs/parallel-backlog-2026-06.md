# 并行薄片索引（不挡 v1 后主序 · 2026-06-06）

> **主序真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10  
> **纪律**：每轮仍 **一轮一薄片**；下列项 **勿与 ⑤″f-B 或 LLM Gate 填表同 PR 大改**

## 当前主序（2026-06-06 拍板）

| 项 | 状态 | 说明 |
|----|------|------|
| **⑤″f-A/B/B½** | ✅ | [a](./r3-5f-a-phase-signoff-2026-06.md) · [b](./r3-5f-b-phase-signoff-2026-06.md) · [b½](./r3-5f-bhalf-phase-signoff-2026-06.md) |
| **⑤″f-C F7 §B 双机手测** | ⏸ 暂缓 | 无第二台机器；F7 机器回归仍绿 — [f7 清单](./f7-lexicon-bundle-hand-test-checklist.md) |
| **⑤″f-D VOC-3** | ✅ | [signoff](./r3-5f-d-phase-signoff-2026-06.md) · 2026-06-04 机器复验 |
| **R3h-0** | ✅ mac | mac 机器闸门 ✅ 2026-06-08；Win §4 豁免 — [signoff](./r3h-0-phase-signoff-2026-06.md) |
| **Gate-B / 4b** | ❌ No-Go | [`llm-loc-gate-b-decision-2026-06.md`](./llm-loc-gate-b-decision-2026-06.md) |

## 并行候选（路线图 §10 · 不挡 Spike/4a）

| ID | 主题 | 预估 | 状态 | 规格 / 验收 | 启动条件 |
|----|------|------|------|-------------|----------|
| **R3h-0** | 构建 smoke + Win 磁盘 + pip UI 降级 | 2–3d | ✅ **mac** | [r3h-0 acceptance](./r3h-0-asr-sidecar-build-smoke-acceptance.md) · [signoff](./r3h-0-phase-signoff-2026-06.md) | mac ✅ 2026-06-08；Win §4 有 Win 机时补 |
| **TRN-DIAG** | 转写阶段时间线 + 诊断包 | 0.5w | 📋 | [`trn-diag-acceptance.md`](./trn-diag-acceptance.md) | R3t-B ✅ 后；与 ⑤″f 不同目录 |
| **ASR-WARM** | 侧车保活、模型预热 | 0.5–1w | 📋 | [`asr-warm-acceptance.md`](./asr-warm-acceptance.md) | R3t-B ✅；R3h-I1 FSM 设计冻结后 |
| **R3h-2** | 断点续传、GC、C 类升级回滚 | ~1w | ⏳ | remediation §5 Phase 2 | ⑦ 发行成熟轨；**4b 重开 Gate-B 前置** |

## 禁忌（§4.1.3）

- **勿** R3f 大改与 R3e-B 分片同轮  
- **勿** Gate-B 未过即改 `llm-runtime` catalog  
- **勿** ⑤″f-A 手测未签即开 MEM-P0 编码（路线图：⑤″f-B 在 A 闭合后）

## 推荐空档顺序（单人）

```text
1. R3f 安装包零终端手测（mac；R3h-0 mac ✅）
2. 有第二台机器时补：F7 §B 双机词表包手测 → ⑤″f-C 签收
3. Win 机补 R3h-0 §4（可选）
4. TRN-DIAG / ASR-WARM（仍不挡主序）
```

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-04 | 初版：对齐路线图 §10 并行表 + Gate-B No-Go |
| 2026-06-04 | F7 双机手测暂缓；下一刀改为 ⑤″f-D / MEM-P2 / R3h-0 |
| 2026-06-06 | R3h-0 mac 机器闸门 ✅；验收三件套 + `scripts/r3h-0-machine-gate.sh` |
| 2026-06-08 | **R3h-0 mac 签收**；Win §4 豁免；下一刀 → R3f 手测 / Project Hub |
