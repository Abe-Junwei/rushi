# Acceptance: F0 — 转写后编排（阶段 A → 阶段 B）

> **Plan**：[`f0-post-transcribe-orchestration-plan.md`](./f0-post-transcribe-orchestration-plan.md)  
> **调研**：[`post-transcribe-to-export-automation-research.md`](./post-transcribe-to-export-automation-research.md)  
> **状态**：✅ **F0-v1 / v1.5 / v2** 机器 + 手测签收（2026-06-05）  
> **套件追溯**：替代 [`r3t-f-post-transcribe-suite-acceptance.md`](./r3t-f-post-transcribe-suite-acceptance.md) §P2 F0-lite 旧定义

---

## 决策追溯

| ID | 验收时必须满足 |
|----|----------------|
| **顺序** | 阶段 A 与阶段 B **独立**；智能改稿仅工具栏手动触发，**不**在规则纠错后自动弹出 |
| **A 范围** | 仅确定性规则；无 LLM、无段界、无静默写库 |
| **B 范围** | 标点 + 错字（预览写回）；**不**恢复 R3t-C/D 独立菜单 |
| **真源** | A1 = `list_stable_correction_rules`（`hit≥3` 或 `accepted_as_rule`） |
| **热词** | A 写回 **不** 向 `glossary_terms` 写入 `before_text` 错形 |

---

## 能力—UI 状态矩阵

> 维度定义：[`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)（LLM 后处理用 **P1–P3**，非 ASR D1–D6）

| UI 控件 / 文案 | 状态维度 | 数据源 | 手测场景 |
|----------------|----------|--------|----------|
| 「规则纠错」入口 | 有语段 + 非 busy | `currentFileId`、`segments.length`、`busy` | 无语段时 disabled |
| 阶段 A 预览 | `rules_preview` / `rules_empty` | `correctionStableRulesList` + `buildSegmentCorrectionChanges` | 无匹配 → 可进入 B 或关闭，不空弹 |
| 阶段 A 确认 | `confirmed` 写回 | `saveSegments({ quiet, countHits: true })` | 取消后正文与转写结果一致 |
| 阶段 B 触发 | **P1** postprocess 配置就绪 | `resolve_postprocess_config`、keychain、`llm_has_stored_api_key` | 无 API key → 中文错误，**不**用 ASR health 冒充 |
| 阶段 B 预览 | `llm_preview` | `postprocess_auto_punctuate` / 统一 proofread | busy 时禁用确认 |
| 阶段 B 隐私 | **P2** 用户同意 | 现有 consent 对话框 | 拒绝则不请求云端 |

**矩阵手测（至少 2 组）**

1. **有 stable 规则 + 已配置 LLM**：转写完成 → A 预览 → 确认 → B 预览 → 确认；两段 diff 语义分离。  
2. **无规则 + 无 LLM key**：转写完成 → A 空态或跳过 → B 入口 disabled 或明确报错；**不得** 显示「侧车已就绪可改稿」类 ASR 文案。

---

## F0-v1 — 阶段 A 编排（合并入口）

- [x] A1 稳定规则字面替换 + 预览写回（= F1 / MEM-P2）— [`mem-p2-hand-test-checklist.md`](./mem-p2-hand-test-checklist.md) §3 ✅ 2026-06-04  
- [x] 转写 toast **仅** 汇报用时 / 语段数 / 字数（不含标点；无引擎、warnings、无规则纠错按钮）  
- [x] 工具栏 **「规则纠错」**（左侧第二位）打开阶段 A；对话框标题 **「规则纠错」**；`persistState` 记忆尺寸/位置  
- [x] 取消 A：语段与 L3 转写结果一致 — 手测 ✅ 2026-06-05  
- [x] 确认 A：仅 `update_text` 类字面替换；`countHits: true` 同回合保存 — 手测 ✅ 2026-06-05  
- [x] 无第二套「纠错规则」入口（仅工具栏 **规则纠错** 触发阶段 A） — 手测 ✅ 2026-06-05  
- [x] 手测 — [`f0-post-transcribe-hand-test-checklist.md`](./f0-post-transcribe-hand-test-checklist.md) §0–§4、§8 ✅ 2026-06-05

### F0-v1 自动化

- [x] `npm run typecheck && npm run test`（2026-06-05）  
- [x] `useCorrectionRulesController.test.ts` · `toast.test.ts`  
- [x] `node scripts/check-architecture-guard.mjs`（2026-06-05）

---

## F0-v1.5 — 阶段 A 增强（可选同轮）

- [x] **A3**：转写 warnings 中 `correction_rule_hint:*` 在 A 预览屏 **只读** 列出；与 A1 将改项 **不重复写回**  
- [x] **A4**：同 `before` 多 `after` 时 **阻塞**「确认写回」，须先在「热词与记忆」冲突决议  
- [x] 手测 — 手测清单 §5 ✅ 2026-06-05

### F0-v1.5 自动化

- [x] `correctionRuleHints.test.ts` · `stableCorrectionRuleConflicts.test.ts` · `useCorrectionRulesController` 冲突/hints 用例

---

## F0-v2 — 阶段 B（LLM 改稿）

- [x] 阶段 B **仅**工具栏「智能改稿」手动触发；关闭规则纠错后 **不**自动接续 B  
- [x] B 覆盖：**标点**（按语段串行 `postprocess_auto_punctuate`，全部有正文语段；refine 本机 ≤8 段/≤3k 字、云端 ≤16 段/≤5k 字自适应分批）  
- [x] B 覆盖：**错字**（v2 最小：`postprocess_refine_segments` 仅采纳 `update_text`，忽略 merge/split）  
- [x] 每语段预览 diff；确认后写回；可取消；可撤销（沿用编辑器 undo）  
- [x] **不** 写回段界 merge/split ops  
- [x] 隐私同意与 provider 错误中文文案（复用 `rushi:auto-punctuate-consent:v1` + `resolveAutoPunctuateBlockReason`）  
- [x] 手测 — 手测清单 §6–§7 ✅ 2026-06-05

### F0-v2 自动化

- [x] `usePostTranscribeOrchestrationController` + `postTranscribeStageB.test.ts`（filterTypoOnlyRefineOps）  
- [ ] Rust postprocess 相关 `cargo test` 仍绿（未改 Rust）

---

## 明确 N/A

- [ ] ~~R3t-C/D 独立工具栏~~ — 产品已移除；标点/错字 **仅** 在 F0 阶段 B 编排内  
- [ ] ~~F0 = 仅规则、无 LLM~~ — **已作废**（2026-06-05 用户确认主路径）

---

## 回归

- [ ] L2 hotwords 与 A1 独立；A 不写 hotwords  
- [ ] 导出时 `export_polish` 与 F0 阶段 B **分离**（避免同轮双 LLM 无感写回）  
- [ ] 增量转写 preview 段 **不** 触发 F0 B（R3e-C stable 门禁仍有效）

---

## 签收

| 阶段 | 机器 | 手测 | 日期 |
|------|------|------|------|
| F0-v1 | ✅ | ✅ | 2026-06-05 |
| F0-v1.5 | ✅ | ✅ | 2026-06-05 |
| F0-v2 | ✅ | ✅ | 2026-06-05 |
