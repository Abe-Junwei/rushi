# Plan: ASR-VOC — 词汇偏置落地（转写前可见性 → 词表闭环 → 在线优化 → eval）

> **状态**：规划定稿（2026-05-31）· **未编码**（ASR-VOC-0 文档 ✅）  
> **整体性评估（顺序拍板）**：[`r3-asr-voc-holistic-review-2026-05.md`](./r3-asr-voc-holistic-review-2026-05.md) — **排期以本文 + 路线图 §5 ⑤″f-A～D 为准**  
> **架构真源**：[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md)、[`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)  
> **验收**：[`r3-asr-voc-landing-acceptance.md`](./r3-asr-voc-landing-acceptance.md)  
> **关联**：路线图 **⑤″f 词表与改稿轨**（R3t-F + ASR-VOC 子包）；**⑤″f-5 = ACC-EVAL-1 = ASR-VOC-5**（同一项）  
> **排期真源**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §4.1.1 **⑤″f**

---

## 0. 文档角色

| 文档 | 用途 |
|------|------|
| **本文** | ASR-VOC-1/2/3/5 任务拆片、落位、依赖、工期、与 R3t-F 并行策略 |
| `asr-vocabulary-bias-practices.md` | 业内对照 + 能力阶梯（不重复展开） |
| `r3t-f-post-transcribe-suite-plan.md` | F2/F1/F6/F7 规格真源；ASR-VOC-2 **不重复** F7 JSON 细节 |
| `r3-asr-voc-landing-acceptance.md` | 各包可勾选验收 |

**硬约束（全包）**

- `correction_memory.before_text` **不得** 进 `hotwords`（ASR-VOC-4 默认 **No**）。  
- 双通道：L2 热词 ≠ L4 LexiconPack（[`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md)）。  
- 运行时真源：`engine` + `warnings`（[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)）。

---

## 1. 总览与排期

### 1.1 包索引

| 优先级 | 包 | 用户价值 | 估时 | 依赖 | 与 R3t-F |
|--------|-----|----------|------|------|----------|
| **1** | **ASR-VOC-1** | 转写前知道词表会不会进模型 | **1–2d** | HOT-UX ✅、`glossary_hotwords_preview` ✅ | **可并行** P1（不占 F2 首刀） |
| **2** | **ASR-VOC-2** | F6 + F7 + L2 文案 + 空表提示（**§3 全文**） | **7–10d**（P1 2–3d + P2 4–6d + 文案 0.5d） | R3t-F P1/P2 | **与 Plan v3 双真源**；F2/F1 仍只读 R3t-F |
| **3b** | **ASR-VOC-5**（= **ACC-EVAL-1**） | 热词 on/off `term_hit` baseline | **1–2d** | 制控样例 | **⑤″f-A**，在 **F7 之前** |
| **4** | **ASR-VOC-3** | 在线三家传参优化 | **2–4d** | ACC ✅ + 在线 E2E ⏳ | **⑤″f-D**（可 slip） |
| **—** | **ASR-VOC-4** | memory 直连 hotwords | **暂缓** | 产品拍板 | 默认 **F6→glossary** |

### 1.2 执行分期（⑤″f-A～D · 与 holistic review 一致）

| 期 | 墙钟 | 内容 |
|----|------|------|
| **A** | ~1–2 周 | **VOC-1** ‖ **R3t-F F2**；**VOC-5**（eval baseline） |
| **B** | ~1–1.5 周 | **F1** + **F6**（VOC-2a）+ **L2/空表文案**（VOC-2c/d） |
| **C** | ~1–1.5 周 | **F7**（VOC-2b）+ **F0-lite**（可选） |
| **D** | ~0.5–1 周 | **VOC-3**（闸门：ACC 在线 E2E ≥1 家手测通过） |

**闸门**：R3t-E 手测 → 开 A；VOC-1 不要求 R3t-F 已编码；**VOC-5 在 F7 之前**（先可观测 baseline）。

### 1.3 已有能力（不重复造）

