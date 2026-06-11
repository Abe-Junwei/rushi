# Intent: ACC-EVAL-2 — 长音频评测指标（segment_count · RTFx · segmentation_mode）

> **Research**：[`asr-landscape-top4-research-2026-06.md`](./asr-landscape-top4-research-2026-06.md) §④  
> **Plan**：（编码前起草）`acc-eval-2-long-form-metrics-plan.md`  
> **Acceptance**：（编码前起草）`acc-eval-2-long-form-metrics-acceptance.md`  
> **Hand-test**：[`acc-eval-2-long-form-metrics-hand-test-checklist.md`](./acc-eval-2-long-form-metrics-hand-test-checklist.md) ✅  
> **前置（已签收）**：**ACC-EVAL-1** = **ASR-VOC-5**（`term_hit` + hotwords A/B）— [`asr-voc-5-hand-test-checklist.md`](./asr-voc-5-hand-test-checklist.md)  
> **状态**：规划门禁（2026-06-11）  
> **估时**：**1–2 人日**  
> **路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §L6 · [`r3-asr-landscape-2026-05-improvement-backlog.md`](./r3-asr-landscape-2026-05-improvement-backlog.md)

---

## 1. 背景与问题

### 1.1 用户场景

维护者与 spike 负责人需要在 **换 SKU / 调 Profile / 发版前**，用一条命令回答：

| 问题 | 现有 ACC-EVAL-1 | 缺口 |
|------|-----------------|------|
| 专名是否命中？ | `term_hit_rate` ✅ | — |
| 长音频能否 **切出可编辑语段**？ | — | **无语段数** |
| 推理是否 **够快**（相对音频时长）？ | — | **无 RTFx / wall** |
| 分段走哪条内核路径？ | warnings 里散落 | **无结构化 `segmentation_mode`** |
| 与 ASR Leaderboard 可比？ | 仅 CER（需 reference） | **无 long-form 轨标记** |

