# 在线 STT 统一分段 — Acceptance

> **Research**：[`online-stt-segmentation-nlp-stack-research.md`](./online-stt-segmentation-nlp-stack-research.md)  
> **Intent**：[`online-stt-segment-unify-intent.md`](./online-stt-segment-unify-intent.md)  
> **Plan**：[`online-stt-segment-unify-plan.md`](./online-stt-segment-unify-plan.md)  
> **Hand-test**：[`online-stt-segment-unify-hand-test-checklist.md`](./online-stt-segment-unify-hand-test-checklist.md)

---

## 0. 验收范围

本 acceptance 覆盖 **Tier A 统一分段 + 百炼 SSE + Tier C 诚实降级 + capabilities 对齐**。  
**不包含**：Sidecar forced alignment、Fun-ASR 异步 `file_urls`、本机 Paraformer 分段变更。

---

## 1. 能力—UI 状态矩阵

| ID | Provider | 配置状态 | 转写结果 | UI / hints 期望 |
|----|----------|----------|----------|-----------------|
| CAP-01 | dashscope-asr | Key 有效，小音频 (&lt;17MB wav) | SSE 成功，≥2 句 | 时间轴多段；**无** proportional hint |
| CAP-02 | dashscope-asr | SSE 失败或无句界 | Tier C 或单段 | 若 Tier C：`online_segmentation_proportional`；若单段：既有「未返回分句时间戳」warning |
| CAP-03 | deepgram | Key 有效 | words 返回 | 多段；normalize 与 refactor 前行为一致（golden） |
| CAP-04 | assemblyai | Key 有效 | words 返回 | 同上 |
| CAP-05 | openai | Key 有效 | whisper-1 word 路径 | 多段；definitions `segmentTimestamps: true` |
| CAP-06 | 任意在线 | 无词级、无句级 | Tier C | proportional hint + 文案含「估算」 |
| CAP-07 | 环境面板 | 选 dashscope | — | **不**用 `/health.ready_for_transcribe` 表示分句能力；以 provider capabilities 为准 |

---

## 2. 功能验收（ACC）

### 2.1 共享 normalize（P1）

| ID | Given | When | Then |
|----|-------|------|------|
| ACC-SEG-NORM-01 | AssemblyAI words fixture（现有单测输入） | `timed_words_to_segments` | segment 数量与边界与 refactor 前 `assemblyai_words_to_segments` **一致** |
| ACC-SEG-NORM-02 | Deepgram words fixture | 同上 | 与 refactor 前 **一致** |
| ACC-SEG-NORM-03 | 词间 gap &gt; 800ms | normalize | 新 segment 起始时间 = 下一词 `start_ms` |
| ACC-SEG-NORM-04 | 词末为 `。` | normalize | 该词归入当前 segment 且下词新开 segment |
| ACC-SEG-NORM-05 | 在线转写完成 | `run_transcribe_cmd` 本机路径 | **不**调用 `normalize_online_segments` |
| ACC-SEG-NORM-06 | 在线转写完成 | 在线路径 | **调用** normalize；segments 写入 DB 前已更新 |

### 2.2 百炼 SSE（P2）

| ID | Given | When | Then |
|----|-------|------|------|
| ACC-SEG-DS-01 | 3–5min 中文访谈 wav（&lt;17MB），句间自然停顿 | 百炼在线转写 | **≥2** segments；全文与各段拼接一致 |
| ACC-SEG-DS-02 | SSE fixture（3× `sentence_end`） | unit parse | **3** segments；monotonic `start_ms` &lt; `end_ms` |
| ACC-SEG-DS-03 | 请求发出 | inspect headers | `X-DashScope-SSE: enable` |
| ACC-SEG-DS-04 | 转写成功 | `desktop.log` | 含 SSE 模式 / sentence count 诊断 |
| ACC-SEG-DS-05 | 术语库已配置 | 百炼转写 | 热词仍生效（回归 ACC-STT-ALI 不断） |
| ACC-SEG-DS-06 | &gt;17MB wav | 转写 | 现有大小限制错误；**不**回归为 silent 单段 |

