# Rushi 统一执行路线图（2026-05-25 起）

> **本文件为 Rushi 仓后续工作的排期真源。**  
> 与 Jieyu 平级计划书冲突时：以 **本仓代码 + ADR + 本文** 为准。  
> 深度背景见文末「参考文档」；**R3 本机 ASR 发行整改**以 [`rushi-local-runtime-catalog-remediation-plan.md`](../specs/rushi-local-runtime-catalog-remediation-plan.md)（**v1.2**）为实施真源，本文 §4.1 / §5 R3h 为排期索引。

| 元数据 | 值 |
|--------|-----|
| 基线日期 | 2026-05-25 |
| 适用节奏 | 单人、每轮 2～4h、一轮一纵向薄片 |
| 规划跨度 | **个人单机 v1**：约 **11～13 周（自当前）** 或 **15～17 周（自 W1）**；R3 薄片 **~8～10w**（§4.0）；协作 **非 v1** |
| 修订 | 每完成一个阶段更新 §2 状态表、§4 排期表与 §13 代码对照 |
| 最近对照 | **2026-05-30**：R3t-A/B/C ✅；§10 下一刀 **R3e-B / R3t-D** |

### 状态标记约定（全文档统一）

| 标记 | 含义 |
|------|------|
| **✅** | 已合入可复现基线（`main` 或等价）且验证通过 |
| **🟡 编码✅** | 工作区/分支已编码，自动化通过，**发行门禁或手测未全绿** |
| **🟡 进行中** | 部分交付或依赖未闭合 |
| **📋** | 规划定稿，未编码 |
| **⏳** | 已排期、未开始 |

> 路线图 §13 与 remediation §11 须区分 **编码签收** 与 **发行门禁**；勿将工作区草稿标为 ✅。

---

## 1. 规划原则

1. **UI 根部已验收**：新能力必须带 UI 落点、状态模型与手测路径（[`ui-redesign-parallel-dev.md`](../specs/ui-redesign-parallel-dev.md) 已收口）；不再开「纯换皮」轮次。
2. **能力—UI 状态对齐**：任何后端/侧车/Tauri 新能力必须在 acceptance 中填写 **能力—UI 状态矩阵**，并遵守 [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)；**禁止**用全局 `/health` 字段表示「用户所选维度」的状态（R3g-A 教训，见 §4.1.4）。
3. **一轮一薄片**：每轮只做一个可验收主题；轮末硬闸门 + 至少 1 条主路径手测 + 3 行日志。
4. **信任边界**：LLM 后处理、MCP **不进** ASR PyInstaller 侧车；密钥不进 repo。
5. **本地真源优先**：SQLite 离线能力不降级；**个人单机 v1** 不以协作服务端为项目真源（§1.6）。
6. **中等复杂度先 spec**：编码前完成 intent / plan / acceptance（模板见 [`spec-template.md`](../specs/spec-template.md)）；含 **§能力—UI 状态矩阵** 时方可开 UI 编码。
7. **转写优先（2026-05-27）**：近期排期以 **本机 ASR + 录音转写 + 分段落库（R3g / R3e / R3t）+ 精度/STT 统一（R3g-C / ACC）** 为主；**CAT-TRAN、LEX-MINE、ASR-FT、RAG 校对** 仅 §8.1 远期或 §8 不做，**不得**占用当前薄片 unless 产品书面改序。
8. **LLM 可插拔**：转写与手改 **不依赖** LLM；R3t-C/D/E 与 R2 标点均为 **用户显式触发 + 预览确认**（§1.7、§8.2 Q-LLM-1）。

### 1.6 产品定位：个人单机 v1（2026-05-27）

> **能力补齐真源**：[`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md)

| 项 | 内容 |
|----|------|
| **用户** | 个人、一台电脑、离线优先；自己负责定稿 |
| **真源** | 本机 **SQLite**；无协作真源、无云项目同步 v1 |
| **主路径** | 装 ASR → 转写 → **手改（可无 LLM）** →（可选）云端 LLM 校对 → **EXP-WORD** 交付 |
| **v1 后** | 本机 LLM：**LLM-LOC-SPIKE + Gate**（[`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md) §9）；**过 Gate 才 4a/4b** |
| **v1 发版** | **R9（REL-1）** 以 §1.8 P0 + R4-GATE 为准；**不依赖** R6–R8 |
| **非目标** | 企业采购、多语言/CAT、商业化、协作审阅（C4–C7）、转写 farm、实时 mic |

**§4 默认顺序**：`R0 → GLY-1 → R1–R2 → R3（§4.1.1）→ R4 → R9`；**R5 / R6–R8** 标为 **v1 后或非阻塞**（§8.2 Q-POS-2）。

### 1.7 产品决策台账（2026-05-27 对话拍板）

> 与 [`recording-transcribe-llm-refine-plan.md`](../specs/recording-transcribe-llm-refine-plan.md) §9–10、各 backlog 一致；**冲突以本文 + 代码为准**。

#### 转写与 LLM 管线（R3t）

| 决策 | 内容 |
|------|------|
| **主路径** | **ASR 先产出带时间的 stable 语段** → 用户显式触发 LLM 校准 → 预览确认写回；**不做**「全轨纯文本 → LLM 切段 → 再贴时间」 |
| **Q1** | 转写 **覆盖** 语段；非空时 **确认对话框** |
| **Q2** | 长音频 **侧车内循环** 出完整 `segments[]` 优先；超长再评估 HTTP 分片 |
| **Q3** | LLM 段界支持 **连续多段**；不跨文件 |
| **Q4** | SenseVoice **VAD 段级** 即可；不强制句级 |
| **Q5** | v1 可选 **`edit_log`**；不等 R8 `revision_events` |
| **流式/mic** | **STREAM-***：在 **R3t-D/E 签收后** 另立项，不在 R3t v1 |
| **R3t 子阶段顺序** | **A → B → C → D → E**（见 §4.1.1、§4.1.6） |

#### 词表、热词与学习（非训练）

| 决策 | 内容 |
|------|------|
| **术语真源** | **仅一套** 全局 `glossary_terms` |
| **L2 ASR** | 拼 **空格串 `hotwords`**（≤12k 字符；见 [`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md)） |
| **L4 LLM（R3t-E）** | **LexiconPack**（`glossary_canonical[]` + `correction_rules[]`）；**不传** ASR `hotwords` 字符串 |
| **纠错记忆** | 保存语段学习 `correction_memory`；转写后 **hints**；R3t-E **主动改正** + evidence |
| **越用越准** | **记忆 + 热词 +（规划）R3t-E**；**不**指望权重自动更新 |
| **FunASR 固有参数** | **用户不填** `use_itn` / `merge_vad` 等；由 **R3g-C Profile** 按 SKU+时长默认；仅 **模型、语言、术语表** 为用户控件（env 排障 override 另论） |
| **本地 + 在线 STT** | **编排已统一**（`project_run_transcribe` → `TranscriptionResult` v1）；**词表偏置** 经 **ACC-STT-UNIFY** 分 adapter 映射（非同一 `hotword=` 字段） |
| **同音/误写（如智控→制控）** | L2 热词 **偏置有限**；L4 **correction_memory + R3t-E**；**术语表只放正确 canonical**（见 **Q-ACC-5**） |
| **RAG** | **当前不做** |
| **Oumi 式动模型** | **当前不做**；远期 **ASR-FT**（FunASR 微调 + R3h 发版），见 [`lexicon-mining-backlog.md`](../specs/lexicon-mining-backlog.md) §7、[`oumi-remediation-report.md`](../specs/oumi-remediation-report.md) §五-b |

#### 明确不做 / 远期（当前不占排期）

| 项 | 处置 |
|----|------|
| **CAT-TRAN**（翻译+富结构词典） | **远期**；spec 保留；**当前不做**（[`translation-cat-backlog.md`](../specs/translation-cat-backlog.md)） |
| **LEX-MINE**（纠错推荐进 glossary） | §8.1 候选 |
| **ASR-FT**（领域微调） | §8.1 候选；Go 门槛未满足 |
| **领域 RAG 校对** | §8 不做 |
| **correction_memory → 训练集** | §8 不做（schema 不足） |
| **协作 C6 Word** | **远期**；多人批注真源；**不等**单机 EXP-WORD |

#### R2 与 R3t-C 关系

- **R2 `auto_punctuate` ✅** 保留；**R3t-C** 为其超集（可选邻段上下文），**不废弃** R2 命令与 UI。

### 1.8 个人单机 v1 — 能力补齐索引（对齐工业「可用单机」）

> 与 §1.6 一致；子 Epic 说明见 [`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md)。

| 优先级 | 能力 | 路线图落点 |
|--------|------|------------|
| **P0** | 发行可重复（装/验/恢复） | R3h-0～3、R3f、**R3-STATE** |
| **P0** | 长音频多段真源 | R3t-A/B、R3e-A/B |
| **P0** | 术语 + memory + LLM 校对 | HOT-UX、**R3g-C**、**ACC-STT-UNIFY**、R3t-C/D/E |
| **P0** | FunASR 官方参数接线（Profile） | **R3g-C**（侧车；不暴露全参数 UI） |
| **P0** | 术语表本地/在线一致偏置 | **ACC-STT-UNIFY**（`SttVocabularyPlan` + adapter） |
| **P0** | 交付 Word 与编辑一致 | EXP-WORD（P3 基线之上） |
| **P1** | 侧车保活、少冷启动 | **ASR-WARM**（R3h-I4） |
| **P1** | 转写失败可理解 | R3e 分类 + **TRN-DIAG** |
| **P1** | 发版 eval 回归 + 专名样例 | **ACC-EVAL-1**（R3g-C 合入门禁）、**R4** + **R4-GATE**（R9 硬门禁） |
| **P1** | Setup / 发布 / Supervisor 硬化 | **R3h-I1～I3** |
| **P1** | 发版自动化子集 | **TEST-AUTO**（corrupt / 长音频慢测 / FSM contract；R9 硬门禁） |
| **P1** | 单机修订时间线 | **REV-LOC**（v1 纳入；见 **Q-POS-4**、**Q-R9-1**） |
| **P2** | MCP 只读 | R5（v1 后可做） |

