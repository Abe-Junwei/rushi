# Plan: R3t — 录音转写 · 声学分段 · LLM 校准

> **状态**：规划定稿；**本文档不触发编码**  
> **Intent**：[`recording-transcribe-llm-refine-intent.md`](./recording-transcribe-llm-refine-intent.md)  
> **架构**：[`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)

## 1. 子阶段总览

| ID | 名称 | 预估 | 依赖 | 与现有 roadmap |
|----|------|------|------|----------------|
| **R3t-A** | 声学分段 ASR | 3–5d | R3g ⑤c 手测建议先过 | 吸收 R3g 引擎 + R3e-B **分段内核** |
| **R3t-B** | 转写任务与落库 | 2–4d | R3t-A | 对齐 R3e-A 超时；扩展 `run_transcribe_cmd` |
| **R3t-C** | LLM 标点（窗口） | 1–1.5w | R3t-B；R2 ✅ | 扩展 R2，非替换 |
| **R3t-D** | LLM 段界 ops | 1.5–2w | R3t-C 契约稳定 | 新 `postprocess_refine_segments` |
| **R3t-E** | 词表有据校对 | 1.5–2w | R3t-D；GLY-1 ✅；P2 correction_memory ✅ | [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md) |

**推荐实施顺序**：`R3t-A → R3t-B → R3t-C → R3t-D → R3t-E`（主链串行；C/D/E 的 spec 可提前写）。

**勿与 R3f 编排大改并行**；**R3e-B 实施时必须合并进 R3t-A 设计评审**，避免两套分段。

## 2. R3t-A — 声学分段 ASR（侧车 Python）

### 2.1 行为规格

1. **所有 catalog 模型**（SenseVoice、Paraformer）对长音频（≥3min）默认走 **VAD 语音区 → 逐段识别**。
2. Paraformer：在 VAD 段内尽量 **`sentence_info` 句级**（punc + `sentence_timestamp`）。
3. SenseVoice：至少 **VAD 段级** 多语段；接受句级弱于 Paraformer。
4. `funasr_whole_track_fallback` 仅作 **兜底**（极短音频 <30s 可允许），长音频 **不得作为唯一终态**。
5. `/v1/transcribe` 响应保持 `segments[]` 形状；可增加 `segmentation_mode` 元数据（实施时定）。

### 2.2 规划落位（实施时）

| 文件 | 职责 |
|------|------|
| `services/asr/rushi_asr/funasr_engine.py` | 分段策略、generate 参数、punc/VAD |
| `services/asr/rushi_asr/funasr_pipeline.py` | 模型是否需 punc |
| `services/asr/rushi_asr/model_prepare.py` | punc 权重下载与 cached 判断 |
| `services/asr/tests/test_funasr_engine.py` | 分段逻辑单测（mock generate） |

### 2.3 与 R3e-B 合并点（解除循环依赖）

**编码责任（Q-R3t-2，已拍板）**：

1. **R3t-A** 将分段逻辑提取为独立模块（建议路径）  
   `services/asr/rushi_asr/segmentation.py`  
   对外导出例如 `segment_audio_to_transcription_segments(...)` → `list[TranscriptionSegment]`。
2. **R3e-B** **只消费**该模块：HTTP 分片边界在桌面/Tauri；**片内**调用同一函数；合并时 **偏移 start/end**；**禁止**第二套 VAD/分段实现。
3. 若 R3t-A 已覆盖长音频内核，R3e-B 可 **减量**为进度 UI + 分片编排 + 合并策略。

- 进度事件（段 i/N）在 **R3t-B/R3e-B 桌面或 app.py**，不在 engine 内耦合 UI。

### 2.4 验证

- `pytest services/asr/tests/test_funasr_engine*.py`
- 手测：13min Paraformer ≥10 段；SenseVoice ≥3 段（VAD 级）

## 3. R3t-B — 转写任务与落库（Tauri + React）

### 3.1 行为规格

1. `project_run_transcribe`：拉取前校验 D1=D2（已有 `computeLocalAsrTranscribeReady` 思想）。
2. 长音频：**推导超时**（R3e-A）+ 阶段日志（规范化 / 转写 / 写库）。
3. 解析侧车 `segments` → `SegmentDto`；**整次成功才 `file_save_segments`**（与 r3e 非半成品策略一致）。
4. 将 `warnings` 传到 UI（`asrTranscribeHints` 已有 patterns，扩展 copy）。
5. 转写完成 → 编辑器刷新语段；**不自动触发 LLM**。

### 3.2 规划落位（实施时）

| 文件 | 职责 |
|------|------|
| `apps/desktop/src-tauri/src/project/run_transcribe_cmd.rs` | 超时、解析、原子写库 |
| `apps/desktop/src/services/asrTranscribeHints.ts` | warnings → 用户文案 |
| `apps/desktop/src/pages/useProjectLifecycleController.ts` | 拉取语段编排（保持薄） |
| 新建 `useTranscribeJobController.ts`（可选） | 转写 busy/进度/错误 |

### 3.3 状态模型

| 状态 | UI |
|------|-----|
| `idle` | 可点「拉取语段」 |
| `preflight` | 检查 ASR / 模型 |
| `uploading` | 上传音频 |
| `transcribing` | 进度条或阶段文案 |
| `saving` | 写库 |
| `done` | 刷新编辑器 |
| `error` | 可重试；语段保持上一版 |

## 4. R3t-C — LLM 标点（扩展 R2）

### 4.1 行为规格

1. 保留单语段标点（R2 行为）。
2. 新增可选：**邻段上下文**（前 1 + 后 1）拼入 prompt，输出仍写回 **当前段**。
3. 隐私：首次使用明示；可取消。
4. 失败：不改原文。

### 4.2 规划落位（实施时）

| 文件 | 职责 |
|------|------|
| `postprocess_cmd.rs` | 扩展 request：`neighbor_segments?` |
| `useAutoPunctuateController.ts` | 收集邻段 |
| `AutoPunctuatePreviewDialog.tsx` | 展示是否含上下文 |

**不新建**通用 InferenceEngine。

## 5. R3t-D — LLM 语义段界（新）

### 5.1 行为规格

1. 用户选中 **焦点段** 或 **范围（连续多段）**。
2. 请求体：`segments: { uid, start_sec, end_sec, text }[]`。
3. 响应体：`{ ops: Op[], rationale?: string }`。
4. Rust **校验** ops（时间单调、uid 存在、split 点合法）。
5. UI：**时间轴预览**（merge 缩短条数、split 变两条）+ 文本 diff。
6. 用户确认 → **单事务** 写 SQLite + 刷新波形。

### 5.2 Op 类型（v1 最小集）

| op | 含义 |
|----|------|
| `update_text` | 改字，时间不变 |
| `merge` | 多 uid 合并为一条，时间 [min start, max end] |
| `split` | 单 uid 在 `at_sec` 处拆两条，文本 left/right |

### 5.3 规划落位（实施时）

| 文件 | 职责 |
|------|------|
| `postprocess_cmd.rs` 或 `postprocess_segment_cmd.rs` | `postprocess_refine_segments` |
| `postprocessSegmentOps.ts` | 类型 + 校验纯函数 |
| `useSegmentRefineController.ts` | 编排 |
| `SegmentRefinePreviewDialog.tsx` | 预览 |
| `segmentRefineApply.ts` | ops → SegmentDto 列表 |

### 5.4 与协作预留

- 本地可先写 `edit_log` 行；**不等** R8 `revision_events`。
- ops 序列化 JSON 便于未来同步。

## 6. R3t-E — 词表有据校对（Lexicon-guided proofread）

> **真源**：[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)

### 6.1 目标

在 **R3t-D 稳定段** 上，让 LLM **依据本地词表** 做可解释校对：

| 问题类型 | 依据来源 | 示例 |
|----------|----------|------|
| 同音错字 | `correction_memory` 或 glossary 相近形 | 安波那那 → 安那般那 |
| 术语不统一 | `glossary_terms`  canonical | 前文「涅槃」后文「涅盘」 |
| ASR 近音 | 同上 + 邻段上下文 | 专名被听错 |
| 标点（可选） | 可与 R3t-C 合并一次请求 | 见架构文「合并策略」 |

每条建议变更须带 **`evidence`**（引用的 term 或 wrong→right 规则），UI 可展示；用户确认后才写库。

### 6.2 LexiconPack（Rust 组装，规划）

```typescript
interface LexiconPack {
  glossary_canonical: string[];       // FROM glossary_terms.term
  correction_rules: Array<{
    wrong: string;
    right: string;
    source: "memory" | "glossary";
    weight: "high" | "medium";        // memory: accepted_as_rule → high
  }>;
}
```

- **glossary**：`SELECT term FROM glossary_terms`（已有 `glossary_hotwords_joined` 同源，LLM 用结构化列表）。
- **correction_memory**：`accepted_as_rule=1 OR hit_count>=2`（与 `collect_correction_rule_hints` 同源，上限条数一致或略扩）。
- **禁止**把 LexiconPack 当作无限制 prompt；实施时 cap（如 glossary≤200 条、rules≤40 条）。

### 6.3 与 L2 热词（ASR）的分工

| 阶段 | 机制 | 作用 |
|------|------|------|
| **L2 转写** | `hotwords` 空格串 → FunASR `hotword=` | **识别偏置**，减少错听 |
| **L4 校对** | LexiconPack → LLM prompt | **文本校正**，修复未识别/近音/不一致 |

转写后仍可能出现错字 → **不靠重复转写**，走 R3t-E 一次 LLM（用户触发）。

### 6.4 API（规划）

- 命令：`postprocess_lexicon_proofread`（或与 D 合并为 `postprocess_refine_segments` + `mode: "lexicon"`）
- 请求：`segments[]` + `lexicon_pack` + `focus_uid?`
- 响应：`{ ops: UpdateTextOp[], findings?: Finding[] }`
  - `Finding`：`kind: homophone | inconsistent_term | typo` + `evidence` + `suggested_op_index`

### 6.5 闭环

```text
用户维护 glossary（GLY-1）
    → L2 hotwords 偏置 ASR
    → L4 LLM 用 LexiconPack 校对
    → 用户确认写回
    → segment save 学习 correction_memory（已有 infer_single_replacement）
    → 下次 L2 hints + 下次 L4 rules 均增强
```

可选按钮：**「采纳为纠错规则」** → `accepted_as_rule=1`（需新 Tauri 命令或扩展现有 glossary/correction API）。

### 6.6 规划落位（实施时）

| 文件 | 职责 |
|------|------|
| `project/lexicon_pack.rs`（新） | 从 DB 组装 LexiconPack |
| `postprocess_cmd.rs` | HTTPS + prompt + 响应 JSON 校验 |
| `postprocessLexiconContract.ts` | 类型、evidence 展示 helpers |
| `useLexiconProofreadController.ts` | 编排、预览 |
| `LexiconProofreadPreviewDialog.tsx` | 逐条依据 + 确认 |
| `asrTranscribeHints.ts` | 保持 L2 hints；与 E 文案区分 |

### 6.7 明确不做（R3t-E v1）

- 自动整文件静默校对
- 拼音候选引擎（P2 备注为增强项）
- 翻译词典 / CAT（`translation-dictionary-module.md`）
- LLM 编造词表外「依据」— 响应须可对照到 Pack 内条目，Rust 做抽检
- **领域 RAG**（讲义/全库检索进 prompt）— **当前不做**
- **从语料自动挖掘热词 / 训练建表** — 候选 **LEX-MINE**，见 [`lexicon-mining-backlog.md`](./lexicon-mining-backlog.md)

## 7. 路线图插入建议（§4.1.1 修订草案）

在 **⑤ R3g-A ⑤c 签收后**、**⑨ R3e-B 之前或合并**插入：

```text
⑤c R3g 手测签收
    ↓
⑤' R3t-A/B  录音转写分段 + 落库（合并 e-B 分段内核设计）
    ↓
⑥ R3h-2 …
    ↓
⑨ R3e-B  长音频进度/分片（若未并入 R3t-B）
    ↓
R4 前或 R4 内
    R3t-C  LLM 标点扩展
    R3t-D  LLM 段界
    R3t-E  词表有据校对（glossary + correction_memory）
```

**流式 Epic（STREAM-*）**：插在 **R3t-D 签收后**，不在 R3t 内一起做。

## 8. 测试策略（规划）

| 层 | 类型 |
|----|------|
| Python | `funasr_engine` 分段 mock；prepare punc cached |
| Rust | ops 校验；apply merge/split 单测 |
| TS | `postprocessSegmentOps`；hints mapping |
| E2E | 可选：短 wav 集成（CI 无 GPU 则 skip） |
| 手测 | acceptance 正文清单 |

## 9. 开放问题（实施前决策）

| # | 问题 | **已定默认（2026-05-27）** |
|---|------|---------------------------|
| Q1 | 转写是否 **覆盖** 已有语段 | ✅ **覆盖**；若已有非空语段则 **确认对话框** |
| Q2 | R3e-B 独立 HTTP 分片 vs 侧车内循环 | ✅ **侧车内循环** 优先（单次请求返回完整 `segments[]`）；超长再评估分片 |
| Q3 | LLM 段界 v1 是否支持 **多段范围** | ✅ 支持 **连续段**；不支持跨文件 |
| Q4 | SenseVoice 句级是否强制 | ✅ **不强制**；VAD 段级即可签收 R3t-A |
| Q5 | 校准是否写 `revision` | ✅ v1 **可选 `edit_log` 行**；不等 R8 `revision_events` |

## 10. 词表与纠错记忆（R3t-E，与 Q1–Q5 一并采纳）

见 [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)；子阶段 **R3t-E** 在 **R3t-D 之后**实施，依赖 stable 语段与 D 的 ops 契约。

| 子阶段 | 内容 |
|--------|------|
| **R3t-E1** | LLM 校对：注入 glossary + correction_memory，输出带 `evidence` 的 `update_text` |
| **R3t-E2** | UI：逐条展示依据；用户可「采纳为纠错规则」写回 `correction_memory` |
| **R3t-E3** | 可选：项目级词表范围 | **v1 不做**（路线图 §8.2 Q-R3t-4）；仍全局 glossary |

**与 ASR 热词分工**：L2 仍用 `hotwords` 偏置识别；L4 **不用**空格热词串，而用结构化 **LexiconPack**（见架构文）。

## 11. 终稿 Word 导出（EXP-WORD，L6）

> **Backlog 真源**：[`word-formatted-export-backlog.md`](./word-formatted-export-backlog.md)  
> **基线**：P3 已有 DOCX（[`p3-acceptance.md`](../p3-acceptance.md)）；本 Epic 为 **R3t-E 之后** 的交付版式增强，**不等** 协作 C6。

| 子阶段 | 内容 |
|--------|------|
| EXP-WORD-1～3 | 导出真源对齐；逐字稿/讲稿/干净稿版式 |
| EXP-WORD-4～5 | 可选：修订摘要附录、导出向导 |

**排期**：**R3t-E 之后**、**R4 之前**（路线图 §8.2 **Q-WORD-1～3** 已拍板）。

## 12. 实施门禁（进入编码前）

- [x] 本 plan + intent + architecture 已合并到 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)（§1.7、§4.1.6、§8.2）
- [ ] R3g ⑤c 手测结论已记录（或明确例外）
- [x] Q1–Q5 与 §8.2 Q-R3t-1～4 已写入 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §1.7、§8.2
- [ ] R3e-B 与 R3t-A 合并评审完成（30min 书面结论）
