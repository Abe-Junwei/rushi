# 并行薄片索引（不挡 v1 后主序 · 2026-06-11 刷新）

> **主序真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10  
> **纪律**：每轮仍 **一轮一薄片**；下列项 **勿与 R3h-1-R CI 大改同 PR**

## 当前主序（2026-06-11 · v1 后硬化）

```text
Step 1  R3h-1-R Release CI          ✅ 编码 2026-06-11
Step 2  TRN-DIAG 手测闭项           ← 当前主刀
Step 3  ASR-WARM release idle        （可选）
Step 4  ACC 在线 E2E                 （有 Key 时）
```

| 步 | 项 | 状态 | 说明 |
|----|-----|------|------|
| **1** | **R3h-1-R CI** | ✅ 编码 | [checklist](./r3h-1-r-release-checklist.md) · `ci-publish-runtime-manifest-release.sh` |
| **2** | **TRN-DIAG** | 🟡 ← 当前 | [`trn-diag-acceptance.md`](./trn-diag-acceptance.md) — 2 项手测待勾 |
| **3** | **ASR-WARM release** | 🟡 可选 | dev ✅；[`handtest`](./asr-warm-handtest-signoff-2026-06-11.md) §H5 |
| **4** | **ACC 在线 E2E** | ⏳ | 百炼/三家；有 Key 时 |

### 已闭合硬化步（不挡主刀）

| 项 | 状态 | 说明 |
|----|------|------|
| **R3h-I1** | ✅ | 设计冻结 + I1a 编码 |
| **ASR-WARM dev** | ✅ | 侧车保活 + 预热 |
| **语段正文 P0** | ✅ | [`segment-text-input-p0-acceptance.md`](./segment-text-input-p0-acceptance.md) |
| **⑤″f F2/F1/F6** | ✅ | 复测 2026-06-11 |
| **F8** | ✅ | 导出预览向导 |
| **F4-ASR** | ❌ No-go | 无 ASR confidence 真源 |
| **Gate-B / 4b** | ❌ No-Go | [`llm-loc-gate-b-decision-2026-06.md`](./llm-loc-gate-b-decision-2026-06.md) |
| **R3s-A** | 📋 Defer | Qwen3 战略预留 |

## 并行候选（路线图 §10.3 · 不挡 Step 1）

| ID | 主题 | 预估 | 状态 | 规格 / 验收 | 启动条件 |
|----|------|------|------|-------------|----------|
| **R3h-0** | 构建 smoke + Win 磁盘 + pip UI 降级 | 2–3d | ✅ **mac** | [r3h-0 acceptance](./r3h-0-asr-sidecar-build-smoke-acceptance.md) | Win §4 ⏸ 有 Win 机时补 |
| **R3h-1-R** | Runtime manifest **发行激活** | 3–5d | ✅ R1+R2 · **CI 编码 ✅** | [signoff](./r3h-1-r-phase-signoff-2026-06.md) · [plan](./r3h-1-r-runtime-manifest-release-activation-plan.md) | 首次 release 待 secret |
| **R3h-2** | 断点续传、GC、C 类升级回滚 | ~1w | ✅ | [`r3h-2 acceptance`](./r3h-2-local-runtime-resume-acceptance.md) | 已签收 |
| **R3h-3.5** | Sherpa **Paraformer** Spike | ~1w | ✅ Partial Go | [`r3h-3.5-sherpa-spike-acceptance.md`](./r3h-3.5-sherpa-spike-acceptance.md) | R3h-3 ✅ |
| **TRN-DIAG** | 转写阶段时间线 + 诊断包 | 0.5w | 🟡 | [`trn-diag-acceptance.md`](./trn-diag-acceptance.md) | Step 2 主刀候选 |
| **ASR-WARM** | 侧车保活、模型预热 | 0.5–1w | ✅ dev / 🟡 release | [`asr-warm-acceptance.md`](./asr-warm-acceptance.md) | release idle 可选 |
| **ACC-STT-ALI** | 百炼热词 | — | 🟡 | [`acc-stt-ali-hand-test-checklist.md`](./acc-stt-ali-hand-test-checklist.md) | 有 Key |
| **R3f Win** | 安装包零终端手测 | 2–3d | ⏸ **豁免** | [r3f signoff](./r3f-phase-signoff-2026-06.md) | 有 Win 机时补 |
| **R3t-E** | 词表校对（独立产品） | — | ⏸ **已移除** | 能力在 **F0 阶段 B** | — |
| **F3 / F5** | P3 未编码 | — | 📋 | r3t-f plan | v1 后按需 |

## 禁忌（§4.1.3）

- **勿** R3f 大改与 R3e-B 分片同轮  
- **勿** Gate-B 未过即改 `llm-runtime` catalog  
- **勿** Release CI 与大规模 UI 重设计同 PR

## 推荐空档顺序（单人）

```text
1. ~~R3h-I1 FSM 设计冻结~~ ✅
2. ~~ASR-WARM dev~~ ✅
3. ~~语段正文输入 P0~~ ✅
4. ~~F8 导出预览~~ ✅
5. ~~F2/F1/F6 复测~~ ✅ 2026-06-11
6. ~~**R3h-1-R Release CI**~~ ✅ 编码
7. **TRN-DIAG 手测闭项** ← 下一刀
8. ASR-WARM release idle（可选）
9. ACC 在线 E2E（有 Key）
10. 背景：R3f Win ⏸ · R3s-A Defer · F3/F5 P3
```

## 修订

| 日期 | 说明 |
|------|------|
| 2026-06-04 | 初版：对齐路线图 §10 并行表 + Gate-B No-Go |
| 2026-06-08 | **R3h-0 mac 签收**；Win §4 豁免 |
| 2026-06-10 | **R3h-1-R** R1/R2 ✅；**R3h-2** ✅ |
| 2026-06-11 | **I1 + ASR-WARM dev + 语段 P0 + F8 + F2/F1/F6** 闭合 |
| 2026-06-11 | **v1 后硬化盘点**：主刀 → **R3h-1-R CI**；TRN-DIAG 🟡；F4 No-go；R3t-E ⏸ |
