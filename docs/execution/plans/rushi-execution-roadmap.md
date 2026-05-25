# Rushi 统一执行路线图（2026-05-25 起）

> **本文件为 Rushi 仓后续工作的排期真源。**  
> 与 Jieyu 平级计划书冲突时：以 **本仓代码 + ADR + 本文** 为准。  
> 深度背景见文末「参考文档」；实施细节仍以各 feature spec 三件套为准。

| 元数据 | 值 |
|--------|-----|
| 基线日期 | 2026-05-25 |
| 适用节奏 | 单人、每轮 2～4h、一轮一纵向薄片 |
| 规划跨度 | 约 16 周（至 2026-09 初）可完成「单机增强 + 协作最小闭环」 |
| 修订 | 每完成一个阶段更新 §2 状态表、§4 排期表与 §13 代码对照 |
| 最近对照 | 2026-05-25（工作区相对 `origin/main` 有大量未提交改动，见 §13.1） |

---

## 1. 规划原则

1. **UI 根部已验收**：新能力必须带 UI 落点、状态模型与手测路径（[`ui-redesign-parallel-dev.md`](../specs/ui-redesign-parallel-dev.md) 已收口）；不再开「纯换皮」轮次。
2. **一轮一薄片**：每轮只做一个可验收主题；轮末硬闸门 + 至少 1 条主路径手测 + 3 行日志。
3. **信任边界**：LLM 后处理、MCP **不进** ASR PyInstaller 侧车；密钥不进 repo。
4. **本地真源优先**：SQLite 离线能力不降级；协作是叠加层，不替换本地项目。
5. **中等复杂度先 spec**：编码前完成 intent / plan / acceptance（模板见 [`spec-template.md`](../specs/spec-template.md)）。

### 每轮硬闸门

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
# 动 Rust / DB / 新 Tauri 命令时追加：
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

### 发版前集成闸门

```bash
npm run test:all
bash scripts/p0-acceptance.sh
# 长音频人工清单见 §6 REL-1
```

---

## 2. 已完成基线（不再占排期）

| 领域 | 状态 | 说明 |
|------|------|------|
| 本地 P0 功能闭环 | ✅ | 项目/文件/语段、转写、导出、包导入导出 |
| 架构拆分（主项） | ✅ | `project/` 模块、`EditorView`→`editor/*`、uid 语段、草稿 store、波形按 uid diff |
| UI 重设计首轮 | ✅ | A 欢迎/建项 + B 校对工作页 + Tauri 手测（2026-05-25） |
| 关窗 / 未保存 | ✅ | `allow-destroy` + 应用内对话框 |
| WASM 波形 | ✅ 移除 | WaveSurfer 为真源 |
| 协作决策 | ✅ | ADR-0001 / ADR-0002、存储与 API 草案 |
| Oumi 报告 Part I | ✅ 已评审 | 能力边界与「不做」清单 |
| 语段 uid / 草稿 / 波形同步（工作区） | ✅ 已实现 | 见 §13.1；**建议先提交再开 R1** |
| 关窗守卫 + 未保存对话框 | ✅ 已实现 | `appWindowCloseGuard` + `allow-destroy` |
| 在线 STT 环境 UI | ✅ 主体已有 | `EnvOnlineSttPanel` + 合约测试；非从零建设 |
| FunASR 模型下载 UI | ✅ 主体已有 | `usePrepareModelController` + `EnvLocalAsrPanel` |
| 诊断包导出入口 | ✅ 已有 | 工具栏菜单；R9 补体验与长音频手测 |
| LLM 后处理 / MCP / 协作服务 | ❌ 未开始 | 无 `postprocess_*`、`services/mcp`、`services/collab` |
| 桌面质量 Tab / profile 导出 | ❌ 未开始 | eval 仍在 `scripts/eval-run.py` |
| **术语库（glossary）后端** | ✅ 已有 | `glossary_terms` + `glossary_*` 命令 + 转写 `hotwords` 注入 |
| **术语库管理 UI** | ✅ 独立页 | `GlossaryPage` + 欢迎页侧栏「术语管理」；`useGlossaryController` 已接线 |