---

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
| P3 DOCX（逐字稿/讲稿） | ✅ 基线 | `export_docx.rs`；**非** R3t 后交付版式；**EXP-WORD** 规划见 §4.1.1 |
| 架构拆分（主项） | ✅ | `project/` 模块、`EditorView`→`editor/*`、uid 语段、草稿 store、波形按 uid diff |
| UI 重设计首轮 | ✅ | A 欢迎/建项 + B 校对工作页 + Tauri 手测（2026-05-25） |
| 关窗 / 未保存 | ✅ | `allow-destroy` + 应用内对话框 |
| WASM 波形 | ✅ 移除 | WaveSurfer 为真源 |
| 协作决策 | ✅ | ADR-0001 / ADR-0002、存储与 API 草案 |
| Oumi 报告 Part I | ✅ 已评审 | 能力边界与「不做」清单 |
| 语段 uid / 草稿 / 波形同步 | ✅ 已实现 | 见 §13.1 |
| 校对工作台波形 UX polish | ✅ 基线 | minimap 56px、layoutIntent 缩放栏、语段 tap seek、segment 策略（2026-05-30，`00e9a9d` 等）；非 R3t 薄片 |
| 关窗守卫 + 未保存对话框 | ✅ 已实现 | `appWindowCloseGuard` + `allow-destroy` |
| 在线 STT 环境 UI | ✅ 主体已有 | `EnvOnlineSttPanel` + 合约测试；非从零建设 |
| FunASR 模型下载 UI | ✅ 主体已有 | `usePrepareModelController` + `EnvLocalAsrPanel` |
| 本机 ASR 一键诊断/准备（R3f） | 🟡 编码✅ | `asr_setup/` + `LocalAsrSetupWizard` 已合入 `main`；**手测签收依赖 R3h-0**（§4.1.1 ③） |
| **本地运行时目录 LRC（R3h）** | 🟡 进行中 | R3h-0 🟡；R3h-1 **编码✅ / 发行门禁⏳**；`local_runtime/` 模块树已合入；见 §13.1 |
| 诊断包导出入口 | ✅ 已有 | 工具栏菜单；R9 + TRN-DIAG 增强 |
| LLM 后处理（R2 标点） | ✅ 已交付 | `postprocess_cmd`；**R3t-C/D/E 未编码** |
| MCP / 协作服务 | ❌ 未开始 | 无 `services/mcp`、`services/collab` |
| 桌面 profile 导入导出（无 secret） | ✅ R3b | `profile.rs` + 环境页「配置迁移」 |
| 桌面质量 Tab | ❌ 未开始 | eval 仍在 `scripts/eval-run.py` |
| **术语库（glossary）后端** | ✅ 已有 | `glossary_terms` + `glossary_*` 命令 + 转写 `hotwords` 注入 |
| **术语库管理 UI** | ✅ 独立页 | `GlossaryPage` + 欢迎页侧栏「术语管理」；`useGlossaryController` 已接线 |

---

## 3. 统一阶段总览

### 3.1 个人单机 v1（**默认真源**，§1.6）

```text
[已完成] 基线 + UI + 波形/uid/关窗 + GLY-1 + R1–R2
    ↓
R3     本机 ASR 发行 + 转写 + 精度/STT 统一 + LLM 校准 + 交付（§4.1.1 唯一顺序）
       └ R3h LRC · R3g-C · ACC-STT-UNIFY · R3t · HOT-UX · EXP-WORD · ASR-WARM · TRN-DIAG · **REV-LOC**
    ↓
R4     质量 Tab + R4-GATE（R9 硬门禁）
    ↓
R9     个人单机发版验收（REL-1）
    ↓
[v1 后]  LLM-LOC  Spike → Gate →（可选）4a →（可选）4b  ← §6；**Q-LLM-5 未过 Gate 不编码**
    ↓
[v1 后 / 非阻塞]  R5 MCP 只读
[v1 后 / 远期]    R6–R8 协作 C1–C3 · C4–C7
```

**默认战略顺序**：**§4.1.1 严格串行**至 **EXP-WORD** → **R4** → **R9**；**不**为协作阻塞 v1。  
协作仅在有书面需求时走 §9 分叉 B。

### 3.2 全量阶段（含 v1 后，日历见 §4 表）

```text
R0 → GLY-1 → R1–R2 → R3 → R4 → [R5] → [R6–R8] → R9
```

> §4 周次表保留 R5–R8 作 **参考估算**；**个人 v1 以 §3.1 为准**，R9 可在 R4 后直接签收（约 **15～17 周**）。
---

## 4. 排期表（单人、日历周）

> 周次以 **2026-05-26（周一）** 为第 1 周起点估算；按实际完成滑动，**不并行开两个大阶段**。  
> **个人 v1 只看下表「v1 路径」行**；R5–R8 见 §6。

### 4.0 个人单机 v1 路径（排期真源）

| 阶段 ID | 周次（约） | 主题 | 预估 |
|---------|------------|------|------|
| R0、GLY-1、R1、R2 | W1–W3 | ✅ 已完成 | — |
| **R3** | W4–W12+ | 本机 ASR + 转写 + LLM + 交付；**细序 §4.1.1** | **~8～10w**（原 4～5w 低估薄片总和） |
| **R4** + **R4-GATE** | +1.5w | 质量 Tab + eval 回归门禁 | 1.5w |
| **R9** | +1w | 个人单机 REL-1 | 1w |

**说明**：R3 宏观行原写 4～5w，但 §4.1.1 薄片相加明显更长；**以 §4.1.1 推进为准**，日历周次随完成滑动。  
**v1 后（不占 v1 阻塞）**：R5 MCP、R6–R8 协作、LLM-LOC Spike→Gate。

### 4.0.1 全量参考表（含已完成与 v1 后）

| 阶段 ID | 状态 | 主题 | 预估 |
|---------|------|------|------|
| R0 / GLY-1 / R1 / R2 | ✅ | 工程收口、术语 UI、LLM 标点规格与实现 | — |
| **R3** | 🟡 | §4.1.1 全线 | ~8～10w |
| **R4** | ⏳ | QLT-1 + R4-GATE | 1.5w |
| **R9** | ⏳ | REL-1 个人 v1 | 1w |
| R5 | v1 后 | MCP 只读 | 2w |
| R6–R8 | v1 后 | 协作 C1–C3 | ~5.5w |

### 4.1 R3 薄片排期（2026-05-26 重排 — **唯一顺序真源**）

> **产品目标**：发行用户 **零必需命令行** — 应用内完成本机 ASR 的诊断、引导、下载、安装、测试、排错（见 [remediation plan](../specs/rushi-local-runtime-catalog-remediation-plan.md) §1.1）。  
> **架构真源**：**Local Runtime Catalog（LRC）** — 运行时（侧车）与权重（模型）分离；manifest + 应用数据安装；与引擎无关（FunASR 侧车 v1，Sherpa 为 Phase 3.5 门控）。  
> **依据**：R3a–c ✅；手测暴露 **安装难（R3h）**、**分句差（R3g）**、**超时/OOM（R3e）**；审查报告已吸收至 remediation **v1.1**。
> **结构收口**：补入 **`R3h-I` 工业成熟度对齐轨**，专门收口 `Runtime Supervisor`、签名/回滚型 release system、`ASR setup` 状态机三条结构线；**不改** §4.1.1 的发行止血主顺序。

#### 4.1.0 里程碑分期（阅读用，与 §4.1.1 逐步对应）

| 期 | 目标 | 包含薄片 |
|----|------|----------|
| **A 能装能转** | 零终端侧车 + 13min 多段 | ①–⑤c、HOT-UX |
| *脚注* | *「能转」* | *≤~10min 单次整轨为 **R3e-A** 止血目标；>10min 完整多段能力见 **B 期 R3e-B + R3t-A** |
| **B 转写真源** | 声学分段 + 编排 + 精度/STT 统一 + 可观测 | ⑤′ R3t-A/B、**⑤g R3g-C**、**⑤h ACC-STT-UNIFY**、TRN-DIAG、⑥ R3e-B |
| **C 发行成熟** | 弱网/回滚/三盏灯/可选 Spike | ⑦ R3h-2、⑦½ ASR-WARM、⑧ R3h-3、⑧½ R3h-3.5 |
| **D 可选 LLM** | 云端校对可插拔 + 交付 | ⑤″ R3t-C/D/E |
| **E 交付与质量** | Word + eval + 发版 | ⑤‴ EXP-WORD、⑤‴½ **REV-LOC**（v1 P1）、R4、R9 |

#### 4.1.1 实施顺序（严格串行，勿跳步）

> **2026-05-27 重排（Q-SEQ-1）**：**R3e-B 前移至 R3t-B 之后**（长音频在 LLM 块之前）；**HOT-UX 写入主序**（原仅在台账）。内核仍与 R3t-A 合并（Q-R3t-1）。

```text
[R3a–c 已完成]
    ↓
【A 能装能转】
① R3h-0   构建 smoke + Win 磁盘 + pip 主 UI 降级
    ↓
② R3h-1   local_runtime + manifest 下载 + app_data 侧车     ← ✅ 已收口
    ↓
③ R3f     一键准备手测签收
    ↓
④ R3e-A   长音频超时止血（**非**多段验收；50min 只验超时/文案，见 Q-R3e-1）
    ↓
⑤ R3g-A   模型目录（SenseVoice + Paraformer）  ✅ 2026-05-27
    ├ ⑤a 后端 ✅
    ├ ⑤b UI 状态对齐 + S3 ✅
    └ ⑤c Paraformer 13min 多语段 ✅
    ↓
⑤½ HOT-UX  热词 12k 截断可观测  ✅ 2026-05-27
    ↓
【B 转写真源】
⑤′a R3t-A   声学分段 ASR（与 R3e-B 同一分段内核）  ✅ 2026-05-30
    ↓
⑤g R3g-C    FunASR Generate Profile（`use_itn`、降级、识别语言 UI；用户不填 generate 参数）
    ↓
⑤h ACC-STT-UNIFY  术语表 → 本机+在线 VocabularyAdapter；hints 能力矩阵
    ↓
⑤′b R3t-B   转写编排、原子写库、warnings；不自动 LLM
    ↓
⑤′½ TRN-DIAG  转写任务时间线 + 诊断包
    ↓
⑥ R3e-B   长音频进度/分片（若 R3t-A 已覆盖内核则减量）  ← 自原⑨前移
    ↓
【C 发行成熟】
⑦ R3h-2   断点续传 + 侧车升级回滚
    ↓
⑦½ ASR-WARM  侧车保活（R3h-I4）
    ↓
⑧ R3h-3   三盏灯就绪页（含 R3d IA）
    ↓
⑧½ R3h-3.5 Sherpa Spike（不阻塞签收 A–B）
    ↓
【D 可选 LLM — 可跳过，手改即可交付】
⑤″ R3t-C → R3t-D → R3t-E  用户显式触发 · 预览写回
    ↓
【E 交付与质量】
⑤‴ EXP-WORD
    ↓
⑤‴½ REV-LOC（v1 P1；Q-POS-4）
    ↓
R4 + R4-GATE → R9
```