### 2.3 OpenAI（P3）

| ID | Given | When | Then |
|----|-------|------|------|
| ACC-SEG-OAI-01 | OpenAI 在线转写 | whisper-1 + word timestamps | words 非空 → normalize → ≥2 segments（有停顿样本） |
| ACC-SEG-OAI-02 | `definitions.ts` | 读 openai capabilities | `segmentTimestamps: true` 且文档/注释说明依赖 whisper-1 |

### 2.4 Tier C fallback（P4）

| ID | Given | When | Then |
|----|-------|------|------|
| ACC-SEG-TIERC-01 | 无 words、无 native segments、长文本 | normalize + allow_tier_c | ≥2 segments（含标点） |
| ACC-SEG-TIERC-02 | Tier C 触发 | hints | 含 `online_segmentation_proportional` |
| ACC-SEG-TIERC-03 | Tier C 结果 | 产品语义 | **不得**标记为 Tier A；capabilities 不声称「厂商原生分句」 |

---

## 3. 精度验收（语段级）

手测子集（见 hand-test §波形抽样）：

| ID | 方法 | 通过线 |
|----|------|--------|
| ACC-SEG-PREC-01 | 随机 **10** 个 segment 句首对齐波形 | 中位误差 **&lt; 300ms**（Tier A） |
| ACC-SEG-PREC-02 | Tier C 样本 | 仅确认「可编辑多段」；**不**测 300ms |

---

## 4. 自动化门禁

Implement 完成后 **全部 PASS**：

```bash
npm run typecheck
npm run test
node scripts/check-architecture-guard.mjs
cd apps/desktop/src-tauri && cargo test online_segment_normalize --lib && cargo test dashscope --lib
```

| ID | 检查项 | 期望 |
|----|--------|------|
| GATE-01 | typecheck | 0 errors |
| GATE-02 | npm test | 无新增失败（已知 unrelated 失败须记录，不归因本薄片） |
| GATE-03 | architecture-guard | PASS |
| GATE-04 | cargo test 上述模块 | PASS |

---

## 5. 文档验收

| ID | 文档 | 期望 |
|----|------|------|
| DOC-01 | `stt-online-providers.md` | 百炼 SSE、Tier A/C、OpenAI whisper-1、20MB 限制 |
| DOC-02 | research §9 | intent/plan/acceptance 已链接 |
| DOC-03 | 本 acceptance | 手测 checklist 已链接且执行记录 |

---

## 6. 回归（不得破坏）

| ID | 场景 | 期望 |
|----|------|------|
| REG-01 | ACC-STT-ALI 词汇表 create/update | 仍 PASS |
| REG-02 | 本机 Paraformer / funasr 转写 | segment 行为不变 |
| REG-03 | 在线转写空音频 / 错误 Key | 错误信息清晰；无 panic |
| REG-04 | Deepgram / AssemblyAI 既有 vitest / rust 测 | 无意外 snapshot 漂移（若 drift 须 plan 内 explain） |

---

## 7. 签收清单

**Plan 阶段（当前）**

- [x] Intent 已写并链接 research
- [x] Plan 已写并链接 research + intent
- [x] Acceptance 已写并含能力矩阵
- [ ] 用户确认进入 Implement

**Implement 阶段**

- [ ] P1 ACC-SEG-NORM-* PASS
- [ ] P2 ACC-SEG-DS-* PASS + hand-test 百炼
- [ ] P3 ACC-SEG-OAI-* PASS（或明确 defer 并更新 intent）
- [ ] P4 ACC-SEG-TIERC-* PASS
- [ ] GATE-* PASS
- [ ] DOC-* PASS
- [ ] Research §9 全部勾选

---

## 8. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-06-07 | 初版：ACC/CAP/GATE/REG 与精度子集 |
