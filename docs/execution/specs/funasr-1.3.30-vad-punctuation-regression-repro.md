# FunASR 1.3.30 VAD 文本拼接导致标点对齐回归

> **状态**：本机消融已确认（2026-08-11）
> **关联薄片**：[`funasr-sidecar-dependency-upgrade-acceptance.md`](./funasr-sidecar-dependency-upgrade-acceptance.md)

## 结论

`funasr==1.3.30` 与 `1.4.1` 没有改变 D3 样本的 ASR 内容字符，但改变了 VAD 小段输入 CT-Transformer PUNC 的拼接方式，导致标点位置和 `sentence_info` 断句显著回归。这是上游 `AutoModel` 后处理层回归，不是 Paraformer 权重的识别准确率下降。

## 固定环境

- macOS arm64 / Python 3.12.4 / MPS
- `modelscope==1.38.1`
- 同一本地 Paraformer + FSMN-VAD + CT-Transformer PUNC 权重
- 同一 D3 音频与 gold，hotwords off
- Rushi 分窗、接口和 `segmentation.py` 不变

## 消融结果

| 变体 | 含标点 `cer_chars` | 忽略标点 `content_cer_chars` | 语段数 |
|------|-------------------------|--------------------------------------|--------|
| FunASR `1.3.16` | `0.211471` | `0.143343` | 186 |
| FunASR `1.3.30` 原版 | `0.320698` | `0.143343` | 186 |
| `1.3.30` + 整个 `AutoModel` 恢复 `1.3.16` | `0.211471` | `0.143343` | 186 |
| `1.3.30` + 仅恢复 PUNC 输入拼接 | `0.211471` | `0.143343` | 186 |
| FunASR `1.4.1` 原版 | `0.320698` | `0.143343` | 186 |

`1.3.16` / `1.3.30` / `1.4.1` 的归一化内容文本编辑距离为 **0**；差异全部来自标点与断句位置。

## 最小触发点

`1.3.16` 直接把合并结果送入标点模型：

```python
punc_res = self.inference(result["text"], model=self.punc_model, ...)
```

`1.3.30` 改为先重新拼接 VAD 小段：

```python
punc_input_text = _join_vad_texts(
    item.get("text", "") for item in restored_data
)
punc_res = self.inference(punc_input_text, model=self.punc_model, ...)
```

`_join_vad_texts()` 在相邻小段都以中文字符收尾/开头时删除边界分隔。这改变了 PUNC 分词与时间戳对齐。仅将该赋值恢复为 `copy.copy(result["text"])`，无需改权重、参数或 Rushi 代码，含标点 CER 即完全恢复。

## 期望行为

VAD 小段的边界处理不应改变 CT-Transformer 的标点语义或将标点插入词内。如需保留新的 surface-text / timestamp 对齐修复，应保持与旧 `result["text"]` 等价的 token boundary。

## 证据

完整 hypothesis 与指标在 `docs/execution/spike-output/funasr-sidecar-upgrade-2026-08/ablation-*.json`（gitignored）。本仓不引入产品侧 monkey patch；候选版本在上游修复或发布新版前仍为 No-go。