#### 4.1.2 子项台账

| 序 | ID | 状态 | 预估 | 交付摘要 | 规格真源 |
|----|-----|------|------|----------|----------|
| — | R3a/b/c | ✅ | — | keychain、profile、缓存/manifest | 各 acceptance |
| **①** | **R3h-0** | 🟡 | 2–3d | 构建脚本 / smoke / `sidecarIntegrity` / Win `disk_free_bytes` 已有工作区实现；待跨平台构建 smoke 与 Windows 手测 | [remediation §5 Phase 0](../specs/rushi-local-runtime-catalog-remediation-plan.md) |
| **②** | **R3h-1** | 🟡 **编码✅** / **发行⏳** | 5–7d | 编码：`local_runtime/`、signed manifest、pinned key、**install 事务回滚**、**手动恢复 previous**。**非**自动升级健康回滚（→ R3h-2/I2）。发行门禁 remediation **§11** 未全绿 | remediation §5 Phase 1 + §11、§3.7、路线图 §4.1.5.1 |
| **③** | **R3f** | 🟡 | 2–3d | 诊断 + 一键准备 + 8741 冲突；已接入 R3h-1 最小闭环，**须在 ①② 发行级补齐后手测** | [`r3f-asr-setup-wizard-acceptance.md`](../specs/r3f-asr-setup-wizard-acceptance.md) |
| **④** | **R3e-A** | 🟡 | 2–3d | 动态超时 + 失败分类（已编码；50min 手测待签收） | [`r3e-long-audio-transcribe-acceptance.md`](../specs/r3e-long-audio-transcribe-acceptance.md) |
| **⑤** | **R3g-A** | ✅ | 3–5d | 双 SKU + `prepare(model_id)`；**⑤a–c** 手测签收（2026-05-27） | [`r3g-local-asr-model-catalog-acceptance.md`](../specs/r3g-local-asr-model-catalog-acceptance.md) |
| **⑤½** | **HOT-UX** | ✅ | 0.5w | 热词 12k 截断可观测；术语页「本次转写将携带」摘要 | [`hot-ux-acceptance.md`](../specs/hot-ux-acceptance.md) |
| **⑤′a** | **R3t-A** | ✅ | 3–5d | `segmentation.py` + FunASR 接线 + 单测 + **手测签收**（2026-05-30） | [`recording-transcribe-llm-refine-acceptance.md`](../specs/recording-transcribe-llm-refine-acceptance.md) §R3t-A |
| **⑤g** | **R3g-C** | 📋 | 3–5d | **AsrModelProfile**；SenseVoice `use_itn` + postprocess；Paraformer 保持 punc 路径；TypeError 剥参 + warnings；环境页 **识别语言**；**不**暴露全 generate UI | [`r3g-c-asr-generate-profile-acceptance.md`](../specs/r3g-c-asr-generate-profile-acceptance.md)（待立项）；架构 [`asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md)（待立项） |
| **⑤h** | **ACC-STT-UNIFY** | 📋 | 2–4d | **`SttVocabularyPlan`**；**v1 必接** OpenAI prompt（已有）+ AssemblyAI `keyterms_prompt` + Deepgram keywords；U2 能力矩阵；**U3→R3h-3**；**U4 延后**；Azure/百炼 → §8.1 | [`acc-stt-unify-acceptance.md`](../specs/acc-stt-unify-acceptance.md)（待立项）；[`stt-online-providers.md`](../../architecture/stt-online-providers.md) |
| **⑤′b** | **R3t-B** | ✅ | 2–4d | 转写任务、超时、原子写库、warnings UI；**不自动 LLM** | 同上 §3；[`r3t-b-hand-test-checklist.md`](../specs/r3t-b-hand-test-checklist.md) 2026-05-30 签收 |
| **⑤′½** | **TRN-DIAG** | 📋 | 0.5w | 转写阶段时间线；失败阶段 + 建议动作；并入诊断包 | [`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md) §3.2 |
| **⑥** | **R3e-B** | ✅ | 1.5–2w | 长音频侧车 5min 窗；**2026-05-30 签收** | [`r3e-b-hand-test-checklist.md`](../specs/r3e-b-hand-test-checklist.md) |
| **⑦** | **R3h-2** | ⏳ | ~1w | Range 续传；事件化下载进度；GC；**C 类自动升级回滚**；缺/坏侧车自动下载 | remediation §5 Phase 2 |
| **⑦½** | **ASR-WARM** | 📋 | 0.5–1w | 侧车保活、模型预热；**R3h-I4** | personal-solo §3.1 |
| **⑧** | **R3h-3** + **R3d** | ⏳ | 3–5d | 本机 ASR / 在线 STT / LLM 三盏灯；五栏 IA | remediation §5 Phase 3 + [`r3d-settings-ia-acceptance.md`](../specs/r3d-settings-ia-acceptance.md) |
| **⑧½** | **R3h-3.5** | ⏳ | ~1w | Sherpa-ONNX CER Spike；不阻塞 A–B 签收 | remediation §5 Phase 3.5 |
| **⑤″c** | **R3t-C** | ✅ | 1–1.5w | 扩展 R2 标点（邻段上下文可选）；**可选/显式触发** | 同上 §4；[`r3t-c-hand-test-checklist.md`](../specs/r3t-c-hand-test-checklist.md) 2026-05-30 签收 |
| **⑤″d** | **R3t-D** | 📋 | 1.5–2w | merge/split/update_text ops + 预览 | 同上 §5 |
| **⑤″e** | **R3t-E** | 📋 | 1.5–2w | LexiconPack 有据校对；**无 RAG**；**无** R3t-E3 项目级词表 v1 | [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md) |
| **⑤‴** | **EXP-WORD** | 📋 | 1–1.5w | L6 交付：导出真源对齐；逐字稿/讲稿/干净稿版式；可选修订摘要附录；**不等 C6** | [`word-formatted-export-backlog.md`](../specs/word-formatted-export-backlog.md) |
| **⑤‴½** | **REV-LOC** | 📋 | 0.5–1w | 单机 `edit_log` 时间线；**v1 P1 必做**；恢复点可减 scope；**非** R8 协作 revision | [`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md) §3.3 |
| — | **R3t（索引）** | 📋 | — | Epic 总览（含 L6） | [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) |
| — | R3h-4 → **LLM-LOC** | v1 后 | 见 §6、[`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md)（**4a** Ollama ~0.5–1w；**4b** 自管 2–3w+） | remediation §Phase 4 |
| — | R3h-E/F、R3g-B | 延后 | — | 高级 pip/本地构建；Nano 等多 SKU | remediation §5 Phase 5 |

#### 4.1.3 并行与禁忌

| 规则 | 说明 |
|------|------|
| **勿并行** | R3f 编排与 **R3e-B** 分片（同改转写链）；**R3t-A/B** 与 R3f **大改**勿同轮 |
| **R3g-C 门禁** | **R3g-C PR-1（Profile 内核）须先于 R3t-B** 合入，避免 `funasr_engine.py` 冲突；R3g-C 与 R3t-B **勿同轮大改**侧车+编排 |
| **ACC-STT-UNIFY** | 可与 **R3g-C2 之后** 并行（主改 Tauri `run_transcribe` / `stt_native`）；**须**在 R3t-B warnings UI 前或同轮接入 vocabulary hints |
| **R3t 门禁** | **R3g ⑤c** 建议先签收再开 **R3t-A** 编码；R3e-B 与 R3t-A **同一分段真源**（禁止 fork 两套 VAD） |
| **LLM 校准** | R3t-C/D/E **须用户显式触发**；禁止转写完成静默跑 |
| **可并行设计** | R3e-A 与 R3g-A 接口；实施仍 **④ 先于 ⑤** |
| **R3h-I 设计** | 可在 **② 后**并行做只读方案与接口草图；避免和 **①–③** 的止血实现混在同一刀 |
| **R3h-I 实施** | 建议在 **⑥–⑦** 之间或之后集中收口；不单独改写 §4.1.1 的产品签收顺序 |
| **勿跳步** | **R3f 手测不得在 R3h-0 前签收**（否则 corrupt 包误判） |
| **R9 依赖** | 零终端 ASR：**②+③**；多段转写：**⑤′+⑤c**；长音频完整：**⑥ R3e-B**；**Profile/ITN：⑤g R3g-C**；**本地+在线词表：⑤h**；交付：**⑤‴**；质量：**R4-GATE** + **TEST-AUTO** + **ACC-EVAL-1** |

#### 4.1.4 能力—UI 状态对齐闸门（R3-STATE，横切 R3）

> **背景**：R3g-A 先交付 API/下拉，未同步验收「同一面板多控件是否同一状态维度」，导致 Paraformer 已选但下载区仍显示 SenseVoice 就绪、侧车报告不一致。**此后 R3 各切片 UI 编码前必须通过本闸门。**

| 步骤 | 门禁 | 未过后果 |
|------|------|----------|
| **S1 Spec** | acceptance 含 **能力—UI 状态矩阵**（[`spec-template.md`](../specs/spec-template.md)） | 不得开 UI PR |
| **S2 派生** | 多 SKU / 多进程场景用纯函数派生（如 `buildLocalAsrCatalogView`），禁止组件直读全局 `ready_for_transcribe` 表示「所选」 | 不得合并 |
| **S3 手测** | 至少 2 组矛盾场景（见 architecture §5）截图无互斥文案 | 不得签收该切片 |
| **S4 测试** | focused test 覆盖 mismatch（如 `selectedModelPrepareState`） | 不得宣称完成 |

