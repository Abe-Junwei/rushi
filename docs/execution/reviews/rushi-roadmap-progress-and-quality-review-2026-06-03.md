# Rushi 路线图进度核查与代码质量审查报告

> 审查日期：2026-06-03  
> 审查人：Kimi Code CLI  
> 真源对照：`docs/execution/plans/rushi-execution-roadmap.md`（2026-06-03 修订版）  
> 测试基线：`npm run test`（TS 744 passed / 3 failed）、`cargo test`（Rust 242 passed / 1 failed）

---

## 一、路线图进度完成度矩阵

### 1.1 个人单机 v1 路径（§3.1 / §4.1.1）

| 阶段 | 子项 | 路线图状态 | 代码状态 | 测试状态 | 评估 |
|------|------|-----------|---------|---------|------|
| **R0 / GLY-1 / R1 / R2** | 工程收口、术语 UI、LLM 标点 | ✅ | 已合入 `main` | ✅ 全绿 | **已完成** |
| **R3a–c** | keychain、profile、缓存/manifest | ✅ | 已合入 `main` | ✅ 全绿 | **已完成** |
| **R3h-0** | 构建 smoke + Win 磁盘 | 🟡 | 工作区部分实现 | — | **阻塞 R3f 手测** |
| **R3h-1** | LRC manifest + 安装回滚 | 🟡 编码✅ | `local_runtime/` 47 个 .rs 文件 | ✅ `cargo test` 通过 | **编码完成，发行门禁 §11 未全绿** |
| **R3f** | 一键准备向导 | 🟡 | `asr_setup/` + `LocalAsrSetupWizard` | — | **编码✅，手测依赖 R3h-0** |
| **R3e-A** | 长音频动态超时 | ✅ | 已合入 | ✅ | **已完成** |
| **R3e-B** | 5min 窗分片 | ✅ | `transcribe_windows.py` | ✅ | **已完成** |
| **R3e-C** | 增量 preview + cancel | ✅ | `useTranscribeJobController.ts` | ✅ 单测通过 | **已完成** |
| **R3g-A** | 双 SKU 模型目录 | ✅ | `useLocalAsrModelCatalog.ts` | ✅ | **已完成** |
| **HOT-UX** | 热词 12k 截断 | ✅ | `transcribeVocabularyPreflight.ts` | ✅ | **已完成** |
| **R3g-C** | FunASR Profile | ✅ | `asr_model_profile.py` | ✅ | **已完成** |
| **ACC-STT-UNIFY** | 术语表本机+在线统一 | ✅ | `sttVocabularyBias.ts` | ✅ 本机 | **已完成（在线 E2E ⏳）** |
| **R3t-A** | 声学分段 | ✅ | `segmentation.py` | ✅ | **已完成** |
| **R3t-B** | 转写编排 | ✅ | `transcribe.rs` | ✅ | **已完成** |
| **R3t-C** | 扩展标点 | ✅ | `postprocess_auto_punctuate` | ✅ | **已完成** |
| **R3t-D** | 段界整理 | ✅ | `postprocess_segment_ops.rs` | ✅ | **已完成** |
| **R3t-E** | LexiconPack 有据校对 | 🟡 编码✅ | `useLexiconProofreadController.ts` | — | **编码完成，手测⏳** |
| **⑤″f** | ASR-VOC + MEM + F2/F1/F6/F7 | 🟡 部分 | `cursor/r3t-f-find-replace-toast-correct` 分支 | — | **F2/F6+/GUARD/VOC-2c/d ✅；F1/F7/MEM-P0–P2 📋** |
| **⑤″f-E** | Qwen3 SKU 门控 | ❌ No-go | spike 结果已记录 | — | **已决策不做** |
| **⑤‴ EXP-WORD** | 交付 Word 导出 | 🟡 编码中 | `export_docx.rs` + `exportDocxPolish.ts` | ❌ **3 TS + 1 Rust 失败** | **编码中，有回归缺陷** |
| **⑤‴½ REV-LOC** | 撤销对齐 + 历史恢复 | ✅ | 切片 A/B | ✅ 2026-06-03 | **验收签收；主序 → R4** |
| **R3h-2** | 断点续传 + 自动回滚 | ⏳ | 未编码 | — | **规划中** |
| **ASR-WARM** | 侧车保活 | 📋 | 未编码 | — | **规划中** |
| **R3h-3** | 三盏灯就绪页 | ⏳ | 未编码 | — | **规划中** |
| **TRN-DIAG** | 转写任务时间线 | 📋 | 未编码 | — | **规划中** |
| **R4** | 质量 Tab + eval 回归 | ⏳ | 未编码 | — | **规划中** |
| **R9** | REL-1 发版 | ⏳ | 未编码 | — | **规划中** |

