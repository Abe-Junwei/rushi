# Spec(acceptance): R3g-C — Fun-ASR-Nano-2512 SKU Spike

> **状态**：🟡 待 spike 完成后签收  
> **调研**：[`r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md`](./r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md)  
> **Intent**：[`r3g-c-funasr-nano-intent.md`](./r3g-c-funasr-nano-intent.md)  
> **Plan**：[`r3g-c-funasr-nano-plan.md`](./r3g-c-funasr-nano-plan.md)

---

## 结论

| 结果 | 条件 |
|------|------|
| **Go** | 以下硬闸门全部满足 |
| **Defer** | N1–N4、N7 满足，但 N5/N6/N8 任一项未满足且可在后续解决 |
| **No-go** | N1/N2/N4 任一项未满足，或 N3 不支持时间轴/语段 |

## 硬闸门（必须全部满足才 Go）

| # | 指标 | Paraformer 基准 | Fun-ASR-Nano 要求 | 实测值 | 结果 |
|---|------|-----------------|-------------------|--------|------|
| N1 | 长音频语段数（制控 ~21min） | 197 | **≥ 10**，且无 `funasr_whole_track_fallback` | | |
| N2 | 相对 baseline | 197 | **≥ max(15, 90%×baseline)** 或书面降级 | | |
| N3 | `segmentation_mode` | `sentence_info` | `sentence_info` / `timestamp` | | |
| N4 | 热词 `term_hit_rate`（制控） | baseline | **≥ baseline** | | |
| N5 | wall clock（制控 ~21min） | ~168s | **≤ 2.0×** Go；**≤ 3.0×** Defer | | |
| N6 | 磁盘增量（recognizer 相关） | — | **≤ 2GB** | | |
| N7 | prepare / health | ✅ | `/health` ready；prepare 完成即可转写 | | |
| N8 | PyInstaller 打包 | ✅ | bundled `/health` import 不 500 | | |

> 实测值在 spike 执行后由执行人填写；未填写前不得宣称 Go/Defer/No-go。

## 产品决策（编码前确认）

| 子片 | 决策 |
|------|------|
| **默认位** | Nano **不替换** Paraformer 默认；仅作为新增 SKU |
| **文案** | 暂定为「Fun-ASR-Nano（端到端）」；最终由产品签收 |
| **推荐转写** | 若 N1/N2 明显优于 Paraformer 可讨论加「推荐」；否则不加 |
| **语言** | v1 至少支持 `zh`；`auto` 行为需实测 |
| **热词** | 复用现有 `hotword=` 参数；若 Nano 不支持需降级 |
| **标点** | 依赖 Nano 内置标点；不再外挂 ct-punc |

## 能力—UI 状态矩阵（R3-STATE）

维度定义：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)。

| UI 控件 / 文案 | 维度 | 数据源 | 预期状态 |
|----------------|------|--------|----------|
| 模型选择下拉中的 Nano 项 | D1 用户所选 | `LOCAL_ASR_MODEL_CATALOG` + localStorage | 可选中 |
| 侧车「模型」行显示 Nano hub id | D2 运行 | `/health.funasr_model_id` | 选中 Nano 并重启后一致 |
| 未下载时进度条 | D4 缓存进度 | `prepare-status` SSE / poll | 显示下载进度 |
| 就绪后可转写 | D1+D2+D4 对齐 | `computeLocalAsrTranscribeReady` | ready=true |
| 识别语言下拉 `zh` | D1 | `useLocalAsrModelCatalog.recognitionLanguage` | 可选中 |
| 语言 mismatch 横幅 | D1≠D2 | `sidecarRecognitionLanguageMatchesSelection` | 切换后提示重启 |
| 转写 warnings | 侧车 | `funasr_*_unsupported` 等 | 不暴露未支持参数 |

### 必须手测的矛盾场景

1. **D1≠D2**：用户选择 Nano 但未点「应用并重启」时，侧车仍跑 Paraformer；界面不得显示 Nano 已就绪。
2. **D4 未完成**：Nano 权重未下载完时，`readyForTranscribe=false`，开始转写按钮应禁用或提示下载。
3. **D1 切换回 Paraformer**：切换后重启侧车，确认 Paraformer 链路无回归。

## 自动化测试

### Python

- `services/asr/tests/test_asr_model_profile.py`
  - Nano profile 解析：`profile_id`、`sku_family="funasr_nano"`
  - `build_generate_kwargs()`：长音频参数、`language="中文"`、热词传递
- `services/asr/tests/test_funasr_engine.py`
  - Nano 不触发 punc prepare
  - 剥参顺序（若 Nano 不支持某些参数，警告正确）
- `services/asr/tests/test_model_catalog.py`（若存在）
  - Nano 条目存在且 `ready_for_transcribe` 状态正确

### TypeScript

- `apps/desktop/src/services/asr/localAsrModelCatalog.test.ts`（若存在）
  - `hubModelNeedsPuncPrepare("FunAudioLLM/Fun-ASR-Nano-2512") === false`
  - catalog 条目解析正确

### 机器守卫

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

## 手测清单

建议单独产出 [`r3g-c-funasr-nano-hand-test-checklist.md`](./r3g-c-funasr-nano-hand-test-checklist.md)。核心条目：

| ID | 场景 | 通过标准 |
|----|------|----------|
| H-NANO-1 | 源码侧车 env-only 加载 Nano | `GET /health` 200，`funasr_model_id` 正确 |
| H-NANO-2 | 短音频 ≤3min transcribe | 段结构正常，有文本 |
| H-NANO-3 | 长音频 ~21min 多语段 | 语段数 ≥ 10，无 whole_track_fallback |
| H-NANO-4 | 热词「制控」命中 | 结果中出现「制控」或 term_hit 不下降 |
| H-NANO-5 | bundled 侧车 `/health` | PyInstaller 包启动后 200，无 500 |
| H-NANO-6 | 模型面板切换 Nano → Paraformer | 两侧车都正常，无状态错位 |
| H-NANO-7 | 语言切换 `zh` → `auto` | 侧车接收正确语言参数，无 fallback |

## 回归范围

- Paraformer 默认路径：短/长音频、热词、标点、prepare
- SenseVoice 路径（若仍保留）
- 模型切换流程：环境页 LocalAsrSetupWizard
- async transcribe job API（R3e-C）

## 结论签收

| 日期 | 执行人 | 结论 | 理由 |
|------|--------|------|------|
| | | Go / Defer / No-go | |

## 关联文档

- [`r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md`](./r3g-c-funasr-nano-mimo-v2-5-asr-feasibility-research.md)
- [`r3g-local-asr-model-catalog-acceptance.md`](./r3g-local-asr-model-catalog-acceptance.md)
- [`r3g-c-asr-generate-profile-acceptance.md`](./r3g-c-asr-generate-profile-acceptance.md)
- [`asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md)