---

## 3. 统一阶段总览

```text
[已完成] 基线 + UI + 工作区波形/uid/关窗（待提交）
    ↓
R0     工程收口（提交 + 守卫）        ← 建议先于 R1（0.5 周）
    ↓
GLY-1  术语库管理 UI（P2 缺口）      ← 后端已有，0.5 周（建议 R0 后、R1 前）
    ↓
R1–R2  单机 · LLM 标点（P0）
    ↓
R3     单机 · 模型/配置体验（P2）      ← 可与 R2 尾部交错
    ↓
R4     单机 · 质量评估插槽（P0.5）
    ↓
R5     单机 · MCP 只读（P1）
    ↓
R6–R8  协作 · 骨架 → 只读 → 写路径（C1–C3）
    ↓
R9     发版集成验收（REL-1）
    ↓
[远期] 协作 C4–C7（审阅 / Presence / Word / 部署正式化）
```

**默认战略顺序**：先做完 **R1–R5（单机增强）**，再 **R6–R8（协作最小闭环）**。  
若业务要求「先演示多人协作」，可将 **R6 提前至 R3 之后**，但须接受 R1/R2 延后（见 §5 分叉）。

---

## 4. 排期表（单人、日历周）

> 周次以 **2026-05-26（周一）** 为第 1 周起点估算；按实际完成滑动，**不并行开两个大阶段**。

| 阶段 ID | 周次（约） | 日历（约） | 主题 | 交付摘要 | 预估 |
|---------|------------|------------|------|----------|------|
| **R0** | W1 前半 | 05/26 – 05/28 | ENG-0 工程收口 | 提交 uid/波形/关窗等改动；**拆分或降级** `useProjectLifecycleController`（381 行 / 21 hooks，守卫已告警）；同步 oumi §1.3 行数 | 0.5 周 |
| **GLY-1** | W1 后半 | 05/29 – 06/02 | 术语库管理 UI | 接线 `useGlossaryController`；列表/增删；与转写热词说明；替换侧栏占位 | **0.5 周** |
| **R1** | W2 | 06/03 – 06/06 | LLM-0 规格与架构 | `auto-punctuate-{intent,plan,acceptance}.md`；后处理不进侧车短文；T-002 迁址设计 | 1 周 |
| **R2** | W2–W3 | 06/02 – 06/13 | LLM-1 自动标点 | Rust `postprocess_cmd` + 预览 diff UI + 确认写回；隐私首次明示；超时/取消 | 1.5 周 |
| **R3** | W4–W5 | 06/16 – 06/27 | EXP-1 模型与配置 **差额** | 首次引导、缓存占用/清理、manifest **结果展示**；`profile.rs`；**不重复** prepare 下载条 | **1.5 周**（代码已有主体 UI） |
| **R4** | W6–W7 | 06/30 – 07/11 | QLT-1 质量插槽 | 包装 `eval_metrics`；rubric schema；质量 Tab 只读；correction_memory 导出脱敏 | 1.5 周 |
| **R5** | W8–W9 | 07/14 – 07/25 | AGT-1 MCP 只读 | `services/mcp/`；4 tools + 2 resources；127.0.0.1、默认关 | 2 周 |
| **R6** | W10–W11 | 07/28 – 08/08 | COL-1 协作骨架 | `services/collab/` + Compose + PG 迁移 + 只读 API | 2 周 |
| **R7** | W12–W13 | 08/11 – 08/22 | COL-2 桌面只读 | `ProjectSource`；列表 local/collab；协作项目只读打开 | 1.5 周 |
| **R8** | W14–W15 | 08/25 – 09/05 | COL-3 协作写入 | 单语段写 API + version + revision_events + 409 提示 | 2 周 |
| **R9** | W16 | 09/08 – 09/12 | REL-1 发版验收 | 长音频手测；`p0-acceptance`；E2E 抽检（可选） | 1 周 |

