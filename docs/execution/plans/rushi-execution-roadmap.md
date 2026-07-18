# Rushi 统一执行路线图（2026-05-25 起）

> **本文件为 Rushi 仓后续工作的排期真源。**  
> 与 Jieyu 平级计划书冲突时：以 **本仓代码 + ADR + 本文** 为准。  
> 深度背景见文末「参考文档」；**R3 本机 ASR 发行整改**以 [`rushi-local-runtime-catalog-remediation-plan.md`](../specs/rushi-local-runtime-catalog-remediation-plan.md)（**v1.2**）为实施真源，本文 §4.1 / §5 R3h 为排期索引。

| 元数据 | 值 |
|--------|-----|
| 基线日期 | 2026-05-25 |
| 适用节奏 | 单人、每轮 2～4h、一轮一纵向薄片 |
| 规划跨度 | **个人单机 v1**：约 **14～18 周（自当前）** 或 **18～22 周（自 W1）**；R3 薄片 **~12～15w**（§4.0，含发行 smoke 缓冲）；**第二阶段**见 [`rushi-phase-2-roadmap.md`](./rushi-phase-2-roadmap.md)（非 v1，约 10～16w） |
| 修订 | 每完成一个阶段更新 §2 状态表、§4 排期表与 §13 代码对照 |
| 最近对照 | **2026-06-19**：**P2 T-010 ✅**（`9612aae` · guard **0**）· **§10.4 v1.1+ ✅** · **ACC-STT-IFLYTEK ✅** · Release **v0.1.1**（mac/linux）；下一刀 → **§10.5 P3 Win 资产 / CLN-066** |

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
| **纠错记忆** | **落库**学习 `correction_memory`（规划：**MEM-P0** 显式入库 + hit 与自动保存解耦）；转写 **hints**；R3t-E **改正** + evidence |
| **越用越准** | **记忆 + 热词 + R3t-E**；**不**指望权重自动更新 |
| **Q-ASR-1** | **SenseVoice** = **兼容/快轨遗留**；**v1 主推 Paraformer**；**Qwen3-ASR / ForcedAligner（R3g-B-Align）❌ 废弃**（2026-06-11 CPU ~8× 慢 · 2026-06-18 不再做）；**Fun-ASR-Nano PyTorch / vLLM ❌ Defer**；**不重开**本机第三 SKU 除非新产品书面 Go |
| **FunASR 固有参数** | **用户不填** `use_itn` / `merge_vad` 等；由 **R3g-C Profile** 按 SKU+时长默认；仅 **模型、语言、术语表** 为用户控件（env 排障 override 另论） |
| **本地 + 在线 STT** | **编排已统一**（`project_run_transcribe` → `TranscriptionResult` v1）；**词表偏置** 经 **ACC-STT-UNIFY** 分 adapter 映射（非同一 `hotword=` 字段） |
| **同音/误写（如智控→制控）** | L2 热词 **偏置有限**；L4 **correction_memory + R3t-E**；**术语表只放正确 canonical**（**Q-ACC-5**）；**`before_text` 不进 hotwords**（**Q-ACC-8**） |
| **L2 热词内容纪律** | **仅** `glossary_terms.term` + 合理 `aliases` → `hotwords`；**禁止** `correction_memory.before_text`、整对 `before→after`、误听形 alias；闭环走 **F6 / 纳入记忆→术语表**（见 §4.1.9） |
| **RAG** | **当前不做** |
| **Oumi 式动模型** | **当前不做**；远期 **ASR-FT**（FunASR 微调 + R3h 发版），见 [`lexicon-mining-backlog.md`](../specs/lexicon-mining-backlog.md) §7、[`oumi-remediation-report.md`](../specs/oumi-remediation-report.md) §五-b |

#### 明确不做 / 远期（当前不占排期）

| 项 | 处置 |
|----|------|
| **CAT-TRAN**（翻译+富结构词典） | **远期**；spec 保留；**当前不做**（[`translation-cat-backlog.md`](../specs/translation-cat-backlog.md)） |
| **LEX-MINE-2+**（全量语料挖掘 + 可选 LLM 说明） | §8.1 候选；**LEX-MINE-1 轻量** → **⑤″f-B½ MEM-P1** |
| **ASR-FT**（领域微调） | §8.1 候选；Go 门槛未满足 |
| **领域 RAG 校对** | §8 不做 |
| **correction_memory → 训练集** | §8 不做（schema 不足） |
| **协作 C6 Word** | **远期**；多人批注真源；**不等**单机 EXP-WORD |

#### R2 与 R3t-C 关系

- **R2 `auto_punctuate` ✅** 保留；**R3t-C** 为其超集（可选邻段上下文），**不废弃** R2 命令与 UI。

#### 工程、安全与发行（2026-06 拍板）

> 审查后续项；**v1 已分发 DMG（Mac）** 与下列 **v1.1 / 发行策略** 并存。

| ID | 决定 | 落点 / 备注 |
|----|------|-------------|
| **Q-CSP-1** | **v1.1 硬化 CSP**（方案 B）：**生产 `style-src` / `style-src-elem` 去 `unsafe-inline`**（nonce + WaveSurfer）；**`script-src` 生产已为 `'self'`**（v1 已闭合）；`style-src-attr` v1.1 暂保留；引入富文本/HTML 渲染前须完成 hardened CSP | `tauri.conf.json`；预估 ~1w + 三端 smoke（见 **CSP-HARDEN**） |
| **Q-SYMPH-1** | **symphonia 不裁剪**（方案 A）：保留 `aac, flac, isomp4, mp3, pcm, vorbis, wav`；波形/peaks 优先 symphonia，失败走 FFmpeg remux | `apps/desktop/src-tauri/Cargo.toml` |
| **Q-STT-CANCEL-1** | **v1.1 在线 STT 真取消**（方案 B）：`project_run_transcribe` 各 native/HTTP 路径可 `Abort`；统一取消 command；**v1 维持**前端丢弃结果（`online-stt-*` job id） | `run_transcribe_cmd.rs`、`transcribe_native_*`；工作量大，按 adapter 分批 |
| **Q-PLUGIN-1** | **Plugin 权限强制 v1.1**（方案 A）：v1 仅 **内置白名单** + `loadBuiltinPlugins()`；`permissions` 字段暂 warn-only | `plugin-system/` |
| **Q-SIDECAR-1** | **2026-06-03 拍板 · 已被 R3h-1-R 部分取代**：Release CI **三平台**编 sidecar + smoke（[`release.yml`](../../../.github/workflows/release.yml)）；Mac DMG **仍含 bundled-asr** + manifest OTA 并存（checklist §7）。**仍有效**：侧车与模型分开展示（LRC）；[`asr-sidecar-build-nightly.yml`](../../../.github/workflows/asr-sidecar-build-nightly.yml) 作手动/夜间补充 | 勿再写「CI 不编 mac/win sidecar」 |

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
| **P1** | Setup / 发布 / Supervisor 硬化 | **R3h-I1** ✅ · **I2/I3** 🟡 编码✅ / 架构收口未闭合 |
| **P1** | 发版自动化子集 | **TEST-AUTO**（corrupt / 长音频慢测 / FSM contract；R9 硬门禁） |
| **P1** | 单机修订时间线 | **REV-LOC** ✅（§4.1.1 **⑤‴½**；[acceptance](../specs/rev-loc-undo-edit-history-acceptance.md) 2026-06-03） |
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
| 在线 STT 环境 UI | ✅ 主体已有 | `EnvOnlineSttPanel` + 合约测试；**百炼 / OpenAI / AAI / DG** + **`iflytek-speed-asr`**（ACC-STT-IFLYTEK ✅ 2026-06-18） |
| FunASR 模型下载 UI | ✅ 主体已有 | `usePrepareModelController` + `EnvLocalAsrPanel` |
| 本机 ASR 一键诊断/准备（R3f） | ✅ **mac** / Win ⏳ | `asr_setup/` + `LocalAsrSetupWizard`；mac 安装包机器签收 2026-06-09 — [signoff](../specs/r3f-phase-signoff-2026-06.md) |
| **本地运行时目录 LRC（R3h）** | 🟡 尾项硬化 | R3h-0/1/2/3 ✅ · **R3h-1-R CI 编码 ✅**；Win ⏸ |
| 诊断包导出入口 | ✅ 已有 | 工具栏菜单；R9 + **TRN-DIAG** ✅ |
| LLM 后处理（R2 标点） | ✅ 已交付 | `postprocess_cmd`；**R3t-C/D** 曾交付；**R3t-E** ⏸ 移除 → **F0 阶段 B** |
| MCP / 协作服务 | ❌ 未开始 | 无 `services/mcp`、`services/collab` |
| 桌面 profile 导入导出（无 secret） | ✅ R3b | `profile.rs` + 环境页「配置迁移」 |
| 桌面质量 Tab | ✅ | 欢迎页「质量概览」；[signoff](../specs/r4-quality-gate-signoff-2026-06.md) 2026-06-03 |
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

> §4 周次表保留 R5–R8 作 **参考估算**；**个人 v1 以 §3.1 为准**，R9 可在 R4 后直接签收（约 **17～20 周** 自 W1，含 R3 **~10～13w**）。
---

## 4. 排期表（单人、日历周）

> 周次以 **2026-05-26（周一）** 为第 1 周起点估算；按实际完成滑动，**不并行开两个大阶段**。  
> **个人 v1 只看下表「v1 路径」行**；R5–R8 见 §6。

### 4.0 个人单机 v1 路径（排期真源）

| 阶段 ID | 周次（约） | 主题 | 预估 |
|---------|------------|------|------|
| R0、GLY-1、R1、R2 | W1–W3 | ✅ 已完成 | — |
| **R3** | W4–W16+ | 本机 ASR + 转写 + LLM + 交付；**细序 §4.1.1** | **~12～15w**（§4.1.1 薄片串行 + **R3h-0 smoke 专轮** + ⑤″f **4–6w** + Qwen3 门控；2026-06-02 审查 +2w 缓冲） |
| **R4** + **R4-GATE** | +1.5w | 质量 Tab + eval 回归门禁 | 1.5w |
| **R9** | +1w | 个人单机 REL-1 | 1w |

**说明**：R3 宏观行经三次校正（4～5w → 8～10w → 10～13w → **12～15w**）；**以 §4.1.1 薄片推进为准**。缓冲显式计入：**① R3h-0 跨平台 smoke（2–3d 专轮，可与 ⑤″f-A 并行）**、**③ R3f 发行闭环**、**⑤″f 含 MEM（4–6w）**、**Qwen3 Go/No-go 门控**、**R3h-3.5 Sherpa Spike**（R3e-C ✅ 2026-05-31）。  
**v1 后（不占 v1 阻塞）**：R5 MCP、R6–R8 协作、LLM-LOC Spike→Gate。

### 4.0.1 全量参考表（含已完成与 v1 后）

| 阶段 ID | 状态 | 主题 | 预估 |
|---------|------|------|------|
| R0 / GLY-1 / R1 / R2 | ✅ | 工程收口、术语 UI、LLM 标点规格与实现 | — |
| **R3** | 🟡 | §4.1.1 全线 | ~12～15w |
| **R4** | ✅ | QLT-1 + R4-GATE · 2026-06-03 | 1.5w |
| **R9** | ✅ **验收通过** | REL-1 个人 v1 | 1w | [strict-signoff 2026-06-03](../specs/r9-rel-1-strict-signoff-2026-06.md) |
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
| **B 转写真源** | 声学分段 + 编排 + 精度/STT 统一 + 可观测 + **长音频增量 preview** | ⑤′ R3t-A/B、**⑤g R3g-C**、**⑤h ACC-STT-UNIFY**、TRN-DIAG、⑥ R3e-B、**⑥½ R3e-C** |
| **C 发行成熟** | 弱网/回滚/三盏灯/可选 Spike | ⑦ R3h-2、⑦½ ASR-WARM、⑧ R3h-3、⑧½ R3h-3.5 |
| **D 可选 LLM** | 云端校对可插拔 + 交付 | ⑤″ R3t-C/D/E |
| **E 交付与质量** | Word + eval + 发版 | ⑤‴ EXP-WORD ✅、⑤‴½ REV-LOC ✅、**R4** ✅、**R9** ✅ |
| **F v1 后 LLM** | Spike → 4a → 4b | **LLM-LOC-4a** ✅ · 4b Gate-B 前不做 |

#### 4.1.1 实施顺序（严格串行，勿跳步）

> **2026-05-27 重排（Q-SEQ-1）**：**R3e-B 前移至 R3t-B 之后**（长音频在 LLM 块之前）；**HOT-UX 写入主序**（原仅在台账）。内核仍与 R3t-A 合并（Q-R3t-1）。  
> **2026-06-03**：**⑤‴½ REV-LOC** ✅；**下一主序**：**R4 + R4-GATE**（§10）。**2026-06-02**：R3g-C、ACC-STT-UNIFY、R3t-D ✅；MEM / R3h-0∥⑤″f-A / Qwen3 门控见 §4.1.9。

```text
[R3a–c 已完成]
    ↓
【A 能装能转】
① R3h-0   构建 smoke + Win 磁盘 + pip 主 UI 降级
    ↓
② R3h-1   local_runtime 编码（manifest 下载器 / 回滚）     ← ✅ 编码收口
②-R R3h-1-R  runtime manifest **发行激活**（HTTPS 默认源 + 发布流水线）     ← ✅ R1+R2 签收
    ↓
③ R3f     一键准备手测签收
    ↓
④ R3e-A   长音频超时止血（**非**多段验收；50min 只验超时/文案，见 Q-R3e-1）
    ↓
⑤ R3g-A   模型目录（**单 SKU Paraformer**；SenseVoice 已弃用/迁移）  ✅ 2026-05-27
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
⑤′b R3t-B   转写编排、原子写库、warnings；不自动 LLM  ✅ 2026-05-30
    ↓
⑤′½ TRN-DIAG  转写任务时间线 + 诊断包
    ↓
⑥ R3e-B   长音频进度/分片（若 R3t-A 已覆盖内核则减量）  ✅ 2026-05-30
    ↓
⑥½ R3e-C   窗末 incremental preview + 停止转写 + preview 门禁  ✅ 2026-05-31
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
⑤″f 词表与改稿轨（R3t-F + ASR-VOC + MEM）— [`r3-asr-voc-holistic-review-2026-05.md`](../specs/r3-asr-voc-holistic-review-2026-05.md) · [`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) · [`r3t-f-correction-memory-optimization-plan.md`](../specs/r3t-f-correction-memory-optimization-plan.md) · **§4.1.9**
    ├ ⑤″f-A  VOC-1 收尾手测 ‖ F2 合入手测 ‖ VOC-5 eval（先于 F7）
    ├ ⑤″f-B  F1 + F6 + VOC-2c/d + F6+ + VOC-GUARD + MEM-P0
    ├ ⑤″f-B½ MEM-P1（记忆 UI + LEX-MINE-1 + 中文纳入记忆矩阵巩固）
    ├ ⑤″f-C  F7 词表包 + **F0（A→B 编排）** ‖ MEM-P2 ✅ — [F0 plan](../specs/f0-post-transcribe-orchestration-plan.md)
    └ ⑤″f-D  VOC-3 在线三家排序/截断（ACC 在线 E2E ≥1 家）
    （⑤″f-4 VOC-4 暂缓 · ACC-HOT-W/2pass → §8.1 · Spike MEM-S1）
    ↓
