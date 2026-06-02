# 词表有据校对（Lexicon-guided LLM Refine）

> **状态**：**编码完成**（2026-05-31）；手测签收待办  
> **Epic**：R3t-E（[`recording-transcribe-llm-refine-plan.md`](../execution/specs/recording-transcribe-llm-refine-plan.md)）  
> **调研 brief**：[`r3t-e-lexicon-proofread-research.md`](../execution/specs/r3t-e-lexicon-proofread-research.md)（编码前门禁 ✅ 2026-05-31）  
> **关联**：[`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md)、[`p2-acceptance.md`](../execution/p2-acceptance.md)、[`postprocess-remote-boundary.md`](./postprocess-remote-boundary.md)

## 1. 问题

用户已有：

| 资产 | 存储 | 当前用途 |
|------|------|----------|
| **术语表** | `glossary_terms.term` | GLY-1 管理；转写时拼 **`hotwords`** 进 ASR |
| **纠错记忆** | `correction_memory` (wrong→right, hits, accepted) | 保存语段时学习；转写后 **warning 提示** 命中 |

缺口：**LLM 校准**未消费词表，无法系统处理 **同音错字、前后术语不一、有据改正**；转写 hints 仅提醒，不自动改稿。

## 2. 原则

1. **双通道、各在其位**：ASR 用 `hotwords` **偏置听写**；LLM 用 **LexiconPack** **改稿**，不用同一串空格热词糊弄 prompt。
2. **有据可查**：每条建议修改必须引用 Pack 内 **canonical term** 或 **correction_rule**，UI 展示 `evidence`。
3. **用户确认**：与 R2/R3t-D 一致；失败/取消不改库。
4. **闭环**：确认后的写回继续写入 `correction_memory`（已有）；可选「采纳为规则」提升权重。

## 3. 端到端中的位置

```text
glossary_terms ─────┬──► L2 POST /v1/transcribe  field hotwords  (已有)
                    │
correction_memory ──┼──► L2 warnings correction_rule_hint:*     (已有)
                    │
                    └──► L4 LexiconPack ──► postprocess_lexicon_proofread (R3t-E)
                              ▲
                         用户触发 · stable 语段窗口
```

## 4. LexiconPack 契约（规划）

```typescript
interface CorrectionRule {
  wrong: string;
  right: string;
  source: "memory" | "glossary";
  weight: "high" | "medium";  // accepted_as_rule → high；hit_count≥2 → medium
}

interface LexiconPack {
  glossary_canonical: string[];
  correction_rules: CorrectionRule[];
  pack_meta?: { glossary_count: number; rules_count: number; truncated?: boolean };
}
```

### 4.1 组装规则（Rust）

| 来源 | SQL / 逻辑 | 上限（建议） |
|------|------------|--------------|
| glossary | `SELECT term FROM glossary_terms ORDER BY term` | 200 条，超出截断并 `truncated: true` |
| memory rules | 同 `collect_correction_rule_hints` 条件 | 40 条 |
| glossary→rule | v1 **不自动**把 term 拆 wrong→right；仅作 **canonical 锚点** | — |

**同音/术语不一** 由 LLM 在 prompt 中完成：给定 canonical 列表 + 段内文本，要求统一用表内形；并扫描 memory 中的 wrong 形。

### 4.2 Prompt 约束（规划要点）

- 角色：中文转写校对，**只输出 JSON**。
- 输入：`segments[]` + `lexicon_pack`。
- 任务优先级：
  1. 应用 `correction_rules` 中 high 权重替换（字面或同音匹配）。
  2. 段内与邻段：同一专名/术语统一为 `glossary_canonical` 中最接近项。
  3. 标点可交给 R3t-C 或本任务次要项（避免重复调用时二选一，见 §6）。
- 每条 `update_text` op 必须含 `evidence: { type, ref }`：
  - `type: "rule"` → `ref: "wrong→right"`
  - `type: "glossary"` → `ref: "<canonical term>"`
  - `type: "inconsistent_term"` → `ref: "统一为：<term>"`

### 4.3 响应校验（Rust）

- `evidence.ref` 必须能在 Pack 中找到对应项或子串（防止幻觉依据）。
- 无法关联的 op **丢弃** 并记 `warnings: dropped_ungrounded_ops`.

## 5. 与现有 P2 能力对照

| P2 能力 | L2 转写 | R3t-E LLM |
|---------|---------|-----------|
| 术语库 | hotwords 偏置 | canonical 统一 + 显示依据 |
| 纠错记忆 | 命中 warning | 主动改正 + 依据展示 |
| 低置信 | UI/导出标识 | 可选：低置信段优先排队校对（v2） |
| 拼音近音 | 未做 | LLM 推断 + rules，非独立拼音引擎 |

## 6. 与 R3t-C / R3t-D 合并策略

| 策略 | 说明 | 建议 |
|------|------|------|
| **分开三次** | 标点 → 段界 → 词表校对 | 清晰、成本高 |
| **合并一次** | `postprocess_refine` mode=`full` | 省 token；prompt 复杂 |
| **默认（v1）** | C 单段标点；**E 窗口词表校对**；D 按需 | 用户菜单分开；E 覆盖错字+术语 |

实施时在 plan 中固定 v1 为 **分开触发**。

## 7. UI（规划）

**入口**（编辑器语段工具栏）：

- 「自动标点」（R3t-C）
- 「AI 校对（词表）」（R3t-E）— 明示将发送 **语段 + 词表条目** 到云端

**预览**：

| 列 | 内容 |
|----|------|
| 原文/改文 diff | 同 R2 |
| 依据 | 「纠错记忆：安波那那→安那般那」或「术语表：安那般那」 |
| 类型标签 | 同音 / 术语不一 / 规则替换 |

**操作**：全部采纳 / 逐条采纳 / 取消；可选「采纳为纠错规则」→ `accepted_as_rule=1`。

## 8. 隐私与体积

- 发送内容：语段文本 + **词表条目（非密钥）** + correction 对。
- 首次使用：在 R2 隐私文案上 **追加**「词表条目将一并发送」。
- Pack 截断时 UI 提示「仅发送前 N 条术语/规则」。

## 9. 验收要点（索引）

详见 [`recording-transcribe-llm-refine-acceptance.md`](../execution/specs/recording-transcribe-llm-refine-acceptance.md) §R3t-E。

## 10. 不做（v1）

- 项目级独立词表（仍全局 `glossary_terms`）
- MCP 写术语（roadmap 可选）
- 本地 LLM 跑校对
- 无依据的「智能改写」或风格润色
- **领域语料 RAG / 检索增强校对**（**当前不做**，2026-05-27；远期需引用片段 + evidence，见路线图 §8）
- **自动挖词 / 训练建表** → 见 [`lexicon-mining-backlog.md`](../execution/specs/lexicon-mining-backlog.md)（**LEX-MINE** 候选，非 R3t-E v1）
