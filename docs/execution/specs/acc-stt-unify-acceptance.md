# Acceptance: ACC-STT-UNIFY — 术语表本机 + 在线统一

> **状态**：✅ 本机手测签收（2026-05-31）；在线端到端手测 ⏳ — [`acc-stt-unify-hand-test-checklist.md`](./acc-stt-unify-hand-test-checklist.md)  
> **调研**：[`acc-stt-unify-research.md`](./acc-stt-unify-research.md)  
> **架构**：[`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)、[`stt-online-providers.md`](../../architecture/stt-online-providers.md)

## 产品决策（Q-ACC-2 / Q-ACC-6）

- **术语真源**：仅全局 `glossary_terms`（canonical，不用 alias 堆误写形）
- **本机**：multipart `hotwords`（FunASR `hotword=`）
- **在线 v1**：OpenAI `prompt`、AssemblyAI `keyterms_prompt`、Deepgram `keywords`、百炼 `vocabulary_id`（→ [`acc-stt-ali-acceptance.md`](./acc-stt-ali-acceptance.md)）；其它 native → `online_vocabulary_unsupported`
- **不做**：U4 自动回落本机；U3 环境三盏灯（R3h-3）

## 能力—UI 状态矩阵（R3-STATE）

| UI / 信号 | 维度 | 数据源 | 状态 |
|-----------|------|--------|------|
| 术语库「本次转写将携带」 | 术语真源 | `glossary_hotwords_preview` | ✅ HOT-UX |
| 本机转写 hints | 侧车 warnings | `hotwords_truncated_12k` 等 | ✅ |
| 在线厂商卡片「术语偏置」角标 | 厂商能力 | `sttVocabularyBias.ts` | ✅ U2 |
| 在线 STT 说明 + 当前厂商一句摘要 | 所选 provider | `glossaryBiasSummaryForProviderId` | ✅ U2 |
| 转写结果 hints | 响应 warnings | `online_vocabulary_*` | ✅ |

## 子片验收

### U1 — SttVocabularyPlan + adapter

- [x] `SttVocabularyPlan::from_build`（`stt_vocabulary.rs`）
- [x] OpenAI `openai_prompt` → multipart `prompt`
- [x] AssemblyAI `assemblyai_keyterms` → create job body
- [x] Deepgram `append_deepgram_keywords`
- [x] 本机 / 代理：`hotwords` 字段（`run_transcribe_cmd`）
- [x] `vocabulary_support_warnings` + merge 进转写结果
- [x] Rust unit：`stt_vocabulary.rs`

### U2 — 能力矩阵（TS）

- [x] `sttVocabularyBias.ts` 与 Rust channel 对齐
- [x] 厂商列表「术语偏置」角标（支持三家 + 自定义代理）
- [x] `deriveTranscribeHints` 处理 `online_vocabulary_unsupported` / `truncated_*`
- [x] Vitest：`sttVocabularyBias.test.ts`、`asrTranscribeHints.test.ts`

### U3 — 环境三盏灯对照

- [ ] 并入 **R3h-3**（本轮不阻塞）

### U4 — 在线失败回落本机

- [x] **v1 不做**（仅 warning + 用户重试）

## 自动化

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml stt_vocabulary
cd apps/desktop && npx vitest run src/services/stt/sttVocabularyBias.test.ts src/services/asrTranscribeHints.test.ts
npm run typecheck && node scripts/check-architecture-guard.mjs
```

## 手测

见 [`acc-stt-unify-hand-test-checklist.md`](./acc-stt-unify-hand-test-checklist.md)。
