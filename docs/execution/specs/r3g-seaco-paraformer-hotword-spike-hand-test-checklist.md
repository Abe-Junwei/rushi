# R3g-SeACo — SeACo-Paraformer 热词 Spike 手测清单

> **调研真源**：[r3g-seaco-paraformer-hotword-spike-research.md](./r3g-seaco-paraformer-hotword-spike-research.md)  
> **结果表**：[r3g-seaco-paraformer-hotword-spike-results.md](./r3g-seaco-paraformer-hotword-spike-results.md)（跑完后填）  
> **门禁**：**不得**改 `LOCAL_ASR_MODEL_CATALOG` / 用户下拉，直至 Go 签收

---

## 常量

| 项 | 值 |
|----|-----|
| **Baseline SKU** | `iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch` |
| **Spike SKU** | `iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch` |
| **主样本** | `fixtures/eval/samples/d3-tang32-zhikong-gaijiang.mp3`（manifest id: `d3-tang32-zhikong-gaijiang`） |
| **金标** | `fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt` |
| **热词（manifest）** | `制控,禅堂,觉观,经行` |
| **产物目录** | `docs/execution/spike-output/seaco-paraformer-YYYY-MM-DD/`（gitignore） |

**已知 baseline（2026-06-11 · D3 · Paraformer · 热词 on）**：`term_hit_rate=0.75`（漏「经行」），`cer_chars≈0.214`，`segment_count≈182`，`rtfx≈6.9`。

---

## Phase 0 — 环境

1. 侧车就绪（仓库根）：

```bash
curl -sf http://127.0.0.1:8741/health | python3 -m json.tool
# ready_for_transcribe: true
```

2. 若 8741 被桌面占用，用 dev 侧重启：

```bash
RUSHI_ASR_DEV_RESTART=1 npm run asr:dev
```

3. 创建产物目录：

```bash
OUT=docs/execution/spike-output/seaco-paraformer-$(date +%Y-%m-%d)
mkdir -p "$OUT"
echo "$OUT" > /tmp/rushi-seaco-spike-out.txt
```

- [ ] Phase 0 完成；记录 FunASR / torch 版本到 [results](./r3g-seaco-paraformer-hotword-spike-results.md)

---

## Phase 1 — Baseline 复现（Paraformer，可选）

> 若已有 2026-06-11 D3 报告可跳过；否则先跑一遍作同机对照。

```bash
export RUSHI_FUNASR_MODEL="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
RUSHI_ASR_DEV_RESTART=1 npm run asr:dev
curl -sf -X POST http://127.0.0.1:8741/v1/models/warmup --max-time 1800

OUT=$(cat /tmp/rushi-seaco-spike-out.txt)
python3 scripts/eval-run.py \
  --filter-id d3-tang32-zhikong-gaijiang \
  --hotwords-mode on \
  --assert-min-segments \
  --output "$OUT/baseline-paraformer-hotwords-on.json"

python3 scripts/eval-run.py \
  --filter-id d3-tang32-zhikong-gaijiang \
  --hotwords-ab \
  --format csv \
  --output "$OUT/baseline-paraformer-hotwords-ab.csv"
```

检查 JSON：

- [ ] `engine` 含 `paraformer-large-vad-punc`
- [ ] `term_hit_rate`、`cer_chars`、`segment_count`、`rtfx` 已写入
- [ ] `warnings` 无 `hotword_param_unsupported`

---

## Phase 2 — SeACo SKU 准备

```bash
export RUSHI_FUNASR_MODEL="iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
# VAD / punc 仍用侧车默认（fsmn-vad + ct-punc）；勿改 catalog
RUSHI_ASR_DEV_RESTART=1 npm run asr:dev
```

1. 健康检查：

```bash
curl -sf http://127.0.0.1:8741/health | python3 -m json.tool
# funasr_model_id 须含 seaco_paraformer
```

2. 模型 prepare（首次会下载权重）：

```bash
curl -sf -X POST http://127.0.0.1:8741/v1/models/prepare --max-time 3600 | python3 -m json.tool
curl -sf -X POST http://127.0.0.1:8741/v1/models/warmup --max-time 1800 | python3 -m json.tool
```

