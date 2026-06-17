# R3g-C — Fun-ASR-Nano-2512 Spike 手测清单

> **调研真源**：[r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md](./r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md)  
> **结果表**：[r3g-c-funasr-nano-spike-results.md](./r3g-c-funasr-nano-spike-results.md)  
> **门禁**：**不得**改 `LOCAL_ASR_MODEL_CATALOG` / 用户下拉，直至 Go 签收

## 前置（机器）

```bash
bash scripts/r3g-c-funasr-nano-spike-hand-test.sh
```

## Phase 0 — 环境

1. 源码 venv：`funasr` 版本记录（当前基线 1.3.9；若加载失败再试 `pip install --upgrade "funasr>=1.4.0"`）。
2. 启动侧车（**勿**改桌面 catalog）：

```bash
export RUSHI_FUNASR_MODEL=FunAudioLLM/Fun-ASR-Nano-2512
export RUSHI_FUNASR_LANGUAGE=zh
# 若 8741 已被占用：
RUSHI_ASR_DEV_RESTART=1 npm run asr:dev
```

3. 首次需 prepare 下载 ~2GB 权重（`model.pt` + `config.yaml`；**无** `tokens.json`）。
4. `GET /health`：`funasr_model_id` 含 `Fun-ASR-Nano`；`ready_for_transcribe` 为 true。
5. 记录 FunASR / torch 版本到 [results](./r3g-c-funasr-nano-spike-results.md)。

- [ ] Phase 0 完成

## Phase 1 — 样本对照（Paraformer vs Nano）

```bash
python3 scripts/r3g-c-funasr-nano-spike-run.py
# 长音频耗时高时可先：python3 scripts/r3g-c-funasr-nano-spike-run.py --skip-long
```

| ID | 样本 | 操作 |
|----|------|------|
| S1 | `fixtures/eval/samples/制控.mp3` ~21min | 各跑一遍 blocking transcribe，记语段数 / warnings / wall clock |
| S2 | `fixtures/eval/samples/clear.wav` ≤3min | 无窗路径回归 |
| S3 | 制控 + hotwords「制控」 | `term_hit_rate` vs Paraformer |

- [ ] S1–S3 完成；[results](./r3g-c-funasr-nano-spike-results.md) 已填

## Phase 2 — 打包探测

- [ ] bump `requirements-sidecar-*.lock`（若 funasr 版本升级）
- [ ] `npm run asr:build-sidecar-unix` → bundled `/health` with Nano env
- [ ] onedir 体积增量记录

## Phase 3 — 结论

- [ ] 在 [acceptance](./r3g-c-funasr-nano-acceptance.md) 填 N1–N8 实测值
- [ ] 勾选 **Go / Defer / No-go**

## 签收

| 日期 | 范围 | 结果 |
|------|------|------|
| | Phase 0–3 | |
