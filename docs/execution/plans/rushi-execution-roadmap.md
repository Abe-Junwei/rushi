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
| 最近对照 | 2026-05-25（R0–R2、R3a–b 已落地；R3c/R3 补丁在工作区未提交，见 §13） |

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
| 桌面 profile 导入导出（无 secret） | ✅ R3b | `profile.rs` + 环境页「配置迁移」 |
| 桌面质量 Tab | ❌ 未开始 | eval 仍在 `scripts/eval-run.py` |
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
| **R3** | W5–W8 | 05/26 – 07/04 | EXP-1 模型/配置 + **本机 ASR 可用性** | R3a–c ✅/🟡；**R3f 一键准备**、**R3g 模型目录**、**R3e 长音频**；R3d 设置 IA **后移** | **~3 周**（手测驱动，见 §4.1） |
| **R4** | W9–W10 | 07/07 – 07/18 | QLT-1 质量插槽 | 包装 `eval_metrics`；rubric schema；质量 Tab 只读；correction_memory 导出脱敏 | 1.5 周 |
| **R5** | W11–W12 | 07/21 – 08/01 | AGT-1 MCP 只读 | `services/mcp/`；4 tools + 2 resources；127.0.0.1、默认关 | 2 周 |
| **R6** | W13–W14 | 08/04 – 08/15 | COL-1 协作骨架 | `services/collab/` + Compose + PG 迁移 + 只读 API | 2 周 |
| **R7** | W15–W16 | 08/18 – 08/29 | COL-2 桌面只读 | `ProjectSource`；列表 local/collab；协作项目只读打开 | 1.5 周 |
| **R8** | W17–W18 | 09/01 – 09/12 | COL-3 协作写入 | 单语段写 API + version + revision_events + 409 提示 | 2 周 |
| **R9** | W19 | 09/15 – 09/19 | REL-1 发版验收 | 长音频手测；`p0-acceptance`；E2E 抽检（可选） | 1 周 |

**合计**：约 **18 周**（R3 扩至 ~3 周；至 2026-09 下旬）完成单机增强 + 协作可写最小闭环。

### 4.1 R3 薄片排期（2026-05-25 重排，对照代码现状）

> **依据**：R3a/b 已编码；R3c 在工作区已实现待提交/手测；50min/13min 手测暴露 **安装难（→R3f）**、**分句差（→R3g Paraformer）**、**超时/OOM（→R3e）**。产品决策：**dev/安装包均优先内置侧车**；**Win 终端 v1 仅双 exe**。

| 顺序 | 子项 | 状态 | 预估 | 说明 |
|------|------|------|------|------|
| 0 | **提交波次** | ⏳ | 0.5d | 合入 R3b/c、`profile.rs`、`asr_cache_cmd`、转写 hints/整轨兜底等未提交改动 |
| 1 | **R3c 手测** | 🟡 编码完成 | 0.5d | [`r3c-local-asr-cache-manifest-acceptance.md`](../specs/r3c-local-asr-cache-manifest-acceptance.md) A–D |
| 2 | **R3f-A/B** | ⏳ | 3–5d | 诊断报告 +「一键准备本机 ASR」；[`r3f-asr-setup-wizard-acceptance.md`](../specs/r3f-asr-setup-wizard-acceptance.md) |
| 3 | **R3g-A** | ⏳ | 3–5d | 三模型目录 + 按 model 预下载 + 切换重启侧车；[`r3g-local-asr-model-catalog-acceptance.md`](../specs/r3g-local-asr-model-catalog-acceptance.md) |
| 4 | **R3e-A** | ⏳ | 2–3d | 动态超时 + 失败文案（13min/50min 先可完成拉取） |
| 5 | **R3d** | ⏳ | 2–4d | 设置 IA 三分栏；**不阻塞**转写主路径 |
| 6 | **R3e-B** | ⏳ | 1–1.5w | 分片转写 + 时间轴合并；**R9 REL-1 长音频完整勾选依赖此项** |
| — | R3f-C / R3g-C | 延后 | — | 托管 venv pip、本机 Whisper/FireRed：高级或远期 |

**不建议并行**：同一轮不要同时开 R3f 编排与 R3e-B 分片（都动侧车/转写链）。**可串行共享**：R3g 的 `prepare(model_id)` 与 R3f 一键准备共用侧车 API 改动。

### 阶段状态（实施时更新）

| 阶段 ID | 状态 | 完成日 |
|---------|------|--------|
| R0 | ✅ 已完成 | 2026-05-25 |
| GLY-1 | ✅ 已完成（手测通过） | 2026-05-25 |
| R1 | ✅ 已完成（文档门禁） | 2026-05-25 |
| R2 | ✅ 已完成（DeepSeek 手测通过） | 2026-05-25 |
| R3 | 🟡 进行中（a/b ✅；c 待提交+手测；f/g/e/d 待做） | — |
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

#### R3 薄片子项（状态表）

