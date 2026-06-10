# 在线 STT 统一分段 — Plan

> **Research**：[`online-stt-segmentation-nlp-stack-research.md`](./online-stt-segmentation-nlp-stack-research.md)  
> **Intent**：[`online-stt-segment-unify-intent.md`](./online-stt-segment-unify-intent.md)  
> **Acceptance**：[`online-stt-segment-unify-acceptance.md`](./online-stt-segment-unify-acceptance.md)

---

## 0. 实施前提

- Research brief 已完成；Intent 非目标与用户确认的 **「Tier A + 百炼 SSE」** 一致
- **本文件为编码前 Plan**；Implement 阶段按 Phase 顺序提交，每 Phase 结束跑 gates + 对应 acceptance 子集

---

## 1. 架构总览

### 1.1 数据类型（Rust，`project/online_segment_normalize.rs`）

```rust
/// 毫秒，与现有 TranscribeSegment start/end 一致
pub struct TimedWord {
    pub text: String,
    pub start_ms: u64,
    pub end_ms: u64,
}

pub struct OnlineSegmentNormalizeOptions {
    pub gap_ms: u64,           // 默认 800，与现 assemblyai 一致
    pub max_segment_chars: usize, // 可选，防止单段过长
    pub allow_tier_c_fallback: bool,
}

pub enum OnlineSegmentSource {
    VendorNativeSegments,  // 已有句级轴，仅校验/合并
    TimedWords,            // gap + 标点切句
    ProportionalFallback,  // Tier C
}
```

**输出**：`Vec<TranscribeSegmentDraft>` + `Vec<TranscribeHint>`（复用现有 hint 枚举或扩展）

### 1.2 调用链（choke point）

```
run_transcribe_cmd.rs
  online_transcribe_* → TranscribeResponse { text, segments?, words?, ... }
  normalize_online_segments(response, provider_id, audio_duration_ms)
    → if segments.len() >= 2 && tier_a_ok → pass through
    → else if words non-empty → words_to_segments (Tier A)
    → else if allow_tier_c → proportional_split + hint online_segmentation_proportional
    → else → single segment + existing warning
  parse / save (unchanged)
```

### 1.3 模块落位

| 文件 | 动作 |
|------|------|
| `apps/desktop/src-tauri/src/project/online_segment_normalize.rs` | **新建** |
| `apps/desktop/src-tauri/src/project/mod.rs` | `mod online_segment_normalize;` + `pub use` 若需测试 |
| `apps/desktop/src-tauri/src/project/transcribe.rs` | `assemblyai_words_to_segments` → 调共享；保留 thin wrapper |
| `apps/desktop/src-tauri/src/stt_native/deepgram.rs` | 内联 gap → 共享 |
| `apps/desktop/src-tauri/src/stt_native/dashscope_asr.rs` | SSE 流解析 + sentence 列表 |
| `apps/desktop/src-tauri/src/project/run_transcribe_cmd.rs` | 在线路径调用 normalize |
| `apps/desktop/src-tauri/src/stt_native/mod.rs` | 可选：减少重复单段 warning（normalize 已处理） |

TS：

| 文件 | 动作 |
|------|------|
| `sttOnlineProviderContract/types.ts` | 可选字段 `wordTimestamps?: boolean` |
| `sttOnlineProviderContract/definitions.ts` | 按厂商校正 |
| `services/asr/asrTranscribeHints.ts`（或等价） | `online_segmentation_proportional` |
| `docs/architecture/stt-online-providers.md` | Tier A/C 表 |

---

## 2. Phase 分解

### Phase P1 — 共享 normalize + 迁入（不含百炼 SSE）

**目标**：单一切句真源；Deepgram / AssemblyAI 行为与现网等价（单测 golden）。

| # | 任务 | 细节 |
|---|------|------|
| P1.1 | 实现 `timed_words_to_segments` | gap 切句 + 中文/英文句末标点断句；空词列表返回 Err |
| P1.2 | 实现 `merge_native_segments` | 校验 monotonic timestamps；单段 pass-through |
| P1.3 | 实现 `normalize_online_segments` 入口 | 按 provider 元数据选策略 |
| P1.4 | Refactor `assemblyai_words_to_segments` | 委托 P1.1；删除重复 gap 常量 |
| P1.5 | Refactor `deepgram.rs` | 词列表 → TimedWord → P1.1 |
| P1.6 | Wire `run_transcribe_cmd` | 仅 `transcribe_native_online` / online 分支；本机路径不调用 |
| P1.7 | Unit tests | `online_segment_normalize.rs` 内 `#[cfg(test)]`：gap、标点、单段、多段 golden |

