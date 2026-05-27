# 录音转写 → 声学分段 → LLM 校准（管线真源）

> **状态**：**R3t-A 进行中**（2026-05-27）；`segmentation.py` 为 L2 分段真源  
> **关联**：[`recording-transcribe-llm-refine-intent.md`](../execution/specs/recording-transcribe-llm-refine-intent.md)、[`rushi-execution-roadmap.md`](../execution/plans/rushi-execution-roadmap.md) §R3t、[`postprocess-remote-boundary.md`](./postprocess-remote-boundary.md)、[`desktop-capability-ui-state-alignment.md`](./desktop-capability-ui-state-alignment.md)

## 1. 结论（一句话）

**录音转写**走 **ASR 先产出带时间的声学语段（真源）**；**LLM 校准**只在 **stable 语段** 上做标点 / 边界 / 审校，**预览确认后写回**。  
**不做**「整轨纯文本 → LLM 切段 → 再贴时间」作为主路径；**不做**流式/mic（另立项）。

## 2. 与业内成熟方案的对齐

| 阶段 | 业内常见做法 | R3t 取舍 |
|------|--------------|----------|
| 分段边界 | VAD / turn / ASR `sentence_info`（带时间戳） | **声学段为主**；Paraformer 可细到句级 |
| 字准 | 离线 batch / 分段 ASR 优于真流式 | **整文件或 VAD 段内 ASR**，非 mic 流式 |
| LLM | 在 **已分段 + 时间约束** 上改字/合并/拆分 | **结构化 ops + diff 预览** |
| 实时 | live 与 final 双通道 | **v1 仅 final（录音转写）**；live 延后 |

## 3. 端到端管线（v1）

```text
┌─────────────────────────────────────────────────────────────────┐
│ 用户：导入/录音文件 → 项目内「拉取语段 / 本机转写」                    │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L0 前置（已有 / R3f·R3g）                                         │
│ 侧车就绪 · 所选 SKU(D1)=侧车(D2) · 模型权重(D4) · 术语 hotwords      │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L1 媒体规范化（侧车 / 已有）                                       │
│ ffmpeg → 16k mono WAV · 时长 · 超时策略（R3e-A）                    │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L2 声学分段 + ASR（R3t-A，吸收 R3g 引擎 + R3e-B 分段思想）           │
│ ① VAD 切语音区 → ② 逐段（或句级）识别 → ③ segments[] + warnings    │
│ 禁止默认整轨 funasr_whole_track_fallback 作为终态                    │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L3 原子落库（R3t-B）                                               │
│ Tauri project_run_transcribe → SQLite 语段（uid, start, end, text） │
│ status=stable · source=asr_batch · 一次性替换或版本策略见 plan      │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L4 LLM 校准（R3t-C/D/E，桌面 Rust，不进侧车）                          │
│ C=标点  D=段界  E=词表有据校对（glossary + correction_memory）         │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L5 编辑真源（已有）                                                │
│ 草稿 store · 波形 · 导出 TXT/SRT · 可选本地 revision / edit_log    │
└───────────────────────────────┬─────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ L6 终稿 Word 格式化导出（EXP-WORD，规划）                            │
│ 逐字稿 / 讲稿 / 干净稿 · 版式模板 · 可选修订摘要附录（单机，非 C6）   │
│ 基线：P3 `export_docx` 已有；本 Epic 为 R3t 后「交付」增强           │
└─────────────────────────────────────────────────────────────────┘
```

## 4. 信任边界

| 层 | 职责 | 禁止 |
|----|------|------|
| `services/asr` 侧车 | L1–L2：规范化、VAD、FunASR、segments JSON | LLM、用户密钥、静默改库 |
| Tauri `project/` | L3：HTTP 转写、解析 segments、写 SQLite | 在编排层堆 LLM prompt |
| Tauri `postprocess_cmd` | L4：配置、keychain、HTTPS、ops 校验 | 读 FunASR 权重 |
| React 编辑器 | 进度、预览 diff、确认写回 | 直连云端密钥 |

见 [`postprocess-remote-boundary.md`](./postprocess-remote-boundary.md)。

## 5. 语段数据契约（规划）