| 能力 | 状态 | 路径 |
|------|------|------|
| `glossary_hotwords_preview` | ✅ | `glossary_cmd.rs`、`glossaryHotwords.ts` |
| 术语库页摘要 | ✅ HOT-UX | `GlossaryPage`、`formatGlossaryHotwordsTranscribeSummary` |
| 转写后 hints | ✅ | `asrTranscribeHints.ts`、`TranscribeHintsBanner` |
| 在线 channel 映射 | ✅ ACC | `stt_vocabulary.rs`、`sttVocabularyBias.ts` |
| eval `term_hit` 样例 | ✅ 单条 | `fixtures/eval` `proper-noun-zhikong` |
| F7 词表包 | ❌ | Plan v3 §11 |
| 转写确认框热词摘要 | ❌ | `TranscribeOverwriteConfirmDialog` 仅覆盖警告 |

---

## 2. ASR-VOC-1 — 转写前可见性（1–2d）

### 2.1 目标

用户在 **点击「从 ASR 拉取」之前** 看到：

1. 本次将提交多少热词 token、是否截断；  
2. **本机 FunASR** vs **当前在线厂商** 的术语通道（支持 / 不支持 / 截断类型）；  
3. 若选 **SenseVoice** 且词表非空 → 弱热词预期（不阻塞转写）。

转写 **之后** 仍靠现有 `TranscribeHintsBanner` + 补强 warnings 文案。

### 2.2 非目标

- 不改 FunASR / 侧车 `hotword=` 行为。  
- 不做 ASR-VOC-4。  
- 不替代环境页完整说明（只补 **转写决策点** 摘要）。

### 2.3 任务拆片（建议 1 个 PR，≤400 行 TS+Rust 触达）

| ID | 任务 | 落位 | 估时 |
|----|------|------|------|
| **V1-1** | 纯函数：组合「热词 preview + STT channel + 本机 SKU」→ `TranscribeVocabularyPreflightSummary` | 新建 `apps/desktop/src/services/asr/transcribeVocabularyPreflight.ts` + test | 3h |
| **V1-2** | Controller：转写 busy 前拉 `glossary_hotwords_preview`（已有 API）；读环境 **当前在线 providerId** + **本机 hubModelId** | `useTranscribeJobController.ts` 或 `transcribeVocabularyPreflight.ts` 调用方；避免 mega-hook：逻辑放 service | 2h |
| **V1-3** | **覆盖确认对话框** 增加第二节「本次术语偏置」 | `TranscribeOverwriteConfirmDialog.tsx`；props 来自 lifecycle | 2h |
| **V1-4** | **无覆盖时**（首次拉取）：转写按钮旁或 `ProjectStatusFeedback` 一行折叠摘要（`termCount===0` 时轻提示「术语库为空…」） | `EditorToolbar` / `ProjectStatusFeedback` 二选一（实施时选改动更小处） | 2h |
| **V1-5** | SenseVoice 弱热词：catalog `catalogId===sensevoice-small` 且 `termCount>0` → summary 追加一句 | 复用 V1-1；文案对齐 `asr-hotword-bias-truth.md` | 0.5h |
| **V1-6** | 转写后 hints 补强：`funasr_skipped`、`stub_no_placeholder_segment` 各 1 条可读句 | `asrTranscribeHints.ts` + test | 1h |

**V1-1 输出字段（建议）**

```ts
type TranscribeVocabularyPreflightSummary = {
  hotwords: GlossaryHotwordsPreview | null;
  localSkuLabel: string | null;       // Paraformer / SenseVoice
  localHotwordNote: string | null;    // SenseVoice 弱热词
  onlineProviderId: string | null;
  onlineChannel: SttOnlineVocabularyChannel;
  onlineBiasLine: string | null;      // glossaryBiasSummaryForProviderId
  emptyGlossaryHint: string | null;   // enabledEntryCount===0
};
```

**在线 provider 来源**：与 `run_transcribe` 相同 storage（`rushi.stt.online.providerId` 或现有 env 读取 helper）；实施时 grep `project_run_transcribe` 在线分支对齐。

### 2.4 验收要点

见 acceptance **§ ASR-VOC-1**；手测 3 条：

1. 术语库 2 条 enabled + Paraformer → 确认框见 token 数 +「multipart hotwords」。  
2. 选讯飞/腾讯 + 有术语 → 见「不支持术语偏置」且仍可转写。  
3. SenseVoice + 有术语 → 见弱热词说明；转写后无新 warning 也可完成。

### 2.5 风险

| 风险 | 缓解 |
|------|------|
| 在线/本机双模式 UI 分叉 | summary 纯函数单测；对话框与 toolbar 共用 |
| preview 调用频繁 | 仅在打开覆盖对话框 / 聚焦转写区时 fetch，不 800ms poll |

---

