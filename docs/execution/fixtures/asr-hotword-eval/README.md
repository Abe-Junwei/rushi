# ASR 热词 eval A/B（ASR-VOC-5）

> **真源**：[`fixtures/eval/eval_manifest.v1.json`](../../../../fixtures/eval/eval_manifest.v1.json) · [`scripts/eval-run.py`](../../../../scripts/eval-run.py) · Plan [`r3-asr-voc-landing-plan.md`](../../specs/r3-asr-voc-landing-plan.md) §5

## 目标

同一段音频、同一 SKU，对比 **hotwords 开/关** 时 `term_hit_rate` 与 `warnings`，为 L2 热词是否真生效提供可存档 baseline（不要求 off 命中率更高，仅要求 **可观测**）。

## 前置

1. 本机 ASR 侧车已启动（默认 `http://127.0.0.1:8741`）。
2. 样例音频存在：`fixtures/eval/samples/制控.mp3`（manifest 项 `proper-noun-zhikong`）。

## 推荐命令（仓库根）

一次跑出 on/off 两行 CSV（便于 spreadsheet 对比）：

```bash
npm run eval:run:hotwords-ab
```

或分别强制开/关热词：

```bash
npm run eval:run:hotwords-on
npm run eval:run:hotwords-off
```

等价于：

```bash
python3 scripts/eval-run.py --hotwords-ab --filter-id proper-noun-zhikong --format csv
python3 scripts/eval-run.py --hotwords-mode on --filter-id proper-noun-zhikong
python3 scripts/eval-run.py --hotwords-mode off --filter-id proper-noun-zhikong
```

## 记录表（手测 / 发版前）

| 变量 | 记录 |
|------|------|
| SKU | Paraformer 长音频 / SenseVoice（环境页所选） |
| hotwords | on / off |
| `term_hit_rate` | `proper-noun-zhikong` |
| `warnings` | 是否含 `hotwords_ignored_stub` 等 |
| `engine` | 响应 JSON 中的 engine 字段 |

## Manifest 字段

| 字段 | 含义 |
|------|------|
| `hotwords` | `hotwords-mode=manifest` 时 POST 的 `-F hotwords=` 串 |
| `hotwords_ab` | 可选；`on` / `off` 与 `--hotwords-ab` 配合，一条样例跑两次转写 |
| `expected_terms` | 专名子串命中列表，用于 `term_hit_rate` |

## CI

PR 仍跑默认 `python3 scripts/eval-run.py`（`hotwords-mode=manifest`）。热词 A/B **非** PR 硬门禁；可选 nightly（见 backlog **ACC-EVAL-1**）。
