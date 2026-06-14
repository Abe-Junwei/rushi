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

## Wave E1（本波已执行）

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

## 待续（DEFER / 下波）

- **~200** knip unused exports：多为 utils 常量、`tauri/*` 类型面、plugin-system 公共 API
- **94** unused exported types：`projectApi` / `postprocessApi` 契约类型（外部/脚本可能消费）
- **样式模块**：`editorTranscriptAppearance.ts`、`floatingPanel*Layout.ts` 内布局常量（面板 fit 预留）
- **测试 export**：`*.test.shared.ts` / `testHelpers.ts` — 改 `export` 为文件内或 vitest `import type` 直引

## 验证

```bash
cd apps/desktop && npx knip
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```