**合计**：约 **16.5 周**（含 R0；至 2026-09 中旬）完成单机增强 + 协作可写最小闭环。

### 阶段状态（实施时更新）

| 阶段 ID | 状态 | 完成日 |
|---------|------|--------|
| R0 | ✅ 已完成 | 2026-05-25 |
| GLY-1 | ✅ 已完成（手测通过） | 2026-05-25 |
| R1 | ✅ 已完成（文档门禁） | 2026-05-25 |
| R2 | ✅ 已完成（DeepSeek 手测通过） | 2026-05-25 |
| R3 | ⏳ | — |
| R4 | ⏳ | — |
| R5 | ⏳ | — |
| R6 | ⏳ | — |
| R7 | ⏳ | — |
| R8 | ⏳ | — |
| R9 | ⏳ | — |

---

## 5. 各阶段说明

### R1 — LLM-0：自动标点（规格门禁）

**目标**：编码前锁边界，避免返工。

| 做 | 不做 |
|----|------|
| spec 三件套 + 架构短文 | `smart_segment`、本地 vLLM |
| 定稿 invoke 契约、key 存储、隐私文案 | 放入 `services/asr` wheel |

**验收**：三件套评审通过；无代码或仅 scaffold + 测试占位。

**参考**：[`oumi-remediation-report.md`](../specs/oumi-remediation-report.md) §三 P0。

---

### R2 — LLM-1：自动标点（实施）

**目标**：验证「云端标点 + 用户确认写回」闭环。

**调用链**：

```text
React 预览 UI
  → invoke postprocess_auto_punctuate
  → Rust（reqwest，读 keychain / api_key_id）
  → 返回 text + diff
  → 用户确认 → updateSegmentText / flush 草稿
```

**验收**（摘自 Oumi P0）：

- [ ] 10 条无标点样本人工表 > 80% 合理
- [ ] >30s 超时降级为原文 + 提示
- [ ] 取消中断 in-flight
- [ ] 网络错误中文提示，无 stack 暴露
- [ ] 写回后 DB 与草稿 store 一致
- [ ] typecheck + test + guard + Rust mock 测试

**工程穿插**：T-002 `HTTP_CLIENT` 迁至 `utils/http.rs`（本阶段末或 R5 前完成）。

---

### GLY-1 — 术语库管理 UI（P2 交付缺口）

**背景**：术语库属于历史 **P2 中文领域增强**（见 [`p2-acceptance.md`](../p2-acceptance.md)），后端与热词链路已验收；统一路线图初版误将其视为「已完成」而只字未提 **管理界面**，造成规划盲区。

**代码真源（2026-05-25）**：

| 层 | 状态 | 位置 |
|----|------|------|
| SQLite | ✅ | `glossary_terms`（`db.rs`） |
| Tauri | ✅ | `glossary_list` / `glossary_add` / `glossary_delete`（`glossary_cmd.rs`） |
| 转写注入 | ✅ | `glossary_hotwords_joined` → `run_transcribe_cmd` |
| 在线 STT 文案 | ✅ | `EnvOnlineSttPanel` 说明热词来源 |
| React controller | ✅ | `useGlossaryController.ts` → `GlossaryPage` |
| 用户入口 | ✅ | 欢迎页侧栏「术语管理」独立页 |

**目标**：用户可在桌面端维护全局术语表，无需改 DB；保存后下次转写自动带上 `hotwords`。

| 做 | 不做 |
|----|------|
| 术语列表、添加、删除、重复/空校验错误展示 | 项目级术语表（仍全局） |
| 落点：环境面板新节或侧栏可打开面板（二选一，spec 定） | CAT 词典（见 `translation-dictionary-module.md`） |
| 手测：加词 → 转写 → 确认 ASR 收到 hotwords（warning/能力文案） | MCP `add_glossary_term` 写工具 |
| 移除「即将上线」占位文案 | 拼音近音、文本规整（P2 备注为增强项） |

