# ASR-VOC-3 — 手测清单（在线术语排序 / 截断）

> **验收真源**：[r3-asr-voc-landing-acceptance.md](./r3-asr-voc-landing-acceptance.md) § ASR-VOC-3  
> **Plan**：[r3-asr-voc-landing-plan.md](./r3-asr-voc-landing-plan.md) §4  
> **ACC 在线共用**：[acc-stt-unify-hand-test-checklist.md](./acc-stt-unify-hand-test-checklist.md)

## 前置（机器）

```bash
bash scripts/asr-voc-3-hand-test.sh
```

## 1. 环境页映射（V3-4）

1. 打开 **环境与 ASR → 在线 STT**，启用在线 STT。  
2. 依次选择 **OpenAI / AssemblyAI / Deepgram / 百炼 Fun-ASR**。  
3. 对每个支持术语的厂商确认：
   - 选中 chip 后，**描述段落下方** 角标行含 **术语偏置**。
   - 面板 **底部 info 区** 第二段 meta 含 `术语表 → …` 映射摘要（`EnvOnlineSttPanel` + `glossaryBiasSummaryForProviderId`）。
   - AssemblyAI 文案区分 keyterms ≠ custom_spelling。

- [x] §1 通过（2026-06-02：环境页三家映射文案手测；2026-06-11 自检：百炼角标 + 底部 info 与代码一致）

## 2. OpenAI 截断 + hints（V3-1 / V3-5）

> 需 OpenAI API Key；无 Key 时 **豁免**（机器单测 + §1 文案已签收）。

1. 术语库导入或批量添加 **100+** 条短专名（或单条超长别名串），均 **纳入热词**。  
2. 环境页选 OpenAI，对本机短音频 **从 ASR 拉取转写**。  
3. 转写提示条应含 **224 字截断** 类说明，并提到 **最近更新的词条优先**。  
4. （可选）在日志/调试中确认 `warnings` 含 `online_vocabulary_truncated_openai_prompt`。

- [x] §2 豁免（2026-06-02：无 API Key；`stt_vocabulary` / `asrTranscribeHints` 单测覆盖）

## 3. 在线 unsupported / 支持厂商（ACC 闸门）

1. **OpenAI**（或 AssemblyAI / Deepgram 任一）：拉取转写 → **无** `online_vocabulary_unsupported`。  
2. **不支持厂商**（如腾讯云）：拉取 → hints 含「不支持术语偏置」。

- [x] §3 支持厂商 E2E 豁免（无 API Key；契约见 `stt_vocabulary` + ACC Vitest）
- [x] §3 不支持厂商文案（§1 已核对环境页说明；`deriveTranscribeHints` 单测 `online_vocabulary_unsupported`）

## 签收

| 日期 | 范围 | 结果 |
|------|------|------|
| 2026-06-02 | §1 文案 | ✅ |
| 2026-06-02 | §2–§3 在线 E2E | 豁免（无 API Key；机器回归 ✅） |