【E 交付与质量 — SKU 门控】
⑤″f-E  R3g-B Qwen3-ASR Go/No-go  ❌ No-go 2026-06-03（不挡 ⑤‴）
    ↓
⑤‴ EXP-WORD
    ↓
⑤‴½ REV-LOC ✅ 2026-06-03（切片 A/B；[acceptance](../specs/rev-loc-undo-edit-history-acceptance.md)）
    ↓
R4 + R4-GATE ✅ → R9 ✅ 2026-06-03   ← **v1 主序已闭合**；**v1.1+ 见 §10.4**
```

#### 4.1.2 子项台账

| 序 | ID | 状态 | 预估 | 交付摘要 | 规格真源 |
|----|-----|------|------|----------|----------|
| — | R3a/b/c | ✅ | — | keychain、profile、缓存/manifest | 各 acceptance |
| **①** | **R3h-0** | ✅ **mac** / Win §4 豁免 | 2–3d | mac 机器闸门 ✅（2026-06-06 · 复验 2026-06-08）；Win 有 Win 机时补 §4 | [r3h-0 acceptance](../specs/r3h-0-asr-sidecar-build-smoke-acceptance.md) · [signoff](../specs/r3h-0-phase-signoff-2026-06.md) |
| **②** | **R3h-1** | ✅ | 5–7d | 编码：`local_runtime/`、signed manifest、pinned key、**install 事务回滚**、**手动恢复 previous**。**非**自动升级健康回滚（→ R3h-2/I2）。**发行** → **②-R** ✅ | remediation §5 Phase 1 + §11、§4.1.5.1 |
| **②-R** | **R3h-1-R** | ✅ | 3–5d | **HTTPS 默认 manifest URL**；`npm run runtime:publish-manifest`；R2 UI 降噪；R1+R2 签收 [`signoff`](../specs/r3h-1-r-phase-signoff-2026-06.md) | [`plan`](../specs/r3h-1-r-runtime-manifest-release-activation-plan.md) · [`checklist`](../specs/r3h-1-r-release-checklist.md) |
| **③** | **R3f** | ✅ **mac** / Win ⏳ | 2–3d | 诊断 + 一键准备 + 8741 冲突；mac 安装包机器闸门 2026-06-09 | [`r3f-asr-setup-wizard-acceptance.md`](../specs/r3f-asr-setup-wizard-acceptance.md) · [signoff](../specs/r3f-phase-signoff-2026-06.md) |
| **④** | **R3e-A** | ✅ | 2–3d | 动态超时 + 失败分类；**2026-06-07 复验签收** | [`r3e-long-audio-transcribe-acceptance.md`](../specs/r3e-long-audio-transcribe-acceptance.md) · [signoff](../specs/r3e-a-phase-signoff-2026-06.md) |
| **⑤** | **R3g-A** | ✅ | 3–5d | **单 SKU（Paraformer）** + `prepare(model_id)`；SenseVoice hub id **deprecated** 自动迁移；**⑤a–c** 手测签收（2026-05-27） | [`r3g-local-asr-model-catalog-acceptance.md`](../specs/r3g-local-asr-model-catalog-acceptance.md) · `localAsrModelCatalog.ts` |
| **⑤½** | **HOT-UX** | ✅ | 0.5w | 热词 12k 截断可观测；术语页「本次转写将携带」摘要 | [`hot-ux-acceptance.md`](../specs/hot-ux-acceptance.md) |
| **⑤′a** | **R3t-A** | ✅ | 3–5d | `segmentation.py` + FunASR 接线 + 单测 + **手测签收**（2026-05-30） | [`recording-transcribe-llm-refine-acceptance.md`](../specs/recording-transcribe-llm-refine-acceptance.md) §R3t-A |
| **⑤g** | **R3g-C** | ✅ | 3–5d | **AsrModelProfile**；SenseVoice `use_itn` + postprocess；Paraformer 保持 punc 路径；TypeError 剥参 + warnings；环境页 **识别语言**；**不**暴露全 generate UI | [`r3g-c-asr-generate-profile-acceptance.md`](../specs/r3g-c-asr-generate-profile-acceptance.md)、[`r3g-c-hand-test-checklist.md`](../specs/r3g-c-hand-test-checklist.md) 2026-05-31 签收；架构 [`asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md) |
| **⑤h** | **ACC-STT-UNIFY** | ✅ **2026-05-31** | 2–4d | **`SttVocabularyPlan`** + 三家 adapter；U2 `sttVocabularyBias`；**U3** ✅（R3h-3）；本机手测 ✅；**百炼 E2E ✅** 2026-06-12；**U4 延后** | [`acc-stt-unify-acceptance.md`](../specs/acc-stt-unify-acceptance.md)、[`acc-stt-unify-hand-test-checklist.md`](../specs/acc-stt-unify-hand-test-checklist.md) |
| **⑤′b** | **R3t-B** | ✅ | 2–4d | 转写任务、超时、原子写库、warnings UI；**不自动 LLM** | 同上 §3；[`r3t-b-hand-test-checklist.md`](../specs/r3t-b-hand-test-checklist.md) 2026-05-30 签收 |
| **⑤′½** | **TRN-DIAG** | ✅ | 0.5w | 时间线 UI + 诊断包 `transcribe_timeline.json` | [`trn-diag-acceptance.md`](../specs/trn-diag-acceptance.md) |
| **⑥** | **R3e-B** | ✅ | 1.5–2w | 长音频侧车 5min 窗；**2026-05-30 签收** | [`r3e-b-hand-test-checklist.md`](../specs/r3e-b-hand-test-checklist.md) |
| **⑥½** | **R3e-C** | ✅ | 1–1.5w | async Job + 120s 窗末 preview merge；停止转写；preview 禁 save/LLM；**2026-05-31 手测签收**（制控.mp3） | [`r3e-c-incremental-transcribe-acceptance.md`](../specs/r3e-c-incremental-transcribe-acceptance.md)、[`r3e-c-incremental-transcribe-hand-test-checklist.md`](../specs/r3e-c-incremental-transcribe-hand-test-checklist.md) |
| **⑦** | **R3h-2** | ✅ | ~1w | Range 续传 · 下载进度 UI · GC · **C 类自动回滚**（集成测 `test-r3h-2-c-rollback.sh`） | [`r3h-2 acceptance`](../specs/r3h-2-local-runtime-resume-acceptance.md) · remediation §5 Phase 2 |
| **⑦½** | **ASR-WARM** | ✅ **2026-06-12** | 0.5–1w | `supervisor.rs` + `warm.rs`；dev + **release idle H5** 签收 | [`asr-warm-acceptance.md`](../specs/asr-warm-acceptance.md)、[`asr-warm-release-idle-signoff-2026-06-12.md`](../specs/asr-warm-release-idle-signoff-2026-06-12.md) |
| **⑧** | **R3h-3** + **R3d** | ✅ **2026-06-10** | 3–5d | 本机 ASR / 在线 STT / LLM 三盏灯；五栏 IA | [`r3h-3-environment-readiness-acceptance.md`](../specs/r3h-3-environment-readiness-acceptance.md) |
| **⑧½** | **R3h-3.5** | ✅ **Partial Go** | ~1w | Sherpa Paraformer Spike；v1 仍 FunASR 主路径 | [`r3h-3.5-sherpa-spike-acceptance.md`](../specs/r3h-3.5-sherpa-spike-acceptance.md) · [ADR-0006](../../adr/0006-sherpa-onnx-paraformer-spike-evaluation.md) |
| **R3s-A** | **Sherpa Qwen3 默认引擎** | 📋 **Defer**（research ✅） | ~4–6w phased（**G1 前不编码**） | 战略方向 = Qwen3 ONNX；**现默认仍 Paraformer**；薄预留 spike/eval/LRC schema；升级见 [plan §Defer](../specs/r3s-sherpa-qwen3-default-engine-plan.md) | [research](../specs/r3s-sherpa-qwen3-default-engine-research.md) · [plan](../specs/r3s-sherpa-qwen3-default-engine-plan.md) · [ADR-0007](../../adr/0007-sherpa-qwen3-default-asr-engine.md) |
| **⑤″c** | **R3t-C** | ✅ | 1–1.5w | 扩展 R2 标点（邻段上下文可选）；**可选/显式触发** | 同上 §4；[`r3t-c-hand-test-checklist.md`](../specs/r3t-c-hand-test-checklist.md) 2026-05-30 签收 |
| **⑤″d** | **R3t-D** | ✅ **2026-05-31** | 1.5–2w | `postprocess_refine_segments` + 段界整理 UI | [`r3t-d-hand-test-checklist.md`](../specs/r3t-d-hand-test-checklist.md) |
| **⑤″e** | **R3t-E** | ⏸ **已移除** | — | 独立菜单/API 已删；**词表校对能力** → **F0 阶段 B**（`postTranscribeStageB`） | [`archive/r3t-e/r3t-e-hand-test-checklist.md`](../specs/archive/r3t-e/r3t-e-hand-test-checklist.md) |
| **⑤″f** | **R3t-F + MEM** | 🟡 **尾项闭合** | P1–P2 大部 ✅ | A–D + MEM-P0–P2 + F7/F8/F0 ✅；**F4 No-go**；F3/F5 P3 未做 | [`r3t-f-post-transcribe-suite-acceptance.md`](../specs/r3t-f-post-transcribe-suite-acceptance.md) |
| **⑤″f-MEM** | **纠错记忆优化** | ✅ P0–P2 | ⑤″f-B～C | MEM-P0/P1/P2 ✅；P3/S1 未做 | [MEM acceptance](../specs/r3t-f-correction-memory-optimization-acceptance.md) |
| **⑤″f-E** | **Qwen3 SKU 门控** | ❌ **No-go** 2026-06-03 | 2–4d | 0 语段（缺 ForcedAligner）；Paraformer 制控 **197** 段 / **155s** | [results](../specs/r3g-b-qwen3-asr-spike-results.md) · [research](../specs/r3g-b-qwen3-asr-sku-spike-research.md) |
| **⑤″f-1** | **ASR-VOC-1** | ✅ **2026-06-02** | 1–2d | 转写前 preview + 覆盖确认框 + toast；契约+UI 手测签收 | [`asr-voc-1-hand-test-checklist.md`](../specs/asr-voc-1-hand-test-checklist.md) |
| **⑤″f-2** | **ASR-VOC-2** | ✅ 编码 | **7–10d** | 2a/2a+/2c/d/GUARD/F6+/F7(2b) ✅；**在线 E2E** ⏳（无 Key 豁免） | Plan §3 · **§4.1.9** |
| **⑤″f-3** | **ASR-VOC-3** | ✅ **2026-06-02** | 2–4d | 文案手测 + 机器；在线 E2E 豁免（无 Key） | [signoff](../specs/asr-voc-3-signoff-2026-06.md) |
| **⑤″f-5** | **ASR-VOC-5 = ACC-EVAL-1** | ✅ | 1–2d | `eval-run` hotwords on/off A/B + CSV；制控 `term_hit` baseline | [`asr-voc-5-hand-test-checklist.md`](../specs/asr-voc-5-hand-test-checklist.md) |
| **⑤″f-4** | **ASR-VOC-4** | ⏸ 暂缓 | — | 仅 `after_text` 直连 hotwords（≤20 词）；**默认 No**（**Q-ACC-8**；走 F6→glossary） | Plan §6 |
| **⑤″f-2+** | **F6+ 纳入记忆→术语表** | ✅ | 0.5–1d | 右键纳入 + 可选 `glossary_add`；第 3 次纳入后 F6 提示 | hand-test 2026-06-02 |
| **⑤″f-G** | **VOC-GUARD** | ✅ | 0.5d | hotwords 过滤 + `glossary_add/update/import` 拒绝错形 | **Q-ACC-8** |
| **⑤‴** | **EXP-WORD** | ✅ v1 功能验收 | 1–1.5w | 交付导出向导 + 三形态 DOCX + 润色预览门禁 + 修订轨/附录 | [`exp-word-formatted-export-acceptance.md`](../specs/exp-word-formatted-export-acceptance.md) |
| **Phase 10** | **项目 Hub + 场次元信息** | ✅ **2026-06-08** | ~1w | Hub 导航；`ProjectMetadataDialog` 五字段；重命名/删项目；Hub 编辑入口 | [`project-hub-metadata-acceptance.md`](../specs/project-hub-metadata-acceptance.md) |
| **⑤‴½** | **REV-LOC** | ✅ **2026-06-03** | 0.5–1w | **A** 撤销栈与自动保存对齐；**B** `edit_log` 快照恢复 MVP；[slice A signoff](../specs/rev-loc-slice-a-signoff-2026-06.md) · [slice B signoff](../specs/rev-loc-slice-b-signoff-2026-06.md)；**非** R8 | [research](../specs/rev-loc-undo-edit-history-research.md) · [plan](../specs/rev-loc-undo-edit-history-plan.md) · [acceptance](../specs/rev-loc-undo-edit-history-acceptance.md) |
| — | **R4** + **R4-GATE** | ✅ **2026-06-03** | 1.5w | 质量 Tab + 应用内 eval；[signoff](../specs/r4-quality-gate-signoff-2026-06.md) | [backlog §3.4](../specs/personal-solo-v1-backlog.md) · §732 |
| — | **R3t（索引）** | 📋 | — | Epic 总览（含 L6） | [`recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) |
| — | R3h-4 → **LLM-LOC** | v1 后 | 见 §6、[`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md)（**4a** Ollama ~0.5–1w；**4b** 自管 2–3w+） | remediation §Phase 4 |
| — | R3h-E/F、R3g-B | 延后 / P1 spike | — | 高级 pip/本地构建；**Qwen3 SKU** ❌ No-go；**Fun-ASR-Nano PyTorch** ❌ Defer；**Nano+vLLM** research ✅ · **❌ Defer 2026-06-18**（无 CUDA · 目前不做）；索引 [`r3-asr-landscape-2026-05-improvement-backlog.md`](../specs/r3-asr-landscape-2026-05-improvement-backlog.md) §4.1.8 | remediation §5 Phase 5、[`r3g-c-funasr-nano-spike-results.md`](../specs/r3g-c-funasr-nano-spike-results.md)、[`r3g-c-funasr-nano-vllm-research.md`](../specs/r3g-c-funasr-nano-vllm-research.md) |

