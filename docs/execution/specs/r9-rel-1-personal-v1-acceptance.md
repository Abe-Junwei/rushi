# Acceptance: R9 — REL-1 个人单机 v1 发版集成验收

> **状态**：✅ **验收通过**（2026-06-03 · 严格手测 + 产品确认）  
> **签收**：[r9-rel-1-strict-signoff-2026-06.md](./r9-rel-1-strict-signoff-2026-06.md)（取代 [代理签收](./r9-rel-1-signoff-2026-06.md)）  
> **命令**：`bash scripts/r9-rel-1-strict-hand-test.sh` · `bash scripts/r9-rel-1-machine-gate.sh`

---

## 目标

证明 **个人用户** 可在无协作能力的前提下，用桌面端完成：**装 ASR → 转写 → 编辑 → 导出 Word → 质量可回归** 的主路径；**不以 R6–R8 为门禁**。

---

## 硬门禁

| # | 项 | 状态 |
|---|-----|------|
| H1 | 机器守卫 | ✅ |
| H2 | R4-GATE | ✅ |
| H3 | R3t-B | ✅ 2026-06-03 严格轮 |
| H4 | R3t-C | ✅ 2026-06-03 严格轮 |
| H5 | R3e-B | ✅ + 当场 48min API |
| H6 | EXP-WORD | ✅ + 当场 DB→DOCX |
| H7 | REV-LOC | ✅ + 机器复检 |

---

## 主路径

| 项 | 状态 |
|----|------|
| A1 | ✅ API prepare-default + 环境就绪 |
| A2 | ✅ |
| A3 | ✅ |
| B1 | ✅ 当场 13min Paraformer · 47 段 |
| B2 | ✅ 当场 2918s · 分窗 10 · 47 段 |
| B3 | ✅ |
| C1 | ✅ REV-LOC A |
| C2 | ✅ REV-LOC B |
| D1 | ✅ DOCX + textutil |
| D2 | ✅ |
| E1 | ✅ |
| F5 E2E | ✅（代理轮 `desktop:test:e2e`） |

---

## 机器命令

```bash
bash scripts/r9-rel-1-strict-hand-test.sh
bash scripts/r9-rel-1-machine-gate.sh
```

---

## 签收表

| 日期 | 结论 | 备注 |
|------|------|------|
| 2026-06-03 | ✅ **验收通过** | strict-signoff · 产品确认 |
