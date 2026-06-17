# Rushi 全方位代码审查计划（2026-06）

> **状态**：规划定稿 · **v2 报告** [`code-review-report-2026-06-v2.md`](../../code-review-report-2026-06-v2.md)  
> **关联**：[`code-review-report-2026-06-06-full.md`](../../code-review-report-2026-06-06-full.md)（静态 17 轮）· [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)  
> **节奏**：单人 · 每轮 2–4h · 一轮一主题 · 轮末 L0 闸门 + 3 行日志

---

## 1. 目标

| 维度 | 要求 |
|------|------|
| **覆盖** | 桌面 UI、Tauri/Rust、Python ASR、脚本/CI、发行包 |
| **静动结合** | 每条功能链路：静态读码 + 动态仿真（手测 / Playwright / smoke） |
| **文案—代码** | **独立阶段（Phase 7）**：用户可见说明、设置页、快捷键 hint、能力状态文案与实现真源一致 |
| **可回归** | 缺口沉淀为单测、Playwright case 或 `scripts/*-hand-test.sh` |
| **债务闭环** | 2026-06-06 报告 P0–P3 逐项复验台账 |

---

## 2. 总阶段一览

| 阶段 | 主题 | 静 | 动 | 预估 |
|------|------|----|----|------|
| **0** | 基线与门禁 | ✅ | smoke/E2E 摸底 | 0.5d |
| **1** | 项目与 SQLite 真源 | ✅ | 生命周期剧本 P1 | 1d |
| **2** | 转写全链路 | ✅ | r3t/r3e/trn-diag 脚本 | 1.5d |
| **3** | 编辑器 / 波形 / 快捷键 | ✅ | 12 键位 + draft/merge | 1.5d |
| **4** | F0 / 导出 / 质量 Tab | ✅ | r3-5f / EXP-WORD | 1d |
| **5** | 环境 / LRC / 在线 STT | ✅ | r3f/r3h/asr-warm | 1d |
| **6** | 安全 / 发行 / 架构 guard | ✅ | DMG smoke / security-review | 1d |
| **7** | **文案—代码一致性** | ✅ | **UI 走查矩阵** | **1.5d** |
| **8** | 性能 / 平台 / 僵尸路径 | ✅ | 长音频 / Win 豁免登记 | 1d |
| **9** | 2026-06 债务复验 + 总报告 | — | 关单 | 0.5d |

**主路径剧本 P1–P12**（跨阶段嵌入，release + dev 各 1 次）：见 §5。

---

## 3. Phase 7 — 文案与代码一致性（专项）

### 3.1 问题定义

失败模式（Rushi 已出现过）：

| 模式 | 例 |
|------|-----|
| **多真源漂移** | 设置页表格 vs 右键 hint vs 底栏轮换 vs 用户指南各写一套快捷键 |
| **能力维度假设错误** | 文案写「当前所选模型可转写」，代码读全局 `ready_for_transcribe`（D5 代替 D1） |
| **dev/release 文案混用** | 安装包仍提示 `npm run desktop:dev` |
| **行为已改文案未改** | ⌘Space→⇧⌘Space；命令面板标「不做」但旧 doc 仍可见 |
| **acceptance 与产品不一致** | spec 写「必做」但 UI 已移除入口 |
| **动态行为与静态说明不符** | 写「Esc 关闭所有面板」但 gate 对话框 Esc=留在编辑器 |

**本阶段目标**：建立 **文案真源矩阵**，逐类 **追溯 → 对照 → 动态走查 → 关单**。

### 3.2 文案真源分层（审查时必须标注属于哪层）

```text
L0  产品决策 / 路线图 / ADR「不做」清单
L1  架构契约（能力—UI 矩阵、ASR 热词真源、管线 intent）
L2  代码内用户可见真源（优先从此生成 UI）
L3  由 L2 派生的 UI（禁止手写重复键位/能力描述）
L4  独立文档（user-guide、DESIGN、Stitch spec、acceptance 手测说明）
L5  脚本 echo / CI 日志 / 错误 message 英文混排
```

