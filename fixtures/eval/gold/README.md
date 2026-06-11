# Eval 金标参照（reference）

| 文件 | 音频 | 来源 |
|------|------|------|
| `d3-tang32-zhikong-gaijiang.reference.txt` | `samples/d3-tang32-zhikong-gaijiang.mp3` | `~/Documents/转录/D3-堂3-2制控概讲（含禪堂开示）-5月2日（法砆法师).docx` |

文本自 docx 导出后 **去除全部空白**（与 `eval_metrics.normalize_cer_text` 一致），供 `cer_chars` 对照。

重新生成：

```bash
python3 scripts/eval-extract-docx-reference.py \
  --docx "$HOME/Documents/转录/D3-堂3-2制控概讲（含禪堂开示）-5月2日（法砆法师).docx" \
  --output fixtures/eval/gold/d3-tang32-zhikong-gaijiang.reference.txt
```