### 1.2 总体完成度估算

| 维度 | 完成度 | 说明 |
|------|--------|------|
| **P0 核心功能** | ~75% | 转写、导出、术语、LLM 校准已编码；R3h-0/1 发行门禁 + EXP-WORD 收尾中 |
| **P1 体验增强** | ~45% | **REV-LOC** ✅；ASR-WARM、TRN-DIAG 未编码；**下一主序 R4** |
| **测试覆盖** | ~85% | 744 TS + 242 Rust 通过，但有 4 个回归失败（均与 EXP-WORD 相关） |
| **文档/规格** | ~90% | 各阶段 acceptance/spec 基本齐全 |

---

## 二、已完成模块代码质量审查

### 2.1 R3t-D 段界整理（`postprocess_segment_ops.rs`）— 质量良好 ✅

**优点**：
- `SegmentRefineOp` 使用 tagged union，`serde(tag = "op")` 序列化稳健
- `validate_refine_ops` 校验全面：uid 存在性、merge 连续性、split 时间范围、空文本检查
- `MIN_SPLIT_SIDE_SEC = 0.02` 防止过碎拆分
- `extract_json_object_from_llm_content` 兼容 markdown fence 和裸 JSON
- 内联测试覆盖未知 uid、非相邻 merge、无效 split point

**可改进项**：
- `partial_cmp` 在 `NaN` 时回退 `Equal`，如果 `start_sec` 含 `NaN`（虽然前端不应传入），排序行为不确定。建议增加 `is_finite` 前置检查。
- `extract_json_object_from_llm_content` 对嵌套 markdown fence（如 `"```\n```json\n{}\n```\n```"`）处理不够健壮，但当前 prompt 不会触发。

---

### 2.2 R3e-C 增量转写（`useTranscribeJobController.ts` / `transcribeAsyncPoll.ts`）— 质量良好 ⚠️

**优点**：
- `pollTranscribeJob` 的取消检测在多个检查点（before fetch、after done、after cancelled、before sleep、after sleep）都有覆盖，较为完整
- `restoreSnapshot` 机制在转写失败时恢复原始 segments，避免数据丢失
- `TRANSCRIBE_ASYNC_MAX_WAIT_MS = 7_200_000`（2 小时）匹配长音频需求

**发现的问题**：
1. **`executeTranscribe` 依赖数组可能不稳定**
   - `executeTranscribe` 的 `useCallback` 依赖了 `transcribeVocabularyPreflightLines`（数组），每次引用变化都会导致函数重建。虽然不影响正确性，但可能触发不必要的 `useEffect` 或子组件重渲染。

2. **`pollTranscribeJob` 超时后 best-effort cancel 无等待**
   - 超时后发送 cancel 请求但不等待响应，若侧车正在处理大文件，cancel 可能未生效即抛出超时错误。用户会看到「超时」而非「已取消」。

3. **`postTranscribeCancel` 使用 `loopbackFetch` 无超时**
   - 如果侧车已僵死，`postTranscribeCancel` 可能 hang 住（虽然被外层 try/catch 包裹，但 Promise 不会 resolve）。