**硬规则**

1. **L2 为快捷键、能力状态、转写 blocking reason 的唯一真源**；L3 只能 `import` / 调用 L2。
2. **L4 不得与 L2 矛盾**；矛盾时以 **代码 + architecture** 为准，改 L4 或开 spec 变更。
3. **L0「明确不做」** 的条目：代码中不得存在 **用户可达** 的 L3 入口（须僵尸路径审计）。

### 3.3 L2 真源清单（审查范围 — 必须逐文件过）

| ID | 真源文件 | 消费方（须追溯） | 审查要点 |
|----|----------|------------------|----------|
| **C-01** | `utils/editorShortcutRegistry.ts` | `EnvEditorShortcutsPanel`、`editorShortcutMenuHint`、`editorFooterShortcutHints`、`executeEditorShortcut`、`useEditorShortcutDispatcher`、`segment*ContextMenuModel` | 绑定 = 文案 = 执行；`requiresOpenFile` / scope |
| **C-02** | `utils/dialogPanelHints.ts` | `DraggableResizablePanel`、`CompactConfirmDialog`、`formatEditorShortcutPanelSections` | Esc 关闭语义 |
| **C-03** | `services/packagedUserHints.ts` | `asrEnvStatus`、`useAsrSetupDiagnose`、`localRuntimeSetupHelpers`、`prepareModelDownloadCopy` | dev vs release 分支全覆盖 |
| **C-04** | `services/asr/asrEnvStatus.ts` + `useAsrBridgeController` | `EnvLocalAsrPanel`、`WelcomeTopBar`、`EditorToolbar` chip | chipOk / blockReason / banner 与 D1–D6 |
| **C-05** | `services/stt/onlineSttEnvStatus.ts` | 在线 STT 面板、转写 preflight | 有 Key / 无 Key 文案 |
| **C-06** | `services/stt/transcribeSourcePresentation.ts` | `AutoTranscribeStartDialog`、转写入口 | 本机/在线描述 |
| **C-07** | `services/stt/sttVocabularyBias.ts` | 环境页、`supportsHotwordBias` UI | 12k 截断、provider 差异 |
| **C-08** | `services/environmentCapabilityCoordinator.ts` | 转写 preflight vs 设置页 | 同一 blockReason |
| **C-09** | `pages/prepareModelDownloadCopy.ts` | 模型下载进度 UI | 百分比语义 = catalog D4 |
| **C-10** | `services/llm/llmEnvStatus*.ts` | `EnvLlm*`、LLM chip | Ollama/云端/off |
| **C-11** | `utils/segmentContextMenuModel.ts` + `segmentTextContextMenuModel.ts` | `SegmentContextMenu` | hint = registry |
| **C-12** | `components/EnvironmentPanel.tsx` section 定义 | 各 `Env*Panel` | 侧栏 description 与面板内容一致 |
| **C-13** | `resources/user-guide-zh.md` (+ PDF) | `EnvAboutPanel` | 与 L2 大项一致 |
| **C-14** | Rust 用户可见字符串 | `append_sidecar_log` 仅日志；**对话框/toast 须查 TS 或 Rust 返回 msg** | 错误码 → 中文映射 |
| **C-15** | `CONTEXT.md` glossary | 全仓命名 | 术语与 UI 一致 |

### 3.4 Phase 7 子轮（建议 5 轮 × 2–4h）

#### 7-A — 快捷键与编辑器文案（C-01, C-02, C-11）

**静态**

- [ ] `matchEditorShortcut` 与 `keysLabel` 一一对应
- [ ] `formatEditorShortcutPanelSections` 含 ↑↓、Esc、语段/波形分组
- [ ] 右键 / 底栏 / 工具栏 `title` 均走 `editorShortcutMenuHint` 或 registry
- [ ] `editorFooterShortcutHints.legacy.ts` 无与 registry **冲突** 的键位
- [ ] `editor-keyboard-shortcuts-research.md`「明确不做」项无 UI 入口