| 子项 | 主题 | 状态（2026-05-25） |
|------|------|-------------------|
| R3a | LLM keychain + probe | ✅ 已完成 |
| R3b | Profile 导入导出（无 secret） | ✅ 已完成（工作区待提交） |
| R3c | 本机 ASR 引导 / 缓存 / manifest | 🟡 编码完成，待提交 + 手测 |
| **R3f** | 本机 ASR **一键环境准备** | ⏳ 见 [`r3f-asr-setup-wizard-acceptance.md`](../specs/r3f-asr-setup-wizard-acceptance.md) |
| **R3g** | 本机 ASR **模型目录**（FunASR ×3） | ⏳ 见 [`r3g-local-asr-model-catalog-acceptance.md`](../specs/r3g-local-asr-model-catalog-acceptance.md) |
| **R3e** | 长音频转写（超时 / 分段） | ⏳ 见 [`r3e-long-audio-transcribe-acceptance.md`](../specs/r3e-long-audio-transcribe-acceptance.md) |
| R3d | 设置 IA 三分栏 | ⏳ **后移**（R3f/g/e-A 之后） |

**实施顺序真源**：§4.1（非上表行序）。

---

### R3e — 长音频本机转写（手测驱动）

**触发**：开发调试下 **~50min** 音频拉取语段 — 一次 OOM、一次 `error sending request`（`/v1/transcribe`）。根因：桌面 **600s 固定超时** + ASR **整文件 FunASR** 峰值内存过高。

| 子阶段 | 做 | 不做 |
|--------|-----|------|
| **R3e-A** | 按音频时长推导 HTTP/ffmpeg 超时；失败分类文案；环境/转写提示 | 自动分段 |
| **R3e-B** | 分段转写 + 时间轴合并 + 长任务进度（30～60min 主路径） | 侧车断点续传（T-004） |

**验收真源**：[`r3e-long-audio-transcribe-acceptance.md`](../specs/r3e-long-audio-transcribe-acceptance.md)。**R9 REL-1 长音频手测**在 R3e-B 完成前仅可部分勾选。

**建议排期**：**R3e-A** 在 R3f/R3g 之后或紧接（快速止血超时）；**R3e-B** 在 R3 收尾、R4 之前；完整 REL-1 依赖 R3e-B。

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
| 长音频 | 30～60min 中文：转写 → 编辑 → 保存 → 重启 → txt/srt/docx 导出（**依赖 R3e-B**；见 [`r3e-long-audio-transcribe-acceptance.md`](../specs/r3e-long-audio-transcribe-acceptance.md)） |
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
| T-007 | 本机转写 600s 超时 + 整文件 FunASR | **R3e** | 50min 手测 OOM / request failed；见 r3e spec |

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
| **阶段** | **R3 — EXP-1（进行中，见 §4.1）** |
| **规划真源** | §4.1 + [`r3f-asr-setup-wizard-acceptance.md`](../specs/r3f-asr-setup-wizard-acceptance.md) / [`r3g-local-asr-model-catalog-acceptance.md`](../specs/r3g-local-asr-model-catalog-acceptance.md) |
| **建议实施顺序** | 提交波次 → **R3c 手测** → **R3f** → **R3g** → **R3e-A** → R3d → **R3e-B** → R4 |
| **不要** | 内置 LiteLLM/网关、合并 STT/LLM 协议、Win 安装包 v1 pip 装 FunASR、协作提前插队 |

### R3 规划门禁

- [x] Provider 调研文档（见上）  
- [x] **不引入捆绑网关**；**STT/LLM 分通道**  
- [x] **内置侧车优先**（dev + 安装包）；Win 终端 **仅双 exe**（2026-05-25 确认）  
- [x] R3a/b acceptance 已签收；R3c/f/g/e acceptance 已起草  

**下一刀**：**提交 R3 工作区改动** → **R3c 手测** → **R3f-A**（诊断契约）

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
| 2026-05-25 | R3b 编码完成：profile 导入导出（LLM + 在线 STT，无 secret）；自动化验证全绿，待手测签收 |
| 2026-05-25 | R3b 手测通过：导出 / 导入 / 拒绝 secret 场景通过；入口调整为环境页左侧「配置迁移」，下一刀切 R3c |
| 2026-05-25 | R3c 编码完成：本机 ASR 首次引导 + 缓存目录/占用/清理 + manifest 展示；自动化验证全绿，待手测签收 |
| 2026-05-25 | 手测 50min 音频：OOM + transcribe request failed；新增 **R3e** spec 与路线图（超时/分段，对齐 R9 长音频） |
| 2026-05-25 | 手测 13min：SenseVoice 无分句 → 整轨兜底 + transcribeHints 横幅（工作区，非 spec 薄片） |
| 2026-05-25 | 产品决策：dev/安装包 **内置侧车优先**；Win **仅双 exe**；新增 **R3f** spec |
| 2026-05-25 | **§4.1 R3 重排**：R3f → R3g → R3e-A → R3d → R3e-B；新增 [`r3g-local-asr-model-catalog-acceptance.md`](../specs/r3g-local-asr-model-catalog-acceptance.md)；总周次 ~18 周 |

