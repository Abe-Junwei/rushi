# R3g-B — Qwen3-0.6B Sherpa vs FunASR 对照报告（VAD + ForcedAligner）

> **状态**：🟡 待 gold 审定 + 产品签收（2026-06-11 跑数）  
> **R3s-A Plan**：[r3s-sherpa-qwen3-default-engine-plan.md](./r3s-sherpa-qwen3-default-engine-plan.md) · **Acceptance**：[r3s-sherpa-qwen3-default-engine-acceptance.md](./r3s-sherpa-qwen3-default-engine-acceptance.md)  
> **Research**：[r3g-b-qwen3-asr-sku-spike-research.md](./r3g-b-qwen3-asr-sku-spike-research.md) · [ForcedAligner](./r3g-b-align-qwen3-forced-aligner-spike-research.md)  
> **语段明细**（本地）：`docs/execution/spike-output/qwen3-0.6b-2026-06-11/segment-compare-vad-forced-aligner.md`  
> **复现**：见 §6

---

## 1. 实验条件

| 项 | FunASR | Sherpa ONNX |
|----|--------|-------------|
| SKU | `Qwen/Qwen3-ASR-0.6B`（PyTorch / ModelScope） | `sherpa-onnx-qwen3-asr-0.6B-int8`（ModelScope ONNX） |
| 分段 | FSMN VAD + **`Qwen/Qwen3-ForcedAligner-0.6B`** | **Silero VAD** + per-segment Qwen3 |
| 标点 | 无（Qwen SKU） | 无 |
| Provider | CPU | CPU |
| 素材 | `fixtures/eval/samples/制控.mp3` → ffmpeg 16 kHz mono 截取 | 同左 |

**说明**：交叉 CER 以 **FunASR `full_text`** 为参考，**无金标**；gold 审定后应改算对金标 CER。

---

## 2. 指标总览

| 指标 | 30s | | 780s (13min) | |
|------|-----|--|--------------|--|
| | **Sherpa** | **FunASR** | **Sherpa** | **FunASR** |
| 语段数 | **11** | 2 | **172** | 103 |
| 全文字数 | 90 | 90 | 1227 | 1256 |
| RTF | **0.21** | 2.23 | **0.12** | 0.95 |
| CER（S\|F） | 0.244 | — | 0.222 | — |
| CER（F\|S） | — | 0.244 | — | 0.227 |
| `segmentation_mode` | VAD 段首末 | `vad_timestamp` | 同左 | 同左 |

---

## 3. 语段对照结论（ForcedAligner + VAD）

### 3.1 Sherpa：可用于抽检与编辑器对齐

- 30s：**11** 个短语段（约 0.8–4s），时间轴与听感可对照。
- 780s：**172** 段，RTF **~8× 实时**；段界密度接近 Paraformer FunASR 长音频量级。

### 3.2 FunASR + ForcedAligner：全文可读，语段不可信

| 现象 | 30s | 780s |
|------|-----|------|
| 语段数 | 2 | 103 |
| 典型问题 | 89 字挤在 **3ms** 窗口 | 大量 **1 字/段**，dur≈0 |
| `full_text` | 与 Sherpa 字数接近 | 1256 字，与 Sherpa 1227 接近 |
| Rushi 契约 | ❌ 不能直接进时间轴 | ❌ 同上 |

**结论**：ForcedAligner 在本 spike 下 **未产出合格 `TranscriptionSegment`**；若坚持 FunASR Qwen，需另做「字级 align → 合并语段」薄片，成本高于 Sherpa VAD 路径。

### 3.3 文本质量（互相对照，非金标）

- CER **~22–24%**：两引擎 **同档**，不是 Sherpa 精度碾压 FunASR。
- 差异多为同音/用词（你跟写 vs 你们赶紧写、选好 vs 学好、一座 vs 一坐）。

---

## 4. 对产品路线的影响

### 4.1 FunASR Qwen3

- 维持 [r3g-b-qwen3-asr-spike-results.md](./r3g-b-qwen3-asr-spike-results.md) **No-go**（无合格语段），即使用户本地已有 ForcedAligner。
- **不**将 ForcedAligner 作为 Rushi catalog 默认依赖。

### 4.2 Sherpa Qwen3（未来双 SKU 之一）

| 维度 | 评估 |
|------|------|
| 语段 | ✅ spike 达标，可作 **Phase 1** 迁移 SKU |
| 速度 | ✅ 明显优于 FunASR Qwen |
| 标点 | ❌ 需后处理或接受无标点 |
| 热词 | ⚠️ API 有字段，未验收 |
| LRC / catalog | ❌ 未接 |

### 4.3 Sherpa 双 SKU（Paraformer + Qwen）

- **本文仅证明 Qwen SKU**；Paraformer-on-Sherpa 见 [r3h-3.5-sherpa-quant-compare-report.md](./r3h-3.5-sherpa-quant-compare-report.md)（ADR-0006 Partial Go）。
- 建议顺序：**先 Sherpa Qwen 端到端** → 再 Sherpa Paraformer + 标点/热词。

---

## 5. 产品签收

| 项 | 判断 |
|----|------|
| 语段对照表已生成且可抽检 | ☐ 通过 ☐ 不通过 |
| 同意 FunASR Qwen 继续 **No-go** | ☐ 同意 ☐ 异议 |
| 同意 Sherpa Qwen 进入 **迁移 Phase 1** backlog | ☐ 同意 ☐ Defer ☐ 否 |
| gold 审定后补 **对金标 CER** | ☐ 已排期 |

**签收人**：__________ **日期**：__________

---

## 6. 复现命令

```bash
# 权重
bash scripts/r3g-b-download-sherpa-qwen3-onnx.sh

# 对照（建议带 ForcedAligner）
export RUSHI_FUNASR_FORCED_ALIGNER=Qwen/Qwen3-ForcedAligner-0.6B
export SHERPA_QWEN3_MODEL_DIR=fixtures/sherpa-qwen3-asr-0.6B
export SHERPA_SILERO_VAD_MODEL=fixtures/sherpa-vad/silero_vad.onnx

bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --pipeline vad --duration 30
bash scripts/r3g-b-qwen3-06b-funasr-sherpa-compare.sh --pipeline vad --duration 780
```

产物（`docs/execution/spike-output/qwen3-0.6b-YYYY-MM-DD/`）：

| 文件 | 内容 |
|------|------|
| `segment-compare-vad-forced-aligner.md` | **语段对照表**（人工抽检主文件） |
| `quant-compare-qwen3-0.6b-vad-{30,780}s.json` | 定量 JSON |
| `sherpa-qwen3-vad-*.json` / `funasr-qwen3-*.json` | 原始假设 |
