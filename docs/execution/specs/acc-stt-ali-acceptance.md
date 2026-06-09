# Acceptance: ACC-STT-ALI — 百炼 Fun-ASR 术语热词

> **状态**：编码完成（2026-06-09）  
> **调研**：[`asr-cloud-model-tuning-feasibility-research.md`](./asr-cloud-model-tuning-feasibility-research.md)

## 范围

- `dashscope-asr` 由 Qwen3-Flash 改为 **Fun-ASR Realtime**（`multimodal-generation` + Base64）
- 术语库 → 百炼 `speech-biasing` CRUD → 转写 `parameters.vocabulary_id`
- `target_model` / 转写 model 均为 `fun-asr-realtime`

## 验收

- [x] Rust：`dashscope_vocabulary.rs` + `dashscope_asr.rs` 接线 `SttVocabularyPlan`
- [x] `SttVocabularyChannel::DashScopeVocabulary` + warnings
- [x] TS：`sttVocabularyBias` + `deriveTranscribeHints`
- [x] 自动化：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`（2026-06-09）
- [ ] 手测：见 [`acc-stt-ali-hand-test-checklist.md`](./acc-stt-ali-hand-test-checklist.md)

## 自动化

```bash
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml stt_vocabulary
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml dashscope
cd apps/desktop && npx vitest run src/services/stt/sttVocabularyBias.test.ts src/services/asrTranscribeHints.test.ts
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

## 不做

- Fun-ASR 异步 `file_urls` 长音频 Job（需公网 URL；后续薄片）
- Qwen3-ASR-Flash 并存 provider