#### 4.1.3 并行与禁忌

| 规则 | 说明 |
|------|------|
| **勿并行** | R3f 编排与 **R3e-B** 分片（同改转写链）；**R3t-A/B** 与 R3f **大改**勿同轮 |
| **R3g-C 门禁** | **R3g-C PR-1（Profile 内核）须先于 R3t-B** 合入，避免 `funasr_engine.py` 冲突；R3g-C 与 R3t-B **勿同轮大改**侧车+编排 |
| **ACC-STT-UNIFY** | 可与 **R3g-C2 之后** 并行（主改 Tauri `run_transcribe` / `stt_native`）；**须**在 R3t-B warnings UI 前或同轮接入 vocabulary hints |
| **R3t 门禁** | **R3g ⑤c** 建议先签收再开 **R3t-A** 编码；R3e-B 与 R3t-A **同一分段真源**（禁止 fork 两套 VAD） |
| **R3t-F + ASR-VOC** | **⑤″e R3t-E 手测后** 开 **⑤″f**；**ASR-VOC-1** 与 **F2** 同轮并行（不同文件）；**ASR-VOC-3** 依赖 **⑤h ACC** ✅；**ASR-VOC-5** 先于 F7 |
| **R3h-0 ∥ ⑤″f-A** | **① R3h-0 smoke（2–3d 专轮）** 与 **⑤″f-A** **可并行**（不同目录）；**勿**在 R3h-0 未闭环时签收 **③ R3f** |
| **Qwen3 门控** | **⑤″f-E** ✅ **No-go**（2026-06-03）；**R3g-B-Align** ✅ spike **Defer**（2026-06-11 CPU 不可接受）→ **❌ 废弃 2026-06-18**；本机 catalog **维持 Paraformer 单 SKU** |
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

> R3h-1 **不包含 C**；roadmap 勿写「企业级自动回滚已完成」。**R3h-1-R** 默认 HTTPS 源 + R1/R2 手测 ✅（2026-06-10）；**Release CI mac/linux ✅**（v0.1.0）；**Windows job 🟡**（ps1 已对齐，待 release 重跑绿）。

**与 Q-SIDECAR-1 关系（2026-06-12 修订）**：[`release.yml`](../../../.github/workflows/release.yml) **linux/macos/windows** 均在 Tauri 打包前编 sidecar 并 smoke；与 2026-06-03「CI 不编 mac/win sidecar」**已 supersede**。Mac fat DMG 仍含 **bundled-asr**；manifest zip 管 OTA / 损坏修复（checklist §7）。

#### 4.1.5.2 R3h-1-R — Runtime Manifest 发行激活（LRC 上线）

**背景**：`RUSHI_LOCAL_RUNTIME_MANIFEST_URL` 未配置时 UI 可走 bundled / 应用内 manifest 下载；**本轨**让「应用内下载 / 修复侧车」对发行用户默认生效。

**三阶段**（详表见 [`r3h-1-r-runtime-manifest-release-activation-plan.md`](../specs/r3h-1-r-runtime-manifest-release-activation-plan.md)）：

| 阶段 | 主题 | 交付 | 阻塞 |
|------|------|------|------|
| **R0** | 本地验通 | `prepare-local-runtime-fixtures.sh` + 无 bundled 手测 | 无 |
| **R1** | 最小发行 | HTTPS 默认 manifest URL；CI `publish-runtime-manifest`；release 私钥签名；remediation §11 零终端 / 构建 smoke | ✅ **2026-06-10** |
| **R2** | 产品串联 | 一键准备自动下载；bundled OK 时 UI 降噪；弱网续传归 **R3h-2** | ✅ **2026-06-10** |

**勿混淆**：`RUSHI_MODEL_VERIFY_MANIFEST` = **模型权重**校验（R3c）；本轨 = **侧车运行时** `rushi-runtime-manifest.json`。

| 子轨 | 对齐目标 | 主要落位 | **启动条件（定量）** |
|------|----------|----------|----------------------|
| **R3h-I1 Runtime Supervisor** | 显式 sidecar supervisor FSM、watchdog、runtime identity | `asr_sidecar.rs`、`lib.rs`、`asr_setup/diagnose.rs` | **R3h-1 编码签收** + remediation §11 **零终端/诊断** 手测通过后 → 可开 **设计**；**编码收口**不早于 **R3h-2 开始** |
| **R3h-I2 Release System** | GC、Range 续传、**C 类自动回滚**、下载进度 | `local_runtime/*.rs` | **🟡 编码✅**（R3h-2）；**未**统一 progress event bus / reducer |
| **R3h-I3 Setup Machine** | ASR setup 单一 reducer / 状态机 | `useAsrSetupController.ts`、`asr_setup/` | **🟡 编码✅**（前端 ~122 行）；Rust 仍为 diagnose 命令集，**无**完整 Setup FSM |
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
| **R3t-B** | R3t-A | 转写编排、原子写库、warnings；**不自动 LLM** | ✅ 2026-05-30 |
| **R3t-C** | R3t-B；R2 ✅ | 标点 + 可选邻段上下文 | ✅ 2026-05-30 |
| **R3t-D** | R3t-C 契约 | merge/split/update_text + 双 diff | 同左 |
| **R3t-E** | R3t-D | LexiconPack；**无 RAG**；不传 hotwords 串 | 同左 |

**学习环（已交付 + MEM 规划）**：

```text
glossary_terms ──► L2 hotwords（仅 canonical + aliases；禁止 before_text / 错形 alias，Q-ACC-5/8）
落库 → infer + [MEM-P0] 显式 upsert → correction_memory
         ├─ hit≥2 | accepted → hints / F1 / LexiconPack（L4 改当前稿）
         ├─ hit≥3 right → F6 弹窗 → glossary（L2 下次转写）
         └─ [⑤″f-2+] 纳入记忆确认 → 可选一键 glossary + hotword_enabled（不必等 hit≥3）
采纳为规则（R3t-E / MEM-P1）→ accepted_as_rule=1
```

**增强项（排期）**：**HOT-UX** ✅；**MEM-P0～P2**（⑤″f-B～C）；**LEX-MINE-2+** §8.1；R3t-E3 项目级词表 **不做 v1**。

**交付导出（L6）**：**EXP-WORD** 在 **R3t-E 之后**、**R4 之前**（§8.2 Q-WORD）；与 P3 DOCX **基线**分层。**REV-LOC** ✅ 2026-06-03（EXP-WORD 后、R4 前；见 **Q-REV-1**）。**下一主序**：**R4 + R4-GATE**。

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
| **L6** | CER / term_hit 回归集 | **ACC-EVAL-1**、**ASR-VOC-5**（⑤″f-5）、R4 | 维护 eval manifest；热词 on/off A/B |
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
| **C4** | 环境页识别语言（**默认 `zh`**）；**产品目录仅 Paraformer**（`iic/SenseVoiceSmall` deprecated → 自动迁移）；R3g-C Profile 仍保留 SenseVoice **参数预设**供侧车 legacy id |

**ACC-STT-UNIFY 子切片（§4.1.1 **⑤h**）**：

| 子片 | 交付 |
|------|------|
| **U1** | `SttVocabularyPlan`；**OpenAI + AssemblyAI + Deepgram** 词表 adapter（v1 三家必接） |
| **U2** | `supportsHotwordBias` / 能力矩阵真源；`online_vocabulary_*` warnings |
| **U3** | 环境页本地 vs 在线词表能力对照 → **跟 R3h-3 三盏灯**（**不**与 U1 同轮硬绑） |
| **U4** | 在线失败回落本机 ASR（`fellBackToLocal`）→ **v1 不做**；仅 warning + 用户重试 |

**明确仍不做（ACC v1）**：FunASR 全参数 UI；RAG；静默 LLM 改稿；无评测默认开音频降噪；术语 **alias 填误写形**。

**ACC 候选（§8.1，Go 后再插入）**：ACC-MODEL-1（hotword SKU）、ACC-HOT-W（带权热词）、ACC-STT 阿里 vocabulary_id、ACC-IN-2/3、ACC-TXT-2 拼音引擎。

#### 4.1.8 ASR 生态改进轨（2026-05 调研，**不改 §4.1.1 主序**）

> **Backlog 真源**：[`r3-asr-landscape-2026-05-improvement-backlog.md`](../specs/r3-asr-landscape-2026-05-improvement-backlog.md)  
> **用途**：记录 2026-04～05 行业 STT 动态与 Rushi 代码对照；**P0 项须回写 §4.1.1**；P1/P2 可与主序 **并行 spike**，不阻塞 R3g-C。

| 优先级 | ID | 收益 | 估时 | 依赖 | 状态 |
|--------|-----|------|------|------|------|
| **P0** | **R3e-C** | 长音频 preview + 停止转写 | — | — | §4.1.1 **⑥½** | ✅ 2026-05-31 |
| **P0** | （主序内）**R3g-C / ACC-STT-UNIFY / ACC-EVAL-1** | Profile + 词表统一 + 专名回归 | 见 §4.1.1 | R3t-B ✅ | R3g-C ✅ / ACC ✅（在线 E2E ⏳） |
| **P1** | **R3h-ASR-VER** | FunASR **≥1.3.3** lock（**v1 后升级**，不阻塞 ⑤″f） | 1–2d | — | 📋 |
| **P1** | **R3g-B / ⑤″f-E Qwen3 spike** | 第三 SKU Go/No-go | 2–4d | — | ❌ **No-go** 2026-06-03 |
| **P2** | **R3g-B-Align** | Qwen3 **ForcedAligner** 时间轴 | spike 2026-06-11 | ⑤″f-E No-go | ❌ **废弃** 2026-06-18 — CPU ~8× Paraformer；[results](../specs/r3g-b-align-forced-aligner-spike-results.md) · **不再做** |
| **P1** | **R3h-CUDA-PERF** | CUDA 侧车 p95 / 首段 SLA | 3–5d spike | R3e-C DEV log | 📋 |
| **P1** | **R3e-C.5 event** | poll → Tauri event，降 CPU | 1–2d | R3e-C ✅ | 📋 |
| **P2** | **R3g-C-NANO PyTorch** | Fun-ASR-Nano-2512 同栈 spike | — | research ✅ | ❌ **Defer** 2026-06-17 — [`spike-results`](../specs/r3g-c-funasr-nano-spike-results.md) |
| **P2** | **R3g-C-NANO vLLM** | GPU 第二运行时（`AutoModelVLLM`） | spike 2–4d | PyTorch Defer + **无 CUDA 环境** | ❌ **Defer** 2026-06-18 — research 保留 · [`vllm-research`](../specs/r3g-c-funasr-nano-vllm-research.md) |
| **P2** | **R3g-B Nano+vLLM** | （别名）同上 vLLM 轨 | — | 合并至上行 | 📋 |
| **P2** | **ASR-RADAR-FireRed** | 中文 CER SOTA；统一 VAD+LID+Punc；**v1 后**第三引擎评估 | 跟踪 | Sherpa Spike 结论 | 📋 雷达 |
| **P2** | **ASR-RADAR-Moonshine** | 27M 边缘低 RAM；中文精度未达 Paraformer | 跟踪 | 边缘场景需求 | 📋 雷达 |
| **P2** | **STREAM-*** / 在线 Realtime | OpenAI Realtime-Whisper 等 | 新 Epic | ACC-STT-UNIFY | ⏳ |
| **—** | Parakeet / MiMo / WS 替换 R3e-C | 与 ADR-0003 或 SQLite 真源冲突 | — | — | **不做** v1 |

**建议叠加顺序**（backlog §5）：（主序）v1 **已闭合** → **§10.4 v1.1+** Step 10–12；**本机第三 SKU 线**（Qwen3 / Nano / vLLM / ForcedAligner）**全部关闭**；并行 **P1 讯飞** · **热点拆分** · **Win 资产**。

#### 4.1.9 ⑤″f 改进清单（2026-06-02 · ASR 热词业内调研吸收）

