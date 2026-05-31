# R3g-C 手测清单 — Generate Profile + 识别语言

> **状态**：✅ 手测签收（2026-05-31）  
> **前置**：R3g-A 模型目录已可用；侧车为当前 bundled 构建（含 `/health.funasr_language`）。

## 环境

- [x] `npm run desktop:dev` 或已安装包
- [x] 环境页 → 本机 ASR →「转写模型」区可见 **识别语言** 下拉

## C4 — 识别语言

1. [x] 默认显示 **中文**；侧车 footer 显示 `识别语言 中文`（或与所选一致）
2. [x] 选 **自动检测** →「应用并重启侧车」→ `/health` 中 `funasr_language` 为 `auto`
3. [x] 切换语言但未应用时，出现 **语言 mismatch** 横幅（修复 `parseAsrHealthJson` 后通过）

## C2 — SenseVoice ITN（可选，需 dev 侧车日志）

1. [x] 选 SenseVoice，转写短样本；响应 `warnings` 无 `funasr_use_itn_unsupported`（新 FunASR）
2. [ ] （排障）`RUSHI_FUNASR_USE_ITN=0` 重启侧车 → 长音频 SenseVoice kwargs 无 ITN（见 pytest）

## C1/C3 — Paraformer 长音频

1. [x] 选 **Paraformer 长音频（推荐转写）** + 中文 → 应用侧车
2. [x] 对 ≥3min 样本转写 → 多语段；`warnings` 无持续 `funasr_generate_typeerror` 刷屏

## SKU 文案

- [x] 下拉中 Paraformer 含「推荐转写」；SenseVoice **不含**「推荐」

## ACC-EVAL-1（可选）

```bash
# 侧车已起，Paraformer 已缓存
export RUSHI_FUNASR_MODEL="iic/speech_paraformer-large-vad-punc_asr_nat-zh-cn-16k-common-vocab8404-pytorch"
npm run eval:run
```

- [ ] `proper-noun-zhikong` 项含 `term_hit_rate`（样例音频存在时；非手测阻塞）

## 签收记录

| 日期 | 结果 | 备注 |
|------|------|------|
| 2026-05-31 | ✅ 通过 | C4 含语言 mismatch；Paraformer 长音频多段；SenseVoice 长音频 0 语段为预期 |