3. 短 smoke（可选，~5s）：

```bash
curl -sS -X POST -F "file=@fixtures/eval/samples/clear.wav" \
  -F "hotwords=测试" \
  http://127.0.0.1:8741/v1/transcribe | python3 -m json.tool
```

- [ ] prepare + warmup `status: ok`
- [ ] smoke 返回 `segments` 非空且无 `funasr_error`

---

## Phase 3 — D3 主对照（SeACo）

```bash
OUT=$(cat /tmp/rushi-seaco-spike-out.txt)

# 热词 on + 金标 CER + min_segments
python3 scripts/eval-run.py \
  --filter-id d3-tang32-zhikong-gaijiang \
  --hotwords-mode on \
  --assert-min-segments \
  --output "$OUT/seaco-hotwords-on.json"

# 热词 on/off A/B（ACC-EVAL-1 / ASR-VOC-5 同构）
python3 scripts/eval-run.py \
  --filter-id d3-tang32-zhikong-gaijiang \
  --hotwords-ab \
  --format csv \
  --output "$OUT/seaco-hotwords-ab.csv"
```

### 结果填写（写入 [results](./r3g-seaco-paraformer-hotword-spike-results.md) §3）

| 字段 | Baseline（Paraformer） | SeACo（本次） | G 门槛 |
|------|------------------------|---------------|--------|
| `term_hit_rate` | 0.75 | | ≥ baseline |
| `cer_chars` | ~0.214 | | ≤ baseline + 0.02 |
| `segment_count` | ~182 | | ≥ 50 |
| `segmentation_mode` | sentence_info | | sentence_info |
| `rtfx` | ~6.9 | | 记录 |
| `warnings` | | | 无 `hotword_param_unsupported` |

### 专名逐条（手工 grep 或脚本）

对 `hypothesis_concat` 检查子串命中：

```bash
python3 - <<'PY'
import json, sys
from pathlib import Path
out = Path("/tmp/rushi-seaco-spike-out.txt").read_text().strip()
row = json.loads(Path(out, "seaco-hotwords-on.json").read_text())["items"][0]
hyp = row.get("hypothesis_concat", "")
for t in ["制控", "禅堂", "觉观", "经行"]:
    print(t, "HIT" if t in hyp else "MISS")
PY
```

- [ ] 四个专名命中表已记入 results
- [ ] hotwords_ab：on 的 `term_hit_rate` **≥** off（或至少某一专名仅 on 命中）

---

## Phase 4 — 回归（可选 · legacy 制控）

manifest 项 `proper-noun-zhikong`（~21min legacy，optional）：

```bash
OUT=$(cat /tmp/rushi-seaco-spike-out.txt)
python3 scripts/eval-run.py \
  --filter-id proper-noun-zhikong \
  --hotwords-ab \
  --format csv \
  --output "$OUT/seaco-legacy-zhikong-ab.csv"
```

- [ ] 若音频存在：两行 CSV 可存档；**不阻塞** D3 结论

---

## Phase 5 — 契约回归

```bash
npm run asr:test -- -q \
  tests/test_eval_manifest.py \
  tests/test_eval_metrics.py
```

- [ ] 测试通过（spike **不应**改 eval 契约；若失败则先修环境）

---

## Phase 6 — 结论

在 [results](./r3g-seaco-paraformer-hotword-spike-results.md) 勾选：

- [ ] **Go** — G1–G5 过且 term_hit 严格优于 baseline  
- [ ] **Defer** — 热词略优但 RTFx/prepare 成本过高  
- [ ] **No-go** — term_hit 不优或 CER 超阈或链路失败  

后续（仅 Go 后另立项，**不在本 spike 做**）：

- `asr_model_profile` 是否需 `seaco` 子族 / ASF 参数  
- catalog 第二 SKU「专名增强」文案  
- 与 R3s-A Sherpa 默认的 **双轨回退** 策略

---

## 签收

| 日期 | 执行人 | Phase 0–6 | 结论 |
|------|--------|-----------|------|
| | | | Go / Defer / No-go |