---

### 2.3 R3g-C Profile（`asr_model_profile.py`）— 质量良好 ✅

**优点**：
- `frozen=True` dataclass 保证不可变性
- `build_generate_kwargs` 按 `sku_family` 分支清晰，长音频参数隔离
- `_env_use_itn_override` 支持多种布尔字符串格式

**可改进项**：
- `resolve_asr_model_profile` 使用字符串包含匹配（`"sensevoice" in mid`），如果未来出现 `sensevoice-v2` 等变体，可能意外匹配。建议改为前缀匹配或显式 SKU 列表。
- Qwen3 已决策 No-go，但 `_QWEN_FUNASR_LANGUAGE` 和 `is_qwen_asr_model` 仍留在代码中，成为死代码。建议注释标记或在清理轮中移除。

---

### 2.4 Waveform 热点代码 — 复杂度偏高 ⚠️

#### `useWaveformSegmentDrag.ts`（396 行）

**问题**：
- 超过 AGENTS.md 推荐的 300 行阈值，且包含复杂的指针事件状态机
- `argsRef` 模式导致大量 `.current` 访问，类型安全依赖运行时
- `onPointerCancel` 中 `releasePointerCapture` 的 try/catch 掩盖了潜在的 DOM 状态不一致

**优点**：
- 吸附（snap）、边界钳制（clamp）、创建范围（create range）逻辑分离清晰
- Pointer API 使用规范（setPointerCapture / releasePointerCapture）

#### `pxPerSec.ts`（375 行）

**问题**：
- 纯数学工具文件，行数合理但函数过多（20+ 个导出函数）
- `resolveWaveformZoomStepRatio` 的 fallback 值 `1.2544000000000002` 是浮点误差结果，建议写成 `Math.pow(2, 1/3)` 或显式常量
- `quantizePxPerSecForPeaksLoad` 中 sub-min 值的特殊处理逻辑复杂，测试覆盖可能不足

**建议**：拆分为 `waveformZoomMath.ts` + `waveformPeaksLimits.ts`。

---

### 2.5 LRC（`local_runtime/`）— 架构良好，发行待验证 🟡

**优点**：
- 模块拆分清晰：`catalog/`、`install_support/`、`installer/`、`integrity/`、`manifest/`、`recovery/`
- `LocalRuntimeDiagnose` 聚合了 manifest、install、installed、disk 四维状态
- `required_install_bytes` 使用 `size * 3 + 512MB` 保守估算，考虑了解压膨胀
- 恢复机制分 A/B/C 三类（安装事务回滚、手动恢复 previous、自动升级回滚），文档与代码一致

**风险**：
- `local_runtime/` 共 47 个 `.rs` 文件，是项目中最大的 Rust 子系统，但大部分测试是单元测试，缺少集成测试验证端到端安装流程
- `installer/run.rs` 和 `download.rs` 涉及网络 I/O 和文件系统操作，当前测试可能大量 mock，真实环境行为差异风险高
- **R3h-0 跨平台 smoke 未闭环** — 这是路线图标明的最高严重度阻塞项

---

### 2.6 DB 层（`db.rs`）— 稳健 ✅

**优点**：
- 迁移策略为附加式（`ALTER TABLE ADD COLUMN`），不破坏旧数据
- `migrate_segments_uid` 为旧数据批量生成 UUID，并建立唯一索引
- `migrate_segments_kind` 兼容旧库 NULL 值

**可改进项**：
- `table_columns` 使用 `format!("PRAGMA table_info({table})")` 拼接 SQL，虽然参数已白名单校验，但可改用参数化查询进一步加固
- 当前迁移均为启动时同步执行，如果表极大（如百万级 segments），`ALTER TABLE` 可能阻塞启动。目前项目规模不会触发，但应记录此限制

---