## 3. ASR-VOC-2 — 词表质量闭环（完整规格）

**范围**：本表「优先级 2」四项 — **F6**、**F7**、**术语库文案**、**空表提示**。  
**双真源**：实施细节以 **本节 +** [R3t-F Plan v3 §7/§11/§14](./r3t-f-post-transcribe-suite-plan.md)；验收以 [`r3-asr-voc-landing-acceptance.md`](./r3-asr-voc-landing-acceptance.md) **§ ASR-VOC-2** + [`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P1 F6 / P2 F7。  
**不含**：F2/F1/F0（仍属 R3t-F P1/P2，见 Plan §5–8）。

### 3.0 总表（对应你列的优先级 2）

| 子项 | 做什么 | 期 | 估时 | 编码顺序 |
|------|--------|-----|------|----------|
| **2a F6** | 第 3 次同 `right` → 提示进 `glossary_terms` | R3t-F **P1** | **2–3d** | F2 之后或同轮末 |
| **2b F7** | 小团队 `rushi_lexicon_bundle.v1` 导出/导入/合并 | R3t-F **P2** | **4–6d** | F7 主交付 |
| **2c 文案** | L2「转写词汇表」心智 + 与 memory 分工 | P1 末 / P2 初 | **0.5d** | 可与 F6 同 PR |
| **2d 空表** | 转写前 + 术语库：glossary 空时轻提示 | P1 | **含 VOC-1** 0.5d + **2c** | V1-4 + GlossaryPage |

**合计**：**7–10d**（与 R3t-F P1 的 F6 切片 + P2 的 F7 切片一致，**不**含 F2/F1 的 10–14d）。

### 3.1 实施顺序（在 ⑤″f 主序内）

```text
R3t-F P1:  F2（首刀）→ F1 → F6（2a）+ 2c/2d 文案（可末 PR）
R3t-F P2:  F7（2b）→ F0-lite（与 ASR 无强依赖）
并行:      ASR-VOC-1 不挡 F6；F7 完成后 VOC-1 preview 自动变
```

---

### 3.2 ASR-VOC-2a — F6 手改 → 转写词汇表（2–3d）

**产品承诺（L1）**：手改稳定 **正形** 第三次后，引导进入 **`glossary_terms`**，使 **下次 L2 热词** 生效；**不** 把 `before` 当热词。

| 项 | 规格 |
|----|------|
| **触发** | 同一 `(before_text, after_text)` 对在 **save / 预览写回** 后 `hit_count ≥ 3`（与 `correction.rs` `infer_single_replacement` 计数一致） |
| **计数范围** | 全局 `correction_memory`；**不** 按项目隔离 v1 |
| **UI** | 非模态条或 toast + 主按钮「加入转写词汇表」+ 次要「忽略」；展示 `after_text` 为将写入的 `term` |
| **写入** | `glossary_add`：`term = after_text.trim()`，`aliases` 空，`hotword_enabled = true`，`domain`/`note` 可空 |
| **去重** | 已存在同 `term`（`COLLATE NOCASE`）→ toast「已在转写词汇表中」，**不** 重复 INSERT |
| **与 F2/F1** | F2 Replace All + **save** 走同一学习路径；F1 规则写回也计 hit |
| **与 R3t-E** | `hit≥2` 或 `accepted_as_rule` 仍进 LexiconPack（L4）；F6 **仅** 管 L2 glossary |
| **禁止** | 静默自动入库；`before_text` 写入 `term` 或 hotwords；未 save 的草稿触发 |

**任务拆片**

| ID | 任务 | 落位 | 估时 |
|----|------|------|------|
| F6-1 | save 后检测 `hit_count≥3` 并 emit 事件 | `correction.rs` 或 save 回调链 | 3h |
| F6-2 | `useGlossaryPromotionController`：展示条、忽略态（session 级） | `apps/desktop/src/pages/` | 4h |
| F6-3 | 调用 `glossary_add`；成功后刷新 `glossary_hotwords_preview` | `glossaryApi.ts` | 2h |
| F6-4 | 单测：第 1/2 次不提示、第 3 次提示、去重 | vitest + 可选 Rust | 3h |
| F6-5 | 手测清单 1 条写入 acceptance | hand-test 附录 | 0.5h |

**可选 Rust**：`glossary_promote_from_memory(after_text)` — 仅当 TS 侧去重逻辑重复时再加。

---

### 3.3 ASR-VOC-2b — F7 小团队词表包（4–6d）

**产品承诺（D6–D9）**：3–10 人互传 **词表包**（微信/网盘），合并进 **全局** `glossary_terms` + `correction_memory`；**无** 云同步、**无** 语段正文。

#### 3.3.1 格式 `rushi_lexicon_bundle.v1.json`

```json
{
  "kind": "rushi_lexicon_bundle",
  "version": 1,
  "exported_at_ms": 0,
  "exported_by": { "app": "rushi-desktop", "optional_label": "栏目 A" },
  "glossary_terms": [{
    "term": "", "aliases": "", "domain": "", "note": "", "hotword_enabled": true
  }],
  "correction_rules": [{
    "before_text": "", "after_text": "", "hit_count": 0,
    "accepted_as_rule": false, "updated_at_ms": 0
  }]
}
```

- **禁止**：`segments`、API Key、项目 id。  
- 可选 zip：`bundle.json` + `README.txt`（一行：导入后影响全局转写热词与纠错规则）。

#### 3.3.2 导出（D7）

| 项 | 规格 |
|----|------|
| 入口 | 术语库页 **「导出词表包」** |
| 默认范围 | **仅稳定记忆**：`accepted_as_rule=1 OR hit_count≥2` |
| 高级勾选项 | 含 `hit_count=1` 未采纳规则 |
| 字段 | 建议填写 `optional_label`（来源栏目/同事名） |
| 并存 | 现有 **CSV 导出** 保留，不删 |

#### 3.3.3 导入（dry-run → 预览 → apply）

| 步骤 | 行为 |
|------|------|
| 1 | 选 `.json` 或 `.zip`（解出 `bundle.json`） |
| 2 | Rust **`lexicon_bundle_preview_import`** → `{ insert, skip, auto_resolved, conflicts[] }` |
| 3 | `conflicts.length===0` → 一键应用 |
| 4 | 否则 `compactDialog`：仅 **未自动解决** 项 |

**合并规则（D6、D8）**

| 数据 | 无冲突 | 冲突 |
|------|--------|------|
| rule 同 `(before,after)` | 累加 hit（实施定 **sum** 或 **max**，写入 acceptance） | — |
| rule 同 `before` 异 `after` | **`hit_count` 高者胜** → `updated_at_ms` 新者胜 | 仍平手 → **预览**（保留本地 / 包内 / 手动选 after） |
| glossary 同 `term` | skip（dup） | 预览：保留本地 / 包内 / **合并 aliases** |
| 包内同 before 多条 | 导入前包内去重（留 `updated_at_ms` 最新） | — |

**合并后 ASR 效应（必验）**

- `glossary_hotwords_preview.termCount` 在 **有新增 term** 时 ≥ 合并前。  
- 下次转写 / VOC-1 摘要反映新 token。  
- F1 / R3t-E Pack 立即可用新 rules（无需重转写）。

#### 3.3.4 任务拆片

| ID | 任务 | 落位 | 估时 |
|----|------|------|------|
| F7-1 | `lexicon_bundle.rs`：export、preview_import、apply_import | `apps/desktop/src-tauri/src/project/` | 1.5d |
| F7-2 | schema 校验 + 禁止字段单测 | `lexicon_bundle.rs` tests | 4h |
| F7-3 | `lexiconBundleApi.ts`、`useLexiconBundleController.ts` | `apps/desktop/src/tauri/` + `pages/` | 1d |
| F7-4 | `GlossaryPage`：导出/导入按钮、冲突预览 UI | `GlossaryPage.tsx` | 1d |
| F7-5 | 手测 A→B 交换 | acceptance + 可选 `r3t-f-hand-test` 一行 | 0.5d |

**明确不做（F7）**：云同步、SSO、bundle 含文稿、无 dry-run 静默覆盖（Plan §15）。

---

### 3.4 ASR-VOC-2c — L2 术语库文案（0.5d）

**目标**：用户理解 **只把「希望听成的正形」** 放进转写词汇表；纠错记忆管 **转写后改稿**。

| 位置 | 文案要点（实施时可略润色，语义不可改） |
|------|----------------------------------------|
| **术语库页标题/副标题** | 主标题含 **「转写词汇表（Custom Vocabulary）」**；副标题：勾选「纳入热词」的词条会在 **下次从 ASR 拉取** 时提交给识别引擎 |
| **与 memory 分工** | 一段说明：「手改纠错记忆」用于 **当前稿** 规则与 AI 校对；**本表** 用于 **下次听写** 专名偏置；错形请勿写入词条 |
| **`hotword_enabled` 列** | 列头或 tooltip：**「纳入下次转写（热词）」**；默认新词条 **true** |
| **别名** | 提示：别名会拆成独立热词 token；**不要** 填 ASR 常听错的错字 |
| **环境页交叉链接** | 在线 STT 小节保留 ACC U2 说明；链到 [`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) |