**可选 spec**：若面板较复杂，补 `glossary-ui-{intent,plan,acceptance}.md`；否则在路线图本节 + 手测清单即可（小薄片）。

**验收**：

- [x] UI 可增删查，与 `glossaryApi` 行为一致
- [x] 空术语、重复术语有中文错误提示
- [x] 手测：新增术语 → 转写 → 热词/warning 策略可观测（2026-05-25，用户确认）
- [x] 硬闸门全绿（与 R2 同期提交前已验证）

**与 R4 关系**：R4 质量插槽可复用 `term_hit_rate` 与术语表；**不合并实施**，仅数据同源。

---

### R0 — ENG-0：工程收口（代码对照新增）

**触发原因**（2026-05-25 守卫）：`useProjectLifecycleController.ts` **381 行 / 21 hooks**，已超过 300/12 阈值。

| 做 | 不做 |
|----|------|
| 将工作区改动（uid、波形、关窗、wasm 移除等）整理提交 | 新功能 |
| 拆分 lifecycle：关窗 gate / 导航 gate / 导出 re-export 至少拆 1 个 controller | 大规模重写转写链 |
| 更新 oumi §1.3、architecture-split-plan 行数表 | |

**验收**：架构守卫 0 警告（或登记短期例外）；139 tests + 30 cargo tests 绿。

---

### R3 — EXP-1：模型与配置体验（原 P2）

**目标**：在已有 `usePrepareModelController` + `EnvLocalAsrPanel` / `EnvOnlineSttPanel` 上补**差额**，不重复建设侧车下载与在线 STT 表单。

| 做 | 不做 |
|----|------|
| 首次启动向导 / 全局进度 | 侧车断点续传（T-004） |
| 设置页缓存目录、占用、清理 | YAML 第一真源 |
| manifest 校验结果展示 | 云同步 |
| `profile.rs` 导入导出（无 api_key） | |

**UI**：环境面板 + 设置；沿用 Serene Scholar token。

**验收**：新用户下载路径可观测；导出 YAML 无密钥；硬闸门全绿。

---

### R4 — QLT-1：质量评估插槽（原 P0.5）

**目标**：桌面预留评估位；批跑指标不重复实现。

| 做 | 不做 |
|----|------|
| 委托 `eval_metrics.py` 的 CER / term_hit | LLM-as-judge 执行 |
| rubric YAML schema 校验 | synthetic dataset |
| 质量 Tab 只读（最近一次 eval 摘要） | 逐语段实时 judge |

**验收**：与 `eval-run.py` 数值一致；correction_memory 导出含脱敏步骤。

---

### R5 — AGT-1：MCP 只读（原 P1）

**目标**：外部 Agent 只读访问工作库。

| 做 | 不做 |
|----|------|
| `list_projects` / `get_project` / `get_transcript` / `search_segments` | 任何写 tool |
| `transcript://` / `project://` resources | 0.0.0.0 监听 |
| 设置页开关，默认关 | 打进 ASR 侧车 |

**验收**：Cursor / Claude Desktop 配置后可读 transcript；关闭后无额外端口。

**依赖**：T-002 完成；`file_id` / DB 路径稳定（已满足）。

---

### R6 — COL-1：协作服务骨架

**目标**：协作从文档变为可运行真源。

**交付**：`services/collab/`、`docker compose`、PG 迁移、`GET /health`、项目 CRUD + 语段只读 API。

**验收**：本地 Compose 起服务；迁移可重复；创建项目并读回语段列表。

**参考**：[`collaboration-foundation-plan.md`](./collaboration-foundation-plan.md) Phase 1。

**不做**：评论、Presence、Word、认证复杂化（原型可硬编码 token）。

---

### R7 — COL-2：桌面协作只读

**目标**：本地与协作项目并存，不污染 SQLite 真源。

**交付**：`ProjectSource`、`WorkflowMode` 雏形；欢迎/列表区分来源；协作项目只读渲染。

**验收**：打开协作项目不走本地 `project_load` 写路径；硬闸门 + 手测两条来源切换。

---

