# Acceptance: ASR-VOC — 词汇偏置落地

> **状态**：进行中（2026-06-03）· **VOC-1** ✅ · **VOC-2a/F6+/F7** ✅ · **VOC-5** ✅ · **VOC-2c/d** + **VOC-GUARD** ✅；下一刀 **VOC-3**；见 **§4.1.9**  
> **VOC-1 手测**：[`asr-voc-1-hand-test-checklist.md`](./asr-voc-1-hand-test-checklist.md) ✅  
> **整体性评估**：[`r3-asr-voc-holistic-review-2026-05.md`](./r3-asr-voc-holistic-review-2026-05.md)（⑤″f-A→D 顺序）  
> **Plan**：[`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md)  
> **架构**：[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md)

---

## 全局（每 PR）

- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [x] 未把 `correction_memory.before_text` 写入 hotwords（`hotword_guard` + `glossary_hotwords` 单测）
- [x] 纠错错形不得写入术语表（`glossary_add` / `update` / 批量与表格导入 → `skipped_wrong_form`）
- [ ] 未用全局 `/health.ready_for_transcribe` 表示「用户词表已进模型」（仍用 preview + warnings）

---

## ASR-VOC-1 — 转写前可见性（1–2d）

> **编码**：2026-05-31 起 ASR-VOC-1 实现中

### 功能

- [x] 打开「覆盖并拉取」确认框时，展示 `glossary_hotwords_preview` 摘要（token 数、字符、截断、dropped）
- [x] 同屏展示 **本机 SKU 名称**（当前选中 hub 对应 catalog label）
- [x] 同屏展示 **在线术语通道**一行（`glossaryBiasSummaryForProviderId` 或等价；不支持时明确「未传入厂商 API」）
- [x] `enabledEntryCount===0` 时轻提示添加专名（不阻断转写）
- [x] 选 **SenseVoice** 且词表非空时，额外一句「热词效果可能弱于 Paraformer」类说明
- [x] 首次拉取（无覆盖对话框）时，转写入口可见 **一行** 摘要或等价 tooltip（与确认框文案一致）

### 转写后（补强）

- [x] `warnings` 含 `funasr_skipped:` → hints 可读说明
- [x] `warnings` 含 `stub_no_placeholder_segment` → hints 可读说明
- [ ] 既有：`hotwords_ignored_stub`、`hotword_param_unsupported`、`hotwords_truncated_12k`、`online_vocabulary_*` 仍通过 `deriveTranscribeHints`

### 测试

- [x] `transcribeVocabularyPreflight.test.ts`（或同名）覆盖：空词表、截断、unsupported channel、SenseVoice 注记
- [x] `asrTranscribeHints.test.ts` 新增 skipped/stub 用例

### 手测（3 条）

- [x] Paraformer + 2 条术语 → 确认框见热词摘要（2026-06-02，hand-test §1）
- [x] 不支持在线厂商 + 术语 → 见不支持说明，转写仍成功（2026-06-02，hand-test §2）
- [x] SenseVoice + 术语 → 见弱热词说明（2026-06-02，hand-test §3）

---

## ASR-VOC-2 — 词表闭环（完整；= R3t-F F6 + F7 + 2c + 2d）

> **Plan 全文**：[`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md) §3 · R3t-F 拍板 D6–D9  
> **R3t-F 共用验收**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P1 F6、P2 F7

### 2a — F6（2–3d）

> **纳入记忆入口（2026-06）**：语段选区右键「纳入更正记忆…」→ `correction_memory_save`；**非**保存语段时自动推断。手测：[`f6-f6plus-mem-hand-test-checklist.md`](./f6-f6plus-mem-hand-test-checklist.md) §A–B。

- [x] 第 1、2 次同 `(before,after)` 手动纳入 **不** 出现进表提示
- [x] 第 3 次纳入后出现 **GlossaryLearnPrompt**（`加入术语表？`）；可忽略
- [x] 确认后：`glossary_add`，`term=after_text`，`hotword_enabled=1`
- [x] 已存在同 term → 不 INSERT，有「已在词汇表中」提示
- [ ] F2 Replace All + save 计 hit（`explicit_pairs` 路径）；与 R3t-E Pack 不互斥
- [x] **从不** 将 `before_text` 写入 `term` 或 hotwords
- [x] 纳入时勾选词汇表后，转写 preview token 含正形 term
- [x] Vitest：`manualCorrectionMemory` · `useManualCorrectionMemoryDialog`；Rust hit upsert 已有

### 2b — F7（4–6d · D6–D8）