[ASR Leaderboard (arXiv:2510.06961)](https://arxiv.org/abs/2510.06961) 强调 **long-form + RTFx** 与短句 WER 分开报告；Rushi 主场景是 **13～21min 中文课音频**，不能只看占位 `clear.wav` 冒烟。

### 1.2 本仓现状

```text
fixtures/eval/eval_manifest.v1.json
  → scripts/eval-run.py（curl POST /v1/transcribe）
  → services/asr/rushi_asr/eval_metrics.py（cer / term_hit / low_confidence_ratio）
```

- **制控长样本**：`proper-noun-zhikong` + `samples/制控.mp3`（~1250s）；Paraformer 基线 **197 段 / ~155s wall**（见 `docs/execution/spike-output/qwen3-2026-06-03/`）。
- **侧车响应**已含 `duration_sec`、`segmentation_mode`（[`schemas.py`](../../../services/asr/rushi_asr/schemas.py) · R3t-A）；**eval-run 未读取**。
- **CI**：`asr` job 跑默认 `eval-run.py` + stub/占位 wav；**不**跑制控大文件（合理）。

---

## 2. 目标（Outcome）

扩展评测 CLI，使 **blocking `/v1/transcribe`** 批跑 manifest 时，每条 item 输出：

| 字段 | 含义 | 来源 |
|------|------|------|
| `segment_count` | 语段条数 | `len(segments)` |
| `duration_sec` | 音频时长 | 响应 `duration_sec`（侧车 ffprobe） |
| `wall_sec` | 客户端测到的转写墙钟 | `eval-run` 包 curl 计时 |
| `rtfx` | 实时率倒数 ≈ `duration_sec / wall_sec` | `eval_metrics.rtfx()` |
| `segmentation_mode` | R3t-A 模式 | 响应 `segmentation_mode`；缺失时从 warnings 推断或 `null` |

并更新 manifest：

- 新增 category **`long_form`**（长音频轨，≥13min 语义）
- 制控条目 **`category`: `long_form`**（保留 `term_hit` / `hotwords_ab`）
- 可选 **`min_segments`**：本地断言用（**不**作 CI 硬门禁，因 CI 无制控 mp3）

**成功判据（产品/维护）**：

1. 本机 Paraformer + 制控：`npm run eval:run:long-form` → JSON 中 `segment_count ≥ 10`、`segmentation_mode` 含 `sentence_info` 或等价、`rtfx` 为有限正数。
2. 与 ACC-EVAL-1 **完全兼容**：`--hotwords-ab`、`--format csv` 仍可用；新列 **追加**，不删旧列。
3. 后续 **R3g-B / Fun-ASR-Nano spike** 必须附 `--output docs/execution/spike-output/.../eval-report.json` 存档。

---

## 3. 非目标（Explicit Out of Scope）

| 不做 | 理由 |
|------|------|
| 改 ASR 侧车 / FunASR 引擎 | 只消费已有 `TranscriptionResult` 字段 |
| 复现 HF Open ASR Leaderboard 全榜 | 英文 LibriSpeech 与 Rushi 主场景不对齐 |
| 引入 WER 归一化管线 / ITN 双轨自动对比 | 可后续 ACC-EVAL-3；本薄片只记录 `warnings` 原样 |
| CI 硬门禁绑定制控 mp3 | 大文件不入库策略不变；CI 仍占位 wav |
| 桌面 **质量 Tab** UI | R4 可选；本薄片只保证 CLI + JSON 报告 |
| async `/v1/transcribe/async` 路径 | blocking 为 SKU 对照真源；async SLA 仍走 R3e-C 手测 |
| `min_segments` 失败时 exit 1（CI） | 仅本地/spike **`--assert-min-segments`** 可选 flag |

---

## 4. 方案概要

### 4.1 指标定义

```python
# eval_metrics.py（新增）
def rtfx(duration_sec: float | None, wall_sec: float | None) -> float | None:
    """Inverse RTF: audio_seconds / wall_seconds. None if inputs invalid."""
```

- 与 ASR Leaderboard **RTFx** 同义（音频时长 / 推理时长）；侧车内部若另有 RTF 日志，**不**在本薄片暴露。
- `wall_sec` 含 curl + 侧车 blocking 全路径（与 spike 手测一致）。

### 4.2 manifest schema 扩展（向后兼容）

`eval_manifest.v1.json` `items[]` 可选字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `category` | string | 新增枚举值 **`long_form`** |
| `min_segments` | int | 本地断言下限；制控建议 **10**（spike 对照），Paraformer 基线 **197** 写入 hand-test 文档而非 manifest 硬编码 |
| `notes` | string | 如「R3g 13min 替身 ~21min」 |

**不 bump** `schema_version`（仍为 `"1"`）；未知字段忽略。

### 4.3 eval-run.py 变更

| 变更 | 说明 |
|------|------|
| `transcribe_manifest_item` | 记录 `t0=time.perf_counter()` → curl → `wall_sec`；读 `duration_sec`、`segmentation_mode`、`segment_count` |
| `CSV_COLUMNS` | 追加 `segment_count`, `duration_sec`, `wall_sec`, `rtfx`, `segmentation_mode` |
| JSON report | 顶层可选 `metrics_schema: "acc-eval-2"`；`items[]` 含上列 |
| CLI | `--assert-min-segments`：若 item 有 `min_segments` 且 `segment_count < min_segments` → exit 1 |
| npm script | `eval:run:long-form` → `--filter-id proper-noun-zhikong`（或等价） |

### 4.4 文档

| 文件 | 变更 |
|------|------|
| [`fixtures/eval/README.md`](../../../fixtures/eval/README.md) | category 表 + long_form + 新指标说明 |
| [`docs/execution/stabilization.md`](../stabilization.md) §2 | 链 ACC-EVAL-2 |
| research brief §7 签收 | intent ✅ |

---

## 5. 验收标准（Acceptance 预览）

编码完成后须满足：

| # | 检查 | 命令 / 证据 |
|---|------|-------------|
| E1 | 单元：`rtfx(1250, 155.5) ≈ 8.04` | `pytest services/asr/tests/test_eval_metrics.py` |
| E2 | CSV 含新列 | `test_eval_run_csv.py` 更新 |
| E3 | 制控手测：Paraformer `segment_count=197`（±0） | hand-test checklist |
| E4 | ACC-EVAL-1 回归 | `npm run eval:run:hotwords-ab` 仍绿 |
| E5 | CI 不回归 | 默认 `eval-run.py` 对占位 wav 仍 exit 0 |
| E6 | typecheck / test / guard | 仓库标准 L0 |

**Spike 消费约定**（非本 PR 阻塞）：

```bash
npm run eval:run -- --filter-id proper-noun-zhikong \
  --output docs/execution/spike-output/<spike-id>/eval-report.json \
  --assert-min-segments
```

---

## 6. 落位文件

| 层 | 路径 | 变更 |
|----|------|------|
| 指标 | `services/asr/rushi_asr/eval_metrics.py` | `rtfx()` |
| CLI | `scripts/eval-run.py` | 计时 + 新字段 + `--assert-min-segments` |
| 测试 | `services/asr/tests/test_eval_metrics.py` | 新建或扩展 |
| 测试 | `services/asr/tests/test_eval_run_csv.py` | 新列断言 |
| Manifest | `fixtures/eval/eval_manifest.v1.json` | 制控 → `long_form`；`min_segments: 10` |
| 文档 | `fixtures/eval/README.md`, `stabilization.md` | 指标说明 |
| npm | `package.json` | `eval:run:long-form` |

**不改动**：Rust、React、侧车 `funasr_engine.py`、catalog。

---

## 7. 风险与依赖

| 风险 | 缓解 |
|------|------|
| `duration_sec` 为 null（stub） | `rtfx=null`；占位样本仍可跑通 |
| `segmentation_mode` 老侧车未填 | 读 warnings 中 `segmentation_mode:` 前缀（`funasr_engine` 已 emit）或留 null |
| 制控 mp3 缺失 | item 已有 `optional` 语义？— **制控非 optional**；缺失则 `error`（与现行为一致） |
| CSV 列顺序变更破坏脚本 | **仅追加列**；文档注明 |

**依赖**：无；可与 **R3g-B-Align spike** 并行。

---

## 8. 签收（Intent）

- [x] Intent 完成（2026-06-11）
- [x] 编码完成（2026-06-11）：`eval_metrics.rtfx`、`eval-run` 新列、`eval:run:long-form`
- [ ] Plan + Acceptance 链接本文（本薄片 intent+手测即签收；plan/acceptance 可省略）
- [x] 手测（Paraformer + 制控 baseline）— [`acc-eval-2-long-form-metrics-hand-test-checklist.md`](./acc-eval-2-long-form-metrics-hand-test-checklist.md)
- [ ] research brief §7 勾选 intent

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-11 | 初版：ACC-EVAL-2 长音频指标薄片 intent |
