# Intent: R3t-F — 转写后后处理与编辑效率

> **完整规划（实施真源）**：[`r3t-f-post-transcribe-suite-plan.md`](./r3t-f-post-transcribe-suite-plan.md) **v3**  
> **验收**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md)  
> **调研**：[`r3t-f-post-transcribe-suite-research.md`](./r3t-f-post-transcribe-suite-research.md) · [`r3t-f-edit-memory-for-llm-research.md`](./r3t-f-edit-memory-for-llm-research.md)

## 用户故事

1. **日常改稿**：转写后用 **查找替换（Cmd+F）** 改专名；需要时用 **全文规则预览**；改几次后提示 **加入转写词汇表**，下次听写更准。  
2. **转写后处理（可选）**：一键编排 **规则 + 标点**（默认）；仅对没把握的段开 **AI 词表/语义**，且低置信建议可不写回。  
3. **小团队**：几人互传 **词表包**（网盘/聊天），合并后共享专名与纠错规则；冲突时 **谁改得多谁赢**，拿不准再人工选。  
4. **边界**：不指望等于 Descript 魔法一键；全文重新分段单独做；语义 **只**修不通顺/逻辑。

## 范围

| 在范围内 | 不在范围内 |
|----------|------------|
| P1：F2、F1、F6 | 全文 LLM 段界 v1 |
| P2：F0-lite、F4、**F7**（+可选 F8） | 静默改稿、云词表库 |
| P3：F3、F5 | RAG 整稿、CAT/TM、模型训练 |

## 与 R3t 关系

- **消费** R3t-C/D/E；E 保留独立工具栏入口。  
- **F0-lite** 不替代 F2；默认不含 Cmd+F。  
- **R3t-E** 已编码；本 Epic 扩展记忆交换与编辑主路径，不重复 LexiconPack 契约。