---

## 13. 代码对照评估（2026-05-25，R3 重排后）

> 对照**当前工作区**（`main` 相对 `origin/main` 仍有 R3b/c 等未提交文件）。R0–R2、R3a/b 已在 `main` 历史提交中；下文「工作区增量」指 `git status` 未提交部分。

### 13.1 工程验证快照（实测）

| 检查项 | 结果 |
|--------|------|
| `npm run typecheck` | ✅ 通过（含工作区改动） |
| `npm run test`（desktop） | ✅ **139+** passed |
| `node scripts/check-architecture-guard.mjs` | ✅ 0 错误，**2 警告**（lifecycle，见 R0 债务） |
| `cargo test`（desktop lib） | ✅ **30** passed |
| `postprocess` / 自动标点 UI | ✅ R2 已合入 `main` |
| `profile.rs` / R3c 缓存命令 | 🟡 **工作区有**，待提交 |
| `asr_setup` / 模型下拉 / `prepare(model_id)` | ❌ R3f/g 未开始 |
| `services/mcp` / `services/collab` | ❌ 未开始 |

**工作区增量（待提交，与 R3 相关）**：

- `profile.rs`、`EnvProfileActions`、`asr_cache_cmd.rs`、`envLocalAsr/*`
- `TranscribeHintsBanner`、`asrTranscribeHints` 扩展、`funasr_engine` 整轨兜底
- specs：`r3b`/`r3c`/`r3e`/`r3f`；**`r3g` 仅 spec**

### 13.2 与路线图各阶段的符合度

| 阶段 | 代码现状 | 评估 |
|------|----------|------|
| **R0–R2** | 已提交；lifecycle 仍 381 行 / 21 hooks | 🟡 守卫警告未清，不阻塞 R3 但应在 R3 提交前或 R3e-B 前拆 |
| **R3a–b** | keychain/probe；profile 导入导出 | ✅ |
| **R3c** | `LocalAsrGuidanceSection`、`LocalAsrCacheSection`、缓存清理 | 🟡 待提交 + 手测 |
| **R3f** | 仍依赖「选仓库 + bash」、`funasrManualSetupCommands` | ❌ 与产品决策不符，待做 |
| **R3g** | 仅 `RUSHI_FUNASR_MODEL` 环境变量；默认 SenseVoice | ❌ 无 UI 目录；侧车 `prepare-default` 写死默认 id |
| **R3e** | 桌面 transcribe **600s** 固定；ASR 整文件推理 | ❌ 手测已复现；spec 已有 |
| **转写体验补丁** | hints 横幅、零语段/整轨提示 | 🟡 工作区有，非 spec 薄片 |
| **R4–R8** | 无质量 Tab / MCP / collab | ❌ 未开始 |
| **R9** | 诊断包有；长音频 REL 依赖 R3e-B | 🟡 |

### 13.3 Rust / 前端热点（与 oumi §1.3 对齐）

| 文件 | 行数（wc） | 文档记载 | 判定 |
|------|------------|----------|------|
| `useProjectLifecycleController.ts` | 380 | ~267 | ⚠️ **文档偏低**，且超 hook 阈值 |
| `useProjectWaveform.ts` | 299 | 275 | ✅ 临界，第三期可观察 |
| `transcribe.rs` | 305 | ~305 | ✅ 已拆 `transcribe_native_online.rs` |
| `project_bundle_cmd.rs` | 282 | 277 | ✅ |
| `EnvOnlineSttPanel.tsx` | 129 | 349（旧拆分计划） | ✅ 已低于 300，无需拆 |

### 13.4 排期调整摘要（2026-05-25 第二版）

1. **R3 由 ~1.5 周扩至 ~3 周**：手测暴露安装链、模型单一、长音频三条线，拆 **R3f / R3g / R3e**，**R3d 后移**。  
2. **R3 实施顺序**：提交 → c 手测 → **f → g → e-A** → d → **e-B**（§4.1）。  
3. **R4–R9 日历整体后滑 ~2 周**（§4 表 W9 起）。  
4. **R3g v1**：仅 FunASR 三 SKU；Whisper/FireRed 不进安装包主路径。  
5. **整轨兜底**为过渡，**不替代** R3g Paraformer + R3e 分片。

### 13.5 风险（对照后）

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| R3 大 diff 长期未提交 | 高 | 排期第 0 步：合入 R3b/c + 转写补丁 |
| 用户仍卡在「选仓库装 FunASR」 | 高 | **R3f** 一键准备 |
| SenseVoice 默认 → 整轨长语段 | 中 | **R3g** 推荐 Paraformer 长音频 |
| 长音频 OOM / 600s 超时 | 高 | **R3e-A/B** |
| 多模型超 5GB | 中 | R3c 占用 + 清理 + 目录标注 |
| lifecycle 守卫 | 中 | R3 提交轮或 R3e-B 前拆分 |
