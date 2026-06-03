# R3g-B — Qwen3-ASR-0.6B Spike 实测记录

> 填表真源：research [§4.1](./r3g-b-qwen3-asr-sku-spike-research.md#41-go--no-go-阈值硬闸门)  
> 手测步骤：[r3g-b-qwen3-asr-spike-hand-test-checklist.md](./r3g-b-qwen3-asr-spike-hand-test-checklist.md)

## 环境

| 项 | Paraformer 对照 | Qwen3-0.6B |
|----|-----------------|------------|
| 日期 | | |
| 机器 / 芯片 | | |
| `funasr` 版本 | | |
| `torch` 版本 | | |
| `RUSHI_FUNASR_MODEL` | （catalog 默认） | `Qwen/Qwen3-ASR-0.6B` |
| `/health` ready | | |

## §4.1 Go / No-go 指标

| # | 指标 | Paraformer 实测 | Qwen3 实测 | 通过？ |
|---|------|-----------------|------------|--------|
| G1 | 13min 语段数 ≥10，无 whole_track_fallback | | | |
| G2 | 20min 语段数 ≥ max(15, 90% baseline) | | | |
| G3 | async 首窗后 ≤60s 见 ≥1 非空段 | | | |
| G4 | blocking vs async 段数 ±10%、首尾 Δt ≤0.5s、窗界无重复 | | | |
| G5 | 制控 `term_hit_rate` ≥ Paraformer baseline | | | |
| G6 | 磁盘增量 ≤2.5GB（并存 ≤5GB 或互斥文案） | | | |
| G7 | prepare → ready；PyInstaller import 不 500 | | | |
| G8 | 20min wall ≤1.5× Paraformer（MPS/CUDA） | | | |

## 样本备注

### S1（13min）

- 语段数 / 首末时间 / 首段 text 前 80 字：  
- warnings：  

### S2（20min）

- async 首段可见（秒）：  
- 语段数：  

### S3（制控）

- `term_hit_rate`：  

## 结论（选一）

- [ ] **Go** → 起草 `r3g-b-qwen3-asr-sku-intent.md` 并排队 R3g-B 产品化  
- [ ] **Defer** → blocker：  
- [ ] **No-go** → 理由：  

**一句话**：  
