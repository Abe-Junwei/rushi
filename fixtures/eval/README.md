# P4 中文禅修音频评测集（骨架）

计划书 P4 要求至少覆盖 **五类** 样本：清晰录音、远场、噪声、问答、术语密集。本目录提供 **清单格式** 与命名约定；大文件音频不强制入库，由维护者在本地或 CI 缓存中挂载。

## 清单

见同目录 `eval_manifest.v1.json`：`items[]` 中每条包含 `id`、`category`、`audio_relpath`（相对本目录）、可选 `reference_transcript`（参考全文，用于 CER 等指标）。

## 类别 `category` 取值

| 值 | 含义 |
|----|------|
| `clear` | 清晰近讲 |
| `far_field` | 远场 |
| `noisy` | 噪声环境 |
| `qa` | 问答/对话 |
| `term_dense` | 术语密集 |

## 生成占位短音频（可选）

仓库根执行（需 ffmpeg）：

```bash
bash scripts/eval-generate-placeholders.sh
```

会在 `fixtures/eval/samples/` 下生成 5 个极短 `.wav`，仅用于链路/脚本冒烟，**不代表**真实禅修声学分布。
