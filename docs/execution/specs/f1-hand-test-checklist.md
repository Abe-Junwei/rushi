# F1 — 全文纠错规则 手测清单

> **状态**：✅ UI 手测（2026-06-04；**2026-06-11 复测** ✅）  
> **套件**：[`r3-5f-b-hand-test-checklist.md`](./r3-5f-b-hand-test-checklist.md) · **⑤″f-B**  
> **验收真源**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P1 F1

## 机器闸门

```bash
bash scripts/r3-5f-b-machine-gate.sh
```

- [x] `segmentCorrectionRulesApply.test.ts` — 「城市」≠「市」单字规则不误替换

## 环境

- [x] `npm run desktop:dev`；打开含多语段长稿  
- [x] **热词与记忆 → 纠错记忆**：至少 1 条 **稳定规则**（`采纳为规则` 或 `hit_count ≥ 3`），例 `制控→自控`

## §1 — 预览与取消

1. 语段工具栏点 **规则纠错**。  
2. 等待预览列表加载。  
3. 点 **取消**。

**期望**

- [x] 预览展示改前/改后摘要（非裸 uid）  
- [x] 取消后语段正文 **不变**

## §2 — 确认写回

1. 再次打开 **规则纠错** → 确认写回。  
2. **撤销**（⌘Z）一次。

**期望**

- [x] 匹配规则的字面替换正确  
- [x] 写回后可撤销  
- [x] 无 LLM 请求（纯本地规则）

## §3 — 记忆闭环（`confirmed` · R-MEM-SAVE）

1. §2 确认写回后，**立即** 打开 **纠错记忆**（不等自动保存 `draft`）。  
2. 若规则来自 `A→B`，表中应能反映命中或已存在 stable 规则。

**期望**

- [x] **1s 内** 可见变化（同回合 `saveSegments({ quiet: true, countHits: true })`）  
- [x] 本次写回 **不** 依赖后续 `draft` 才落库（见 MEM-P0 §2B）

## §4 — 空规则 / 无匹配

1. 临时清空稳定规则或打开无匹配稿。  
2. 点 **规则纠错**。

**期望**

- [x] 空状态文案清晰（无崩溃）  
- [x] `busy` 时按钮禁用

---

## 签收

| 日期 | 结果 | 备注 |
|------|------|------|
| 2026-06-04 | ✅ | mem-p0 §3 纠错规则写回 |
| 2026-06-11 | ✅ | 复测；`r3-5f-b-machine-gate.sh` ✅；§1–§4 |
