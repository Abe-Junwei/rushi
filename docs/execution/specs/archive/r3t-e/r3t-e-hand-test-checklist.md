# R3t-E — 词表有据校对 手测清单

> **状态**：**已移除**（2026-06，产品决策；功能与 `postprocess_lexicon_proofread` 已从桌面端删除）  
> ~~**机器闸门 ✅** 2026-06-04~~ — 以下清单仅作历史参考  
> **前置**：R3t-C/D ✅；LLM 配置 + 探测可用；**热词与记忆** 含 ≥1 条术语  
> **关联**：[`recording-transcribe-llm-refine-acceptance.md`](../../recording-transcribe-llm-refine-acceptance.md) §R3t-E · [`r3-asr-voc-holistic-review-2026-05.md`](../../r3-asr-voc-holistic-review-2026-05.md) §5 闸门

## 机器闸门（编码签收前必绿）

```bash
bash scripts/r3-5f-a-machine-gate.sh
```

- [x] `useLexiconProofreadController.test.ts` — consent / preview / 部分写回 / cancel / 转写 preview 门禁  
- [x] `postprocess_lexicon_ops` Rust — rule/glossary/inconsistent_term grounding + JSON 解析  
- [x] `lexicon_pack` Rust — glossary + memory 组装

---

## 环境

- [ ] 设置 → LLM：DeepSeek（或兼容 OpenAI API）已保存 Key，探测成功  
- [ ] 打开含多语段项目；侧车 **非必须**（本任务只走 LLM 后处理）  
- [ ] **热词与记忆**：添加术语 canonical **「安那般那」**（勾选纳入热词）

## §1 — 专名改正（glossary / rule）

**准备**

1. 选中一条语段，正文为 ASR 误听形 **「安波那那」**（可手改一条测试语段）。

**操作**

1. 语段工具栏点 **词表校对**。  
2. 首次：确认隐私对话框标题含 **「将语段与词表发送至云端 LLM」**，点 **继续**。  
3. 等待预览。

**期望**

- [ ] 预览列表含改字建议 **「安波那那」→「安那般那」**  
- [ ] 依据标签为 **纠错记忆** 或 **术语表**（含 ref 摘要）  
- [ ] 点 **取消**：语段正文不变  
- [ ] 重跑并 **确认写回**：正文变为「安那般那」

## §2 — 术语统一（inconsistent_term）

**准备**

1. 术语表含 **「涅槃」**。  
2. 相邻两条语段分别手改为 **「涅盘」** 与 **「涅槃」**（或仅一条含错形）。

**操作**

1. 选中其中一条，执行 **词表校对** → 预览。

**期望**

- [ ] 至少一条建议依据为 **术语统一**（`inconsistent_term`）  
- [ ] ref 含 canonical「涅槃」或「统一为：涅槃」类文案

## §3 — 采纳规则 + 记忆闭环（可选）

**操作**

1. §1 预览中勾选 **「将已勾选且含纠错记忆的替换，采纳为纠错规则」**。  
2. 确认写回 → 保存项目（若未自动保存）。  
3. 再次转写同形误听（或查看转写 hints / 纠错记忆页）。

**期望**

- [ ] 纠错记忆出现 `安波那那→安那般那` 且 **采纳为规则** 或 hit 增加  
- [ ] 下次转写 warnings 可含 `correction_rule_hint`（与 P2 一致，可选）

## §4 — L2 分工回归

- [ ] 仅维护 glossary、**不跑 R3t-E**：本机转写 hotwords 路径仍正常（转写前 preview 见术语）  
- [ ] 跑 R3t-E **不触发重新转写**：改正仅来自 LLM 预览确认

## §5 — 隐私与空词表

- [ ]  consent 文案说明语段 + 词表条目将发往 LLM；确认前不改库  
- [ ] 清空术语且无稳定 memory 时，点 **词表校对** → 错误提示 **词表为空**（不发起 HTTP）

---

## 签收

| 日期 | 结果 | 备注 |
|------|------|------|
| | ⏳ | |

**签收后**：更新 [`recording-transcribe-llm-refine-acceptance.md`](../../recording-transcribe-llm-refine-acceptance.md) §R3t-E 手测项；若 §1–§4 全绿，可开 **⑤″f-B**（F1+F6+MEM-P0）。
