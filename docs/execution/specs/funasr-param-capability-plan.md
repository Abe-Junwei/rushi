# 计划：FunASR generate 参数能力治理

> **Research brief**：[`funasr-param-capability-research.md`](./funasr-param-capability-research.md)  
> **Acceptance**：[`funasr-param-capability-acceptance.md`](./funasr-param-capability-acceptance.md)

## 目标

把 `generate()` 参数真源前移到 `AsrModelProfile`，调用 FunASR 前先按 profile 白名单裁剪并记录 warning；保留 `_run_generate()` 的 TypeError strip 作为兼容兜底。

## 落位

| 层 | 文件 | 改动 |
|----|------|------|
| Python ASR | `services/asr/rushi_asr/asr_model_profile.py` | 增加 profile 参数白名单与裁剪函数 |
| Python ASR | `services/asr/rushi_asr/funasr_engine.py` | 调用前裁剪 kwargs，保留 fallback strip |
| 测试 | `services/asr/tests/test_asr_model_profile.py` / `test_funasr_engine.py` | 覆盖白名单、warning、fallback |
| 文档 | `docs/architecture/asr-generate-params-truth.md` | 更新 v2 行为 |

## 验证

```bash
npm run asr:test -- tests/test_asr_model_profile.py tests/test_funasr_engine.py
npm run typecheck
node scripts/check-architecture-guard.mjs
```