**落位**：`GlossaryPage.tsx`、`EnvLocalAsrPanel` 或术语库顶栏；遵守 R3-STATE（不拿全局 health 表示所选 SKU）。

**任务**：F6-文案-1 集中改文案 + 截图手测 2 场景（空表 / 有 term+截断）。

---

### 3.5 ASR-VOC-2d — 空表 / 轻提示（VOC-1 + 2c）

| 场景 | 行为 | 落位 |
|------|------|------|
| **转写前** `enabledEntryCount===0` | 非阻断：「转写词汇表为空，专名可能听错；可到术语库添加。」+ 链打开术语库 | **ASR-VOC-1** `V1-4`（确认框 / 转写入口） |
| **术语库页** `termCount===0` | 空状态插画区：说明 + **「添加词条」** CTA | `GlossaryPage` 空状态 |
| **有词条但全部 `hotword_enabled=0`** | 摘要写明「0 个 token 纳入转写」；与 HOT-UX 已有句一致 | `formatGlossaryHotwordsTranscribeSummary` |

**验收**：空表仍可转写；hints 不出现假「已注入热词」。

---

### 3.6 与 ASR-VOC-1 / 3 / 5 衔接

| 包 | 衔接 |
|----|------|
| **VOC-1** | 转写前展示 **合并后** preview；F7 apply 后应 **刷新** preview |
| **VOC-3** | F7 只改 SQLite glossary；在线是否收到由 channel 决定 |
| **VOC-5** | F6 入库 term 应出现在 eval `expected_terms` / hotwords 串（手测制控样例） |
| **VOC-4 暂缓** | 不替代 F6；拍板前不做 memory 直连 hotwords |

