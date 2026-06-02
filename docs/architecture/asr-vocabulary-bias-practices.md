# ASR 阶段词汇偏置：业内实践与 Rushi 落地评估

> **状态**：架构真源（2026-05-31）  
> **关联**  
> - 本仓运行态真值：[`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md)  
> - 双通道（热词 ≠ LLM Pack）：[`lexicon-guided-llm-refine.md`](./lexicon-guided-llm-refine.md)、[`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md) §在线 STT  
> - 转写后改稿 / 记忆：[`r3t-f-edit-memory-for-llm-research.md`](../execution/specs/r3t-f-edit-memory-for-llm-research.md)、[R3t-F Plan v3](../execution/specs/r3t-f-post-transcribe-suite-plan.md)  
> - 在线厂商：[`stt-online-providers.md`](./stt-online-providers.md)  
> - 改进 backlog：[`r3-asr-landscape-2026-05-improvement-backlog.md`](../execution/specs/r3-asr-landscape-2026-05-improvement-backlog.md)

---

## 1. 目的

回答两件事：

1. **别家如何在 ASR 阶段提高专名准确率、让「热词/自定义词表」真正进解码？**  
2. **Rushi 已有什么、还缺什么、按什么顺序落地？**

**原则**：ASR 偏置只服务 **「希望听成/写成的正形」**；`correction_memory` 的错→对 **不** 直接拼进 `hotwords`（见 §6）。

---

## 2. 能力阶梯（业内）

```text
L0  推理时偏置     phrase list / keywords / hotword 串 / keyterms_prompt
L1  词表 + 输出形   Custom Vocabulary（Phrase + DisplayAs）、custom_spelling（转写后）
L2  领域定制模型   Azure Custom Speech、Deepgram custom model、FunASR 微调
L3  用户校正训练   编辑 → active learning / LoRA（Otter 黑盒、Adapt4Me 等）
```

