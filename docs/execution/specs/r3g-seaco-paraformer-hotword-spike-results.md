# R3g-SeACo — SeACo-Paraformer 热词 Spike 结果

> **手测**：[r3g-seaco-paraformer-hotword-spike-hand-test-checklist.md](./r3g-seaco-paraformer-hotword-spike-hand-test-checklist.md)  
> **状态**：✅ 已跑（2026-06-11）  
> **产物**：`docs/execution/spike-output/seaco-paraformer-2026-06-11/`（gitignore）

---

## 1. 环境

| 项 | 值 |
|----|-----|
| 日期 | 2026-06-11 |
| 机器 | BaideMac（本机 spike 会话） |
| FunASR 版本 | **1.3.9** |
| 侧车 | `RUSHI_ASR_DEV_RESTART=1 npm run asr:dev` |
| Spike SKU | `iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch` |
| 加载类 | `SeacoParaformer`（warmup 后 `funasr_loaded_model_id` 确认） |

---

## 2. Baseline（Paraformer · D3 · 热词 on）

| 字段 | 值 | 来源 |
|------|-----|------|
| `term_hit_rate` | 0.75 | 2026-06-11 D3 eval |
| `cer_chars` | ~0.214 | 同上 |
| `segment_count` | ~182 | 同上 |
| `rtfx` | ~6.9 | 同上 |
| 专名 | 制控✓ 禅堂✓ 觉观✓ 经行✗ | 同上 |

---

## 3. SeACo 实测（D3 · 热词 on）

| 字段 | 值 | Δ vs baseline | G 门槛 |
|------|-----|---------------|--------|
| `term_hit_rate` | **0.75** | 0 | ≥ 0.75 ✅（未严格优于） |
| `cer_chars` | **0.2115** | **−0.0025** | ≤ ~0.234 ✅ |
| `segment_count` | **185** | +3 | ≥ 50 ✅ |
| `segmentation_mode` | **sentence_info** | — | ✅ |
| `rtfx` | **7.46** | +0.56 | 记录 |
| `wall_sec` | **160.2** | — | |
| `warnings` | `[]` | — | 无 hotword unsupported ✅ |

### 专名逐条

| 专名 | Baseline | SeACo |
|------|----------|-------|
| 制控 | ✓ | ✓ |
| 禅堂 | ✓ | ✓ |
| 觉观 | ✓ | ✓ |
| 经行 | ✗ | ✗ |

---

## 4. Hotwords A/B（D3）

| `hotwords_ab_variant` | `hotwords_sent` | `term_hit_rate` | `cer_chars` | `wall_sec` | `rtfx` |
|----------------------|-----------------|-----------------|-------------|------------|--------|
| on | 制控,禅堂,觉观,经行 | 0.75 | 0.2115 | 163.95 | 7.29 |
| off | — | **0.75** | **0.2115** | 137.91 | 8.67 |

**Lift**：**无**（on/off 假设文本与 CER 完全一致）。

---

## 5. 补充探测

| 探测 | 结果 |
|------|------|
| 官方 `asr_example_hotword.wav` + `hotwords=魔搭` vs off | 文本相同（无 魔搭 子串） |
| AutoModel 直调 `SeacoParaformer` + `hotword=魔搭` | 与 off 相同 |
| D3 前 90s：off / 逗号热词 / 空格热词 / 单热词「经行」 | 四者输出相同 |

**解读**：SeACo 权重与链路可跑，但 **本栈未观测到热词偏置生效**（非仅 manifest 逗号分隔问题）。可能原因待查：VAD 批推理路径 `hotword` 传递、或示例音频本身不含可触发热词偏置的内容。

---

## 6. 门禁勾选

| ID | 通过 | 备注 |
|----|------|------|
| G1 链路 | ✅ | prepare/warmup/D3 全绿 |
| G2 term_hit | ⚠️ | 持平，未优于 baseline |
| G3 CER | ✅ | 略优（噪声级） |
| G4 hotwords lift | ❌ | on/off 无差异 |
| G5 warnings | ✅ | |
| G6 RTFx | ✅ | ~7.5，与 Paraformer 同量级 |

---

## 7. 结论

- [ ] **Go**
- [x] **Defer**
- [ ] **No-go**

**一句话**：SeACo 可替代跑通 D3 且 CER 略优，但 **热词专名目标未达成**（仍漏「经行」；on/off 零 lift）— **不宜作为「热词增强 SKU」推进**；若继续 R&D，须先证明 `hotword` 在侧车 VAD 管线中真实生效（日志 / 最小复现 / 逗号→空格 eval 契约修正）。

---

## 8. 产物路径

| 文件 | 路径 |
|------|------|
| seaco hotwords on JSON | `docs/execution/spike-output/seaco-paraformer-2026-06-11/seaco-hotwords-on.json` |
| seaco hotwords ab CSV | `docs/execution/spike-output/seaco-paraformer-2026-06-11/seaco-hotwords-ab.csv` |

**侧车状态**：spike 结束后侧车仍为 **SeACo SKU**；桌面端需重启侧车或 `RUSHI_FUNASR_MODEL=<paraformer>` + `RUSHI_ASR_DEV_RESTART=1 npm run asr:dev` 恢复默认。