---

## 4. ASR-VOC-3 — 在线 STT 厂商最佳实践（2–4d）

**排期**：**⑤″f-D**（最后）；**签收闸门**：ACC 在线 STT 手测清单至少 **1 家**（OpenAI / AssemblyAI / Deepgram）通过后再标 ✅。

### 4.1 目标

在 **不改变**「术语真源 = `glossary_terms`」前提下，让 OpenAI / AssemblyAI / Deepgram 的 **截断与排序** 更贴厂商文档；补全 warnings 与环境页说明。

### 4.2 非目标

- 不接国内壳直连厂商。  
- 不默认 Deepgram 高强度 boost（避免误伤）。  
- Nova-3 `keyterm`：**仅当** 环境页模型字段已暴露 Nova-3 且 adapter 可区分时再实现；否则文档记 Defer。

### 4.3 任务拆片（可 2 PR）

| ID | 任务 | 落位 | 估时 |
|----|------|------|------|
| **V3-1** | **OpenAI**：`openai_prompt` 按 `updated_at_ms DESC` 或「短 term 优先」排序 terms 再 join，再截 224 字；超长按字符截断并已有 warning | `stt_vocabulary.rs` `openai_prompt`；单测 | 4h |
| **V3-2** | **AssemblyAI**：keyterms 保持 ≤100 条；总字符上限调研（文档常量 + warning `online_vocabulary_truncated_assemblyai_keyterms` 已存在则补测试） | `stt_vocabulary.rs`、`transcribe.rs` | 3h |
| **V3-3** | **Deepgram**：文档化「单词 OOV」；可选 `keywords=term:1` 强度参数 **env 开关默认 off**；调研 Nova-3 keyterm → spike 笔记入 `stt-online-providers.md` | `stt_vocabulary.rs`、`sttVocabularyBias.ts` | 6h |
| **V3-4** | 环境页：三家各 1 行「术语如何映射」+ 截断上限 | `EnvOnlineSttPanel` 或 provider 卡片 | 3h |
| **V3-5** | `deriveTranscribeHints` 对齐 `online_vocabulary_truncated_*` 细分文案（若新增子类型） | `asrTranscribeHints.ts` | 2h |

### 4.4 验收

