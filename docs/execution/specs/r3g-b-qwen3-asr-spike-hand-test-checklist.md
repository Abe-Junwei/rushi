# R3g-B — Qwen3-ASR-0.6B Spike 手测清单

> **调研真源**：[r3g-b-qwen3-asr-sku-spike-research.md](./r3g-b-qwen3-asr-sku-spike-research.md)  
> **结果表**：[r3g-b-qwen3-asr-spike-results.md](./r3g-b-qwen3-asr-spike-results.md)  
> **门禁**：**不得**改 `LOCAL_ASR_MODEL_CATALOG` / 用户下拉，直至 Go 签收

## 前置（机器）

```bash
bash scripts/r3g-b-qwen3-asr-spike-hand-test.sh
```

## Phase 0 — 环境

1. 源码 venv：`pip install --upgrade "funasr>=1.3.3"`（及 Qwen `trust_remote_code` 依赖，见 FunASR 文档）。  
2. 启动侧车（**勿**改桌面 catalog）：

```bash
export RUSHI_FUNASR_MODEL=Qwen/Qwen3-ASR-0.6B
npm run asr:dev
```

3. `GET /health`：`funasr_model_id` 含 Qwen3；`ready_for_transcribe` 为 true。  
4. 记录 FunASR / torch 版本到 [results](./r3g-b-qwen3-asr-spike-results.md)。

- [ ] Phase 0 完成

## Phase 1 — 样本对照（Paraformer vs Qwen3）

| ID | 样本 | 操作 |
|----|------|------|
| S1 | 13min 中文（R3g ⑤c 同机样本） | 各跑一遍 blocking transcribe，记语段数 / warnings / wall clock |
| S2 | ~20min 中文 | async 120s 窗 + 首段可见时间 |
| S3 | `fixtures/eval/samples/制控.mp3` | hotwords on；`term_hit_rate` vs Paraformer |
| S4 | ≤3min 短音频 | 无窗路径回归 |

- [ ] S1–S4 完成；[results](./r3g-b-qwen3-asr-spike-results.md) §4.1 已填

## Phase 2 — Rushi 链路

- [ ] `POST /v1/transcribe` blocking 全绿  
- [ ] `POST /v1/transcribe/async` + poll（可改 `RUSHI_FUNASR_MODEL` 后跑 `scripts/r3e-c-hand-test.sh`）  
- [ ] 可选：`POST /v1/transcribe/cancel` mid-job  
- [ ] G4：20min blocking final vs async final 段界无重复（重复率 ≤5%）

## Phase 3 — 打包探测（可并行）

- [ ] bump `requirements-sidecar-*.lock` + `funasr>=1.3.3`  
- [ ] `npm run asr:build-sidecar-unix` → bundled `/health`  
- [ ] onedir 体积增量记录

## Phase 4 — 结论

- [ ] 在 [results](./r3g-b-qwen3-asr-spike-results.md) 勾选 **Go / Defer / No-go**  
- [ ] 路线图 / research §10 签收

## 签收

| 日期 | 范围 | 结果 |
|------|------|------|
| | Phase 0–4 | |
