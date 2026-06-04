# ⑤″f-B — 词表与改稿（F1 + F6 + MEM-P0）手测总清单

> **状态**：✅ 签收（2026-06-04）  
> **前置**：**⑤″f-A** ✅（F2 手测 2026-06-04）  
> **真源**：[`r3-asr-voc-holistic-review-2026-05.md`](./r3-asr-voc-holistic-review-2026-05.md) §5 · [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §10

## 范围（本阶段「全开」）

| 包 | 手测清单 | 编码 | 手测 |
|----|----------|------|------|
| **F1** 全文纠错规则 | [`f1-hand-test-checklist.md`](./f1-hand-test-checklist.md) | ✅ | ✅ 2026-06-04（mem-p0 §3） |
| **F6 / F6+** 纳入记忆 + hit≥3 进表 | [`f6-f6plus-mem-hand-test-checklist.md`](./f6-f6plus-mem-hand-test-checklist.md) | ✅ | ✅ 2026-06-02（§A/B）；§C 可选 |
| **MEM-P0** 纳入记忆 / 保存计次 / 自动术语表 | [`mem-p0-hand-test-checklist.md`](./mem-p0-hand-test-checklist.md) | ✅ | ✅ 2026-06-04 |

**本阶段不含**：R3t-E（已移除）、F7 词表包（⑤″f-C）、MEM-P1（⑤″f-B½）。

## 机器闸门（签收前必绿）

```bash
bash scripts/r3-5f-b-machine-gate.sh
```

| 项 | 命令/证据 |
|----|-----------|
| typecheck + test + arch guard | 脚本内 |
| F1 规则单测 | `segmentCorrectionRulesApply.test.ts` |
| F6 纳入记忆 | `manualCorrectionMemory.test.ts` · `useManualCorrectionMemoryDialog.test.ts` |
| MEM 自动保存 hit | `useAutoSaveSegments.test.ts` |
| Rust correction | `cargo test correction`（若本机 Rust 可用） |

## 推荐手测顺序（约 60–90min）

```text
1. bash scripts/r3-5f-b-machine-gate.sh
2. F6 §A–B（若 2026-06-02 已签，仅 spot-check §A 右键纳入）
3. F1 全文 §1–§4
4. MEM-P0 §1–§3（与 F2 Replace All / F1 交叉验证）
5. （可选）F6 §C 挖掘推荐
```

## 阶段闭合条件

```text
F1 手测 ✅  AND  MEM-P0 手测 ✅  AND  F6 §A/B 仍有效（已签或复测）
→ ⑤″f-B 签收 → 路线图开 ⑤″f-B½（MEM-P1）或 ⑤″f-C（F7）
```

## 子清单签收汇总

| 子项 | 日期 | 结果 |
|------|------|------|
| F1 | 2026-06-04 | ✅ |
| F6 §A/B | 2026-06-02 | ✅ |
| F6 §C Mine | | ⏳ 可选 |
| MEM-P0 | 2026-06-04 | ✅ |
| **⑤″f-B 总签** | 2026-06-04 | ✅ |

## 日志模板

```text
改动：⑤″f-B 手测
验证：f1 + mem-p0 清单；F6 复测 spot-check
下一轮：⑤″f-B 总签 → B½ 或 F7
```