- Rust unit：排序后 prompt 前 N 字包含「最重要」term（测固定 glossary fixture）。  
- Mock HTTP：Deepgram URL 含 `keywords=` 数量 ≤50。  
- 手测：100+ 术语 → OpenAI 转写 → warning + hints 可见。

---

## 5. ASR-VOC-5 — 专名 eval + 热词 A/B（1–2d 起集）

### 5.1 目标

回答：**同一段音频，开/关 hotwords（或换 SKU）专名命中率是否变化？** 为 Qwen3 spike G5、发版前检查提供 baseline。

### 5.2 现状

- `fixtures/eval/samples/制控.mp3` + `expected_terms: ["制控"]` + `hotwords: "制控"` 已存在。  
- `npm run eval:run` → `term_hit_rate`（[`scripts/eval-run.py`](../../../scripts/eval-run.py)）。

### 5.0 排期位置

**⑤″f-A**（与 VOC-1、F2 同轮或紧接）；**必须在 F7 之前**完成 baseline（holistic H3）。

### 5.3 任务拆片

| ID | 任务 | 落位 | 估时 |
|----|------|------|------|
| **V5-1** | 扩展 manifest：`hotwords_ab` 元数据（`hotwords_on` / `hotwords_off` 或 CLI flag） | `eval_manifest.v1.json` schema 注释 + 1 条文档 | 2h |
| **V5-2** | `eval-run.py` 支持 `--hotwords-mode=on|off|manifest`；输出 CSV 列 `hotwords_enabled`, `term_hit_rate` | `scripts/eval-run.py` | 4h |
| **V5-3** | 可选第二样本：短 wav + 2–3 个 `expected_terms`（可用 `term_dense.wav` 扩 manifest，或仓库内合成专名句） | `fixtures/eval/` | 4h |
| **V5-4** | 文档：`docs/execution/fixtures/asr-hotword-eval/README.md` 手测步骤（Paraformer vs SenseVoice vs hotwords off） | 新目录或扩 `fixtures/eval/README.md` | 2h |
| **V5-5** | backlog 登记：CI nightly 可选，**非** PR 硬门禁（与 ACC-EVAL-1 一致） | `r3-asr-landscape-2026-05-improvement-backlog.md` | 0.5h |

### 5.4 建议 baseline 记录表（手测 / 脚本输出）

| 变量 | 记录 |
|------|------|
| SKU | Paraformer 长音频 / SenseVoice |
| hotwords | on / off |
| `term_hit_rate` | 制控样例 |
| warnings | 是否 `hotwords_ignored_stub` 等 |

### 5.5 验收

- 本机：`npm run eval:run` 对 `proper-noun-zhikong` 在 hotwords on/off 各跑一次，结果可对比。  
- 不要求 hotwords off 命中率更高（仅要求 **可观测**）。

---

## 6. ASR-VOC-4 — 暂缓（拍板清单）

**默认不做**。若产品要求「少一步进 glossary」，立项前须书面确认：

| 检查项 | 要求 |
|--------|------|
| 数据源 | 仅 `accepted_as_rule=1` 的 `after_text` |
| 上限 | ≤20 词，去重，在 glossary 之后 append |
| UI | preview 标明「含 N 条来自纠错记忆」 |
| 禁止 | `before_text`、无上限合并 |
| 评估 | 与 F6  A/B：用户是否仍愿手动进 glossary |

---

## 7. 验证纪律（每包结束）

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

| 包 | 额外 |
|----|------|
| VOC-1 | `asrTranscribeHints.test.ts`、`transcribeVocabularyPreflight.test.ts` |
| VOC-2 | R3t-F acceptance 对应节 |
| VOC-3 | `stt_vocabulary.rs` unit + 现有 ACC 测试绿 |
| VOC-5 | 本机 `npm run eval:run`（有侧车 + 制控.mp3） |

---

## 8. 决策与变更

| 日期 | 决策 |
|------|------|
| 2026-05-31 | ASR-VOC-2 不单独 Epic，与 R3t-F F6/F7 绑定的实施真源仍为 Plan v3 |
| 2026-05-31 | ASR-VOC-4 默认 No；闭环走 F6 |
| 2026-05-31 | ASR-VOC-1 与 R3t-F P1 **并行**，不挡 F2 首刀 |

调整 `stt_vocabulary` / `glossary_hotwords` 行为时同步：`asr-hotword-bias-truth.md`、`asr-vocabulary-bias-practices.md` §5 现状表。