| 阶梯 | 何时够用 | 代表 |
|------|----------|------|
| **L0** | 少量专名、模型已「近似能听」 | [Azure phrase list](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/improve-accuracy-phrase-list)、[Deepgram keywords/keyterm](https://developers.deepgram.com/docs/keywords)、AssemblyAI keyterms |
| **L1** | 要控制 **转写结果字形**（大小写、连字符） | [AWS Custom Vocabulary DisplayAs](https://docs.aws.amazon.com/transcribe/latest/dg/custom-vocabulary.html)、AssemblyAI [custom_spelling](https://www.assemblyai.com/docs/pre-recorded-audio/correct-spelling-of-terms) |
| **L2–L3** | 口音重、噪声大、词表很大仍不稳 | Custom Speech、厂商 custom model；路线图 **不做** 产品内训练（见 lexicon-mining backlog） |

消费级（Descript/Otter/Sonix）：多为 **小词表 + 转写前注入 + 转写后编辑**，极少公开 keyword weight API。

---

## 3. 竞品 / API 机制对照（ASR 阶段）

| 厂商 / 产品 | ASR 阶段输入 | 生效方式 | 限制与最佳实践 |
|-------------|--------------|----------|----------------|
| **Azure Speech** | Phrase list，表级 weight 0–2 | 解码优先匹配列表内短语 | ≤500 条；即时、无需训练；更大词库 → Custom Speech |
| **Deepgram** | `keywords=词:强度` 或 Nova-3 `keyterm` | 对数概率加权；可 **负强度抑制** | 优先 **单词** OOV；强度宜小步试；短语看模型世代 |
| **AWS Transcribe** | Custom vocabulary 表 | 词表绑定任务；DisplayAs 控输出形 | 表需 READY；发音列已弱化，重 Phrase/DisplayAs |
| **AssemblyAI** | `keyterms_prompt` | 识别偏置 | 与 **custom_spelling**（转写后替换）分离 |
| **OpenAI** | `prompt` 上下文 | 弱偏置，非专用 keyword API | 长度紧（本仓映射 ≤224 字级） |
| **FunASR** | `hotword=` 空格串 | 模型相关；不支持则 TypeError 回退 | 本仓 **12k 字符** 上限；Paraformer 通常优于 SenseVoice |
| **Descript** | Transcription Glossary | Drive 级，≤30 词 | 改 3 次自动入库 |
| **Sonix** | Custom Dictionary | 改正后显式加入 | 账户级后续转写固定拼写 |

---

## 4. 让偏置「真生效」的检查清单（实施与运营）

### 4.1 词表内容

- [ ] 只收录 **canonical 正形**（术语表 `term` + 合理 `aliases`），**不**放 `correction_memory.before_text`（错形）。  
- [ ] 控制 **条数/总字符**（本机 12k；在线看厂商上限）。  
- [ ] 专名场景优先 **Paraformer 类 SKU**；SenseVoice 需预期较弱并在 UI 提示（见 [`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md)）。  
- [ ] 同音 **形错** 规划用 **转写后** F1 / R3t-E，不单靠热词。

### 4.2 运行时

- [ ] 转写响应 `warnings` 必查：`hotwords_ignored_stub`、`hotword_param_unsupported`、`hotwords_truncated_12k`、`online_vocabulary_unsupported`。  
- [ ] UI 与 `deriveTranscribeHints` 一致（[`asrTranscribeHints.ts`](../../apps/desktop/src/services/asrTranscribeHints.ts)）。  
- [ ] **不** 在 UI 宣称「已注入」而 warnings 表明忽略。

### 4.3 闭环（与小团队）

- [ ] 手改稳定 **right** → F6 提示 / 进 `glossary_terms` → 下次 hotwords（[R3t-F §9](../execution/specs/r3t-f-post-transcribe-suite-plan.md)）。  
- [ ] F7 词表包合并 glossary → 全队共享热词。

---

## 5. Rushi 现状（2026-05-31）

| 能力 | 状态 | 代码 / 文档 |
|------|------|-------------|
| glossary → 本机 `hotwords` | ✅ | `glossary_hotwords.rs` → `POST /v1/transcribe` |
| 热词预览 | ✅ | `glossary_hotwords_preview` + `GlossaryPage` |
| FunASR warnings 进 UI | ✅ | `asrTranscribeHints.ts` |
| 在线 STT 分 channel 映射 | ✅ | `sttVocabularyBias.ts` + Rust `SttVocabularyPlan` |
| 转写后 memory hints | ✅ | `correction_rule_hint:*`（非热词） |
| memory → hotwords 直连 | ❌ | 架构禁止；走 glossary |
| Deepgram 逐词 boost 强度 | ❌ | 仅 generic keywords 通道，未暴露 intensifier UI |
| 转写前「本次将用哪家 channel」 | 部分 | 术语库有 summary；转写按钮旁可加强 |
| 专名命中率 A/B 手测基线 | ❌ | 无固定 eval 集 |

---

## 6. 落地评估：分阶段路线图

**整体性评估（顺序拍板）**：[`r3-asr-voc-holistic-review-2026-05.md`](../execution/specs/r3-asr-voc-holistic-review-2026-05.md)  
**实施真源（任务拆片 / 验收）**：[`r3-asr-voc-landing-plan.md`](../execution/specs/r3-asr-voc-landing-plan.md)、[`r3-asr-voc-landing-acceptance.md`](../execution/specs/r3-asr-voc-landing-acceptance.md)

与 [R3t-F Plan v3](../execution/specs/r3t-f-post-transcribe-suite-plan.md) 对齐；**不替代** R3h/R3g 模型/catalog 工作。

### 6.1 总览

```text
ASR-VOC-0  文档 + 守卫（本文 + 既有 truth）     ← 当前
ASR-VOC-1  转写前可见性 + hints 补强             小薄片，可并进 P1
ASR-VOC-2  词表质量 + F6/F7 闭环                 R3t-F P1/P2
ASR-VOC-3  在线 adapter 按厂商最佳实践传参       中薄片，依赖厂商
ASR-VOC-4  可选 memory.right 并入 hotwords      需新拍板，默认不做
ASR-VOC-5  专名 eval 集 + 回归                 与 R3-ACC / backlog 对齐
```

### 6.2 ASR-VOC-1 — 转写前可见性（建议 **1–2d**）

**目标**：用户转写前知道「词表会不会进模型、进了多少、可能被谁忽略」。

| 项 | 落位 | 验收 |
|----|------|------|
| 转写确认/环境条展示 `glossary_hotwords_preview` 摘要 | `TranscribeOverwrite` 旁或 `ProjectStatusFeedback` / 转写按钮 tooltip | 截断时可见 dropped 数 |
| 本机 vs 在线 channel 一行说明 | 复用 `glossaryBiasSummaryForProviderId` | 选 Deepgram 时提示 keywords |
| SenseVoice 弱热词提示 | `deriveTranscribeHints` 或 catalog SKU 元数据 | 选 SenseVoice + 有热词时出现引导 |
| `hotword_param_unsupported` 用户文案 | `asrTranscribeHints.ts` | 手测 stub/旧接口 |

**不改**：FunASR 引擎本身。

### 6.3 ASR-VOC-2 — 词表质量闭环（**R3t-F P1/P2**）

| 项 | 落位 | 验收 |
|----|------|------|
| F6：第三次 right → 进 glossary | `useLexiconProofreadController` / save 路径提示 | 手测进表且 `hotword_enabled=1` |
| F7：小团队 glossary 合并 | `lexicon_bundle.rs` | 合并后 preview 条数增加 |
| 术语库文案：只勾 **希望听成的词** | `GlossaryPage` + [`desktop-capability-ui-state-alignment.md`](./desktop-capability-ui-state-alignment.md) | 与 memory 分工写清 |
| 转写前 glossary 空提示 | 转写 gate（Plan §14） | 空表轻提示 |

### 6.4 ASR-VOC-3 — 在线厂商按最佳实践（**2–4d**，可拆 PR）

| 厂商 | 现状 | 建议增量 |
|------|------|----------|
| **Deepgram** | 映射 `keywords` | 调研是否传 `keyterm`（Nova-3）；**禁止**默认高强度；文档化「单词 OOV」 |
| **AssemblyAI** | `keyterms_prompt` | 控制条数/总长度；与 custom_spelling 文档区分 |
| **OpenAI** | `prompt` 截断 | 术语优先排序进 prompt（按 term 重要度 / hotword_enabled） |
| **custom-proxy** | multipart hotwords | 与 FunASR 契约一致 |

落位：`apps/desktop/src-tauri/src/project/stt_vocabulary.rs`（或现有 adapter）、`sttVocabularyBias.ts`、厂商 adapter 测试。

**验收**：各 channel 单测 + 一条集成 mock；环境页说明更新。

### 6.5 ASR-VOC-4 — memory 正形并入 hotwords（**可选 · 需拍板**）

**仅当** 产品明确要求「少一步进 glossary」：

- `build_glossary_hotwords` 在 glossary 之后追加：`accepted_as_rule=1` 的 **`after_text` only**，去重、上限 **20 词**。  
- UI 标明：「含 N 条来自纠错记忆」。  
- **禁止** 并入 `before_text`。

未拍板前 **不实施**（默认 F6 引导进 glossary 即可）。

### 6.6 ASR-VOC-5 — 专名 eval 回归（**1–2d** 建集 + 纳入 CI 可选）

- fixtures：`docs/execution/fixtures/asr-hotword-eval/`（20–30 秒音频 + glossary + 期望子串）。  
- 脚本：本机 FunASR 开/关 hotwords diff（可 nightly，非 PR 硬门禁）。  
- 登记到 [`r3-asr-landscape-2026-05-improvement-backlog.md`](../execution/specs/r3-asr-landscape-2026-05-improvement-backlog.md)。

---

## 7. 与 R3t 管线关系

```text
转写前   glossary (+ 可选 F6/F7) ──► ASR-VOC-1/2/3 ──► L2 hotwords
转写后   correction_memory ──► hints / F1 / R3t-E（L4）
                │
                └──► 不混入 hotwords（除非 ASR-VOC-4 拍板）
```

| 层 | 模块 | 文档 |
|----|------|------|
| L2 | `glossary_hotwords.rs`、`funasr_engine.py` | 本文 + `asr-hotword-bias-truth.md` |
| L4 | `lexicon_pack.rs`、R3t-E | `lexicon-guided-llm-refine.md` |
| 编排 | F0-lite | R3t-F Plan §8 |

---

## 8. 明确不做（本主题）

- 产品内 **ASR 微调 / LoRA**（lexicon-mining backlog 已排除训练集捷径）。  
- 把 **correction_memory 整对** 写入 `hotwords`。  
- 无 warnings 仍显示「热词已生效」。  
- 用 **postprocess LLM** 替代 L0 偏置（双通道禁止）。  
- 企业级 **TMX 云同步**（小团队 F7 文件交换已覆盖）。

---

## 9. 建议排期（并入路线图）

详见 [`r3-asr-voc-holistic-review-2026-05.md`](../execution/specs/r3-asr-voc-holistic-review-2026-05.md) §5（**⑤″f-A～D**）；任务拆片见 landing-plan §1–§5。

| 顺序 | 包 | 依赖 | 预估 |
|------|-----|------|------|
| 1 | **ASR-VOC-1** | 已有 preview API | 1–2d，可与 R3t-F P1 并行 |
| 2 | **R3t-F F6 + F7** | ASR-VOC-2 词表质量 | F6 2–3d + F7 4–6d + 文案 0.5d |
| 3 | **ASR-VOC-3** | ACC-STT-UNIFY U2 ✅ | 2–4d |
| 4 | **ASR-VOC-5** | `fixtures/eval` 制控样例 | 1–2d 起集 |
| — | ASR-VOC-4 | 产品拍板 | 暂缓 |

**优先验证**：同一专名音频 **开/关热词** + **换 Paraformer SKU** — 比加 ASR-VOC-4 更能判断「热词是否真生效」。

---

## 10. 变更纪律

调整下列行为时须同步更新：

1. [`asr-hotword-bias-truth.md`](./asr-hotword-bias-truth.md) §2 表  
2. [`services/asr/README.md`](../../services/asr/README.md) `hotwords` 说明  
3. `asrTranscribeHints.ts` + 测试  
4. 本文 §5 现状表（若能力升格）