> **调研真源**：[`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md)（L0/L1 阶梯、厂商对照、**§6 ASR-VOC-1～5**）；[`r3t-f-edit-memory-for-llm-research.md`](../specs/r3t-f-edit-memory-for-llm-research.md)（L1/L4 分通道）；[`r3t-f-chinese-text-diff-remediation-research.md`](../specs/r3t-f-chinese-text-diff-remediation-research.md)（纳入记忆算法，**非**热词替代）。  
> **任务拆片**：[`r3-asr-voc-landing-plan.md`](../specs/r3-asr-voc-landing-plan.md) · [`r3-asr-voc-landing-acceptance.md`](../specs/r3-asr-voc-landing-acceptance.md)

**原则（与业内一致，不调整）**：`correction_memory.before_text` **不得** 进 `hotwords`（**Q-ACC-8**）；L2 只服务「希望听成的正形」；同音形错靠 L4 + 词表闭环，不单靠热词堆错形。

| 优先级 | ID | ⑤″f 期 | 改进项 | 估时 | 验收锚点 |
|--------|-----|--------|--------|------|----------|
| **P0** | VOC-1-手测 | **A** | ✅ 2026-06-02（契约+UI） | — | [`asr-voc-1-hand-test-checklist.md`](../specs/asr-voc-1-hand-test-checklist.md) |
| **P0** | VOC-5 | **A** | 制控样例 **hotwords on/off** → `term_hit_rate` 可对比存档 | 1–2d | **✅** 编码 2026-06-02；手测 [`asr-voc-5-hand-test-checklist`](../specs/asr-voc-5-hand-test-checklist.md) |
| **P0** | VOC-2c/d | **B** | 术语库 **Custom Vocabulary** 文案；`hotword_enabled` tooltip；**别名勿填误听形**；空表/全关 CTA | 0.5–1d | **✅** 编码 2026-06-02 |
| **P0** | F6+ | **B** | 右键纳入记忆 + 可选进术语表；第 3 次纳入后 F6 提示 | 0.5–1d | **✅** hand-test 2026-06-02 |
| **P0** | F6 | **B** | hit≥3 弹窗 / GlossaryMine；`term≠before_text` 守卫 | 含 2a | **✅** hand-test 2026-06-02 |
| **P0** | VOC-GUARD | **B** | `build_glossary_hotwords` 过滤 `correction_memory.before_text` | 0.5d | **✅** `hotword_guard.rs` 单测 |
| **P0** | MEM-P0 | **B** | 显式 upsert、hit 与自动保存解耦 | 2–3d | **✅** 2026-06-04 |
| **P1** | F7 | **C** | `rushi_lexicon_bundle.v1` 小团队导出/导入/冲突 | 4–6d | **✅** 编码+手测 2026-06-03 |
| **P1** | F8 | **C** | 导出前预览向导（条数/噪声/同 before） | 1–2d | **✅** 2026-06-11 |
| **P1** | MEM-P1 | **B½** | 记忆 UI + LEX-MINE-1 | 3–4d | **✅** 2026-06-04 |
| **—** | F4-ASR | — | ASR 置信门控 | — | **❌ No-go** 2026-06-11（本机/百炼无可用 confidence） |
| **P1** | VOC-3 | **D** | OpenAI prompt 排序截断；AssemblyAI/Deepgram 条数与文案 | 2–4d | Plan §4；在线 E2E 闸门 |
| **P2** | ACC-HOT-W | §8.1 | FunASR `词 权重`；12k 截断 **高优先级先保留** | spike | landscape backlog |
| **P2** | FUN-2PASS | §8.1 | 长音频句末 2pass（与热词互补） | spike | R3e 长音频 SKU |
| **⏸** | ASR-VOC-4 | — | memory `after_text` 直连 hotwords | — | **默认 No**（**Q-ACC-8**） |

**建议编码顺序（墙钟内）**：**VOC-1 手测** → **VOC-5** → **VOC-2c/d + F6+ + VOC-GUARD** ‖ **F1/F6 手测** → **F7** → **VOC-3**。

### 阶段状态（实施时更新）

| 阶段 ID | 状态 | 完成日 |
|---------|------|--------|
| R0 | ✅ 已完成 | 2026-05-25 |
| GLY-1 | ✅ 已完成（手测通过） | 2026-05-25 |
| R1 | ✅ 已完成（文档门禁） | 2026-05-25 |
| R2 | ✅ 已完成（DeepSeek 手测通过） | 2026-05-25 |
| R3 | 🟡 **v1 功能闭合**；尾项硬化见 §10 | — |
| R3h | 🟡 LRC **mac ✅**；**R3h-1-R CI 编码 ✅**；Win smoke ⏸ | — |
| R4 | ✅ 2026-06-03 | 2026-06-03 |
| R5 | ⏳ v1 后 | — |
| R6–R8 | ⏳ 非 v1 | — |
| R9 | ✅ 2026-06-03 | 2026-06-03 |

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

| 子项 | 主题 | 状态（2026-06-11） |
|------|------|-------------------|
| R3a | LLM keychain + probe | ✅ |
| R3b | Profile 导入导出 | ✅ |
| R3c | 缓存 / manifest / 清缓存 | ✅ |
| **R3h** | **本地运行时目录（LRC）** | 🟡 **①–⑧½ + I1a + ASR-WARM ✅**；**I2/I3 编码✅ / 收口未闭合**；尾项 **Win Release CI 🟡** |
| **R3f** | 一键环境准备 | ✅ mac / Win ⏸ |
| **R3e** | 长音频 | ✅ A/B/C |
| **R3g** | 模型目录 + Profile | ✅ |
| **R3t** | 分段 + 编排 + F0 阶段 B | ✅；**R3t-E 独立** ⏸ |
| **⑤″f** | 改稿套件 + MEM + F7/F8 | ✅；**F4** ❌ |
| **TRN-DIAG** | 转写时间线 + 诊断包 | ✅ 2026-06-11 |
| **R3d** | 环境 IA | ✅ 与 **R3h-3** 合并 |

**实施顺序**：**仅 §4.1.1**。

---

### R3h — 本地运行时目录（LRC，发行整改）

**目标**：侧车（推理运行时）与语音模型（权重）**分开展示、分发、验收**；统一 Installer，引擎可替换。

| 子阶段 | 主题 | 阻塞关系 |
|--------|------|----------|
| **R3h-0** | 构建正确 + CI smoke + 诊断 corrupt + Win 磁盘 | **阻塞一切发行手测** |
| **R3h-1** | `local_runtime/` 编码：HTTPS 下载 + app_data 侧车 + signed manifest / current+previous / rollback | ✅ |
| **R3h-1-R** | Runtime manifest **发行激活**：默认 HTTPS 源 + 发布流水线 + 零终端 VM 手测 | ✅ mac/linux/Win CI · **Win v0.1.0 资产待补** |
| **R3h-2** | 断点续传、自动下载编排、GC / progress events / 升级收口 | 阻塞 R9 弱网场景 |
| **R3h-3** | 三盏灯就绪页（合并 R3d） | ✅ 2026-06-10 |
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

**验收真源**：[`r3e-long-audio-transcribe-acceptance.md`](../specs/r3e-long-audio-transcribe-acceptance.md)、[`r3e-b-hand-test-checklist.md`](../specs/r3e-b-hand-test-checklist.md)。**R9 REL-1 长音频主路径**已于 **2026-05-30** 签收（~48.6min）。

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
| **长音频主路径** | 30～60min：转写 →（**R3t-C 标点** 或手改）→ 编辑 → **EXP-WORD**；撤销/历史恢复 **REV-LOC** ✅ |
| **TRN-DIAG** | 失败一次转写：UI/诊断包能指出阶段与建议动作 |
| **ASR-WARM** | 同项目连续转写：第二次无明显冷启动劣化（手测） |
| **R4-GATE** | eval 集已跑；质量 Tab 有摘要；**含 ACC-EVAL-1** |
| **TEST-AUTO** | corrupt 侧车 fixture +（可选）长音频慢测 + Setup/转写 FSM contract 已跑 |
| **LLM 档位 Mid** | **R3t-B + R3t-C** 为 R9 **硬门禁**；**R3t-D/E 可减 scope**（不挡 R9，仍尽量在 R4 前闭合）；无 LLM 配置仍可转写 → 手改 → 导出 |
| **REV-LOC** | ✅ 撤销对齐 + `edit_log` 快照恢复 MVP（[acceptance](../specs/rev-loc-undo-edit-history-acceptance.md) 2026-06-03） |
| 脚本 | `p0-acceptance.sh`、P1–P4 按需抽检 |
| 文档 | §2 状态表；T-006 行数表对齐 |
| 可选 | E2E 一条主干；波形性能记录 |
| **不含** | R6–R8 协作签收、C4–C7、MCP 写路径 |

**手测清单摘要**：[`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md) §5。

---

## 6. 第二阶段 / 远期（**非个人 v1**）

> **第二阶段排期真源（2026-07-18 · ✅ 已归档基线）**：[`rushi-phase-2-roadmap.md`](./rushi-phase-2-roadmap.md)  
> 默认主序：**Wave M 媒体（AV-PRE/EDIT-BASIC）→ Wave C 协作（R6–R8/C4–C6）→ Wave D 部署（C7/COL-DEPLOY）**。  
> 下表为索引；薄片顺序与验收以 Phase 2 文档为准（含 §8.1–§8.2 工程纪律）。

| ID | 主题 | 前置 |
|----|------|------|
| **Phase 2** | 媒体成熟 + 小团队协作 + 双部署 | R9 或产品书面启动；详规 [`rushi-phase-2-roadmap.md`](./rushi-phase-2-roadmap.md) |
| **AV-PRE / EDIT-BASIC** | 预处理三入口 + Trim/删区/Split（`source`/`working`） | Phase 2 Wave M；[research](../specs/av-preprocess-import-flow-research.md) · [plan](../specs/av-preprocess-edit-basic-plan.md) |
| **R6–R8** | 协作 C1–C3（骨架 / 只读 / 写入） | Wave C；产品书面可提前 demo |
| **R5** | MCP 只读 | T-002；可与 Phase 2 并行 |
| **LLM-LOC** | 本机 LLM 校对（Ollama → LRC 自管） | **R9 + R3t-E** 后：**SPIKE → Gate**；**未过 Gate 不编码** | [`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md) §9–10 |
| C4 | 审阅线程与建议修改 | R8 |
| C5 | Presence 与活动流 | C4 |
| C6 | Word 审阅导出（协作） | C4 数据落库；**≠** 单机 **EXP-WORD**（§4.1.1 ⑤‴） |
| C7 | 离线缓存、部署包正式化 | C3 + 镜像；Phase 2 Wave D |
| **COL-DEPLOY** | `cloud_vps` + `lan`；**ASR 本机不上云** | C7 内或紧接；[plan](../specs/collab-dual-deploy-local-asr-plan.md) · [research](../specs/collab-dual-deploy-local-asr-research.md) · [画像](../../architecture/collab-deployment-profiles.md) |

规格已存在、实施等 C4 启动时再写 acceptance 增量：[`collaboration-review-word-export.md`](../specs/collaboration-review-word-export.md)。

**COL-DEPLOY 子薄片**：A 云 ACME · B LAN Local-CA · B′ 可选 RFC1918 降级 · C 可选 OSS · D 可选 mDNS（见 Phase 2 §5 Wave D）。

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
| T-010 | `run_transcribe_cmd/` · `online_segment_normalize/` · `useEnvOnlineSttPanel` 等 | **✅ 2026-06-19** | `9612aae` 目录化 + Wave A–H 清理；guard **0**；可选尾项 `sync.rs` 327L |
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
| **ACC-STT-ALI** | 百炼 `vocabulary_id` + `target_model` | Fun-ASR Realtime 热词 CRUD | ✅ 编码 2026-06-09；**百炼 E2E ✅** 2026-06-12（§10.2 Step 4） | [`acc-stt-ali-hand-test-checklist.md`](../specs/acc-stt-ali-hand-test-checklist.md) |
| **ACC-STT-IFLYTEK** | 讯飞 **speedTranscription**（`iflytek-speed-asr`） | Rust `xunfei_speed_asr` + 凭证三件套 + accent mandarin + `business.dhw` 热词 | ✅ **2026-06-18** | [`acc-stt-iflytek-acceptance.md`](../specs/acc-stt-iflytek-acceptance.md) · [`r3-china-iflytek-lfasr-research.md`](../specs/r3-china-iflytek-lfasr-research.md) |
| **ACC-TXT-0** | 稳定规则转写后字面预替换（Spike） | AssemblyAI custom_spelling | **⑤″f-C MEM-P2** |
| **ACC-IN-2/3** | 音频增强 / 选区重转写 | 须 ACC-EVAL A/B | R4 前 |
| **ACC-HITL-1/2** | 低置信筛选 / R3t-E 优先队列 | UX 薄片 | R3t-B/E |
| **ACC-GLOSS-2** | 错词一键加入术语表 | GLY-1 | R3t-B 后 |
| **LEX-MINE-1** | 记忆聚合推荐列表（轻量） | Descript 式「该进术语表」 | **⑤″f-B½ MEM-P1**（已排期） |
| **LEX-MINE-2+** | 全量挖掘 + 可选 LLM 说明 / 语料扫描 | 计划书 §5.1.2 | §8.1 |
| **ASR-FT** | ASR 训练 manifest / 可选 LoRA | 计划书 §5.2–5.3；Oumi 数据合成 **远期** | R9 ROI + memory 导出 schema（privacy/domain）+ 独立测试集 |
| **CAT-TRAN** | 翻译 + 词典（CAT） | 中译英、`target_text`、富结构词典、子范围批注、双语 DOCX；**spec 已有** T1–T6 | **远期**；**当前不做**（2026-05-27）；Go 须转写主线签收 + 产品中译英优先级 |
| **REV-LOC** | 撤销对齐 + 历史恢复 MVP | ✅ 2026-06-03；[acceptance](../specs/rev-loc-undo-edit-history-acceptance.md) | 已合入主序（EXP-WORD 后） |
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
| **Q-POS-4** | **R4-GATE** 为 R9 **硬门禁**；**REV-LOC** 产品意图仍为 v1 P1（2026-05-30）；**实施节奏**见 **Q-REV-1** |
| **Q-REV-1** | **2026-05-31** 规格三件套定稿；**2026-06-03** 切片 A/B **✅ 验收签收**（[acceptance](../specs/rev-loc-undo-edit-history-acceptance.md)）；主序转入 **R4**；R9 恢复 MVP 已满足 |
| **Q-LLM-1** | 本机 LLM **v1 后**做；**不阻塞 R9**；v1 仍以 **云端** 签收 R3t |
| **Q-LLM-2** | **先 LLM-LOC-4a（Ollama）** 验证本地校对 ROI；**再 4b（LRC 自管）** |
| **Q-LLM-3** | LLM **不进 ASR 侧车**；postprocess 仍为 Tauri OpenAI-compatible HTTP |
| **Q-LLM-4** | **4a 与 4b 可并存**：默认 4b 零终端；检测到 Ollama 时可「使用现有安装」 |
| **Q-LLM-5** | **是否真做本机 LLM 以 Gate 为准**：先 **LLM-LOC-SPIKE** → **Gate-A**（4a）→ **Gate-B**（4b）；**未过则不做产品化**，云端仍为默认 |
| **Q-SEQ-1** | ✅ **已拍板**（2026-05-27 无异议）：**HOT-UX** 入主序（⑤c 后）；**R3e-B** 在 **R3t-B/TRN-DIAG 之后**、**R3t-C 之前**（**不**回退到 R3h-3 后）；Sherpa **⑧½** 不阻塞 A–B |
| **Q-SEQ-2** | R3 宏观工期以 **§4.1.1 薄片总和** 为准（约 **12～15w**，2026-06-02 三次上调），非旧表「4～5w」单行 |
| **Q-R3g-2** | ✅ **R3-STATE S3 不得跳过**：⑤b **2 组矛盾场景手测** 签收后方可 **⑤c**（不与 ⑤c 并行除非书面改序） |
| **Q-R3t-2** | ✅ **分段单一模块**：R3t-A 产出 `segmentation.py`（或等价模块）；R3e-B **只消费**（见 R3t plan §2.3） |
| **Q-R3e-1** | ✅ **R3e-A 非长音频多段验收**：50min 手测只验动态超时/失败分类/OOM 文案；多段质量 **仅 R3t-A/B + R3e-B** |
| **Q-R3g-3** | ✅ **模型下载 cooperative cancel**：`POST /v1/models/prepare-cancel` + `phase: cancelled`；单文件传完前不可硬中断 ModelScope；**⑤c 前手测** |
| **Q-ACC-1** | ✅ **FunASR 固有参数 Preset-first**：**R3g-C** 按 SKU Profile 默认；**不**做 C 端全参数表单 |
| **Q-ACC-2** | ✅ **本地+在线打通**：编排层已统一；**⑤h ACC-STT-UNIFY** 统一 **术语真源 + adapter**；**不**假定同一 `hotword=` |
| **Q-ACC-3** | ✅ **同音/专名双通道**：L2 热词 + L4 **R3t-E**/memory |
| **Q-ACC-4** | ✅ **ACC-EVAL-1** 为 **R3g-C 合入硬门禁**；样例 **`fixtures/eval/samples/制控.mp3`**（`expected_terms: 制控`）；`eval-run.py` 输出 `term_hit_rate` |
| **Q-ACC-5** | ✅ **术语表只放正确写法**：`term` = canonical；**不**用 aliases 承载误听/误写偏置（如 **智控**）；同音靠 L4 memory/R3t-E |
| **Q-ACC-8** | ✅ **错形不进 ASR 偏置**（2026-06-02，对齐 Azure/FunASR/Descript 等 L0/L1 实践）：`correction_memory.before_text`、整对 `before→after` **不得** 写入 `hotwords`；稳定 **right** → **F6 / F6+ / glossary**；**ASR-VOC-4**（memory 直连 hotwords）**默认 No**；见 [`asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) §4.1、§6.5 |
| **Q-ACC-6** | ✅ **ACC-STT-UNIFY v1**：U1 必接 **OpenAI + AssemblyAI + Deepgram**；U2 必做；**U3→R3h-3**；**U4 延后**；Azure/百炼仍 §8.1 |
| **Q-ACC-7** | ✅ **SenseVoice ITN 默认开**（R3g-C C2）；识别语言 UI **默认 `zh`**（C4） |
| **Q-R9-1** | ✅ **Mid 档位**：R9 硬门禁 **R3t-B + R3t-C**；**R3t-D/E 可减 scope**（不挡 R9）；无 LLM 仍可手改交付 |
| **Q-FUT-1** | ✅ **§9 分叉 B 否**（协作不提前）；**R3h-3.5 Sherpa Spike Go**；**ACC-MODEL-1/HOT-W 产品 Go**（ACC-EVAL-1 后插入主序）；**LLM-LOC** 仍 R9 后 Spike→Gate |
| **Q-SEQ-3** | ✅ **§4.1.1 主序不变**（2026-05-30）：**R3g-C → ACC-STT-UNIFY → R3t-B → …**；不因 Mid/REV-LOC 重排薄片 |
| **Q-CSP-1** | **v1.1** CSP 硬化：**生产 `style-src` 去 `unsafe-inline`**（CSP-HARDEN）；**`script-src` 生产已 `'self'`**；v1 禁止 HTML 注入 UI |
| **Q-SYMPH-1** | symphonia **全 feature 保留**；不裁 codec |
| **Q-STT-CANCEL-1** | **v1.1** 在线 STT 可中断；v1 仅丢弃结果 |
| **Q-PLUGIN-1** | Plugin **v1.1** 再做 `register()` 权限校验；v1 内置-only |
| **Q-SIDECAR-1** | **2026-06-03 拍板 · 已被 R3h-1-R 取代**：Release CI 三平台编 sidecar；Mac DMG 仍 bundled + manifest OTA（§4.1.5.1） |

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
| **定位** | **个人单机 v1 主序已闭合**（EXP-WORD → REV-LOC → R4 → R9 → LLM-LOC 4a）；**v1 后硬化 Step 1–4 ✅**；进入 **§10.4 v1.1+ 统一后续** |
| **排期真源** | **§10.4**（发行尾项 · 产品元信息 · **新手引导** · 定稿 UX · v1.1 安全/取消 · 并行禁忌） |
| **LLM** | **4a** ✅ · **4b** ❌ Gate-B No-Go（[decision](../specs/llm-loc-gate-b-decision-2026-06.md)） |
| **当前主刀** | **P3 Win 发行资产** 或 **CLN-066 Release parity L3**；**P2 T-010 ✅**（2026-06-19） |
| **并行（不挡 P3）** | **CLN-066 L3 手测**；**code-review R-01/R-05/R-13** 工程台账 |
| **近期不做** | **R3g-B-Align / Qwen3 本机第三 SKU** ❌ 废弃 · **R3g-C-NANO vLLM** ❌ Defer · STREAM-* / 协作 / CAT 等 §8 |

