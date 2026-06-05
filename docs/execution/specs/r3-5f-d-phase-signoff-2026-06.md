# ⑤″f-D 签收追踪（ASR-VOC-3）

> **签收**：✅ 2026-06-04（薄片已在 2026-06-02 编码+文案签收；本文件对齐路线图 **⑤″f-D** 命名）  
> **VOC-3 真源**：[asr-voc-3-signoff-2026-06.md](./asr-voc-3-signoff-2026-06.md) · [asr-voc-3-hand-test-checklist.md](./asr-voc-3-hand-test-checklist.md)

| 子项 | 编码 | 手测 | 备注 |
|------|------|------|------|
| V3-1 OpenAI prompt 排序+224 截断 | ✅ | §2 豁免 | 无 API Key；`stt_vocabulary` 单测 |
| V3-2 AssemblyAI keyterms ≤100 | ✅ | §1 ✅ | 环境页映射文案 |
| V3-3 Deepgram keywords ≤50 | ✅ | 同上 | Nova-3 keyterm **Defer** |
| V3-4 环境页三家映射说明 | ✅ | §1 ✅ | `EnvOnlineSttPanel` |
| V3-5 hints 分型文案 | ✅ | 机器 | `asrTranscribeHints` |

## 闭合条件

```text
ASR-VOC-3 编码 + 机器回归 ✅（2026-06-02）
§1 环境页文案手测 ✅
§2–§3 在线 E2E 豁免（无 OpenAI/AssemblyAI/Deepgram Key）
→ ⑤″f-D ✅ → MEM-P2 ✅ → 下一刀 R3h-0（F7 §B 双机仍 ⏸）
```

## 机器闸门

```bash
bash scripts/r3-5f-d-machine-gate.sh
```

| 日期 | 结果 |
|------|------|
| 2026-06-04 | ✅（复验 `asr-voc-3-hand-test.sh`） |

## 有 Key 后的可选回归（不挡主序）

1. 术语库 100+ 条纳入热词 → OpenAI 拉取 → hints 含 224 截断 +「最近更新优先」。  
2. 任一支持厂商拉取无 `online_vocabulary_unsupported`；不支持厂商（如腾讯云）仍有说明。

## 日志

```text
改动：无（复用 2026-06-02 VOC-3 交付）
验证：bash scripts/r3-5f-d-machine-gate.sh ✅
下一轮：R3h-0；有第二台机器时补 F7 §B → ⑤″f-C 签收
```
