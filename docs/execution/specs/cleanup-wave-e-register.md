# 代码库清理 — Wave E 台账（knip export 二轮）

> **基线**：[`knip-wave-e-raw.txt`](./knip-wave-e-raw.txt)（Wave A–D 后，296 unused exports + 94 types）  
> **分析**：[`knip-wave-e-analysis.json`](./knip-wave-e-analysis.json)（rg 交叉：70 DELETE · 147 UNEXPORT · 110 外部引用 KEEP）  
> **配置**：[`apps/desktop/knip.json`](../../../apps/desktop/knip.json)

## 分类规则

| 动作 | 条件 |
|------|------|
| **DELETE** | 仓内零引用（含同文件） |
| **UNEXPORT** | 仅定义文件内使用 |
| **KEEP** | 有跨文件引用，或 `tauri/` / plugin 公共面 |
| **DEFER** | 样式 token / Stitch 预留 / 迁移层 |

## Wave E1（已执行）

| ID | 项 | 动作 |
|----|-----|------|
| CLN-E01 | `postprocessRuntimeContract` POSTPROCESS_* 别名 | DELETE |
| CLN-E02 | `LlmPolishReadiness` + llm barrel 死 re-export | DELETE |
| CLN-E03 | `glossaryPanelStyles` 废弃 table 视图 token | DELETE |
| CLN-E04 | `mergeLlmPolishLines` / `countHiddenSelectedTerms` / `summarizeHistoryDetail` | DELETE |
| CLN-E05 | `TRANSCRIBE_ASYNC_FALLBACK_HINT` deprecated | DELETE |
| CLN-E06 | `FLOATING_PANEL_SPINNER_BODY_PX` | DELETE |
| CLN-E07 | `SEGMENT_BAND_BORDER_SELECTED_COLOR` duplicate | DELETE |
| CLN-E08 | `CONTROL_BTN_ONLINE_STT` / `WORKSPACE_SIDEBAR_*` 死 token | DELETE |
| CLN-E09 | `UNSAVED_SEGMENTS_CONFIRM` / `describeLocalProtectedSecretStore` | DELETE |
| CLN-E10 | `workbenchLabelBtn` 等内部样式 const | UNEXPORT |
| CLN-E11 | `asrStatusRowActions` scroll/wizard helpers | UNEXPORT |
| CLN-E12 | `ProjectStatusFeedback` 死 re-export / 内部 banner | UNEXPORT |
| CLN-E13 | `PANEL_TEMPLATE_PRESETS` | UNEXPORT |

## Wave E2（已执行）

> **分析**：[`knip-wave-e2-analysis.json`](./knip-wave-e2-analysis.json)（46 DELETE · 143 UNEXPORT · 100 KEEP）  
> **结果**：knip unused exports **249→114**

| 批次 | 动作 | 范围 |
|------|------|------|
| E2-A | **UNEXPORT** 批量 | 73 文件 / 131 符号（跳过 `tauri/`、`plugin-system/`、`contracts/`） |
| E2-B | **DELETE** | 死函数/常量：`formatCorrectionRuleHintLabel`、`onboardingStepLabel`、`isSegmentFinalized`、`readTierScrollLayout`、`vocabularyNativeAdapterForProvider`、`LOCAL_SECRET_STORE_LABEL`、`SEGMENT_LIST_VIRTUAL_PIN_MAX_DISTANCE`、`segmentBoundsForPersist`、`resolveSegmentSelectionRange`、`computeAlignScrollPxForTimeSec`、`WAVEFORM_RULER_BAND_HEIGHT_PX` 等 |
| E2-C | **UNEXPORT** 手动 | `floatingPanelSegmentListLayout` Stage-B 布局常量；`LOCAL_ASR_RECOGNITION_LANGUAGE_STORAGE_KEY` |
| E2-D | **DEFER** | `tauri/*` 死 export — 下波 E3 登记 KEEP |

## 待续（DEFER / E3）

- **114** knip unused exports：`tauri/*` 类型面、plugin-system、`editorTranscriptAppearance` 字体 token、测试 shared export
- **样式模块**：`editorTranscriptAppearance.ts`、`floatingPanel*Layout.ts` 内布局常量（面板 fit 预留）
- **测试 export**：`*.test.shared.ts` / `testHelpers.ts` — 改 `export` 为文件内或 vitest `import type` 直引

## 验证

```bash
cd apps/desktop && npx knip
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```