### 10.1 v1 后硬化盘点（2026-06-11 · 对照代码）

> **方法**：§4.1.2 台账 + `main` 真源 + acceptance 勾选；**发行门禁** 与 **编码签收** 分列。

#### A. 已闭合（✅ 可不再排为主刀）

| ID | 代码/验收锚点 |
|----|----------------|
| **R0–R2** | 标点/LLM 基线 |
| **R3a–c** | keychain、profile、缓存/manifest |
| **R3f mac** | `asr_setup/`、`LocalAsrSetupWizard` — [signoff](../specs/r3f-phase-signoff-2026-06.md) |
| **R3g-A/C** | **单 SKU** 模型目录（Paraformer）+ `AsrModelProfile`（含 legacy SenseVoice 参数路径） |
| **R3h-I2 / I3** | LRC 续传/GC/回滚 ✅；Setup **🟡** 前端 reducer 已拆，统一 FSM **未闭合** |
| **R3t-A/B** | `segmentation.py`、转写编排 |
| **R3t-C/D** | 曾交付；**2026-06 独立菜单已移除** → 能力在 **F0 阶段 B** / 段界整理归档 |
| **R3t-E** | **⏸ 产品移除**；Stage B 保留于 `postTranscribeStageB.ts` |
| **R3e-A/B/C** | 长音频 + incremental preview |
| **R3h-1/2/3/3.5** | LRC + 三盏灯 + Sherpa spike |
| **R3h-I1 I1a** | `asr_sidecar/supervisor.rs` |
| **ACC-STT-UNIFY** | 本机手测 ✅；`stt_vocabulary` + 三家 adapter |
| **⑤″f A–D** | VOC-1/5/2/GUARD、F2/F1/F6、MEM-P0–P2、F7、F0、F8 |
| **EXP-WORD / REV-LOC** | 导出 + 撤销/快照 |
| **Phase 10** | 项目 Hub + 场次元信息 — [`project-hub-metadata-acceptance.md`](../specs/project-hub-metadata-acceptance.md) **2026-06-08** |
| **R4 / R9** | 质量 Tab + v1 严格签收 2026-06-03 |
| **LLM-LOC 4a** | Ollama 路径 |
| **语段正文 P0** | `useSegmentRowTextFieldEditing`、draft defer |

#### B. 编码✅ · 门禁/手测未全绿（🟡 尾项）

| ID | 现状 | 缺口 | 建议优先级 |
|----|------|------|------------|
| **R3h-1-R CI** | `v0.1.0` mac/linux manifest + 安装包 ✅ · **Win workflow ✅** | **Win release 资产**（`v0.1.0` 未上传）待下一 tag | **P2** |
| **TRN-DIAG** | `transcribe_timeline.rs`、`diagnostic.rs` | ✅ 2026-06-11 | — |
| **ASR-WARM** | `warm.rs` idle/watchdog | release idle H5 ✅ 2026-06-12 | — |
| **ACC-STT-ALI** | `dashscope_vocabulary.rs` + `dashscope_file_asr.rs` | 百炼 E2E ✅ 2026-06-12 | — |
| **ACC-STT-UNIFY** | 在线 adapter 已编码 | 百炼 ✅；OpenAI/AAI/DG 可选 E2E | **P3**（有 Key） |
| **Welcome 搜索** | `WelcomeTopBar` 搜索框 | **占位**（`readOnly`）；全文检索 **未排期** | **P3** 或 v1.2 |
| **编辑器 Esc 栈** | `dialogEscapeStack` + 浮动面板 | ✅ 编码（多 dialog 接入）；无单独 Epic | — |
| **F6 §C Mine** | `GlossaryMineSection` | 挖掘推荐 **可选手测** | **P3** |

#### C. 明确不做 / 延后（⏸ / ❌ / 📋）

| ID | 决策 |
|----|------|
| **F4-ASR** | ❌ No-go — 无 ASR confidence 真源 |
| **R3t-E 独立产品** | ⏸ 已移除 |
| **R3f Win / R3h-0 Win §4** | ⏸ 无 Win 机豁免 |
| **LLM-LOC-4b** | ❌ Gate-B No-Go |
| **⑤″f-E Qwen3** | ❌ No-go |
| **R3g-C-NANO PyTorch** | ❌ **Defer** 2026-06-17 — 默认路径 `<\|no\|>` stub；180s 窗 108 段 / 无 `sentence_info`；**不上 catalog** |
| **R3g-C-NANO vLLM** | 📋 research ✅ · **❌ Defer 2026-06-18** | 无 NVIDIA CUDA 环境；**目前不做** spike；research 保留供日后重开 | — |
| **R3s-A Qwen3 默认引擎** | 📋 Defer（ADR-0007） |
| **F3 / F5** | 📋 P3 未编码 |
| **R6–R8 / CAT-TRAN** | 📋 非 v1 |

### 10.2 v1 后硬化（Step 1–4 · 已闭合）

```text
Step 1  R3h-1-R Release CI          ✅ 编码 2026-06-11
Step 2  TRN-DIAG 手测闭项           ✅ 2026-06-11
Step 3  ASR-WARM release idle      ✅ H5 2026-06-12
Step 4  ACC 在线 E2E                 ✅ 百炼 2026-06-12
```

| 步 | ID | 状态 | 验收真源 |
|----|-----|------|----------|
| **1** | **R3h-1-R CI** | ✅ mac/linux · Win 🟡 | [`r3h-1-r-release-checklist.md`](../specs/r3h-1-r-release-checklist.md) |
| **2** | **TRN-DIAG** | ✅ | [`trn-diag-hand-test-checklist.md`](../specs/trn-diag-hand-test-checklist.md) |
| **3** | **ASR-WARM release** | ✅ | [`asr-warm-release-idle-signoff-2026-06-12.md`](../specs/asr-warm-release-idle-signoff-2026-06-12.md) |
| **4** | **ACC 在线 E2E** | ✅ 百炼 | [`acc-stt-ali-hand-test-checklist.md`](../specs/acc-stt-ali-hand-test-checklist.md) |

> **后续 Step 5+** 见 **§10.4**（v1.1+ 统一路线图）。

**已闭合硬化步（2026-06-11）**：R3h-I1 设计冻结 ✅ · I1a 编码 ✅ · ASR-WARM dev ✅ · 语段 P0 ✅ · F8 ✅ · F2/F1/F6 复测 ✅

### 10.3 并行（不挡 Step 1）

| ID | 说明 | 条件 |
|----|------|------|
| **R3f Win** | 安装包手测 | ⏸ 有 Win 机时补 |
| **R3s-A Phase 0** | 金标 eval（非编码） | Defer |
| **架构热点回收（T-010）** | `run_transcribe_cmd/` · `online_segment_normalize/` · `useEnvOnlineSttPanel` 等 | ✅ **2026-06-19**（`9612aae` · guard **0**） |
| **文档 commit** | F4 No-go + 盘点 + 手测签收 | 随时 |
| **编辑器快捷键调研** | [`editor-keyboard-shortcuts-research.md`](../specs/editor-keyboard-shortcuts-research.md) | 与 ONBOARD / EnvHelp 可链；非阻塞 |

### ASR 引擎路线（2026-06-11）

- **产品默认**：FunASR Paraformer + LRC（ADR-0003）
- **R3h-3.5**：Sherpa Paraformer ✅ Partial Go（非主路径）
- **R3s-A**：Sherpa Qwen3 📋 Defer（**G1 前不编码**）

**R3s-A Phase 0 启动条件**（非 v1.1 阻塞）：

| 条件 | 说明 |
|------|------|
| **触发** | 产品书面 Go **且** v1.1 主轨 Step 5–7 无红项 **或** 单独开 eval 薄片 |
| **交付** | 金标 manifest + 制控/长轨 CER·term_hit 对比（FunASR Paraformer baseline） |
| **Go 门槛** | [plan §G1–G4](../specs/r3s-sherpa-qwen3-default-engine-plan.md) + [spike 270 段证据](../specs/r3h-3.5-sherpa-quant-compare-report.md) 复验 |
| **通过后** | v1.2+ 可升「默认引擎迁移」优先级；**未过**则维持 Paraformer + LRC |

### v1 0.1.0 可分发

- **DMG**：`npm run desktop:build-dmg`
- **签收**：[v1-release-installed-signoff](../v1-release-installed-signoff-2026-06.md)

**主序（E 期）**：EXP-WORD ✅ → REV-LOC ✅ → R4 ✅ → R9 ✅ → LLM-LOC 4a ✅

**并行索引**：[parallel-backlog-2026-06.md](../specs/parallel-backlog-2026-06.md)

### 10.4 v1.1+ 统一后续路线图（2026-06-12 定稿）

> **定位**：个人单机、**已有录音 → 转写 → 手改定稿 → Word**；对标 MacWhisper 文件链 / 听见「导入转写+规整」子集，**不对标**实时 mic、Descript 媒体编辑、协作 SaaS。  
> **原则**：一轮一纵向薄片；**复用** F0 / EXP-WORD / LRC，**不**新造 ASR/LLM 栈。  
> **规格**：各 Epic 编码前须 intent/plan/acceptance（模板 [`spec-template.md`](../specs/spec-template.md)）；环境/UI 类须 **能力—UI 状态矩阵**。  
> **⚠️ 2026-06-12**：§10.4 各 Epic 编码前须 intent/plan/acceptance — **2026-06-18 已全部编码签收**（REL-1.1 ✅）。**§10.4 后新增并行项**须先 research brief（例：**ACC-STT-IFLYTEK** ✅ research → plan → acceptance → 编码）。

#### 10.4.0 Epic 索引

| Epic | 代号 | 决策/来源 | 用户价值 | 估时 | 规格（待/将建） |
|------|------|-----------|----------|------|-----------------|
| **发行尾项** | **R3h-1-R Win** | 路线图 §10.2 Step 5 | Windows CI smoke 与 mac/linux 对齐 | 0.5–1w | [`r3h-1-r-release-checklist.md`](../specs/r3h-1-r-release-checklist.md) §3 |
| **产品元信息** | **PROD-META** | Win checklist · 产品元信息缺口 | **关于**页：版本/版权/第三方许可；与诊断包 **build-info** 一致 | 2 片 · ~0.5w | `product-metadata-v1.1-{intent,plan,acceptance}.md`（平台惯例；**免 research brief**） |
| **定稿 UX** | **DELIV-MODE** | 产品对标缺口 §定稿链 | 转写后 → 规则/改稿 → 终检 → 交付导出 **单一向导** | 2 片 · ~1–1.5w | `delivery-mode-{research,intent,plan,acceptance}.md` |
| **新手引导** | **ONBOARD** | MacWhisper 极简 + 业内 checklist 对照 | Welcome **首跑清单**（5 步 outcome）；可关闭/可恢复；**非**全屏 tour | 2 片 · ~0.5–1w | `onboarding-first-run-{research,intent,plan,acceptance}.md` |
| **多场效率** | **BATCH-TXN** | MacWhisper Batch 子集 | Project Hub **多选导入 + 串行转写队列** | 2 片 · ~1–1.5w | `batch-transcribe-queue-{intent,plan,acceptance}.md` |
| **v1.1 安全** | **CSP-HARDEN** | **Q-CSP-1** §1.7 | 生产 CSP 去 `style-src` **`unsafe-inline`**（nonce + WaveSurfer） | 2 片 · **~1.5–2w** | `csp-harden-v1.1-{research,intent,plan,acceptance}.md` |
| **v1.1 取消** | **STT-CANCEL** | **Q-STT-CANCEL-1** §1.7 | 在线 STT **真 Abort**（非 v1 丢弃结果） | 3–4 片 · **~2–3w** | `online-stt-cancel-v1.1-{research,intent,plan,acceptance}.md` |

