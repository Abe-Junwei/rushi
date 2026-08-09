# whisper.cpp ggml-large-v3 金标对照 — C1 结果

> **调研**：[`r3-whisper-cpp-sidecar-compare-research.md`](./r3-whisper-cpp-sidecar-compare-research.md)  
> **脚本**：[`scripts/r3-whisper-cpp-compare-run.py`](../../../scripts/r3-whisper-cpp-compare-run.py)  
> **产出**：`docs/execution/spike-output/whisper-cpp-compare/`（gitignore）  
> **结论**：**No-go**（2026-08-07）— 长金标 content_cer 远劣于 Paraformer；默认替换与可选第二引擎均不过产品闸门

## 环境

| 项 | 值 |
|----|-----|
| 日期 | 2026-08-07 |
| 机器 | Apple Silicon（M3 Pro），Metal |
| whisper-cli | EasyWhisperUI workspace `bin/whisper-cli` |
| 模型 | `ggml-large-v3.bin`（3,095,033,483 bytes，SHA256 与官方一致） |
| 金标音频 | `fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3`（~1195s） |
| 金标参考 | `fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt` |
| Paraformer 基线 | 复用 2026-07-28 产品路径 spike（`long-paraformer_product.json`，wall=41.5s） |

## 闸门

| ID | 标准 | Paraformer | whisper.cpp baseline | whisper.cpp antihall | 通过？ |
|----|------|------------|----------------------|----------------------|--------|
| G1 | 短 30s ≥1 段且非 whole-track | — | **6** 段 / 14.9s | （未重跑） | **是**（baseline） |
| G2 | 长样本 ≥10 段且非 whole-track | **186** | **78** | **276** | **是** |
| G3 | content_cer ≤ Paraformer×1.1（≤0.1576） | **0.1433** | **0.9847** | **0.5637** | **否** |
| G4 | wall ≤ 2× Paraformer（≤83s） | **41.5s** | **189s**（~4.6×） | **243s**（~5.9×） | **否** |

## 对照摘要（长 D3）

| run_id | segments | content_cer | wall_sec | rtfx | 备注 |
|--------|----------|-------------|----------|------|------|
| paraformer_product_prior | 186 | **0.1433** | 41.5 | 28.8 | `sentence_info` |
| long_whisper_cpp_large_v3（默认 flags） | 78 | **0.9847** | 189.0 | 6.3 | **全程幻觉**：78/78 段均为「请不吝点赞 订阅…」 |
| long_whisper_cpp_large_v3_antihall（`-tp 0.0 -mc 64 -et 3.0 -sns`） | 276 | **0.5637** | 243.1 | 4.9 | 部分可读禅堂文本，仍夹杂同款幻觉；CER 约 Paraformer **3.9×** |

### 短（D3 @60s 起 30s，baseline）

| run_id | segments | wall_sec | 备注 |
|--------|----------|----------|------|
| short_whisper_cpp_large_v3 | 6 | 14.9 | 有字、偏误明显，但非 spam 复读 |

## 解读

1. **语段契约**：whisper.cpp **能**产出多段时间轴（G2 过）— 这是相对 FunASR 内嵌 Whisper（0 段）的实质差异。  
2. **精度**：在本仓 D3 金标上，large-v3 **明显劣于** Paraformer；antihall 仍 content_cer≈0.56。  
3. **幻觉**：默认参数对长音频出现经典中文「请不吝点赞…」复读；EasyWhisperUI 常用 flags 可缓解但未消除。  
4. **墙钟**：~5–6× Paraformer（同机 Metal），不适合默认引擎。  
5. **与用户主观**：座谈录音上 EasyWhisperUI 可能更好，**不能**外推到 Rushi 金标/默认课音频；若要为佛学场景特化，须另建该域金标再测。

## 复核：是不是测错了？

**结论：不是喂错/静音文件；是「从 t=0 整轨解码」触发了 Whisper 经典幻觉锁死。**

| 检查 | 结果 |
|------|------|
| `d3-long-16k.wav` 能量 | 多窗口 RMS/峰值正常（非静音）；volumedetect mean≈-25～-32 dB |
| 短窗 @60s（30s） | 有禅堂相关中文，**无**「请不吝…」spam |
| 整轨从 t=0 / 前 90s | **复读**「明镜/请不吝点赞…」 |
| 中段 @240s 起 180s（同模型同 flags） | **可读禅堂讲课**，spam 命中 **0**；与内容主题一致 |

机制（业内常见）：片头偏弱/非典型语音 → 解码出 YouTube 口播幻觉 → 上下文自条件 → 后续窗继续复读。  
因此「全程幻觉」描述的是 **整轨从 0 跑完的那次产物**，不是「large-v3 完全不能听这段课」。  
产品含义仍成立：Rushi 长课若直挂 whisper-cli 整轨、无稳健 VAD/切窗/幻觉抑制，**会踩同一坑**；中段能听懂 ≠ 可直接替换 Paraformer 默认路径。

复核产物：`docs/execution/spike-output/whisper-cpp-compare/verify-mid180.txt` 等（gitignore）。

## 结论

- [ ] **Go** — 可谈可选引擎 Phase 1  
- [ ] **Defer** — 仅研究（语段勉强、精度/墙钟未达）  
- [x] **No-go** — **不得**默认替换 FunASR；**不得**上 catalog 第二引擎（当前证据）

**说明**：

```
1. G2 过、G3/G4 不过 → 产品路径硬失败。
2. 旧 FunASR-Whisper No-go 因「0 语段」；本测证明 whisper.cpp 过语段闸门，但仍因 CER/墙钟 No-go。
3. 过渡期继续 EasyWhisperUI → SRT 导入；不改 ADR-0003 默认。
4. 重开条件：同金标 content_cer ≤ Paraformer×1.1 且 wall ≤2×；或新产品域金标 + 书面接受精度/速度权衡。
```

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-07 | C1 初跑：baseline 幻觉；antihall 复跑；签收 No-go |
