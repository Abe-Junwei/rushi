# Backlog: 个人单机 v1 能力补齐（Personal Solo v1）

> **状态**：规划定稿（2026-05-27）；**产品定位真源**  
> **排期索引**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §1.6、§1.8、§4.1.1  
> **非 v1**：协作 R6–R8、C4–C7、企业采购、多语言/CAT、商业化、转写 farm / queue

---

## 1. 产品定位（一句话）

**面向个人、单机、离线优先的口述转写与校对工作站**：本机 ASR → 语段编辑 →（可选）**云端** LLM 校对（v1）→ Word/文本交付；**v1 后** 本机 LLM 见 [`llm-local-runtime-backlog.md`](./llm-local-runtime-backlog.md)。

对标体验：**MacWhisper / 听见桌面 / Descript 单机口述链**，不对标协作审校平台或 CAT。

---

## 2. v1 能力矩阵（P0 / P1 / P2）

| 优先级 | 能力 | Epic / 落点 | 状态 |
|--------|------|-------------|------|
| **P0** | 零终端安装、坏包可恢复、就绪可信 | R3h-0～3、R3f、**R3-STATE**（R3g ⑤b） | 🟡 进行中 |
| **P0** | 长音频多段、时间轴可信 | R3t-A/B、R3e-A/B | ✅ 2026-05-30 签收（[`r3e-b-hand-test-checklist.md`](./r3e-b-hand-test-checklist.md)） |
| **P0** | 术语热词 + 保存学 memory | glossary ✅、HOT-UX、R3t-E、**⑤″f**（路线图 §4.1.9：VOC-1 手测、VOC-5、F6+、F7） | 部分 ✅ |
| **P0** | LLM 校对可控（预览写回） | R2 ✅、R3t-C/D/E | 部分 ✅ |
| **P0** | 定稿 Word/文本与编辑一致 | P3 ✅、**EXP-WORD** | 部分 ✅ |
| **P1** | 同项目多次转写不明显冷启动 | **ASR-WARM**（R3h-I4） | 📋 |
| **P1** | 转写失败可理解、可重试 | R3e 分类 + **TRN-DIAG** | 部分 / 📋 |
| **P1** | 发版质量可回归 | **R4** + **R4-GATE**（R9 硬门禁） | 📋 |
| **P1** | 架构硬化（FSM / 发布 / Setup） | **R3h-I1～I3** | 📋 |
| **P2** | 单机修订可追溯 / 恢复 | **REV-LOC**（轻量，非 R8） | 📋 规格✅ · 编码后置 |
| **P2** | 外部 Agent 只读读稿 | R5 MCP | 📋 可后置 |
| **v1 后** | 本机 LLM 校对 | **LLM-LOC** Spike→Gate | 📋 规划；**待 Gate** |
| **—** | 词级时间轨、说话人分离、AAF/EDL、实时 mic | — | **v1 不做**（另立项或远期） |

---

## 3. 子 Epic 说明

### 3.1 ASR-WARM — 侧车保活（R3h-I4）

| 项 | 内容 |
|----|------|
| **问题** | 每次转写重新拉起侧车/重载模型，长会话体验差 |
| **目标** | 应用会话内 **Persistent worker**：模型预热、空闲回收策略、与 Runtime Supervisor 一致 |
| **不做** | 多机 GPU 池、云端 queue |
| **依赖** | R3h-I1 或 R3h-2 最小契约；**R3t-B** 转写任务状态稳定后实施 |
| **验收** | 同一项目连续 2 次转写：第二次明显短于冷启动；诊断包含 runtime session id |

**验收真源**：[`asr-warm-acceptance.md`](./asr-warm-acceptance.md)

**落位**：`asr_sidecar.rs`、侧车 HTTP keep-alive / 常驻进程策略（实施 spec 立项时定）。

### 3.2 TRN-DIAG — 转写任务可观测（单机排障）