**明确不纳入本轨**（仍 §8 / §10.1 C）：STREAM-*、Overdub/按字剪波形、R6–R8、CAT-TRAN、RAG、LLM-LOC-4b、Q-PLUGIN-1（另列 v1.1 可选）、Win 安装包手测（⏸ 有 Win 机时补）。

#### 10.4.1 实施顺序（单人默认 · 须按 Step）

```text
【Phase A · 发行尾项 + 产品元信息】
Step 5   R3h-1-R Windows CI                    ✅ 2026-06-12 · [run #27401814256](https://github.com/Abe-Junwei/rushi/actions/runs/27401814256)
Step 5b  PROD-META P-1  环境页「关于」+ app_version + 复制版本信息          ✅
Step 5c  PROD-META P-2  第三方许可 + build-info 对齐 + macOS About       ✅

【Phase B · v1.1 硬化 — 可并行，单人建议 CSP 先于 STT】
Step 6a  CSP-HARDEN C-1  生产 style nonce + 守卫 + 波形 probe   ✅ 2026-06-12
Step 6b  CSP-HARDEN C-2  全应用 CSP smoke + acceptance 签收     ✅ 2026-06-12（自动门禁 + H-CSP-1/2 mac 手测）
Step 7a  STT-CANCEL D-1  TranscribeCancelState + project_cancel_transcribe + TS   调研 ✅ · 代码 ✅
Step 7b  STT-CANCEL D-2  OpenAI + Deepgram native Abort                    代码 ✅
Step 7c  STT-CANCEL D-3  百炼 Dashscope poll 可中断                        代码 ✅
Step 7d  STT-CANCEL D-4  AssemblyAI poll 可中断                            代码 ✅
Step 7e  STT-CANCEL D-5  generic multipart 尽力取消（P2 可选）

【Phase C · 定稿 UX + 新手引导 — 与 B 可交错，勿与 CSP 大改同 PR】
Step 8   DELIV-MODE A-1  向导壳 + 终检 + 打开 DeliveryExportDialog          代码 ✅
Step 9   DELIV-MODE A-2  委托 F1/Stage B + 转写成功 toast 入口              代码 ✅
Step 9a  ONBOARD O-1  Welcome 首跑清单壳 + 进度持久化 + 可关闭/恢复入口    代码 ✅
Step 9b  ONBOARD O-2  步骤与能力态自动同步 + 情境 CTA（链本机 ASR / 定稿 / 导出）  代码 ✅

【Phase D · 多场效率 — 依赖多选导入，可与 Step 9b 并行】
Step 10  BATCH-TXN B-1  pick_audio_paths + Hub 批量导入                      代码 ✅
Step 11  BATCH-TXN B-2  串行转写队列 + Close Gate + 停止                    代码 ✅

【Phase E · v1.1 签收】
Step 12  REL-1.1  signoff  H-CSP-* + H-STT-* + 回归 R9 主路径抽检          ✅ 2026-06-18
```

| Step | ID | 状态 | 硬验收 |
|------|-----|------|--------|
| **5** | **R3h-1-R Win CI** | ✅ | `smoke-asr-sidecar-health.ps1` + `release.yml` **tauri-windows** 绿（2026-06-12） |
| **5b–c** | **PROD-META** | ✅ | `EnvAboutPanel`（第三方组件 + 许可正文）+ 随包 `third-party-notices.txt` / `third-party-license-texts.txt`；诊断 `build-info.txt` 含 `identifier`；macOS 应用菜单 About |
| **6a** | **CSP-HARDEN C-1** | ✅ | 生产 `style-src` 去 `unsafe-inline` + 删 `style-src-elem`；守卫拒绝 prod `style-src` `unsafe-inline` + 任何 `style-src-elem` 声明 |
| **6b** | **CSP-HARDEN C-2** | ✅ | 生产产物 CSP 表面审计 + nonce probe 守卫（`checkTauriStyleNonceProbe`）+ 运行时 `<style>` 注入覆盖审计；H-CSP-1/2 mac Release 手测 ✅（2026-06-12）|
| **7a** | **STT-CANCEL D-1** | ✅ | `TranscribeCancelState` + `project_cancel_transcribe` + 在线 `Abortable` + TS 接线（2026-06-12）|
| **7b–d** | **STT-CANCEL** | ✅ | adapter + **H-STT-1/2/3 手测 ✅** 2026-06-12 |
| **7e** | **STT-CANCEL D-5** | 📋 P2 | legacy multipart 文档化 |
| **8** | **DELIV-MODE A-1** | ✅ | 定稿向导 + 终检 + 打开交付导出；**H-DELIV-1 ✅** 2026-06-12 |
| **9** | **DELIV-MODE A-2** | ✅ | 向导委托 F1/Stage B + 转写 toast；**H-DELIV-1 ✅** 2026-06-12 |
| **9a** | **ONBOARD O-1** | ✅ | 5 步清单 + dismiss/restore；**H-ONBOARD-1 ✅** 2026-06-12 |
| **9b** | **ONBOARD O-2** | ✅ | 自动勾选 + CTA；**H-ONBOARD-2/3 ✅** 2026-06-12 |
| **10–11** | **BATCH-TXN** | ✅ | B-1 多选导入 + B-2 串行队列/停止/Close Gate；**H-BATCH-1 ✅** 2026-06-18 |
| **12** | **REL-1.1** | ✅ | H-CSP-1/2 Release 手测 ✅ · R9 抽检 ✅ · [`rel-1.1-hand-test-checklist`](../specs/rel-1.1-hand-test-checklist.md) 2026-06-18 |

**REL-1.1 手测最小集**（Step 12）：

| ID | 项 |
|----|-----|
| H-CSP-1 | Release 包 Editor 波形加载；Console 无 style CSP violation | ✅ 2026-06-18 |
| H-CSP-2 | 交付导出 Dialog、环境页三盏灯正常 | ✅ 2026-06-18 |
| H-STT-1 | 在线 STT（≥1 已配置 adapter）转写中停止，语段恢复 | ✅ 2026-06-12 百炼 file_asr |
| H-STT-2 | TRN-DIAG / 诊断包 outcome=`cancelled` | ✅ 2026-06-12 |
| H-STT-3 | 本机侧车 async 停止回归 | ✅ 2026-06-12 |
| H-DELIV-1 | 定稿模式：转写 → 终检 → 讲稿/逐字稿导出 | ✅ 2026-06-12 |
| H-BATCH-1 | Hub 批量导入 + 队列转写 ≥2 文件 | ✅ 2026-06-18 |
| H-PROD-1 | 设置 → 关于：marketing version 与 `app_version` / 诊断 `build-info.txt` 一致 |
| H-PROD-2 | 关于页可打开 **ffmpeg-static** 等第三方许可全文 |
| H-ONBOARD-1 | 清空 `localStorage` 后首启：Welcome 见 **5 步清单**；关闭后不再自动弹出；可从设置/侧栏 **恢复清单** | ✅ 2026-06-12 |
| H-ONBOARD-2 | 本机 ASR **就绪**后 Step「准备 ASR」自动勾选；完成一次转写后 Step「自动转录」勾选 | ✅ 2026-06-12 |
| H-ONBOARD-3 | 清单 CTA「本机 ASR」→ 环境页并聚焦 **LocalAsrSetupWizard**（不重复第二套安装 UI） | ✅ 2026-06-12 |

#### 10.4.2 Epic 落位摘要（编码时）

**PROD-META**

| 层 | 路径 |
|----|------|
| Rust | 已有 `app_version()`；可选 `app_build_info()`（platform / identifier）；Tauri **应用菜单 → 关于**（macOS） |
| TS API | `tauri/projectApi.ts` 或 `appInfoApi.ts` → `invoke("app_version")` |
| UI | `components/EnvAboutPanel.tsx`；`EnvironmentPanel` nav **`about`**（与 `help` 并列，**勿与项目元信息表单混页**） |
| 资源 | 随包 `resources/third-party-notices.txt` + `third-party-license-texts.txt`（组件目录 + 许可正文）；ffmpeg 说明见 `services/asr/third_party/ffmpeg/README.md` |
| 诊断 | `diagnostic.rs` `build-info.txt` 字段与 About **同一真源**（`CARGO_PKG_VERSION` + `tauri.conf.json` `identifier`） |
| 文档 | 随包 **`user-guide-zh.md` §1–3** 对齐 bundled sidecar + 应用内转写（**仅 md，无 PDF**）；§许可 指向应用内关于 |
| **不做** | SaaS 式 Legal 门户；Welcome 顶栏常驻版本号；与 `ProjectMetadataDialog` 合并 |

**DELIV-MODE**

| 层 | 路径 |
|----|------|
| 纯函数 | `services/deliveryModeSteps.ts`、`deliveryModeChecklist.ts` |
| Controller | `pages/useDeliveryModeController.ts` |
| UI | `components/DeliveryModeDialog.tsx` |
| 委托 | 现有 `useCorrectionRulesController`、`usePostTranscribeStageBController`、`DeliveryExportDialog` |
| 入口 | `EditorSegmentToolbarActions.tsx`、`useTranscribeJobController` 转写成功 toast |

**ONBOARD**

| 层 | 路径 |
|----|------|
| 纯函数 | `services/onboarding/onboardingChecklist.ts`（5 步定义 + 完成规则）；`onboardingProgress.ts`（`localStorage` / 可选 profile 键） |
| Controller | `hooks/useOnboardingChecklistController.ts` |
| UI | `components/WelcomeOnboardingChecklist.tsx`（Welcome 首页 Stage）；可选 `WelcomeSidebar` 恢复入口 |
| 复用 | `AsrEnvPresentation` / `asrEnvStatus`（Step1 就绪）；`CreateProjectModal` + 首次转写事件（Step2–3）；`ProjectMetadataDialog`（Step4 可选）；`DeliveryModeDialog` / `DeliveryExportDialog`（Step5）；`EnvironmentPanel` `focusLocalAsrSeq` → **LocalAsrSetupWizard** |
| 与 DELIV 关系 | **O-1** 可与 DELIV A-1 并行；**O-2** 转写成功 CTA **复用/对齐** DELIV A-2 toast，末步链定稿或直开交付导出 |
| **清单 5 步（P0）** | ① 本机 ASR 就绪 ② 创建项目并导入音频 ③ 自动转录 ④（可选）填写场次信息 ⑤ 导出 Word / 进入定稿模式 |
| **不做** | Spotlight 线性 product tour；Otter 式 Help Center；首启强制 modal 阻断；与 `EnvHelpPanel` 长文重复维护；第二套 ASR 安装向导 |

**BATCH-TXN** — **✅ Step 10–11 · H-BATCH-1 2026-06-18**

| 层 | 路径 |
|----|------|
| Rust | `picker_cmd.rs` → `pick_audio_paths()` |
| 纯函数 | `services/batchTranscribeQueue.ts`、`projectBatchImport.ts` |
| Controller | `useProjectImportDuplicateController.ts`、`useBatchTranscribeQueueController.ts` |
| UI | `BatchTranscribeQueueDialog.tsx`、`ProjectFilesHubPanel.tsx` |
| busy | `useProjectBusyState` → `busyReason: "batch_transcribe"` |

**CSP-HARDEN（Q-CSP-1）**

| 层 | 路径 |
|----|------|
| 范围 | **v1.1 仅硬化生产 `style-src` / `style-src-elem`**（去 `unsafe-inline`）；**`script-src` 生产已为 `'self'`**（Q-CSP-1 该项 v1 已闭合） |
| 配置 | `tauri.conf.json` 生产 `style-src` / `style-src-elem` → nonce（去 `unsafe-inline`） |
| 运行时 | 已有 `index.html` nonce probe、`readTauriStyleCspNonce`、`applyWaveSurferShadowCspNonce` |
| 守卫 | `scripts/check-architecture-guard.mjs` 升级 |
| **v1.1 保留** | `style-src-attr: 'unsafe-inline'`（React 行内 style；v1.2 再评估） |
| **dev 保留** | `devCsp.script-src` `unsafe-inline`（Vite HMR） |

**STT-CANCEL（Q-STT-CANCEL-1）**

| 层 | 路径 |
|----|------|
| Rust 状态 | `TranscribeCancelState`（对齐 `PostprocessCancelState`） |
| 命令 | `project_cancel_transcribe`；`project_run_transcribe` + `request_id` + `Abortable` |
| Adapter | `transcribe_native_online.rs`、`stt_native/*` 分批接入 cancel token |
| TS | `transcribePreviewState.ts`（移除 `online-stt-*` 不可 cancel）；`useTranscribeJobController.ts` |
| **不扩 scope** | 本机 **R3e-C** `cancelTranscribe` / 侧车 `/v1/transcribe/cancel` **已 ✅** — 本 Epic 仅 **在线 native Abort** + `project_cancel_transcribe` 统一 command |
| **不扩 scope** | 本机 `async_start` 不可中断窗口（fix-status 4c）另开 |

#### 10.4.3 并行与禁忌

| 规则 | 说明 |
|------|------|
| **勿同 PR** | CSP 改 `tauri.conf` + 大规模 UI 重设计；Release CI + BATCH 队列大改 |
| **可并行** | Step **5b–c**（PROD-META）∥ Step 6a（CSP）；Step **9a**（ONBOARD 壳）∥ Step 8（DELIV A-1）；Step 6（CSP）∥ Step 7a（STT）；Step 10（BATCH）∥ Step 9b（ONBOARD 挂钩） |
| **PROD-META 门禁** | REL-1.1 前须 **5c** 签收；Win 发行 checklist「关于 + ffmpeg 许可」依赖本 Epic |
| **ONBOARD 门禁** | **O-2** 须在 **DELIV A-2** 之后或同 PR 协调转写 toast；清单 **不**替代 `EnvHelpPanel`（L2 帮助仍被动查阅） |
| **DELIV 门禁** | 不自动串联 A→B；须预览写回（延续 F0 硬约束） |
| **BATCH 门禁** | 串行转写；非空语段默认跳过（覆盖须 ASR-VOC-1 确认框） |
| **v1.1 发版** | Step 12 前须 **6b + 7b** 至少一家在线 E2E 取消手测 |
| **规格门禁** | 各 Epic **intent/plan/acceptance 立项后**方可编码（见 §10.4.0 注） |
| **热点门禁** | guard **0**（2026-06-19）；T-010 ✅；叠功能前仍守 hook/行数纪律 |

