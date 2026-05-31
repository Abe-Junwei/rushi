# Acceptance: R3g-C — FunASR Generate Profile

> **状态**：✅（2026-05-31 手测签收）；清单 [`r3g-c-hand-test-checklist.md`](./r3g-c-hand-test-checklist.md)  
> **调研**：[`r3g-c-asr-generate-profile-research.md`](./r3g-c-asr-generate-profile-research.md)  
> **架构真源**：[`asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md)  
> **路线图**：§4.1.1 **⑤g**

## 产品决策（已拍板）

| 子片 | 约束 |
|------|------|
| **C4 SKU 文案** | Paraformer：**保留**「推荐转写」；SenseVoice：**不加「推荐」** |
| **C4 识别语言** | 默认 `zh`；v1 至少 `zh` + `auto`（实现含 en/ja/ko/yue） |
| **不做** | FunASR 全参数 UI；SenseVoice 从 catalog 删除；`GENERATE_OVERRIDES` JSON |

## 能力—UI 状态矩阵（R3-STATE）

| UI 控件 / 文案 | 维度 | 数据源 | 状态 |
|----------------|------|--------|------|
| 识别语言下拉 | D1 用户所选 | `useLocalAsrModelCatalog.recognitionLanguage` | ✅ |
| 侧车「识别语言 …」行 | D2 运行 | `/health.funasr_language` | ✅ |
| 语言 mismatch 横幅 | D1≠D2 | `sidecarRecognitionLanguageMatchesSelection` | ✅ |
| 「应用并重启侧车」 | D1→D2 | `applyHubModelToSidecar` 轮询 hub + language | ✅ |
| 模型 SKU「推荐转写」 | 文案 | 仅 Paraformer label | ✅ |
| 转写 warnings | 侧车 | `funasr_language_fallback`、剥参 warnings | ✅ |

维度定义：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)。

## 子片验收

### C1 — Profile 内核

- [x] `asr_model_profile.py`：`AsrModelProfile`、`resolve_asr_model_profile`、`build_generate_kwargs`
- [x] `segmentation.funasr_generate_kwargs` 委托 Profile（无第二套 kwargs）
- [x] `tests/test_asr_model_profile.py`：Paraformer 长音频 / SenseVoice ITN 快照

### C2 — SenseVoice ITN

- [x] 默认 `use_itn=True` + `rich_transcription_postprocess=True`
- [x] `RUSHI_FUNASR_USE_ITN=0` 可排障关闭

### C3 — 剥参与 warnings

- [x] `funasr_engine._run_generate` strip_order 与 warning 码
- [x] 单测：`tests/test_funasr_engine.py`

### C4 — 识别语言 UI + pref

- [x] `LocalAsrModelSection` 识别语言下拉
- [x] Tauri `get/set_local_asr_recognition_language_pref`
- [x] bundled spawn / `run-asr-dev.sh` 注入 `RUSHI_FUNASR_LANGUAGE`
- [x] `/health.funasr_language`

### ACC-EVAL-1（合入门禁）

- [x] `fixtures/eval/eval_manifest.v1.json` 条目 `proper-noun-zhikong`（`制控.mp3` + `expected_terms`）
- [ ] 发版前：`npm run eval:run` 对 **Paraformer + hotwords=制控** 输出 `term_hit_rate`（需本机侧车 + 样例音频）

## 自动化

```bash
cd services/asr && python3 -m pytest tests/test_asr_model_profile.py tests/test_funasr_engine.py -q
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml local_asr_language
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

## 手测

- [x] [`r3g-c-hand-test-checklist.md`](./r3g-c-hand-test-checklist.md)（2026-05-31 用户签收）

## 关联

- [`r3g-local-asr-model-catalog-acceptance.md`](./r3g-local-asr-model-catalog-acceptance.md)（R3g-A SKU 表）
- [`r3-asr-landscape-2026-05-improvement-backlog.md`](./r3-asr-landscape-2026-05-improvement-backlog.md) §3.3 SenseVoice 弃用跟踪