**动态（release 安装包）**

| # | 操作 | 期望文案位置 | 验证 |
|---|------|-------------|------|
| D1 | 工具栏 hover「设置」 | title | 显示 ⌘, |
| D2 | WelcomeSidebar「设置」 | title | 同 D1 |
| D3 | 环境 → 编辑器快捷键 | 表格 | 与 D1 键位一致 |
| D4 | 语段右键「合并下一条」 | hint | ⌘J |
| D5 | 底栏轮换 | footer | registry footerAction |
| D6 | Esc | 浮动面板 / 确认框 | 关闭或取消；gate=留在编辑器 |
| D7 | 波形区 Esc | 无对话框 | 清除多选（非关面板） |
| D8 | 正文 ↑↓ | 设置表「语段正文」 | 实际切段 |

**自动化**

- `editorShortcutRegistry.test.ts`
- `editorShortcutMenuHint.test.ts`
- `useEditorShortcutDispatcher.test.ts`
- `dialogEscapeStack.test.ts`

---

#### 7-B — 本机 ASR / 能力—UI（C-03–C-09, architecture D1–D6）

**静态**

- [ ] 对照 [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md) §2 维度表，列出每个 Env 控件绑定的 D#
- [ ] `packagedOrDev` 所有 call site：release 路径无 npm/terminal
- [ ] `blockReason` / `errorBannerMessage` 触发条件与 Rust `/health` 字段对照
- [ ] 模型列表「已缓存/未缓存」数据源 = D4 非 D5/D6

**动态状态矩阵（必跑）**

| 状态 | 操作 | UI 应显示 | 不应显示 |
|------|------|-----------|----------|
| S1 | 冷启动 release，未准备 | chip 黄/红；blockReason 可操作 | 「npm run …」 |
| S2 | D1=Paraformer，D2=SenseVoice | 「应用并重启侧车」类提示 | 「100% 已就绪」 |
| S3 | 一键准备完成 | chipOk；与 D1 一致的可转写 | 全局误报 |
| S4 | ffmpeg 缺失 | packaged ffmpeg 文案 | 单独装 ffmpeg 误导 |
| S5 | 8741 外部 dev 侧车 + release app | stale/adopt 说明 | 「bundled 正常」误导 |
| S6 | 热词超 12k | 截断/toast 与 HOT-UX spec | 静默截断无说明 |

**脚本**：`r3f-installed-hand-test.sh`、`r3g-a-s3-hand-test-checklist.md`、`hot-ux-acceptance.md`

---

#### 7-C — 在线 STT / LLM / 转写入口（C-05, C-06, C-10, C-08）

**静态**

- [ ] `resolveTranscribeSourceDescription` 与本机/在线实际路由一致
- [ ] 无 Key 时在线 STT 文案 = 「未配置」非「网络错误」
- [ ] LLM 面板：4b Gate-B No-Go 能力无「可用」暗示
- [ ] `TranscribeNavBlockDialog` / `UnsavedCloseDialog` 按钮文案与 Esc 行为一致

**动态**

| # | 场景 | 验证 |
|---|------|------|
| D1 | 无 STT Key 点转写 | preflight 文案 + 设置跳转 |
| D2 | 有 Key（若可） | 与 adapter 行为一致 |
| D3 | 转写中导航离开 | gate 文案与 acceptance |
| D4 | Ollama 未启动 | LLM chip + 后处理提示 |
| D5 | F0 Stage B Consent | 「发送云端 LLM」与实际上传字段 |

---

#### 7-D — 术语 / 导出 / 质量 / Hub（C-12, L4）

**静态**