| 字段 | L2–L3（ASR 写入） | L4（LLM 后） |
|------|-------------------|--------------|
| `uid` | 新建或保留 | merge 保留主 uid；split 左保留、右新建 |
| `start_sec` / `end_sec` | ASR/VAD 真源 | split 必须落在 ASR 边界内或显式告警 |
| `text` | ASR 原文 | 用户确认后更新 |
| `status` | `stable`（v1 无 partial） | 仍为 `stable`；可加 `revised` |
| `source` | `asr_batch` | `llm_refine_punct` / `llm_refine_segment` / `llm_refine_lexicon` |
| `detail` / warnings | 如 `funasr_whole_track_fallback` | 不应出现在终态 |

**v1 不写 partial 进 SQLite**；流式 Epic 再引入 `partial`。

## 6. LLM 校准输入/输出（规划）

### 6.1 输入窗口

- 默认：**当前语段 + 前后各 N 段**（N=1，可配置为 2）
- 必带：`{ uid, start_sec, end_sec, text }[]`
- **R3t-E 另带**：[`LexiconPack`](./lexicon-guided-llm-refine.md)（`glossary_terms` + `correction_memory` 结构化，**非** hotwords 空格串）
- 可选：邻段上下文（C/D/E 窗口策略见 plan）

### 6.2 输出形态（分两档）

| 档位 | 任务 | 输出 | UI |
|------|------|------|-----|
| **R3t-C** | 自动标点 | 单段或窗口 `text` + diff | 延续 R2 `AutoPunctuatePreviewDialog` |
| **R3t-D** | 语义段界 | `ops[]`：merge / split / update_text | 时间轴 + 文本双 diff，确认后事务应用 |
| **R3t-E** | 词表有据校对 | `update_text` ops + **`evidence`** | [`lexicon-guided-llm-refine.md`](./lexicon-guided-llm-refine.md) |

`split` 的 `at_sec` 必须在 `[start,end]` 内，或由 LLM 建议「句中点」再由 Rust 校验。

### 6.3 与 R2 关系

- **R2 已交付**：单语段 `postprocess_auto_punctuate`
- **R3t-C**：可选扩展为「选中段 + 邻段上下文」；不替代 R2 行为
- **R3t-D**：新命令 `postprocess_refine_segments`（名称实施时定）

## 7. 与现有 R3 切片映射

| 现有 ID | 纳入 R3t 的方式 |
|---------|-----------------|
| R3g-A ⑤c | **R3t-A 验收子集**（多语段、Paraformer+punc） |
| R3e-A | L1 超时，横切 |
| R3e-B | **与 R3t-A 合并设计**：长音频 VAD 分段转写 + 进度；避免两套分段逻辑 |
| R2 auto_punctuate | **R3t-C** 直接继承 |
| R3-STATE | 转写进度/就绪仍遵守 D1–D6 |

## 8. 明确不做（v1）

- 流式 / mic / partial 落库
- LLM 静默覆盖、无预览
- LLM 进 ASR 侧车
- 整文件一次 LLM（超上下文风险）
- `smart_segment` 无时间约束的纯文本切段
- 协作服务端 revision（R8）；本地仅可选 `edit_log` 扩展

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| R3e-B 与 R3t-A 重复实现 | **统一** `funasr_engine` 分段策略；e-B 只做编排/进度/合并 |
| LLM 改坏时间轴 | ops 校验 + 预览 + 可拒绝 |
| 长音频 OOM | VAD 分段（R3t-A）+ e-A 超时 |
| 用户以为「校准=重新转写」 | UI 文案区分「拉取语段」与「AI 校准」 |

## 10. 文档索引

| 文档 | 用途 |
|------|------|
| [`recording-transcribe-llm-refine-intent.md`](../execution/specs/recording-transcribe-llm-refine-intent.md) | 目标、范围、不做 |
| [`recording-transcribe-llm-refine-plan.md`](../execution/specs/recording-transcribe-llm-refine-plan.md) | 分阶段、落位、依赖 |
| [`recording-transcribe-llm-refine-acceptance.md`](../execution/specs/recording-transcribe-llm-refine-acceptance.md) | 签收清单 |
| [`word-formatted-export-backlog.md`](../execution/specs/word-formatted-export-backlog.md) | **L6 EXP-WORD** 终稿 Word 交付 |
| [`p3-acceptance.md`](../execution/p3-acceptance.md) | P3 DOCX **基线** |
| [`personal-solo-v1-backlog.md`](../execution/specs/personal-solo-v1-backlog.md) | 个人单机 v1 能力矩阵 |
| [`llm-local-runtime-backlog.md`](../execution/specs/llm-local-runtime-backlog.md) | **LLM-LOC** 本机 LLM（4a/4b，v1 后） |