### 2.7 R3t-E Lexicon Proofread（`useLexiconProofreadController.ts`）— 编码完成，待手测 🟡

**优点**：
- consent 机制（`LEXICON_CONSENT_KEY`）尊重用户知情权
- `activeRequestSeqRef` 竞态防护：过期的响应不会更新 UI
- 写回前双重校验：`validateRefineOps` + `segmentsMonotonicByTime`
- 支持部分采纳（`selectedOpIndexes`）+ 一键全选/全不选
- `acceptRulesOnWriteback` 支持将采纳的修改自动入库为规则

**潜在问题**：
1. **`cancelLexiconProofread` 调用 `postprocessCancelAutoPunctuate(requestId)`**
   - 使用的是 auto_punctuate 的取消端点，而非 lexicon_proofread 专用取消。如果后端 `postprocess_cancel_auto_punctuate` 按 `request_id` 查找 AbortHandle，且 lexicon 请求与 auto-punctuate 使用同一 `PostprocessCancelState`，这会**误取消其他进行中的请求**。
   - 如果 lexicon 请求没有注册到 `cancel_state`（观察 `postprocess_cmd.rs` 中 `postprocess_lexicon_proofread` 的实现），则 cancel 调用无效。

2. **`buildPayload` 中 `flushSegmentTextDrafts()` 后读取 `segmentsRef.current`**
   - `flushSegmentTextDrafts` 是同步操作，但其后 `segmentsRef.current` 可能已被其他并发操作修改（如自动保存）。虽然概率极低，但非原子。

---

## 三、进行中模块问题汇总（EXP-WORD）

> 详细技术审查见 [`exp-word-code-review-report.md`](../specs/exp-word-code-review-report.md)

### 3.1 当前回归失败（阻塞主分支健康）

| 测试文件 | 失败测试 | 根因 |
|---------|---------|------|
| `exportPolishTrackMarkup.test.ts` | `fixture 'large_rewrite' expectMarkup=false` | `lineWouldHaveWordTrackMarkup` 对「大段改写」的判定逻辑与 Rust 侧 `hunk_eligible_for_export_track` 不一致 |
| `exportPolishDelivery.test.ts` | `blocks lecture export without preview` | `assessExportPolishReadiness` 在未配置 LLM 时返回的阻断原因与测试期望不符 |
| `exportPolishDelivery.test.ts` | `allows export when cache matches` | `assessExportPolishReadiness` 的缓存匹配逻辑有 bug（同 `tryAdoptExportPolishPreview` 问题） |
| Rust `export_docx_polish_track::tests` | `export_track_markup_shared_fixture` | 同上：large_rewrite fixture 期望 `false` 但得 `true` |

### 3.2 关键缺陷速览

1. **XML 转义不完整** — `escape_docx_text` 未处理控制字符，`paragraph_from_diff_pieces` 直接传入未转义文本
2. **ZIP 后处理丢失原始压缩方式**
3. **export polish 缺少取消机制 + 30 秒超时不足**
4. **TS/Rust 字符计数不一致**（`body.length` vs `.chars().count()`）
5. **`tryAdoptExportPolishPreview` 逻辑冗余且边界有误**
6. **`llmHanEditRatio` 硬编码为 0**

---

## 四、架构守卫与代码热点

### 4.1 当前守卫状态

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