- [ ] `GlossaryPage` 文案 vs `asr-hotword-bias-truth.md`
- [ ] VOC 确认框 vs `asr-voc-landing-acceptance.md`
- [ ] 导出向导步骤 vs `exp-word-formatted-export-acceptance.md`（预览硬闸）
- [ ] 质量 Tab 指标说明 vs `eval-run` 实际 CSV 列
- [ ] Hub 重命名/删除确认 vs `desktop-project-file-lifecycle.md`

**动态**

- F6 纳入术语表提示（第 3 次）
- 导出三形态 Word 打开抽检（与 UI 形态名一致）
- 质量 Tab 跑一次 eval（文案中的「hit rate」等可解释）

---

#### 7-E — 文档 / 指南 / acceptance 漂移（L0, L4, L5）

**静态对表**

| 文档 | 对照 L2/L1 | 方法 |
|------|------------|------|
| `user-guide-zh.md` | C-01, C-03, 主路径 | 逐节 grep 键位/命令 |
| `editor-keyboard-shortcuts-research.md` | C-01 | v2 已落地 vs「不做」 |
| `AI_QUICKSTART.md` §热点 | 路线图 §10 | 日期与状态 |
| 各 `*-hand-test-checklist.md` | 当前 UI 入口 | 不可达步骤标 obsolete |
| `DESIGN.md` / Stitch spec | 实际 token/tailwind | 无 hardcode hex |
| `CONTEXT.md` | 代码标识符 | glossary 抽样 |

**工具**

- `grill-with-docs` skill（中等以上变更前对齐）
- 可选：脚本 `scripts/audit-copy-shortcuts.sh`（grep 游离 `⌘`/`Ctrl+` 于 components，排除 registry/hint）

**产出**：`copy-code-drift-register-YYYY-MM-DD.md`（文件、行、矛盾、改 L2/L4/代码、优先级）

---

### 3.5 文案审查严重等级

| 等级 | 定义 | 例 |
|------|------|-----|
| **CX0** | 误导操作或安全/数据 loss | 「Esc=放弃未保存」实际丢弃；dev 命令在 release |
| **CX1** | 能力状态错误，导致误转写/误下载 | D5 代替 D1 显示就绪 |
| **CX2** | 快捷键/hint 与行为不一致 | 设置写 ⌘K 合并，实际无效 |
| **CX3** | 文档过时但不影响主路径 | acceptance 旧截图路径 |
| **CX4** | 措辞/标点 | 仅润色 |

---

## 4. 其余阶段审查范围（摘要）

### Phase 0 — 基线

```bash
npm run typecheck && npm run test && npm run lint
node scripts/check-architecture-guard.mjs
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --all-targets -- -D warnings
cd services/asr && pytest
npm run desktop:test:e2e:desktop   # 记录 pass/skip/fail
bash scripts/release-sidecar-preflight.sh
```

产出：`review-baseline-YYYY-MM-DD.md`

### Phase 1 — 项目生命周期

**范围**：`db.rs`、`project_*_cmd.rs`、`useProject*Controller.ts`、bundle 导入、REV-LOC  
**动态**：P1 + `rev-loc-slice-*-hand-test.sh` + 事务/崩溃注入  
**复验**：2026-06 Round 1 P1.1–1.6

### Phase 2 — 转写

**范围**：`run_transcribe_cmd.rs`、`transcribe_job.rs`、`segmentation.py`、`useTranscribeJobController.ts`  
**动态**：`r3t-a/b/c`、`r3e-b/c`、`trn-diag-hand-test.sh`、ASR-WARM idle  
**文案交叉**：Phase 7-B/C 中转写 blocking / timeline 说明

### Phase 3 — 编辑器 / 波形

**范围**：`useProjectWaveform.ts`、`useSegmentMutationController.ts`、shortcut 栈  
**动态**：P3–P6 + Playwright 缺口清单  
**文案交叉**：Phase 7-A

### Phase 4 — F0 / 导出 / 质量

