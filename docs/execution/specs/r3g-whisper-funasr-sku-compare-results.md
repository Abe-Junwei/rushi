# FunASR 内嵌 Whisper 同音频对照 — Phase 0 结果

> **调研**：[`r3g-whisper-funasr-sku-compare-research.md`](./r3g-whisper-funasr-sku-compare-research.md)  
> **脚本**：[`scripts/r3g-whisper-funasr-compare-run.py`](../../../scripts/r3g-whisper-funasr-compare-run.py)  
> **输出**：`docs/execution/spike-output/whisper-funasr-compare/`（gitignore）  
> **结论**：**No-go**（2026-07-28）— W2 失败；不进入 Phase 1

## 环境

| 项 | 值 |
|----|-----|
| 日期 | 2026-07-28 |
| 机器 / 芯片 | Apple Silicon，`device=mps` |
| `funasr` | 1.3.9（venv） |
| `openai-whisper` | 20250625（Phase 0 仅装入 `services/asr/.venv`，未改 sidecar lock） |
| `torch` / device | MPS |
| `RUSHI_MODELS_ROOT` | `~/Library/Application Support/studio.lingchuang.rushi/studio.lingchuang.rushi/models` |

**短音频说明**：默认 `fixtures/eval/samples/clear.wav` 仅 ~0.15s 占位，无法验 W1。另用 D3 长样本截取 **30s**（`SPIKE_SHORT_AUDIO`）做短对照；长样本主闸门用完整 D3 轨。

## 闸门 W1–W4

| ID | 标准 | Paraformer | whisper_turbo_vad | whisper_turbo_vad_punc | 通过？ |
|----|------|------------|-------------------|------------------------|--------|
| W1 | 短音频 Whisper ≥1 段 | 30s 截取：**2** 段 `sentence_info` | **0**（有全文，无时间戳） | **0**（有全文+标点，无时间戳） | **否** |
| W2 | 长样本 Whisper ≥10 段且非 whole-track | **186** / `sentence_info` | **0** / `empty` | **0** / `empty` | **否** |
| W3 | 长样本 `content_cer`（记数） | **0.1433** | **0.3093** | **0.3093** | 记数；分段失败 |
| W4 | Whisper wall ≤ 2× Paraformer | **41.5s** | **301.0s**（~7.3×） | **294.2s**（~7.1×） | **否** |

## 对照摘要

### 短（D3 截取 30s；非 clear.wav 占位）

| run_id | segments | mode | wall_sec | punct_density | notes |
|--------|----------|------|----------|---------------|-------|
| paraformer_product | 2 | sentence_info | 14.2 | 0.0714 | 产品路径正常 |
| whisper_turbo_vad | 0 | empty | 28.6 | 0.0 | `raw_keys=["key","text"]`；有全文预览 |
| whisper_turbo_vad_punc | 0 | empty | 37.4 | 0.1111 | ct-punc 生效；仍无时间轴 |

### 长（d3-tang32-zhikong-gaijiang，~1195s）

| run_id | segments | mode | wall_sec | rtfx | cer | content_cer | punct_density |
|--------|----------|------|----------|------|-----|-------------|---------------|
| paraformer_product | 186 | sentence_info | 41.5 | 28.8 | 0.2115 | **0.1433** | 0.0946 |
| whisper_turbo_vad | 0 | empty | 301.0 | 4.0 | 0.385 | **0.3093** | 0.001 |
| whisper_turbo_vad_punc | 0 | empty | 294.2 | 4.1 | 0.3626 | **0.3093** | **0.0973** |

### 术语（制控.mp3）

| run_id | segments | term_hit_rate | wall_sec |
|--------|----------|---------------|----------|
| — | 本轮 `--skip-term`（W2 已失败，未继续耗墙钟） | — | — |

## 标点 / 断句解读

| 观察 | 结论 |
|------|------|
| Whisper 无 punc 段数是否 ≥10 | **否** — 长/短均 **0** 段；`generate()` 合并结果仅有 `text`，无 `sentence_info` / 可用 `timestamp` |
| 挂 ct-punc 后 punct_density 是否接近 Paraformer | **是** — 长样本 0.0973 vs 0.0946；标点可接，**不能**单独解决编辑器语段 |
| Phase 1 是否默认挂 ct-punc | **不适用** — Phase 1 **不开**；若未来重开，标点可挂 ct-punc，但须先解决时间轴 |

**根因（与 Qwen spike 同类）**：FunASR 内嵌 Whisper + VAD 在本环境产出全文，但 **不进入 Rushi `segmentation.py` 可解析的句级时间戳契约** → 长音频 `empty`，编辑器不可用。

## 结论（选一）

- [ ] **Go** — W1+W2 过；可开 Phase 1（profile / cache_spec / generate kwargs）
- [ ] **Defer** — 分段勉强或 wall>2×；仅研究，不上产品路径
- [x] **No-go** — W2 失败（长音频无可用语段）

**说明**：

```
1. 精度：content_cer Whisper≈0.31 vs Paraformer≈0.14（约 2.2× 差），与公开榜方向一致。
2. 断句：Whisper 两行长样本均为 0 段 — 产品路径硬失败。
3. 标点：ct-punc 有效，但不能替代时间轴。
4. 墙钟：Whisper ~7× Paraformer（MPS）— 即便分段修好也不适合默认中文引擎。
5. 不上 catalog；不改 sidecar lock；不进入 Phase 1。
```
