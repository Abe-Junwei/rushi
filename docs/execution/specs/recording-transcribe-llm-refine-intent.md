# Intent: R3t — 录音转写 · 声学分段 · LLM 校准

> **状态**：规划定稿；**未开始编码**  
> **Epic ID**：**R3t**（Recording Transcribe → Segment → LLM Refine）  
> **架构真源**：[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)

## 目标

为**已录制/导入音频**提供可签收的产品管线：

1. **本机 ASR 转写**产出 **多条带时间轴的 stable 语段**（所有 catalog 模型一致可达，非整轨单段兜底）。
2. 用户在编辑器内对 **stable 语段** 发起 **LLM 校准**（标点 → 段界 → **词表有据校对**），**预览确认后写回**，不静默改库。

## 为什么现在规划、稍后实施

- R3g / R3e 已暴露：**分段真源在 ASR**，LLM 不能代替 VAD/时间戳。
- R2 已验证：**云端 LLM + 预览写回** 路径可行；需扩展到「段界」而非重做 ASR。
- 流式/mic 明确 **排在 R3t 之后**，避免双真源与 partial 复杂度。

## 用户任务（主路径）

### 路径 A — 录音转写（无 LLM）

1. 打开项目与音频文件。
2. 确认本机 ASR 就绪（所选模型已应用且已缓存）。
3. 点击「从 ASR 拉取语段」。
4. 等待进度（长音频可见阶段文案）。
5. 得到 **多条语段**，波形与时间轴对齐，可编辑保存。

### 路径 B — LLM 校准（在 A 之后）

1. 选中一条或多条语段（v1 以选中段 + 邻段窗口为主）。
2. 点击「自动标点」「AI 校准段界」或「AI 校对（词表）」（名称实施时定）。
3. 阅读隐私提示（**语段与词表条目**将发云端）。
4. 查看 diff / 时间轴变更预览。
5. 确认写回或取消；取消则 ASR 原文不变。

### 路径 C — 交付导出（在 A/B 定稿后）

1. 人工校对并保存语段。
2. 工具栏选择交付形态（逐字稿 / 讲稿·干净稿；可选修订摘要附录）。
3. 导出 DOCX，用 Word 打开验证版式；**不反写** SQLite。

> Epic **EXP-WORD**（L6）：[`word-formatted-export-backlog.md`](./word-formatted-export-backlog.md)；排期 **R3t-E 之后**（路线图 §4.1.1）。

## 目标内范围（按子阶段）

| 子阶段 | 范围 |
|--------|------|
| **R3t-A** | 侧车：全模型声学分段 ASR；`sentence_info` 或 VAD 段；warnings 可观测 |
| **R3t-B** | 桌面：转写任务编排、进度、原子写库、失败分类与恢复提示 |
| **R3t-C** | LLM：标点（继承/扩展 R2，带邻段上下文可选） |
| **R3t-D** | LLM：结构化 segment ops（merge/split/update_text）+ 预览应用 |
| **R3t-E** | LLM：词表有据校对（glossary + correction_memory，同音/术语不一） |
| **EXP-WORD** | 终稿 Word 格式化导出（P3 基线之上；单机；非协作 C6） |

架构：[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md) · 导出：[`word-formatted-export-backlog.md`](./word-formatted-export-backlog.md)

## 明确不做（v1）

- 实时流式、mic、partial 语段落库
- 「全轨转写 → LLM 纯文本切段 → 再估时间」作为主路径
- LLM 自动跑在转写完成后（必须用户显式触发）
- 整文件批量静默校准
- 本地 vLLM / LLM 进侧车
- 说话人分离、翻译、摘要（另 Epic）
- 翻译词典 CAT（≠ glossary）
- 领域语料 **RAG / 检索增强校对**（**当前不做**；R3t-E 仅 LexiconPack）
- 无依据的 LLM 改写（R3t-E 须可对照 LexiconPack）

## 边界决策

### ASR vs LLM

```text
ASR（侧车）  → segments + 时间 + warnings
LLM（Rust）  → 候选文本/ops → 用户确认 → updateSegment
```

### 与 R3e-B 关系

- **一个分段真源**：`funasr_engine` +（如需）长音频 **逐段 HTTP 或侧车内循环** 由 **R3t-A/B 与 R3e-B 共用设计**，不得 fork 两套 VAD 逻辑。
- R3e-B 侧重：**>30min 内存/进度**；R3t 侧重：**语段质量 + LLM 下游**。

### 与 R2 关系

- R2 **不废弃**；R3t-C 为其超集（上下文窗口）。
- R3t-D **新能力**，不复用 `auto_punctuate` 命令。
- R3t-E **新命令** `postprocess_lexicon_proofread`（名称实施时定）。

### 与 P2 词表关系

- **L2**：`glossary_terms` → `hotwords`（已有，见 [`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)）。
- **L4**：同一 glossary + `correction_memory` → **LexiconPack**（结构化，见 [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)）。
- 转写后的 `correction_rule_hint:*` **保留**；R3t-E 是主动改正，不是替代 hints。

## 成功标准（Epic 级）

- 13min 中文样本：拉取后 **≥10 条 stable 语段**（Paraformer；SenseVoice 至少 VAD 段级，非整轨一条）。
- warnings 含 `funasr_whole_track_fallback` 时：UI **显式提示**且不得标为「校准就绪」。
- LLM 标点：10 条样本人工合理率 **>80%**（延续 R2 口径）。
- LLM 段界（R3t-D）：5 条长段样本，merge/split 预览 **时间单调、无重叠**；用户拒绝则不改库。
- LLM 词表校对（R3t-E）：错词/术语不一 样本；预览须展示 **依据**（术语表或纠错记忆）。

## 依赖与前置

| 前置 | 状态 |
|------|------|
| 语段 uid、草稿 store、波形 | ✅ |
| R2 auto_punctuate + keychain | ✅ |
| R3g-A ⑤a 模型/catalog | ✅ 编码 |
| R3g-A ⑤b UI 状态 | ✅ 编码；手测 ⏳ |
| R3e-A 动态超时 | 🟡 编码 |
| postprocess-remote-boundary | ✅ |

**建议实施门禁**：R3g ⑤c（多语段手测）通过后再开 **R3t-A** 引擎收口；R3t-C/D/E 的 spec 可提前写；**E 依赖 D 的写库与 B 稳定段**。

## 非目标体验

- 不要求「转写完成即自动标点」
- 不要求云端 LLM 读音频（v1 仅文本）