### R8 — COL-3：协作写入

**目标**：两客户端可编辑同一协作项目，冲突可感知。

**交付**：单语段 PATCH、乐观 `version`、`revision_events`、`409` 体 + 桌面提示。

**验收**：双开编辑冲突可复现；恢复路径可手测。

---

### R9 — REL-1：发版集成验收

**目标**：里程碑可发布或内测。

| 项 | 说明 |
|----|------|
| 长音频 | 30～60min 中文：转写 → 编辑 → 保存 → 重启 → txt/srt/docx 导出 |
| 脚本 | `p0-acceptance.sh`、现有 P1–P4 核对清单按需抽检 |
| 文档 | 更新 §2 状态表；`architecture-split-plan` 行数表与代码对齐（T-006） |
| 可选 | Playwright E2E 一条主干；波形性能基准记录 |

---

## 6. 远期阶段（2026 Q4 起，不纳入上表周次）

| ID | 主题 | 前置 |
|----|------|------|
| C4 | 审阅线程与建议修改 | R8 |
| C5 | Presence 与活动流 | C4 |
| C6 | Word 审阅导出 | C4 数据落库 |
| C7 | 离线缓存、部署包正式化 | C3 + 镜像 |

规格已存在、实施等 C4 启动时再写 acceptance 增量：[`collaboration-review-word-export.md`](../specs/collaboration-review-word-export.md)。

---

## 7. 工程债与穿插规则

| ID | 债项 | 建议穿插阶段 | 说明 |
|----|------|--------------|------|
| T-001 | `transcribe.rs` 体量 | R3 或 R4 空档 | 已拆 online；可继续切 |
| T-002 | `HTTP_CLIENT` 位置 | **R1 末 / R2** | R5 MCP 前必须完成 |
| T-003 | `AUDIO_ONLY` | R3 | 随 profile 整理 |
| T-004 | 模型断点续传 | C7 后 | 侧车未实现 |
| T-005 | `useProjectLifecycleController` | **R0 必做** | 当前 381 行 / 21 hooks，守卫已告警 |
| T-006 | `architecture-split-plan` 过期 | **R9** | 与 §2 基线同步 |

**穿插原则**：债项不单独开「重构周」；挂在最近相关功能薄片内，改动 ≤ 当轮范围。

---

## 8. 明确不做（至 C3 完成前）

| 项 | 原因 |
|----|------|
| 统一 InferenceEngine | ASR 与 LLM IO 不同 |
| MCP 写操作 | 无审计设计 |
| LLM 进 ASR 侧车 | 体积与信任边界 |
| YAML 配置主真源 | 密钥与 UI 双写 |
| correction_memory → 训练集 | schema 不足 |
| CRDT / 浏览器完整编辑器 | 协作远期 |
| 翻译词典 / CAT 全模块 | 见 `translation-dictionary-module.md`，**未纳入**（与 glossary 不同表、不同目标） |
| 术语库仅做后端、不做管理 UI | GLY-1 已纳入；初版路线图遗漏，属文档缺口非功能删除 |

---

## 9. 排期分叉（二选一）

### 默认：单机优先（§4 表）

适合：先验证 LLM 标点与模型体验 ROI，再投入协作服务端。

### 分叉 B：协作提前

若 **R6 必须提前至 R3 之后**（约 08 前要有协作 demo）：

```text
R1 → R2 → R6 → R7 → R3 → R4 → R5 → R8 → R9
```

代价：标点与模型体验后移；MCP 可能压到发版后。

**切换条件**：产品方书面确认「协作 demo 日期」早于 2026-08-01。

---

## 10. 当前入口（下一刀）

| 项 | 内容 |
|----|------|
| **阶段** | **R3 — EXP-1（先规划后实施）** |
| **规划真源** | [`r3-provider-configuration-research.md`](../specs/r3-provider-configuration-research.md)（Provider 业内共识 + Rushi 分层建议） |
| **建议实施顺序** | R3a LLM keychain+probe → R3b profile 导入导出 → R3c 本机引导/缓存/manifest → R3d 设置 IA |
| **不要** | 内置 LiteLLM/网关、合并 STT/LLM 协议、批量标点、协作提前插队 |