**验证**

```bash
cd apps/desktop/src-tauri && cargo test online_segment_normalize --lib
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

**完成标准**：AssemblyAI / Deepgram  fixture 测试与 refactor 前 segment 边界一致（±0ms）。

---

### Phase P2 — 百炼 SSE

**目标**：Fun-ASR 同步路径返回 **多 segment + Tier A 时间戳**。

| # | 任务 | 细节 |
|---|------|------|
| P2.1 | HTTP 请求头 | `X-DashScope-SSE: enable`（替换 disable） |
| P2.2 | SSE 解析器 | 缓冲 `data:` 行；JSON 含 `output.sentence` / `sentence_end` / `words`；收集 `sentence_end: true` 事件 |
| P2.3 | 映射 SegmentDraft | 每句 `begin_time`/`end_time`（ms）→ segment；词级可选填 `TimedWord` 供二次 normalize |
| P2.4 | 错误处理 | 非 SSE 200、半包、无 sentence_end → 返回明确错误；**不**自动 fallback 同步（Intent Q3） |
| P2.5 | 日志 | `desktop.log` 记录 sentence  count、SSE 模式 |
| P2.6 | Unit tests | fixture：`sentence_end` ×3 的 SSE 片段 → 3 segments |

**Dashscope 响应字段（对齐官方 REST SSE 文档）**

- 关注：`header.event`、`payload.output.sentence.text`、`sentence_end`、`words[].begin_time/end_time`
- 全文：`output.text` 拼接校验

**验证**

```bash
cargo test dashscope --lib
# 手测：见 hand-test checklist §百炼
```

**完成标准**：~3–5min 访谈音频 hand-test **≥2 segments**；acceptance ACC-SEG-DS-01。

---

### Phase P3 — OpenAI word 轴 + capabilities

**目标**：OpenAI 在线转写在需要分句时走 **whisper-1 + word timestamps**，capabilities 诚实。

| # | 任务 | 细节 |
|---|------|------|
| P3.1 | `transcribe.rs` OpenAI 分支 | 若配置/模型为 gpt-4o 系且 `needs_segment_timestamps`：并行或串行 whisper-1 `timestamp_granularities[]=word` |
| P3.2 | 合并策略 | whisper-1 words → normalize；gpt-4o text 可选作「润色全文」**不**改 segment 边界（本薄片默认：**仅 whisper-1 一条路径**，避免双计费复杂度） |
| P3.3 | `definitions.ts` | `openai`: `wordTimestamps: true`, `segmentTimestamps: true`（经 normalize）；注明 gpt-4o 无词级 |
| P3.4 | 文档 | `stt-online-providers.md` OpenAI 小节 |

**默认（本薄片）**：在线 OpenAI 转写统一用 **whisper-1** 取词级（与现网 gpt-4o 差异在 plan 备注）；若产品坚持 gpt-4o 文本，Intent Q1 留 follow-up。

**验证**：mock OpenAI word JSON unit test；hand-test 可选。

---

### Phase P4 — Tier C fallback + hints + 文档

| # | 任务 | 细节 |
|---|------|------|
| P4.1 | `proportional_segments` | 按标点切文本 + 按字符比例映射 audio duration |
| P4.2 | Hint | `online_segmentation_proportional` + 中文说明「分段时间为估算，不可用于精确剪辑」 |
| P4.3 | `definitions.ts` | `dashscope-asr`: `segmentTimestamps: true`（SSE 成功后）；`wordTimestamps: true`（若返回 words） |
| P4.4 | 更新 architecture 文档 | Tier 表、百炼 SSE、限制（20MB sync） |
| P4.5 | Research §9 | 勾选 plan/acceptance 链接 |

**验证**：单元测试 Tier C 产生 ≥2 段 + hint；capabilities 与 matrix 一致。

---

## 3. 关键实现片段（伪代码）

### 3.1 gap + 标点切句

```rust
pub fn timed_words_to_segments(
    words: &[TimedWord],
    opts: &OnlineSegmentNormalizeOptions,
) -> Vec<SegmentDraft> {
    // 1. fold words into runs
    // 2. break run when:
    //    - gap > opts.gap_ms between word[i].end and word[i+1].start
    //    - word ends with .?!。！？；
    // 3. merge empty runs
}
```

### 3.2 Dashscope SSE（示意）

```rust
async fn transcribe_dashscope_sse(...) -> Result<DashscopeTranscribeResult> {
    let req = build_request(...).header("X-DashScope-SSE", "enable");
    let mut stream = client.post(...).send().await?.bytes_stream();
    let mut sentences = Vec::new();
    while let Some(chunk) = stream.next().await {
        for event in parse_sse_chunk(&chunk)? {
            if event.sentence_end {
                sentences.push(map_sentence(event));
            }
        }
    }
    Ok(DashscopeTranscribeResult { sentences, full_text: join(&sentences) })
}
```

### 3.3 run_transcribe_cmd 挂钩

```rust
if is_online_provider(provider_id) {
    let normalized = normalize_online_segments(
        &mut response,
        provider_id,
        audio_duration_ms,
        &OnlineSegmentNormalizeOptions::default(),
    )?;
    response.segments = normalized.segments;
    response.hints.extend(normalized.hints);
}
```

---

## 4. 测试计划

| 层级 | 内容 | 位置 |
|------|------|------|
| Rust unit | gap、标点、SSE parse、Tier C | `online_segment_normalize.rs`, `dashscope_asr.rs` tests |
| Rust integration | 可选：mock HTTP SSE | `dashscope_asr` test module |
| TS | hints 文案 snapshot / enum | 若已有 asrTranscribeHints 测试则扩展 |
| 手测 | 百炼 / Deepgram / AssemblyAI | [`online-stt-segment-unify-hand-test-checklist.md`](./online-stt-segment-unify-hand-test-checklist.md) |
| Gates | 全仓 | typecheck + test + architecture-guard |

**不在本薄片**：E2E Playwright（无稳定 STT mock）；Sidecar align 集成测试。

---

## 5. 能力—UI 状态矩阵（Implement 时对照）

| Provider | wordTimestamps | segmentTimestamps | 降级 UI |
|----------|----------------|-------------------|---------|
| dashscope-asr | true（SSE words） | true（SSE sentences） | Tier C → hint 横幅 |
| deepgram | true | true（normalize） | Tier C → hint |
| assemblyai | true | true（normalize） | Tier C → hint |
| openai | true（whisper-1） | true | gpt-4o 若恢复：segmentTimestamps false + 说明 |

UI **不得**用全局 `/health.ready_for_transcribe` 表示「所选在线模型支持分句」；以 provider definition + 转写结果 hints 为准。

---

## 6. 回滚与特性开关

- **无独立 feature flag**（薄片可回滚 git revert）
- 百炼 SSE 若线上异常：hotfix 可临时 `X-DashScope-SSE: disable` + Tier C（须带 hint），acceptance 标记 degraded

---

## 7. 文件变更清单（预估）

| 路径 | Δ 行级 |
|------|--------|
| `project/online_segment_normalize.rs` | +250~350 新 |
| `stt_native/dashscope_asr.rs` | +120~180 |
| `project/transcribe.rs` | ±80 |
| `stt_native/deepgram.rs` | ±40 |
| `project/run_transcribe_cmd.rs` | +30~50 |
| TS definitions + hints | +40 |
| `stt-online-providers.md` | +60 |
| spec 四件套 | 已建 |

---

## 8. Implement 顺序（推荐单次 PR 或 2 PR）

```
PR1: P1 + P2（共享 + 百炼 SSE）→ 手测百炼
PR2: P3 + P4（OpenAI + Tier C + docs）→ 全量 acceptance
```

或 **单 PR** 若改动窗口允许（预估 1–2 天）。

---

## 9. 验证命令（Implement 结束必跑）

```bash
npm run typecheck
npm run test
node scripts/check-architecture-guard.mjs
cd apps/desktop/src-tauri && cargo test online_segment_normalize --lib && cargo test dashscope --lib
```

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-07 | 初版：四 Phase、模块落位、矩阵与验证 |
