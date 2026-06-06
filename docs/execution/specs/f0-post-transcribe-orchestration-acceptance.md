# Acceptance: F0 — 转写后编排（阶段 A → 阶段 B）

> **Plan**：[`f0-post-transcribe-orchestration-plan.md`](./f0-post-transcribe-orchestration-plan.md)  
> **调研**：[`post-transcribe-to-export-automation-research.md`](./post-transcribe-to-export-automation-research.md)  
> **状态**：✅ **F0-v1 / v1.5 / v2 / v2.1 / v2.2** 机器 + 手测签收（v2.2 · 2026-06-06）
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
| 阶段 B 触发 | **P1** postprocess 配置就绪 | `readStageBLlmGateSnapshot`、`resolveStageBBlockReason`、keychain | 未就绪 → **warning toast** 中文原因，**不**弹 blocked 对话框；**不**用 ASR health 冒充 |
| 阶段 B 预览 | `llm_preview` | `postprocess_stage_b_proofread` 合并 Pack 校对 | busy / 转写中禁用入口；loading 中遮罩误触不取消；**×** 等同取消 |
| 阶段 B 预览布局 | 浮窗缩放 | `FloatingPanelDialogLayout` + `fillAvailable` 列表 | 拖矮面板时底部 **取消/确认** 仍可见 |
| 阶段 B 云端 HTTP | **P1** 与探测一致 | `send_postprocess_chat_request`（代理失败直连重试） | 探测成功后 **无需**再刷新即可改稿 |
| 阶段 B 隐私 | **P2** 用户同意 | 现有 consent 对话框 | 拒绝则不请求云端 |

**矩阵手测（至少 2 组）**

1. **有 stable 规则 + 已配置 LLM**：转写完成 → A 预览 → 确认 → B 预览 → 确认；两段 diff 语义分离。  
2. **无规则 + 无 LLM key**：转写完成 → A 空态或跳过 → 点 **智能改稿** → **warning toast** 中文原因、**不**弹对话框；**不得** 显示「侧车已就绪可改稿」类 ASR 文案。

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
- [x] B 覆盖：**Pack 合并校对**（`postprocess_stage_b_proofread`：标点 + 词表有据改字，一次 LLM/批；本机 ≤8 段/≤3k 字、云端 ≤16 段/≤5k 字自适应分批）
- [x] 预览展示 **依据** 列；Rust 语段级 evidence 校验；无依据 op 丢弃
- [x] 每语段预览 diff；确认后写回（**uid** 优先定位）；可取消；可撤销（沿用编辑器 undo）
- [x] **不** 写回段界 merge/split ops
- [x] 隐私同意与 provider 错误中文文案（`rushi:auto-punctuate-consent:v1` + `resolveStageBBlockReason`）；未就绪时 **toast** 而非 blocked 对话框
- [x] 手测 — 手测清单 §6–§7 ✅ 2026-06-05

### F0-v2 自动化

- [x] `postTranscribeStageB.test.ts` · `usePostTranscribeStageBController.test.ts`
- [x] Rust `cargo test postprocess_lexicon`（2026-06）

---

## F0-v2.1 — 阶段 B · Pack 合并校对

- [x] 一次 LLM 调用合并标点 + LexiconPack 有据改字（替代 v2 双阶段串行）
- [x] 预览 **依据** 列；`classifyStageBSegmentChangeFlags` 与 diff 对齐
- [x] Ollama JSON 容错（漏 `op` / 截断 salvage）；`finish_reason=length` warnings
- [x] Pack 规则截断提示；loading `beginBusy("stage_b")`；写回 uid 定位
- [x] LLM 未就绪 → **warning toast**（非 blocked 对话框）
- [x] 云端改稿 HTTP 与设置页探测对齐（`send_postprocess_chat_request` 代理失败直连重试）；门禁 `ensureStageBLlmActionReady` + `llmEnvRevision`
- [x] 浮窗缩放时底部按钮固定可见（`FloatingPanelDialogLayout`）；loading 进度 **模型 · 批次** 单行
- [x] 手测 — 手测清单 §7.1（含 §7.1.7）✅ 2026-06-06

### F0-v2.1 自动化

- [x] `postTranscribeStageB.test.ts` · `usePostTranscribeStageBController.test.ts`
- [x] `cargo test postprocess_lexicon`（11 passed）

---

## F0-v2.2 — 阶段 A · A6 文本清洗 + A9 词表卫生

- [x] **A6**：NFKC、**半角标点→全角**、全角英数→半角、连续空白、重复标点压缩；在 A1 规则匹配 **之前** 虚拟清洗；预览写回合并 diff
- [x] **A9**：规则纠错对话框只读「词表卫生」面板（hit=1 噪声、悬空规则、冲突摘要；F8 前移）
- [x] 自动化：`segmentTextHygiene.test.ts` · `stageAPreviewPipeline.test.ts` · `lexiconHealthReport.test.ts`

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
| F0-v2.1 | ✅ | ✅ | 2026-06-06 |
| F0-v2.2 | ✅ | ✅ | 2026-06-06 |