| 项 | 内容 |
|----|------|
| **问题** | 长音频失败难以判断卡在规范化、VAD、哪一段 ASR |
| **目标** | 桌面 **转写任务时间线**（阶段、耗时、段数、warnings）；并入诊断包导出 |
| **依赖** | R3t-B 编排；与 R3e 失败分类文案统一 |
| **验收** | 故意失败一次转写：UI 与诊断包能指出阶段 + 建议动作（重试/清缓存/换模型） |

**验收真源**：[`trn-diag-acceptance.md`](./trn-diag-acceptance.md)

**落位**：`transcribe.rs` 编排事件、`useTranscriptionLayer` 或专用 `useTranscribeJobView`、诊断 JSON schema。

### 3.3 REV-LOC — 单机修订轻量（非协作 revision）

| 项 | 内容 |
|----|------|
| **问题** | 误操作或 LLM 写回后难以回到上一版 |
| **目标** | 基于 **`edit_log`（Q5 可选）** 或导出前快照：查看最近 N 次变更、**单项目恢复点**（非 Word Track Changes） |
| **不做** | 协作 `revision_events`、CRDT、双端合并 |
| **依赖** | R3t-E 与人工保存路径稳定；**EXP-WORD** 可引用同 log 做附录 |
| **验收** | 改 3 句 → 可从列表恢复某一保存点语段正文；撤销与自动保存对齐 |

**验收真源**：[`rev-loc-undo-edit-history-acceptance.md`](./rev-loc-undo-edit-history-acceptance.md)（调研 [`rev-loc-undo-edit-history-research.md`](./rev-loc-undo-edit-history-research.md)）

**v1 默认**：**P2 可选**；**2026-05-31** 规格三件套已定，**编码后置**（见路线图 **Q-REV-1**，不挡 R9）。

### 3.4 R4-GATE — 个人发版质量门禁

| 项 | 内容 |
|----|------|
| **目标** | R9 前必须跑通固定 **eval 集**（CER / term_hit_rate），结果写入质量 Tab；**回归对比上一版** |
| **不做** | LLM-as-judge 在线执行、synthetic 数据工厂 |
| **依赖** | R4 QLT-1 插槽 |
| **验收** | `npm run` 或 `scripts/eval-run.py` 一条命令；R9 checklist 勾选 |

---

## 4. 建议排期（嵌入 §4.1.1）

```text
… → R3t-B
    → TRN-DIAG（0.5w）
    → … → R3h-2
    → ASR-WARM（0.5～1w，R3h-I4）
    → … → R3t-E → EXP-WORD
    → REV-LOC（0.5～1w；规格✅ · 编码后置，见 Q-REV-1）
    → R4（含 R4-GATE）
    → R9（个人单机主路径，不含 R6–R8）
```

**R5 MCP**、**R6–R8**、**C4–C7**：**非个人 v1 阻塞**；见路线图 §6。

---

## 5. R9 个人单机主路径手测（摘要）

1. 应用内完成本机 ASR 安装与 smoke（无必需 shell）。  
2. 13min 与 30～60min 音频：多段转写、warnings 可理解。  
3. 术语 + 保存一句 → 再转写可见 hints。  
4. （可选）R3t 校对 → 预览确认写回。  
5. 编辑 → **EXP-WORD** 导出 → Word 打开版式正确 → 重启后 SQLite 一致。  
6. R4-GATE eval 已跑且质量 Tab 有摘要。

---

## 6. 修订记录

| 日期 | 变更 |
|------|------|
| 2026-05-27 | 初版：个人单机定位；ASR-WARM / TRN-DIAG / REV-LOC / R4-GATE |
| 2026-05-27 | 链接 TRN-DIAG / ASR-WARM acceptance；EXP-WORD 见 `exp-word-formatted-export-acceptance.md` |
| 2026-05-31 | REV-LOC 三件套 + 路线图 Q-REV-1；编码后置、不挡 R9 |