### R3 规划门禁

- [x] Provider 调研文档（见上）  
- [x] **不引入捆绑网关**；**STT/LLM 分通道**（用户 2026-05-25 确认）  
- [x] 薄片顺序：**R3a → R3b → R3c → R3d**（用户确认）  
- [x] R3a acceptance：[`r3a-llm-keychain-probe-acceptance.md`](../specs/r3a-llm-keychain-probe-acceptance.md)（R3b–d 实施前再补对应 acceptance）

**下一刀**：R3b `profile` 导入导出（无 secret）

---

## 11. 参考文档（非排期真源）

| 文档 | 用途 |
|------|------|
| [`oumi-remediation-report.md`](../specs/oumi-remediation-report.md) | Oumi 调研、能力边界、接口草案；**排期以本文 §4 为准** |
| [`collaboration-foundation-plan.md`](./collaboration-foundation-plan.md) | 协作 Phase 1–7 细节；**顺序以本文 §4–§6 为准** |
| [`p2-acceptance.md`](../p2-acceptance.md) | P2：术语库/热词/低置信/纠错记忆（**后端**）；管理 UI → GLY-1 |
| [`docs/architecture/asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) | 术语如何拼进 ASR `hotwords` |
| [`docs/architecture/postprocess-remote-boundary.md`](../../architecture/postprocess-remote-boundary.md) | R1 定稿：后处理不进 ASR sidecar |
| [`translation-dictionary-module.md`](../specs/translation-dictionary-module.md) | CAT **词典**愿景（≠ 全局 glossary） |
| [`ui-redesign-parallel-dev.md`](../specs/ui-redesign-parallel-dev.md) | UI 纪律与已验收记录 |
| [`architecture-split-plan.md`](../specs/architecture-split-plan.md) | 文件拆分地图（R9 同步） |
| [`docs/architecture/README.md`](../../architecture/README.md) | 架构真源索引 |
| [`docs/adr/README.md`](../../adr/README.md) | ADR 索引 |
| Jieyu [`如是我闻-本地版改进计划书`](../../../../Jieyu/docs/execution/plans/如是我闻-本地版改进计划书-2026-05-11.md) | 跨仓历史计划；冲突以本仓为准 |

---

## 12. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-25 | 初版：合并 UI 验收后、Oumi Part I、协作规划；统一 16 周排期 |
| 2026-05-25 | §13 代码对照：新增 R0；R3 缩至 1.5 周；T-005 升为 R0；验证快照 139+30 tests |
| 2026-05-25 | 补 **GLY-1 术语库管理 UI**（P2 后端已有、UI 未接线；初版路线图遗漏） |
| 2026-05-25 | 完成 R1：补 `auto-punctuate` 三件套与 `postprocess-remote-boundary.md`；下一步切到 R2 |
| 2026-05-25 | R2 实施 + **LLM 配置**页（DeepSeek/Kimi）；**DeepSeek 自动标点手测通过**（用户确认） |
| 2026-05-25 | **GLY-1 术语库管理 UI 手测通过**（用户确认）；§10 入口切至 R3 |
| 2026-05-25 | R3 规划门禁：新增 `r3-provider-configuration-research.md`（LLM/STT Provider 业内调研） |
| 2026-05-25 | R3 门禁关闭：不引入网关 + 分通道 + R3a→d 顺序；补 `r3a-llm-keychain-probe-acceptance.md` |
| 2026-05-25 | R3a 编码完成：LLM keychain + probe；自动化验证全绿，待手测签收 |
| 2026-05-25 | R3a 手测通过：A keychain 持久化、B probe 成功、C probe 失败路径（经 UI 状态修复后）通过；下一刀切 R3b |

---

## 13. 代码对照评估（2026-05-25）

> 本节对照**当前工作区**与路线图假设；与 `origin/main` 差异大时，以工作区为准推进，但 **R0 应先提交**。

### 13.1 工程验证快照（实测）

| 检查项 | 结果 |
|--------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run test`（desktop） | ✅ **139** passed（路线图旧稿写 137，已过时） |
| `node scripts/check-architecture-guard.mjs` | ✅ 0 错误，**2 警告** |
| `cargo test`（desktop lib） | ✅ **30** passed |
| `postprocess` / `profile.rs` / `services/mcp` / `services/collab` | ❌ 不存在 |
| `auto-punctuate-*.md` spec 三件套 | ❌ 不存在 |

**守卫警告（必须处理）**：

- `useProjectLifecycleController.ts`：381 行（阈值 300）
- 同文件：21 个 hook（阈值 12）

### 13.2 与路线图各阶段的符合度

| 阶段 | 代码现状 | 评估 |
|------|----------|------|
| **基线 / UI** | `EditorView` 189 行；`editor/*` 8 文件；`ProjectPanel` 187 行 | ✅ 与文档一致 |
| **R0** | 工作区 ~69 文件改动未提交；lifecycle 超标 | ⚠️ **应先做** |
| **R1–R2** | 无 Rust `postprocess_cmd`；无标点 preview UI | ❌ 未开始，排期有效 |
| **GLY-1** | `GlossaryPage` + 欢迎页入口；手测通过 | ✅ 与 P2 后端 + 热词链路一致 |
| **R3** | `usePrepareModelController`（~166 行）、`EnvLocalAsrPanel` 下载条、`EnvOnlineSttPanel`（129 行）、`EnvironmentPanel` | 🟡 **约 60% UI 已有**；缺首次引导、缓存管理 UI、manifest 校验展示、`profile.rs` |
| **R4** | `correction_memory` 表 + 保存时更新；`eval_metrics.py` + `eval-run.py`；无质量 Tab | 🟡 数据层有，桌面无入口 |
| **R5** | 无 `services/mcp` | ❌ 未开始 |
| **R6–R8** | 无 `ProjectSource` / 协作 API | ❌ 未开始 |
| **R9** | `exportDiagnosticBundle` 已有；长音频手测未自动化 | 🟡 部分 |

### 13.3 Rust / 前端热点（与 oumi §1.3 对齐）

| 文件 | 行数（wc） | 文档记载 | 判定 |
|------|------------|----------|------|
| `useProjectLifecycleController.ts` | 380 | ~267 | ⚠️ **文档偏低**，且超 hook 阈值 |
| `useProjectWaveform.ts` | 299 | 275 | ✅ 临界，第三期可观察 |
| `transcribe.rs` | 305 | ~305 | ✅ 已拆 `transcribe_native_online.rs` |
| `project_bundle_cmd.rs` | 282 | 277 | ✅ |
| `EnvOnlineSttPanel.tsx` | 129 | 349（旧拆分计划） | ✅ 已低于 300，无需拆 |

### 13.4 排期调整摘要（相对初版路线图）

1. **新增 R0（0.5 周）**：提交当前波次 + 清零 lifecycle 守卫警告。  
2. **R3 由 2.5 周 → 1.5 周**：模型下载与在线 STT 配置 UI 已存在，只做产品化差额。  
3. **R1 仍为下一业务入口**：无代码抢跑，spec 三件套门禁不变。  
4. **在线 STT「候选薄片」**：不再单独占阶段，并入 R3 或按需小修。  
5. **插件系统**（`plugin-system/`、示例 export-markdown）：与 MCP/后处理无关，**不纳入** R5；保持现状。

### 13.5 风险（对照后）

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| 大 diff 未提交即开 R1 | 高 | R0 先提交 + 打 tag/分支 |
| 在 lifecycle 上叠 R2 关窗/标点逻辑 | 高 | R0 拆 `useUnsavedGateController` 或等价 |
| 重复建设模型下载 UI | 中 | R3 只做引导/缓存/manifest/profile |
| oumi / split-plan 行数过期 | 低 | R0 末同步 §1.3 |