#### 10.4.4 日历估算（单人 · 2–4h/片）

| Phase | 周次（约） | 交付 |
|-------|------------|------|
| A 发行尾项 + 元信息 | +0.5–1w | Step 5 Win CI ✅ · PROD-META ✅ |
| B v1.1 硬化 | **+2.5–4w** | CSP + STT 取消（**较原估 +0.5–1w 缓冲**） |
| C 定稿 UX + 引导 | +1.5–2w | DELIV-MODE + **ONBOARD** |
| D 多场 | +1–1.5w | BATCH-TXN |
| E 签收 | +0.5w | REL-1.1 |
| **合计** | **~6.5–10w** | 单人 2–4h/片；CSP/STT 勿压缩 |

**估时说明（2026-06-12 审查）**：CSP（nonce + WaveSurfer shadow + 全应用 smoke）与 STT-CANCEL（4 家 adapter + 状态机 + 手测）原表偏乐观；以 **Step 7a 基础设施 + 7b–d adapter 分批** 控制单 PR 风险。

**与 §6 远期关系**：R5 MCP、R6–R8、LLM-LOC-4b、Q-PLUGIN-1 **仍在 v1.1 之后**；本轨不阻塞协作立项。

#### 10.5 并行轨（§10.4 闭合后 · 2026-06-18）

> **定位**：§10.4 **主序已闭合**；下列项 **不占用 Step 编号**，按资源与 Key 并行推进。索引真源：[`parallel-backlog-2026-06.md`](../specs/parallel-backlog-2026-06.md)。

```text
P1  ACC-STT-IFLYTEK   讯飞极速录音转写 — ✅ 2026-06-18
P2  架构热点回收      T-010 目录化 + guard 0 — ✅ 2026-06-19（`9612aae`）
P3  R3h-1-R Win 资产  v0.1.1 无 Win 包 — 下一 tag 补传 ← 现在
P4  CLN-066           Release parity L3 UI 手测 ☐
—   R3g-B-Align       ❌ 废弃 2026-06-18
—   R3g-C-NANO vLLM   ❌ Defer 2026-06-18（无 CUDA · 目前不做）
```

| 优先级 | ID | 状态 | 代码 / spec 锚点 | 下一动作 |
|--------|-----|------|------------------|----------|
| **P1** | **ACC-STT-IFLYTEK** | ✅ **2026-06-18** | `stt_native/xunfei_speed_asr/` · `iflytek-speed-asr` · macOS keyring 三件套 | [`acc-stt-iflytek-acceptance.md`](../specs/acc-stt-iflytek-acceptance.md) ✅ |
| **P2** | **架构热点（T-010）** | ✅ **2026-06-19** | `project/run_transcribe_cmd/` · `project/online_segment_normalize/` · `useEnvOnlineSttPanel.ts` 164L | [`cleanup-candidate-register.md`](../specs/cleanup-candidate-register.md) · 可选 `sync.rs` 327L |
| **P3** | **Win release 资产** | 🟡 ← **现在** | `release.yml` **tauri-windows** ✅ · Release **v0.1.1** 仅 mac/linux | 下一 tag 补传 **Windows** 安装包 |
| **P4** | **CLN-066 Release parity** | 🟡 | L2 机器 ✅ | L3 UI 手测 — [`release-parity-evidence-2026-06-14.md`](../release-parity-evidence-2026-06-14.md) |
| — | **R3g-B-Align** | ❌ **废弃** | 2026-06-11 spike **Defer**（制控 211 段但 wall **~8×** Paraformer）；**2026-06-18 产品拍板不再做** | [`align-results`](../specs/r3g-b-align-forced-aligner-spike-results.md) · research 存档 |
| — | **R3g-C-NANO vLLM** | ❌ **Defer** | PyTorch **Defer** + **无 CUDA 环境**（2026-06-18 产品拍板：**目前不做**） | research 保留 — [`r3g-c-funasr-nano-vllm-research.md`](../specs/r3g-c-funasr-nano-vllm-research.md) |

**v1.2 候选（部分已编码）**：~~CSP `style-src-attr`~~ ✅ `3b3c2fa` · ~~Welcome 全文检索~~ ✅ `3973acb` · 默认引擎迁移（须 **R3s-A Phase 0** Go）。

**桌面 UX 尾项（2026-06-18，`2a5e021`）**：转写文案/排版 · 浮动 dialog 动态 `layoutRev`（定稿/Stage B/规则纠错/导出/确认框）— **非路线图 Step**，随 P1 手测一并回归。

---

## 11. 参考文档（非排期真源）

| 文档 | 用途 |
|------|------|
| [`oumi-remediation-report.md`](../specs/oumi-remediation-report.md) | Oumi 调研；Part I 边界；**§五-b** 为何不训领域模型 |
| [`collaboration-foundation-plan.md`](./collaboration-foundation-plan.md) | 协作 Phase 1–7 细节；**顺序以本文 §4–§6 为准** |
| [`p2-acceptance.md`](../p2-acceptance.md) | P2：术语库/热词/低置信/纠错记忆（**后端**）；管理 UI → GLY-1 |
| [`docs/architecture/asr-hotword-bias-truth.md`](../../architecture/asr-hotword-bias-truth.md) | 术语如何拼进 ASR `hotwords` |
| [`docs/architecture/asr-vocabulary-bias-practices.md`](../../architecture/asr-vocabulary-bias-practices.md) | **ASR-VOC** 业内对照 + L0/L1 纪律 + 落地路线图 §6 |
| [`r3-asr-voc-landing-plan.md`](../specs/r3-asr-voc-landing-plan.md) | **⑤″f-1～5** 任务拆片 |
| [`r3-asr-voc-landing-acceptance.md`](../specs/r3-asr-voc-landing-acceptance.md) | **ASR-VOC** 可勾选验收 |
| [`docs/architecture/transcription-accuracy-program.md`](../../architecture/transcription-accuracy-program.md) | **ACC** 分层 L0–L7、问题矩阵、与 R3g-C/UNIFY 关系（**待立项**） |
| [`docs/architecture/asr-generate-params-truth.md`](../../architecture/asr-generate-params-truth.md) | **R3g-C** FunASR `generate()` Profile 真源表（**待立项**） |
| [`r3g-c-asr-generate-profile-acceptance.md`](../specs/r3g-c-asr-generate-profile-acceptance.md) | **R3g-C** 验收切片（**待立项**） |
| [`acc-stt-unify-acceptance.md`](../specs/acc-stt-unify-acceptance.md) | **ACC-STT-UNIFY** 验收切片（✅ 本机 2026-05-31；百炼 E2E ✅ 2026-06-12） |
| [`acc-stt-iflytek-acceptance.md`](../specs/acc-stt-iflytek-acceptance.md) · [`r3-china-iflytek-lfasr-research.md`](../specs/r3-china-iflytek-lfasr-research.md) | **ACC-STT-IFLYTEK** 讯飞极速 ✅ **2026-06-18** |
| [`r3g-c-funasr-nano-vllm-research.md`](../specs/r3g-c-funasr-nano-vllm-research.md) | **R3g-C-NANO vLLM** research ✅ · **❌ Defer 2026-06-18**（无 CUDA · 目前不做 spike） |
| [`r3g-b-align-qwen3-forced-aligner-spike-research.md`](../specs/r3g-b-align-qwen3-forced-aligner-spike-research.md) | **R3g-B-Align** ❌ **废弃** 2026-06-18（spike Defer 2026-06-11）· [`results`](../specs/r3g-b-align-forced-aligner-spike-results.md) |
| [`r3e-c-incremental-transcribe-acceptance.md`](../specs/r3e-c-incremental-transcribe-acceptance.md) | **R3e-C** 增量 preview（✅ 2026-05-31） |
| [`r3-asr-landscape-2026-05-improvement-backlog.md`](../specs/r3-asr-landscape-2026-05-improvement-backlog.md) | **ASR 生态改进 backlog**（§4.1.8；P0–P2 + Qwen3/CUDA/FunASR 1.3.3） |
| [`r3g-b-qwen3-asr-sku-spike-research.md`](../specs/r3g-b-qwen3-asr-sku-spike-research.md) | **R3g-B Qwen3** Go/No-go spike（research ✅） |
| [`docs/architecture/recording-transcribe-llm-pipeline.md`](../../architecture/recording-transcribe-llm-pipeline.md) | **R3t** 管线真源（录音分段 + LLM 校准，不含流式） |
| [`recording-transcribe-llm-refine-intent.md`](../specs/recording-transcribe-llm-refine-intent.md) | R3t 目标与边界 |
| [`lexicon-guided-llm-refine.md`](../../architecture/lexicon-guided-llm-refine.md) | **R3t-E** 词表有据校对（**消费**词表） |
| [`word-formatted-export-backlog.md`](../specs/word-formatted-export-backlog.md) | **EXP-WORD** L6 终稿 Word（单机；非 C6） |
| [`p3-acceptance.md`](../p3-acceptance.md) | P3 DOCX **基线**签收 |
| [`personal-solo-v1-backlog.md`](../specs/personal-solo-v1-backlog.md) | **个人单机 v1** 能力补齐与 R9 手测 |
| **§10.4 v1.1+ 规格（规划落位）** | `product-metadata-v1.1-*` · `onboarding-first-run-*` · `delivery-mode-*` · `batch-transcribe-queue-*` · `csp-harden-v1.1-*` · `online-stt-cancel-v1.1-*`（编码前立项） |
| [`llm-local-runtime-backlog.md`](../specs/llm-local-runtime-backlog.md) | **LLM-LOC** 本机 LLM（4a Ollama / 4b LRC） |
| [`lexicon-mining-backlog.md`](../specs/lexicon-mining-backlog.md) | **候选** LEX-MINE / ASR-FT；历史 §5 与 Oumi 排除登记 |
| [`translation-dictionary-module.md`](../specs/translation-dictionary-module.md) | **CAT 实施 spec**（T1–T6；未排期） |
| [`translation-cat-backlog.md`](../specs/translation-cat-backlog.md) | **候选** CAT-TRAN；与 glossary/R3t 边界 |
| [`ui-redesign-parallel-dev.md`](../specs/ui-redesign-parallel-dev.md) | UI 纪律与已验收记录 |
| [`architecture-split-plan.md`](../specs/architecture-split-plan.md) | 文件拆分地图（R9 同步） |
| [`rushi-local-runtime-catalog-remediation-plan.md`](../specs/rushi-local-runtime-catalog-remediation-plan.md) | **R3h 实施真源**（LRC、manifest、分阶段验收） |
| [`r3h-1-r-phase-signoff-2026-06.md`](../specs/r3h-1-r-phase-signoff-2026-06.md) | **R3h-1-R** R1+R2 手测签收 |
| [`r3h-1-r-runtime-manifest-release-activation-plan.md`](../specs/r3h-1-r-runtime-manifest-release-activation-plan.md) | **R3h-1-R** manifest 发行激活（HTTPS 默认源 + 发布流水线） |
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
| 2026-05-31 | **R3g-C ✅ 手测签收**：Profile + 识别语言 + mismatch 横幅；§10 下一刀 **ACC-STT-UNIFY** |
| 2026-05-31 | **ACC-STT-UNIFY ✅ 本机手测签收**：Paraformer + hotwords 链路；在线 E2E ⏳；§10 下一刀 **R3t-D** |
| 2026-05-31 | **R3t-D ✅ 手测签收**：段界整理 merge/改字 + 预览写回；§10 下一刀 **R3t-E** |
| 2026-05-31 | **REV-LOC 规格三件套**：撤销栈对齐 + 历史恢复 MVP；[research](../specs/rev-loc-undo-edit-history-research.md) / plan / acceptance；**Q-REV-1** 编码后置、不挡 R9 |
| 2026-05-31 | **R3e-C ✅ 手测签收**：制控.mp3 ~20.8min、197 段、首段 ~23.9s、blocking≡async；§10 下一刀 **R3g-C** |
| 2026-05-30 | **R3e-C Phase 2 编码**：async preview + `cancelTranscribe` + preview 门禁 + controller 拆分；**§4.1.8** 并入 [`r3-asr-landscape-2026-05-improvement-backlog.md`](../specs/r3-asr-landscape-2026-05-improvement-backlog.md)；§4.1.1 **⑥½**；§10 下一刀 **R3e-C 手测 → R3g-C** |
| 2026-05-30 | **外部评估吸收**：R3 **~10～13w**；Sherpa **轻量模式**（ADR-0003 附录）；Qwen3 **伪流式** / SenseVoice **弃用** 风险入 backlog + spike §8；FireRedASR2 / Moonshine **雷达项** |
| 2026-06-02 | **路线图审查吸收**：R3 **12～15w**；⑤″f **4–6w** + MEM 子阶段；**R3h-0∥⑤″f-A**；**⑤″f-E Qwen3 门控**；**Q-ASR-1** SenseVoice 兼容定位；MEM plan/acceptance 入主仓 |
| 2026-06-02 | **ASR 热词业内调研入路线图**：**Q-ACC-8**（错形不进 hotwords）；**§4.1.9** 改进清单（VOC-1 手测、VOC-5、2c/d、F6+、VOC-GUARD）；**⑤″f-1** 🟡 编码✅；§10/学习环/§11 链 `asr-vocabulary-bias-practices` |
| 2026-06-03 | **⑤‴½ REV-LOC ✅**：切片 A/B 验收签收；**Q-REV-1** 闭环；§10 **下一主序 → R4 + R4-GATE** |
| 2026-06-03 | **v1 0.1.0 + R9** ✅；§10 **下一主序 → LLM-LOC-SPIKE**（research/plan/acceptance + preflight；Gate 前无 4a） |
| 2026-06-03 | **工程拍板**：**Q-CSP-1** v1.1 硬化；**Q-SYMPH-1** 不裁 symphonia；**Q-STT-CANCEL-1** v1.1 真取消；**Q-PLUGIN-1** v1.1 权限；**Q-SIDECAR-1** L1+C2 Mac 自用 |
| 2026-06-04 | **行动方案落地**：⑤″f-A 机器闸门 `scripts/r3-5f-a-machine-gate.sh`；**Gate-B No-Go 4b**；[parallel-backlog](../specs/parallel-backlog-2026-06.md)；§10 工作区尾项（R3t-E+F2 UI 手测） |
| 2026-06-11 | **R3s-A Defer**（G1 前不编码）；§10 重写为 **R3h-I1 设计 → ASR-WARM** 两步 + 并行尾项表 |
| 2026-06-11 | **R3h-I1** Supervisor FSM 设计冻结 — [plan](../specs/r3h-i1-runtime-supervisor-fsm-plan.md)；§10 Step 2 → ASR-WARM |
| 2026-06-11 | **v1 后硬化盘点**：§10.1 全量台账；**F4-ASR No-go**；**F2/F1/F6** 复测 ✅；**F8** ✅；主刀 → **R3h-1-R CI** |
| 2026-06-11 | **R3h-1-R Release CI**：`release.yml` + `ci-publish-runtime-manifest-release.sh`；主刀 → **TRN-DIAG** |
| 2026-06-11 | **TRN-DIAG ✅**：`trn-diag-hand-test.sh` + 手测清单；下一刀 → ASR-WARM release（可选） |
| 2026-06-11 | §阶段状态：R4/R9 ✅；§4.1.9 F7/F8/MEM/F4；§13 对照刷新 |
| 2026-06-12 | **§10.4 v1.1+ 统一后续路线图**：DELIV-MODE · BATCH-TXN · CSP-HARDEN（Q-CSP-1）· STT-CANCEL（Q-STT-CANCEL-1）；Step 5–12；REL-1.1 手测集 |
| 2026-06-12 | **§10.4 + PROD-META**：Step **5b–c** 产品元信息（关于 / 版本 / 第三方许可）；H-PROD-*；Win checklist 闭合项 |
| 2026-06-12 | **§10.4 + ONBOARD**：Step **9a–b** 新手引导（Welcome 首跑清单 · 非 tour）；H-ONBOARD-*；research brief 门禁 |
| 2026-06-12 | **审查吸收**：R3g-A **单 SKU**；guard **46**；R3h-I2/I3 **🟡**；v1.1 CSP/STT **估时缓冲**；R3s-A Phase 0 触发；spec 未立项风险 |
| 2026-06-17 | **R3g-C Fun-ASR-Nano**：PyTorch spike **Defer**（[`acceptance`](../specs/r3g-c-funasr-nano-acceptance.md)）；dev venv 升 FunASR GitHub `main`；[`vllm-research`](../specs/r3g-c-funasr-nano-vllm-research.md) ✅；§10.4 主刀 → **BATCH-TXN** |
| 2026-06-18 | **BATCH-TXN Step 10–11 ✅** · **REL-1.1 Step 12 ✅**（H-CSP-* Release 手测）；**§10.4 v1.1+ 主序闭合** |
| 2026-06-18 | **ACC-STT-IFLYTEK 编码 ✅**（`iflytek-speed-asr` · `xunfei_speed_asr` · macOS keyring 三件套 · CONTEXT 词汇）；**§10.5 并行轨**；下一刀 **P1 手测** |
| 2026-06-18 | **桌面 UX 尾项**（`2a5e021`）：转写 copy/排版 · 浮动 dialog 动态 `layoutRev` · 定稿模式链接；§13 对照刷新（test **1489** · guard **13**） |
| 2026-06-18 | **R3g-C-NANO vLLM** ❌ **Defer**（无 NVIDIA CUDA · **目前不做** spike） |
| 2026-06-18 | **R3g-B-Align** ❌ **废弃**（2026-06-11 CPU ~8× 慢 · 不再做本机 Qwen3/ForcedAligner 第三 SKU）；§10.5 并行轨 **P2→架构热点 · P3→Win 资产** |
| 2026-06-18 | **ACC-STT-IFLYTEK ✅** — 手测签收；§10.5 **下一刀 → P2 架构热点** |
| 2026-06-19 | **P2 T-010 ✅**（`9612aae`）：`run_transcribe_cmd/` · `online_segment_normalize/` 目录化 · Wave A–H · guard **0** · lint **0**；§10.5 **下一刀 → P3 Win / CLN-066** |