**R3g-A ⑤b**：P1 顶栏/环境页/一键准备模型步 **已编码**（`computeLocalAsrTranscribeReady` 等）；**S3 手测** 仍阻塞 ⑤c。`LocalAsrGuidanceSection` **未接线**（死代码，可删或 R3d 再接）。见 architecture §4。

**与 R3h-I3 关系**：R3-STATE 是 **每切片交付纪律**；R3h-I3 Setup Machine 是 **一键准备状态机** 的长期收口，不替代 S1–S4。

#### 4.1.5 `R3h-I` 工业成熟度对齐（收口轨，不改主顺序）

**目的**：把已经在 `R3h-0～3` 中落地的发行止血能力，继续收口成更稳定、可回归、可替换的长期结构；这是**架构硬化轨**，不是新增一层产品阶段。

##### 4.1.5.1 R3h「回滚」三分法（勿混读）

| 类型 | 含义 | 代码落点 | 阶段 |
|------|------|----------|------|
| **A 安装事务回滚** | 新包校验/解压失败 → 保留 **current**，不切换 | `local_runtime/installer.rs` | **R3h-1 编码✅** |
| **B 手动恢复 previous** | 用户触发「恢复上一版侧车」 | `local_runtime/recovery.rs` | **R3h-1 编码✅** |
| **C 自动升级健康回滚** | 切换后运行时劣化 → 自动回退 | 规划 | **R3h-2 / R3h-I2** |

> R3h-1 **不包含 C**；roadmap 勿写「企业级自动回滚已完成」。

| 子轨 | 对齐目标 | 主要落位 | **启动条件（定量）** |
|------|----------|----------|----------------------|
| **R3h-I1 Runtime Supervisor** | 显式 sidecar supervisor FSM、watchdog、runtime identity | `asr_sidecar.rs`、`lib.rs`、`asr_setup/diagnose.rs` | **R3h-1 编码签收** + remediation §11 **零终端/诊断** 手测通过后 → 可开 **设计**；**编码收口**不早于 **R3h-2 开始** |
| **R3h-I2 Release System** | GC、**事件化下载进度**（可恢复/可取消）、完整升级编排 | `local_runtime/*.rs`、`localRuntimeContract.ts` | **R3h-2 编码完成** + `npm run test` + `cargo test` 通过 → 本轨 **编码收口** |
| **R3h-I3 Setup Machine** | ASR setup reducer/state-machine | `useAsrSetupController.ts`、`asrSetupState.ts` | **I1 设计评审通过** + **I2 manifest schema 冻结**（ADR/contract 一行变更记录）→ 可开编码；目标窗口 **R3h-3** |
| **R3h-I4 ASR-WARM** | Persistent worker、预热、空闲回收 | `asr_sidecar.rs`、侧车进程策略 | **R3t-B 编码完成** + **I1 Supervisor FSM 设计冻结** → 见 [`asr-warm-acceptance.md`](../specs/asr-warm-acceptance.md) |

**R3h-2 进度事件（行业对照）**：侧车 zip 与模型拉取统一 **阶段 + 字节进度 + 可恢复**；参考 Tauri updater（签名/HTTPS/进度/代理）与 Ollama pull 流式 `status/digest/completed`（**取消须真停后台**，见 Q-R3g-3）。

**当前冻结边界**：

- `R3h-I` **不引入新产品承诺**，只收口已存在能力的真实状态面与可维护性。
- 默认走 **依赖轻** 的内部 reducer / state-machine，不为了 `R3h-I3` 新增 `xstate`。
- **R3h-1 编码最小闭环**：signed manifest、pinned key、schema 对齐、磁盘预算、诊断可追踪、**A/B 回滚**；**R3h-2/I2** 补 Range 续传、GC、**C 类回滚**、统一 progress events。
- `Setup Machine` 仍不并入 `R3h-1`；维持在 **R3h-I3 / R3h-3 附近** 收口。
- 供应链：artifact `sha256` + signed manifest + pinned key；SBOM / SLSA provenance 为 **release 附件**，不阻塞 R3h-0/1。
- 验证矩阵：`cargo test`、`run-asr-pytest.sh`、桌面 `typecheck/test`、architecture guard、打包 sidecar smoke。

#### 4.1.6 R3t 子阶段（录音转写 → LLM 校准）

> **Epic 真源**：[`recording-transcribe-llm-refine-plan.md`](../specs/recording-transcribe-llm-refine-plan.md) · [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md)  
> **产品决策**：§1.7 · Q1–Q5 已定

| ID | 依赖 | 交付要点 | 编码门禁 |
|----|------|----------|----------|
| **R3t-A** | R3g **⑤c** 建议先过 | 侧车全模型多语段；`funasr_whole_track_fallback` 长音频非终态 | ✅ 2026-05-30 手测签收 |
| **R3t-B** | R3t-A | 转写编排、原子写库、warnings；**不自动 LLM** | 勿与 R3f **大改**同轮 |
| **R3t-C** | R3t-B；R2 ✅ | 标点 + 可选邻段上下文 | 用户显式触发 |
| **R3t-D** | R3t-C 契约 | merge/split/update_text + 双 diff | 同左 |
| **R3t-E** | R3t-D | LexiconPack；**无 RAG**；不传 hotwords 串 | 同左 |

**学习环（已交付 + 规划）**：

```text
glossary_terms ──► L2 hotwords（转写偏置）
保存语段 ──► correction_memory ──► 转写 hints + R3t-E rules
用户确认写回 ──► 继续累积 memory（R3t-E2「采纳为规则」规划）
```

**增强项（排期）**：**HOT-UX**（⑤c 后，已拍板）；LEX-MINE / R3t-E3 项目级词表 **不做 v1**。

**交付导出（L6）**：**EXP-WORD** 在 **R3t-E 之后**、**R4 之前**（§8.2 Q-WORD）；与 P3 DOCX **基线**分层。**REV-LOC** 在 EXP-WORD 后、R4 前（**v1 纳入 P1**，见 **Q-POS-4**）。

**个人 v1 补齐**：**TRN-DIAG**、**ASR-WARM**、**R4-GATE** — 见 §1.8。

#### 4.1.7 转写精度与 STT 统一（ACC，2026-05-30 纳入）

> **对话拍板**：精度提升 = **Profile 默认（L2）+ 术语表（L2 偏置）+ memory/R3t-E（L4 改稿）+ 评测（L6）**；行业对标 Azure phrase list / OpenAI prompt / FunASR SDK `--use_itn` — **用户只维护模型、语言、术语表**。
> **架构索引（待立项）**：[`transcription-accuracy-program.md`](../../architecture/transcription-accuracy-program.md)

**分层（L0–L7，实施时勿混读）**：

| 层 | 手段 | 路线图落点 | 用户手动？ |
|----|------|----------|------------|
| **L0** | 录音质量指引；可选 ffmpeg 增强 | ACC-IN-1/2 | 读提示；增强默认关 |
| **L1** | SKU、prepare、MPS/CUDA、ASR-WARM | R3g-A、R3g-C4、ASR-WARM | 选模型；MPS 可选一键 |
| **L2 听写** | Profile + 热词 + 在线 adapter | **R3g-C**、HOT-UX、**ACC-STT-UNIFY** | **仅术语表** |
| **L3** | 分段/长音频 | R3t-A、R3e-B | 否 |
| **L4 改稿** | memory hints、R3t-E、可选 accepted 规则替换 | R3t-E、ACC-TXT-0（候选） | 改稿+保存；LLM 显式触发 |
| **L5** | 低置信筛选、一键入术语表 | ACC-HITL-*、LEX-MINE | 可选 |
| **L6** | CER / term_hit 回归集 | **ACC-EVAL-1**、R4 | 维护 eval manifest |
| **L7** | ASR-FT | §8.1 | Go 门槛后 |

**问题类型 × 主路径**：

| 问题 | 主路径 |
|------|--------|
| 专名听错 | L2 热词 + Paraformer SKU + **R3g-C**；L4 R3t-E；远期 ASR-FT |
| 同音字 | L4 memory + **R3t-E**；**不**靠热词堆通用字 |
| 听对音写错术语 | L2 热词 + L4 **LexiconPack canonical** |

**R3g-C 子切片（§4.1.1 **⑤g**）**：

| 子片 | 交付 |
|------|------|
| **C1** | `asr_model_profile.py`；迁移 `funasr_generate_kwargs`；单测快照 |
| **C2** | SenseVoice **`use_itn=True` 默认开** + `rich_transcription_postprocess` |
| **C3** | 通用 `_run_generate` 剥参 + `asr-generate-params-truth.md` + hints |
| **C4** | 环境页识别语言（**默认 `zh`**；v1 至少 `zh` + `auto`）；`RUSHI_FUNASR_USE_ITN` / `GENERATE_OVERRIDES`（排障） |

**ACC-STT-UNIFY 子切片（§4.1.1 **⑤h**）**：

| 子片 | 交付 |
|------|------|
| **U1** | `SttVocabularyPlan`；**OpenAI + AssemblyAI + Deepgram** 词表 adapter（v1 三家必接） |
| **U2** | `supportsHotwordBias` / 能力矩阵真源；`online_vocabulary_*` warnings |
| **U3** | 环境页本地 vs 在线词表能力对照 → **跟 R3h-3 三盏灯**（**不**与 U1 同轮硬绑） |
| **U4** | 在线失败回落本机 ASR（`fellBackToLocal`）→ **v1 不做**；仅 warning + 用户重试 |

**明确仍不做（ACC v1）**：FunASR 全参数 UI；RAG；静默 LLM 改稿；无评测默认开音频降噪；术语 **alias 填误写形**。

**ACC 候选（§8.1，Go 后再插入）**：ACC-MODEL-1（hotword SKU）、ACC-HOT-W（带权热词）、ACC-STT 阿里 vocabulary_id、ACC-IN-2/3、ACC-TXT-2 拼音引擎。

### 阶段状态（实施时更新）