- [x] 导出 json（`lexicon_bundle_export`）；可选 zip 仍待做
- [x] 默认仅导出 `accepted_as_rule OR hit≥2`；取消勾选可含 `hit=1`
- [x] `optional_label` 可填且写入 `exported_by`
- [x] 包内 **无** segments、无 API key（`parse_lexicon_bundle_json` 单测）
- [x] 导入 preview：`insert` / `skip` / `auto_resolved` / `conflicts` 计数（Rust + 术语库页）
- [x] rule 同 before 异 after：`hit_count` 高者胜；平手进预览
- [x] glossary 同 term 冲突：预览（本地/包内/合并 aliases/跳过）
- [x] apply 后：`glossary_hotwords_preview` 反映新增（`f7_hand_test_ab_exchange` 断言 hotwords 含导入 term）
- [x] 手测 UI：导出 + 导入（单机删条后再导入，2026-06-03）；见 [`f7-lexicon-bundle-hand-test-checklist.md`](./f7-lexicon-bundle-hand-test-checklist.md)
- [x] 项目 bundle zip **不含**词表包（D9 · `project_bundle_zip_excludes_lexicon_bundle`）

### 2c — L2 文案（0.5d）

- [x] 术语库主标题含「转写词汇表（Custom Vocabulary）」
- [x] 副标题说明：纳入热词 = 下次 ASR 拉取提交
- [x] 可见分工：纠错记忆 = 当前稿；本表 = 下次听写
- [x] `hotword_enabled` 列/tooltip：「纳入下次转写（热词）」
- [x] 别名说明：勿填常听错的错形

### 2d — 空表提示（VOC-1 + 2c）

- [x] 转写前 `enabledEntryCount===0`：轻提示 +「前往热词与记忆」（`TranscribeOverwriteConfirmDialog`）
- [x] 术语库空状态：CTA「添加词条」
- [x] 全部 `hotword_enabled=0`：摘要显示 0 token（`formatGlossaryHotwordsTranscribeSummary`）

### 2 — 手测（小团队一条）

- [x] 词表包交换：导出 → 删条 → 再导入；转写 preview / F1 可见导入内容（2026-06-03 单机手测；跨机路径同逻辑）

---

## ASR-VOC-3 — 在线最佳实践（2–4d）

### OpenAI

- [ ] 术语传入 `prompt` 前经 **确定排序**（文档写明规则，如 `updated_at_ms` 降序）
- [ ] 超 224 字截断 + `online_vocabulary_truncated_openai_prompt`（或既有 warning）+ hints

### AssemblyAI

- [ ] keyterms ≤100；超长有 warning + hints
- [ ] 文档区分：keyterms（识别偏置）≠ custom_spelling（转写后替换）

### Deepgram

- [ ] keywords ≤50；URL 编码正确（单测）
- [ ] 默认 **不** 开启高强度 boost；若做 env 开关，默认 off 且文档说明
- [ ] 环境页 1 行映射说明

### 测试

- [ ] `stt_vocabulary.rs` 或现有 Rust tests 覆盖排序/截断
- [ ] 不破坏 ACC-STT-UNIFY 已有用例

---

## ASR-VOC-5 — eval / 热词 A/B（1–2d 起集）

> 脚本：[`scripts/eval-run.py`](../../../scripts/eval-run.py) · 逻辑 [`services/asr/rushi_asr/eval_manifest.py`](../../../services/asr/rushi_asr/eval_manifest.py) · 说明 [`docs/execution/fixtures/asr-hotword-eval/README.md`](../fixtures/asr-hotword-eval/README.md)

- [x] `eval-run.py` 支持 `--hotwords-mode=on|off|manifest`、`--hotwords-ab`、`--filter-id`、`--format=csv`
- [x] 输出 `hotwords_enabled`、`hotwords_sent`、`hotwords_ab_variant`、`term_hit_rate`
- [x] manifest `proper-noun-zhikong` 含 `hotwords_ab`；`npm run eval:run:hotwords-ab` 一行命令 A/B
- [x] README / backlog：热词 A/B **非** PR 硬门禁（CI 仍跑默认 `eval:run`）
- [x] 契约：`services/asr/tests/test_eval_manifest.py`、`test_eval_run_csv.py`

### 手测（本机，需侧车 + `制控.mp3`）

- [x] 见 [`asr-voc-5-hand-test-checklist.md`](./asr-voc-5-hand-test-checklist.md)（2026-06-03 签收）

---

## ASR-VOC-4 — 暂缓

- [ ] **未实施**（除非产品书面拍板 Plan §6）

---

## 签收记录

| 日期 | 包 | 结果 | 证据 |
|------|-----|------|------|
| — | — | — | — |
