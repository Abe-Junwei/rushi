# P4 中文禅修音频评测集（骨架）

计划书 P4 要求至少覆盖 **五类** 样本：清晰录音、远场、噪声、问答、术语密集。本目录提供 **清单格式** 与命名约定；大文件音频不强制入库，由维护者在本地或 CI 缓存中挂载。

## 清单

见同目录 `eval_manifest.v1.json`：`items[]` 中每条包含 `id`、`category`、`audio_relpath`（相对本目录）、可选 `reference_transcript`（参考全文，用于 CER 等指标）。

可选字段（ACC-EVAL-2）：

| 字段 | 说明 |
|------|------|
| `min_segments` | 长音频最少语段数；配合 `npm run eval:run -- --assert-min-segments` 本地断言 |
| `notes` | 维护者备注（不参与脚本逻辑） |

## 类别 `category` 取值

| 值 | 含义 |
|----|------|
| `clear` | 清晰近讲 |
| `far_field` | 远场 |
| `noisy` | 噪声环境 |
| `qa` | 问答/对话 |
| `term_dense` | 术语密集 |
| `long_form` | 长音频轨（≥13min 口述；ACC-EVAL-2） |

## 批跑与指标

仓库根：

```bash
npm run eval:run                    # 全 manifest（CI 占位 wav）
npm run eval:run:long-form          # 制控长样本 + min_segments 断言
npm run eval:run:hotwords-ab        # 热词 on/off CSV（ACC-EVAL-1）
```

`scripts/eval-run.py` 输出（除 ACC-EVAL-1 外）：

| 字段 | 含义 |
|------|------|
| `segment_count` | 语段条数 |
| `duration_sec` | 侧车报告的音频时长 |
| `wall_sec` | 客户端 transcribe 墙钟 |
| `rtfx` | `duration_sec / wall_sec`（ASR Leaderboard 同义 RTFx） |
| `segmentation_mode` | R3t-A 分段模式（如 `sentence_info`） |

## 生成占位短音频（可选）

仓库根执行（需 ffmpeg）：

```bash
bash scripts/eval-generate-placeholders.sh
```

会在 `fixtures/eval/samples/` 下生成 5 个极短 `.wav`，仅用于链路/脚本冒烟，**不代表**真实禅修声学分布。