| 阶段 ID | 状态 | 完成日 |
|---------|------|--------|
| R0 | ✅ 已完成 | 2026-05-25 |
| GLY-1 | ✅ 已完成（手测通过） | 2026-05-25 |
| R1 | ✅ 已完成（文档门禁） | 2026-05-25 |
| R2 | ✅ 已完成（DeepSeek 手测通过） | 2026-05-25 |
| R3 | 🟡 进行中（a/b/c ✅；**R3h/f/e/g/d** 按 §4.1） | — |
| R3h | 🟡 LRC 整改进行中：① 待跨平台 smoke；② 编码✅/发行⏳；**下一刀 ⑤g R3g-C**（R3t-A ✅ 2026-05-30）；并行闭合 ③ R3f、④ R3e-A 手测 | — |
| R4 | ⏳ | — |
| R5 | ⏳ v1 后 | — |
| R6–R8 | ⏳ 非 v1 | — |
| R9 | ⏳ 个人 v1 目标 | — |

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

### R3 — EXP-1：模型与配置 + 本机 ASR 发行可用

**目标**：非技术用户可在应用内完成本机语音能力就绪；云 STT/LLM 配置体验延续 R3a–b。

| 做 | 不做 |
|----|------|
| **R3h** LRC：侧车 manifest 下载、完整性、应用数据安装 | 应用内 PyInstaller 打侧车（主路径） |
| R3f 一键准备编排（依赖 R3h） | 嵌入 Ollama/LocalAI 作 ASR 引擎 |
| R3g 模型 SKU 目录；R3e 长音频 | YAML 配置第一真源 |
| R3c 已有：缓存/清理/manifest 展示 | 云同步 |
| R3a/b 已有：LLM keychain、profile | |

**规划真源**：[`rushi-local-runtime-catalog-remediation-plan.md`](../specs/rushi-local-runtime-catalog-remediation-plan.md)（v1.1）；排期索引 **§4.1**。

**验收（R3 收口）**：满足 remediation §11 发行门禁勾选 + R3f/g/e acceptance。

#### R3 薄片子项（状态表）

| 子项 | 主题 | 状态（2026-05-26） |
|------|------|-------------------|
| R3a | LLM keychain + probe | ✅ |
| R3b | Profile 导入导出 | ✅ |
| R3c | 缓存 / manifest / 清缓存 | ✅ |
| **R3h** | **本地运行时目录（LRC）** | ⏳ §4.1 ①–⑧ + `R3h-I`；`R3h-1` 按 release-system 最小闭环推进 |
| **R3f** | 一键环境准备 | 🟡 编码✅；手测在 **R3h-0 后** |
| **R3e** | 长音频 | ⏳ |
| **R3g** | 模型目录 | ✅ R3g-A ⑤a–c（2026-05-27） |
| **R3d** | 环境 IA | ⏳ 与 **R3h-3** 合并实施 |

**实施顺序**：**仅 §4.1.1**。

---

### R3h — 本地运行时目录（LRC，发行整改）

**目标**：侧车（推理运行时）与语音模型（权重）**分开展示、分发、验收**；统一 Installer，引擎可替换。

| 子阶段 | 主题 | 阻塞关系 |
|--------|------|----------|
| **R3h-0** | 构建正确 + CI smoke + 诊断 corrupt + Win 磁盘 | **阻塞一切发行手测** |
| **R3h-1** | `local_runtime/` + HTTPS 下载 + app_data 侧车 + signed manifest / current+previous / rollback | 阻塞 R3f 签收 |
| **R3h-2** | 断点续传、自动下载编排、GC / progress events / 升级收口 | 阻塞 R9 弱网场景 |
| **R3h-3** | 三盏灯就绪页（合并 R3d） | 体验收口 |
| **R3h-I** | 工业成熟度对齐：`Runtime Supervisor` / signed release system / `Setup Machine` | **收口轨**；不改 ①–⑨ 主顺序 |
| **R3h-3.5** | Sherpa-ONNX Spike | **不阻塞** ①–⑦ |
| **R3h-4** | 本机 LLM catalog | R4 前或并行设计 | **已并入 LLM-LOC**（§6）；v1 后实施 |
| **R3h-E/F** | 高级 pip / 本地 build 侧车 | 开发者折叠 |

**组件路径**（应用数据根下）：`sidecar/{platform}/{version}/`、`models/`（已有）、远期 `llm-runtime/`、`llm-models/`。

**审查吸收**：[`rushi-local-runtime-catalog-remediation-plan-review.md`](../specs/rushi-local-runtime-catalog-remediation-plan.md) → remediation v1.1 §13。

---

### R3e — 长音频本机转写（手测驱动）

**触发**：开发调试下 **~50min** 音频拉取语段 — 一次 OOM、一次 `error sending request`（`/v1/transcribe`）。根因：桌面 **600s 固定超时** + ASR **整文件 FunASR** 峰值内存过高。

| 子阶段 | 做 | 不做 |
|--------|-----|------|
| **R3e-A** | 按音频时长推导 HTTP/ffmpeg 超时；失败分类文案；环境/转写提示 | 自动分段 |
| **R3e-B** | 分段转写 + 时间轴合并 + 长任务进度（30～60min 主路径） | 侧车 **artifact** 断点续传见 **R3h-2**（T-004） |

**验收真源**：[`r3e-long-audio-transcribe-acceptance.md`](../specs/r3e-long-audio-transcribe-acceptance.md)。**R9 REL-1 长音频手测**在 R3e-B 完成前仅可部分勾选。

**建议排期**：见 **§4.1.1**（**R3e-A** 在 R3f 后；**R3e-B** 在 **R3t-B/TRN-DIAG 后**、**R3t-C 前**，Q-SEQ-1）。

---

### R4 — QLT-1：质量评估插槽（原 P0.5）

**目标**：桌面预留评估位；批跑指标不重复实现。

| 做 | 不做 |
|----|------|
| 委托 `eval_metrics.py` 的 CER / term_hit | LLM-as-judge 执行 |
| rubric YAML schema 校验 | synthetic dataset |
| 质量 Tab 只读（最近一次 eval 摘要） | 逐语段实时 judge |

**验收**：与 `eval-run.py` 数值一致；correction_memory 导出含脱敏步骤。

#### R4-GATE — 个人 v1 发版质量门禁（R9 硬依赖）

| 做 | 不做 |
|----|------|
| 固定 eval 集一条命令可跑；质量 Tab 展示最近一次 CER / term_hit | 在线 LLM judge |
| **R9 前必须**跑通并记录摘要（可对比上一版 tag） | 阻塞 R3 薄片开发 |