| 检查项 | 状态 |
|--------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run test` | ❌ **3 失败**（EXP-WORD 回归） |
| `node scripts/check-architecture-guard.mjs` | ⚠️ 11 警告（波形热点） |
| `cargo test` | ❌ **1 失败**（EXP-WORD 回归） |

### 4.2 代码热点（超阈值需关注）

| 文件 | 行数 | 阈值 | 风险 |
|------|------|------|------|
| `useWaveformSegmentDrag.ts` | 396 | 300 | 指针事件状态机复杂，再叠功能需拆分 |
| `pxPerSec.ts` | 375 | 300（工具类可放宽） | 函数过多，建议拆分 |
| `asr_sidecar.rs`（含 bundled） | ~632 | 500 | R3h-I1 需拆分 supervisor FSM |
| `local_runtime/install_support/` | 合计大 | — | R3h-2 薄片内需再拆 |

---

## 五、风险与建议

### 5.1 高风险项

| 风险 | 影响 | 建议 |
|------|------|------|
| **R3h-0 跨平台 smoke 未闭环** | 阻塞 R3f 手测与发版 | 优先投入 2–3d 专轮，Win/mac 双平台构建 + 安装验证 |
| **EXP-WORD 4 个测试失败** | 主分支不健康，阻塞后续合并 | 立即修复 TS/Rust 测试；XML 转义问题须在手测前解决 |
| **Qwen3 死代码残留** | 维护负担，误导未来开发者 | 清理 `_QWEN_FUNASR_LANGUAGE`、`is_qwen_asr_model` 等函数 |
| **`cancelLexiconProofread` 误用 cancel 端点** | 可能误取消其他 LLM 请求 | 验证 `postprocess_lexicon_proofread` 是否注册到 `cancel_state`；若未注册，移除无效 cancel 调用 |

### 5.2 中风险项

| 风险 | 影响 | 建议 |
|------|------|------|
| `useTranscribeJobController` 依赖数组不稳定 | 可能引发不必要的重渲染 | 将 `transcribeVocabularyPreflightLines` 改为稳定引用或使用 `useRef` |
| 波形热点持续膨胀 | 技术债务累积 | 下一波形功能前拆分 `pxPerSec.ts` 和 `useWaveformSegmentDrag.ts` |
| LRC 缺少集成测试 | 真实安装场景回归无保障 | 增加 mock HTTP + temp dir 的 installer 集成测试 |

### 5.3 修复优先级

| 优先级 | 事项 | 责任人 | 预估 |
|--------|------|--------|------|
| **P0** | 修复 EXP-WORD 4 个测试失败 | 当前编码者 | 2–4h |
| **P0** | 补全 XML 转义（控制字符 + 修订轨） | 当前编码者 | 1h |
| **P1** | R3h-0 跨平台 smoke 闭环 | R3h 负责人 | 2–3d |
| **P1** | 清理 Qwen3 死代码 | 维护轮 | 0.5h |
| **P1** | 验证/修复 `cancelLexiconProofread` cancel 逻辑 | R3t-E 负责人 | 1h |
| **P2** | `pxPerSec.ts` 拆分 | 波形维护者 | 2h |
| **P2** | `tryAdoptExportPolishPreview` 逻辑修复 | EXP-WORD | 0.5h |

---

## 六、结论

**进度总体评价**：R3 主线推进有序，B 期（转写真源）核心能力（R3t-A/B/C/D、R3e-B/C、R3g-C、ACC）已签收，进入 **⑤″f（词表与改稿轨）** 和 **⑤‴（EXP-WORD）** 收尾阶段。Qwen3 No-go 决策正确，释放了 EXP-WORD 的阻塞。

**代码质量总体评价**：已完成模块的代码质量较高，架构拆分清晰，测试覆盖充分。主要问题集中在：
1. **EXP-WORD 回归缺陷**（4 个测试失败，XML 安全性隐患）— 需立即修复
2. **R3h-0 发行瓶颈** — 需优先投入
3. **部分边界情况处理不完整**（NaN、死代码、cancellation 误用）— 可在维护轮中逐步清理

**下一步行动建议**：
1. 暂停 EXP-WORD 新功能编码，先修复现有测试失败 + XML 转义
2. 并行推进 R3h-0 smoke 专轮
3. R3t-E 手测签收后进入 ⑤″f 收尾
4. 每轮结束严格执行 `npm run typecheck && npm run test && cargo test && node scripts/check-architecture-guard.mjs`