---

## 13. 代码对照评估（2026-06-19，`main` · `9612aae`）

> 对照 **已推送 `main` 或工作区等价**。发版轮末刷新本节测试数 / 守卫警告 / 热点行数。

### 13.1 工程验证快照（实测 2026-06-19）

| 检查项 | 结果 |
|--------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run test`（desktop） | ✅ **1558** passed（**319** files） |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | ✅ **399** passed |
| `npm run lint` | ✅ **0** warnings |
| `node scripts/check-architecture-guard.mjs` | ✅ 0 错误，**0 警告** |
| `profile.rs` / R3c 缓存 / 清缓存对话框 | ✅ 已合入 `main` |
| `asr_setup_diagnose` / 一键准备 UI | ✅ **R3f mac 签收**（`asr_setup/`、`LocalAsrSetupWizard`） |
| `local_runtime/` LRC | ✅ **R3h-1/2/3**；**R3h-1-R** R1/R2 手测 ✅；**Release CI mac/linux ✅ · Win 🟡** |
| `asr_sidecar/supervisor.rs` + `warm.rs` | ✅ **I1a + ASR-WARM**（dev + release idle H5 2026-06-12） |
| **Phase 10** Hub + `ProjectMetadataDialog` | ✅ 2026-06-08 — [`project-hub-metadata-acceptance.md`](../specs/project-hub-metadata-acceptance.md) |
| `postTranscribeStageB.ts` / F0 | ✅ **R3t-E 能力**迁入阶段 B |
| `segmentation.py` / R3t-A 内核 | ✅ **手测签收**（2026-05-30；`scripts/r3t-a-hand-test.sh`） |
| `prepare(model_id)` / 模型目录 UI | ✅ R3g-A ⑤a–c（**目录现仅 Paraformer SKU**；SenseVoice deprecated 迁移） |
| 长音频动态超时（R3e-A） | ✅ 2026-05-30 长音频 timeout 手测 |
| 长音频分段转写（R3e-B） | ✅ 2026-05-30 签收 — [`r3e-b-hand-test-checklist.md`](../specs/r3e-b-hand-test-checklist.md) |
| **R3e-C 增量 preview** | ✅ **2026-05-31 手测签收** — 制控.mp3 197 段、首段 ~23.9s |
| 校对工作台波形 polish | ✅ minimap 56px、layoutIntent 缩放栏、语段 tap seek 等（2026-05-30） |
| `services/mcp` / `services/collab` | ❌ 未开始 |

**R3e-C 编码真源（手测对照）**：

- 侧车：`services/asr/rushi_asr/transcribe_job.py`、`transcribe_windows.py`（120s preview 窗）
- 桌面：`apps/desktop/src/pages/useTranscribeJobController.ts`、`transcribeAsyncPoll.ts`、`transcribePreviewState.ts`、`ProjectStatusFeedback.tsx`（`TranscribePreviewBanner`）
- 单测：`useTranscribeJobController*.test.ts`、`transcribeAsyncPoll.test.ts`、`transcribeExecuteGate.test.ts`

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
| **R3f** | `asr_setup_diagnose`、一键准备、8741 探测、LRC 缺失/损坏修复 | ✅ mac 签收 |
| **R3h-0/1-R** | smoke、Win 磁盘、`local_runtime`、manifest HTTPS 真源、A/B 回滚、R1+R2 手测 | ✅ mac/linux/Win CI |
| **R3g** | **单 SKU** Paraformer + prepare；R3-STATE 对齐；Profile 仍含 SenseVoice 参数 | ✅ ⑤a–c 签收 |
| **R3h-I2 / I3** | 续传/GC/C 回滚 vs Setup reducer | **🟡 编码✅**；统一 event bus / Rust Setup FSM **未闭合** |
| **R3t-A** | 分段内核 + 单测 + hints + 手测 | ✅ **2026-05-30 签收** |
| **R3t-B～C** | 转写编排、overwrite、邻段标点 | ✅ **2026-05-30** |
| **R3t-D** | `postprocess_refine_segments` + 段界整理 UI | ✅ **2026-05-31** |
| **R3t-E** | ⏸ 独立产品移除；Stage B 于 `postTranscribeStageB.ts` | ✅ via F0 |
| **⑤″f F2/F1/F6/F7/F8** | 查找替换、规则、记忆、bundle、导出预览 | ✅ 2026-06-11 |
| **F4-ASR** | ASR 置信门控 | ❌ No-go |
| **TRN-DIAG** | `transcribe_timeline.rs` + 诊断包 | ✅ 2026-06-11 |
| **R3h-I1 I1a** | Supervisor FSM + watchdog | ✅ 2026-06-11 |
| **ASR-WARM** | 保活 + 预热 + idle 回收 | ✅ **2026-06-12**（H5 signoff） |
| **Phase 10** | Hub + 项目场次元信息 | ✅ **2026-06-08** |
| **语段正文 P0** | draft defer + 页脚节流 | ✅ 2026-06-11 |
| **R3e-A** | 动态超时预算 | ✅ 2026-05-30 长音频 timeout 手测 |
| **R3e-B** | `transcribe_windows.py` + 5min 窗 | ✅ **2026-05-30 签收** |
| **R3e-C** | async Job + preview + cancel + 门禁 | ✅ **2026-05-31 签收** |
| **密集语段 UX** | Canvas bands + 列表虚拟化 | ✅ 2026-05-30；[`segment-overlay-virtualization.md`](../specs/segment-overlay-virtualization.md) |
| **R3g-C** | `asr_model_profile.py` + 识别语言 UI/pref | ✅ 2026-05-31 |
| **ACC-STT-UNIFY** | `stt_vocabulary` + `sttVocabularyBias` | ✅ 本机 2026-05-31；**百炼 E2E ✅** 2026-06-12 |
| **ACC-STT-IFLYTEK** | `xunfei_speed_asr` + `iflytek-speed-asr` + 三件套 UI | ✅ **2026-06-18** 手测签收 |
| **§10.4 v1.1+** | CSP · STT-CANCEL · DELIV · ONBOARD · BATCH · REL-1.1 | ✅ Step 5–12 · 2026-06-18 |
| **波形 UX** | 2026-05 minimap / zoom / tap seek | ✅ |
| **R4** | 质量 Tab + gate signoff | ✅ 2026-06-03 |
| **R5–R8** | MCP / collab / 非 v1 | ⏳ |
| **R9** | v1 严格签收 + 诊断包 + R3e-B/C | ✅ 2026-06-03 |
| **LLM-LOC 4a** | Ollama 本机路径 | ✅ 2026-06-03 |
| **R3h-1-R CI** | `release.yml` + ci-publish script | ✅ mac/linux **v0.1.1** 已发；**Win 安装包 🟡** |
| **T-010 热点回收** | `run_transcribe_cmd/` · `online_segment_normalize/` · cleanup Wave A–H | ✅ **2026-06-19**（`9612aae` · guard **0**） |

### 13.3 代码热点（2026-06-19 · guard **0** 警告）

> **T-010 主项已目录化**（2026-06-19 `9612aae`）。下表为仍值得观察的单文件（均 **≤400L**，guard 不报警）。

| 路径 | 行数 / 备注 | 判定 |
|------|-------------|------|
| `project/run_transcribe_cmd/` | 6 文件 · **816** 合计；最大 `sync.rs` **327** | ✅ 目录化；可选再拆 `sync.rs` |
| `project/online_segment_normalize/` | 5 文件 · **819** 合计；最大 `word_axis.rs` **229** | ✅ 目录化 |
| `useEnvOnlineSttPanel.ts` + 子 hook | 主 **164** + probe/persistence/credential | ✅ 已拆分 |
| `stt_native/dashscope_file_asr.rs` | **557** | 🟡 Rust 体量；非 T-010 原项 |
| `CorrectionRulesPreviewDialog.tsx` | **285** | 🟡 接近 300 |
| `DeliveryExportDialog.tsx` | **287** | 🟡 接近 300 |
| `model_prepare.py` | **146** | ✅ 已缩小（原 ~487） |
| `useAsrSetupController.ts` | ~122 | ✅ 已拆分 |

### 13.4 排期调整摘要（2026-06-19）

1. **§10.4 v1.1+ 主序闭合**（Step 5–12 ✅ · REL-1.1 2026-06-18）。  
2. **§10.5 并行轨**：**P1 ✅** → **P2 T-010 ✅**（2026-06-19）→ **P3 Win 资产 / P4 CLN-066**（← 现在）。  
3. **本机第三 SKU**（Qwen3 / ForcedAligner / Nano / vLLM）**全部关闭** — Align **废弃** 2026-06-18。  
4. **Release**：**v0.1.1** mac/linux 已发；**Windows 安装包仍缺**。  
5. **guard** 自 46 → **0** 警告（2026-06-19）；叠大功能前仍遵守 hook/行数纪律。

### 13.5 风险（对照后）

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| R3t-A 手测未签即开 R3t-B | — | ✅ 2026-05-30 已签 |
| **R3e-C 手测滞后** | — | ✅ 2026-05-31 已签 |
| **R3h-0 跨平台 smoke 未闭环** | **低** | mac/linux/Win CI ✅；**Win v0.1.1 release 资产**仍缺 |
| R3f / R3h-0 手测滞后 | — | ✅ mac 签收；Win ⏸ 有 Win 机时补 |
| **R3 工期低估** | 中 | §4.0 **~12～15w**（2026-06-02）；⑤″f **4–6w** 含 MEM |
| **Qwen3 伪流式**（chunk 无跨段上下文） | 中 | **⑤″f-E** spike **G4 加严**；20min Job 手测 |
| **SenseVoice 目录 SKU** | **低**（已收口） | UI 目录 **仅 Paraformer**；legacy hub id 迁移；百炼 SenseVoice-v1 **2026-03-09** 下线 — **Q-ASR-1** |
| **v1.1 spec 未立项** | — | ✅ **2026-06-18 已闭合**（§10.4 六组 Epic 编码 + REL-1.1）；**§10.5 新增项**仍须 research 门禁 |
| **guard 热点** | **低** | guard **0** 警告（2026-06-19）；T-010 主项 ✅；叠功能前仍守 hook/行数纪律 |
| **功能分支未合 main** | — | 2026-06-02 条目已过期；以 `main` + §13.1 为准 |
| **随包 user-guide 漂移** | **中** | **PROD-META 5c** 刷新 §1–3；L2 真源仍为 `EnvHelpPanel` |
| **~2.5GB 侧车体积** | 中 | R3h-3.5 Sherpa → **轻量模式**候选（ADR-0003 附录），非 v1 必达 |
| 文档 §13 与实测再次漂移 | 低 | 每 Epic 签收后刷新 §13.1 一行 |
| 波形热点超阈值继续叠功能 | 中 | 下一波形刀先拆 `pxPerSec` 或 drag |
| 长音频 OOM / 超时 | 高 | **R3e-A/B ✅** + R3t-A/B |
| LRC 大模块（**T-010**） | 中 | R3h-2 / R3h-I 薄片内拆 |