**真源**：[`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md) §3.4。

---

### R5 — AGT-1：MCP 只读（原 P1，**个人 v1 非阻塞**）

**目标**：外部 Agent 只读访问工作库。

| 做 | 不做 |
|----|------|
| `list_projects` / `get_project` / `get_transcript` / `search_segments` | 任何写 tool |
| `transcript://` / `project://` resources | 0.0.0.0 监听 |
| 设置页开关，默认关 | 打进 ASR 侧车 |

**验收**：Cursor / Claude Desktop 配置后可读 transcript；关闭后无额外端口。

**依赖**：T-002 完成；`file_id` / DB 路径稳定（已满足）。

---

### R6 — COL-1：协作服务骨架（**非个人 v1**；§6 / §8.2 Q-POS-2）

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

### R9 — REL-1：发版集成验收（**个人单机 v1**）

**目标**：个人用户可 **日常主力使用** 的内测/发布包；**不以 R6–R8 为门禁**。

| 项 | 说明 |
|----|------|
| **零终端本机 ASR** | 无 shell 完成侧车安装 + 默认模型 + smoke（**依赖 R3h-1 + R3f**；[remediation §11](../specs/rushi-local-runtime-catalog-remediation-plan.md)） |
| **弱网/断网** | 下载可重试；无网时 bundled 回退（**依赖 R3h-2**） |
| **长音频主路径** | 30～60min：转写 →（**R3t-C 标点** 或手改）→ 编辑 → **REV-LOC** → **EXP-WORD**（见 **Q-R9-1 Mid**） |
| **TRN-DIAG** | 失败一次转写：UI/诊断包能指出阶段与建议动作 |
| **ASR-WARM** | 同项目连续转写：第二次无明显冷启动劣化（手测） |
| **R4-GATE** | eval 集已跑；质量 Tab 有摘要；**含 ACC-EVAL-1** |
| **TEST-AUTO** | corrupt 侧车 fixture +（可选）长音频慢测 + Setup/转写 FSM contract 已跑 |
| **LLM 档位 Mid** | **R3t-B + R3t-C** 为 R9 **硬门禁**；**R3t-D/E 可减 scope**（不挡 R9，仍尽量在 R4 前闭合）；无 LLM 配置仍可转写 → 手改 → 导出 |
| **REV-LOC** | **v1 必做**（Q-POS-4）：至少只读变更时间线；恢复点按 acceptance 可减 scope |
| 脚本 | `p0-acceptance.sh`、P1–P4 按需抽检 |
| 文档 | §2 状态表；T-006 行数表对齐 |
| 可选 | E2E 一条主干；波形性能记录 |
| **不含** | R6–R8 协作签收、C4–C7、MCP 写路径 |

**手测清单摘要**：[`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md) §5。

---

## 6. 远期阶段（2026 Q4 起，**非个人 v1**）

| ID | 主题 | 前置 |
|----|------|------|
| **R6–R8** | 协作 C1–C3（骨架 / 只读 / 写入） | 产品书面启动协作；**默认 v1 不做** |
| **R5** | MCP 只读 | T-002；v1 后可插 |
| **LLM-LOC** | 本机 LLM 校对（Ollama → LRC 自管） | **R9 + R3t-E** 后：**SPIKE → Gate**；**未过 Gate 不编码** | [`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md) §9–10 |
| C4 | 审阅线程与建议修改 | R8 |
| C5 | Presence 与活动流 | C4 |
| C6 | Word 审阅导出（协作） | C4 数据落库；**≠** 单机 **EXP-WORD**（§4.1.1 ⑤‴） |
| C7 | 离线缓存、部署包正式化 | C3 + 镜像 |

规格已存在、实施等 C4 启动时再写 acceptance 增量：[`collaboration-review-word-export.md`](../specs/collaboration-review-word-export.md)。

---

## 7. 工程债与穿插规则

| ID | 债项 | 建议穿插阶段 | 说明 |
|----|------|--------------|------|
| T-001 | `transcribe.rs` 体量 | R3 或 R4 空档 | 已拆 online；可继续切 |
| T-002 | `HTTP_CLIENT` 位置 | **R1 末 / R2** | R5 MCP 前必须完成 |
| T-003 | `AUDIO_ONLY` | R3 | 随 profile 整理 |
| T-004 | 侧车 artifact 断点续传 + 镜像回退 | **R3h-2** | 原标 C7；现纳入 LRC Phase 2 |
| T-008 | LRC / 侧车 corrupt 诊断 | **R3h-0** | `bundledAvailable` 仅 bool；见 remediation §1.3 |
| T-009 | ~2.5GB Python 侧车技术债 | **R3h-3.5** | Sherpa-ONNX Spike；见 remediation §10.1 R1 |
| T-005 | `useProjectLifecycleController` | **✅ 已解决** | ~261 行；原 R0 项，2026-05-27 对照 |
| T-010 | `install_support.rs` / `asr_sidecar.rs` / `useAsrSetup*` | **R3h-2～I3** | 守卫 7 警告；随 LRC/I 薄片拆分，不单独开重构周 |
| T-006 | `architecture-split-plan` 过期 | **R9** | 与 §2 基线同步 |
| T-007 | 本机转写 600s 超时 + 整文件 FunASR | **R3e** | 50min 手测 OOM / request failed；见 r3e spec |

**穿插原则**：债项不单独开「重构周」；挂在最近相关功能薄片内，改动 ≤ 当轮范围。

---

## 8. 明确不做（个人单机 v1 发版前）

| 项 | 原因 |
|----|------|
| 统一 InferenceEngine | ASR 与 LLM IO 不同 |
| MCP 写操作 | 无审计设计 |
| LLM 进 ASR 侧车 | 体积与信任边界 |
| YAML 配置主真源 | 密钥与 UI 双写 |
| correction_memory → 训练集 | schema 不足 |
| CRDT / 浏览器完整编辑器 | 协作远期 |
| 翻译词典 / CAT 全模块 | 见 [`translation-dictionary-module.md`](../specs/translation-dictionary-module.md) + [`translation-cat-backlog.md`](../specs/translation-cat-backlog.md)；**未纳入**（与 glossary 不同表、不同目标） |
| **领域 RAG 校对** | **当前不做**（2026-05-27）；R3t-E 仅用 **LexiconPack**（glossary + correction_memory），不上检索语料 |
| **Oumi 式桌面内训练 / Synth 管道** | 见 oumi Part I 排除 + lexicon-mining §7；**ASR-FT** 仅远期 |
| **LLM 请求携带 ASR `hotwords` 空格串** | 与 LexiconPack 重复且难做 evidence；**禁止** |
| **向 C 端用户暴露 FunASR 全量 `generate()` 参数** | 行业惯例为 **Preset-first**；仅 env 排障 override（**R3g-C**） |
| **假定在线 STT 与 FunASR 共用同一热词 HTTP 字段** | 须 **ACC-STT-UNIFY** 分 adapter；见 [`asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) |
| **STREAM / mic 流式** | 不在 R3t v1；R3t-D/E 后另立项 |
| 术语库仅做后端、不做管理 UI | GLY-1 已纳入；初版路线图遗漏，属文档缺口非功能删除 |

---

## 8.1 候选 Epic（未排期）

> **真源**：[`lexicon-mining-backlog.md`](../specs/lexicon-mining-backlog.md)、[`translation-cat-backlog.md`](../specs/translation-cat-backlog.md)、**§4.1.7 ACC 候选**  
> 下列项**不在 §4.1.1 顺序内**（**R3g-C / ACC-STT-UNIFY 已入主序 ⑤g/⑤h**）；产品书面 Go 后再拆 intent/plan/acceptance 并插入排期。

| ID | 名称 | 摘要 | 建议门禁 |
|----|------|------|----------|
| **ACC-EVAL-1** | 专名/术语回归 manifest（如 制控 term_hit） | `fixtures/eval` + term_hit；**R3g-C 合入硬门禁** | **Q-ACC-4**；产品补 1～2 条脱敏样例 |
| **ACC-MODEL-1** | SenseVoiceSmall_hotword / contextual SKU | FunASR 官方 hotword 增强权重 | **产品 Go**；R3g-C + ACC-EVAL-1 后插入 §4.1.1 |
| **ACC-HOT-W** | 带权热词（`词 权重`） | 对齐 FunASR Runtime SDK / 阿里百炼 weight | R3g-C；ACC-EVAL-2 |
| **ACC-STT-ALI** | 百炼 `vocabulary_id` + `target_model` | 云端 Paraformer/Fun-ASR 热词 CRUD | ACC-STT-UNIFY U2 |
| **ACC-TXT-0** | 已采纳规则转写后自动替换 | 对标 AssemblyAI custom_spelling 轻量版 | R3t-E 边界评审 |
| **ACC-IN-2/3** | 音频增强 / 选区重转写 | 须 ACC-EVAL A/B | R4 前 |
| **ACC-HITL-1/2** | 低置信筛选 / R3t-E 优先队列 | UX 薄片 | R3t-B/E |
| **ACC-GLOSS-2** | 错词一键加入术语表 | GLY-1 | R3t-B 后 |
| **LEX-MINE** | 词表候选推荐 | 补齐计划书 §5.1.2：从 `correction_memory` 聚合推荐进 glossary；可选 LLM **只读**说明（**非训练**） | R3t-E 或 GLY-1 + memory 稳定；**不**与 R3t-E 合并 prompt |
| **ASR-FT** | ASR 训练 manifest / 可选 LoRA | 计划书 §5.2–5.3；Oumi 数据合成 **远期** | R9 ROI + memory 导出 schema（privacy/domain）+ 独立测试集 |
| **CAT-TRAN** | 翻译 + 词典（CAT） | 中译英、`target_text`、富结构词典、子范围批注、双语 DOCX；**spec 已有** T1–T6 | **远期**；**当前不做**（2026-05-27）；Go 须转写主线签收 + 产品中译英优先级 |
| **REV-LOC** | 单机修订时间线 | `edit_log` 只读/恢复点；非协作 revision | EXP-WORD 后；**v1 P1**（Q-POS-4） |
| **STREAM-*** | 实时 mic / 流式 | 另立项 | R3t-D/E 签收后 |
| **LLM-LOC** | 本机 LLM（Spike / 4a / 4b） | 规划真源 §9 Gate；**实施待 Q-LLM-5** | [`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md) |

**与 §8 关系**：§8「correction_memory → 训练集」仍有效；**LEX-MINE-1/2 不算训练集**（仅 UI 推荐）。**ASR-FT** 仅在 backlog §5 Go 门槛满足后解除。**CAT-TRAN**：**远期规划、当前不做**；维持 §8「全模块未纳入」，**禁止**在转写薄片内预建 CAT schema。

---

## 8.2 已拍板（2026-05-27；**2026-05-30 ACC/R9 增补**）

| ID | 决定 |
|----|------|
| **Q-R3t-1** | **合并分段内核**：R3t-A/B 与 R3e-B **同一 `funasr_engine` 真源**；⑨ 仅补长音频进度/分片（若侧车内循环已覆盖则减量） |
| **Q-R3t-2** | **R3t-C、D、E 全部在 R4 之前** 完成（LLM 校准一整块后再做质量 Tab） |
| **Q-R3t-3** | **HOT-UX** 纳入：**R3g ⑤c 后** 约 0.5w |
| **Q-R3t-4** | **R3t-E3 项目级词表 v1 不做**；仍 **全局 `glossary_terms`** |
| **Q-WORD-1** | **EXP-WORD** 在 **R3t-E 之后、R4 之前** |
| **Q-WORD-2** | 修订摘要附录：**导出时可选勾选**；**不做** Word Track Changes / 批注气泡 |
| **Q-WORD-3** | v1：**逐字稿增强 + 讲稿/干净稿**；**不等** 协作 C6 |
| **Q-POS-1** | **产品定位 = 个人单机 v1**；SQLite 真源；主路径见 §1.6 |
| **Q-POS-2** | **R6–R8 非 v1 阻塞**；R9 可在 R4 后签收；R5 可后置 |
| **Q-POS-3** | **ASR-WARM** 纳入 v1 P1（§4.1.1 **⑦½**）；**TRN-DIAG** 纳入 v1 P1（**⑤′½**） |
| **Q-POS-4** | **R4-GATE** 为 R9 **硬门禁**；**REV-LOC** 为 **v1 P1 必做**（2026-05-30 拍板） |
| **Q-LLM-1** | 本机 LLM **v1 后**做；**不阻塞 R9**；v1 仍以 **云端** 签收 R3t |
| **Q-LLM-2** | **先 LLM-LOC-4a（Ollama）** 验证本地校对 ROI；**再 4b（LRC 自管）** |
| **Q-LLM-3** | LLM **不进 ASR 侧车**；postprocess 仍为 Tauri OpenAI-compatible HTTP |
| **Q-LLM-4** | **4a 与 4b 可并存**：默认 4b 零终端；检测到 Ollama 时可「使用现有安装」 |
| **Q-LLM-5** | **是否真做本机 LLM 以 Gate 为准**：先 **LLM-LOC-SPIKE** → **Gate-A**（4a）→ **Gate-B**（4b）；**未过则不做产品化**，云端仍为默认 |
| **Q-SEQ-1** | ✅ **已拍板**（2026-05-27 无异议）：**HOT-UX** 入主序（⑤c 后）；**R3e-B** 在 **R3t-B/TRN-DIAG 之后**、**R3t-C 之前**（**不**回退到 R3h-3 后）；Sherpa **⑧½** 不阻塞 A–B |
| **Q-SEQ-2** | R3 宏观工期以 **§4.1.1 薄片总和** 为准（约 **8～10w**），非旧表「4～5w」单行 |
| **Q-R3g-2** | ✅ **R3-STATE S3 不得跳过**：⑤b **2 组矛盾场景手测** 签收后方可 **⑤c**（不与 ⑤c 并行除非书面改序） |
| **Q-R3t-2** | ✅ **分段单一模块**：R3t-A 产出 `segmentation.py`（或等价模块）；R3e-B **只消费**（见 R3t plan §2.3） |
| **Q-R3e-1** | ✅ **R3e-A 非长音频多段验收**：50min 手测只验动态超时/失败分类/OOM 文案；多段质量 **仅 R3t-A/B + R3e-B** |
| **Q-R3g-3** | ✅ **模型下载 cooperative cancel**：`POST /v1/models/prepare-cancel` + `phase: cancelled`；单文件传完前不可硬中断 ModelScope；**⑤c 前手测** |
| **Q-ACC-1** | ✅ **FunASR 固有参数 Preset-first**：**R3g-C** 按 SKU Profile 默认；**不**做 C 端全参数表单 |
| **Q-ACC-2** | ✅ **本地+在线打通**：编排层已统一；**⑤h ACC-STT-UNIFY** 统一 **术语真源 + adapter**；**不**假定同一 `hotword=` |
| **Q-ACC-3** | ✅ **同音/专名双通道**：L2 热词 + L4 **R3t-E**/memory |
| **Q-ACC-4** | ✅ **ACC-EVAL-1** 为 **R3g-C 合入硬门禁**；样例 **`fixtures/eval/samples/制控.mp3`**（`expected_terms: 制控`）；`eval-run.py` 输出 `term_hit_rate` |
| **Q-ACC-5** | ✅ **术语表只放正确写法**：`term` = canonical；**不**用 aliases 承载误听/误写偏置（如 **智控**）；同音靠 L4 memory/R3t-E |
| **Q-ACC-6** | ✅ **ACC-STT-UNIFY v1**：U1 必接 **OpenAI + AssemblyAI + Deepgram**；U2 必做；**U3→R3h-3**；**U4 延后**；Azure/百炼仍 §8.1 |
| **Q-ACC-7** | ✅ **SenseVoice ITN 默认开**（R3g-C C2）；识别语言 UI **默认 `zh`**（C4） |
| **Q-R9-1** | ✅ **Mid 档位**：R9 硬门禁 **R3t-B + R3t-C**；**R3t-D/E 可减 scope**（不挡 R9）；无 LLM 仍可手改交付 |
| **Q-FUT-1** | ✅ **§9 分叉 B 否**（协作不提前）；**R3h-3.5 Sherpa Spike Go**；**ACC-MODEL-1/HOT-W 产品 Go**（ACC-EVAL-1 后插入主序）；**LLM-LOC** 仍 R9 后 Spike→Gate |
| **Q-SEQ-3** | ✅ **§4.1.1 主序不变**（2026-05-30）：**R3g-C → ACC-STT-UNIFY → R3t-B → …**；不因 Mid/REV-LOC 重排薄片 |

---

## 9. 排期分叉（二选一）

### 默认：个人单机 v1（§3.1、§4.1.1）

**真源**：§1.6–§1.8 → R3 薄片（含 EXP-WORD、TRN-DIAG、ASR-WARM）→ R4 + R4-GATE → R9。

### 分叉 B：协作提前（**偏离个人 v1 默认**）

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
| **定位** | **个人单机 v1**（§1.6） |
| **阶段** | **R3 — 转写主线（EXP-1 + R3h LRC + R3g/R3e/R3t + ACC + EXP-WORD）** |
| **近期不做** | **CAT-TRAN**、LEX-MINE、ASR-FT、**RAG**、**R6–R8** — §8 / §8.1 / §6 |
| **ASR 引擎路线** | **方案 A 已锁定** — FunASR + LRC 先行；Sherpa 仅 R3h-3.5 Spike；[ADR-0003](../../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md) |
| **排期真源** | **§4.1.1** |
| **实施真源** | [`rushi-local-runtime-catalog-remediation-plan.md`](../specs/rushi-local-runtime-catalog-remediation-plan.md) **v1.1** |
| **验收切片** | [`r3f-…`](../specs/r3f-asr-setup-wizard-acceptance.md) / [`r3g-…`](../specs/r3g-local-asr-model-catalog-acceptance.md) / [`r3g-c-…`](../specs/r3g-c-asr-generate-profile-acceptance.md)（待立项） / [`acc-stt-unify-…`](../specs/acc-stt-unify-acceptance.md)（待立项） / [`r3e-…`](../specs/r3e-long-audio-transcribe-acceptance.md) / [`trn-diag-…`](../specs/trn-diag-acceptance.md) / [`asr-warm-…`](../specs/asr-warm-acceptance.md) / [`exp-word-…`](../specs/exp-word-formatted-export-acceptance.md) |
| **不要** | 内置 LiteLLM/网关、Ollama 替代 ASR、主路径 pip/PyInstaller、R3f 在 R3h-0 前签收 |

### R3 规划门禁

- [x] Provider 调研；不引入捆绑网关；STT/LLM 分通道  
- [x] 内置侧车优先；Win **仅双 exe**  
- [x] R3a/b/c 已签收；R3f/g/e acceptance 已起草  
- [x] **LRC 整改方案 + 审查吸收**（v1.1，2026-05-26）  
- [x] **ASR 引擎方案 A**（FunASR 先行 + Sherpa Spike 门控；[ADR-0003](../../adr/0003-asr-engine-funasr-first-sherpa-spike-gate.md)）  
- [x] **R3-STATE S3**（R3g-A ⑤b；2026-05-27 场景 1–2 手测签收）
- [x] **R3g-A ⑤c**（Paraformer 13min 多语段；2026-05-27 复测签收）
- [ ] **R3h §11 发行门禁**（零终端、构建 smoke、损坏可恢复…）

**下一刀**：**R3t-D**（段界 ops）或 **ACC-EVAL-1**

**同轮或紧邻闭合**：**③ R3f**、**④ R3e-A** 手测、**R3h §11** 发行门禁

**主序**：**R3t-C ✅**（R9 Mid 硬门禁 **R3t-B + R3t-C** 已闭合）→ R3e-B / R3t-D → …

---

## 11. 参考文档（非排期真源）

| 文档 | 用途 |
|------|------|
| [`oumi-remediation-report.md`](../specs/oumi-remediation-report.md) | Oumi 调研；Part I 边界；**§五-b** 为何不训领域模型 |
| [`collaboration-foundation-plan.md`](./collaboration-foundation-plan.md) | 协作 Phase 1–7 细节；**顺序以本文 §4–§6 为准** |
| [`p2-acceptance.md`](../p2-acceptance.md) | P2：术语库/热词/低置信/纠错记忆（**后端**）；管理 UI → GLY-1 |
| [`docs/architecture/asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) | 术语如何拼进 ASR `hotwords` |
| [`docs/architecture/transcription-accuracy-program.md`](../../architecture/transcription-accuracy-program.md) | **ACC** 分层 L0–L7、问题矩阵、与 R3g-C/UNIFY 关系（**待立项**） |
| [`docs/architecture/asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md) | **R3g-C** FunASR `generate()` Profile 真源表（**待立项**） |
| [`r3g-c-asr-generate-profile-acceptance.md`](../specs/r3g-c-asr-generate-profile-acceptance.md) | **R3g-C** 验收切片（**待立项**） |
| [`acc-stt-unify-acceptance.md`](../specs/acc-stt-unify-acceptance.md) | **ACC-STT-UNIFY** 验收切片（**待立项**） |
| [`docs/architecture/recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) | **R3t** 管线真源（录音分段 + LLM 校准，不含流式） |
| [`recording-transcribe-llm-refine-intent.md`](../specs/recording-transcribe-llm-refine-intent.md) | R3t 目标与边界 |
| [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md) | **R3t-E** 词表有据校对（**消费**词表） |
| [`word-formatted-export-backlog.md`](../specs/word-formatted-export-backlog.md) | **EXP-WORD** L6 终稿 Word（单机；非 C6） |
| [`p3-acceptance.md`](../p3-acceptance.md) | P3 DOCX **基线**签收 |
| [`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md) | **个人单机 v1** 能力补齐与 R9 手测 |
| [`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md) | **LLM-LOC** 本机 LLM（4a Ollama / 4b LRC） |
| [`lexicon-mining-backlog.md`](../specs/lexicon-mining-backlog.md) | **候选** LEX-MINE / ASR-FT；历史 §5 与 Oumi 排除登记 |
| [`translation-dictionary-module.md`](../specs/translation-dictionary-module.md) | **CAT 实施 spec**（T1–T6；未排期） |
| [`translation-cat-backlog.md`](../specs/translation-cat-backlog.md) | **候选** CAT-TRAN；与 glossary/R3t 边界 |
| [`ui-redesign-parallel-dev.md`](../specs/ui-redesign-parallel-dev.md) | UI 纪律与已验收记录 |
| [`architecture-split-plan.md`](../specs/architecture-split-plan.md) | 文件拆分地图（R9 同步） |
| [`rushi-local-runtime-catalog-remediation-plan.md`](../specs/rushi-local-runtime-catalog-remediation-plan.md) | **R3h 实施真源**（LRC、manifest、分阶段验收） |
| [`rushi-local-runtime-catalog-remediation-plan-review.md`](../specs/rushi-local-runtime-catalog-remediation-plan-review.md) | R3h 审查报告（已吸收 v1.1） |
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
| 2026-05-25 | **R3c 手测通过**：引导/缓存/manifest/清缓存确认框；下一刀 **R3f** |
| 2026-05-25 | **§4.1 排期微调**：R3f → **R3e-A** → R3g-A → R3d 轻量 → R3e-B；补 [`r3d-settings-ia-acceptance.md`](../specs/r3d-settings-ia-acceptance.md) |
| 2026-05-26 | **R3 重排**：**R3h（LRC）** 升为 epic；remediation v1.1；§4.1.1 为唯一顺序 |
| 2026-05-26 | **ADR-0003**：**方案 A** — FunASR + LRC 先行；Sherpa 经 R3h-3.5 Spike 门控；否决方案 B（直接上 Sherpa） |
| 2026-05-27 | **§8.1 候选 Epic**：[`lexicon-mining-backlog.md`](../specs/lexicon-mining-backlog.md)（LEX-MINE / ASR-FT；对齐计划书 §5 与 Oumi 排除） |
| 2026-05-27 | **§8.1 CAT-TRAN**：[`translation-cat-backlog.md`](../specs/translation-cat-backlog.md)（翻译+词典；spec 见 `translation-dictionary-module.md`） |
| 2026-05-27 | **产品侧重转写**：§1 原则 6 + §10；**CAT-TRAN 远期、当前不做** |
| 2026-05-27 | **RAG 校对不做**：§8 + R3t-E；校对仅 LexiconPack |
| 2026-05-27 | Oumi 报告 §五-b + lexicon-mining §7：为何不照搬 Oumi 动模型 |
| 2026-05-27 | **§1.7 产品决策台账**；§4.1.1 纳入 R3t-A～E；§4.1.6 |
| 2026-05-27 | **§8.2 已拍板**：Q-R3t-1 合并 e-B 内核；Q-R3t-2 C/D/E 全在 R4 前；Q-R3t-3 HOT-UX；Q-R3t-4 无项目级词表 v1 |
| 2026-05-27 | **R3-STATE 闸门**：新增 [`desktop-capability-ui-state-alignment.md`](../../architecture/desktop-capability-ui-state-alignment.md)；R3g-A 拆 ⑤a/b/c；记录 UI 状态疏漏台账 |
| 2026-05-27 | **EXP-WORD**：backlog + §4.1.1 ⑤‴；L6；§8.2 **Q-WORD-1～3**；与 P3/C6/CAT 分轨 |
| 2026-05-27 | **个人单机 v1**：§1.6/§1.8；**ASR-WARM/TRN-DIAG/REV-LOC/R4-GATE**；R6–R8 非 v1；§8.2 **Q-POS-1～4** |
| 2026-05-27 | **LLM-LOC**：backlog §8–10 模型/Gate/SPIKE；**Q-LLM-5** 未过 Gate 不产品化 |
| 2026-05-27 | **路线图梳理**：§4.0 v1 路径；§4.1.0 分期；§4.1.1 **Q-SEQ-1** 重排；§2 与 R3 工期校正；原则 **LLM 可插拔** |
| 2026-05-27 | **Q-SEQ-1 签收**：R3e-B 前移无异议；§8.2 标为已拍板 |
| 2026-05-27 | **审查对齐**：§13.3 热点表、T-005/T-010、R3h-1 编码/发行口径、S3 闸门、Q-R3g-2/Q-R3t-2；三份 acceptance 立项 |
| 2026-05-27 | **审查 round-2**：状态标记约定；§4.1.5/6 编号；rollback 三分；Q-R3e-1/Q-R3g-3；remediation v1.2 |
| 2026-05-27 | **Q-R3g-3 编码**：侧车 `prepare-cancel` + 前端取消；cooperative（阶段间/进度回调） |
| 2026-05-27 | **R3g-A ⑤b S3 签收**：场景 1 未就绪 + 场景 2 通过 → 可进 **⑤c** |
| 2026-05-27 | **R3g-A ⑤c 签收**：侧车陈旧检测 + punc prepare 复测；preflight + 13min ≥10 语段 |
| 2026-05-30 | **R3t-A 手测签收**：Paraformer 13min 28 段、SenseVoice 13min 41 段、短音频 1 段、whole_track_fallback hints；`scripts/r3t-a-hand-test.sh` |
| 2026-05-30 | **ACC-EVAL-1 样例就位**：`fixtures/eval/samples/制控.mp3` + manifest `proper-noun-zhikong`（硬门禁，非 optional） |
| 2026-05-30 | **产品拍板批次**：Q-ACC-4～7、Q-R9-1 Mid、REV-LOC v1 P1、ACC-STT 三家 v1、Q-FUT-1 |
| 2026-05-30 | **§4.1.7 ACC + 主序重排**：**⑤g R3g-C**、**⑤h ACC-STT-UNIFY**；§11 ACC 参考链 |
| 2026-05-30 | **§13 对照刷新**：567 vitest、11 守卫警告；R3f/LRC/R3t-A 合入 `main`；波形 polish 记入 §2 |

---

## 13. 代码对照评估（2026-05-30，`main` @ `00e9a9d`）

> 对照 **已推送 `main`**。发版轮末刷新本节测试数 / 守卫警告 / 热点行数。

### 13.1 工程验证快照（实测）

| 检查项 | 结果 |
|--------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run test`（desktop） | ✅ **567** passed（116 files，2026-05-30） |
| `node scripts/check-architecture-guard.mjs` | ✅ 0 错误，**11 警告**（波形热点：`pxPerSec.ts`、`useWaveformSegmentDrag.ts` 等，§13.3） |
| `cargo test`（desktop lib） | ✅ 见 `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` |
| `profile.rs` / R3c 缓存 / 清缓存对话框 | ✅ 已合入 `main` |
| `asr_setup_diagnose` / 一键准备 UI | 🟡 **已合入**（`asr_setup/`、`LocalAsrSetupWizard`）；**R3f 手测待 R3h-0** |
| `local_runtime/` LRC | 🟡 **已合入**（manifest、installer、recovery、integrity…）；**R3h-1 发行门禁 §11 未全绿** |
| `segmentation.py` / R3t-A 内核 | ✅ **手测签收**（2026-05-30；`scripts/r3t-a-hand-test.sh`） |
| `prepare(model_id)` / 模型目录 UI | ✅ R3g-A ⑤a–c 手测签收（2026-05-27） |
| 长音频动态超时（R3e-A） | 🟡 `transcribe_timeout.rs` 已编码；**50min 手测待签** |
| 长音频分段转写（R3e-B） | ✅ 2026-05-30 签收 — [`r3e-b-hand-test-checklist.md`](../specs/r3e-b-hand-test-checklist.md) |
| 校对工作台波形 polish | ✅ minimap 56px、layoutIntent 缩放栏、语段 tap seek 等（2026-05-30） |
| `services/mcp` / `services/collab` | ❌ 未开始 |

**R3t-A 编码真源（签收对照）**：

- `services/asr/rushi_asr/segmentation.py` — 分段内核 + `segment_audio_to_transcription_segments` 别名（R3e-B 消费点）
- `services/asr/rushi_asr/funasr_engine.py` — generate 参数、分段模式、`segmentation_mode` 回传
- `services/asr/tests/test_funasr_engine.py`、`test_funasr_pipeline.py`、`test_model_prepare.py`
- 桌面：`segmentation_mode`（`contracts/transcription.ts`）、`deriveTranscribeHints` / `segmentListHelpers`（`whole_track_fallback` → placeholder kind）

### 13.2 与路线图各阶段的符合度

| 阶段 | 代码现状 | 评估 |
|------|----------|------|
| **R0–R2** | lifecycle ~261 行（**T-005 ✅**） | ✅ |
| **R3a–b** | keychain/probe；profile 导入导出 | ✅ |
| **R3c** | 引导/缓存/manifest/清缓存 | ✅ 手测通过 |
| **R3f** | `asr_setup_diagnose`、一键准备、8741 探测、LRC 缺失/损坏修复 | 🟡 编码✅；**R3h-0 后手测** |
| **R3h-0/1** | smoke、Win 磁盘、`local_runtime` 模块树、manifest 下载、A/B 回滚 | 🟡 编码✅；**§11 发行门禁未全绿** |
| **R3g** | 双 SKU + prepare；R3-STATE 对齐 | ✅ ⑤a–c 签收 |
| **R3t-A** | 分段内核 + 单测 + hints + 手测 | ✅ **2026-05-30 签收** |
| **R3t-B～E** | — | 📋 |
| **R3e-A** | 动态超时预算 | 🟡 编码✅；50min 手测待签 |
| **R3e-B** | — | 📋 |
| **波形 UX** | 2026-05 多轮 polish | ✅ 编辑体验；**不替代 R3t 签收** |
| **R4–R8** | 无质量 Tab / MCP / collab | ❌ |
| **R9** | 诊断包有；长音频 REL 依赖 R3e-B + R3t | 🟡 |

### 13.3 代码热点（2026-05-30 `wc -l`）

| 文件 | 行数 | 路线图 / 守卫 | 判定 |
|------|------|---------------|------|
| `local_runtime/install_support/`（合计） | 仍大 | **T-010**；R3h-I2 | ⚠️ R3h-2 薄片内拆 |
| `asr_sidecar.rs` | ~632 | **T-010**；R3h-I1 | ⚠️ 同上 |
| `useAsrSetupController.ts` | ~122 | R3h-I3 | ✅ 已拆分（原 ~364） |
| `useLocalRuntimeSetupSupport.ts` | ~61 | R3h-I3 | ✅ |
| `LocalAsrSetupWizard.tsx` | ~166 | R3f | ✅ |
| `useWaveformSegmentDrag.ts` | ~376 | 波形 | ⚠️ 守卫警告；再叠功能先拆 |
| `pxPerSec.ts` | ~376 | 波形 fit/zoom | ⚠️ 同上 |
| `useWaveformZoom.ts` | — | 13 hooks | ⚠️ 超 12 阈值 |
| `WaveformTimeRuler.tsx` | ~349 | 波形 | ⚠️ 接近 300 行 + 13 hooks |
| `useProjectLifecycleController.ts` | ~261 | **T-005 ✅** | ✅ |
| `useProjectWaveform.ts` | ~275 | — | ✅ 观察 |
| `transcribe.rs` | ~300 | T-001 | ✅ 已拆 online |

### 13.4 排期调整摘要（2026-05-30）

1. **R3t-A** ✅（2026-05-30 手测签收）；下一刀 **R3g-C C1** → **ACC-STT-UNIFY U1** → **R3t-B**（§4.1.1 **⑤g/⑤h** 插入 **⑤′b** 前）。  
2. **R3f / LRC** 不再标「工作区未提交」；发行与手测闸门仍开放。  
3. **波形 polish**（2026-05-27～30）记入 §2 基线，**不占用** R3t 薄片序号。  
4. **§4.1.1 顺序更新**：**⑤g R3g-C**、**⑤h ACC-STT-UNIFY** 在 **⑤′b R3t-B** 前；③ R3f、④ R3e-A 手测仍建议闭合，可与 R3g-C 交错。

### 13.5 风险（对照后）

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| R3t-A 手测未签即开 R3t-B | — | ✅ 2026-05-30 已签 |
| R3f / R3h-0 手测滞后 | 高 | 与 R3t-A 手测同轮或紧邻； corrupt 包误判 |
| 文档 §13 与实测再次漂移 | 低 | 每 Epic 签收后刷新 §13.1 一行 |
| 波形热点超阈值继续叠功能 | 中 | 下一波形刀先拆 `pxPerSec` 或 drag |
| 长音频 OOM / 超时 | 高 | **R3e-A 手测** + **R3t-A/B** |
| LRC 大模块（**T-010**） | 中 | R3h-2 / R3h-I 薄片内拆 |