**范围**：F0 orchestration、`export_docx.rs`、Stage A/B、`CorrectionRulesPreviewDialog`  
**动态**：`r3-5f-*-machine-gate.sh`、EXP-WORD checklist  
**文案交叉**：Phase 7-D

### Phase 5 — 环境 / LRC

**范围**：`local_runtime/`、`asr_sidecar/supervisor.rs`、`Env*Panel`  
**动态**：`r3h-0/2`、`r3f`、`test-r3h-2-c-rollback.sh`  
**文案交叉**：Phase 7-B

### Phase 6 — 安全 / 发行

**范围**：CSP、capabilities、SSRF、manifest 签名  
**动态**：`v1-release-installed-smoke.sh`、`security-review` subagent  
**文案交叉**：错误 toast 不泄露路径/密钥

### Phase 8 — 性能 / 平台 / 僵尸

- 500+ 语段波形；30min soak  
- Windows smoke 豁免登记  
- 插件 / `china_stt_shell` WS  
- R3t-E / 4b / 命令面板 **可达性审计**

### Phase 9 — 关单

- 合并 `copy-code-drift-register` + 2026-06 P0–P3 台账  
- 发布 `code-review-report-2026-06-v2.md`

---

## 5. 主路径剧本 P1–P12

| ID | 剧本 | 文案抽查点 |
|----|------|------------|
| P1 | 欢迎 → 建项 → 导入 → 编辑器 | 侧栏、错误 toast |
| P2 | 本机转写 ×2 | warnings、timeline 文案 |
| P3 | 编辑 + 关窗 gate | gate 按钮与 Esc |
| P4 | 撤销 / edit_log 恢复 | toast、菜单 |
| P5 | 查找替换 + Esc | 面板 hint |
| P6 | 合并 / 拆分 / 删除 | 确认框、快捷键 hint |
| P7 | 波形播放 | 无「⌘Space 播放」类过时 hint |
| P8 | 改 ASR 语言 | 能力—UI 矩阵 S2/S3 |
| P9 | 热词 → 转写 | VOC preview 文案 |
| P10 | F0 纠错预览 | consent 与 F0 spec |
| P11 | DOCX 三形态 | 向导步骤名 |
| P12 | 诊断包 | 菜单名与 about 说明 |

---

## 6. 交付物模板

### 6.1 每轮报告

见 [`code-review-report-2026-06-06-full.md`](../../code-review-report-2026-06-06-full.md) 格式；**Phase 7 增加列**：`文案ID (C-xx)`、`CX 等级`、`真源层 L0–L5`。

### 6.2 文案漂移登记表（Phase 7-E 产出）

```markdown
| CX | 文案位置 | 声称 | 代码/动态实际 | 真源 | 修复目标 |
```

### 6.3 2026-06 债务复验表（Phase 9）

```markdown
| 原 ID | 状态 | 静态证据 | 动态证据 | 备注 |
```

---

## 7. 排期（单人约 10–11 周，可压缩）

| 周 | 内容 |
|----|------|
| W1 | 0 + 1 |
| W2 | 2 |
| W3 | 3 |
| W4 | 4 |
| W5 | 5 + 6 |
| W6–W7 | **7（文案专项，5 子轮）** |
| W8 | 8 |
| W9 | 9 + v2 总报告 |

**可并行**：Phase 7-A 与 Phase 3；Phase 7-B 与 Phase 5。

---

## 8. 完成标准

1. P1–P12 release 全绿或登记豁免  
2. **C-01–C-15 逐 ID 有「静态✅ + 动态✅或 N/A」**  
3. CX0=0；CX1 全部关单或 spec 变更  
4. 2026-06 P0–P3 复验完成  
5. 新增 ≥3 条文案回归（单测或 Playwright）  
6. `user-guide-zh` 与 C-01/C-03 大项无矛盾  

---

## 9. 修订

| 日期 | 说明 |
|------|------|
| 2026-06-12 | 初版：6 阶段 + **Phase 7 文案—代码专项** + C-01–C-15 真源清单 |
