# Acceptance: ASR-VOC — 词汇偏置落地

> **状态**：规划（2026-05-31）· 未编码  
> **整体性评估**：[`r3-asr-voc-holistic-review-2026-05.md`](./r3-asr-voc-holistic-review-2026-05.md)（⑤″f-A→D 顺序）  
> **Plan**：[`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md)  
> **架构**：[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md)

---

## 全局（每 PR）

- [ ] `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
- [ ] 未把 `correction_memory.before_text` 写入 hotwords
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

### 手测（可选，3 条）

- [ ] Paraformer + 2 条术语 → 确认框见热词摘要
- [ ] 不支持在线厂商 + 术语 → 见不支持说明，转写仍成功
- [ ] SenseVoice + 术语 → 见弱热词说明

---

## ASR-VOC-2 — 词表闭环（完整；= R3t-F F6 + F7 + 2c + 2d）

> **Plan 全文**：[`r3-asr-voc-landing-plan.md`](./r3-asr-voc-landing-plan.md) §3 · R3t-F 拍板 D6–D9  
> **R3t-F 共用验收**：[`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) P1 F6、P2 F7

### 2a — F6（2–3d）

- [ ] 第 1、2 次同 `(before,after)` save **不** 出现进表提示
- [ ] 第 3 次出现非模态条/ toast：「加入转写词汇表」；可忽略
- [ ] 确认后：`glossary_add`，`term=after_text`，`hotword_enabled=1`
- [ ] 已存在同 term（大小写不敏感）→ 不 INSERT，有「已在词汇表中」提示
- [ ] F2 Replace All + save 计 hit；与 R3t-E Pack 路径不互斥
- [ ] **从不** 将 `before_text` 写入 `term` 或 hotwords
- [ ] 成功后术语库「本次转写将携带」token 数增加（若 enabled）
- [ ] Vitest：F6-4 计数边界；可选 Rust save 链单测

### 2b — F7（4–6d · D6–D8）

- [ ] 导出 json；可选 zip（`bundle.json` + README）
- [ ] 默认仅导出 `accepted_as_rule OR hit≥2`；高级可含 `hit=1`
- [ ] `optional_label` 可填且写入 `exported_by`
- [ ] 包内 **无** segments、无 API key（schema 单测）
- [ ] 导入 preview：`insert` / `skip` / `auto_resolved` / `conflicts` 计数正确
- [ ] rule 同 before 异 after：`hit_count` 高者胜；平手进预览
- [ ] glossary 同 term 冲突：预览三选一（本地/包内/合并 aliases）
- [ ] apply 后：`glossary_hotwords_preview` 反映新增（有新增 term 时 termCount 上升）
- [ ] 手测：A 导出 → B 导入 → B 转写或 F1 命中 A 规则/词表
- [ ] 项目 bundle zip **不含**词表包（D9）

### 2c — L2 文案（0.5d）

- [ ] 术语库主标题含「转写词汇表（Custom Vocabulary）」
- [ ] 副标题说明：纳入热词 = 下次 ASR 拉取提交
- [ ] 可见分工：纠错记忆 = 当前稿；本表 = 下次听写
- [ ] `hotword_enabled` 列/tooltip：「纳入下次转写（热词）」
- [ ] 别名说明：勿填常听错的错形

### 2d — 空表提示（VOC-1 + 2c）

- [ ] 转写前 `enabledEntryCount===0`：轻提示 + 可跳转术语库（不阻断）
- [ ] 术语库空状态：CTA「添加词条」
- [ ] 全部 `hotword_enabled=0`：摘要显示 0 token（HOT-UX 回归）

### 2 — 手测（小团队一条）

- [ ] 用户 A：F6 将专名进表 → 导出词表包 → 用户 B 导入 → B 本机转写 preview 含该专名 token

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

- [ ] `eval-run.py` 支持 hotwords on/off（或 manifest 字段）并输出 `term_hit_rate`
- [ ] `proper-noun-zhikong` 在 on/off 下均可跑通（有侧车 + 样例文件）
- [ ] README 记录：推荐 Paraformer + 对比 SenseVoice + 看 warnings
- [ ] backlog / roadmap 注明：nightly 可选，非 PR 硬门禁

### 手测（本机）

- [ ] `npm run eval:run` 制控样例 hotwords on → `term_hit_rate` 有值
- [ ] 同命令 hotwords off → 结果可对比存档

---

## ASR-VOC-4 — 暂缓

- [ ] **未实施**（除非产品书面拍板 Plan §6）

---

## 签收记录

| 日期 | 包 | 结果 | 证据 |
|------|-----|------|------|
| — | — | — | — |
